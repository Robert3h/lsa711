// 劇照放大檢視：點照片打開，左右鍵／按鈕／手機左右滑切換，Esc 或點背景關閉。
// 關閉後把焦點還給原本那張照片，鍵盤使用者不會迷路。
(function () {
  var box = document.querySelector('.lightbox');
  var items = Array.prototype.slice.call(document.querySelectorAll('.gal-open'));
  if (!box || !items.length) return;
  var img = box.querySelector('img');
  var cap = box.querySelector('figcaption');
  var i = 0, opener = null;

  function show(n) {
    i = (n + items.length) % items.length;
    var it = items[i];
    img.src = it.getAttribute('data-full');
    img.alt = it.querySelector('img').alt;
    var c = it.getAttribute('data-caption');
    cap.textContent = (i + 1) + ' / ' + items.length + (c && c !== '暫代圖' ? ' · ' + c : '');
  }
  function open(n) {
    opener = items[n];
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

  items.forEach(function (b, n) { b.addEventListener('click', function () { open(n); }); });
  box.querySelector('.lb-close').addEventListener('click', close);
  box.querySelector('.lb-prev').addEventListener('click', function () { show(i - 1); });
  box.querySelector('.lb-next').addEventListener('click', function () { show(i + 1); });
  box.addEventListener('click', function (e) { if (e.target === box) close(); });
  document.addEventListener('keydown', function (e) {
    if (box.hidden) return;
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
})();
