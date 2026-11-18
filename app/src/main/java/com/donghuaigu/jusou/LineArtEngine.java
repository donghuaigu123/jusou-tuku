/*
 * 移植自开源项目「线稿生成 / LineArt Generator」
 *   https://github.com/donghuaigu123/LineArt-Generator
 * Copyright (c) 2026 donghuaigu123，MIT License。
 *
 * 算法逻辑保持原样，仅修改包名以并入「聚搜图库」。
 * 纯 Java 实现：Canny 白描 / XDoG 素描 / 自适应阈值块面，
 * 配合形态学闭运算、连通域去噪，输出纯白底纯黑线纹身转印底稿。
 * 不依赖 OpenCV / NDK / 任何第三方库。
 */
package com.donghuaigu.jusou;

/**
 * 线稿生成引擎（纯算法，无平台依赖）。
 * 输入 ARGB int[] 像素，输出黑线白底（或反色）的 ARGB int[]。
 *
 * 模式：
 *  MODE_FINE     精细白描 —— 细线、高细节、闭合轮廓，最接近工笔白描
 *  MODE_STANDARD 标准线稿 —— 均衡模式，线条干净
 *  MODE_BOLD     粗犷轮廓 —— 粗线轮廓，忽略细节
 *  MODE_SKETCH   素描排线 —— XDoG，保留明暗排线质感
 *  MODE_STENCIL  黑白块面 —— 自适应阈值二值，明暗剪影稿
 */
public final class LineArtEngine {

    public static final int MODE_FINE = 0;
    public static final int MODE_STANDARD = 1;
    public static final int MODE_BOLD = 2;
    public static final int MODE_SKETCH = 3;
    public static final int MODE_STENCIL = 4;

    public static final String[] MODE_NAMES = {
            "精细白描", "标准线稿", "粗犷轮廓", "素描排线", "黑白块面"
    };

    /** 参数（全部为用户可调项，范围见注释） */
    public static final class Params {
        public int mode = MODE_STANDARD;   // 0..4
        public int detail = 60;            // 1..100 细节保留（越高细节越多，背景纹理也越多）
        public int thickness = 1;          // 0..5 线条粗细
        public int ink = 55;               // 1..100 线条浓度（越高线条越多越浓）
        public int clean = 45;             // 0..100 背景净化（去除小杂点/浅灰噪声）
        public boolean invert = false;     // 输出反色（白线黑底）
        public boolean darkBgSuppression = false; // 压制暗色背景边缘（照片类素材）
    }

    private LineArtEngine() {}

    /** 主入口：pixels 为 ARGB，返回同尺寸 ARGB（黑线白底） */
    public static int[] process(int[] pixels, int w, int h, Params p) {
        int n = w * h;
        float[] gray = new float[n];
        for (int i = 0; i < n; i++) {
            int c = pixels[i];
            int r = (c >> 16) & 0xFF, g = (c >> 8) & 0xFF, b = c & 0xFF;
            gray[i] = (0.299f * r + 0.587f * g + 0.114f * b) / 255f;
        }
        float[] out = new float[n];
        switch (p.mode) {
            case MODE_SKETCH:  xdog(gray, out, w, h, p); break;
            case MODE_STENCIL: stencil(gray, out, w, h, p); break;
            default:           canny(gray, out, w, h, p); break;
        }
        // 形态学：闭运算（膨胀+腐蚀）连接断线；膨胀前先清一轮小杂点，避免噪声被放大
        boolean[] ink = toBinary(out, n, p.mode);
        int[] cp = cleanParams(p, n);
        removeSmallComponents(ink, w, h, cp[0] / 2, cp[1], Math.max(3, cp[2] * 4 / 5));
        if (p.mode == MODE_SKETCH || p.mode == MODE_STENCIL) {
            // 块面/排线模式不做闭运算，只按粗细膨胀
            for (int i = 0; i < p.thickness; i++) ink = dilate(ink, w, h);
        } else {
            // 闭运算：固定连接一次断口，再按粗细加粗
            ink = dilate(ink, w, h);
            ink = erode(ink, w, h);
            int dil = p.thickness;
            if (p.mode == MODE_BOLD) dil += 1;
            for (int i = 0; i < dil; i++) ink = dilate(ink, w, h);
        }
        // 背景净化：最终清理点状噪声
        removeSmallComponents(ink, w, h, cp[0], cp[1], cp[2]);
        // 输出
        int[] result = new int[n];
        int black = p.invert ? 0xFFFFFFFF : 0xFF000000;
        int white = p.invert ? 0xFF000000 : 0xFFFFFFFF;
        for (int i = 0; i < n; i++) {
            result[i] = ink[i] ? black : white;
        }
        return result;
    }

