package com.donghuaigu.jusou;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;

import java.io.ByteArrayOutputStream;

/**
 * 把「纹身线稿大师」的纯 Java 线描算法接入本地 API：
 * base64 图片进 → 白底黑线 PNG 的 data URL 出。
 */
public final class StencilBridge {
    private StencilBridge() {}

    public static String process(String dataUrl, int preset, int strength,
                                 int detail, boolean cleanBackground) throws Exception {
        int comma = dataUrl == null ? -1 : dataUrl.indexOf(',');
        if (comma < 0) throw new Exception("缺少图片数据");
        byte[] bytes;
        try { bytes = Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT); }
        catch (Exception e) { throw new Exception("图片解码失败"); }

        BitmapFactory.Options bo = new BitmapFactory.Options();
        bo.inPreferredConfig = Bitmap.Config.ARGB_8888;
        Bitmap src = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bo);
        if (src == null) throw new Exception("无法读取图片，请换一张 JPG/PNG");

        StencilProcessor.Options o = new StencilProcessor.Options();
        o.preset = Math.max(0, Math.min(2, preset));
        o.strength = Math.max(0, Math.min(100, strength));
        o.detail = Math.max(0, Math.min(100, detail));
        o.cleanBackground = cleanBackground;

        Bitmap out = null;
        try {
            out = StencilProcessor.process(src, o, null);
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            if (!out.compress(Bitmap.CompressFormat.PNG, 100, bos)) {
                throw new Exception("PNG 编码失败");
            }
            return "data:image/png;base64," + Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP);
        } finally {
            if (out != null && out != src) out.recycle();
            src.recycle();
        }
    }
}
