package com.donghuaigu.jusou;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;

/** 聚搜图库主界面：一个 WebView + 应用内本地服务。 */
public class MainActivity extends Activity {

    private static final int REQ_DIR = 1001;
    private static final int REQ_IMAGE = 1002;
    private static final int REQ_PERMISSION = 1003;
    /** 「秒变线稿」iframe 内 &lt;input type=file&gt; 触发的系统选图 */
    private static final int REQ_MB_IMAGE = 1004;

    private WebView web;
    private LocalServer server;
    private DownloadManager downloads;
    private String baseUrl;
    private ValueCallback<Uri[]> mbFilePathCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        downloads = new DownloadManager(this);
        try {
            server = new LocalServer(this, downloads);
            int port = server.start();
            baseUrl = "http://127.0.0.1:" + port + "/";
        } catch (Exception e) {
            Toast.makeText(this, "本地服务启动失败：" + e.getMessage(), Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        web = new WebView(this);
        web.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        WebSettings ws = web.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setAllowFileAccess(true);
        ws.setAllowContentAccess(true);
        // 「秒变线稿」是同源 iframe（由本地 HTTP 服务提供），其系统选图回传的是
        // 应用私有缓存里的 file:// URI；允许本机回环页面读取，避免部分机型读不到。
        // 页面内容全部来自 assets，不加载任何不可信远程页面。
        try {
            ws.setAllowFileAccessFromFileURLs(true);
            ws.setAllowUniversalAccessFromFileURLs(true);
        } catch (Throwable ignored) {}
        ws.setLoadWithOverviewMode(false);
        ws.setUseWideViewPort(true);
        ws.setSupportZoom(false);
        ws.setTextZoom(100);
        ws.setCacheMode(WebSettings.LOAD_NO_CACHE);
        ws.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        web.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);
        web.addJavascriptInterface(new NativeBridge(), "Android");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleUrl(url);
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return handleUrl(req.getUrl().toString());
            }
            private boolean handleUrl(String url) {
                if (url.startsWith(baseUrl) || url.startsWith("about:") || url.startsWith("data:")) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (Exception ignored) {}
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (mbFilePathCallback != null) mbFilePathCallback.onReceiveValue(null);
                mbFilePathCallback = callback;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("image/*");
                i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                try {
                    startActivityForResult(Intent.createChooser(i, "选择图片"), REQ_MB_IMAGE);
                } catch (Exception e) {
                    mbFilePathCallback = null;
                    toast("无法打开文件选择器");
                    return false;
                }
                return true;
            }
        });
        setContentView(web);
        web.loadUrl(baseUrl);

        if (Build.VERSION.SDK_INT <= 28 && checkSelfPermission(android.Manifest.permission.WRITE_EXTERNAL_STORAGE)
                != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{ android.Manifest.permission.WRITE_EXTERNAL_STORAGE }, REQ_PERMISSION);
        }
    }

    @Override
    public void onBackPressed() {
        // 把返回键交给前端：关闭查看器 / 面板，或双击退出
        if (web != null) web.evaluateJavascript("window.__onBack && window.__onBack()", null);
    }

    @Override
    protected void onDestroy() {
        if (server != null) server.stop();
        if (web != null) web.destroy();
        super.onDestroy();
    }

    @Override
    protected void onActivityResult(int req, int result, Intent data) {
        if (req == REQ_MB_IMAGE) {
            // content:// 在部分机型上 WebView 读不到，先复制到应用私有缓存并保留原文件名
            Uri[] picked = null;
            if (result == RESULT_OK && data != null) {
                ArrayList<Uri> uris = new ArrayList<Uri>();
                if (data.getClipData() != null) {
                    for (int i = 0; i < data.getClipData().getItemCount(); i++) {
                        uris.add(data.getClipData().getItemAt(i).getUri());
                    }
                } else if (data.getData() != null) {
                    uris.add(data.getData());
                }
                ArrayList<Uri> local = new ArrayList<Uri>();
                for (int i = 0; i < uris.size(); i++) {
                    Uri copy = copyToCache(uris.get(i), i);
                    if (copy != null) local.add(copy);
                }
                if (!local.isEmpty()) picked = local.toArray(new Uri[local.size()]);
            }
            if (mbFilePathCallback != null) {
                mbFilePathCallback.onReceiveValue(picked);
                mbFilePathCallback = null;
            }
            return;
        }
        super.onActivityResult(req, result, data);
        if (result != RESULT_OK || data == null) return;
        if (req == REQ_DIR) {
            Uri tree = data.getData();
            if (tree == null) return;
            downloads.setCustomDir(tree, data.getFlags());
            Map<String, Object> m = new LinkedHashMap<String, Object>();
            m.put("ok", true);
            m.put("dirLabel", downloads.dirLabel());
            callJs("__onNativeDir", Json.stringify(m));
        } else if (req == REQ_IMAGE) {
            new Thread(new Runnable() {
                public void run() { loadPickedImage(data.getData()); }
            }, "jusou-pick").start();
        }
    }

    /** 把 content:// 图片复制成应用缓存里的普通文件，保留显示名供导出使用。 */
    private Uri copyToCache(Uri src, int index) {
        String name = displayName(src);
        String safe = name.replaceAll("[^a-zA-Z0-9._-]", "_");
        if (safe.isEmpty()) safe = "image_" + index;
        if (!safe.contains(".")) safe = safe + ".jpg";
        File dir = new File(getCacheDir(), "mbpicks");
        if (!dir.exists() && !dir.mkdirs()) return null;
        File out = new File(dir, safe);
        int seq = 2;
        while (out.exists() && seq < 100) {
            int dot = safe.lastIndexOf('.');
            String base = dot > 0 ? safe.substring(0, dot) : safe;
            String ext = dot > 0 ? safe.substring(dot) : "";
            out = new File(dir, base + "_" + (seq++) + ext);
        }
        InputStream in = null;
        OutputStream os = null;
        try {
            in = getContentResolver().openInputStream(src);
            if (in == null) return null;
            os = new FileOutputStream(out);
            byte[] buf = new byte[16384];
            int n;
            while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
            os.flush();
            return Uri.fromFile(out);
        } catch (Exception e) {
            return null;
        } finally {
            try { if (in != null) in.close(); } catch (Exception ignored) {}
            try { if (os != null) os.close(); } catch (Exception ignored) {}
        }
    }

    private String displayName(Uri uri) {
        String name = "image";
        Cursor c = null;
        try {
            c = getContentResolver().query(uri, null, null, null, null);
            if (c != null) {
                int idx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (idx >= 0 && c.moveToFirst()) {
                    String v = c.getString(idx);
                    if (v != null && !v.isEmpty()) name = v;
                }
            }
        } catch (Exception ignored) {
        } finally { if (c != null) try { c.close(); } catch (Exception ignored) {} }
        return name;
    }

    private void loadPickedImage(Uri uri) {
        Map<String, Object> m = new LinkedHashMap<String, Object>();
        try {
            InputStream in = getContentResolver().openInputStream(uri);
            if (in == null) throw new Exception("无法读取所选图片");
            byte[] raw = Net.readAll(in, 24 * 1024 * 1024);

            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(raw, 0, raw.length, bounds);
            int maxSide = Math.max(bounds.outWidth, bounds.outHeight);
            int sample = 1;
            while (maxSide / sample > 1600) sample *= 2;
            BitmapFactory.Options opt = new BitmapFactory.Options();
            opt.inSampleSize = sample;
            opt.inPreferredConfig = Bitmap.Config.ARGB_8888;
            Bitmap bmp = BitmapFactory.decodeByteArray(raw, 0, raw.length, opt);
            if (bmp == null) throw new Exception("图片解码失败");

            int side = Math.max(bmp.getWidth(), bmp.getHeight());
            if (side > 1600) {
                float k = 1600f / side;
                Matrix mx = new Matrix();
                mx.setScale(k, k);
                Bitmap scaled = Bitmap.createBitmap(bmp, 0, 0, bmp.getWidth(), bmp.getHeight(), mx, true);
                if (scaled != bmp) { bmp.recycle(); bmp = scaled; }
            }
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            bmp.compress(Bitmap.CompressFormat.JPEG, 86, bos);
            bmp.recycle();
            byte[] jpeg = bos.toByteArray();
            m.put("ok", true);
            // 只把短 URL 通过 JS 桥回传，图片字节走本地 HTTP，避免 Binder 事务大小限制
            m.put("url", server == null ? "" : server.putPicked(jpeg, "image/jpeg"));
        } catch (Exception e) {
            m.put("ok", false);
            m.put("error", e.getMessage() == null ? "读取失败" : e.getMessage());
        }
        callJs("__onNativeImage", Json.stringify(m));
    }

    private void callJs(final String fn, final String argJson) {
        runOnUiThread(new Runnable() {
            public void run() {
                if (web != null) {
                    web.evaluateJavascript("window." + fn + " && window." + fn + "(" + argJson + ")", null);
                }
            }
        });
    }

    private void toast(final String msg) {
        runOnUiThread(new Runnable() {
            public void run() { Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show(); }
        });
    }

    /** JS 可调用的原生能力。 */
    private final class NativeBridge {

        @JavascriptInterface
        public void chooseDownloadDir() {
            runOnUiThread(new Runnable() {
                public void run() {
                    try {
                        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
                        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                                | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                                | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
                        startActivityForResult(i, REQ_DIR);
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "无法打开目录选择器", Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        @JavascriptInterface
        public void clearDownloadDir() {
            downloads.clearCustomDir();
            Map<String, Object> m = new LinkedHashMap<String, Object>();
            m.put("ok", true);
            m.put("dirLabel", downloads.dirLabel());
            callJs("__onNativeDir", Json.stringify(m));
        }

        @JavascriptInterface
        public void pickImage() {
            runOnUiThread(new Runnable() {
                public void run() {
                    try {
                        Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                        i.setType("image/*");
                        i.addCategory(Intent.CATEGORY_OPENABLE);
                        startActivityForResult(Intent.createChooser(i, "选择要转换的图片"), REQ_IMAGE);
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "无法打开图片选择器", Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        @JavascriptInterface
        public void openExternal(String url) {
            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
            catch (Exception e) { toast("无法打开链接"); }
        }

        @JavascriptInterface
        public void shareText(String text) {
            try {
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType("text/plain");
                i.putExtra(Intent.EXTRA_TEXT, text);
                startActivity(Intent.createChooser(i, "分享"));
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void toast(final String msg) {
            runOnUiThread(new Runnable() {
                public void run() { Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show(); }
            });
        }

        @JavascriptInterface
        public void finishApp() { runOnUiThread(new Runnable() { public void run() { finish(); } }); }

        @JavascriptInterface
        public String version() { return "2.0.0"; }
    }

}
