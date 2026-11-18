package com.donghuaigu.jusou;

import android.content.Context;
import android.content.res.AssetManager;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 应用内本地 HTTP 服务（仅监听 127.0.0.1 回环地址）。
 *
 * 为什么用本地服务而不是直接 file:// + JavascriptInterface：
 *  - 页面与 API 完全同源，没有 CORS / Mixed Content 问题；
 *  - 所有第三方图片经 /api/img 代理转发，可统一加 UA / Referer 绕开防盗链，并做磁盘缓存；
 *  - 前端用标准 fetch 即可，逻辑与浏览器里调试时完全一致。
 *
 * 安全：校验 Host 必须是 127.0.0.1 / localhost，端口随机，不对外暴露。
 */
public final class LocalServer {
    private final Context ctx;
    private final Settings settings;
    private final DownloadManager downloads;
    private final AssetManager assets;
    private final File cacheDir;
    private final ExecutorService pool = Executors.newFixedThreadPool(12);
    private ServerSocket server;
    private Thread acceptThread;
    private volatile boolean running = false;
    private int port = -1;
    /** 从相册选中的图片暂存于此，通过 /api/picked/* 提供给前端，避免 JS 桥传输大 base64。 */
    private volatile byte[] pickedBytes;
    private volatile String pickedMime = "image/jpeg";

    public LocalServer(Context c, DownloadManager dm) {
        ctx = c;
        downloads = dm;
        settings = new Settings(c);
        assets = c.getAssets();
        cacheDir = new File(c.getCacheDir(), "imgcache");
        if (!cacheDir.exists()) cacheDir.mkdirs();
    }

    public int start() throws Exception {
        server = new ServerSocket(0, 64, InetAddress.getByName("127.0.0.1"));
        port = server.getLocalPort();
        running = true;
        acceptThread = new Thread(new Runnable() {
            public void run() {
                while (running) {
                    try {
                        Socket s = server.accept();
                        s.setSoTimeout(25000);
                        pool.execute(new Connection(s));
                    } catch (Exception e) {
                        if (running) continue;
                        break;
                    }
                }
            }
        }, "jusou-http");
        acceptThread.setDaemon(true);
        acceptThread.start();
        return port;
    }

    public int port() { return port; }

    /** 暂存用户从相册选中的图片，返回一个同源 URL 供前端读取。 */
    public String putPicked(byte[] data, String mime) {
        pickedBytes = data;
        pickedMime = (mime == null || mime.isEmpty()) ? "image/jpeg" : mime;
        return "/api/picked/" + System.currentTimeMillis() + ".jpg";
    }

    public void stop() {
        running = false;
        try { if (server != null) server.close(); } catch (Exception ignored) {}
        pool.shutdownNow();
    }

    // ---------------------------------------------------------------- 请求处理

    private final class Connection implements Runnable {
        private final Socket sock;
        Connection(Socket s) { sock = s; }

        public void run() {
            InputStream in = null;
            OutputStream out = null;
            try {
                in = new java.io.BufferedInputStream(sock.getInputStream(), 8192);
                out = new java.io.BufferedOutputStream(sock.getOutputStream(), 8192);
                String line = readLine(in);
                if (line == null || line.isEmpty()) return;
                String[] parts = line.split(" ");
                if (parts.length < 2) return;
                String method = parts[0].toUpperCase();
                String rawPath = parts[1];

                Map<String, String> headers = new HashMap<String, String>();
                String h;
                int contentLength = 0;
                while ((h = readLine(in)) != null && !h.isEmpty()) {
                    int c = h.indexOf(':');
                    if (c > 0) {
                        String k = h.substring(0, c).trim().toLowerCase();
                        String v = h.substring(c + 1).trim();
                        headers.put(k, v);
                        if (k.equals("content-length")) {
                            try { contentLength = Integer.parseInt(v); } catch (Exception ignored) {}
                        }
                    }
                }
                String host = headers.get("host");
                if (host != null && !host.startsWith("127.0.0.1") && !host.startsWith("localhost")) {
                    respond(out, 403, "application/json; charset=utf-8",
                            Json.stringify(err("禁止的来源")).getBytes("UTF-8"), null);
                    return;
                }

                byte[] body = new byte[0];
                if (contentLength > 0 && contentLength <= 24 * 1024 * 1024) {
                    body = readExactly(in, contentLength);
                }

                int qm = rawPath.indexOf('?');
                String path = qm >= 0 ? rawPath.substring(0, qm) : rawPath;
                Map<String, String> query = parseQuery(qm >= 0 ? rawPath.substring(qm + 1) : "");
                route(method, path, query, body, out);
            } catch (Exception e) {
                // 连接异常时静默关闭，避免影响其它图片请求
            } finally {
                if (out != null) try { out.flush(); } catch (Exception ignored) {}
                try { sock.close(); } catch (Exception ignored) {}
            }
        }

