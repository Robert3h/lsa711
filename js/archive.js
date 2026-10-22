// 全部傳訊：依艙房篩選（單選）。網址加 #A／#B／#C 可以直接打開某一類，方便在貼文裡分享。
// 沒有 JS 時全部顯示，內容不會不見。
(function () {
  var buttons = document.querySelectorAll('.arc-filter');
  var items = document.querySelectorAll('.arc-item');
  var months = document.querySelectorAll('.arc-month');
  var status = document.querySelector('.arc-status');
  var NAMES = { all: '全部', A: 'LSA生活隨筆', B: 'LSA五層電子報', C: 'Ginni與Julian小劇場' };

  function apply(room) {
    if (!NAMES[room]) room = 'all';
    var shown = 0;
    items.forEach(function (li) {
      var ok = room === 'all' || li.getAttribute('data-room') === room;
      li.hidden = !ok;
      if (ok) shown++;
    });
    // 某個月份底下都被篩掉時，連月份標題一起藏起來
    months.forEach(function (m) { m.hidden = !m.querySelector('.arc-item:not([hidden])'); });
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-room') === room)); });
    if (status) status.textContent = '顯示：' + NAMES[room] + '，共 ' + shown + ' 則';
  }

  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      var room = b.getAttribute('data-room');
      apply(room);
      try { history.replaceState(null, '', room === 'all' ? location.pathname : '#' + room); } catch (e) {}
    });
  });
  apply((location.hash || '').replace('#', '').toUpperCase() || 'all');
})();