    // ---------------- Canny 白描/标准/粗线 ----------------

    private static void canny(float[] gray, float[] out, int w, int h, Params p) {
        int n = w * h;
        // 高斯平滑，σ 由细节参数决定
        float sigma = 0.45f + (100 - p.detail) * 0.016f;
        if (p.mode == MODE_STANDARD) sigma *= 1.18f;
        if (p.mode == MODE_BOLD) sigma *= 1.45f;
        float[] blur = gaussianBlur(gray, w, h, sigma);

        // Sobel 梯度
        float[] mag = new float[n];
        float[] dir = new float[n];
        for (int y = 1; y < h - 1; y++) {
            for (int x = 1; x < w - 1; x++) {
                int i = y * w + x;
                float tl = blur[i - w - 1], tc = blur[i - w], tr = blur[i - w + 1];
                float ml = blur[i - 1],                     mr = blur[i + 1];
                float bl = blur[i + w - 1], bc = blur[i + w], br = blur[i + w + 1];
                float gx = (tr + 2 * mr + br) - (tl + 2 * ml + bl);
                float gy = (bl + 2 * bc + br) - (tl + 2 * tc + tr);
                mag[i] = (float) Math.sqrt(gx * gx + gy * gy);
                dir[i] = (float) Math.atan2(gy, gx);
            }
        }
        // 非极大值抑制
        float[] nms = new float[n];
        for (int y = 1; y < h - 1; y++) {
            for (int x = 1; x < w - 1; x++) {
                int i = y * w + x;
                float m = mag[i];
                if (m <= 0f) continue;
                float a = dir[i];
                // 量化到 0/45/90/135
                if (a < 0) a += (float) Math.PI;
                float d1, d2;
                if (a < Math.PI / 8 || a >= Math.PI * 7 / 8) { d1 = mag[i - 1]; d2 = mag[i + 1]; }
                else if (a < Math.PI * 3 / 8) { d1 = mag[i - w + 1]; d2 = mag[i + w - 1]; }
                else if (a < Math.PI * 5 / 8) { d1 = mag[i - w]; d2 = mag[i + w]; }
                else { d1 = mag[i - w - 1]; d2 = mag[i + w + 1]; }
                if (m >= d1 && m >= d2) nms[i] = m;
            }
        }
        // 用高分位数归一化，抗极端值
        float norm = percentile(nms, 0.997f);
        if (norm <= 0f) norm = 1f;
        // 双阈值：ink 越高阈值越低 → 线越多
        float highT = norm * (0.46f - p.ink * 0.0032f);   // ink=1 → 0.457, ink=100 → 0.14
        float lowT = highT * 0.42f;
        hysteresis(nms, out, w, h, lowT, highT);
        // 暗背景抑制：删除处于低亮度区域的边缘（用于暗背景照片，主体亮、背景暗）
        if (p.darkBgSuppression) {
            float[] bright = gaussianBlur(gray, w, h, 3f);
            for (int i = 0; i < n; i++) {
                if (out[i] > 0.5f && bright[i] < 0.24f) out[i] = 0f;
            }
        }
    }

    private static void hysteresis(float[] nms, float[] out, int w, int h, float lowT, float highT) {
        int n = w * h;
        int[] stack = new int[n];
        boolean[] visited = new boolean[n];
        java.util.Arrays.fill(out, 0f);
        int top;
        for (int i = 0; i < n; i++) {
            if (visited[i] || nms[i] < highT) continue;
            top = 0;
            stack[top++] = i;
            visited[i] = true;
            while (top > 0) {
                int c = stack[--top];
                out[c] = 1f;
                int cx = c % w, cy = c / w;
                for (int dy = -1; dy <= 1; dy++) {
                    int ny = cy + dy;
                    if (ny < 0 || ny >= h) continue;
                    for (int dx = -1; dx <= 1; dx++) {
                        int nx = cx + dx;
                        if (nx < 0 || nx >= w) continue;
                        int ni = ny * w + nx;
                        if (visited[ni] || nms[ni] < lowT) continue;
                        visited[ni] = true;
                        stack[top++] = ni;
                    }
                }
            }
        }
    }

    // ---------------- XDoG 素描排线 ----------------

