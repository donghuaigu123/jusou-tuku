package com.donghuaigu.jusou;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.util.Base64;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 把开源项目「图转线稿 / TuZhuanXianGao」的纯 Java 算法接入本地 API：
 *   https://github.com/donghuaigu123/tuzhuanxiangao （MIT）
 *
 * base64 图片进 → 纯白底纯黑线 PNG 的 data URL + 两组色卡出。
 * 算法本体在 {@link LineArtCore} 与 {@link ColorCard}，均为原样移植。
 */
public final class LineArtBridge {

    /** 处理边长上限，与原项目 LineArtEngine.MAX_SIDE 一致，避免手机端 OOM。 */
    public static final int MAX_SIDE = 1600;

    private LineArtBridge() {}

    /**
     * @return Map: image(data URL) / crowd(全局主色) / naive(网格色卡) / width / height
     */
    public static Map<String, Object> process(String dataUrl, int mode, int sensitivity,
                                              int density, int lineWidth, boolean pureBW,
                                              boolean mirror, boolean invert,
                                              boolean enhance) throws Exception {
        Bitmap src = decode(dataUrl);
        Bitmap work = src;
        try {
            int side = Math.max(src.getWidth(), src.getHeight());
            if (side > MAX_SIDE) {
                float k = (float) MAX_SIDE / side;
                Matrix mx = new Matrix();
                mx.setScale(k, k);
                work = Bitmap.createBitmap(src, 0, 0, src.getWidth(), src.getHeight(), mx, true);
            }
            int w = work.getWidth(), h = work.getHeight();
            int[] px = new int[w * h];
            work.getPixels(px, 0, w, 0, 0, w, h);

            LineArtCore.Options o = new LineArtCore.Options();
            o.mode = (mode == LineArtCore.MODE_CLASSIC) ? LineArtCore.MODE_CLASSIC : LineArtCore.MODE_SMART;
            o.sensitivity = clamp(sensitivity, 0, 100);
            o.density = clamp(density, 0, 100);
            o.lineWidth = clamp(lineWidth, 1, 5);
            o.pureBW = pureBW;
            o.mirror = mirror;
            o.invert = invert;
            o.enhance = enhance;

            int[] out = LineArtCore.process(px, w, h, o);
            Bitmap result = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
            result.setPixels(out, 0, w, 0, 0, w, h);
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            if (!result.compress(Bitmap.CompressFormat.PNG, 100, bos)) {
                throw new Exception("PNG 编码失败");
            }
            result.recycle();

            Map<String, Object> m = new LinkedHashMap<String, Object>();
            m.put("image", "data:image/png;base64,"
                    + Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP));
            m.put("crowd", swatches(ColorCard.crowd(px, w, h, 0.01, 8)));
            m.put("naive", swatches(ColorCard.naive(px, w, h, 4, 2)));
            m.put("width", w);
            m.put("height", h);
            return m;
        } finally {
            if (work != src) work.recycle();
            src.recycle();
        }
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

    private static List<Object> swatches(List<ColorCard.Swatch> list) {
        List<Object> out = new ArrayList<Object>();
        for (ColorCard.Swatch s : list) {
            Map<String, Object> m = new LinkedHashMap<String, Object>();
            m.put("hex", s.hex());
            m.put("ratio", Math.round(s.ratio * 1000) / 1000.0);
            out.add(m);
        }
        return out;
    }

    private static int clamp(int v, int lo, int hi) {
        return v < lo ? lo : (v > hi ? hi : v);
    }
}
