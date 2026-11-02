// 有共鳴（2026-11-02）：文章頁的按讚。和「傳訊給我」共用 Robert 的 Google Apps Script，讚數存在他的 Google 試算表。
// 不用登入、不用 Cookie、不送任何讀者資料；同一個瀏覽器同一篇只能按一次（記在讀者自己的瀏覽器裡）。
// 按鈕一開始是隱藏的，問到讚數才出現：Google 連不上時，讀者不會看到一顆按了沒反應的按鈕。
(function () {
  var box = document.querySelector('.resonate');
  if (!box || !window.fetch || !window.URLSearchParams) return;
  var url = box.getAttribute('data-endpoint');
  var slug = box.getAttribute('data-slug');
  var btn = box.querySelector('.resonate-btn');
  var num = box.querySelector('.resonate-count');
  var KEY = 'lsa-resonate-' + slug;
  var count = 0;

  function liked() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function remember() { try { localStorage.setItem(KEY, '1'); } catch (e) {} }
  function show() { num.textContent = count > 0 ? count + ' 人有共鳴' : ''; }
  function mark() { btn.setAttribute('aria-pressed', 'true'); btn.disabled = true; box.classList.add('is-on'); }

  fetch(url + '?likes=' + encodeURIComponent(slug))
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function (j) {
      if (!j.ok || !j.counts) throw new Error('not ok');
      count = j.counts[slug] || 0;
      show();
      if (liked()) mark();
      box.hidden = false;
    })
    .catch(function () {});

  btn.addEventListener('click', function () {
    if (liked()) return;
    // 先亮起來、數字先加一，不用等 Google 回應（第一次可能要 1～2 秒）
    mark(); remember(); count++; show();
    fetch(url, { method: 'POST', body: new URLSearchParams({ like: slug, title: box.getAttribute('data-title') || '' }) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j.ok && typeof j.count === 'number') { count = j.count; show(); } })
      .catch(function () {});
  });
})();
