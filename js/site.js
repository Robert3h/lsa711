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
      // 最後一頁的 → 改成「回第一頁」（Robert 2026-11-09）：看完想再從頭看，不用一路往回滑；
      // 第一頁的 ← 仍然停用，因為導讀有開頭有結尾，從封面跳到最後一頁會打亂順序
      var last = current === items.length - 1;
      next.textContent = last ? '↺' : '→';
      next.setAttribute('aria-label', last ? '回第一頁' : '下一頁');
      next.title = last ? '回第一頁' : '';
    }
    function go(i) {
      i = Math.max(0, Math.min(items.length - 1, i));
      track.scrollTo({ left: i * track.clientWidth });
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
      track.scrollLeft = current * track.clientWidth;
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
    // 讀者用瀏覽器自己的方式離開全螢幕（Esc、手機返回鍵）時，滿版也一起關掉
    document.addEventListener('fullscreenchange', function () {
      if (!document.fullscreenElement && isFull()) setFull(false);
    });
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
