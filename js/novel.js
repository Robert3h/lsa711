// 小說試讀的閱讀模式（2026-11-03）。
// 排版：內文用 CSS 多欄排成「一欄＝一頁」，翻頁就是把整條往左右移一頁寬。換字級、轉手機方向時重新算頁數，
// 並用「讀到全書的幾成」找回原本的位置。
// 記在讀者自己的瀏覽器：讀到哪裡、字級、行距、紙色、音量。背景音樂只在讀者按 ♪ 時才播放。
(function () {
  var reader = document.querySelector('.reader');
  if (!reader) return;
  var pages = reader.querySelector('.nv-pages');
  var flow = reader.querySelector('.nv-flow');
  var count = reader.querySelector('.nv-count');
  var where = reader.querySelector('.nv-ch');
  var bar = reader.querySelector('.nv-progress i');
  var chapters = Array.prototype.slice.call(flow.querySelectorAll('.nv-chapter'));
  var POS = 'novel-pos', PREFS = 'novel-prefs';
  var SIZES = [16, 17, 18, 20, 22];
  var page = 0, total = 1, step = 1;

  function load(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var prefs = load(PREFS, { size: 2, lh: 'normal', paper: 'site', vol: 60 });

  function applyPrefs() {
    reader.style.setProperty('--nv-size', SIZES[prefs.size] + 'px');
    reader.setAttribute('data-lh', prefs.lh);
    reader.setAttribute('data-paper', prefs.paper);
    Array.prototype.forEach.call(reader.querySelectorAll('[data-lh],[data-paper]'), function (b) {
      if (b.tagName !== 'BUTTON') return;
      var on = b.getAttribute('data-lh') === prefs.lh || b.getAttribute('data-paper') === prefs.paper;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  // 量版面：一頁的高度＝視窗高度扣掉頁首和上下工具列；寬度＝閱讀區寬度
  function layout(keepFrac) {
    var frac = keepFrac !== undefined ? keepFrac : (total > 1 ? page / (total - 1) : 0);
    // 閱讀區在頁面上的位置（頁首是固定的，所以頁面捲到最上面時，這就是閱讀區上緣離視窗頂端的距離）
    var top = pages.getBoundingClientRect().top + window.scrollY;
    var cs = getComputedStyle(pages);
    var pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    var foot = reader.querySelector('.nv-foot').getBoundingClientRect().height;
    var h = Math.max(320, Math.min(900, window.innerHeight - top - pad - foot - 28));
    var w = pages.querySelector('.nv-clip').clientWidth;
    var gap = 48;
    reader.style.setProperty('--nv-h', h + 'px');
    reader.style.setProperty('--nv-w', w + 'px');
    reader.style.setProperty('--nv-gap', gap + 'px');
    step = w + gap;
    total = Math.max(1, Math.round((flow.scrollWidth + gap) / step));
    go(Math.round(frac * (total - 1)), true);
  }

  function chapterAt(p) {
    var name = '';
    chapters.forEach(function (c) { if (Math.floor(c.offsetLeft / step + 0.01) <= p) name = c.getAttribute('data-title'); });
    return name;
  }

  function go(p, instant) {
    page = Math.max(0, Math.min(total - 1, p));
    if (instant) flow.style.transition = 'none';
    flow.style.transform = 'translateX(' + (-page * step) + 'px)';
    if (instant) { flow.offsetWidth; flow.style.transition = ''; }
    count.textContent = (page + 1) + ' / ' + total;
    var ch = chapterAt(page);
    where.textContent = ch ? '・' + ch : '';
    bar.style.width = (total > 1 ? page / (total - 1) * 100 : 100) + '%';
    reader.querySelector('.nv-prev').disabled = page === 0;
    reader.querySelector('.nv-next').disabled = page === total - 1;
    save(POS, total > 1 ? page / (total - 1) : 0);
  }
  function next() { go(page + 1); }
  function prev() { go(page - 1); }

  reader.querySelector('.nv-next').addEventListener('click', next);
  reader.querySelector('.nv-prev').addEventListener('click', prev);

  // 鍵盤：閱讀區取得焦點時，← → 翻頁；PageUp／PageDown、空白鍵也可以
  pages.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(total - 1); }
  });

  // 手指左右滑翻頁；沒有滑動的輕點：點左邊三分之一往前、右邊三分之一往後（點到連結、按鈕不算）
  var sx = null, sy = 0;
  pages.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; });
  pages.addEventListener('pointerup', function (e) {
    if (sx === null) return;
    var dx = e.clientX - sx, dy = e.clientY - sy;
    sx = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { dx < 0 ? next() : prev(); return; }
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && !e.target.closest('a,button')) {
      var r = pages.getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
      if (x < 0.33) prev(); else if (x > 0.67) next();
    }
  });

  // 目錄與設定面板：一次只開一個
  Array.prototype.forEach.call(reader.querySelectorAll('[data-panel]'), function (b) {
    b.addEventListener('click', function () {
      var id = b.getAttribute('data-panel');
      Array.prototype.forEach.call(reader.querySelectorAll('[data-panel]'), function (o) {
        var open = o === b && o.getAttribute('aria-expanded') !== 'true';
        o.setAttribute('aria-expanded', open ? 'true' : 'false');
        document.getElementById(o.getAttribute('data-panel')).hidden = !open;
      });
      layout();
    });
  });
  Array.prototype.forEach.call(reader.querySelectorAll('[data-go]'), function (b) {
    b.addEventListener('click', function () {
      var t = document.getElementById(b.getAttribute('data-go'));
      go(Math.floor(t.offsetLeft / step + 0.01));
      pages.focus();
    });
  });

  Array.prototype.forEach.call(reader.querySelectorAll('[data-size]'), function (b) {
    b.addEventListener('click', function () {
      prefs.size = Math.max(0, Math.min(SIZES.length - 1, prefs.size + Number(b.getAttribute('data-size'))));
      save(PREFS, prefs); applyPrefs(); layout();
    });
  });
  Array.prototype.forEach.call(reader.querySelectorAll('button[data-lh]'), function (b) {
    b.addEventListener('click', function () { prefs.lh = b.getAttribute('data-lh'); save(PREFS, prefs); applyPrefs(); layout(); });
  });
  Array.prototype.forEach.call(reader.querySelectorAll('button[data-paper]'), function (b) {
    b.addEventListener('click', function () { prefs.paper = b.getAttribute('data-paper'); save(PREFS, prefs); applyPrefs(); });
  });

  // 背景音樂：讀者按 ♪ 才播放，淡入淡出；音量拉桿記在讀者自己的瀏覽器（iPhone 不允許程式調音量）
  var audio = reader.querySelector('.nv-bgm');
  var mBtn = reader.querySelector('.nv-music');
  var vol = reader.querySelector('.nv-vol');
  if (audio && mBtn) {
    var fadeTimer = null;
    var fade = function (to, ms, done) {
      clearInterval(fadeTimer);
      var from = audio.volume, n = 0, steps = Math.max(1, Math.round(ms / 50));
      fadeTimer = setInterval(function () {
        n++; audio.volume = Math.min(1, Math.max(0, from + (to - from) * n / steps));
        if (n >= steps) { clearInterval(fadeTimer); if (done) done(); }
      }, 50);
    };
    if (vol) {
      vol.value = prefs.vol;
      vol.addEventListener('input', function () {
        prefs.vol = Number(vol.value); save(PREFS, prefs);
        if (!audio.paused) { clearInterval(fadeTimer); audio.volume = prefs.vol / 100; }
      });
    }
    mBtn.addEventListener('click', function () {
      if (audio.paused) {
        audio.volume = 0;
        var p = audio.play();
        mBtn.setAttribute('aria-pressed', 'true');
        fade(prefs.vol / 100, 1500);
        if (p && p.catch) p.catch(function () { mBtn.setAttribute('aria-pressed', 'false'); });
      } else {
        mBtn.setAttribute('aria-pressed', 'false');
        fade(0, 600, function () { audio.pause(); });
      }
    });
  }

  applyPrefs();
  var resizeTimer = null;
  window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(function () { layout(); }, 150); });
  // 字型、圖片載入後版面會變，等全部載完再算一次
  layout(load(POS, 0));
  window.addEventListener('load', function () { layout(); });
})();
