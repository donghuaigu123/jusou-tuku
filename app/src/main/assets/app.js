/* 聚搜图库 · 前端逻辑
 * 页面与 /api 同源（App 内本地服务），浏览器预览时走 JUSOU_DEMO 演示数据。
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
    if (path.indexOf('/api/app') === 0) return { ok: true, name: '聚搜图库', version: '3.0.0', maxResults: 300 };
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
    if (path.indexOf('/api/lineart') === 0 && body && body.image) return demoLineArt(body.image, body);
    return { ok: true };
  }

  /** 演示模式下的简易线稿算法（真实环境由 Java 端 StencilProcessor 计算）。 */
  function demoStencil(dataUrl) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        try {
          var W = Math.min(560, img.width || 400);
          var H = Math.max(1, Math.round(W * (img.height || 500) / (img.width || 400)));
          var c = document.createElement('canvas'); c.width = W; c.height = H;
          var ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, W, H);
          var d = ctx.getImageData(0, 0, W, H), p = d.data;
          var g = new Float32Array(W * H);
          for (var i = 0, j = 0; i < p.length; i += 4, j++) g[j] = p[i] * .299 + p[i + 1] * .587 + p[i + 2] * .114;
          var out = ctx.createImageData(W, H), o = out.data;
          for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
            var id = y * W + x, sum = 0, cnt = 0;
            for (var dy = -3; dy <= 3; dy += 3) for (var dx = -3; dx <= 3; dx += 3) {
              var nx = x + dx, ny = y + dy;
              if (nx >= 0 && nx < W && ny >= 0 && ny < H) { sum += g[ny * W + nx]; cnt++; }
            }
            var diff = sum / cnt - g[id];
            var v = diff > 16 ? 0 : 255;
            var k = id * 4; o[k] = o[k + 1] = o[k + 2] = v; o[k + 3] = 255;
          }
          ctx.putImageData(out, 0, 0);
          resolve(c.toDataURL('image/png'));
        } catch (e) { reject(e); }
      };
      img.onerror = function () { reject(new Error('图片加载失败')); };
      img.src = dataUrl;
    });
  }

  // ---------------------------------------------------------------- 演示态：图转线稿近似算法
  function rgbHex(r, g, b) {
    function h(v) { v = Math.max(0, Math.min(255, Math.round(v))); return v < 16 ? '0' + v.toString(16) : v.toString(16); }
    return ('#' + h(r) + h(g) + h(b)).toUpperCase();
  }
  function demoCrowd(p, need) {
    var bins = {}, total = p.length / 4;
    for (var i = 0; i < p.length; i += 4) {
      var k = ((p[i] >> 5) << 6) | ((p[i + 1] >> 5) << 3) | (p[i + 2] >> 5);
      var b = bins[k] || (bins[k] = { r: 0, g: 0, b: 0, n: 0 });
      b.r += p[i]; b.g += p[i + 1]; b.b += p[i + 2]; b.n++;
    }
    var arr = [];
    for (var key in bins) if (Object.prototype.hasOwnProperty.call(bins, key)) {
      var x = bins[key];
      arr.push({ hex: rgbHex(x.r / x.n, x.g / x.n, x.b / x.n),
        ratio: Math.round(x.n / total * 1000) / 1000 });
    }
    arr.sort(function (a, b) { return b.ratio - a.ratio; });
    return arr.slice(0, need);
  }
  function demoNaive(p, W, H, nx, ny) {
    var out = [];
    for (var by = 0; by < ny; by++) for (var bx = 0; bx < nx; bx++) {
      var x0 = Math.floor(W * bx / nx), x1 = Math.floor(W * (bx + 1) / nx);
      var y0 = Math.floor(H * by / ny), y1 = Math.floor(H * (by + 1) / ny);
      var r = 0, g = 0, b = 0, n = 0;
      for (var y = y0; y < y1; y++) for (var x = x0; x < x1; x++) {
        var i = (y * W + x) * 4; r += p[i]; g += p[i + 1]; b += p[i + 2]; n++;
      }
      if (n) out.push({ hex: rgbHex(r / n, g / n, b / n), ratio: Math.round(n / (W * H) * 1000) / 1000 });
    }
    return out;
  }
  /** 演示模式近似「图转线稿」流水线；真机由 Java 端 LineArtCore 精确计算。 */
  function demoLineArt(dataUrl, o) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        try {
          var W = Math.min(420, img.width || 400);
          var H = Math.max(1, Math.round(W * (img.height || 500) / (img.width || 400)));
          var c = document.createElement('canvas'); c.width = W; c.height = H;
          var ctx = c.getContext('2d');
          if (o.mirror) { ctx.translate(W, 0); ctx.scale(-1, 1); }
          ctx.drawImage(img, 0, 0, W, H);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          var d = ctx.getImageData(0, 0, W, H), p = d.data;
          var crowd = demoCrowd(p, 8), naive = demoNaive(p, W, H, 4, 2);
          var g = new Float32Array(W * H);
          for (var i = 0, j = 0; i < p.length; i += 4, j++)
            g[j] = p[i] * .299 + p[i + 1] * .587 + p[i + 2] * .114;
          var thr = 10 - (o.sensitivity - 50) * 0.10 - (o.density - 50) * 0.10;
          if (o.algo === 1) thr += 4;
          var mask = new Uint8Array(W * H), diffArr = new Float32Array(W * H);
          for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
            var id = y * W + x, sum = 0, cnt = 0;
            for (var dy = -2; dy <= 2; dy += 2) for (var dx = -2; dx <= 2; dx += 2) {
              var nx2 = x + dx, ny2 = y + dy;
              if (nx2 >= 0 && nx2 < W && ny2 >= 0 && ny2 < H) { sum += g[ny2 * W + nx2]; cnt++; }
            }
            // 局部均值差分 + 相邻像素梯度，勾出形状硬边界（演示图是平滑渐变，
            // 单靠均值差分几乎检不出线，这里补一路梯度近似真机 Sobel 效果）
            var gx = (x > 0 && x < W - 1) ? Math.abs(g[id + 1] - g[id - 1]) : 0;
            var gy = (y > 0 && y < H - 1) ? Math.abs(g[id + W] - g[id - W]) : 0;
            var diff = Math.max(sum / cnt - g[id], Math.max(gx, gy) * 0.9);
            diffArr[id] = diff;
            mask[id] = diff > thr ? 1 : 0;
          }
          var width = Math.max(1, Math.min(5, o.lineWidth || 1));
          for (var t = 1; t < width; t++) {
            var src = mask, dst = new Uint8Array(W * H);
            for (var yy = 0; yy < H; yy++) for (var xx = 0; xx < W; xx++) {
              var q = yy * W + xx;
              if (src[q]) { dst[q] = 1; continue; }
              for (var ddy = -1; ddy <= 1; ddy++) {
                var hit = false;
                for (var ddx = -1; ddx <= 1; ddx++) {
                  var ax = xx + ddx, ay = yy + ddy;
                  if (ax >= 0 && ax < W && ay >= 0 && ay < H && src[ay * W + ax]) { dst[q] = 1; hit = true; break; }
                }
                if (hit) break;
              }
            }
            mask = dst;
          }
          var out = ctx.createImageData(W, H), q2 = out.data;
          for (var k = 0; k < W * H; k++) {
            var v;
            if (o.pureBW) v = mask[k] ? 0 : 255;
            else v = mask[k] ? Math.max(0, Math.round(110 - diffArr[k]))
                             : Math.min(255, Math.round(205 + diffArr[k] * 0.3));
            if (o.invert) v = 255 - v;
            var k4 = k * 4; q2[k4] = q2[k4 + 1] = q2[k4 + 2] = v; q2[k4 + 3] = 255;
          }
          ctx.putImageData(out, 0, 0);
          resolve({ ok: true, image: c.toDataURL('image/png'), crowd: crowd, naive: naive,
            width: W, height: H });
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
    stencil: { image: '', result: '', mode: 'result', preset: 1, strength: 50, detail: 50, clean: true },
    lineart: { image: '', result: '', mode: 'result', algo: 0, sensitivity: 50, density: 50,
      lineWidth: 1, pureBW: true, mirror: false, invert: false, enhance: true,
      crowd: [], naive: [] },
    downloads: [], pendingTool: '', mbReady: false, mbPending: null,
    scroll: { search: 0, stencil: 0, miaobian: 0, lineart: 0, downloads: 0, settings: 0 }
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
    // 结果已变化，旧的滚动位置不再有意义
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
  function stencilFromViewer() {
    var it = state.sorted[state.viewerIndex]; if (!it) return;
    busy(true, '正在读取图片…');
    imageToDataUrl(it.full || it.thumb, it.page || it.full).then(function (dataUrl) {
      closeViewer(); switchTab('stencil'); setStencilImage(dataUrl);
    }).catch(function (e) { toast('读取图片失败：' + e.message); })
      .then(function () { busy(false); });
  }

  // ---------------------------------------------------------------- 线稿工作台
  function setStencilImage(dataUrl) {
    state.stencil.image = dataUrl;
    state.stencil.result = '';
    $('#stOriginal').src = dataUrl;
    $('#stCompareA').src = dataUrl;
    $('#stPlaceholder').classList.add('hidden');
    generateStencil();
  }
  function renderStage() {
    var s = state.stencil, mode = s.mode;
    var hasResult = !!s.result;
    if (!s.image) {
      ['#stOriginal', '#stResult', '#stCompare', '#stBadge'].forEach(function (k) { $(k).classList.add('hidden'); });
      $('#stPlaceholder').classList.remove('hidden');
      return;
    }
    $('#stPlaceholder').classList.add('hidden');
    $('#stOriginal').classList.toggle('hidden', !(mode === 'original' || !hasResult));
    $('#stResult').classList.toggle('hidden', !(mode === 'result' && hasResult));
    $('#stCompare').classList.toggle('hidden', !(mode === 'compare' && hasResult));
    $('#stBadge').classList.toggle('hidden', !s.image);
    $('#stBadge').textContent = ({ original: '原图', result: '线稿', compare: '拖动分割线对比' })[mode];
    if (hasResult) {
      $('#stResult').src = s.result;
      $('#stCompareB').src = s.result;
      $('#stCompareA').src = s.image;
    }
    $$('#stModes button').forEach(function (b) { b.classList.toggle('active', b.dataset.mode === mode); });
  }
  var regenTimer;
  function scheduleRegen() {
    clearTimeout(regenTimer);
    regenTimer = setTimeout(generateStencil, 550);
  }
  function generateStencil() {
    var s = state.stencil;
    if (!s.image) { toast('请先选择一张图片'); return; }
    busy(true, '正在生成线描稿…');
    $('#stStatus').textContent = '正在本机计算：灰度 → 背景漂白 → 局部均值差分 → Sobel 边缘 → 二值化 → 去噪';
    var p;
    if (DEMO) p = demoStencil(s.image);
    else p = apiPost('/api/stencil', {
      image: s.image, preset: s.preset, strength: s.strength,
      detail: s.detail, cleanBackground: s.clean
    }).then(function (r) {
      if (!r.ok && r.error) throw new Error(r.error);
      return r.image;
    });
    p.then(function (out) {
      s.result = out; s.mode = 'result'; renderStage();
      $('#stStatus').textContent = '线稿已生成：纯白底 + 纯黑线，可直接用于纹身转印。';
    }).catch(function (e) { toast('生成失败：' + e.message); })
      .then(function () { busy(false); });
  }
  function saveStencil() {
    var s = state.stencil;
    if (!s.result) { toast('请先生成线稿'); return; }
    var name = '线稿_' + Date.now() + '.png';
    busy(true, '正在保存 PNG…');
    if (DEMO) {
      var a = document.createElement('a'); a.href = s.result; a.download = name; a.click();
      addDownload({ name: name, path: '浏览器下载（演示）', thumb: s.result, time: Date.now(), source: '线稿工作台' });
      toast('演示模式：已触发浏览器下载'); busy(false); return;
    }
    apiPost('/api/save-image', { image: s.result, name: name, mime: 'image/png' })
      .then(function (r) {
        addDownload({ name: name, path: r.path || '已保存', thumb: s.result,
          time: Date.now(), source: '线稿工作台' });
        toast('已保存：' + (r.path || ''));
      }).catch(function (e) { toast('保存失败：' + e.message); })
      .then(function () { busy(false); });
  }
  function wireCompare(boxSel, lineSel, bSel, getMode) {
    var box = $(boxSel), line = $(lineSel), b = $(bSel);
    if (!box || !line || !b) return;
    line.style.left = '50%';
    b.style.clipPath = 'inset(0 0 0 50%)';
    var dragging = false;
    function move(clientX) {
      var r = box.getBoundingClientRect();
      var pct = Math.max(0, Math.min(100, (clientX - r.left) / r.width * 100));
      line.style.left = pct + '%';
      b.style.clipPath = 'inset(0 0 0 ' + pct + '%)';
    }
    function start(e) { dragging = true; move((e.touches ? e.touches[0] : e).clientX); e.preventDefault(); }
    function onMove(e) { if (dragging) move((e.touches ? e.touches[0] : e).clientX); }
    function end() { dragging = false; }
    line.addEventListener('touchstart', start, { passive: false });
    box.addEventListener('touchstart', function (e) {
      if (getMode() === 'compare') start(e);
    }, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', end);
    line.addEventListener('mousedown', start);
    box.addEventListener('mousedown', function (e) { if (getMode() === 'compare') start(e); });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', end);
  }
  function setupCompareDrag() {
    wireCompare('#stCompare', '#stCompareLine', '#stCompareB', function () { return state.stencil.mode; });
    wireCompare('#laCompare', '#laCompareLine', '#laCompareB', function () { return state.lineart.mode; });
  }

  // ---------------------------------------------------------------- 秒变线稿工具页
  function ensureMiaobian() {
    var f = $('#mbFrame');
    if (!f || f.dataset.loaded) return;
    if (DEMO) {
      if (window.JUSOU_MIAOBIAN_HTML) f.srcdoc = window.JUSOU_MIAOBIAN_HTML;
      else f.srcdoc = '<!doctype html><meta charset="utf-8"><body style="background:#08090c;color:#8b93a3;font:14px system-ui;padding:28px">演示模式未内联「秒变线稿」页面，请用 scripts/make-preview.py 重新生成预览页。</body>';
    } else {
      f.src = f.dataset.src || '/miaobian.html';
    }
    f.dataset.loaded = '1';
    state.mbReady = false;
  }
  function postToMb(msg) {
    try {
      var w = $('#mbFrame').contentWindow;
      if (w) w.postMessage(msg, '*');
    } catch (e) {}
  }
  function sendToMiaobian(dataUrl, name) {
    switchTab('miaobian');
    ensureMiaobian();
    var msg = { __jusou: 'image', dataUrl: dataUrl, name: name || '聚搜图库图片' };
    if (state.mbReady) postToMb(msg); else state.mbPending = msg;
  }
  function handleMbSave(d) {
    if (!d.data) { toast('保存失败：数据为空'); return; }
    var mime = d.mime || 'image/jpeg';
    var name = d.name || ('秒变线稿_' + Date.now() + '.jpg');
    var dataUrl = 'data:' + mime + ';base64,' + d.data;
    if (DEMO) {
      var a = document.createElement('a'); a.href = dataUrl; a.download = name; a.click();
      addDownload({ name: name, path: '浏览器下载（演示）', thumb: '', time: Date.now(), source: '秒变线稿' });
      toast('演示模式：已触发浏览器下载'); return;
    }
    busy(true, '正在保存导出文件…');
    apiPost('/api/save-image', { image: dataUrl, name: name, mime: mime })
      .then(function (r) {
        addDownload({ name: name, path: r.path || '已保存', thumb: '', time: Date.now(), source: '秒变线稿' });
        toast('已保存：' + (r.path || ''));
        if (Native.toast) Native.toast('已保存：' + name);
      })
      .catch(function (e) { toast('保存失败：' + e.message); })
      .then(function () { busy(false); });
  }
  function onMbMessage(e) {
    var d = e.data;
    if (!d || typeof d !== 'object' || !d.__jusou) return;
    if (d.__jusou === 'ready') {
      state.mbReady = true;
      if (state.mbPending) { postToMb(state.mbPending); state.mbPending = null; }
    } else if (d.__jusou === 'save') { handleMbSave(d); }
    else if (d.__jusou === 'toast') { toast(d.text); }
  }
  function miaobianFromViewer() {
    var it = state.sorted[state.viewerIndex]; if (!it) return;
    busy(true, '正在读取图片…');
    imageToDataUrl(it.full || it.thumb, it.page || it.full).then(function (dataUrl) {
      closeViewer();
      sendToMiaobian(dataUrl, (it.title || '图片').slice(0, 40));
      toast('已送入「秒变线稿」');
    }).catch(function (e) { toast('读取图片失败：' + e.message); })
      .then(function () { busy(false); });
  }

  // ---------------------------------------------------------------- 图转线稿工具页
  function renderLineartStage() {
    var s = state.lineart, mode = s.mode, has = !!s.result;
    if (!s.image) {
      ['#laOriginal', '#laResult', '#laCompare', '#laBadge'].forEach(function (k) { $(k).classList.add('hidden'); });
      $('#laPlaceholder').classList.remove('hidden');
      return;
    }
    $('#laPlaceholder').classList.add('hidden');
    $('#laOriginal').classList.toggle('hidden', !(mode === 'original' || !has));
    $('#laResult').classList.toggle('hidden', !(mode === 'result' && has));
    $('#laCompare').classList.toggle('hidden', !(mode === 'compare' && has));
    $('#laBadge').classList.remove('hidden');
    $('#laBadge').textContent = ({ original: '原图', result: '线稿', compare: '拖动分割线对比' })[mode];
    $('#laOriginal').src = s.image;
    if (has) {
      $('#laResult').src = s.result;
      $('#laCompareA').src = s.image;
      $('#laCompareB').src = s.result;
    }
    $$('#laModes button').forEach(function (b) { b.classList.toggle('active', b.dataset.mode === mode); });
  }
  function renderSwatches() {
    function fill(id, list) {
      var box = $(id);
      box.innerHTML = '';
      if (!list || !list.length) { box.innerHTML = '<span class="swatch-empty">—</span>'; return; }
      list.forEach(function (sw) {
        var b = document.createElement('button');
        b.className = 'swatch';
        b.style.background = sw.hex;
        b.title = sw.hex + (sw.ratio ? ' · ' + (sw.ratio * 100).toFixed(1) + '%' : '');
        b.innerHTML = '<span>' + esc(sw.hex) + '</span>';
        b.addEventListener('click', function () {
          try { if (navigator.clipboard) navigator.clipboard.writeText(sw.hex).catch(function () {}); } catch (e) {}
          toast('已复制色值 ' + sw.hex);
        });
        box.appendChild(b);
      });
    }
    fill('#laCrowd', state.lineart.crowd);
    fill('#laNaive', state.lineart.naive);
  }
  function setLineartImage(dataUrl) {
    state.lineart.image = dataUrl;
    state.lineart.result = '';
    renderLineartStage();
    generateLineart();
  }
  var laTimer;
  function scheduleLaRegen() {
    clearTimeout(laTimer);
    laTimer = setTimeout(generateLineart, 500);
  }
  function generateLineart() {
    var s = state.lineart;
    if (!s.image) { toast('请先选择一张图片'); return; }
    busy(true, '正在本机计算线稿…');
    $('#laStatus').textContent = '自动色阶 → DoG / Sobel / 色差边缘 → 自适应二值化 → 连通域去噪 → 加粗连断线';
    var payload = {
      image: s.image, mode: s.algo, sensitivity: s.sensitivity, density: s.density,
      lineWidth: s.lineWidth, pureBW: s.pureBW, mirror: s.mirror,
      invert: s.invert, enhance: s.enhance
    };
    var p = DEMO ? demoLineArt(s.image, s) : apiPost('/api/lineart', payload).then(function (r) {
      if (!r.ok && r.error) throw new Error(r.error);
      return r;
    });
    p.then(function (r) {
      s.result = r.image;
      s.crowd = r.crowd || [];
      s.naive = r.naive || [];
      s.mode = 'result';
      renderLineartStage();
      renderSwatches();
      $('#laStatus').textContent = '线稿已生成：' + (r.width || '') + '×' + (r.height || '')
        + ' · ' + (s.pureBW ? '纯二值白底黑线' : '柔和灰阶')
        + (s.mirror ? ' · 已镜像' : '') + ' · 可拖动分割线对比。';
    }).catch(function (e) { toast('生成失败：' + e.message); })
      .then(function () { busy(false); });
  }
  function saveLineart() {
    var s = state.lineart;
    if (!s.result) { toast('请先生成线稿'); return; }
    var name = '图转线稿_' + Date.now() + '.png';
    busy(true, '正在保存 PNG 底稿…');
    if (DEMO) {
      var a = document.createElement('a'); a.href = s.result; a.download = name; a.click();
      addDownload({ name: name, path: '浏览器下载（演示）', thumb: s.result,
        time: Date.now(), source: '图转线稿' });
      toast('演示模式：已触发浏览器下载'); busy(false); return;
    }
    apiPost('/api/save-image', { image: s.result, name: name, mime: 'image/png' })
      .then(function (r) {
        addDownload({ name: name, path: r.path || '已保存', thumb: s.result,
          time: Date.now(), source: '图转线稿' });
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
      toast('已送入「图转线稿」');
    }).catch(function (e) { toast('读取图片失败：' + e.message); })
      .then(function () { busy(false); });
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
  // 搜图页（#app）跟随 window 滚动；子页面 .page 是 position:fixed 的独立滚动容器。
  // #app 被 display:none 后浏览器会把 window.scrollY 强制清零，因此必须在隐藏前
  // 保存、在目标页显示且布局完成后恢复，否则从线稿工具返回会跳回结果顶部。
  var PAGE_EL = {
    stencil: '#pageStencil', miaobian: '#pageMiaobian', lineart: '#pageLineart',
    downloads: '#pageDownloads', settings: '#pageSettings'
  };
  function saveScroll(tab) {
    if (!tab) return;
    if (tab === 'search') {
      state.scroll.search = window.pageYOffset || document.documentElement.scrollTop
        || document.body.scrollTop || 0;
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
      apply();  // 同步先试一次
      if (raf) raf(function () { raf(apply); });  // 等 #app 重新布局后再恢复
    } else {
      var el = $(PAGE_EL[tab]);
      if (!el) return;
      el.scrollTop = y;
      if (raf) raf(function () { el.scrollTop = y; });
    }
  }

  // ---------------------------------------------------------------- Tab / 返回
  function switchTab(t) {
    saveScroll(state.tab);   // 关键：DOM 隐藏前先记住当前页位置
    state.tab = t;
    $$('#tabbar button').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === t); });
    $('#app').classList.toggle('hidden', t !== 'search');
    $('#pageStencil').classList.toggle('hidden', t !== 'stencil');
    $('#pageMiaobian').classList.toggle('hidden', t !== 'miaobian');
    $('#pageLineart').classList.toggle('hidden', t !== 'lineart');
    $('#pageDownloads').classList.toggle('hidden', t !== 'downloads');
    $('#pageSettings').classList.toggle('hidden', t !== 'settings');
    if (t === 'settings') loadSettings();
    if (t === 'downloads') renderDownloads();
    if (t === 'miaobian') ensureMiaobian();
    restoreScroll(t);   // 关键：不再无条件归零，恢复目标页上次的位置
  }
  window.__onBack = function () {
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
    var target = state.pendingTool || 'stencil';
    state.pendingTool = '';
    if (m && m.ok && m.url) {
      busy(true, '正在读取所选图片…');
      blobToDataUrl(m.url).then(function (dataUrl) {
        if (target === 'miaobian') sendToMiaobian(dataUrl, '相册图片');
        else if (target === 'lineart') { switchTab('lineart'); setLineartImage(dataUrl); }
        else { switchTab('stencil'); setStencilImage(dataUrl); }
      }).catch(function (e) { toast('图片读取失败：' + e.message); })
        .then(function () { busy(false); });
      return;
    }
    busy(false);
    if (m && m.ok && m.image) {
      if (target === 'miaobian') sendToMiaobian(m.image, '相册图片');
      else if (target === 'lineart') { switchTab('lineart'); setLineartImage(m.image); }
      else { switchTab('stencil'); setStencilImage(m.image); }
    } else toast('图片读取失败：' + ((m && m.error) || '未知错误'));
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

    // 三线稿工具切换器（三个页面顶部各一份）
    $$('.tool-switch button').forEach(function (b) {
      b.addEventListener('click', function () { switchTab(b.dataset.tool); });
    });
    $('#btnMbPick').addEventListener('click', function () {
      if (DEMO) { sendToMiaobian(demoSvg('mb-' + Date.now()), '示例图片'); }
      else { state.pendingTool = 'miaobian'; native('pickImage'); }
    });
    $('#btnFromSearchMb').addEventListener('click', function () {
      if (!state.items.length) { toast('请先在「搜图」里搜一批图片'); return; }
      switchTab('search'); openViewer(0);
      toast('点查看器里的「✎ 送秒变线稿」即可导入');
    });

    // 图转线稿工具页
    $('#btnLaPick').addEventListener('click', function () {
      if (DEMO) { setLineartImage(demoSvg('la-' + Date.now())); toast('演示模式：已载入示例图'); }
      else { state.pendingTool = 'lineart'; native('pickImage'); }
    });
    $('#btnFromSearchLa').addEventListener('click', function () {
      if (!state.items.length) { toast('请先在「搜图」里搜一批图片'); return; }
      switchTab('search'); openViewer(0);
      toast('点查看器里的三个「送…线稿」按钮即可导入');
    });
    $$('#laModes button').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!state.lineart.result) { toast('请先生成线稿'); return; }
        state.lineart.mode = b.dataset.mode; renderLineartStage();
      });
    });
    $$('#laAlgo button').forEach(function (b) {
      b.addEventListener('click', function () {
        state.lineart.algo = parseInt(b.dataset.v, 10);
        $$('#laAlgo button').forEach(function (x) { x.classList.toggle('active', x === b); });
        generateLineart();
      });
    });
    [['#laSens', '#laSensVal', 'sensitivity'], ['#laDensity', '#laDensityVal', 'density'],
     ['#laWidth', '#laWidthVal', 'lineWidth']].forEach(function (t) {
      var el = $(t[0]), lab = $(t[1]), key = t[2];
      el.addEventListener('input', function () {
        lab.textContent = this.value;
        state.lineart[key] = parseInt(this.value, 10);
      });
      el.addEventListener('change', scheduleLaRegen);
    });
    [['#laPureBW', 'pureBW'], ['#laMirror', 'mirror'], ['#laInvert', 'invert'],
     ['#laEnhance', 'enhance']].forEach(function (t) {
      $(t[0]).addEventListener('change', function () {
        state.lineart[t[1]] = this.checked;
        scheduleLaRegen();
      });
    });
    $('#btnLaRegen').addEventListener('click', generateLineart);
    $('#btnLaSave').addEventListener('click', saveLineart);
    $('#btnLaShare').addEventListener('click', function () {
      native('shareText', '我用「聚搜图库 · 图转线稿」生成了一张转印线稿');
    });

    // 查看器
    $('#btnViewerClose').addEventListener('click', closeViewer);
    $('#vPrev').addEventListener('click', function () { viewerStep(-1); });
    $('#vNext').addEventListener('click', function () { viewerStep(1); });
    $('#btnVDownload').addEventListener('click', downloadCurrent);
    $('#btnVStencil').addEventListener('click', stencilFromViewer);
    $('#btnVMiaobian').addEventListener('click', miaobianFromViewer);
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

    // 线稿
    $('#btnPick').addEventListener('click', function () {
      if (DEMO) { setStencilImage(demoSvg('pick-' + Date.now())); toast('演示模式：已载入示例图'); }
      else { state.pendingTool = 'stencil'; native('pickImage'); }
    });
    $('#btnFromSearch').addEventListener('click', function () {
      if (!state.items.length) { toast('请先在「搜图」里搜一批图片'); return; }
      switchTab('search'); openViewer(0);
      toast('点查看器里的「✒ 送纹身线稿」「✎ 送秒变线稿」「◈ 送图转线稿」即可导入');
    });
    $$('#stModes button').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!state.stencil.result) { toast('请先生成线稿'); return; }
        state.stencil.mode = b.dataset.mode; renderStage();
      });
    });
    $$('#stPreset button').forEach(function (b) {
      b.addEventListener('click', function () {
        state.stencil.preset = parseInt(b.dataset.v, 10);
        $$('#stPreset button').forEach(function (x) { x.classList.toggle('active', x === b); });
        generateStencil();
      });
    });
    $('#stStrength').addEventListener('input', function () {
      state.stencil.strength = parseInt(this.value, 10);
      $('#stStrengthVal').textContent = this.value;
    });
    $('#stStrength').addEventListener('change', scheduleRegen);
    $('#stDetail').addEventListener('input', function () {
      state.stencil.detail = parseInt(this.value, 10);
      $('#stDetailVal').textContent = this.value;
    });
    $('#stDetail').addEventListener('change', scheduleRegen);
    $('#stClean').addEventListener('change', function () { state.stencil.clean = this.checked; scheduleRegen(); });
    $('#btnRegen').addEventListener('click', generateStencil);
    $('#btnSaveStencil').addEventListener('click', saveStencil);
    $('#btnShareStencil').addEventListener('click', function () {
      native('shareText', '我用「聚搜图库 · 纹身线稿工作台」生成了一张转印线稿');
    });
    $('#stAdvToggle').addEventListener('click', function () {
      var b = $('#stAdv'), hidden = b.classList.toggle('hidden');
      this.textContent = hidden ? '展开 ▾' : '收起 ▴';
    });
    setupCompareDrag();

    // 下载记录
    $('#btnClearDl').addEventListener('click', function () {
      state.downloads = [];
      try { localStorage.removeItem('jusou_downloads'); } catch (e) {}
      renderDownloads(); toast('记录已清空');
    });

    // 设置
    $('#btnChooseDir').addEventListener('click', function () {
      if (DEMO) {
        window.__onNativeDir({ ok: true, dirLabel: '自定义目录：MyPictures（演示）' });
      } else native('chooseDownloadDir');
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
    window.addEventListener('message', onMbMessage);
    bind();
    apiGet('/api/sources').then(function (r) {
      state.sources = r.sources || [];
      return apiGet('/api/settings');
    }).then(fillSettings).catch(function () {
      state.sources = DEMO_SOURCES;
    }).then(function () {
      renderStage();
      renderLineartStage();
      renderSwatches();
      if (DEMO) toast('演示模式：展示的是模拟数据，真机内会检索真实图源');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
