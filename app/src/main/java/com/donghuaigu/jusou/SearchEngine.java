package com.donghuaigu.jusou;

import java.io.UnsupportedEncodingException;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 多源图片聚合搜索引擎。
 *
 * 设计要点：
 *  - 每个图片源是一个独立适配器，并发请求、单独超时与容错；任一源失败不影响其它源。
 *  - 结果统一成 ImageItem，按「贴近搜索词的相关度」+「热门程度」打分。
 *    「热门」由源内排名、源提供的浏览/下载/点赞数、以及被多个源同时命中的次数共同决定。
 *  - 按规范化 URL 去重，最后按综合分排序并截断到最多 300 张。
 *  - 纯 Java，无 Android / 第三方依赖，可在桌面 JVM 上直接跑集成测试。
 */
public final class SearchEngine {
    private SearchEngine() {}

    public static final int MAX_RESULTS = 300;

    public interface Source {
        String key();
        String name();
        String kind();              // "engine" 搜索引擎 / "library" 图库
        boolean needsKey();
        List<ImageItem> fetch(String query, int max, boolean safe, Map<String, String> keys) throws Exception;
    }

    public static final List<Source> SOURCES = Collections.unmodifiableList(Arrays.asList(
            new BingSource(), new SogouSource(), new So360Source(), new BaiduSource(),
            new DuckDuckGoSource(), new GoogleSource(),
            new OpenverseSource(), new WikimediaSource(), new FlickrSource(), new NasaSource(),
            new PixabaySource(), new PexelsSource(), new UnsplashSource()
    ));

    /** 免密钥、默认开启的源（真机上网络可达即生效）。 */
    public static final Set<String> DEFAULT_ENABLED = new HashSet<String>(Arrays.asList(
            "bing", "sogou", "so360", "baidu", "duckduckgo", "openverse", "wikimedia", "flickr"
    ));

    public static Map<String, Object> sourcesInfo() {
        List<Object> list = new ArrayList<Object>();
        for (Source s : SOURCES) {
            Map<String, Object> m = new LinkedHashMap<String, Object>();
            m.put("key", s.key());
            m.put("name", s.name());
            m.put("kind", s.kind());
            m.put("needsKey", s.needsKey());
            list.add(m);
        }
        Map<String, Object> r = new LinkedHashMap<String, Object>();
        r.put("sources", list);
        return r;
    }

