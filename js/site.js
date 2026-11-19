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
    // 未來日期（先公布的預告）也算新消息；過了 7 天才拿掉 NEW
    if (tag && days < 7) tag.hidden = false;
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
      say('收到傳訊碎片 ' + f.length + ' / ' + total + '。到「小遊戲 → 傳訊碎片」查看。');
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
      // 下一張會露出一截（2026-11-13），每張不再等於整排寬：用「相鄰兩張的距離」當一頁的寬度。
      // 藏起來的那一組（16:9／4:5 二選一）寬度是 0，先當第一頁；捲到底時算最後一張（最後一張靠右對齊，到不了整數頁）
      var s = step();
      var end = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
      current = !s ? 0 : (end && track.scrollLeft > 0) ? items.length - 1 : Math.min(items.length - 1, Math.round(track.scrollLeft / s));
      count.textContent = (current + 1) + ' / ' + items.length;
      prev.disabled = current === 0;
      // 最後一頁的 → 改成「回第一頁」（Robert 2026-11-09）：看完想再從頭看，不用一路往回滑；
      // 第一頁的 ← 仍然停用，因為導讀有開頭有結尾，從封面跳到最後一頁會打亂順序
      var last = current === items.length - 1;
      next.textContent = last ? '↺' : '→';
      next.setAttribute('aria-label', last ? '回第一頁' : '下一頁');
      next.title = last ? '回第一頁' : '';
    }
    function step() {
      return items.length > 1 ? items[1].offsetLeft - items[0].offsetLeft : track.clientWidth;
    }
    function go(i) {
      i = Math.max(0, Math.min(items.length - 1, i));
      track.scrollTo({ left: i * step() });
    }
    prev.addEventListener('click', function () { go(current - 1); });
    next.addEventListener('click', function () { go(current === items.length - 1 ? 0 : current + 1); });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(current + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(current - 1); }
    });
    var raf;
    track.addEventListener('scroll', function () {
      cancelAnimationFrame(raf); raf = requestAnimationFrame(update);
    });
    window.addEventListener('resize', function () {
      // 切換全螢幕、手機轉橫向時寬度會變：先停在原本那一頁，不然會跑到兩頁中間
      track.style.scrollBehavior = 'auto';
      track.scrollLeft = current * step();
      track.style.scrollBehavior = '';
      update();
    });
    update();

    // 全螢幕（Robert 2026-11-10）：按鈕由這裡加上去，沒有 JS 時不會出現一個按了沒反應的按鈕。
    // 點圖片也能打開，因為讀者看不清楚時，第一個反應通常是點那張圖。
    var full = document.createElement('button');
    full.type = 'button';
    full.className = 'slides-full';
    var bar = box.querySelector('.slides-bar');
    bar.appendChild(full);
    function isFull() { return box.classList.contains('is-full'); }
    function label(on) {
      full.textContent = on ? '✕ 關閉' : '⛶ 全螢幕';
      full.setAttribute('aria-label', on ? '關閉全螢幕' : '全螢幕看幻燈片');
      full.setAttribute('aria-pressed', String(on));
    }
    function setFull(on) {
      var keep = current;
      box.classList.toggle('is-full', on);
      document.documentElement.classList.toggle('slides-lock', on);
      label(on);
      if (on && box.requestFullscreen && !document.fullscreenElement) {
        box.requestFullscreen().catch(function () {});   // 不支援或被擋時，CSS 的滿版照樣有效
      } else if (!on && document.fullscreenElement === box) {
        document.exitFullscreen().catch(function () {});
      }
      requestAnimationFrame(function () { go(keep); track.focus({ preventScroll: true }); });
    }
    label(false);
    full.addEventListener('click', function () { setFull(!isFull()); });
    track.addEventListener('click', function (e) { if (e.target.tagName === 'IMG' && !isFull()) setFull(true); });
    box.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isFull()) setFull(false); });
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
    // 讀者用瀏覽器自己的方式離開全螢幕（Esc、手機返回鍵）時，滿版也一起關掉
    document.addEventListener('fullscreenchange', function () {
      if (document.fullscreenElement === box) turnFor(track.querySelector('img'));   // 同一組幻燈片長寬一樣，看第一張就好
      else unturn();
      if (!document.fullscreenElement && isFull()) setFull(false);
    });
  });

  // 同一組圖卡有 16:9 和 4:5 兩個版本（Robert 2026-11-13）：依讀者的螢幕先挑一組，讀者也可以自己切換。
  // 判斷用「螢幕直拿還是橫放」，和網站導覽相簿（gallery.js）同一個條件：手機直拿看 4:5 字比較大，
  // 電腦和橫放的手機看 16:9。不認瀏覽器名稱，因為同一個瀏覽器在手機和電腦上的畫面完全不同。
  var PORTRAIT_PAIR = window.matchMedia ? window.matchMedia('(orientation: portrait)') : null;
  document.querySelectorAll('.deck-pair').forEach(function (pair) {
    var pick = pair.querySelector('.deck-pick');
    var btns = pick.querySelectorAll('button');
    // 2026-11-15 起不再寫「已依你的螢幕選直式」：按鈕上的「建議」已經說了同一件事（Robert：做法和網站導覽相簿一樣）
    function show(which) {
      pair.querySelectorAll('[data-ratio]').forEach(function (d) { d.hidden = d.getAttribute('data-ratio') !== which; });
      btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-pick') === which)); });
      // 剛露出來的那組寬度從 0 變成正常，讓幻燈片重新對齊頁碼
      window.dispatchEvent(new Event('resize'));
    }
    btns.forEach(function (b) { b.addEventListener('click', function () { show(b.getAttribute('data-pick')); }); });
    pick.hidden = false;
    show(PORTRAIT_PAIR && PORTRAIT_PAIR.matches ? 'tall' : 'wide');
  });

  // 彩蛋劇照的兩種比例（Robert 2026-11-19）：劇照散在對白之間，所以按鈕放在文章最上面、一次切換整篇。
  // 判斷條件和上面的圖卡一樣：手機直拿看 4:5，電腦和橫放看 16:9（電腦上 4:5 一張就佔滿整個螢幕，對白要捲很久才接得上）
  document.querySelectorAll('.ratio-page').forEach(function (pick) {
    var scope = pick.closest('article') || document;
    var btns = pick.querySelectorAll('button');
    function show(which) {
      scope.querySelectorAll('.ratio-fig [data-ratio]').forEach(function (d) { d.hidden = d.getAttribute('data-ratio') !== which; });
      btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-pick') === which)); });
    }
    btns.forEach(function (b) { b.addEventListener('click', function () { show(b.getAttribute('data-pick')); }); });
    pick.hidden = false;
    show(PORTRAIT_PAIR && PORTRAIT_PAIR.matches ? 'tall' : 'wide');
  });

  // 麵包屑「LSA ▾」的同層頁面選單：點 ▾ 開關（手機也能用）；有滑鼠的電腦，移上去就打開、移開稍等一下才關，
  // 避免滑鼠從 ▾ 移到選單途中經過空隙就關掉。Esc 或點選單外面也會關。
  document.querySelectorAll('.crumb-menu').forEach(function (box) {
    var btn = box.querySelector('.crumb-toggle');
    var list = box.querySelector('.crumb-list');
    var timer;
    function set(open) {
      clearTimeout(timer);
      list.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    btn.addEventListener('click', function () { set(list.hidden); });
    if (window.matchMedia('(hover: hover)').matches) {
      box.addEventListener('mouseenter', function () { set(true); });
      box.addEventListener('mouseleave', function () { timer = setTimeout(function () { set(false); }, 250); });
    }
    document.addEventListener('click', function (e) { if (!box.contains(e.target)) set(false); });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !list.hidden) { set(false); btn.focus(); }
    });
  });
  // ---------- 3b. 長頁面的「位置條」（2026-11-02）----------
  // 有 3 個以上段落標題（h2）的頁面，捲過頁首大標題後，釘住的頁首下緣淡入一行：目前在哪一段 ▾、第幾段、閱讀進度細線。
  // 點 ▾ 打開這一頁的段落清單，點了就跳過去。位置條疊在頁首下面（position: absolute），出現、收起都不會推動內文。
  // 沒有 JS 時什麼都不加，頁面照常閱讀。
  (function () {
    var header = document.querySelector('.site-header');
    var main = document.querySelector('main');
    if (!header || !main) return;
    var heads = Array.prototype.filter.call(main.querySelectorAll('h2'), function (h) {
      // 文末的訂閱框、頁尾、隱藏標題不算段落；小說試讀的章名也不算（閱讀模式自己有目錄，翻頁不是往下捲）
      // 全部傳訊的「找 3 篇」是工具，不是月份段落（2026-11-07）
      return !h.closest('aside, footer, .visually-hidden, [hidden], .reader, .finder') && h.textContent.trim();
    });
    if (heads.length < 3) return;
    heads.forEach(function (h, i) { if (!h.id) h.id = 'sec-' + (i + 1); });
    // 網站根目錄：從載入這支 site.js 的路徑推回去（例：../../js/site.js → ../../），各層頁面都能找到同一張圖
    var me = document.querySelector('script[src*="js/site.js"]');
    var SITE_ROOT = me ? me.getAttribute('src').replace(/js\/site\.js.*$/, '') : '';
    var title = main.querySelector('h1');
    if (title && title.closest('.visually-hidden')) title = null;    // 只給報讀軟體的隱藏標題，看不到位置，改用第一段
    var T = EN ? { top: 'Top', list: 'Sections on this page', open: 'Jump to a section' }
               : { top: '開頭', list: '這一頁的段落', open: '跳到其他段落' };

    var bar = document.createElement('div');
    bar.className = 'toc-bar';
    bar.setAttribute('aria-label', T.list);
    // 兩種樣子，依寬度自動選：
    //   排得下 → 所有段落排成一排（.toc-inline），目前那段橘色底線，看一眼就知道全部有幾段
    //   排不下或手機 → 收成「段落名 ▾」，點開才列出全部
    bar.innerHTML = '<div class="wrap"><ol class="toc-inline"></ol><div class="toc-menu">' +
      '<button type="button" class="toc-toggle" aria-expanded="false" title="' + T.open + '">' +
      '<span class="toc-page"></span><span class="toc-here"></span><span class="toc-caret" aria-hidden="true">▾</span></button>' +
      '<ol class="toc-list" hidden></ol></div><span class="log toc-count"></span></div><span class="toc-progress" aria-hidden="true"></span>' +
      // 星羽號停在進度線最前端，跟著往右飛。圖取自設定集封面的去背圖，左右翻轉成機頭朝右
      '<img class="toc-ship" src="' + SITE_ROOT + 'assets/ship-progress.png" alt="" aria-hidden="true" width="44" height="12">';
    header.appendChild(bar);
    var btn = bar.querySelector('.toc-toggle'), list = bar.querySelector('.toc-list'), inline = bar.querySelector('.toc-inline');
    var here = bar.querySelector('.toc-here'), count = bar.querySelector('.toc-count'), prog = bar.querySelector('.toc-progress');
    // 頁名：文章頁的大標題太長，CSS 會截短；手機上只顯示段落名稱
    if (title) bar.querySelector('.toc-page').textContent = title.textContent.trim();
    var items = heads.map(function (h, i) {
      var n = (i < 9 ? '0' : '') + (i + 1);         // 段落編號 01、02…（青色紀錄字體＝資料）
      return '<li><a href="#' + h.id + '"><span class="log">' + n + '</span>' +
        h.textContent.trim().replace(/[&<>"]/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }) + '</a></li>';
    }).join('');
    list.innerHTML = items;
    inline.innerHTML = items;
    var links = Array.prototype.slice.call(list.querySelectorAll('a')).concat(Array.prototype.slice.call(inline.querySelectorAll('a')));
    function fit() {
      // 先假設排成一排，量看看會不會超出；手機（720px 以下）一律用下拉
      bar.classList.add('inline');
      var ok = window.innerWidth > 720 && inline.scrollWidth <= inline.clientWidth + 1;
      bar.classList.toggle('inline', ok);
    }
    fit();

    function set(open) {
      list.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    btn.addEventListener('click', function () { set(list.hidden); });
    list.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
    window.addEventListener('resize', fit);
    document.addEventListener('click', function (e) { if (!bar.contains(e.target)) set(false); });
    bar.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !list.hidden) { set(false); btn.focus(); }
    });

    var raf;
    function update() {
      var hb = header.getBoundingClientRect().bottom;
      // 跳到段落時，標題停在位置條下方，不會被蓋住。頁首的高度已經由 html 的 scroll-padding-top 讓出來了，
      // 這裡只補位置條的高度（兩個都算頁首會重複，標題停太低、橘色停在前一段）
      root.style.setProperty('--toc-offset', Math.round(bar.offsetHeight + 8) + 'px');
      var show = (title || heads[0]).getBoundingClientRect().bottom < hb;
      bar.classList.toggle('show', show);
      if (!show) set(false);
      var cur = -1;
      heads.forEach(function (h, i) {
        // 被篩選器藏起來的段落（全部傳訊頁）不算
        // 判斷線在位置條下方 48px：點清單跳過去的標題（停在條下方約 20px）一定算進去
        if (h.offsetParent !== null && h.getBoundingClientRect().top < hb + bar.offsetHeight + 48) cur = i;
      });
      var max = document.documentElement.scrollHeight - window.innerHeight;
      // 捲到底時，最後一段可能太短、標題到不了判斷線：直接算最後一段
      if (show && max > 0 && window.scrollY >= max - 2) {
        for (var k = heads.length - 1; k >= 0; k--) if (heads[k].offsetParent !== null) { cur = k; break; }
      }
      here.textContent = cur < 0 ? T.top : heads[cur].textContent.trim();
      count.textContent = (cur + 1) + ' / ' + heads.length;
      links.forEach(function (a, j) {
        var i = j % heads.length;                    // 下拉清單和一排式各有一份連結
        if (i === cur) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
        a.parentNode.hidden = heads[i].offsetParent === null;
      });
      var p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      prog.style.transform = 'scaleX(' + p + ')';
      bar.style.setProperty('--toc-p', p);
    }
    function later() { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); }
    window.addEventListener('scroll', later, { passive: true });
    window.addEventListener('resize', later);
    document.addEventListener('click', later);      // 全部傳訊頁按艙房篩選後，段落清單跟著更新
    // 點段落連結跳過去後，馬上重新判斷一次（不等下一次捲動），橘色才會立刻停在點的那一段
    window.addEventListener('hashchange', update);
    bar.addEventListener('click', function (e) { if (e.target.closest('a')) setTimeout(update, 50); });
    // 位置條點「One more thing」：跳過去順便展開，讀者不用再按一次＋（2026-11-15）
    bar.addEventListener('click', function (e) {
      var a = e.target.closest('a'), t = a && document.getElementById(a.getAttribute('href').slice(1));
      var d = t && t.closest('details.author-notes');
      if (d) d.open = true;
    });
    update();
  })();

  // ---------- 3c. 作品集的五站流程（2026-11-03，/work/cases/）----------
  // 每一站是按鈕，點了看那一站的說明。電腦上（橫排）說明在整排下方，永遠開著一站；
  // 手機上（直排）說明若在五站最後面，點第一站要滑過四張卡片才看得到，所以搬到被點的那站正下方，再點一次收起。
  // 沒有 JS 時五段說明全部照順序列出，內容一樣讀得到。
  Array.prototype.forEach.call(document.querySelectorAll('.flow'), function (fig) {
    var list = fig.querySelector('.pipeline');
    var btns = Array.prototype.slice.call(fig.querySelectorAll('.station'));
    var panels = {};
    Array.prototype.forEach.call(fig.querySelectorAll('.flow-detail'), function (d) { panels[d.getAttribute('data-k')] = d; d.hidden = true; });
    var narrow = window.matchMedia('(max-width: 899px)');
    var cur = null;
    function btnOf(k) { return btns.filter(function (b) { return b.getAttribute('data-k') === k; })[0]; }
    function place(k) {
      var d = panels[k];
      if (narrow.matches) btnOf(k).parentNode.appendChild(d);
      else list.parentNode.insertBefore(d, list.nextSibling);
    }
    function show(k, btn) {
      if (narrow.matches && k === cur) k = null;          // 手機：再點同一站＝收起
      var anchor = btn || btnOf(k);
      var before = anchor ? anchor.getBoundingClientRect().top : 0;
      cur = k;
      Object.keys(panels).forEach(function (x) { panels[x].hidden = x !== k; });
      if (k) place(k);
      btns.forEach(function (b) {
        var on = b.getAttribute('data-k') === k;
        b.setAttribute('aria-expanded', on ? 'true' : 'false');
        b.querySelector('.more').textContent = on ? (EN ? 'Details below' : '說明在下方') : (EN ? 'See details' : '看說明');   // 已經打開的那站不再寫「看說明」
      });
      // 說明收起或搬走時，被點的卡片會往上跳；捲回原位，視線不會跟丟
      if (btn) window.scrollBy(0, btn.getBoundingClientRect().top - before);
    }
    btns.forEach(function (b) { b.addEventListener('click', function () { show(b.getAttribute('data-k'), b); }); });
    var open = fig.getAttribute('data-open');
    var onChange = function () { if (cur) place(cur); else if (!narrow.matches) show(open); };   // 轉橫向、縮放視窗跨過斷點
    if (narrow.addEventListener) narrow.addEventListener('change', onChange); else if (narrow.addListener) narrow.addListener(onChange);
    show(open);
  });

  // ---------- 3d. 從維修日誌「去看看」過來（2026-11-15 Robert）----------
  // 維修日誌卡片的連結帶 ?from=卡片編號。到了這一頁做兩件事：
  //   ①目標閃一圈青色框再淡掉：讀者不用找就知道「就是這裡」。用青色不用橘色，因為橘色在全站代表「可以點」。
  //   ②左下角放「← 回維修日誌」：看完功能一按就回到剛才那張卡；只能按瀏覽器上一頁的話，手機上常常就這樣離開了。
  // 沒有 JS 時連結照樣到得了，只是少了這兩個便利。
  (function () {
    var m = /[?&]from=(mx-\d{4}-\d{2})(?:&|$)/.exec(location.search);
    if (!m) return;
    // 網址上的 ?from= 拿掉，重新整理或複製分享出去的網址保持乾淨（# 留著，星海圖靠它記住畫面）
    try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}
    var me = document.querySelector('script[src*="js/site.js"]');
    var ROOT = me ? me.getAttribute('src').replace(/js\/site\.js.*$/, '') : '';
    var back = document.createElement('a');
    back.className = 'mx-back';
    back.href = ROOT + 'logbook/index.html#' + m[1];
    back.textContent = '← 回維修日誌';
    document.body.appendChild(back);

    var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function flash(el, small) {
      // 先加框再捲：.mx-here 帶 scroll-margin-top，框的上緣才不會被釘住的頁首蓋掉（瀏覽器自己跳的位置沒算到框）
      // 換色示範會連閃好幾次：先拿掉再加回去（中間讀一次 offsetWidth），動畫才會從頭播；上一次的計時器也取消，免得半途把框收掉
      clearTimeout(el.mxTimer);
      el.classList.remove('mx-here');
      void el.offsetWidth;
      el.classList.add('mx-here');
      // 一句重點字、一本相簿這種小東西放畫面中間；標題、幻燈片、星海圖從頂端開始，才看得到底下的內容
      if (small === undefined) small = el.getBoundingClientRect().height < window.innerHeight * 0.4 && !/^H\d$/.test(el.tagName);
      el.scrollIntoView({ block: small ? 'center' : 'start' });
      el.mxTimer = setTimeout(function () { el.classList.remove('mx-here'); }, 2800);   // 計時器跟著元素走：兩顆按鈕輪流亮時互不干擾
    }

    // 有些功能要「示範」才看得出來（Robert 2026-11-15 一張一張點過後提的）：
    // 輸入框＋按鈕的功能：框標題看不出要做什麼（Robert 2026-11-15），改成輸入框先亮、後面第一顆主要按鈕再亮：先打字、再按
    function typeThenGo(id) {
      var q = document.getElementById(id);
      if (!q) return;
      var go = Array.prototype.filter.call(document.querySelectorAll('button.primary'), function (b) {
        return q.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING;
      })[0];
      flash(q, true);
      if (go) setTimeout(function () { flash(go, true); }, 1200);
    }
    var FX = {
      // One more thing：預設收起，只亮框看不出裡面有東西。先亮一下，再自己展開，讀者就知道它打得開
      'one-more-thing': function (el) {
        if (!el) return;
        flash(el, true);
        setTimeout(function () { el.open = true; }, REDUCE ? 0 : 1000);
      },
      'finder-h': function () { typeThenGo('finder-q'); },     // 找 3 篇：輸入框 → 「找 3 篇」
      'voyage': function () { typeThenGo('voy-q'); },          // 38 光年航程：輸入框 → 「起飛」
      // 星海圖：框整張圖範圍太大（Robert 2026-11-15「框的範圍太奇怪了」），改成兩顆播放鈕輪流亮，讀者就知道要按什麼
      'starmap': function () {
        var b = document.querySelectorAll('[data-play]');
        if (!b.length) return;
        flash(b[0], true);
        if (b[1]) setTimeout(function () { flash(b[1], true); }, 1200);
      },
      // 位置條：要往下捲才會出現，落地時什麼都看不到。子琦在右上角提示一句，星羽號發亮；讀者捲下去看到之後，子琦退場
      'toc-demo': function () {
        var ship = document.querySelector('.toc-ship'), bar = document.querySelector('.toc-bar');
        if (!ship || !bar) return;
        ship.classList.add('mx-glow');
        var say = document.createElement('div');
        say.className = 'mx-say';
        say.setAttribute('role', 'status');
        say.innerHTML = '<div class="qa-crew qa-crew-ginni"><img src="' + ROOT + 'assets/lab/avatar-ginni.jpg" width="40" height="40" alt="">' +
          '<div><span class="qa-who">座艙長 永瀨子琦 · Ginni</span><p class="qa-bubble">往下捲捲看：頁首下面會出現一條細線，最前面的星羽號會跟著你往右飛喔。</p></div></div>';
        document.body.appendChild(say);
        function bye() {
          window.removeEventListener('scroll', seen);
          say.classList.add('bye');
          setTimeout(function () { if (say.parentNode) say.parentNode.removeChild(say); }, 400);
          setTimeout(function () { ship.classList.remove('mx-glow'); }, 6000);   // 星羽號多亮一會兒，讀者看得到它在飛
        }
        function seen() { if (bar.classList.contains('show')) setTimeout(bye, 2500); }
        window.addEventListener('scroll', seen, { passive: true });
        say.addEventListener('click', bye);
      },
      // 深色框線：同一張卡在深、淺兩種顏色各看一次才比得出差別。先切到讀者「沒選」的那一色、卡片亮一下，再切回讀者選的。
      // 只是示範，不寫進讀者的設定；讀者自己按了切換鈕就停止示範；減少動態效果的讀者不整頁換色，只亮卡片。
      'theme-demo': function (el) {
        if (!el) return;
        if (REDUCE) { flash(el, true); return; }
        var mine = root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
        var other = mine === 'light' ? 'dark' : 'light';
        var timers = [];
        function set(t) { root.setAttribute('data-theme', t); paint(); }
        flash(el, true);
        root.classList.add('mx-fade');
        timers.push(setTimeout(function () { set(other); say(other === 'dark' ? '先換成深色看看卡片的邊，等一下換回來' : '先換成淺色比比看，等一下換回深色'); flash(el, true); }, 1200));
        timers.push(setTimeout(function () { set(mine); flash(el, true); }, 4600));
        timers.push(setTimeout(function () { root.classList.remove('mx-fade'); }, 5400));
        if (toggle) toggle.addEventListener('click', function () {
          timers.forEach(clearTimeout); root.classList.remove('mx-fade');
        }, { once: true });
      }
    };
    // 目標：有 id 的直接找；沒有 id 的用代號（第一組幻燈片、第一句重點字、星海圖、作品集第一張卡）
    var ALIAS = { slides: '.deck-pair, .slides', 'w-hi': '.w-hi', starmap: '.arc-map', 'deck-pick': '.deck-pick',
                  'theme-demo': 'section[aria-labelledby="h-cases"] .case-card' };
    var h = decodeURIComponent(location.hash.slice(1));
    var el = !h ? null : ALIAS[h] ? document.querySelector(ALIAS[h]) : document.getElementById(h);
    requestAnimationFrame(function () {
      if (FX[h]) FX[h](el);
      else if (el) flash(el);
    });
  })();

  // ---------- 4. Google 整頁翻譯的說明（2026-11-02） ----------
  // 沒有英文版的頁面，按 English 會打開 Google 翻譯版（網址是 …translate.goog）。
  // 在最上方加一行英文說明：機器翻譯、可能不準確、原文是台灣繁體中文。translate="no" 讓 Google 不去翻這一行。
  if (/\.translate\.goog$/.test(location.hostname)) {
    var orig = 'https://robert3h.github.io' + location.pathname;
    var note = document.createElement('p');
    note.className = 'mt-note notranslate';
    note.setAttribute('translate', 'no');
    note.setAttribute('lang', 'en');
    note.innerHTML = 'Machine-translated by Google from the original in Traditional Chinese (Taiwan). It may be inaccurate. ' +
      '<a href="' + orig + '">Read the original</a>';
    var main = document.querySelector('main') || document.body;
    main.insertBefore(note, main.firstChild);
    // 進了翻譯版之後，Google 會把站內所有連結都改成翻譯版網址，讀者會一直被翻譯下去。
    // 所以把頁首的「中文」做成可以按的連結，直接回到真正的網站（2026-11-02）
    var cur = document.querySelector('.lang-switch .lang-cur:not([lang="en"])') || document.querySelector('.lang-cur:not([lang="en"])');
    if (cur) {
      var back = document.createElement('a');
      back.href = orig; back.textContent = '中文';
      back.setAttribute('hreflang', 'zh-Hant-TW'); back.setAttribute('lang', 'zh-Hant-TW');
      back.setAttribute('translate', 'no'); back.className = 'notranslate';
      cur.parentNode.replaceChild(back, cur);
      // 原本的 English 連結在翻譯版裡只會連回自己，改成「目前所在的語言」
      var en = document.querySelector('.lang-switch a[hreflang="en"]');
      if (en) {
        var here = document.createElement('span');
        here.className = 'lang-cur notranslate'; here.setAttribute('aria-current', 'true');
        here.setAttribute('lang', 'en'); here.setAttribute('translate', 'no');
        here.innerHTML = en.innerHTML;
        en.parentNode.replaceChild(here, en);
      }
    }
  }
})();

