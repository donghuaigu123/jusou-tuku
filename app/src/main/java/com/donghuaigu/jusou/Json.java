package com.donghuaigu.jusou;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 极简 JSON 解析 / 序列化。纯 Java，零第三方依赖。
 * 之所以不用 org.json：让聚合引擎可以在桌面 JVM 上直接编译与集成测试，
 * 同时避免不同 Android 版本 org.json 的行为差异。
 */
public final class Json {
    private Json() {}

    /** 解析完整 JSON 文本。失败抛 IllegalArgumentException。 */
    public static Object parse(String s) {
        int[] used = new int[1];
        Object v = new Parser(s, 0).value(used);
        return v;
    }

    /**
     * 从 text 的 from 位置开始解析一个 JSON 值（用于从 HTML 里截取内联 JSON），
     * 返回解析结果，并把消耗的字符数写入 used[0]。
     */
    public static Object parsePrefix(String text, int from, int[] used) {
        return new Parser(text, from).value(used);
    }

    public static String stringify(Object o) {
        StringBuilder sb = new StringBuilder(256);
        write(sb, o);
        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> obj(Object o) {
        return o instanceof Map ? (Map<String, Object>) o : new LinkedHashMap<String, Object>();
    }

    @SuppressWarnings("unchecked")
    public static List<Object> arr(Object o) {
        return o instanceof List ? (List<Object>) o : new ArrayList<Object>();
    }

    public static String str(Object o) {
        if (o == null) return "";
        if (o instanceof String) return (String) o;
        if (o instanceof Number || o instanceof Boolean) return String.valueOf(o);
        return "";
    }

    public static int integer(Object o, int def) {
        if (o instanceof Number) return ((Number) o).intValue();
        if (o instanceof String) {
            try { return Integer.parseInt(((String) o).trim()); } catch (Exception ignored) {}
        }
        return def;
    }

    public static long lng(Object o, long def) {
        if (o instanceof Number) return ((Number) o).longValue();
        if (o instanceof String) {
            try { return Long.parseLong(((String) o).trim()); } catch (Exception ignored) {}
        }
        return def;
    }

    public static Object get(Object o, String... path) {
        Object cur = o;
        for (String p : path) {
            if (!(cur instanceof Map)) return null;
            cur = ((Map<?, ?>) cur).get(p);
        }
        return cur;
    }

    /** 把 &#39; &quot; &amp; &lt; &gt; &#123; 等 HTML 实体还原，用于解析 HTML 属性里的 JSON。 */
    public static String unescapeHtml(String s) {
        if (s == null || s.indexOf('&') < 0) return s == null ? "" : s;
        StringBuilder sb = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c != '&') { sb.append(c); continue; }
            int semi = s.indexOf(';', i);
            if (semi < 0 || semi - i > 10) { sb.append(c); continue; }
            String ent = s.substring(i + 1, semi);
            char r = 0;
            if (ent.equals("quot")) r = '"';
            else if (ent.equals("apos") || ent.equals("#39")) r = '\'';
            else if (ent.equals("amp")) r = '&';
            else if (ent.equals("lt")) r = '<';
            else if (ent.equals("gt")) r = '>';
            else if (ent.equals("nbsp")) r = ' ';
            else if (ent.startsWith("#x") || ent.startsWith("#X")) {
                try { r = (char) Integer.parseInt(ent.substring(2), 16); } catch (Exception ignored) {}
            } else if (ent.startsWith("#")) {
                try { r = (char) Integer.parseInt(ent.substring(1)); } catch (Exception ignored) {}
            }
            if (r != 0) { sb.append(r); i = semi; } else sb.append(c);
        }
        return sb.toString();
    }

    private static void write(StringBuilder sb, Object o) {
        if (o == null) { sb.append("null"); return; }
        if (o instanceof String) { writeString(sb, (String) o); return; }
        if (o instanceof Boolean || o instanceof Number) {
            // 避免 NaN / Infinity 产生非法 JSON（不用 Double.isFinite，兼容旧 Android）
            if (o instanceof Double) {
                double d = ((Double) o).doubleValue();
                if (Double.isNaN(d) || Double.isInfinite(d)) { sb.append("null"); return; }
            }
            if (o instanceof Float) {
                float f = ((Float) o).floatValue();
                if (Float.isNaN(f) || Float.isInfinite(f)) { sb.append("null"); return; }
            }
            sb.append(o); return;
        }
        if (o instanceof Map) {
            sb.append('{');
            boolean first = true;
            for (Map.Entry<?, ?> e : ((Map<?, ?>) o).entrySet()) {
                if (!first) sb.append(',');
                first = false;
                writeString(sb, String.valueOf(e.getKey()));
                sb.append(':');
                write(sb, e.getValue());
            }
            sb.append('}'); return;
        }
        if (o instanceof Iterable) {
            sb.append('[');
            boolean first = true;
            for (Object v : (Iterable<?>) o) {
                if (!first) sb.append(',');
                first = false;
                write(sb, v);
            }
            sb.append(']'); return;
        }
        writeString(sb, String.valueOf(o));
    }

    private static void writeString(StringBuilder sb, String s) {
        sb.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                case '\b': sb.append("\\b"); break;
                case '\f': sb.append("\\f"); break;
                default:
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
            }
        }
        sb.append('"');
    }

    private static final class Parser {
        private final String s;
        private int p;
        Parser(String s, int start) { this.s = s; this.p = start; }

        Object value(int[] used) {
            skipWs();
            if (p >= s.length()) throw new IllegalArgumentException("JSON 意外结束");
            char c = s.charAt(p);
            Object v;
            if (c == '{') v = object();
            else if (c == '[') v = array();
            else if (c == '"') v = string();
            else if (c == 't' || c == 'f') v = bool();
            else if (c == 'n') { expect("null"); v = null; }
            else v = number();
            used[0] = p;
            return v;
        }

        private Map<String, Object> object() {
            LinkedHashMap<String, Object> m = new LinkedHashMap<String, Object>();
            p++; // {
            skipWs();
            if (p < s.length() && s.charAt(p) == '}') { p++; return m; }
            while (p < s.length()) {
                skipWs();
                if (s.charAt(p) == '}') { p++; return m; }
                if (s.charAt(p) != '"') throw new IllegalArgumentException("对象键必须是字符串，位置 " + p);
                String k = string();
                skipWs();
                if (p >= s.length() || s.charAt(p) != ':') throw new IllegalArgumentException("缺少冒号，位置 " + p);
                p++;
                skipWs();
                m.put(k, value());
                skipWs();
                if (p < s.length() && s.charAt(p) == ',') { p++; continue; }
                if (p < s.length() && s.charAt(p) == '}') { p++; return m; }
                throw new IllegalArgumentException("对象格式错误，位置 " + p);
            }
            throw new IllegalArgumentException("对象未闭合");
        }

        private Object value() { return value(new int[1]); }

        private List<Object> array() {
            ArrayList<Object> a = new ArrayList<Object>();
            p++; // [
            skipWs();
            if (p < s.length() && s.charAt(p) == ']') { p++; return a; }
            while (p < s.length()) {
                a.add(value());
                skipWs();
                if (p < s.length() && s.charAt(p) == ',') { p++; continue; }
                if (p < s.length() && s.charAt(p) == ']') { p++; return a; }
                throw new IllegalArgumentException("数组格式错误，位置 " + p);
            }
            throw new IllegalArgumentException("数组未闭合");
        }

        private String string() {
            p++; // opening quote
            StringBuilder sb = new StringBuilder();
            while (p < s.length()) {
                char c = s.charAt(p++);
                if (c == '"') return sb.toString();
                if (c != '\\') { sb.append(c); continue; }
                if (p >= s.length()) break;
                char e = s.charAt(p++);
                switch (e) {
                    case '"': sb.append('"'); break;
                    case '\\': sb.append('\\'); break;
                    case '/': sb.append('/'); break;
                    case 'b': sb.append('\b'); break;
                    case 'f': sb.append('\f'); break;
                    case 'n': sb.append('\n'); break;
                    case 'r': sb.append('\r'); break;
                    case 't': sb.append('\t'); break;
                    case 'u':
                        if (p + 4 <= s.length()) {
                            try { sb.append((char) Integer.parseInt(s.substring(p, p + 4), 16)); }
                            catch (Exception ignored) { sb.append('\uFFFD'); }
                            p += 4;
                        }
                        break;
                    default: sb.append(e);
                }
            }
            return sb.toString();
        }

        private Object bool() {
            if (s.startsWith("true", p)) { p += 4; return Boolean.TRUE; }
            if (s.startsWith("false", p)) { p += 5; return Boolean.FALSE; }
            throw new IllegalArgumentException("无效字面量，位置 " + p);
        }

        private void expect(String lit) {
            if (!s.startsWith(lit, p)) throw new IllegalArgumentException("期望 " + lit + "，位置 " + p);
            p += lit.length();
        }

        private Object number() {
            int st = p;
            if (p < s.length() && s.charAt(p) == '-') p++;
            while (p < s.length() && Character.isDigit(s.charAt(p))) p++;
            boolean decimal = false;
            if (p < s.length() && s.charAt(p) == '.') {
                decimal = true; p++;
                while (p < s.length() && Character.isDigit(s.charAt(p))) p++;
            }
            if (p < s.length() && (s.charAt(p) == 'e' || s.charAt(p) == 'E')) {
                decimal = true; p++;
                if (p < s.length() && (s.charAt(p) == '+' || s.charAt(p) == '-')) p++;
                while (p < s.length() && Character.isDigit(s.charAt(p))) p++;
            }
            if (p == st) throw new IllegalArgumentException("无效数字，位置 " + p);
            String n = s.substring(st, p);
            try {
                if (!decimal) {
                    long l = Long.parseLong(n);
                    if (l >= Integer.MIN_VALUE && l <= Integer.MAX_VALUE) return (int) l;
                    return l;
                }
                return Double.parseDouble(n);
            } catch (Exception ex) { return 0; }
        }

        private void skipWs() {
            while (p < s.length()) {
                char c = s.charAt(p);
                if (c == ' ' || c == '\t' || c == '\n' || c == '\r' || c == '\uFEFF') p++;
                else break;
            }
        }
    }
}
