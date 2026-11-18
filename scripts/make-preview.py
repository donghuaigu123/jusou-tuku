#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 App 内 assets 打包成一个可在浏览器直接打开的单文件演示页（v4.0.1）。

演示页注入 JUSOU_DEMO，使用模拟数据；线稿生成的 5 模式演示算法已内联在
app.js 中，无需额外资源。用法：python3 scripts/make-preview.py [输出路径]
"""
import os
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

html = html.replace('<link rel="stylesheet" href="/app.css">', "<style>\n" + css + "\n</style>")

banner_css = """
<style>
.demo-banner{position:fixed;top:0;left:0;right:0;z-index:100;
  background:linear-gradient(90deg,#5B8DEF,#8B6CF0);color:#fff;font-size:11.5px;
  text-align:center;padding:5px 10px;letter-spacing:.2px;box-shadow:0 2px 10px rgba(0,0,0,.35)}
body{padding-top:26px}
.page{padding-top:calc(42px + var(--safe-t))}
.crop-layer{padding-top:26px}
.viewer{top:26px}
</style>
"""
html = html.replace("</head>", banner_css + "</head>")

demo = (
    '<div class="demo-banner">浏览器演示 v4.0.1 · 模拟数据 · 300 张 / 13 图源 / 线稿生成</div>\n'
    "<script>window.JUSOU_DEMO = true;</script>\n"
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
