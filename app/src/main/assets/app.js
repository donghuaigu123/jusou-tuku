/* 聚搜图库 · 前端逻辑 v4.0
 * 页面与 /api 同源（App 内本地服务），浏览器预览时走 JUSOU_DEMO 演示数据。
 * 线稿生成功能复刻自开源项目「线稿生成 LineArt Generator」(MIT)。
 */
(function () {
  'use strict';

  var DEMO = !!window.JUSOU_DEMO;
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var Native = (function () { try { return window.Android || {}; } catch (e) { return {}; } })();

  function native(name) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (Native[name]) return Native[name].apply(Native, args);
    toast('该能力需要在聚搜图库 App 内使用');
    return null;
  }

  // ---------------------------------------------------------------- API 层
  function apiGet(path) {
    if (DEMO) return Promise.resolve(demoGet(path));
    return fetch(path).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function apiPost(path, body) {
    if (DEMO) return Promise.resolve(demoPost(path, body));
    return fetch(path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function imgUrl(u, ref) {
    if (!u) return '';
    if (DEMO) return demoSvg(u);
    return '/api/img?u=' + encodeURIComponent(u) + (ref ? '&ref=' + encodeURIComponent(ref) : '');
  }

  // ---------------------------------------------------------------- 演示数据
  var HOT = ['纹身线稿', '玫瑰花纹身手稿', '风景壁纸 4K', '橘猫 特写', '赛博朋克 城市',
    '水墨山水', '极简 Logo', '美食摄影', '复古海报', '星空 银河'];
  var SRC_NAMES = ['必应图片', '搜狗图片', '360 图片', '百度图片', 'Openverse', 'Wikimedia Commons', 'Flickr'];
  var SRC_KEYS = ['bing', 'sogou', 'so360', 'baidu', 'openverse', 'wikimedia', 'flickr'];
  var DEMO_SOURCES = [
    { key: 'bing', name: '必应图片', kind: 'engine', needsKey: false },
    { key: 'sogou', name: '搜狗图片', kind: 'engine', needsKey: false },
    { key: 'so360', name: '360 图片', kind: 'engine', needsKey: false },
    { key: 'baidu', name: '百度图片', kind: 'engine', needsKey: false },
    { key: 'duckduckgo', name: 'DuckDuckGo', kind: 'engine', needsKey: false },
    { key: 'google', name: 'Google 图片', kind: 'engine', needsKey: false },
    { key: 'openverse', name: 'Openverse', kind: 'library', needsKey: false },
    { key: 'wikimedia', name: 'Wikimedia Commons', kind: 'library', needsKey: false },
    { key: 'flickr', name: 'Flickr', kind: 'library', needsKey: false },
    { key: 'nasa', name: 'NASA 图库', kind: 'library', needsKey: false },
    { key: 'pixabay', name: 'Pixabay', kind: 'library', needsKey: true },
    { key: 'pexels', name: 'Pexels', kind: 'library', needsKey: true },
    { key: 'unsplash', name: 'Unsplash', kind: 'library', needsKey: true }
  ];

  function hashCode(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  /** 生成一张有真实视觉内容的 SVG 占位图（演示/加载失败时使用）。 */
  function demoSvg(seed) {
    var h = hashCode(String(seed));
    var hue = h % 360, hue2 = (hue + 55) % 360;
    var r = 40 + (h % 60), cx = 25 + (h % 50), cy = 20 + (h % 40);
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="530" viewBox="0 0 400 530">'
      + '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
      + '<stop offset="0" stop-color="hsl(' + hue + ',68%,58%)"/>'
      + '<stop offset="1" stop-color="hsl(' + hue2 + ',62%,38%)"/></linearGradient></defs>'
      + '<rect width="400" height="530" fill="url(#g)"/>'
      + '<circle cx="' + (cx * 4) + '" cy="' + (cy * 4) + '" r="' + r + '" fill="rgba(255,255,255,.28)"/>'
      + '<circle cx="' + (400 - cx * 3) + '" cy="' + (530 - cy * 3) + '" r="' + (r * 1.6) + '" fill="rgba(0,0,0,.12)"/>'
      + '<path d="M0 400 L110 270 L190 350 L270 240 L400 400 L400 530 L0 530 Z" fill="rgba(10,14,30,.32)"/>'
      + '<path d="M0 460 L140 350 L240 440 L330 360 L400 430 L400 530 L0 530 Z" fill="rgba(10,14,30,.22)"/>'
      + '<rect x="18" y="18" width="86" height="26" rx="13" fill="rgba(0,0,0,.35)"/>'
      + '<text x="61" y="36" fill="#fff" font-size="13" text-anchor="middle" font-family="sans-serif">聚搜图库</text>'
      + '<text x="200" y="500" fill="rgba(255,255,255,.65)" font-size="15" text-anchor="middle" font-family="sans-serif">DEMO · ' + (h % 1000) + '</text>'
      + '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  function demoItems(q) {
    var arr = [], n = 60;
    for (var i = 0; i < n; i++) {
      var k = i % SRC_KEYS.length;
      var rel = 0.35 + ((hashCode(q + i) % 60) / 100);
      var hot = 0.3 + ((hashCode('h' + q + i) % 65) / 100);
      var u = 'demo://' + q + '/' + i;
      arr.push({
        id: 'd' + i, title: (q || '图片') + ' · ' + ['高清素材', '精选合集', '创意灵感', '手绘线稿', '摄影作品', '设计参考'][i % 6] + ' ' + (i + 1),
        source: SRC_KEYS[k], sourceName: SRC_NAMES[k],
        thumb: u, full: u, page: 'https://example.com/item/' + i,
        width: String(600 + (i % 5) * 200), height: String(800 + (i % 4) * 200),
        license: k >= 4 ? 'CC 授权' : '', rank: i,
        relevance: Math.min(1, rel), popularity: Math.min(1, hot),
        score: Math.min(1, 0.55 * rel + 0.45 * hot)
      });
    }
    return arr;
  }
  function demoGet(path) {
    if (path.indexOf('/api/sources') === 0) return { sources: DEMO_SOURCES };
    if (path.indexOf('/api/settings') === 0) return {
      ok: true, dirLabel: '系统下载 / 聚搜图库（演示）', hasCustomDir: false, subdir: '聚搜图库',
      limit: 300, safe: true, sort: 'score', maxResults: 300,
      sources: SRC_KEYS, keys: { pixabay: false, pexels: false, unsplash: false }
    };
    if (path.indexOf('/api/app') === 0) return { ok: true, name: '聚搜图库', version: '4.0.0', maxResults: 300 };
    if (path.indexOf('/api/search') === 0) {
      var m = /[?&]q=([^&]*)/.exec(path);
      var q = m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
      var items = demoItems(q);
      return {
        ok: true, query: q, total: items.length, elapsedMs: 780, items: items,
        stats: SRC_NAMES.map(function (n, i) {
          return { key: SRC_KEYS[i], name: n, count: i === 1 ? 0 : 5 + i, ms: 300 + i * 90,
            error: i === 1 ? '演示：模拟一个源失败' : '', skipped: false };
        })
      };
    }
    if (path.indexOf('/api/download') === 0) return { ok: true, path: '下载/聚搜图库/演示图片.jpg' };
    if (path.indexOf('/api/clear-cache') === 0) return { ok: true, cleared: 12 };
    return { ok: true };
  }
  function demoPost(path, body) {
    if (path.indexOf('/api/lineartgen') === 0 && body && body.image) return demoLineartGen(body.image, body);
    return { ok: true };
  }

  // ---------------------------------------------------------------- 演示态：线稿生成 5 模式近似算法
  // 真机由 Java 端 LineArtEngine 精确计算（Canny / XDoG / 自适应阈值 + 连通域去噪）。
  function gauss(src, w, h, sigma) {
    if (sigma < 0.3) return src.slice();
    var r = Math.max(1, Math.ceil(sigma * 2.5)), k = 2 * r + 1;
    var kern = new Float32Array(k), sum = 0;
    for (var i = 0; i < k; i++) { var d = i - r; kern[i] = Math.exp(-d * d / (2 * sigma * sigma)); sum += kern[i]; }
    for (var i = 0; i < k; i++) kern[i] /= sum;
    var n = w * h, tmp = new Float32Array(n), dst = new Float32Array(n);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var a = 0;
      for (var j = -r; j <= r; j++) { var xx = Math.min(w - 1, Math.max(0, x + j)); a += src[y * w + xx] * kern[j + r]; }
      tmp[y * w + x] = a;
    }
    for (var y2 = 0; y2 < h; y2++) for (var x2 = 0; x2 < w; x2++) {
      var b = 0;
      for (var j2 = -r; j2 <= r; j2++) { var yy = Math.min(h - 1, Math.max(0, y2 + j2)); b += tmp[yy * w + x2] * kern[j2 + r]; }
      dst[y2 * w + x2] = b;
    }
    return dst;
  }
  function dilate(mask, w, h) {
    var n = w * h, dst = new Uint8Array(n);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var v = 0;
      outer:
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        var nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < w && ny >= 0 && ny < h && mask[ny * w + nx]) { v = 1; break outer; }
      }
      dst[y * w + x] = v;
    }
    return dst;
  }
  function erode(mask, w, h) {
    var n = w * h, dst = new Uint8Array(n);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var v = 1;
      outer:
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        var nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h || !mask[ny * w + nx]) { v = 0; break outer; }
      }
      dst[y * w + x] = v;
    }
    return dst;
  }
  function demoLineartGen(dataUrl, o) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        try {
          var iw = img.naturalWidth || img.width || 400, ih = img.naturalHeight || img.height || 500;
          var sx = 0, sy = 0, sw = iw, sh = ih;
          var crop = o.crop;
          if (crop && crop.w > 50 && crop.h > 50 && crop.x >= 0 && crop.y >= 0
              && crop.x + crop.w <= 1001 && crop.y + crop.h <= 1001) {
            sx = Math.round(crop.x / 1000 * iw); sy = Math.round(crop.y / 1000 * ih);
            sw = Math.max(1, Math.round(crop.w / 1000 * iw)); sh = Math.max(1, Math.round(crop.h / 1000 * ih));
          }
          var W = Math.min(460, sw), H = Math.max(1, Math.round(W * sh / sw));
          var c = document.createElement('canvas'); c.width = W; c.height = H;
          var ctx = c.getContext('2d');
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
          var p = ctx.getImageData(0, 0, W, H).data, n = W * H;
          var g = new Float32Array(n);
          for (var i = 0, j = 0; i < p.length; i += 4, j++) g[j] = (p[i] * .299 + p[i + 1] * .587 + p[i + 2] * .114) / 255;

          var mode = o.mode | 0, detail = o.detail || 55, ink = o.ink || 50;
          var clean = o.clean == null ? 50 : o.clean, thick = o.thickness || 0;
          var mask = new Uint8Array(n), grayInk = null, isGray = (mode === 3);

          if (mode === 4) {
            // 黑白块面：积分图局部自适应阈值，亮部→黑块
            var sigB = 0.8 + (100 - detail) * 0.02;
            var blur = gauss(g, W, H, sigB);
            var sum = new Float64Array(n + 1);
            for (var q = 0; q < n; q++) sum[q + 1] = sum[q] + blur[q];
            var win = Math.max(15, Math.min(W, H) / 8) | 1, rad = (win / 2) | 0;
            var C = 0.04 + ink * 0.00055;
            for (var y = 0; y < H; y++) {
              var y0 = Math.max(0, y - rad), y1 = Math.min(H - 1, y + rad);
              for (var x = 0; x < W; x++) {
                var x0 = Math.max(0, x - rad), x1 = Math.min(W - 1, x + rad);
                var s = sum[y1 * W + x1 + 1] - sum[y0 * W + x1 + 1] - sum[y1 * W + x0] + sum[y0 * W + x0];
                var cnt = (y1 - y0 + 1) * (x1 - x0 + 1);
                var mean = s / cnt;
                mask[y * W + x] = blur[y * W + x] > mean + C ? 1 : 0;
              }
            }
          } else if (mode === 3) {
            // 素描排线：XDoG 高斯差分 + 软阈值，保留灰调质感
            var sigS = 0.5 + (100 - detail) * 0.012;
            var g1 = gauss(g, W, H, sigS), g2 = gauss(g, W, H, sigS * 1.6);
            var pp = 21, eps = 0.04 - ink * 0.0003, phi = 6 + clean * 0.10;
            grayInk = new Float32Array(n);
            for (var k = 0; k < n; k++) {
              var v = (1 + pp) * g1[k] - pp * g2[k];
              var t = v >= eps ? 1 : Math.max(0, 1 + Math.tanh(phi * (v - eps)));
              grayInk[k] = Math.min(1, t * 1.4);
            }
          } else {
            // Canny 类：高斯 + Sobel 梯度 + 阈值（局部均值差分兜底，兼容平滑占位图）
            var sigma = 0.55 + (100 - detail) * 0.012;
            if (mode === 1) sigma *= 1.2;
            if (mode === 2) sigma *= 1.6;
            var blur2 = gauss(g, W, H, sigma);
            var grad = new Float32Array(n), mx = 0;
            for (var yy = 1; yy < H - 1; yy++) for (var xx = 1; xx < W - 1; xx++) {
              var id = yy * W + xx;
              var gx = (blur2[id + 1] - blur2[id - 1]);
              var gy = (blur2[id + W] - blur2[id - W]);
              var m2 = Math.sqrt(gx * gx + gy * gy);
              // 局部均值差分（3x3 步长）
              var sumv = 0, cntv = 0;
              for (var dy = -2; dy <= 2; dy += 2) for (var dx = -2; dx <= 2; dx += 2) {
                var ax = xx + dx, ay = yy + dy;
                if (ax >= 0 && ax < W && ay >= 0 && ay < H) { sumv += blur2[ay * W + ax]; cntv++; }
              }
              var diff = Math.abs(sumv / cntv - blur2[id]);
              var val = Math.max(m2 * 0.9, diff * 1.1);
              grad[id] = val; if (val > mx) mx = val;
            }
            if (mx <= 0) mx = 1;
            var thr = mx * (0.42 - ink * 0.0028);
            if (mode === 0) thr *= 1.15; // 白描：更细
            if (mode === 2) thr *= 0.72; // 粗线：更多线
            for (var k2 = 0; k2 < n; k2++) mask[k2] = grad[k2] > thr ? 1 : 0;
            if (o.darkBgSuppression) {
              var bright = gauss(g, W, H, 3);
              for (var k3 = 0; k3 < n; k3++) if (mask[k3] && bright[k3] < 0.24) mask[k3] = 0;
            }
          }

          if (!isGray) {
            // 背景净化：clean 高 → 腐蚀一次去孤立点（轻）
            if (clean >= 70) mask = erode(mask, W, H);
            // 形态学闭运算连接断线
            mask = dilate(mask, W, H); mask = erode(mask, W, H);
            var dil = thick + (mode === 2 ? 1 : 0);
            for (var t = 0; t < dil; t++) mask = dilate(mask, W, H);
          } else {
            // 素描也支持加粗：对灰调做一次近似膨胀
            for (var tg = 0; tg < thick; tg++) {
              var ng = new Float32Array(n);
              for (var yg = 0; yg < H; yg++) for (var xg = 0; xg < W; xg++) {
                var best = grayInk[yg * W + xg];
                for (var ddy = -1; ddy <= 1; ddy++) for (var ddx = -1; ddx <= 1; ddx++) {
                  var nxg = xg + ddx, nyg = yg + ddy;
                  if (nxg >= 0 && nxg < W && nyg >= 0 && nyg < H) best = Math.max(best, grayInk[nyg * W + nxg] * 0.92);
                }
                ng[yg * W + xg] = best;
              }
              grayInk = ng;
            }
          }

          var out = ctx.createImageData(W, H), od = out.data;
          for (var m = 0; m < n; m++) {
            var inkVal = isGray ? grayInk[m] : (mask[m] ? 1 : 0);
            var v2 = Math.round((1 - inkVal) * 255);
            if (o.invert) v2 = 255 - v2;
            var o4 = m * 4; od[o4] = od[o4 + 1] = od[o4 + 2] = v2; od[o4 + 3] = 255;
          }
          ctx.putImageData(out, 0, 0);
          resolve({ ok: true, image: c.toDataURL('image/png'), width: W, height: H, mode: mode });
        } catch (e) { reject(e); }
      };
      img.onerror = function () { reject(new Error('图片加载失败')); };
      img.src = dataUrl;
    });
  }

  // ---------------------------------------------------------------- 状态
  var state = {
    tab: 'search', query: '', items: [], sorted: [], sort: 'score',
    sources: [], enabled: {}, settings: {}, viewerIndex: 0, lastBack: 0,
    lineart: {
      image: '', result: '', mode: 'result', algo: 1,
      detail: 55, thickness: 1, ink: 50, clean: 50,
      invert: false, darkBgSuppression: false, crop: null,
      width: 0, height: 0
    },
    downloads: [], pendingTool: '',
    scroll: { search: 0, lineart: 0, downloads: 0, settings: 0 }
  };
  try { state.downloads = JSON.parse(localStorage.getItem('jusou_downloads') || '[]'); } catch (e) {}

  // ---------------------------------------------------------------- 通用 UI
  var toastTimer;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2300);
  }
  function busy(on, text) {
    $('#busy').classList.toggle('hidden', !on);
    if (text) $('#busyText').textContent = text;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtTime(ts) {
    var d = new Date(ts), p = function (n) { return n < 10 ? '0' + n : n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  // ---------------------------------------------------------------- 搜索
  function applySort() {
    var k = state.sort;
    state.sorted = state.items.slice().sort(function (a, b) { return (b[k] || 0) - (a[k] || 0); });
  }
  function renderStatus(r) {
    var el = $('#status');
    if (!r || !r.stats) { el.classList.add('hidden'); return; }
    var okCount = 0, fail = [];
    var lines = [];
    r.stats.forEach(function (s) {
      if (s.skipped) return;
      if (s.error) { fail.push(s.name); lines.push('<span class="bad">✕ ' + esc(s.name) + '</span>'); }
      else { okCount += s.count; lines.push('<span class="ok">✓ ' + esc(s.name) + ' ' + s.count + '</span>'); }
    });
    var sortName = { score: '综合推荐', popularity: '热门优先', relevance: '最贴题' }[state.sort];
    var html = '<b>' + (r.total || 0) + ' 张</b> 结果（去重后按「' + sortName + '」排序）· 耗时 ' + (r.elapsedMs || 0) + ' ms · ' + okCount + ' 条原始记录';
    if (fail.length) html += '<br>部分来源不可用：' + esc(fail.join('、')) + '（已自动跳过）';
    html += '<div class="stat-line">' + lines.join('') + '</div>';
    el.innerHTML = html;
    el.classList.remove('hidden');
  }
  function renderGrid() {
    var grid = $('#grid'); grid.innerHTML = '';
    if (!state.sorted.length) { $('#empty').classList.remove('hidden'); return; }
    $('#empty').classList.add('hidden');
    var frag = document.createDocumentFragment();
    state.sorted.forEach(function (it, idx) {
      var card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = '<div class="fallback">图片加载中…</div>'
        + '<img alt="" loading="lazy" data-idx="' + idx + '" src="' + esc(imgUrl(it.thumb || it.full, it.page || it.full)) + '">'
        + '<div class="shade"></div>'
        + '<span class="src">' + esc(it.sourceName || it.source) + '</span>'
        + (idx < 3 ? '<span class="rank">TOP ' + (idx + 1) + '</span>' : '')
        + '<div class="cap">' + esc(it.title || '未命名图片') + '</div>';
      card.addEventListener('click', function () { openViewer(idx); });
      var img = card.querySelector('img');
      var hideFallback = function () {
        var fb = card.querySelector('.fallback');
        if (fb) fb.style.display = 'none';
      };
      img.addEventListener('load', hideFallback);
      if (img.complete && img.naturalWidth > 0) hideFallback();
      img.addEventListener('error', function () {
        if (!this.dataset.fallback && it.full && it.full !== it.thumb) {
          this.dataset.fallback = '1';
          this.src = imgUrl(it.full, it.page || it.full);
        } else {
          this.style.display = 'none';
          var fb = card.querySelector('.fallback'); if (fb) fb.textContent = '图片无法加载';
        }
      });
      frag.appendChild(card);
    });
    grid.appendChild(frag);
  }
  function doSearch(q) {
    q = (q || '').trim();
    if (!q) { toast('请先输入要搜索的图片内容'); return; }
    state.query = q;
    state.scroll.search = 0;
    window.scrollTo(0, 0);
    $('#q').value = q;
    $('#loading').classList.remove('hidden');
    $('#empty').classList.add('hidden');
    $('#grid').innerHTML = '';
    $('#status').classList.add('hidden');
    $('#btnSearch').disabled = true;
    apiGet('/api/search?q=' + encodeURIComponent(q)).then(function (r) {
      state.items = r.items || [];
      applySort(); renderGrid(); renderStatus(r);
      if (!state.items.length) toast('没有找到图片，换个关键词或检查网络');
    }).catch(function (e) {
      toast('搜索失败：' + e.message); $('#status').classList.add('hidden');
    }).then(function () {
      $('#loading').classList.add('hidden'); $('#btnSearch').disabled = false;
    });
  }

  // ---------------------------------------------------------------- 查看器
  function openViewer(i) {
    state.viewerIndex = Math.max(0, Math.min(state.sorted.length - 1, i));
    $('#viewer').classList.remove('hidden');
    renderViewer();
  }
  function closeViewer() { $('#viewer').classList.add('hidden'); $('#vImage').classList.remove('zoomed'); }
  function renderViewer() {
    var it = state.sorted[state.viewerIndex]; if (!it) return;
    $('#vIndex').textContent = state.viewerIndex + 1;
    $('#vTotal').textContent = state.sorted.length;
    $('#vTitle').textContent = it.title || '未命名图片';
    $('#vSource').textContent = it.sourceName || it.source;
    $('#vSize').textContent = it.width && it.height ? it.width + ' × ' + it.height : '';
    $('#vLicense').textContent = it.license || '';
    $('#vRel').textContent = (it.relevance || 0).toFixed(2);
    $('#vHot').textContent = (it.popularity || 0).toFixed(2);
    $('#vScore').textContent = (it.score || 0).toFixed(2);
    var im = $('#vImage'); im.classList.remove('zoomed');
    im.dataset.fallback = '';
    im.src = imgUrl(it.full || it.thumb, it.page || it.full);
  }
  function viewerStep(d) {
    if (!state.sorted.length) return;
    state.viewerIndex = (state.viewerIndex + d + state.sorted.length) % state.sorted.length;
    renderViewer();
  }
  function blobToDataUrl(src) {
    if (DEMO && src.indexOf('data:') === 0) return Promise.resolve(src);
    return fetch(src).then(function (r) { return r.blob(); }).then(function (b) {
      return new Promise(function (res, rej) {
        var fr = new FileReader(); fr.onload = function () { res(fr.result); };
        fr.onerror = rej; fr.readAsDataURL(b);
      });
    });
  }
  function imageToDataUrl(u, ref) { return blobToDataUrl(imgUrl(u, ref)); }
  function addDownload(record) {
    state.downloads.unshift(record);
    if (state.downloads.length > 100) state.downloads.length = 100;
    try { localStorage.setItem('jusou_downloads', JSON.stringify(state.downloads)); } catch (e) {}
  }
  function fileNameFor(it) {
    var q = (state.query || '图片').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 24);
    return q + '_' + (state.viewerIndex + 1) + '_' + (it.source || 'img');
  }
  function downloadCurrent() {
    var it = state.sorted[state.viewerIndex]; if (!it) return;
    busy(true, '正在下载图片…');
    var name = fileNameFor(it);
    var url = '/api/download?u=' + encodeURIComponent(it.full || it.thumb)
      + '&name=' + encodeURIComponent(name) + '&ref=' + encodeURIComponent(it.page || it.full || '');
    apiGet(url).then(function (r) {
      addDownload({ name: name, path: r.path || '已保存', thumb: it.thumb || it.full,
        time: Date.now(), source: it.sourceName });
      toast('已保存到 ' + (r.path || '下载目录'));
      if (Native.toast) Native.toast('图片已保存：' + (r.path || ''));
    }).catch(function (e) { toast('下载失败：' + e.message); })
      .then(function () { busy(false); });
  }

  // ---------------------------------------------------------------- 线稿生成工作台
  var MODE_PRESETS = {
    0: { detail: 72, thickness: 1, ink: 55, clean: 60 },
    1: { detail: 55, thickness: 1, ink: 50, clean: 50 },
    2: { detail: 40, thickness: 1, ink: 38, clean: 60 },
    3: { detail: 65, thickness: 0, ink: 55, clean: 45 },
    4: { detail: 50, thickness: 0, ink: 35, clean: 50 }
  };
  function updateSteps(active, allDone) {
    [1, 2, 3].forEach(function (n) {
      var el = $('.step[data-step="' + n + '"]');
      if (!el) return;
      el.classList.toggle('active', !allDone && n === active);
      el.classList.toggle('done', allDone || n < active);
    });
  }
  function setLineartImage(dataUrl) {
    state.lineart.image = dataUrl;
    state.lineart.result = '';
    state.lineart.crop = null;
    $('#laOriginal').src = dataUrl;
    $('#laCompareA').src = dataUrl;
    $('#laPlaceholder').classList.add('hidden');
    $('#btnLaCrop').disabled = false;
    updateSteps(2);
    generateLineart();
  }
  function renderLineartStage() {
    var s = state.lineart, mode = s.mode, has = !!s.result;
    if (!s.image) {
      ['#laOriginal', '#laResult', '#laCompare', '#laBadge', '#laHint'].forEach(function (k) { $(k).classList.add('hidden'); });
      $('#laPlaceholder').classList.remove('hidden');
      return;
    }
    $('#laPlaceholder').classList.add('hidden');
    $('#laOriginal').classList.toggle('hidden', !(mode === 'original' || !has));
    $('#laResult').classList.toggle('hidden', !(mode === 'result' && has));
    $('#laCompare').classList.toggle('hidden', !(mode === 'compare' && has));
    $('#laBadge').classList.toggle('hidden', !s.image);
    $('#laHint').classList.toggle('hidden', !(has && mode === 'compare'));
    $('#laBadge').textContent = ({ original: '原图', result: '线稿', compare: '拖动分割线对比' })[mode];
    $('#laOriginal').src = s.image;
    if (has) {
      $('#laResult').src = s.result;
      $('#laCompareA').src = s.image;
      $('#laCompareB').src = s.result;
    }
    $$('#laModes button').forEach(function (b) { b.classList.toggle('active', b.dataset.mode === mode); });
  }
  var laTimer;
  function scheduleLaRegen() {
    clearTimeout(laTimer);
    laTimer = setTimeout(generateLineart, 450);
  }
  function generateLineart() {
    var s = state.lineart;
    if (!s.image) { toast('请先选择一张图片'); return; }
    busy(true, '正在生成线稿…');
    $('#laStatus').textContent = '灰度化 → 高斯平滑 → 边缘检出 → 二值化 → 连通域去噪 → 形态学加粗（本机计算）';
    var payload = {
      image: s.image, mode: s.algo, detail: s.detail, thickness: s.thickness,
      ink: s.ink, clean: s.clean, invert: s.invert,
      darkBgSuppression: s.darkBgSuppression, crop: s.crop
    };
    var p = DEMO ? demoLineartGen(s.image, payload) : apiPost('/api/lineartgen', payload).then(function (r) {
      if (!r.ok && r.error) throw new Error(r.error);
      return r;
    });
    p.then(function (r) {
      s.result = r.image; s.width = r.width || 0; s.height = r.height || 0; s.mode = 'result';
      renderLineartStage(); updateSteps(3, true);
      $('#laStatus').textContent = '线稿已生成：' + s.width + '×' + s.height + ' · '
        + (s.invert ? '白线黑底' : '纯白底 + 纯黑线') + ' · 长按看原图，拖动分割线对比。';
    }).catch(function (e) { toast('生成失败：' + e.message); })
      .then(function () { busy(false); });
  }
  function saveLineart() {
    var s = state.lineart;
    if (!s.result) { toast('请先生成线稿'); return; }
    var name = '线稿生成_' + Date.now() + '.png';
    busy(true, '正在保存线稿 PNG…');
    if (DEMO) {
      var a = document.createElement('a'); a.href = s.result; a.download = name; a.click();
      addDownload({ name: name, path: '浏览器下载（演示）', thumb: s.result,
        time: Date.now(), source: '线稿生成' });
      toast('演示模式：已触发浏览器下载'); busy(false); return;
    }
    apiPost('/api/save-image', { image: s.result, name: name, mime: 'image/png' })
      .then(function (r) {
        addDownload({ name: name, path: r.path || '已保存', thumb: s.result,
          time: Date.now(), source: '线稿生成' });
        toast('已保存：' + (r.path || ''));
        if (Native.toast) Native.toast('底稿已保存：' + name);
      }).catch(function (e) { toast('保存失败：' + e.message); })
      .then(function () { busy(false); });
  }
  function lineartFromViewer() {
    var it = state.sorted[state.viewerIndex]; if (!it) return;
    busy(true, '正在读取图片…');
    imageToDataUrl(it.full || it.thumb, it.page || it.full).then(function (dataUrl) {
      closeViewer();
      switchTab('lineart');
      setLineartImage(dataUrl);
      toast('已送入「线稿生成」');
    }).catch(function (e) { toast('读取图片失败：' + e.message); })
      .then(function () { busy(false); });
  }
  function applyPreset(mode) {
    var pre = MODE_PRESETS[mode] || MODE_PRESETS[1];
    state.lineart.algo = mode;
    state.lineart.detail = pre.detail; state.lineart.thickness = pre.thickness;
    state.lineart.ink = pre.ink; state.lineart.clean = pre.clean;
    $('#laDetail').value = pre.detail; $('#laDetailVal').textContent = pre.detail;
    $('#laThick').value = pre.thickness; $('#laThickVal').textContent = pre.thickness;
    $('#laInk').value = pre.ink; $('#laInkVal').textContent = pre.ink;
    $('#laClean').value = pre.clean; $('#laCleanVal').textContent = pre.clean;
    $$('#laModes5 button').forEach(function (b) { b.classList.toggle('active', parseInt(b.dataset.v, 10) === mode); });
  }

  // ---------------------------------------------------------------- 裁剪选区
  var crop = { rect: { x: 0, y: 0, w: 0, h: 0 }, drag: null, loaded: false };
  function openCrop() {
    var s = state.lineart;
    if (!s.image) { toast('请先选择一张图片'); return; }
    $('#cropLayer').classList.remove('hidden');
    crop.loaded = false;
    // 用 Image 对象拿到尺寸后把图画到 canvas
    var probe = new Image();
    probe.onload = function () {
      var iw = probe.naturalWidth || probe.width, ih = probe.naturalHeight || probe.height;
      var maxBox = Math.min(window.innerWidth - 40, window.innerHeight - 210);
      var scale = Math.min(maxBox / iw, maxBox / ih, 1);
      var cw = Math.max(1, Math.round(iw * scale)), chh = Math.max(1, Math.round(ih * scale));
      var cv = $('#cropCanvas'); cv.width = cw; cv.height = chh;
      cv.style.width = cw + 'px'; cv.style.height = chh + 'px';
      var cx = cv.getContext('2d'); cx.clearRect(0, 0, cw, chh); cx.drawImage(probe, 0, 0, cw, chh);
      crop.loaded = true;
      crop.rect = { x: cw * 0.06, y: chh * 0.06, w: cw * 0.88, h: chh * 0.88 };
      syncCropBox();
      updateSteps(2);
    };
    probe.onerror = function () { toast('图片加载失败，无法裁剪'); closeCrop(); };
    probe.src = s.image;
  }
  function closeCrop() { $('#cropLayer').classList.add('hidden'); }
  function syncCropBox() {
    var cv = $('#cropCanvas'), box = $('#cropBox'), r = crop.rect;
    if (!cv || !box) return;
    var off = cv.getBoundingClientRect(), wrap = $('#cropWrap').getBoundingClientRect();
    var left = (off.left - wrap.left) + r.x, top = (off.top - wrap.top) + r.y;
    box.style.left = left + 'px'; box.style.top = top + 'px';
    box.style.width = r.w + 'px'; box.style.height = r.h + 'px';
  }
  function clampCrop() {
    var cv = $('#cropCanvas'), r = crop.rect, MIN = 44;
    r.x = Math.max(0, Math.min(r.x, cv.width - MIN));
    r.y = Math.max(0, Math.min(r.y, cv.height - MIN));
    r.w = Math.max(MIN, Math.min(r.w, cv.width - r.x));
    r.h = Math.max(MIN, Math.min(r.h, cv.height - r.y));
  }
  function cropPointerDown(e, type) {
    e.preventDefault(); e.stopPropagation();
    var pt = (e.touches && e.touches[0]) || e;
    crop.drag = { type: type, sx: pt.clientX, sy: pt.clientY,
      r: { x: crop.rect.x, y: crop.rect.y, w: crop.rect.w, h: crop.rect.h } };
  }
  function cropPointerMove(e) {
    if (!crop.drag || !crop.loaded) return;
    e.preventDefault();
    var pt = (e.touches && e.touches[0]) || e;
    var dx = pt.clientX - crop.drag.sx, dy = pt.clientY - crop.drag.sy;
    var o = crop.drag.r, r = crop.rect, t = crop.drag.type;
    if (t === 'move') { r.x = o.x + dx; r.y = o.y + dy; }
    else if (t === 'tl') { r.x = o.x + dx; r.y = o.y + dy; r.w = o.w - dx; r.h = o.h - dy; }
    else if (t === 'tr') { r.y = o.y + dy; r.w = o.w + dx; r.h = o.h - dy; }
    else if (t === 'bl') { r.x = o.x + dx; r.w = o.w - dx; r.h = o.h + dy; }
    else if (t === 'br') { r.w = o.w + dx; r.h = o.h + dy; }
    clampCrop(); syncCropBox();
  }
  function cropPointerUp() { crop.drag = null; }
  function wireCrop() {
    var box = $('#cropBox');
    [['.h.tl', 'tl'], ['.h.tr', 'tr'], ['.h.bl', 'bl'], ['.h.br', 'br']].forEach(function (p) {
      var el = box.querySelector(p[0]);
      el.addEventListener('mousedown', function (e) { cropPointerDown(e, p[1]); });
      el.addEventListener('touchstart', function (e) { cropPointerDown(e, p[1]); }, { passive: false });
    });
    box.addEventListener('mousedown', function (e) { if (e.target === box || e.target.className.indexOf('third') >= 0) cropPointerDown(e, 'move'); });
    box.addEventListener('touchstart', function (e) { if (e.target === box || e.target.className.indexOf('third') >= 0) cropPointerDown(e, 'move'); }, { passive: false });
    window.addEventListener('mousemove', cropPointerMove);
    window.addEventListener('touchmove', cropPointerMove, { passive: false });
    window.addEventListener('mouseup', cropPointerUp);
    window.addEventListener('touchend', cropPointerUp);
    window.addEventListener('resize', function () { if (!$('#cropLayer').classList.contains('hidden')) syncCropBox(); });
  }
  function confirmCrop(whole) {
    var cv = $('#cropCanvas');
    if (!crop.loaded || !cv) { closeCrop(); return; }
    var r = crop.rect;
    if (whole) r = { x: 0, y: 0, w: cv.width, h: cv.height };
    state.lineart.crop = {
      x: Math.round(r.x / cv.width * 1000), y: Math.round(r.y / cv.height * 1000),
      w: Math.round(r.w / cv.width * 1000), h: Math.round(r.h / cv.height * 1000)
    };
    closeCrop();
    toast(whole ? '已使用整张图' : '选区已应用');
    generateLineart();
  }

  // ---------------------------------------------------------------- 对比拖动
  function wireCompare(boxSel, lineSel, bSel, getMode) {
    var box = $(boxSel), line = $(lineSel), b = $(bSel);
    if (!box || !line || !b) return;
    line.style.left = '50%'; b.style.clipPath = 'inset(0 0 0 50%)';
    var dragging = false;
    function move(clientX) {
      var r = box.getBoundingClientRect();
      var pct = Math.max(0, Math.min(100, (clientX - r.left) / r.width * 100));
      line.style.left = pct + '%'; b.style.clipPath = 'inset(0 0 0 ' + pct + '%)';
    }
    function start(e) { dragging = true; move((e.touches ? e.touches[0] : e).clientX); e.preventDefault(); }
    function onMove(e) { if (dragging) move((e.touches ? e.touches[0] : e).clientX); }
    function end() { dragging = false; }
    line.addEventListener('touchstart', start, { passive: false });
    box.addEventListener('touchstart', function (e) { if (getMode() === 'compare') start(e); }, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', end);
    line.addEventListener('mousedown', start);
    box.addEventListener('mousedown', function (e) { if (getMode() === 'compare') start(e); });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', end);
  }
  function setupCompareDrag() {
    wireCompare('#laCompare', '#laCompareLine', '#laCompareB', function () { return state.lineart.mode; });
    // 长按预览原图
    var stage = $('#laStage'), t;
    function press(e) {
      if (state.lineart.mode !== 'compare' || !state.lineart.result) return;
      t = setTimeout(function () { $('#laCompareB').style.clipPath = 'inset(0 0 0 100%)'; }, 300);
    }
    function release() { clearTimeout(t); if (state.lineart.mode === 'compare') $('#laCompareB').style.clipPath = ''; }
    stage.addEventListener('touchstart', press, { passive: true });
    stage.addEventListener('touchend', release);
    stage.addEventListener('mousedown', press);
    stage.addEventListener('mouseup', release);
  }

  // ---------------------------------------------------------------- 下载记录
  function renderDownloads() {
    var list = $('#dlList'); list.innerHTML = '';
    $('#dlEmpty').classList.toggle('hidden', state.downloads.length > 0);
    $('#dlDirLabel').textContent = state.settings.dirLabel || '系统下载 / 聚搜图库';
    state.downloads.forEach(function (d) {
      var thumb = DEMO
        ? (String(d.thumb || '').indexOf('data:') === 0 ? d.thumb : demoSvg(d.thumb || d.name))
        : (d.thumb ? imgUrl(d.thumb, '') : demoSvg(d.name));
      var row = document.createElement('div'); row.className = 'dl-item';
      row.innerHTML = '<img src="' + esc(thumb) + '" alt="">'
        + '<div><b>' + esc(d.name) + '</b><small>' + esc(d.path) + ' · ' + fmtTime(d.time) + '</small></div>';
      list.appendChild(row);
    });
  }

  // ---------------------------------------------------------------- 设置
  function fillSettings(s) {
    state.settings = s || {};
    $('#setDirLabel').textContent = s.dirLabel || '系统下载 / 聚搜图库';
    $('#dlDirLabel').textContent = s.dirLabel || '系统下载 / 聚搜图库';
    $('#setSubdir').value = s.subdir || '';
    $('#setLimit').value = s.limit || 300;
    $('#setLimitVal').textContent = s.limit || 300;
    $('#setSort').value = s.sort || 'score';
    $('#setSafe').checked = !!s.safe;
    state.sort = s.sort || 'score';
    $$('#sortTabs button').forEach(function (b) { b.classList.toggle('active', b.dataset.sort === state.sort); });
    state.enabled = {};
    (s.sources || []).forEach(function (k) { state.enabled[k] = true; });
    updateSourceCount();
  }
  function loadSettings() {
    apiGet('/api/settings').then(fillSettings).catch(function (e) { toast('读取设置失败：' + e.message); });
  }
  function updateSourceCount() {
    var n = Object.keys(state.enabled).filter(function (k) { return state.enabled[k]; }).length;
    $('#srcCount').textContent = n;
    $('#setSrcCount').textContent = n;
  }
  function currentSettingsPayload() {
    var keys = {};
    [['keyPixabay', 'pixabay'], ['keyPexels', 'pexels'], ['keyUnsplash', 'unsplash']].forEach(function (p) {
      var v = $('#' + p[0]).value.trim();
      if (v) keys[p[1]] = v;
    });
    return {
      limit: parseInt($('#setLimit').value, 10),
      safe: $('#setSafe').checked,
      sort: $('#setSort').value,
      subdir: $('#setSubdir').value.trim(),
      sources: Object.keys(state.enabled).filter(function (k) { return state.enabled[k]; }),
      keys: keys
    };
  }
  function saveSettings() {
    busy(true, '正在保存设置…');
    apiPost('/api/settings', currentSettingsPayload()).then(function () {
      $$('#keyPixabay,#keyPexels,#keyUnsplash').forEach(function (i) { i.value = ''; });
      toast('设置已保存');
      return apiGet('/api/settings');
    }).then(fillSettings).catch(function (e) { toast('保存失败：' + e.message); })
      .then(function () { busy(false); });
  }

  // ---------------------------------------------------------------- 图源抽屉
  function renderSourceList() {
    var box = $('#sourceList'); box.innerHTML = '';
    state.sources.forEach(function (s) {
      var row = document.createElement('label'); row.className = 'src-row';
      var checked = !!state.enabled[s.key];
      row.innerHTML = '<div><b>' + esc(s.name) + '</b> <span class="pill ' + (s.needsKey ? 'key' : '') + '">'
        + (s.needsKey ? '需要 Key' : (s.kind === 'engine' ? '搜索引擎' : '图库')) + '</span>'
        + '<small>' + (s.needsKey ? '在设置中填入 API Key 后自动启用' : '免密钥，网络可达即生效') + '</small></div>'
        + '<input type="checkbox" ' + (checked ? 'checked' : '') + ' data-key="' + esc(s.key) + '">';
      box.appendChild(row);
    });
  }
  function openSheet() {
    renderSourceList();
    $('#sheetSources').classList.remove('hidden'); $('#sheetMask').classList.remove('hidden');
  }
  function closeSheet() {
    $('#sheetSources').classList.add('hidden'); $('#sheetMask').classList.add('hidden');
  }
  function applySources() {
    $$('#sourceList input[type=checkbox]').forEach(function (c) { state.enabled[c.dataset.key] = c.checked; });
    updateSourceCount();
    apiPost('/api/settings', { sources: Object.keys(state.enabled).filter(function (k) { return state.enabled[k]; }) })
      .then(function () { toast('图源已更新'); }).catch(function (e) { toast('保存失败：' + e.message); });
    closeSheet();
    if (state.query) doSearch(state.query);
  }

  // ---------------------------------------------------------------- 页面滚动位置保持
  // 搜图页（#app）跟随 window 滚动；子页面 .page 是 position:fixed 独立滚动容器。
  // #app 被 display:none 后浏览器会把 window.scrollY 强制清零，因此隐藏前保存、显示后恢复。
  var PAGE_EL = { lineart: '#pageLineart', downloads: '#pageDownloads', settings: '#pageSettings' };
  function saveScroll(tab) {
    if (!tab) return;
    if (tab === 'search') {
      state.scroll.search = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    } else {
      var el = $(PAGE_EL[tab]);
      if (el) state.scroll[tab] = el.scrollTop || 0;
    }
  }
  function restoreScroll(tab) {
    var y = state.scroll[tab] || 0;
    var raf = window.requestAnimationFrame;
    if (tab === 'search') {
      var apply = function () { window.scrollTo(0, y); };
      apply();
      if (raf) raf(function () { raf(apply); });
    } else {
      var el = $(PAGE_EL[tab]);
      if (!el) return;
      el.scrollTop = y;
      if (raf) raf(function () { el.scrollTop = y; });
    }
  }

  // ---------------------------------------------------------------- Tab / 返回
  function switchTab(t) {
    saveScroll(state.tab);
    state.tab = t;
    $$('#tabbar button').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === t); });
    $('#app').classList.toggle('hidden', t !== 'search');
    $('#pageLineart').classList.toggle('hidden', t !== 'lineart');
    $('#pageDownloads').classList.toggle('hidden', t !== 'downloads');
    $('#pageSettings').classList.toggle('hidden', t !== 'settings');
    if (t === 'settings') loadSettings();
    if (t === 'downloads') renderDownloads();
    restoreScroll(t);
  }
  window.__onBack = function () {
    if (!$('#cropLayer').classList.contains('hidden')) { closeCrop(); return; }
    if (!$('#viewer').classList.contains('hidden')) { closeViewer(); return; }
    if (!$('#sheetSources').classList.contains('hidden')) { closeSheet(); return; }
    if (!$('#busy').classList.contains('hidden')) return;
    if (state.tab !== 'search') { switchTab('search'); return; }
    var now = Date.now();
    if (now - state.lastBack < 2000) { if (Native.finishApp) Native.finishApp(); else toast('演示模式：退出 App'); }
    else { state.lastBack = now; toast('再按一次返回键退出'); }
  };
  window.__onNativeDir = function (m) {
    if (m && m.ok) {
      state.settings.dirLabel = m.dirLabel;
      state.settings.hasCustomDir = m.dirLabel.indexOf('自定义') >= 0;
      $('#setDirLabel').textContent = m.dirLabel;
      $('#dlDirLabel').textContent = m.dirLabel;
      toast('下载目录已更新');
    } else toast('目录设置失败');
  };
  window.__onNativeImage = function (m) {
    state.pendingTool = '';
    if (m && m.ok && m.url) {
      busy(true, '正在读取所选图片…');
      blobToDataUrl(m.url).then(function (dataUrl) {
        switchTab('lineart'); setLineartImage(dataUrl);
      }).catch(function (e) { toast('图片读取失败：' + e.message); })
        .then(function () { busy(false); });
      return;
    }
    busy(false);
    if (m && m.ok && m.image) { switchTab('lineart'); setLineartImage(m.image); }
    else toast('图片读取失败：' + ((m && m.error) || '未知错误'));
  };

  // ---------------------------------------------------------------- 事件绑定
  function bind() {
    $('#btnSearch').addEventListener('click', function () { doSearch($('#q').value); });
    $('#q').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); doSearch(this.value); this.blur(); }
    });
    $('#btnClear').addEventListener('click', function () { $('#q').value = ''; $('#q').focus(); });
    $('#btnTopSettings').addEventListener('click', function () { switchTab('settings'); });
    $$('#sortTabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        state.sort = b.dataset.sort;
        $$('#sortTabs button').forEach(function (x) { x.classList.toggle('active', x === b); });
        applySort(); renderGrid();
        if (state.items.length) renderStatus({ stats: window.__lastStats, total: state.items.length });
      });
    });
    var hw = $('#hotWords');
    HOT.forEach(function (w) {
      var s = document.createElement('span'); s.textContent = w;
      s.addEventListener('click', function () { doSearch(w); });
      hw.appendChild(s);
    });

    $('#btnSources').addEventListener('click', openSheet);
    $('#btnSources2').addEventListener('click', openSheet);
    $('#btnCloseSheet').addEventListener('click', closeSheet);
    $('#sheetMask').addEventListener('click', closeSheet);
    $('#btnApplySources').addEventListener('click', applySources);
    $('#btnAllSources').addEventListener('click', function () {
      $$('#sourceList input[type=checkbox]').forEach(function (c) {
        var s = state.sources.filter(function (x) { return x.key === c.dataset.key; })[0];
        c.checked = !s.needsKey || (state.settings.keys && state.settings.keys[s.key]);
      });
      toast('已勾选所有可用来源');
    });
    $('#btnDefaultSources').addEventListener('click', function () {
      var def = ['bing', 'sogou', 'so360', 'baidu', 'duckduckgo', 'openverse', 'wikimedia', 'flickr'];
      $$('#sourceList input[type=checkbox]').forEach(function (c) { c.checked = def.indexOf(c.dataset.key) >= 0; });
      toast('已恢复默认来源');
    });

    $$('#tabbar button').forEach(function (b) {
      b.addEventListener('click', function () { switchTab(b.dataset.tab); });
    });

    // 线稿生成工具页
    $('#btnLaPick').addEventListener('click', function () {
      if (DEMO) { setLineartImage(demoSvg('la-' + Date.now())); toast('演示模式：已载入示例图'); }
      else { state.pendingTool = 'lineart'; native('pickImage'); }
    });
    $('#btnFromSearchLa').addEventListener('click', function () {
      if (!state.items.length) { toast('请先在「搜图」里搜一批图片'); return; }
      switchTab('search'); openViewer(0);
      toast('点查看器里的「✎ 送入线稿生成」即可导入');
    });
    $('#btnLaCrop').addEventListener('click', openCrop);
    $('#btnCropCancel').addEventListener('click', closeCrop);
    $('#btnCropWhole').addEventListener('click', function () { confirmCrop(true); });
    $('#btnCropConfirm').addEventListener('click', function () { confirmCrop(false); });
    $('#btnCropReset').addEventListener('click', function () {
      var cv = $('#cropCanvas');
      crop.rect = { x: cv.width * 0.06, y: cv.height * 0.06, w: cv.width * 0.88, h: cv.height * 0.88 };
      syncCropBox();
    });
    wireCrop();

    $$('#laModes button').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!state.lineart.result) { toast('请先生成线稿'); return; }
        state.lineart.mode = b.dataset.mode; renderLineartStage();
      });
    });
    $$('#laModes5 button').forEach(function (b) {
      b.addEventListener('click', function () {
        applyPreset(parseInt(b.dataset.v, 10));
        if (state.lineart.image) generateLineart();
      });
    });
    [['#laDetail', '#laDetailVal', 'detail'], ['#laThick', '#laThickVal', 'thickness'],
     ['#laInk', '#laInkVal', 'ink'], ['#laClean', '#laCleanVal', 'clean']].forEach(function (t) {
      var el = $(t[0]), lab = $(t[1]), key = t[2];
      el.addEventListener('input', function () { lab.textContent = this.value; state.lineart[key] = parseInt(this.value, 10); });
      el.addEventListener('change', function () { if (state.lineart.image) scheduleLaRegen(); });
    });
    [['#laInvert', 'invert'], ['#laDarkBg', 'darkBgSuppression']].forEach(function (t) {
      $(t[0]).addEventListener('change', function () {
        state.lineart[t[1]] = this.checked;
        if (state.lineart.image) scheduleLaRegen();
      });
    });
    $('#btnLaRegen').addEventListener('click', generateLineart);
    $('#btnLaSave').addEventListener('click', saveLineart);
    $('#btnLaShare').addEventListener('click', function () {
      native('shareText', '我用「聚搜图库 · 线稿生成」把照片转成了纹身线描底稿');
    });
    setupCompareDrag();

    // 查看器
    $('#btnViewerClose').addEventListener('click', closeViewer);
    $('#vPrev').addEventListener('click', function () { viewerStep(-1); });
    $('#vNext').addEventListener('click', function () { viewerStep(1); });
    $('#btnVDownload').addEventListener('click', downloadCurrent);
    $('#btnVLineart').addEventListener('click', lineartFromViewer);
    $('#btnVOpen').addEventListener('click', function () {
      var it = state.sorted[state.viewerIndex];
      if (it && it.page) native('openExternal', it.page); else toast('该图片没有来源页面');
    });
    $('#btnViewerMore').addEventListener('click', function () {
      var it = state.sorted[state.viewerIndex];
      if (it) toast('贴题 ' + (it.relevance || 0).toFixed(2) + ' · 热门 ' + (it.popularity || 0).toFixed(2)
        + ' · 来自 ' + it.sourceName);
    });
    $('#vImage').addEventListener('dblclick', function () { this.classList.toggle('zoomed'); });
    $('#vImage').addEventListener('error', function () {
      if (this.dataset.fallback) return;
      this.dataset.fallback = '1';
      var it = state.sorted[state.viewerIndex];
      if (it && it.thumb) this.src = imgUrl(it.thumb, it.page || it.full);
    });

    // 下载记录
    $('#btnClearDl').addEventListener('click', function () {
      state.downloads = [];
      try { localStorage.removeItem('jusou_downloads'); } catch (e) {}
      renderDownloads(); toast('记录已清空');
    });

    // 设置
    $('#btnChooseDir').addEventListener('click', function () {
      if (DEMO) window.__onNativeDir({ ok: true, dirLabel: '自定义目录：MyPictures（演示）' });
      else native('chooseDownloadDir');
    });
    $('#btnResetDir').addEventListener('click', function () {
      if (DEMO) window.__onNativeDir({ ok: true, dirLabel: '系统下载 / 聚搜图库（演示）' });
      else native('clearDownloadDir');
    });
    $('#setLimit').addEventListener('input', function () { $('#setLimitVal').textContent = this.value; });
    $('#btnSaveSettings').addEventListener('click', saveSettings);
    $('#btnClearCache').addEventListener('click', function () {
      apiPost('/api/clear-cache', {}).then(function (r) { toast('已清除 ' + (r.cleared || 0) + ' 张缓存'); })
        .catch(function (e) { toast('清除失败：' + e.message); });
    });

    // 保留最近一次搜索的源统计，供切换排序时重绘
    var origStatus = renderStatus;
    renderStatus = function (r) { if (r && r.stats) window.__lastStats = r.stats; origStatus(r); };
  }

  // ---------------------------------------------------------------- 启动
  function init() {
    bind();
    applyPreset(1);
    updateSteps(1);
    apiGet('/api/sources').then(function (r) {
      state.sources = r.sources || [];
      return apiGet('/api/settings');
    }).then(fillSettings).catch(function () {
      state.sources = DEMO_SOURCES;
    }).then(function () {
      renderLineartStage();
      if (DEMO) toast('演示模式：展示的是模拟数据，真机内会检索真实图源');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
