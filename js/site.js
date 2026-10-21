// 網站互動：只有三件事。沒有 JS 時網站照樣能讀，只是少了這些便利功能。
(function () {
  // ---------- 1. 深色／淺色主題切換 ----------
  // 預設深色；讀者選過之後記在自己的瀏覽器裡（無痕模式記不住也不影響閱讀）
  var root = document.documentElement;
  // 英文頁面的按鈕與提示文字改用英文
  var EN = (root.getAttribute('lang') || '').indexOf('en') === 0;
  var toggle = document.querySelector('.theme-toggle');
  function paint() {
    var dark = root.getAttribute('data-theme') !== 'light';
    if (toggle) {
      toggle.textContent = EN ? (dark ? 'Light mode' : 'Dark mode') : (dark ? '切換淺色' : '切換深色');
      toggle.setAttribute('aria-pressed', String(!dark));
    }
  }
  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      paint();
    });
  }
  paint();

  // ---------- 2. 按 Email 時直接複製，並提示 ----------
  // 很多人電腦沒設定郵件程式，按 mailto 會沒反應；複製下來貼到自己的信箱最穩
  var toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  document.body.appendChild(toast);
  var timer;
  function say(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(function () { toast.classList.remove('show'); }, 2600);
  }
  function fallbackCopy(text) {
    var t = document.createElement('textarea');
    t.value = text; t.setAttribute('readonly', '');
    t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(t);
    return ok;
  }
  document.querySelectorAll('a[href^="mailto:"]').forEach(function (a) {
    a.addEventListener('click', function (ev) {
      ev.preventDefault();
      var email = a.getAttribute('href').replace('mailto:', '');
      var ok = EN ? 'Email copied: ' : '已複製 Email：';
      var done = function () { say(ok + email); };
      var fail = function () { say(fallbackCopy(email) ? ok + email : (EN ? 'Please copy manually: ' : '請手動複製：') + email); };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(email).then(done, fail);
      } else { fail(); }
    });
  });

  // ---------- 2a. 「複製提示詞」等按鈕：data-copy 指向要複製的元素 ----------
  document.querySelectorAll('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var src = document.querySelector(b.getAttribute('data-copy'));
      if (!src) return;
      var text = src.textContent;
      var msg = b.getAttribute('data-copied') || (EN ? 'Copied' : '已複製');
      var done = function () { say(msg); };
      var fail = function () { say(fallbackCopy(text) ? msg : (EN ? 'Copy failed — please open the full prompt below and copy it manually.' : '複製失敗，請展開下方的完整提示詞手動複製。')); };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fail);
      else fail();
    });
  });

  // ---------- 2a-2. 首頁傳訊列：7 天內的消息顯示 NEW（依讀者當下的真實日期判斷） ----------
  document.querySelectorAll('.news-item[data-date]').forEach(function (a) {
    var d = new Date(a.getAttribute('data-date') + 'T00:00:00+08:00');
    var days = (Date.now() - d.getTime()) / 86400000;
    var tag = a.querySelector('.news-new');
    if (tag && days >= 0 && days < 7) tag.hidden = false;
  });

  // ---------- 2b. 文章裡的 🥚：撿起傳訊碎片（小遊戲 03） ----------
  // 收集紀錄只存在讀者自己的瀏覽器；存不了（無痕模式）也照樣顯示提示
  var FKEY = 'lsa-fragments';
  function readFrags() { try { return JSON.parse(localStorage.getItem(FKEY) || '[]'); } catch (e) { return []; } }
  document.querySelectorAll('[data-fragment]').forEach(function (b) {
    var id = b.getAttribute('data-fragment');
    var total = +b.getAttribute('data-total');
    function mark() { if (readFrags().indexOf(id) >= 0) { b.classList.add('got'); b.setAttribute('aria-label', '這段傳訊碎片已收到'); } }
    mark();
    b.addEventListener('click', function () {
      var f = readFrags();
      if (f.indexOf(id) < 0) f.push(id);
      try { localStorage.setItem(FKEY, JSON.stringify(f)); } catch (e) {}
      mark();
      say('收到傳訊碎片 ' + f.length + ' / ' + total + '。到「即將上映 → 傳訊碎片」查看。');
    });
  });

  // ---------- 2c. 浮動「全部文章」按鈕：捲過文章標題才出現 ----------
  // 沒有 JS 時按鈕一直顯示，功能不會消失
  var fnav = document.querySelector('.float-nav');
  var head = document.querySelector('.article-head');
  if (fnav && head) {
    var checkNav = function () { fnav.classList.toggle('is-hidden', head.getBoundingClientRect().bottom > 0); };
    window.addEventListener('scroll', checkNav, { passive: true });
    checkNav();
  }

  // ---------- 3. 幻燈片 ----------
  document.querySelectorAll('.slides').forEach(function (box) {
    var track = box.querySelector('.slides-track');
    var items = track.querySelectorAll('figure');
    var prev = box.querySelector('[data-dir="-1"]');
    var next = box.querySelector('[data-dir="1"]');
    var count = box.querySelector('.slides-count');
    var current = 0;
    function update() {
      current = Math.round(track.scrollLeft / track.clientWidth);
      count.textContent = (current + 1) + ' / ' + items.length;
      prev.disabled = current === 0;
      next.disabled = current === items.length - 1;
    }
    function go(i) {
      i = Math.max(0, Math.min(items.length - 1, i));
      track.scrollTo({ left: i * track.clientWidth });
    }
    prev.addEventListener('click', function () { go(current - 1); });
    next.addEventListener('click', function () { go(current + 1); });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(current + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(current - 1); }
    });
    var raf;
    track.addEventListener('scroll', function () {
      cancelAnimationFrame(raf); raf = requestAnimationFrame(update);
    });
    window.addEventListener('resize', update);
    update();
  });
})();
