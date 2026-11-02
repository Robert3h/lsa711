// 有共鳴（2026-11-02）：網站各處的按讚。和「傳訊給我」共用 Robert 的 Google Apps Script，讚數存在他的 Google 試算表。
// 不用登入、不用 Cookie、不送任何讀者資料；同一個瀏覽器同一項只能按一次（記在讀者自己的瀏覽器裡）。
// 一頁可以有好幾顆（設定集頁的每本相簿、每個 3D 導覽…），打開頁面時一次問完所有讚數。
// 按鈕一開始是隱藏的，問到讚數才出現：Google 連不上時，讀者不會看到按了沒反應的按鈕。
(function () {
  var boxes = Array.prototype.slice.call(document.querySelectorAll('.resonate'));
  if (!boxes.length || !window.fetch || !window.URLSearchParams) return;
  var url = boxes[0].getAttribute('data-endpoint');
  var counts = {};

  function key(b) { return b.getAttribute('data-slug'); }
  function liked(k) { try { return localStorage.getItem('lsa-resonate-' + k) === '1'; } catch (e) { return false; } }
  function remember(k) { try { localStorage.setItem('lsa-resonate-' + k, '1'); } catch (e) {} }
  function show(b) {
    var n = counts[key(b)] || 0;
    var en = b.getAttribute('data-lang') === 'en';
    b.querySelector('.resonate-count').textContent = n > 0 ? (en ? n + ' resonated' : n + ' 人有共鳴') : '';
  }
  function mark(b) {
    var btn = b.querySelector('.resonate-btn');
    btn.setAttribute('aria-pressed', 'true'); btn.disabled = true; b.classList.add('is-on');
  }
  // 同一個代號在同一頁出現好幾次時，一起更新
  function each(k, fn) { boxes.forEach(function (b) { if (key(b) === k) fn(b); }); }

  var keys = [];
  boxes.forEach(function (b) { if (keys.indexOf(key(b)) < 0) keys.push(key(b)); });

  fetch(url + '?likes=' + encodeURIComponent(keys.join(',')))
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function (j) {
      if (!j.ok || !j.counts) throw new Error('not ok');
      counts = j.counts;
      boxes.forEach(function (b) { show(b); if (liked(key(b))) mark(b); b.hidden = false; });
    })
    .catch(function () {});

  boxes.forEach(function (b) {
    b.querySelector('.resonate-btn').addEventListener('click', function () {
      var k = key(b);
      if (liked(k)) return;
      // 先亮起來、數字先加一，不用等 Google 回應（第一次可能要 1～2 秒）
      remember(k); counts[k] = (counts[k] || 0) + 1;
      each(k, function (x) { mark(x); show(x); });
      fetch(url, { method: 'POST', body: new URLSearchParams({ like: k, title: b.getAttribute('data-name') || '' }) })
        .then(function (r) { return r.json(); })
        .then(function (j) { if (j.ok && typeof j.count === 'number') { counts[k] = j.count; each(k, show); } })
        .catch(function () {});
    });
  });
})();