    public static final class SourceStat {
        public String key, name, error = "";
        public int count;
        public long ms;
        public boolean skipped;
        Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<String, Object>();
            m.put("key", key); m.put("name", name); m.put("count", count);
            m.put("ms", ms); m.put("error", error); m.put("skipped", skipped);
            return m;
        }
    }

    public static final class Result {
        public String query = "";
        public List<ImageItem> items = new ArrayList<ImageItem>();
        public List<SourceStat> stats = new ArrayList<SourceStat>();
        public long elapsedMs;
        public Map<String, Object> toMap() {
            List<Object> a = new ArrayList<Object>();
            for (ImageItem i : items) a.add(i.toMap());
            List<Object> st = new ArrayList<Object>();
            for (SourceStat s : stats) st.add(s.toMap());
            Map<String, Object> m = new LinkedHashMap<String, Object>();
            m.put("ok", true);
            m.put("query", query);
            m.put("total", items.size());
            m.put("elapsedMs", elapsedMs);
            m.put("items", a);
            m.put("stats", st);
            return m;
        }
    }

    /** 聚合搜索主入口。 */
    public static Result search(final String query, Set<String> enabled, final int limit,
                                final boolean safe, final Map<String, String> keys) {
        final long t0 = System.currentTimeMillis();
        Result result = new Result();
        result.query = query == null ? "" : query.trim();
        final String q = result.query;
        if (q.isEmpty()) { result.elapsedMs = 0; return result; }

        final int cap = Math.max(1, Math.min(MAX_RESULTS, limit <= 0 ? MAX_RESULTS : limit));
        // 每源抓取量随目标上限动态调整：上限提高时多取一些，保证去重后仍能凑满 300 张。
        // 各 Source 内部还有自己的接口上限（20~60），所以这里放大不会引发过量请求。
        final int perSource = Math.max(40, Math.min(60, (cap + 5) / 5));
        final Set<String> on = (enabled == null || enabled.isEmpty())
                ? new HashSet<String>(DEFAULT_ENABLED) : new HashSet<String>(enabled);
        final Map<String, String> kk = keys == null ? new HashMap<String, String>() : keys;

        ExecutorService pool = Executors.newFixedThreadPool(Math.max(4, Math.min(SOURCES.size(), 8)));
        Map<String, Future<List<ImageItem>>> futures = new LinkedHashMap<String, Future<List<ImageItem>>>();
        Map<String, Long> started = new HashMap<String, Long>();

        for (final Source s : SOURCES) {
            SourceStat stat = new SourceStat();
            stat.key = s.key(); stat.name = s.name();
            if (!on.contains(s.key())) { stat.skipped = true; result.stats.add(stat); continue; }
            if (s.needsKey()) {
                String key = kk.get(s.key());
                if (key == null || key.trim().isEmpty()) {
                    stat.skipped = true;
                    stat.error = "未配置 API Key";
                    result.stats.add(stat);
                    continue;
                }
            }
            result.stats.add(stat);
            started.put(s.key(), System.currentTimeMillis());
            futures.put(s.key(), pool.submit(new Callable<List<ImageItem>>() {
                public List<ImageItem> call() throws Exception {
                    return s.fetch(q, perSource, safe, kk);
                }
            }));
        }

        List<ImageItem> all = new ArrayList<ImageItem>();
        long deadline = t0 + 14000L;
        for (SourceStat stat : result.stats) {
            if (stat.skipped) continue;
            Future<List<ImageItem>> f = futures.get(stat.key);
            long left = deadline - System.currentTimeMillis();
            if (left <= 0) left = 1;
            try {
                List<ImageItem> got = f.get(left, TimeUnit.MILLISECONDS);
                if (got != null) { all.addAll(got); stat.count = got.size(); }
            } catch (Exception e) {
                Throwable cause = e.getCause() == null ? e : e.getCause();
                String msg = cause.getMessage();
                stat.error = msg == null ? cause.getClass().getSimpleName() : clip(msg, 90);
            }
            stat.ms = System.currentTimeMillis() - started.get(stat.key);
        }
        pool.shutdownNow();

        List<ImageItem> merged = score(q, dedup(all));
        Collections.sort(merged, new Comparator<ImageItem>() {
            public int compare(ImageItem a, ImageItem b) {
                return Double.compare(b.score, a.score);
            }
        });
        if (merged.size() > cap) merged = new ArrayList<ImageItem>(merged.subList(0, cap));
        result.items = merged;
        result.elapsedMs = System.currentTimeMillis() - t0;
        return result;
    }

    // ---------------------------------------------------------------- 去重 / 打分

    private static String normUrl(String u) {
        if (u == null) return "";
        String s = u.trim().toLowerCase(Locale.US);
        int p = s.indexOf("://");
        if (p > 0) s = s.substring(p + 3);
        if (s.startsWith("www.")) s = s.substring(4);
        s = s.replaceAll("&(x-expires|x-signature|_iz|lk3s|from|timestamp|random|_t|sign|token)=[^&]*", "");
        s = s.replaceAll("\\?&(amp;)?", "?").replaceAll("[?&]+$", "");
        return s;
    }

    private static List<ImageItem> dedup(List<ImageItem> all) {
        Map<String, ImageItem> seen = new LinkedHashMap<String, ImageItem>();
        Map<String, Integer> hits = new HashMap<String, Integer>();
        for (ImageItem it : all) {
            String k = normUrl(it.fullUrl);
            if (k.isEmpty()) k = normUrl(it.thumbUrl);
            if (k.isEmpty()) continue;
            ImageItem old = seen.get(k);
            if (old == null) {
                seen.put(k, it);
                hits.put(k, 1);
            } else {
                int n = hits.get(k) + 1;
                hits.put(k, n);
                // 保留信息更完整的一条；标题优先取更长更有信息量的
                if (it.title.length() > old.title.length()) old.title = it.title;
                if (old.fullUrl.isEmpty()) old.fullUrl = it.fullUrl;
                if (old.thumbUrl.isEmpty()) old.thumbUrl = it.thumbUrl;
                if (old.pageUrl.isEmpty()) old.pageUrl = it.pageUrl;
                old.rawPopularity = Math.max(old.rawPopularity, it.rawPopularity);
                old.multiSourceHits = n;
            }
        }
        List<ImageItem> out = new ArrayList<ImageItem>(seen.values());
        for (ImageItem i : out) {
            Integer n = hits.get(normUrl(i.fullUrl.isEmpty() ? i.thumbUrl : i.fullUrl));
            if (n != null) i.multiSourceHits = n;
        }
        return out;
    }

    private static List<String> tokens(String q) {
        List<String> out = new ArrayList<String>();
        String s = q.toLowerCase(Locale.US).trim();
        out.add(s);
        StringBuilder word = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (Character.isLetterOrDigit(c)) word.append(c);
            else {
                if (word.length() > 1) out.add(word.toString());
                word.setLength(0);
            }
        }
        if (word.length() > 1) out.add(word.toString());
        // 中文 2-gram，提升「纹身图案」这类连续汉字的匹配能力
        String cn = s.replaceAll("[^\\u4e00-\\u9fa5]", "");
        for (int i = 0; i + 1 < cn.length(); i++) out.add(cn.substring(i, i + 2));
        Set<String> uniq = new java.util.LinkedHashSet<String>();
        for (String tok : out) if (!tok.isEmpty()) uniq.add(tok);
        return new ArrayList<String>(uniq);
    }

    private static List<ImageItem> score(String q, List<ImageItem> items) {
        List<String> tk = tokens(q);
        double totalWeight = 0;
        for (String t : tk) totalWeight += t.length() >= 2 ? (t.length() > 3 ? 2.0 : 1.0) : 0.5;
        if (totalWeight <= 0) totalWeight = 1;
        String ql = q.toLowerCase(Locale.US);

        for (ImageItem it : items) {
            String title = (it.title == null ? "" : it.title).toLowerCase(Locale.US);
            double hit = 0;
            for (String t : tk) {
                if (t.isEmpty() || !title.contains(t)) continue;
                hit += t.length() >= 2 ? (t.length() > 3 ? 2.0 : 1.0) : 0.5;
            }
            double match = hit / totalWeight;
            double rel = 0.16 + 0.68 * Math.min(1.0, match);
            if (title.contains(ql)) rel += 0.12;
            rel += 0.06 * Math.max(0, 1.0 - it.rank / 40.0);
            it.relevance = clamp01(rel);

            double rankHeat = 1.0 / (1.0 + it.rank * 0.075);
            double heat = 0;
            if (it.rawPopularity > 0) heat = Math.min(1.0, Math.log10(1 + it.rawPopularity) / 6.0);
            double pop = (it.rawPopularity > 0) ? 0.45 * rankHeat + 0.55 * heat : rankHeat;
            // 被多个源同时命中 → 说明这张图更「热门 / 更贴题」
            pop += Math.min(0.18, Math.max(0, it.multiSourceHits - 1) * 0.06);
            it.popularity = clamp01(pop);
            it.score = clamp01(0.55 * it.relevance + 0.45 * it.popularity);
        }
        return items;
    }

    private static double clamp01(double v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
    private static String clip(String s, int n) { return s.length() <= n ? s : s.substring(0, n) + "…"; }

    // ---------------------------------------------------------------- 工具

    static ImageItem item(String src, String srcName, String title,
                          String thumb, String full, String page, Object w, Object h,
                          String license, int rank, long popularity) {
        ImageItem i = new ImageItem();
        i.source = src; i.sourceName = srcName;
        i.title = cleanTitle(title);
        i.thumbUrl = safeUrl(thumb);
        i.fullUrl = safeUrl(full);
        i.pageUrl = safeUrl(page);
        i.width = String.valueOf(Json.integer(w, 0));
        i.height = String.valueOf(Json.integer(h, 0));
        if ("0".equals(i.width)) i.width = "";
        if ("0".equals(i.height)) i.height = "";
        i.license = license == null ? "" : license;
        i.rank = rank;
        i.rawPopularity = popularity;
        String base = i.fullUrl.isEmpty() ? i.thumbUrl : i.fullUrl;
        i.id = md5(base + "|" + src).substring(0, 14);
        return i;
    }

    private static String safeUrl(String u) {
        if (u == null) return "";
        u = Json.unescapeHtml(u).trim().replace("\\/", "/");
        if (u.startsWith("//")) u = "https:" + u;
        if (u.startsWith("http://")) u = "https://" + u.substring(7);
        if (!u.startsWith("https://")) return "";
        return u.replace(" ", "%20");
    }

    private static String cleanTitle(String s) {
        if (s == null) return "";
        s = Json.unescapeHtml(s).replaceAll("<[^>]+>", "").replaceAll("\\s+", " ").trim();
        return s.length() > 90 ? s.substring(0, 90) + "…" : s;
    }

    private static String md5(String s) {
        try {
            byte[] b = MessageDigest.getInstance("MD5").digest(s.getBytes("UTF-8"));
            StringBuilder sb = new StringBuilder();
            for (byte x : b) sb.append(String.format("%02x", x & 0xff));
            return sb.toString();
        } catch (Exception e) { return Integer.toHexString(s.hashCode()); }
    }

    static String firstNonEmpty(String... v) {
        for (String s : v) if (s != null && !s.trim().isEmpty()) return s.trim();
        return "";
    }

    static String str(Map<String, Object> m, String k) { return Json.str(m.get(k)); }
    static Map<String, Object> map(Object o) { return Json.obj(o); }

    // ================================================================ 各图片源

    /** 必应图片（国内走 cn.bing.com，海外自动回退 www.bing.com）。 */
    static final class BingSource implements Source {
        public String key() { return "bing"; }
        public String name() { return "必应图片"; }
        public String kind() { return "engine"; }
        public boolean needsKey() { return false; }
        private static final Pattern M = Pattern.compile("\\bm=[\"']([^\"']+)[\"']");
        public List<ImageItem> fetch(String q, int max, boolean safe, Map<String, String> keys) throws Exception {
            String host = "https://cn.bing.com";
            String url = host + "/images/async?q=" + Net.encode(q) + "&first=0&count=" + Math.min(max, 60)
                    + "&adlt=" + (safe ? "strict" : "off") + "&mmasync=1";
            String html;
            try { html = Net.text(url, host + "/images/search?q=" + Net.encode(q)); }
            catch (Exception e) {
                host = "https://www.bing.com";
                url = host + "/images/async?q=" + Net.encode(q) + "&first=0&count=" + Math.min(max, 60)
                        + "&adlt=" + (safe ? "strict" : "off") + "&mmasync=1";
                html = Net.text(url, host + "/images/search?q=" + Net.encode(q));
            }
            List<ImageItem> out = new ArrayList<ImageItem>();
            Matcher m = M.matcher(html);
            int rank = 0;
            while (m.find() && out.size() < max) {
                String raw = Json.unescapeHtml(m.group(1));
                if (raw.indexOf("murl") < 0) continue;
                try {
                    Map<String, Object> d = Json.obj(Json.parse(raw));
                    String full = Json.str(d.get("murl"));
                    if (full.isEmpty()) continue;
                    out.add(item("bing", name(), Json.str(d.get("t")),
                            Json.str(d.get("turl")), full, Json.str(d.get("purl")),
                            null, null, "", rank++, 0));
                } catch (Exception ignored) {}
            }
            if (out.isEmpty()) throw new Exception("必应未返回可解析结果（可能被限流）");
            return out;
        }
    }

    /** 搜狗图片：页面内联 window.__INITIAL_STATE__ JSON。 */
    static final class SogouSource implements Source {
        public String key() { return "sogou"; }
        public String name() { return "搜狗图片"; }
        public String kind() { return "engine"; }
        public boolean needsKey() { return false; }
        public List<ImageItem> fetch(String q, int max, boolean safe, Map<String, String> keys) throws Exception {
            String url = "https://pic.sogou.com/pics?query=" + Net.encode(q);
            String html = Net.text(url, "https://pic.sogou.com/");
            int at = html.indexOf("window.__INITIAL_STATE__");
            if (at < 0) throw new Exception("搜狗页面结构变化");
            int brace = html.indexOf('{', at);
            if (brace < 0) throw new Exception("搜狗内联数据缺失");
            Object root = Json.parsePrefix(html, brace, new int[1]);
            Object list = Json.get(root, "searchList", "searchList");
            List<ImageItem> out = new ArrayList<ImageItem>();
            int rank = 0;
            for (Object o : Json.arr(list)) {
                if (out.size() >= max) break;
                Map<String, Object> d = Json.obj(o);
                String full = firstNonEmpty(Json.str(d.get("oriPicUrl")), Json.str(d.get("pic_url")),
                        Json.str(d.get("thumbUrl")), Json.str(d.get("url")));
                if (full.isEmpty()) continue;
                out.add(item("sogou", name(), Json.str(d.get("title")),
                        Json.str(d.get("thumbUrl")), full, Json.str(d.get("pageUrl")),
                        d.get("width"), d.get("height"), "", rank++, 0));
            }
            if (out.isEmpty()) throw new Exception("搜狗未返回结果");
            return out;
        }
    }

    /** 360 图片：页面内联 "list":[...] 数组。 */
    static final class So360Source implements Source {
        public String key() { return "so360"; }
        public String name() { return "360 图片"; }
        public String kind() { return "engine"; }
        public boolean needsKey() { return false; }
        public List<ImageItem> fetch(String q, int max, boolean safe, Map<String, String> keys) throws Exception {
            String url = "https://image.so.com/i?q=" + Net.encode(q) + "&pd=1&pn=60&correct=" + Net.encode(q);
            String html = Net.text(url, "https://image.so.com/");
            int at = html.indexOf("\"list\":");
            if (at < 0) throw new Exception("360 页面结构变化");
            int br = html.indexOf('[', at);
            if (br < 0) throw new Exception("360 数据缺失");
            Object arr = Json.parsePrefix(html, br, new int[1]);
            List<ImageItem> out = new ArrayList<ImageItem>();
            int rank = 0;
            for (Object o : Json.arr(arr)) {
                if (out.size() >= max) break;
                Map<String, Object> d = Json.obj(o);
                String full = firstNonEmpty(Json.str(d.get("img")), Json.str(d.get("link")),
                        Json.str(d.get("thumb")), Json.str(d.get("_thumb")));
                String thumb = firstNonEmpty(Json.str(d.get("_thumb")), Json.str(d.get("thumb")), full);
                if (full.isEmpty()) continue;
                out.add(item("so360", name(), Json.str(d.get("title")), thumb, full,
                        Json.str(d.get("link")), d.get("width"), d.get("height"), "", rank++, 0));
            }
            if (out.isEmpty()) throw new Exception("360 未返回结果");
            return out;
        }
    }

    /** 百度图片 acjson 接口（部分网络环境会触发反爬，失败时静默跳过）。 */
    static final class BaiduSource implements Source {
        public String key() { return "baidu"; }
        public String name() { return "百度图片"; }
        public String kind() { return "engine"; }
        public boolean needsKey() { return false; }
        public List<ImageItem> fetch(String q, int max, boolean safe, Map<String, String> keys) throws Exception {
            String url = "https://image.baidu.com/search/acjson?tn=resultjson_com&ipn=rj&ct=201326592"
                    + "&word=" + Net.encode(q) + "&pn=0&rn=" + Math.min(max, 60)
                    + "&lm=-1&ie=utf-8&oe=utf-8&st=-1&z=0";
            Map<String, String> h = new HashMap<String, String>();
            h.put("Referer", "https://image.baidu.com/search/index?tn=baiduimage&word=" + Net.encode(q));
            h.put("X-Requested-With", "XMLHttpRequest");
            h.put("Accept", "application/json, text/plain, */*");
            String body = Net.get(url, "https://image.baidu.com/", h, 9000, 4 * 1024 * 1024).text();
            if (body.indexOf("antiFlag") >= 0) throw new Exception("百度触发反爬（需浏览器环境）");
            Object root = Json.parse(body);
            List<ImageItem> out = new ArrayList<ImageItem>();
            int rank = 0;
            for (Object o : Json.arr(Json.get(root, "data"))) {
                if (out.size() >= max) break;
                Map<String, Object> d = Json.obj(o);
                String full = firstNonEmpty(Json.str(d.get("hoverURL")), Json.str(d.get("middleURL")),
                        Json.str(d.get("thumbURL")), Json.str(d.get("objURL")));
                if (full.isEmpty()) continue;
                out.add(item("baidu", name(),
                        firstNonEmpty(Json.str(d.get("fromPageTitleEnc")), Json.str(d.get("di"))),
                        Json.str(d.get("thumbURL")), full, Json.str(d.get("fromURL")),
                        d.get("width"), d.get("height"), "", rank++, 0));
            }
            if (out.isEmpty()) throw new Exception("百度未返回结果");
            return out;
        }
    }

    /** DuckDuckGo 图片（需先取 vqd，best-effort）。 */
    static final class DuckDuckGoSource implements Source {
        public String key() { return "duckduckgo"; }
        public String name() { return "DuckDuckGo"; }
        public String kind() { return "engine"; }
        public boolean needsKey() { return false; }
        public List<ImageItem> fetch(String q, int max, boolean safe, Map<String, String> keys) throws Exception {
            String home = Net.text("https://duckduckgo.com/?q=" + Net.encode(q) + "&iax=images&ia=images", null);
            Matcher m = Pattern.compile("vqd[=\":']+([\\d-]+)").matcher(home);
            String vqd = m.find() ? m.group(1) : "";
            if (vqd.isEmpty()) {
                Matcher m2 = Pattern.compile("vqd=([\\d-]+)").matcher(home);
                if (m2.find()) vqd = m2.group(1);
            }
            if (vqd.isEmpty()) throw new Exception("无法获取 DuckDuckGo vqd");
            String url = "https://duckduckgo.com/i.js?l=us-en&o=json&q=" + Net.encode(q)
                    + "&vqd=" + vqd + "&f=,,,&p=" + (safe ? "1" : "-1");
            Map<String, String> h = new HashMap<String, String>();
            h.put("Referer", "https://duckduckgo.com/");
            String body = Net.get(url, "https://duckduckgo.com/", h, 9000, 3 * 1024 * 1024).text();
            Object root = Json.parse(body);
            List<ImageItem> out = new ArrayList<ImageItem>();
            int rank = 0;
            for (Object o : Json.arr(Json.get(root, "results"))) {
                if (out.size() >= max) break;
                Map<String, Object> d = Json.obj(o);
                String full = Json.str(d.get("image"));
                if (full.isEmpty()) continue;
                out.add(item("duckduckgo", name(), Json.str(d.get("title")),
                        Json.str(d.get("thumbnail")), full, Json.str(d.get("url")),
                        d.get("width"), d.get("height"), "", rank++, 0));
            }
            if (out.isEmpty()) throw new Exception("DuckDuckGo 未返回结果");
            return out;
        }
    }

    /** Google 图片（HTML 抽取，best-effort，默认不开启）。 */
    static final class GoogleSource implements Source {
        public String key() { return "google"; }
        public String name() { return "Google 图片"; }
        public String kind() { return "engine"; }
        public boolean needsKey() { return false; }
        private static final Pattern OU = Pattern.compile("\"ou\":\"(https?[^\"\\\\]+)\"");
        private static final Pattern ARR = Pattern.compile("\\[\"(https?://[^\"\\\\]+?\\.(?:jpg|jpeg|png|webp)[^\"\\\\]*)\",(\\d+),(\\d+)\\]", Pattern.CASE_INSENSITIVE);
        public List<ImageItem> fetch(String q, int max, boolean safe, Map<String, String> keys) throws Exception {
            String url = "https://www.google.com/search?tbm=isch&q=" + Net.encode(q)
                    + "&safe=" + (safe ? "active" : "off");
            String html = Net.text(url, "https://www.google.com/");
            List<ImageItem> out = new ArrayList<ImageItem>();
            Set<String> seen = new HashSet<String>();
            Matcher m = OU.matcher(html);
            int rank = 0;
            while (m.find() && out.size() < max) {
                String u = Json.unescapeHtml(m.group(1)).replace("\\u003d", "=").replace("\\u0026", "&");
                if (!seen.add(u)) continue;
                out.add(item("google", name(), q + " 相关图片", u, u,
                        "https://www.google.com/search?tbm=isch&q=" + Net.encode(q), null, null, "", rank++, 0));
            }
            Matcher m2 = ARR.matcher(html);
            while (m2.find() && out.size() < max) {
                String u = m2.group(1).replace("\\/", "/");
                if (!seen.add(u)) continue;
                out.add(item("google", name(), q + " 相关图片", u, u,
                        "https://www.google.com/search?tbm=isch&q=" + Net.encode(q),
                        m2.group(2), m2.group(3), "", rank++, 0));
            }
            if (out.isEmpty()) throw new Exception("Google 需要浏览器环境或被限流");
            return out;
        }
    }

    /** Openverse：聚合 Flickr / Wikimedia 等 CC 授权图库，免密钥。 */
    static final class OpenverseSource implements Source {
        public String key() { return "openverse"; }
        public String name() { return "Openverse"; }
        public String kind() { return "library"; }
        public boolean needsKey() { return false; }
        public List<ImageItem> fetch(String q, int max, boolean safe, Map<String, String> keys) throws Exception {
            String url = "https://api.openverse.org/v1/images/?q=" + Net.encode(q)
                    + "&page_size=" + Math.min(max, 20) + "&mature=" + (safe ? "false" : "true");
            String body = Net.text(url, null);
            Object root = Json.parse(body);
            List<ImageItem> out = new ArrayList<ImageItem>();
            int rank = 0;
            for (Object o : Json.arr(Json.get(root, "results"))) {
                if (out.size() >= max) break;
                Map<String, Object> d = Json.obj(o);
                String full = firstNonEmpty(Json.str(d.get("url")), Json.str(d.get("thumbnail")));
                if (full.isEmpty()) continue;
                String lic = firstNonEmpty(Json.str(d.get("license")), "") + " "
                        + Json.str(d.get("license_version"));
                out.add(item("openverse", name(), Json.str(d.get("title")),
                        Json.str(d.get("thumbnail")), full, Json.str(d.get("foreign_landing_url")),
                        d.get("width"), d.get("height"), lic.trim(), rank++,
                        Json.lng(d.get("view_count"), 0)));
            }
            if (out.isEmpty()) throw new Exception("Openverse 未返回结果");
            return out;
        }
    }

    /** Wikimedia Commons 媒体库，免密钥。 */
    static final class WikimediaSource implements Source {
        public String key() { return "wikimedia"; }
        public String name() { return "Wikimedia Commons"; }
        public String kind() { return "library"; }
        public boolean needsKey() { return false; }
        public List<ImageItem> fetch(String q, int max, boolean safe, Map<String, String> keys) throws Exception {
            String url = "https://commons.wikimedia.org/w/api.php?action=query&format=json"
                    + "&generator=search&gsrsearch=" + Net.encode(q)
                    + "&gsrnamespace=6&gsrlimit=" + Math.min(max, 25)
                    + "&prop=imageinfo&iiprop=url|size&iiurlwidth=400";
            String body = Net.text(url, null);
            Object pages = Json.get(Json.parse(body), "query", "pages");
            List<ImageItem> out = new ArrayList<ImageItem>();
            int rank = 0;
            for (Object po : Json.obj(pages).values()) {
                if (out.size() >= max) break;
                Map<String, Object> p = Json.obj(po);
                Object ii = Json.get(p, "imageinfo");
                List<Object> iil = Json.arr(ii);
                if (iil.isEmpty()) continue;
                Map<String, Object> info = Json.obj(iil.get(0));
                String full = Json.str(info.get("url"));
                if (full.isEmpty()) continue;
                String title = Json.str(p.get("title")).replaceFirst("^File:", "");
                out.add(item("wikimedia", name(), title,
                        Json.str(info.get("thumburl")), full, Json.str(info.get("descriptionurl")),
                        info.get("width"), info.get("height"), "CC / 公有领域", rank++, 0));
            }
            if (out.isEmpty()) throw new Exception("Wikimedia 未返回结果");
            return out;
        }
    }

    /** Flickr 公共 feed，免密钥（tag 检索）。 */
    static final class FlickrSource implements Source {
        public String key() { return "flickr"; }
        public String name() { return "Flickr"; }
        public String kind() { return "library"; }
        public boolean needsKey() { return false; }
        public List<ImageItem> fetch(String q, int max, boolean safe, Map<String, String> keys) throws Exception {
            String tags = q.replaceAll("\\s+", ",");
            String url = "https://www.flickr.com/services/feeds/photos_public.gne?tags=" + Net.encode(tags)
                    + "&tagmode=all&format=json&nojsoncallback=1";
            String body = Net.text(url, null);
            Object root = Json.parse(body);
            List<ImageItem> out = new ArrayList<ImageItem>();
            int rank = 0;
            for (Object o : Json.arr(Json.get(root, "items"))) {
                if (out.size() >= max) break;
                Map<String, Object> d = Json.obj(o);
                String thumb = Json.str(Json.get(d, "media", "m"));
                if (thumb.isEmpty()) continue;
                String full = thumb.replaceAll("_m\\.(jpg|png)$", "_b.$1");
                out.add(item("flickr", name(), Json.str(d.get("title")), thumb, full,
                        Json.str(d.get("link")), null, null, "Flickr 公共 feed", rank++, 0));
            }
            if (out.isEmpty()) throw new Exception("Flickr 未返回结果");
            return out;
        }
    }

    /** NASA 图像库，免密钥（作为开放图库补充，默认关闭）。 */
    static final class NasaSource implements Source {
        public String key() { return "nasa"; }
        public String name() { return "NASA 图库"; }
        public String kind() { return "library"; }
        public boolean needsKey() { return false; }
        public List<ImageItem> fetch(String q, int max, boolean safe, Map<String, String> keys) throws Exception {
            String url = "https://images-api.nasa.gov/search?q=" + Net.encode(q)
                    + "&media_type=image&page_size=" + Math.min(max, 20);
            String body = Net.text(url, null);
            Object items = Json.get(Json.parse(body), "collection", "items");
            List<ImageItem> out = new ArrayList<ImageItem>();
            int rank = 0;
            for (Object o : Json.arr(items)) {
                if (out.size() >= max) break;
                Map<String, Object> d = Json.obj(o);
                List<Object> links = Json.arr(d.get("links"));
                if (links.isEmpty()) continue;
                String thumb = Json.str(Json.obj(links.get(0)).get("href"));
                if (thumb.isEmpty()) continue;
                String full = thumb.replace("~thumb", "~large").replace("~small", "~large");
                Object dataArr = Json.get(d, "data");
                String title = q + " 影像资料";
                if (!Json.arr(dataArr).isEmpty()) {
                    title = Json.str(Json.obj(Json.arr(dataArr).get(0)).get("title"));
                }
                out.add(item("nasa", name(), title, thumb, full, thumb, null, null,
                        "NASA 公有领域", rank++, 0));
            }
            if (out.isEmpty()) throw new Exception("NASA 图库未返回结果");
            return out;
        }
    }

    /** Pixabay（需 API Key，返回浏览量/下载/点赞，热度信号最完整）。 */
    static final class PixabaySource implements Source {
        public String key() { return "pixabay"; }
        public String name() { return "Pixabay"; }
        public String kind() { return "library"; }
        public boolean needsKey() { return true; }
        public List<ImageItem> fetch(String q, int max, boolean safe, Map<String, String> keys) throws Exception {
            String url = "https://pixabay.com/api/?key=" + Net.encode(keys.get("pixabay"))
                    + "&q=" + Net.encode(q) + "&image_type=all&per_page=" + Math.min(max, 40)
                    + "&safesearch=" + (safe ? "true" : "false") + "&pretty=false";
            String body = Net.text(url, null);
            Object root = Json.parse(body);
            if (Json.get(root, "error") != null) throw new Exception("Pixabay: " + Json.str(Json.get(root, "error")));
            List<ImageItem> out = new ArrayList<ImageItem>();
            int rank = 0;
            for (Object o : Json.arr(Json.get(root, "hits"))) {
                if (out.size() >= max) break;
                Map<String, Object> d = Json.obj(o);
                String full = firstNonEmpty(Json.str(d.get("largeImageURL")), Json.str(d.get("webFormatURL")));
                if (full.isEmpty()) continue;
                long pop = Json.lng(d.get("views"), 0) + Json.lng(d.get("downloads"), 0) * 3L
                        + Json.lng(d.get("likes"), 0) * 5L;
                out.add(item("pixabay", name(), Json.str(d.get("tags")),
                        Json.str(d.get("previewURL")), full, Json.str(d.get("pageURL")),
                        d.get("imageWidth"), d.get("imageHeight"), "Pixabay License", rank++, pop));
            }
            if (out.isEmpty()) throw new Exception("Pixabay 未返回结果");
            return out;
        }
    }

    /** Pexels（需 API Key）。 */
    static final class PexelsSource implements Source {
        public String key() { return "pexels"; }
        public String name() { return "Pexels"; }
        public String kind() { return "library"; }
        public boolean needsKey() { return true; }
        public List<ImageItem> fetch(String q, int max, boolean safe, Map<String, String> keys) throws Exception {
            String url = "https://api.pexels.com/v1/search?query=" + Net.encode(q)
                    + "&per_page=" + Math.min(max, 40) + "&locale=zh-CN";
            Map<String, String> h = new HashMap<String, String>();
            h.put("Authorization", String.valueOf(keys.get("pexels")));
            h.put("Accept", "application/json");
            String body = Net.get(url, null, h, 9000, 3 * 1024 * 1024).text();
            Object root = Json.parse(body);
            List<ImageItem> out = new ArrayList<ImageItem>();
            int rank = 0;
            for (Object o : Json.arr(Json.get(root, "photos"))) {
                if (out.size() >= max) break;
                Map<String, Object> d = Json.obj(o);
                Map<String, Object> src = Json.obj(d.get("src"));
                String full = firstNonEmpty(Json.str(src.get("original")), Json.str(src.get("large2x")),
                        Json.str(src.get("large")));
                if (full.isEmpty()) continue;
                out.add(item("pexels", name(), Json.str(d.get("alt")),
                        Json.str(src.get("medium")), full, Json.str(d.get("url")),
                        d.get("width"), d.get("height"), "Pexels License", rank++, 0));
            }
            if (out.isEmpty()) throw new Exception("Pexels 未返回结果");
            return out;
        }
    }

    /** Unsplash（需 Access Key）。 */
    static final class UnsplashSource implements Source {
        public String key() { return "unsplash"; }
        public String name() { return "Unsplash"; }
        public String kind() { return "library"; }
        public boolean needsKey() { return true; }
        public List<ImageItem> fetch(String q, int max, boolean safe, Map<String, String> keys) throws Exception {
            String url = "https://api.unsplash.com/search/photos?query=" + Net.encode(q)
                    + "&per_page=" + Math.min(max, 30);
            Map<String, String> h = new HashMap<String, String>();
            h.put("Authorization", "Client-ID " + keys.get("unsplash"));
            h.put("Accept", "application/json");
            String body = Net.get(url, null, h, 9000, 3 * 1024 * 1024).text();
            Object root = Json.parse(body);
            List<ImageItem> out = new ArrayList<ImageItem>();
            int rank = 0;
            for (Object o : Json.arr(Json.get(root, "results"))) {
                if (out.size() >= max) break;
                Map<String, Object> d = Json.obj(o);
                Map<String, Object> urls = Json.obj(d.get("urls"));
                String full = firstNonEmpty(Json.str(urls.get("regular")), Json.str(urls.get("full")));
                if (full.isEmpty()) continue;
                String title = firstNonEmpty(Json.str(d.get("alt_description")), Json.str(d.get("description")));
                out.add(item("unsplash", name(), title, Json.str(urls.get("thumb")), full,
                        Json.str(Json.get(d, "links", "html")), d.get("width"), d.get("height"),
                        "Unsplash License", rank++, Json.lng(d.get("likes"), 0) * 20L));
            }
            if (out.isEmpty()) throw new Exception("Unsplash 未返回结果");
            return out;
        }
    }
}
