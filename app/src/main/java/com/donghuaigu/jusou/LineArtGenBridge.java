package com.donghuaigu.jusou;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 把开源项目「线稿生成 / LineArt Generator」的纯 Java 算法接入本地 API：
 *   https://github.com/donghuaigu123/LineArt-Generator （MIT）
 *
 * base64 图片进 → 纯白底纯黑线（或反色）PNG 的 data URL 出。
 * 算法本体在 {@link LineArtEngine}，为原样移植。
 *
 * 前端可在 payload 里给出归一化裁剪框 crop={x,y,w,h}（0..1）；
 * 给出时先按裁剪框裁出ROI再生成，实现原项目「框选选区再生成」的能力。
 */
public final class LineArtGenBridge {

    /** 处理边长上限，避免手机端 OOM；原项目预览使用同策略。 */
    public static final int MAX_SIDE = 1600;

    private LineArtGenBridge() {}

    /**
     * @return Map: image(data URL) / width / height / mode
     */
    public static Map<String, Object> process(String dataUrl, int mode, int detail,
                                              int thickness, int ink, int clean,
                                              boolean invert, boolean darkBgSuppression,
                                              Map<String, Object> crop) throws Exception {
        Bitmap src = decode(dataUrl);
        Bitmap work = src;
        try {
            // 可选裁剪：crop 为归一化坐标，整数 0..1000（即 x/1000 表示比例）
            if (crop != null && crop.containsKey("w") && crop.containsKey("h")) {
                int rx = Json.integer(crop.get("x"), 0);
                int ry = Json.integer(crop.get("y"), 0);
                int rw = Json.integer(crop.get("w"), 1000);
                int rh = Json.integer(crop.get("h"), 1000);
                if (rw > 50 && rh > 50 && rx >= 0 && ry >= 0
                        && rx + rw <= 1001 && ry + rh <= 1001) {
                    int px = clamp((int) ((long) rx * src.getWidth() / 1000), 0, src.getWidth() - 1);
                    int py = clamp((int) ((long) ry * src.getHeight() / 1000), 0, src.getHeight() - 1);
                    int pw = clamp((int) ((long) rw * src.getWidth() / 1000), 1, src.getWidth() - px);
                    int ph = clamp((int) ((long) rh * src.getHeight() / 1000), 1, src.getHeight() - py);
                    Bitmap cropped = Bitmap.createBitmap(src, px, py, pw, ph);
                    if (cropped != src) { work = cropped; }
                }
            }

            // 限制边长（等比缩放），与前端预览保持同尺寸语义
            int side = Math.max(work.getWidth(), work.getHeight());
            if (side > MAX_SIDE) {
                float k = (float) MAX_SIDE / side;
                int nw = Math.max(1, Math.round(work.getWidth() * k));
                int nh = Math.max(1, Math.round(work.getHeight() * k));
                Bitmap scaled = Bitmap.createScaledBitmap(work, nw, nh, true);
                if (scaled != work) { if (work != src) work.recycle(); work = scaled; }
            }

            int w = work.getWidth(), h = work.getHeight();
            int[] px = new int[w * h];
            work.getPixels(px, 0, w, 0, 0, w, h);

            LineArtEngine.Params p = new LineArtEngine.Params();
            p.mode = clamp(mode, LineArtEngine.MODE_FINE, LineArtEngine.MODE_STENCIL);
            p.detail = clamp(detail, 1, 100);
            p.thickness = clamp(thickness, 0, 5);
            p.ink = clamp(ink, 1, 100);
            p.clean = clamp(clean, 0, 100);
            p.invert = invert;
            p.darkBgSuppression = darkBgSuppression;

            int[] out = LineArtEngine.process(px, w, h, p);
            Bitmap result = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
            result.setPixels(out, 0, w, 0, 0, w, h);
            byte[] png = encodePng(result);
            result.recycle();

            Map<String, Object> m = new LinkedHashMap<String, Object>();
            m.put("image", "data:image/png;base64," + Base64.encodeToString(png, Base64.NO_WRAP));
            m.put("width", w);
            m.put("height", h);
            m.put("mode", p.mode);
            return m;
        } finally {
            if (work != src) work.recycle();
            src.recycle();
        }
    }

    private static byte[] encodePng(Bitmap bmp) throws Exception {
        java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
        if (!bmp.compress(Bitmap.CompressFormat.PNG, 100, bos)) throw new Exception("PNG 编码失败");
        return bos.toByteArray();
    }

    private static Bitmap decode(String dataUrl) throws Exception {
        int comma = dataUrl == null ? -1 : dataUrl.indexOf(',');
        if (comma < 0) throw new Exception("缺少图片数据");
        byte[] bytes;
        try { bytes = Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT); }
        catch (Exception e) { throw new Exception("图片解码失败"); }
        BitmapFactory.Options bo = new BitmapFactory.Options();
        bo.inPreferredConfig = Bitmap.Config.ARGB_8888;
        Bitmap src = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bo);
        if (src == null) throw new Exception("无法读取图片，请换一张 JPG/PNG");
        return src;
    }

    private static int clamp(int v, int lo, int hi) { return v < lo ? lo : (v > hi ? hi : v); }
}
