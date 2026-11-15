#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 App 内 assets 打包成一个可在浏览器直接打开的单文件演示页。

演示页注入 JUSOU_DEMO，使用模拟数据；同时把「秒变线稿」工具页内联为
window.JUSOU_MIAOBIAN_HTML，供 iframe 以 srcdoc 加载，保证离线单文件也能
完整体验两套线稿工具。
用法：python3 scripts/make-preview.py [输出路径]
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "app", "src", "main", "assets")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "preview.html")


def read(name):
    with open(os.path.join(ASSETS, name), encoding="utf-8") as f:
        return f.read()


html = read("index.html")
css = read("app.css")
js = read("app.js")
miaobian = read("miaobian.html")

html = html.replace('<link rel="stylesheet" href="/app.css">', "<style>\n" + css + "\n</style>")

banner_css = """
<style>
.demo-banner{position:fixed;top:0;left:0;right:0;z-index:100;
  background:linear-gradient(90deg,#FF5C8A,#7C6CFF);color:#fff;font-size:11.5px;
  text-align:center;padding:5px 10px;letter-spacing:.2px;box-shadow:0 2px 10px rgba(0,0,0,.35)}
body{padding-top:26px}
.page{padding-top:calc(42px + var(--safe-t))}
#pageMiaobian{padding-top:calc(42px + var(--safe-t))}
#pageLineart{padding-top:calc(42px + var(--safe-t))}
.viewer{top:26px}
</style>
"""
html = html.replace("</head>", banner_css + "</head>")

# 把秒变线稿页面编码为 JS 字符串；转义 </script 避免提前闭合外层 script。
# ensure_ascii=True 同时规避 U+2028/U+2029 在 JS 字符串里的换行语义。
mb_payload = json.dumps(miaobian, ensure_ascii=True)
mb_payload = re.sub(r"</script", r"<\\/script", mb_payload, flags=re.IGNORECASE)

demo = (
    '<div class="demo-banner">浏览器演示 v3.0 · 模拟数据 · 300 张 / 13 图源 / 三线稿工具</div>\n'
    "<script>window.JUSOU_DEMO = true;\n"
    "window.JUSOU_MIAOBIAN_HTML = " + mb_payload + ";\n"
    "</script>\n"
    "<script>\n" + js + "\n</script>\n"
    "<script>\n"
    "window.addEventListener('load', function () {\n"
    "  setTimeout(function () {\n"
    "    try {\n"
    "      var q = document.querySelector('#q');\n"
    "      if (q) { q.value = '纹身线稿 玫瑰'; document.querySelector('#btnSearch').click(); }\n"
    "    } catch (e) {}\n"
    "  }, 350);\n"
    "});\n"
    "</script>\n"
)
html = html.replace('<script src="/app.js"></script>', demo)

with open(OUT, "w", encoding="utf-8") as f:
    f.write(html)
print("已生成演示页:", OUT, "(%d 字符)" % len(html))
