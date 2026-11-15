package com.donghuaigu.jusou;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** 应用设置（下载目录、图片源开关、API Key、排序偏好）。 */
public final class Settings {
    private static final String PREF = "jusou_settings";

    public static final String KEY_TREE = "download_tree_uri";
    public static final String KEY_SUBDIR = "download_subdir";
    public static final String KEY_LIMIT = "limit";
    public static final String KEY_SAFE = "safe";
    public static final String KEY_SORT = "sort";
    public static final String KEY_SOURCES = "sources";
    public static final String[] KEY_FIELDS = { "pixabay", "pexels", "unsplash" };

    private final SharedPreferences p;

    public Settings(Context c) { p = c.getSharedPreferences(PREF, Context.MODE_PRIVATE); }

    public String get(String k, String def) { return p.getString(k, def); }
    public void set(String k, String v) { p.edit().putString(k, v).apply(); }
    public void remove(String k) { p.edit().remove(k).apply(); }

    public int limit() {
        int v = SearchEngine.MAX_RESULTS;
        try { v = Integer.parseInt(p.getString(KEY_LIMIT, "300")); } catch (Exception ignored) {}
        return Math.max(1, Math.min(SearchEngine.MAX_RESULTS, v));
    }

    public boolean safe() { return p.getBoolean(KEY_SAFE, true); }
    public String sort() { return p.getString(KEY_SORT, "score"); }
    public String subdir() { return p.getString(KEY_SUBDIR, "聚搜图库"); }
    public String tree() { return p.getString(KEY_TREE, ""); }
    public boolean hasCustomDir() { return !tree().isEmpty(); }

    public Set<String> enabledSources() {
        String raw = p.getString(KEY_SOURCES, "");
        if (raw.isEmpty()) return new HashSet<String>(SearchEngine.DEFAULT_ENABLED);
        Set<String> s = new HashSet<String>();
        for (String x : raw.split(",")) if (!x.trim().isEmpty()) s.add(x.trim());
        return s;
    }

    public Map<String, String> apiKeys() {
        Map<String, String> m = new LinkedHashMap<String, String>();
        for (String k : KEY_FIELDS) m.put(k, p.getString("key_" + k, ""));
        return m;
    }

    public String dirLabel() {
        if (hasCustomDir()) {
            String t = tree();
            String decoded = java.net.URLDecoder.decode(t).replaceAll("\\s+", " ");
            int i = decoded.lastIndexOf('/');
            String leaf = i >= 0 && i < decoded.length() - 1 ? decoded.substring(i + 1) : decoded;
            leaf = leaf.replaceAll("tree:", "").replaceAll("%3A", ":").replaceAll("%2F", "/");
            return "自定义目录：" + clip(leaf);
        }
        return "系统下载 / " + (subdir().isEmpty() ? "根目录" : subdir());
    }

    private static String clip(String s) { return s.length() > 42 ? s.substring(0, 42) + "…" : s; }

    /** 输出给前端（不泄露 API Key 明文，只回传是否已配置）。 */
    public Map<String, Object> toMap() {
        Map<String, Object> m = new LinkedHashMap<String, Object>();
        m.put("dirLabel", dirLabel());
        m.put("hasCustomDir", hasCustomDir());
        m.put("subdir", subdir());
        m.put("limit", limit());
        m.put("safe", safe());
        m.put("sort", sort());
        List<Object> src = new ArrayList<Object>();
        for (String s : enabledSources()) src.add(s);
        m.put("sources", src);
        Map<String, Object> keys = new LinkedHashMap<String, Object>();
        for (String k : KEY_FIELDS) keys.put(k, !get("key_" + k, "").isEmpty());
        m.put("keys", keys);
        m.put("maxResults", SearchEngine.MAX_RESULTS);
        return m;
    }

    /** 应用前端 POST 的设置。keys 里空字符串表示不改动，"__CLEAR__" 表示清除。 */
    public void apply(Map<String, Object> m) {
        SharedPreferences.Editor e = p.edit();
        if (m.containsKey("limit")) {
            try {
                int v = Json.integer(m.get("limit"), SearchEngine.MAX_RESULTS);
                e.putString(KEY_LIMIT, String.valueOf(Math.max(1, Math.min(SearchEngine.MAX_RESULTS, v))));
            } catch (Exception ignored) {}
        }
        if (m.containsKey("safe")) e.putBoolean(KEY_SAFE, Boolean.TRUE.equals(m.get("safe")));
        if (m.containsKey("sort")) e.putString(KEY_SORT, Json.str(m.get("sort")));
        if (m.containsKey("subdir")) e.putString(KEY_SUBDIR, cleanDir(Json.str(m.get("subdir"))));
        if (m.containsKey("sources")) {
            StringBuilder sb = new StringBuilder();
            for (Object o : Json.arr(m.get("sources"))) {
                if (sb.length() > 0) sb.append(',');
                sb.append(Json.str(o));
            }
            e.putString(KEY_SOURCES, sb.toString());
        }
        Object keysObj = m.get("keys");
        if (keysObj != null) {
            Map<String, Object> keys = Json.obj(keysObj);
            for (String k : Arrays.asList(KEY_FIELDS)) {
                if (!keys.containsKey(k)) continue;
                String v = Json.str(keys.get(k));
                if ("__CLEAR__".equals(v)) e.remove("key_" + k);
                else if (!v.isEmpty()) e.putString("key_" + k, v.trim());
            }
        }
        e.apply();
    }

    private static String cleanDir(String s) {
        return s.replaceAll("[/\\\\:*?\"<>|]", "").trim();
    }
}
