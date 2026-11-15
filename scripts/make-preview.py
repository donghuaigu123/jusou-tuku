#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 App 内 assets 打包成一个可在浏览器直接打开的单文件演示页。

演示页注入 JUSOU_DEMO，使用模拟数据，便于在没有 Android 设备时查看界面与交互。
用法：python3 scripts/make-preview.py [输出路径]
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
  background:linear-gradient(90deg,#FF5C8A,#7C6CFF);color:#fff;font-size:11.5px;
  text-align:center;padding:5px 10px;letter-spacing:.2px;box-shadow:0 2px 10px rgba(0,0,0,.35)}
body{padding-top:26px}
.page{padding-top:calc(42px + var(--safe-t))}
.viewer{top:26px}
</style>
"""
html = html.replace("</head>", banner_css + "</head>")

demo = """
<div class="demo-banner">浏览器演示模式 · 展示模拟数据；真机 APK 内会并发检索 13 个真实图源</div>
<script>window.JUSOU_DEMO = true;</script>
<script>
""" + js + """
</script>
<script>
window.addEventListener('load', function () {
  setTimeout(function () {
    try {
      var q = document.querySelector('#q');
      if (q) { q.value = '纹身线稿 玫瑰'; document.querySelector('#btnSearch').click(); }
    } catch (e) {}
  }, 350);
});
</script>
"""
html = html.replace('<script src="/app.js"></script>', demo)

with open(OUT, "w", encoding="utf-8") as f:
    f.write(html)
print("已生成演示页:", OUT, "(%d 字符)" % len(html))