// ---------- 3e. 艙位配置圖「您在這裡」（2026-11-17）----------
// 頁尾的「艙位配置圖」連結帶 ?at=這頁屬於哪一艙（build_site.py 的 deck_zone()）。
// 到了配置圖：那一艙加青色框和「您在這裡」標籤，子琦那句話也換成「您目前在……」。青色＝標記，不和「可以點」的橘色混用。
// 網址上的 ?at= 讀完就拿掉，分享出去的網址保持乾淨。沒有 JS 時配置圖照樣能點，只是沒有標記。
(function () {
  var m = /[?&]at=([a-z]+)(?:&|$)/.exec(location.search);
  if (!m || !document.querySelector('.dp-deck')) return;
  try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}
  var el = document.querySelector('.dp-room[data-zone="' + m[1] + '"]');   // 航站的三格也算（登機門、服務台、塔台）
  if (!el) return;
  el.classList.add('is-here');
  var tag = document.createElement('span');
  tag.className = 'dp-here';
  var deck = document.querySelector('.dp-deck');   // 中英文版的字寫在頁面上（data-here、data-now），這裡不寫死
  tag.textContent = deck.getAttribute('data-here');
  el.insertBefore(tag, el.firstChild);
  var say = document.getElementById('dp-say');
  if (say) say.textContent = deck.getAttribute('data-now').replace('{name}', el.getAttribute('data-name'));
})();

// ---------- 3f. 連到維修日誌的投影片（2026-11-17）----------
// 文章裡「投影片好讀版本」的連結是 /logbook/#h-deck；那張卡平常收起來，從連結過來就直接打開，讀者不用再按一次「展開投影片」。
(function () {
  if (location.hash !== '#h-deck') return;
  var d = document.querySelector('details.lb-deck');
  if (d) d.open = true;
})();
