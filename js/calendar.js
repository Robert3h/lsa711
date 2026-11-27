// 全部傳訊的「月曆」（2026-11-27，Robert 的點子）：點月份看那個月的日曆，點有圓點的日子列出那天的傳訊。
// 月曆的格子由 build_site.py（site_page_archive.py）產生；這裡只負責點選、列出、最新那天閃三次藍圈。
// 列出的傳訊直接從下面的清單複製，標題、連結、艙房標籤都和清單一模一樣，不另外記資料。
(function () {
  var cal = document.querySelector('.arc-cal');
  if (!cal) return;
  var tiles = cal.querySelectorAll('.cal-mo[data-ym]');
  var months = cal.querySelectorAll('.cal-month');
  var head = cal.querySelector('.cal-pick-h'), out = cal.querySelector('.cal-picked ul');
  var items = document.querySelectorAll('.archive .arc-item');
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  var now = new Date(), today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  cal.querySelectorAll('.cal-day[data-date]').forEach(function (c) { if (c.dataset.date > today) c.classList.add('later'); });
  var has = cal.querySelectorAll('.cal-day.has');
  var newest = Array.prototype.reduce.call(has, function (m, b) { return b.dataset.date > m ? b.dataset.date : m; }, '');

  function showMonth(ym) {
    tiles.forEach(function (t) { t.setAttribute('aria-pressed', String(t.dataset.ym === ym)); });
    months.forEach(function (m) { m.hidden = m.dataset.ym !== ym; });
  }
  function showDay(date) {
    has.forEach(function (b) { b.classList.toggle('sel', b.dataset.date === date); });
    var p = date.split('-');
    out.innerHTML = '';
    var n = 0;
    items.forEach(function (li) {
      var d = li.querySelector('.log');
      if (!d || d.textContent !== date) return;
      var c = li.cloneNode(true); c.hidden = false; out.appendChild(c); n++;
    });
    head.textContent = +p[1] + ' 月 ' + +p[2] + ' 日' + (date === newest ? '（最新）' : '') + ' · ' + n + ' 則';
  }
  function lastDayOf(ym) {
    var d = '';
    has.forEach(function (b) { if (b.dataset.date.slice(0, 7) === ym && b.dataset.date > d) d = b.dataset.date; });
    return d;
  }
  // 點月份：打開那個月，順便列出那個月最後一個有傳訊的日子，右邊才不會空著
  tiles.forEach(function (t) {
    t.addEventListener('click', function () { showMonth(t.dataset.ym); showDay(lastDayOf(t.dataset.ym)); flash(); });
  });
  has.forEach(function (b) { b.addEventListener('click', function () { showDay(b.dataset.date); }); });

  // 最新那天閃三次藍圈（和星海圖同一個藍、同樣的節奏）。重新加 class 才會從頭播
  function flash() {
    has.forEach(function (b) {
      if (b.dataset.date !== newest) return;
      b.classList.remove('cal-new'); void b.offsetWidth; b.classList.add('cal-new');
    });
  }
  if (newest) { showMonth(newest.slice(0, 7)); showDay(newest); }
  // 等月曆真的出現在畫面上才閃：預設是清單，切到月曆時動畫才不會早就播完（和星海圖同一招）
  if ('IntersectionObserver' in window) {
    var seen = false;
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting && !seen) flash(); seen = e.isIntersecting; });
    }).observe(cal);
  } else flash();
})();
