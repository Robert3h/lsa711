// 放大檢視：劇照牆與相簿共用同一個檢視框。
//   劇照牆：點哪張就從哪張開始，左右切換整面牆的照片。
//   相簿（2026-10-27）：點封面從第 1 張開始，左右翻整本相簿。
// 操作：左右鍵／按鈕／手機左右滑切換，Esc 或點背景關閉；關閉後把焦點還給原本的按鈕，鍵盤使用者不會迷路。
(function () {
  var box = document.querySelector('.lightbox');
  if (!box) return;
  var img = box.querySelector('img');
  var cap = box.querySelector('figcaption');
  var list = [], i = 0, title = '', opener = null;
  var EN = (document.documentElement.lang || '').indexOf('en') === 0;
  var next = box.querySelector('.lb-next');

  // 全螢幕（Robert 2026-11-12，比照文章幻燈片的「⛶ 全螢幕」）：檢視框本來就鋪滿瀏覽器視窗，
  // 這顆按鈕再把網址列、分頁列也藏起來，投影片的字才夠大。
  // 瀏覽器不支援（例如 iPhone 的 Safari）就不放按鈕：看起來能按、按了卻沒反應，比沒有按鈕更糟。
  var full = null;
  if (document.fullscreenEnabled && box.requestFullscreen) {
    full = document.createElement('button');
    full.type = 'button';
    full.className = 'lb-full';
    box.appendChild(full);
    full.addEventListener('click', function () {
      if (document.fullscreenElement === box) document.exitFullscreen().catch(function () {});
      else box.requestFullscreen().catch(function () {});
    });
  }
  // 手機直拿看橫圖時，按全螢幕就自動轉成橫向（Robert 2026-11-13：「貼心的 UI 就決定做」）。
  // 只在「手機、直拿、橫圖、已進入全螢幕」時鎖橫向：瀏覽器規定要在全螢幕裡才能鎖方向；
  // 直圖（4:5）本來就適合直拿，不轉；電腦、平板不轉。iPhone 的 Safari 不支援，lock 不存在就什麼都不做。
  // 離開全螢幕就解除，讀者的手機回到原本的自動旋轉設定。
  var turned = false;
  function turnFor(pic) {
    var o = screen.orientation;
    if (!o || !o.lock || !pic || !pic.naturalWidth) return;
    var wide = pic.naturalWidth > pic.naturalHeight * 1.1;
    var phone = Math.min(screen.width, screen.height) < 600;
    if (wide && phone && !turned && o.type.indexOf('portrait') === 0) {
      o.lock('landscape').then(function () { turned = true; }).catch(function () {});
    } else if (!wide && turned) {
      unturn();
    }
  }
  function unturn() {
    if (!turned) return;
    turned = false;
    try { screen.orientation.unlock(); } catch (e) {}
  }
  function fullLabel() {
    var on = document.fullscreenElement === box;
    if (on) turnFor(img); else unturn();
    if (!full) return;
    box.classList.toggle('is-full', on);
    full.textContent = on ? (EN ? '✕ Exit full screen' : '✕ 離開全螢幕') : (EN ? '⛶ Full screen' : '⛶ 全螢幕');
  }
  // 不管是按鈕、Esc 還是手機返回鍵離開全螢幕，按鈕的字都跟著換回來
  document.addEventListener('fullscreenchange', fullLabel);
  fullLabel();
  // 全螢幕裡翻到另一張（例如從橫圖翻到直圖）：等新圖載入、知道長寬後再決定轉不轉
  img.addEventListener('load', function () { if (document.fullscreenElement === box) turnFor(img); });

  function show(n) {
    i = (n + list.length) % list.length;
    var it = list[i];
    img.src = it.src;
    img.alt = it.alt || '';
    cap.textContent = (title ? title + ' · ' : '') + (i + 1) + ' / ' + list.length + (it.cap ? ' · ' + it.cap : '');
    // 最後一張的 → 改成 ↺（Robert 2026-11-12，比照幻燈片）：本來按下去就會繞回第一張，
    // 但箭頭看不出來；換成 ↺ 讀者才知道「看完了，按這裡從頭再看」
    var last = list.length > 1 && i === list.length - 1;
    next.textContent = last ? '↺' : '→';
    next.setAttribute('aria-label', last ? (EN ? 'Back to the first image' : '回第一張') : (EN ? 'Next image' : '下一張'));
    next.title = last ? (EN ? 'Back to the first image' : '回第一張') : '';
  }
  function open(items, n, t, btn) {
    list = items; title = t || ''; opener = btn;
    show(n);
    box.hidden = false;
    document.body.style.overflow = 'hidden';   // 放大時背景不跟著捲動
    box.querySelector('.lb-close').focus();
  }
  function close() {
    if (document.fullscreenElement === box) document.exitFullscreen().catch(function () {});
    box.hidden = true;
    document.body.style.overflow = '';
    if (opener) opener.focus();
  }

  // 劇照牆
  var wall = Array.prototype.slice.call(document.querySelectorAll('.gal-open'));
  var wallItems = wall.map(function (b) {
    var c = b.getAttribute('data-caption');
    return { src: b.getAttribute('data-full'), alt: b.querySelector('img').alt, cap: c && c !== '暫代圖' ? c : '' };
  });
  wall.forEach(function (b, n) { b.addEventListener('click', function () { open(wallItems, n, '', b); }); });

  // 相簿
  var EN_PAGE = (document.documentElement.lang || '').indexOf('en') === 0;
  function albumItems(json, t) {
    return JSON.parse(json).map(function (src, k) {
      // 英文版設定集（en.html）用英文報讀
      return { src: src, alt: EN_PAGE ? t + ', image ' + (k + 1) : t + ' 第 ' + (k + 1) + ' 張', cap: '' };
    });
  }
  // 網站導覽（2026-11-12）：封面同時帶 16:9 和 4:5 兩組，點下去時才看螢幕是直是橫，
  // 讀者中途把手機轉橫，下一次點就會換成適合的那組；條件和 CSS 的 (orientation: portrait) 一樣
  var PORTRAIT = window.matchMedia ? window.matchMedia('(orientation: portrait)') : null;
  document.querySelectorAll('.album-open').forEach(function (b) {
    var t = b.getAttribute('data-title');
    var items = albumItems(b.getAttribute('data-album'), t);
    var tallJson = b.getAttribute('data-album-tall');
    var tt = b.getAttribute('data-title-tall');
    var tall = tallJson ? albumItems(tallJson, tt) : null;
    b.addEventListener('click', function () {
      if (tall && PORTRAIT && PORTRAIT.matches) open(tall, 0, tt, b);
      else open(items, 0, t, b);
    });
  });

  box.querySelector('.lb-close').addEventListener('click', close);
  box.querySelector('.lb-prev').addEventListener('click', function () { show(i - 1); });
  box.querySelector('.lb-next').addEventListener('click', function () { show(i + 1); });
  box.addEventListener('click', function (e) { if (e.target === box) close(); });
  document.addEventListener('keydown', function (e) {
    if (box.hidden) return;
    // 焦點留在放大視窗裡：Tab 只在三顆按鈕之間繞，不會跑到背後的頁面（健檢 C4）
    if (e.key === 'Tab') {
      var f = [box.querySelector('.lb-close'), box.querySelector('.lb-prev'), box.querySelector('.lb-next')];
      if (full) f.unshift(full);
      var k = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(k + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
      return;
    }
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') show(i + 1);
    if (e.key === 'ArrowLeft') show(i - 1);
  });

  // 手機：左右滑動切換（滑動距離超過 50px 才算，避免誤觸）
  var x0 = null;
  box.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  box.addEventListener('touchend', function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1));
    x0 = null;
  });

  // 從別的頁面用 #album-01 這種網址連過來：捲到那本相簿並微微標示
  if (/^#album-\d+$/.test(location.hash)) {
    var target = document.querySelector(location.hash);
    if (target) target.classList.add('album-target');
  }
})();
