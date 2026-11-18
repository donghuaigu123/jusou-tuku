import com.donghuaigu.jusou.LineArtEngine;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.File;

/** 桌面自测：验证移植后的 LineArtEngine 5 种模式均输出纯二值（白底黑线或反色）。 */
public class LineArtEngineTest {
    public static void main(String[] args) throws Exception {
        if (args.length < 1) { System.out.println("usage: LineArtEngineTest <image>"); System.exit(1); }
        BufferedImage bi = ImageIO.read(new File(args[0]));
        int w = bi.getWidth(), h = bi.getHeight();
        // 限制到 500 边，桌面测试求快
        double k = Math.min(1.0, 500.0 / Math.max(w, h));
        if (k < 1) {
            int nw = (int) (w * k), nh = (int) (h * k);
            BufferedImage s = new BufferedImage(nw, nh, BufferedImage.TYPE_INT_ARGB);
            java.awt.Graphics2D g = s.createGraphics();
            g.drawImage(bi, 0, 0, nw, nh, null); g.dispose();
            bi = s; w = nw; h = nh;
        }
        int[] px = new int[w * h];
        for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) px[y * w + x] = bi.getRGB(x, y);

        int[][] rec = {
            {0, 72, 1, 55, 60}, {1, 55, 1, 50, 50}, {2, 40, 1, 38, 60},
            {3, 65, 0, 55, 45}, {4, 50, 0, 35, 50}
        };
        for (int[] r : rec) {
            LineArtEngine.Params p = new LineArtEngine.Params();
            p.mode = r[0]; p.detail = r[1]; p.thickness = r[2]; p.ink = r[3]; p.clean = r[4];
            int[] out = LineArtEngine.process(px, w, h, p);
            int black = 0, white = 0, other = 0;
            for (int c : out) {
                if (c == 0xFF000000) black++;
                else if (c == 0xFFFFFFFF) white++;
                else other++;
            }
            double total = w * h;
            System.out.printf("模式%d(%s): 黑%.2f%% 白%.2f%% 其它%.4f%%%n",
                    r[0], LineArtEngine.MODE_NAMES[r[0]],
                    black / total * 100, white / total * 100, other / total * 100);
            if (other != 0) { System.out.println("!!! 非纯二值像素，异常"); System.exit(2); }
        }
        // 反色模式
        LineArtEngine.Params p = new LineArtEngine.Params();
        p.mode = 1; p.invert = true;
        int[] inv = LineArtEngine.process(px, w, h, p);
        boolean hasWhiteLine = false;
        for (int c : inv) if (c == 0xFFFFFFFF) { hasWhiteLine = true; break; }
        System.out.println("反色模式含白线(黑底): " + hasWhiteLine);
        System.out.println("=== 全部通过 ===");
    }
}
