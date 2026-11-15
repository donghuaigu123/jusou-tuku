package com.donghuaigu.jusou;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.Map;
import java.util.zip.GZIPInputStream;

/** 轻量 HTTP 客户端。纯 Java，使用 HttpURLConnection，无第三方依赖。 */
public final class Net {
    private Net() {}

    public static final String UA =
            "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) "
            + "Chrome/120.0.0.0 Mobile Safari/537.36";

    public static String encode(String s) {
        try { return URLEncoder.encode(s == null ? "" : s, "UTF-8"); }
        catch (Exception e) { return s == null ? "" : s; }
    }

    public static final class Response {
        public int code;
        public byte[] body;
        public String contentType;
        public String finalUrl;
        public String text() { return body == null ? "" : new String(body, java.nio.charset.StandardCharsets.UTF_8); }
    }

    /** GET 文本，默认 10 秒超时，最多 4MB。 */
    public static String text(String url, String referer) throws IOException {
        return get(url, referer, null, 10000, 4 * 1024 * 1024).text();
    }

    public static Response get(String url, String referer, Map<String, String> headers,
                               int timeoutMs, int maxBytes) throws IOException {
        return request(url, referer, headers, timeoutMs, maxBytes, null, 0);
    }

    /** 支持 POST body（本地 API 与需要 POST 的搜索源使用）。 */
    public static Response post(String url, String referer, Map<String, String> headers,
                                byte[] body, int timeoutMs, int maxBytes) throws IOException {
        return request(url, referer, headers, timeoutMs, maxBytes, body, 0);
    }

    private static Response request(String url, String referer, Map<String, String> headers,
                                    int timeoutMs, int maxBytes, byte[] postBody, int redirects) throws IOException {
        if (redirects > 5) throw new IOException("重定向次数过多");
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        try {
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(timeoutMs);
            c.setReadTimeout(timeoutMs);
            c.setRequestMethod(postBody == null ? "GET" : "POST");
            c.setRequestProperty("User-Agent", UA);
            c.setRequestProperty("Accept", "text/html,application/json,application/xhtml+xml,image/avif,image/webp,*/*;q=0.8");
            c.setRequestProperty("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8");
            c.setRequestProperty("Accept-Encoding", "gzip");
            c.setRequestProperty("Connection", "close");
            if (referer != null && !referer.isEmpty()) c.setRequestProperty("Referer", referer);
            if (headers != null) {
                for (Map.Entry<String, String> e : headers.entrySet()) {
                    if (e.getValue() != null) c.setRequestProperty(e.getKey(), e.getValue());
                }
            }
            if (postBody != null) {
                c.setDoOutput(true);
                c.setFixedLengthStreamingMode(postBody.length);
                OutputStream os = c.getOutputStream();
                os.write(postBody);
                os.close();
            }
            int code = c.getResponseCode();
            if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                String loc = c.getHeaderField("Location");
                c.disconnect();
                if (loc == null || loc.isEmpty()) throw new IOException("重定向缺少 Location");
                if (loc.startsWith("//")) loc = "https:" + loc;
                else if (loc.startsWith("/")) {
                    try {
                        URL u = new URL(url);
                        loc = u.getProtocol() + "://" + u.getHost() + (u.getPort() > 0 ? ":" + u.getPort() : "") + loc;
                    } catch (Exception ignored) {}
                } else if (!loc.startsWith("http")) {
                    loc = url.substring(0, url.lastIndexOf('/') + 1) + loc;
                }
                return request(loc, referer, headers, timeoutMs, maxBytes, postBody, redirects + 1);
            }
            Response r = new Response();
            r.code = code;
            r.contentType = c.getContentType();
            r.finalUrl = url;
            InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
            if (in == null) { r.body = new byte[0]; return r; }
            if ("gzip".equalsIgnoreCase(c.getContentEncoding())) in = new GZIPInputStream(in);
            r.body = readAll(in, maxBytes);
            return r;
        } finally {
            c.disconnect();
        }
    }

    public static byte[] readAll(InputStream in, int maxBytes) throws IOException {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n, total = 0;
        try {
            while ((n = in.read(buf)) != -1) {
                total += n;
                if (total > maxBytes) throw new IOException("响应超过大小上限 " + maxBytes);
                bos.write(buf, 0, n);
            }
        } finally { try { in.close(); } catch (Exception ignored) {} }
        return bos.toByteArray();
    }

    /** 从 HTML/JSON 文本中安全地取一个字段，忽略异常。 */
    public static String safeText(String url, String referer, Map<String, String> headers, int timeout) {
        try { return get(url, referer, headers, timeout, 4 * 1024 * 1024).text(); }
        catch (Exception e) { return ""; }
    }
}