        private void route(String method, String path, Map<String, String> q,
                           byte[] body, OutputStream out) throws Exception {
            if (path.equals("/") || path.equals("/index.html")) {
                asset(out, "index.html"); return;
            }
            if (path.startsWith("/assets/") || path.endsWith(".css") || path.endsWith(".js")
                    || path.endsWith(".svg") || path.endsWith(".png") || path.endsWith(".ico")) {
                String name = path.startsWith("/assets/") ? path.substring(8) : path.substring(1);
                if (name.indexOf("..") < 0) { asset(out, name); return; }
            }
            if (path.startsWith("/api/picked/")) {
                if (pickedBytes == null) {
                    respond(out, 404, "text/plain", "no picked image".getBytes(), null);
                } else {
                    respond(out, 200, pickedMime, pickedBytes, "no-store");
                }
                return;
            }
            if (path.equals("/api/app")) {
                Map<String, Object> m = ok();
                m.put("name", "聚搜图库");
                m.put("version", "4.0.0");
                m.put("port", port);
                m.put("maxResults", SearchEngine.MAX_RESULTS);
                json(out, 200, m); return;
            }
            if (path.equals("/api/sources")) { json(out, 200, SearchEngine.sourcesInfo()); return; }
            if (path.equals("/api/settings")) {
                if ("POST".equals(method)) {
                    settings.apply(Json.obj(Json.parse(new String(body, "UTF-8"))));
                    json(out, 200, ok());
                } else {
                    Map<String, Object> m = ok();
                    m.putAll(settings.toMap());
                    json(out, 200, m);
                }
                return;
            }
            if (path.equals("/api/search")) {
                String query = q.containsKey("q") ? q.get("q") : "";
                SearchEngine.Result r = SearchEngine.search(query,
                        settings.enabledSources(), settings.limit(), settings.safe(), settings.apiKeys());
                json(out, 200, r.toMap());
                return;
            }
            if (path.equals("/api/img")) {
                proxyImage(out, q.get("u"), q.get("ref")); return;
            }
            if (path.equals("/api/download")) {
                String name = q.containsKey("name") ? q.get("name") : "";
                String saved = downloads.saveFromUrl(q.get("u"), name, q.get("ref"));
                Map<String, Object> m = ok();
                m.put("path", saved);
                json(out, 200, m);
                return;
            }
            if (path.equals("/api/save-image") && "POST".equals(method)) {
                Map<String, Object> m = Json.obj(Json.parse(new String(body, "UTF-8")));
                String saved = downloads.saveBase64(Json.str(m.get("image")),
                        Json.str(m.get("name")), Json.str(m.get("mime")));
                Map<String, Object> r = ok();
                r.put("path", saved);
                json(out, 200, r);
                return;
            }
            if (path.equals("/api/lineartgen") && "POST".equals(method)) {
                Map<String, Object> m = Json.obj(Json.parse(new String(body, "UTF-8")));
                try {
                    Map<String, Object> r = ok();
                    r.putAll(LineArtGenBridge.process(
                            Json.str(m.get("image")),
                            Json.integer(m.get("mode"), 1),
                            Json.integer(m.get("detail"), 55),
                            Json.integer(m.get("thickness"), 1),
                            Json.integer(m.get("ink"), 50),
                            Json.integer(m.get("clean"), 50),
                            Boolean.TRUE.equals(m.get("invert")),
                            Boolean.TRUE.equals(m.get("darkBgSuppression")),
                            Json.obj(m.get("crop"))));
                    json(out, 200, r);
                } catch (Exception e) {
                    json(out, 200, err(e.getMessage() == null ? "线稿生成失败" : e.getMessage()));
                }
                return;
            }
            if (path.equals("/api/clear-cache") && "POST".equals(method)) {
                File[] fs = cacheDir.listFiles();
                int n = fs == null ? 0 : fs.length;
                if (fs != null) for (File f : fs) f.delete();
                Map<String, Object> r = ok();
                r.put("cleared", n);
                json(out, 200, r);
                return;
            }
            respond(out, 404, "application/json; charset=utf-8",
                    Json.stringify(err("接口不存在: " + path)).getBytes("UTF-8"), null);
        }
    }

