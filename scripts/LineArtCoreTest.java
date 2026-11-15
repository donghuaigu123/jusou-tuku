import com.donghuaigu.jusou.ColorCard;
import com.donghuaigu.jusou.LineArtCore;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.File;
import java.util.List;

/**
 * 桌面端验证移植后的「图转线稿」纯 Java 算法：
 * 两种描线算法、三档调节项、镜像、纯二值输出与色卡提取。
 *
 * 用法：java -cp <classes> LineArtCoreTest <任意彩色图片路径>
 */
public class LineArtCoreTest {

    public static void main(String[] args) throws Exception {
        File in = new File(args.length > 0 ? args[0] : "docs/sample.png");
        BufferedImage src = ImageIO.read(in);
        if (src == null) throw new Exception("无法读取 " + in);
        int w = src.getWidth(), h = src.getHeight();
        int[] px = src.getRGB(0, 0, w, h, null, 0, w);
        System.out.println("输入: " + in.getName() + "  " + w + "x" + h);

        LineArtCore.Options smart = new LineArtCore.Options();
        int[] a = LineArtCore.process(px, w, h, smart);
        stat("智能线稿(默认)", a, true);

        LineArtCore.Options classic = new LineArtCore.Options();
        classic.mode = LineArtCore.MODE_CLASSIC;
        int[] b = LineArtCore.process(px, w, h, classic);
        stat("经典勾线", b, true);

        LineArtCore.Options tattoo = new LineArtCore.Options();
        tattoo.mirror = true;
        tattoo.lineWidth = 3;
        int[] c = LineArtCore.process(px, w, h, tattoo);
        stat("镜像转印 + 粗细3x", c, true);

        LineArtCore.Options low = new LineArtCore.Options();
        low.density = 15;
        int[] d = LineArtCore.process(px, w, h, low);
        int[] lowStat = stat("浓度15%", d, false);

        LineArtCore.Options high = new LineArtCore.Options();
        high.density = 85;
        int[] e = LineArtCore.process(px, w, h, high);
        int[] highStat = stat("浓度85%", e, false);

        LineArtCore.Options soft = new LineArtCore.Options();
        soft.pureBW = false;
        int[] f = LineArtCore.process(px, w, h, soft);
        System.out.println("柔和灰阶: 非二值像素 " + countOther(f) + " 个（应 > 0）");

        // 镜像必须改变像素分布（验证水平翻转生效）
        int diff = 0;
        for (int i = 0; i < a.length; i++) if (a[i] != c[i]) diff++;
        System.out.println("镜像稿与默认稿差异像素: " + diff);
        if (diff == 0) throw new Exception("镜像未生效");

        // 浓度必须改变黑线占比
        System.out.println("浓度 15% 黑线 " + lowStat[0] + " / 浓度 85% 黑线 " + highStat[0]);
        if (highStat[0] <= lowStat[0]) throw new Exception("浓度调节未生效");

        List<ColorCard.Swatch> crowd = ColorCard.crowd(px, w, h, 0.01, 8);
        List<ColorCard.Swatch> naive = ColorCard.naive(px, w, h, 4, 2);
        StringBuilder sb = new StringBuilder("色卡 crowd: ");
        for (ColorCard.Swatch s : crowd) sb.append(s.hex()).append('(')
                .append(String.format("%.1f%%", s.ratio * 100)).append(") ");
        System.out.println(sb);
        sb = new StringBuilder("色卡 naive 4x2: ");
        for (ColorCard.Swatch s : naive) sb.append(s.hex()).append(' ');
        System.out.println(sb);
        if (crowd.isEmpty() || naive.size() != 8) throw new Exception("色卡提取异常");

        System.out.println("ALL_OK · 移植算法与色卡全部通过");
    }

    private static int[] stat(String name, int[] out, boolean requirePure) {
        int black = 0, white = 0, other = 0;
        for (int c : out) {
            if (c == 0xFF000000) black++;
            else if (c == 0xFFFFFFFF) white++;
            else other++;
        }
        System.out.printf("%s: 黑线 %.2f%%  纯白底 %.2f%%  其它 %.2f%%%n",
                name, 100.0 * black / out.length, 100.0 * white / out.length,
                100.0 * other / out.length);
        if (requirePure && other != 0) throw new AssertionError(name + " 未做到 100% 纯二值");
        if (black == 0) throw new AssertionError(name + " 没有检出任何线条");
        return new int[]{black, white, other};
    }

    private static int countOther(int[] out) {
        int n = 0;
        for (int c : out) if (c != 0xFF000000 && c != 0xFFFFFFFF) n++;
        return n;
    }
}