    private static void xdog(float[] gray, float[] out, int w, int h, Params p) {
        int n = w * h;
        float sigma = 0.5f + (100 - p.detail) * 0.012f;
        float[] g1 = gaussianBlur(gray, w, h, sigma);
        float[] g2 = gaussianBlur(gray, w, h, sigma * 1.6f);
        float pp = 21f;
        // ε 由 ink 控制：ink 高 → ε 低 → 保留更多中间调
        float eps = 0.036f - p.ink * 0.00030f;   // ink=1 → 0.0357, ink=100 → 0.006
        float phi = 6f + p.clean * 0.10f;         // clean 高 → 过渡更硬更干净
        for (int i = 0; i < n; i++) {
            float v = (1 + pp) * g1[i] - pp * g2[i];
            if (v >= eps) out[i] = 1f;
            else {
                float t = 1f + (float) Math.tanh(phi * (v - eps));
                out[i] = Math.max(0f, t);
            }
        }
        // 提高对比：软阈值产生的灰阶适度拉伸，保留排线灰调
        for (int i = 0; i < n; i++) {
            float v = out[i];
            out[i] = Math.min(1f, v * 1.40f);
        }
    }

    // ---------------- 黑白块面（自适应阈值） ----------------

    private static void stencil(float[] gray, float[] out, int w, int h, Params p) {
        int n = w * h;
        // 预平滑
        float[] blur = gaussianBlur(gray, w, h, 0.8f + (100 - p.detail) * 0.02f);
        // 积分图求局部均值
        long[] sum = new long[n + 1];
        for (int i = 0; i < n; i++) {
            sum[i + 1] = sum[i] + (int) (blur[i] * 4096);
        }
        int win = Math.max(15, Math.min(w, h) / 8) | 1;
        int r = win / 2;
        float C = 0.045f + p.ink * 0.00050f;   // ink 高 → 判黑更宽松 → 黑块多
        for (int y = 0; y < h; y++) {
            int y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r);
            for (int x = 0; x < w; x++) {
                int x0 = Math.max(0, x - r), x1 = Math.min(w - 1, x + r);
                long s = sum[y1 * w + x1 + 1] - sum[y0 * w + x1 + 1] - sum[y1 * w + x0] + sum[y0 * w + x0];
                int cnt = (y1 - y0 + 1) * (x1 - x0 + 1);
                float mean = (s / (float) cnt) / 4096f;
                int i = y * w + x;
                // 正片式：亮部→黑块（主体剪影），暗背景→白，保证底色干净
                out[i] = blur[i] > mean + C ? 0f : 1f;
            }
        }
    }

    // ---------------- 工具函数 ----------------

    private static boolean[] toBinary(float[] v, int n, int mode) {
        boolean[] b = new boolean[n];
        if (mode == MODE_SKETCH || mode == MODE_STENCIL) {
            // sketch：1=白，阈值放低以保留中间灰调排线；stencil：0=黑
            float th = mode == MODE_SKETCH ? 0.62f : 0.5f;
            for (int i = 0; i < n; i++) b[i] = v[i] < th;
        } else {
            // Canny 类：1=边缘（墨），0=背景
            for (int i = 0; i < n; i++) b[i] = v[i] > 0.5f;
        }
        return b;
    }

    /** 3x3 腐蚀（白底黑线：AND） */
    private static boolean[] erode(boolean[] in, int w, int h) {
        int n = w * h;
        boolean[] out = new boolean[n];
        for (int y = 0; y < h; y++) {
            int y0 = Math.max(0, y - 1), y1 = Math.min(h - 1, y + 1);
            for (int x = 0; x < w; x++) {
                int x0 = Math.max(0, x - 1), x1 = Math.min(w - 1, x + 1);
                boolean v = true;
                outer:
                for (int yy = y0; yy <= y1; yy++)
                    for (int xx = x0; xx <= x1; xx++)
                        if (!in[yy * w + xx]) { v = false; break outer; }
                out[y * w + x] = v;
            }
        }
        return out;
    }

    /** 3x3 膨胀（白底黑线：膨胀黑线即 OR） */
    private static boolean[] dilate(boolean[] in, int w, int h) {
        int n = w * h;
        boolean[] out = new boolean[n];
        for (int y = 0; y < h; y++) {
            int y0 = Math.max(0, y - 1), y1 = Math.min(h - 1, y + 1);
            for (int x = 0; x < w; x++) {
                int x0 = Math.max(0, x - 1), x1 = Math.min(w - 1, x + 1);
                boolean v = false;
                outer:
                for (int yy = y0; yy <= y1; yy++)
                    for (int xx = x0; xx <= x1; xx++)
                        if (in[yy * w + xx]) { v = true; break outer; }
                out[y * w + x] = v;
            }
        }
        return out;
    }

    /**
     * 噪声清理：删除孤立小点。
     * 判定规则（保护细长线段，只删点状/碎屑噪声）：
     *  - 面积 < hardMin：直接删除（微小噪点）
     *  - 面积 < softMin 且包围盒宽、高均 <= dotSize：点状碎屑，删除
     *  - 细长线段（包围盒任一维超过 dotSize）即使面积小也保留
     */
    private static void removeSmallComponents(boolean[] ink, int w, int h, int softMin, int hardMin, int dotSize) {
        int n = w * h;
        int[] stack = new int[n];
        int[] label = new int[n];
        java.util.Arrays.fill(label, -1);
        int nextLabel = 0;
        for (int i = 0; i < n; i++) {
            if (!ink[i] || label[i] >= 0) continue;
            int lab = nextLabel++;
            int top = 0;
            int minX = Integer.MAX_VALUE, maxX = 0, minY = Integer.MAX_VALUE, maxY = 0;
            stack[top++] = i;
            label[i] = lab;
            while (top > 0) {
                int c = stack[--top];
                int cx = c % w, cy = c / w;
                if (cx < minX) minX = cx;
                if (cx > maxX) maxX = cx;
                if (cy < minY) minY = cy;
                if (cy > maxY) maxY = cy;
                for (int dy = -1; dy <= 1; dy++) {
                    int ny = cy + dy;
                    if (ny < 0 || ny >= h) continue;
                    for (int dx = -1; dx <= 1; dx++) {
                        int nx = cx + dx;
                        if (nx < 0 || nx >= w) continue;
                        int ni = ny * w + nx;
                        if (ink[ni] && label[ni] < 0) {
                            label[ni] = lab;
                            stack[top++] = ni;
                        }
                    }
                }
            }
            // stack[0..top) 即该域全部成员（pop 过的仍留在数组中）
            int area = top;
            boolean remove;
            if (area < hardMin) remove = true;
            else if (area < softMin) {
                int bw = maxX - minX + 1, bh = maxY - minY + 1;
                remove = bw <= dotSize && bh <= dotSize;
            } else remove = false;
            if (remove) {
                for (int j = 0; j < top; j++) ink[stack[j]] = false;
            }
        }
    }

    /** 清理参数：{softMin, hardMin, dotSize}，按图像面积缩放 */
    private static int[] cleanParams(Params p, int n) {
        float scale = (float) Math.sqrt(n / 1_000_000.0);   // 线性尺寸缩放
        float sf = Math.max(1f, scale);
        int dot = Math.round((4f + p.clean * 0.10f) * sf);                 // 4..14 @1MP
        int hard = Math.round((3f + p.clean * 0.09f) * sf);                // 3..12
        int soft = Math.round((float) (Math.pow(p.clean / 100.0, 1.4) * 1600.0 * (n / 1_000_000.0)) + 16);
        return new int[]{soft, hard, dot};
    }

    /** 可分离高斯模糊 */
    public static float[] gaussianBlur(float[] src, int w, int h, float sigma) {
        if (sigma < 0.3f) return src.clone();
        int r = Math.max(1, (int) Math.ceil(sigma * 2.5f));
        int k = 2 * r + 1;
        float[] kernel = new float[k];
        float s2 = 2 * sigma * sigma, sum = 0;
        for (int i = 0; i < k; i++) {
            float d = i - r;
            kernel[i] = (float) Math.exp(-d * d / s2);
            sum += kernel[i];
        }
        for (int i = 0; i < k; i++) kernel[i] /= sum;
        int n = w * h;
        float[] tmp = new float[n];
        float[] dst = new float[n];
        // horizontal
        for (int y = 0; y < h; y++) {
            int row = y * w;
            for (int x = 0; x < w; x++) {
                float acc = 0;
                for (int j = -r; j <= r; j++) {
                    int xx = Math.min(w - 1, Math.max(0, x + j));
                    acc += src[row + xx] * kernel[j + r];
                }
                tmp[row + x] = acc;
            }
        }
        // vertical
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                float acc = 0;
                for (int j = -r; j <= r; j++) {
                    int yy = Math.min(h - 1, Math.max(0, y + j));
                    acc += tmp[yy * w + x] * kernel[j + r];
                }
                dst[y * w + x] = acc;
            }
        }
        return dst;
    }

    /** 近似分位数（采样以提速） */
    static float percentile(float[] data, float q) {
        int step = Math.max(1, data.length / 20000);
        int cnt = 0;
        for (int i = 0; i < data.length; i += step) cnt++;
        float[] sample = new float[cnt];
        int idx = 0;
        for (int i = 0; i < data.length; i += step) sample[idx++] = data[i];
        java.util.Arrays.sort(sample);
        int pos = (int) (q * (sample.length - 1));
        return sample[pos];
    }
}