    // ---------------------------------------------------------------- 图片代理

    private void proxyImage(OutputStream out, String url, String ref) {
        if (url == null || (!url.startsWith("https://") && !url.startsWith("http://"))) {
            respond(out, 400, "text/plain", "bad url".getBytes(), null); return;
        }
        String key = md5(url);
        File bin = new File(cacheDir, key + ".bin");
        File type = new File(cacheDir, key + ".type");
        String mime = null;
        if (bin.exists() && bin.length() > 0) {
            try {
                mime = readSmallFile(type);
                respond(out, 200, mime == null ? "image/jpeg" : mime, readFile(bin), "public, max-age=86400");
                return;
            } catch (Exception ignored) {}
        }
        try {
            Map<String, String> h = new HashMap<String, String>();
            h.put("Accept", "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8");
            String referer = (ref != null && !ref.isEmpty()) ? ref : refererOf(url);
            Net.Response r = Net.get(url, referer, h, 15000, 12 * 1024 * 1024);
            if (r.code >= 400 || r.body == null || r.body.length == 0) {
                respond(out, 502, "text/plain", ("upstream " + r.code).getBytes(), null);
                return;
            }
            mime = r.contentType == null ? null : r.contentType.split(";")[0].trim();
            if (mime == null || !mime.startsWith("image/")) mime = guessImageMime(url);
            try {
                writeFile(bin, r.body);
                writeFile(type, mime.getBytes("UTF-8"));
            } catch (Exception ignored) {}
            respond(out, 200, mime, r.body, "public, max-age=86400");
        } catch (Exception e) {
            respond(out, 502, "text/plain", ("proxy error: " + e.getMessage()).getBytes(), null);
        }
    }

    private static String refererOf(String url) {
        try {
            java.net.URL u = new java.net.URL(url);
            return u.getProtocol() + "://" + u.getHost() + "/";
        } catch (Exception e) { return null; }
    }

    private static String guessImageMime(String url) {
        String l = url.toLowerCase().split("\\?")[0];
        if (l.endsWith(".png")) return "image/png";
        if (l.endsWith(".webp")) return "image/webp";
        if (l.endsWith(".gif")) return "image/gif";
        if (l.endsWith(".svg")) return "image/svg+xml";
        return "image/jpeg";
    }

    // ---------------------------------------------------------------- HTTP 基础

    private void asset(OutputStream out, String name) throws Exception {
        String mime;
        if (name.endsWith(".html")) mime = "text/html; charset=utf-8";
        else if (name.endsWith(".css")) mime = "text/css; charset=utf-8";
        else if (name.endsWith(".js")) mime = "application/javascript; charset=utf-8";
        else if (name.endsWith(".svg")) mime = "image/svg+xml";
        else if (name.endsWith(".png")) mime = "image/png";
        else mime = "application/octet-stream";
        InputStream in = null;
        try {
            in = assets.open(name);
            respond(out, 200, mime, Net.readAll(in, 8 * 1024 * 1024), null);
        } catch (Exception e) {
            respond(out, 404, "text/plain; charset=utf-8", "not found".getBytes("UTF-8"), null);
        } finally { if (in != null) try { in.close(); } catch (Exception ignored) {} }
    }

