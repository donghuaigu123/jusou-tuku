package com.donghuaigu.jusou;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
import android.util.Base64;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * 下载管理：支持「自定义下载目录」。
 *
 *  - 用户通过系统文件选择器（ACTION_OPEN_DOCUMENT_TREE）选定任意目录后，
 *    应用取得持久化 URI 授权，后续所有图片直接写入该目录（Android 10+ 分区存储同样适用）。
 *  - 未选择目录时写入系统「下载 / 聚搜图库」，Android 10+ 用 MediaStore，
 *    Android 9 及以下直接写公共下载目录。
 *  - 同时支持把线稿 PNG（base64）写入同一目录。
 */
public final class DownloadManager {
    private final Context ctx;
    private final ContentResolver resolver;
    private final Settings settings;

    public DownloadManager(Context c) {
        ctx = c;
        resolver = c.getContentResolver();
        settings = new Settings(c);
    }

    public String dirLabel() { return settings.dirLabel(); }

    /** 保存用户选择的目录，并申请持久化权限。 */
    public void setCustomDir(Uri tree, int flags) {
        try {
            int take = (flags & android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    | (flags & android.content.Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            resolver.takePersistableUriPermission(tree, take);
        } catch (Exception ignored) {}
        settings.set(Settings.KEY_TREE, tree.toString());
    }

    public void clearCustomDir() { settings.remove(Settings.KEY_TREE); }

    /** 从网络下载一张图片并保存，返回可读的保存位置描述。 */
    public String saveFromUrl(String url, String fileName, String referer) throws Exception {
        Map<String, String> h = new HashMap<String, String>();
        h.put("Accept", "image/avif,image/webp,image/apng,image/*,*/*;q=0.8");
        Net.Response r = Net.get(url, referer == null || referer.isEmpty() ? refererOf(url) : referer,
                h, 20000, 30 * 1024 * 1024);
        if (r.code >= 400 || r.body == null || r.body.length == 0) {
            throw new Exception("图片下载失败 HTTP " + r.code + "（站点可能有防盗链）");
        }
        String mime = mimeOf(url, r.contentType);
        String name = safeName(fileName, mime);
        return write(name, mime, r.body);
    }

    /** 保存 base64 data URL（线稿 PNG 等）。 */
    public String saveBase64(String dataUrl, String fileName, String mime) throws Exception {
        int comma = dataUrl == null ? -1 : dataUrl.indexOf(',');
        if (comma < 0) throw new Exception("无效的图片数据");
        byte[] data;
        try { data = Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT); }
        catch (Exception e) { throw new Exception("图片数据解码失败"); }
        if (data.length == 0) throw new Exception("图片数据为空");
        if (mime == null || mime.isEmpty()) mime = "image/png";
        return write(safeName(fileName, mime), mime, data);
    }

    // ------------------------------------------------------------ 内部实现

    private String write(String name, String mime, byte[] data) throws Exception {
        String tree = settings.tree();
        if (!tree.isEmpty()) {
            try { return writeToSaf(Uri.parse(tree), name, mime, data); }
            catch (Exception e) {
                // 目录权限可能被系统回收，回退到默认目录，保证下载不失败
                clearCustomDir();
            }
        }
        return writeToDefault(name, mime, data);
    }

    private String writeToSaf(Uri tree, String name, String mime, byte[] data) throws Exception {
        Uri parent = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
        String sub = settings.subdir();
        String rel = "";
        if (!sub.isEmpty()) {
            parent = findOrCreateDir(tree, parent, sub);
            rel = sub + "/";
        }
        Uri file = DocumentsContract.createDocument(resolver, parent, mime, name);
        if (file == null) throw new Exception("无法在所选目录创建文件");
        OutputStream os = resolver.openOutputStream(file, "w");
        if (os == null) throw new Exception("无法写入所选目录");
        try { os.write(data); os.flush(); } finally { try { os.close(); } catch (Exception ignored) {} }
        return "自定义目录/" + rel + name;
    }

    private Uri findOrCreateDir(Uri tree, Uri parent, String name) throws Exception {
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(
                tree, DocumentsContract.getDocumentId(parent));
        Cursor c = null;
        try {
            c = resolver.query(children,
                    new String[]{ DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                            DocumentsContract.Document.COLUMN_MIME_TYPE },
                    null, null, null);
            if (c != null) {
                while (c.moveToNext()) {
                    String n = c.getString(1);
                    String mt = c.getString(2);
                    if (name.equals(n) && DocumentsContract.Document.MIME_TYPE_DIR.equals(mt)) {
                        return DocumentsContract.buildDocumentUriUsingTree(tree, c.getString(0));
                    }
                }
            }
        } finally { if (c != null) try { c.close(); } catch (Exception ignored) {} }
        Uri created = DocumentsContract.createDocument(resolver, parent,
                DocumentsContract.Document.MIME_TYPE_DIR, name);
        if (created == null) throw new Exception("无法创建子目录 " + name);
        return created;
    }

    private String writeToDefault(String name, String mime, byte[] data) throws Exception {
        String sub = settings.subdir();
        if (sub.isEmpty()) sub = "聚搜图库";
        if (Build.VERSION.SDK_INT >= 29) {
            ContentValues cv = new ContentValues();
            cv.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            cv.put(MediaStore.MediaColumns.MIME_TYPE, mime);
            cv.put(MediaStore.MediaColumns.RELATIVE_PATH,
                    Environment.DIRECTORY_DOWNLOADS + "/" + sub);
            cv.put(MediaStore.MediaColumns.IS_PENDING, 1);
            Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
            if (uri == null) throw new Exception("MediaStore 创建失败");
            OutputStream os = resolver.openOutputStream(uri);
            if (os == null) throw new Exception("MediaStore 写入失败");
            try { os.write(data); os.flush(); } finally { try { os.close(); } catch (Exception ignored) {} }
            cv.clear();
            cv.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(uri, cv, null, null);
            return "下载/" + sub + "/" + name;
        }
        File dir = new File(Environment.getExternalStoragePublicDirectory(
                Environment.DIRECTORY_DOWNLOADS), sub);
        if (!dir.exists() && !dir.mkdirs()) throw new Exception("无法创建下载目录");
        File f = new File(dir, name);
        FileOutputStream os = new FileOutputStream(f);
        try { os.write(data); os.flush(); } finally { try { os.close(); } catch (Exception ignored) {} }
        return f.getAbsolutePath();
    }

    private static String refererOf(String url) {
        try {
            java.net.URL u = new java.net.URL(url);
            return u.getProtocol() + "://" + u.getHost() + "/";
        } catch (Exception e) { return null; }
    }

    private static String mimeOf(String url, String contentType) {
        if (contentType != null && contentType.startsWith("image/")) {
            return contentType.split(";")[0].trim();
        }
        String l = url.toLowerCase(java.util.Locale.US).split("\\?")[0];
        if (l.endsWith(".png")) return "image/png";
        if (l.endsWith(".webp")) return "image/webp";
        if (l.endsWith(".gif")) return "image/gif";
        if (l.endsWith(".bmp")) return "image/bmp";
        return "image/jpeg";
    }

    private static String safeName(String name, String mime) {
        String n = name == null ? "" : name.trim();
        n = n.replaceAll("[/\\\\:*?\"<>|\\r\\n\\t]", "_").replaceAll("\\s+", " ").trim();
        if (n.isEmpty()) n = "聚搜图库_" + System.currentTimeMillis();
        if (n.length() > 80) n = n.substring(0, 80);
        String ext = mime.contains("png") ? ".png" : mime.contains("webp") ? ".webp"
                : mime.contains("gif") ? ".gif" : ".jpg";
        if (!n.toLowerCase(java.util.Locale.US).matches(".*\\.(jpg|jpeg|png|webp|gif|bmp)$")) n += ext;
        return n;
    }
}
