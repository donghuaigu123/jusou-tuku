package com.donghuaigu.jusou;

import java.util.LinkedHashMap;
import java.util.Map;

/** 一条聚合后的图片结果。 */
public final class ImageItem {
    public String id = "";
    public String title = "";
    public String source = "";          // 源 key，如 bing / sogou / openverse
    public String sourceName = "";      // 源显示名
    public String thumbUrl = "";        // 缩略图地址
    public String fullUrl = "";         // 原图地址
    public String pageUrl = "";         // 来源网页
    public String width = "";
    public String height = "";
    public String license = "";         // 开放图库的授权信息
    public int rank;                    // 在该源内的名次（0 起）
    public long rawPopularity;          // 源提供的热度（浏览/下载/点赞），没有则为 0
    public int multiSourceHits = 1;     // 被多少个源同时命中（多源命中 = 更热门）
    public double relevance;            // 0..1 贴近搜索词
    public double popularity;           // 0..1 热门程度
    public double score;                // 0..1 综合分

    public Map<String, Object> toMap() {
        Map<String, Object> m = new LinkedHashMap<String, Object>();
        m.put("id", id);
        m.put("title", title);
        m.put("source", source);
        m.put("sourceName", sourceName);
        m.put("thumb", thumbUrl);
        m.put("full", fullUrl);
        m.put("page", pageUrl);
        m.put("width", width);
        m.put("height", height);
        m.put("license", license);
        m.put("rank", rank);
        m.put("rawPopularity", rawPopularity);
        m.put("relevance", round(relevance));
        m.put("popularity", round(popularity));
        m.put("score", round(score));
        return m;
    }

    private static double round(double v) { return Math.round(v * 1000.0) / 1000.0; }
}