    private void json(OutputStream out, int code, Map<String, Object> m) throws Exception {
        respond(out, code, "application/json; charset=utf-8",
                Json.stringify(m).getBytes("UTF-8"), "no-store");
    }

    private void respond(OutputStream out, int code, String mime, byte[] data, String cache) {
        try {
            String reason = code == 200 ? "OK" : code == 400 ? "Bad Request" : code == 403 ? "Forbidden"
                    : code == 404 ? "Not Found" : code == 502 ? "Bad Gateway" : "Error";
            StringBuilder head = new StringBuilder(256);
            head.append("HTTP/1.1 ").append(code).append(' ').append(reason).append("\r\n");
            head.append("Content-Type: ").append(mime).append("\r\n");
            head.append("Content-Length: ").append(data.length).append("\r\n");
            head.append("Connection: close\r\n");
            head.append("X-Content-Type-Options: nosniff\r\n");
            if (cache != null) head.append("Cache-Control: ").append(cache).append("\r\n");
            head.append("\r\n");
            out.write(head.toString().getBytes("UTF-8"));
            out.write(data);
            out.flush();
        } catch (Exception ignored) {}
    }

    private static Map<String, Object> ok() {
        Map<String, Object> m = new LinkedHashMap<String, Object>();
        m.put("ok", true);
        return m;
    }

    private static Map<String, Object> err(String msg) {
        Map<String, Object> m = new LinkedHashMap<String, Object>();
        m.put("ok", false);
        m.put("error", msg);
        return m;
    }

    private static String readLine(InputStream in) throws Exception {
        ByteArrayOutputStream bos = new ByteArrayOutputStream(128);
        int c;
        while ((c = in.read()) != -1) {
            if (c == '\n') break;
            if (c != '\r') bos.write(c);
            if (bos.size() > 8192) break;
        }
        if (c == -1 && bos.size() == 0) return null;
        return new String(bos.toByteArray(), "ISO-8859-1");
    }

    private static byte[] readExactly(InputStream in, int n) throws Exception {
        byte[] b = new byte[n];
        int off = 0;
        while (off < n) {
            int r = in.read(b, off, n - off);
            if (r < 0) break;
            off += r;
        }
        return off == n ? b : Arrays.copyOf(b, off);
    }

    private static Map<String, String> parseQuery(String s) {
        Map<String, String> m = new HashMap<String, String>();
        for (String kv : s.split("&")) {
            if (kv.isEmpty()) continue;
            int e = kv.indexOf('=');
            String k = e < 0 ? kv : kv.substring(0, e);
            String v = e < 0 ? "" : kv.substring(e + 1);
            try {
                m.put(URLDecoder.decode(k, "UTF-8"), URLDecoder.decode(v, "UTF-8"));
            } catch (Exception ignored) {}
        }
        return m;
    }

    private static void writeFile(File f, byte[] data) throws Exception {
        FileOutputStream os = new FileOutputStream(f);
        try { os.write(data); os.flush(); } finally { os.close(); }
    }

    private static byte[] readFile(File f) throws Exception {
        FileInputStream in = new FileInputStream(f);
        try { return Net.readAll(in, 16 * 1024 * 1024); }
        finally { in.close(); }
    }

    private static String readSmallFile(File f) throws Exception {
        byte[] b = readFile(f);
        return new String(b, "UTF-8").trim();
    }

    private static String md5(String s) {
        try {
            byte[] b = MessageDigest.getInstance("MD5").digest(s.getBytes("UTF-8"));
            StringBuilder sb = new StringBuilder();
            for (byte x : b) sb.append(String.format("%02x", x & 0xff));
            return sb.toString();
        } catch (Exception e) { return Integer.toHexString(s.hashCode()); }
    }
}
