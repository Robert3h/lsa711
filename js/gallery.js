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

  function show(n) {
    i = (n + list.length) % list.length;
    var it = list[i];
    img.src = it.src;
    img.alt = it.alt || '';
    cap.textContent = (title ? title + ' · ' : '') + (i + 1) + ' / ' + list.length + (it.cap ? ' · ' + it.cap : '');
  }
  function open(items, n, t, btn) {
    list = items; title = t || ''; opener = btn;
    show(n);
    box.hidden = false;
    document.body.style.overflow = 'hidden';   // 放大時背景不跟著捲動
    box.querySelector('.lb-close').focus();
  }
  function close() {
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
  document.querySelectorAll('.album-open').forEach(function (b) {
    var t = b.getAttribute('data-title');
    var items = JSON.parse(b.getAttribute('data-album')).map(function (src, k) {
      return { src: src, alt: t + ' 第 ' + (k + 1) + ' 張', cap: '' };
    });
    b.addEventListener('click', function () { open(items, 0, t, b); });
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
