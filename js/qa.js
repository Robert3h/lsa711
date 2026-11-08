// 常見問題（2026-11-08）：分類篩選＋錨點。沒有 JS 時全部顯示、點問題一樣能展開（用的是 <details>）。
(function () {
  var buttons = document.querySelectorAll('.qa-filter');
  var items = document.querySelectorAll('.qa-item');

  function filter(cat) {
    items.forEach(function (li) { li.hidden = !(cat === 'all' || li.getAttribute('data-cat') === cat); });
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-cat') === cat)); });
  }
  buttons.forEach(function (b) {
    b.addEventListener('click', function () { filter(b.getAttribute('data-cat')); });
  });

  // 網址帶 #錨點（例：貼文裡連到 qa/#ai-writing）：打開那一題並捲過去；分類若被篩掉，先切回全部
  function openFromHash() {
    var id = decodeURIComponent((location.hash || '').slice(1));
    var d = id && document.getElementById(id);
    if (!d || d.tagName !== 'DETAILS') return;
    filter('all');
    d.open = true;
    d.scrollIntoView({ block: 'start' });
  }
  openFromHash();
  window.addEventListener('hashchange', openFromHash);

  // 讀者自己點開某一題時，把網址換成那一題（不新增瀏覽紀錄），方便直接複製分享
  document.querySelectorAll('details.qa-card').forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (d.open) { try { history.replaceState(null, '', '#' + d.id); } catch (e) {} }
    });
  });
})();
