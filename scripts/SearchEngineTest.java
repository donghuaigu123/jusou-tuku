import com.donghuaigu.jusou.ImageItem;
import com.donghuaigu.jusou.SearchEngine;

import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Set;

/**
 * 桌面端集成测试：不依赖 Android，直接对真实图片源发起请求，
 * 验证解析 / 去重 / 相关度与热度打分 / 100 张截断。
 *
 * 用法：
 *   javac -encoding UTF-8 -d build/test Json.java Net.java ImageItem.java SearchEngine.java ../scripts/SearchEngineTest.java
 *   java -cp build/test SearchEngineTest 纹身
 */
public class SearchEngineTest {
    public static void main(String[] args) {
        String q = args.length > 0 ? args[0] : "纹身 线稿";
        Set<String> on = new HashSet<String>(Arrays.asList(
                "bing", "sogou", "so360", "baidu", "nasa"));
        System.out.println("搜索词: " + q);
        System.out.println("启用源: " + on);
        SearchEngine.Result r = SearchEngine.search(q, on, 100, true, new HashMap<String, String>());
        System.out.println("耗时: " + r.elapsedMs + " ms, 去重后: " + r.items.size() + " 张");
        System.out.println("--- 各源状态 ---");
        for (SearchEngine.SourceStat s : r.stats) {
            System.out.printf("  %-22s count=%-3d ms=%-6d %s%n",
                    s.name, s.count, s.ms, s.skipped ? "(跳过)" : s.error.isEmpty() ? "OK" : "ERR: " + s.error);
        }
        System.out.println("--- 综合排序 Top 8 ---");
        int n = 0;
        for (ImageItem i : r.items) {
            System.out.printf("  #%-2d score=%.3f rel=%.3f hot=%.3f multi=%d [%s] %s%n",
                    ++n, i.score, i.relevance, i.popularity, i.multiSourceHits,
                    i.sourceName, i.title);
            System.out.println("       full=" + clip(i.fullUrl));
            if (n >= 8) break;
        }
        if (r.items.isEmpty()) {
            System.out.println("!!! 未取到任何结果");
            System.exit(1);
        }
        System.out.println("=== 集成测试通过 ===");
    }

    private static String clip(String s) { return s.length() > 130 ? s.substring(0, 130) + "…" : s; }
}
