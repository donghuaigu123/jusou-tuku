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
    var arr = [], n = 36;
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
      limit: 100, safe: true, sort: 'score', maxResults: 100,
      sources: SRC_KEYS, keys: { pixabay: false, pexels: false, unsplash: false }
    };
    if (path.indexOf('/api/app') === 0) return { ok: true, name: '聚搜图库', version: '1.0.0', maxResults: 100 };
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
  function demoPost(path) { return { ok: true }; }

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

  // ---------------------------------------------------------------- 状态
  var state = {
    tab: 'search', query: '', items: [], sorted: [], sort: 'score',
    sources: [], enabled: {}, settings: {}, viewerIndex: 0, lastBack: 0,
    stencil: { image: '', result: '', mode: 'result', preset: 1, strength: 50, detail: 50, clean: true },
    downloads: []
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
  function setupCompareDrag() {
    var box = $('#stCompare'), line = $('#stCompareLine'), b = $('#stCompareB');
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
      if (state.stencil.mode === 'compare') start(e);
    }, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', end);
    line.addEventListener('mousedown', start);
    box.addEventListener('mousedown', function (e) { if (state.stencil.mode === 'compare') start(e); });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', end);
  }

  // ---------------------------------------------------------------- 下载记录
  function renderDownloads() {
    var list = $('#dlList'); list.innerHTML = '';
    $('#dlEmpty').classList.toggle('hidden', state.downloads.length > 0);
    $('#dlDirLabel').textContent = state.settings.dirLabel || '系统下载 / 聚搜图库';
    state.downloads.forEach(function (d) {
      var thumb = DEMO
        ? (String(d.thumb).indexOf('data:') === 0 ? d.thumb : demoSvg(d.thumb))
        : imgUrl(d.thumb, '');
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
    $('#setLimit').value = s.limit || 100;
    $('#setLimitVal').textContent = s.limit || 100;
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

  // ---------------------------------------------------------------- Tab / 返回
  function switchTab(t) {
    state.tab = t;
    $$('#tabbar button').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === t); });
    $('#app').classList.toggle('hidden', t !== 'search');
    $('#pageStencil').classList.toggle('hidden', t !== 'stencil');
    $('#pageDownloads').classList.toggle('hidden', t !== 'downloads');
    $('#pageSettings').classList.toggle('hidden', t !== 'settings');
    window.scrollTo(0, 0);
    $('.page:not(.hidden)') && ($('.page:not(.hidden)').scrollTop = 0);
    if (t === 'settings') loadSettings();
    if (t === 'downloads') renderDownloads();
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
    if (m && m.ok && m.url) {
      busy(true, '正在读取所选图片…');
      blobToDataUrl(m.url).then(function (dataUrl) {
        switchTab('stencil'); setStencilImage(dataUrl);
      }).catch(function (e) { toast('图片读取失败：' + e.message); })
        .then(function () { busy(false); });
      return;
    }
    busy(false);
    if (m && m.ok && m.image) { switchTab('stencil'); setStencilImage(m.image); }
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

    // 查看器
    $('#btnViewerClose').addEventListener('click', closeViewer);
    $('#vPrev').addEventListener('click', function () { viewerStep(-1); });
    $('#vNext').addEventListener('click', function () { viewerStep(1); });
    $('#btnVDownload').addEventListener('click', downloadCurrent);
    $('#btnVStencil').addEventListener('click', stencilFromViewer);
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
      else native('pickImage');
    });
    $('#btnFromSearch').addEventListener('click', function () {
      if (!state.items.length) { toast('请先在「搜图」里搜一批图片'); return; }
      switchTab('search'); openViewer(0);
      toast('点查看器里的「✒ 转线稿」即可导入');
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
    bind();
    apiGet('/api/sources').then(function (r) {
      state.sources = r.sources || [];
      return apiGet('/api/settings');
    }).then(fillSettings).catch(function () {
      state.sources = DEMO_SOURCES;
    }).then(function () {
      renderStage();
      if (DEMO) toast('演示模式：展示的是模拟数据，真机内会检索真实图源');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
