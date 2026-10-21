// 子琦與雙宇的四個小遊戲（試映版）
// 台詞資料由頁面裡的 <script id="game-data"> 提供，全部取自已發表的宇琦對話，這支程式只負責流程。
(function () {
  var root = document.querySelector('[data-game]');
  if (!root) return;
  var dataEl = document.getElementById('game-data');
  var data = dataEl ? JSON.parse(dataEl.textContent) : {};
  var game = root.getAttribute('data-game');

  // ---------- 小工具 ----------
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function btn(text, cls, onClick) {
    var b = el('button', 'btn ' + (cls || ''), text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }
  function link(text, href, cls) {
    var a = el('a', 'btn ' + (cls || ''), text);
    a.href = href;
    if (/^https?:/.test(href)) { a.target = '_blank'; a.rel = 'noopener'; }
    return a;
  }
  function clear() { root.innerHTML = ''; }
  // 複製文字並用頁面共用的提示框（site.js 建立的 .toast）告訴讀者結果
  function copy(text, msg) {
    var say = function (m) { var t = document.querySelector('.toast'); if (t) { t.textContent = m; t.classList.add('show'); setTimeout(function () { t.classList.remove('show'); }, 2600); } };
    var fallback = function () {
      var t = el('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
      t.remove();
      say(ok ? msg : '複製失敗，請手動選取文字複製。');
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { say(msg); }, fallback);
    else fallback();
  }
  function focusFirst(n) { var f = n.querySelector('h2, button'); if (f) { f.setAttribute('tabindex', '-1'); f.focus({ preventScroll: true }); } }
  var NAME = { julian: '🇹🇼 陳雙宇（理性）', ginni: '🇯🇵 永瀨子琦（感性）' };
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // 一則對話泡泡：子琦在左、雙宇在右（和合照的位置一樣）
  function bubble(turn) {
    var b = el('div', 'turn turn-' + turn.who);
    b.appendChild(el('p', 'turn-who', NAME[turn.who].replace(/（.*）/, '') + (turn.action ? '（' + turn.action + '）' : '')));
    turn.lines.forEach(function (l) { b.appendChild(el('p', /^（.*）$/.test(l) ? 'turn-act' : '', l)); });
    return b;
  }

  // =========================================================
  // 01 這句話是誰說的？
  // =========================================================
  if (game === 'who-said') {
    var ROUNDS = 5;
    var play = function () {
      var qs = shuffle(data.quotes).slice(0, ROUNDS), i = 0, score = 0;
      var ask = function () {
        clear();
        var q = qs[i];
        var card = el('div', 'game-card');
        card.appendChild(el('p', 'log', '第 ' + (i + 1) + ' / ' + ROUNDS + ' 題'));
        card.appendChild(el('blockquote', 'game-quote', q.text));
        card.appendChild(el('h2', 'game-ask', '這句話是誰說的？'));
        var row = el('div', 'actions');
        var result = el('div', 'game-result');
        result.setAttribute('aria-live', 'polite');
        ['julian', 'ginni'].forEach(function (who) {
          row.appendChild(btn(NAME[who], 'choice', function () {
            row.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
            var ok = who === q.who;
            if (ok) score++;
            result.appendChild(el('p', ok ? 'game-ok' : 'game-miss', (ok ? '答對了。' : '其實是另一位。') + '這句是' + NAME[q.who] + '說的。'));
            result.appendChild(el('p', 'sub', '出處：宇琦對話｜座標 ' + q.coord + '〈' + q.topic + '〉'));
            var nx = el('div', 'actions');
            nx.appendChild(btn(i + 1 < ROUNDS ? '下一題 →' : '看結果 →', 'primary', function () { i++; i < ROUNDS ? ask() : end(); }));
            result.appendChild(nx);
            nx.querySelector('button').focus();
          }));
        });
        card.appendChild(row);
        card.appendChild(result);
        root.appendChild(card);
        focusFirst(card);
      };
      var end = function () {
        clear();
        var card = el('div', 'game-card');
        card.appendChild(el('p', 'log', '結果'));
        card.appendChild(el('h2', 'game-ask', '你答對 ' + score + ' / ' + ROUNDS + ' 題'));
        card.appendChild(el('p', 'sub', score >= 4 ? '你已經很懂這兩位了。' : '雙宇不一定永遠理性，子琦也不一定永遠感性，這正是他們有趣的地方。'));
        var row = el('div', 'actions');
        row.appendChild(btn('再玩一次（題目會換）', 'primary', play));
        row.appendChild(link('看完整的宇琦對話', data.vocus));
        card.appendChild(row);
        root.appendChild(card);
        focusFirst(card);
      };
      ask();
    };
    play();
  }

  // =========================================================
  // 02 如果是你，會怎麼回？（座標 007）
  // =========================================================
  if (game === 'your-reply') {
    var start = function () {
      clear();
      var tally = { julian: 0, ginni: 0 };
      var log = el('div', 'dialogue');
      root.appendChild(log);
      var steps = data.script.slice(), k = 0;
      var next = function () {
        if (k >= steps.length) return end();
        var s = steps[k++];
        if (s.type === 'scene') { log.appendChild(el('p', 'turn-scene', s.text)); return next(); }
        if (s.type === 'turn') { log.appendChild(bubble(s)); return next(); }
        if (s.type === 'reveal') { log.appendChild(el('p', 'log turn-reveal', s.text)); return next(); }
        if (s.type === 'choice') {
          var box = el('div', 'game-card choice-box');
          box.appendChild(el('h2', 'game-ask', s.prompt));
          var row = el('div', 'choice-list');
          s.options.forEach(function (o) {
            row.appendChild(btn(o.text, 'choice', function () {
              tally[o.side]++;
              box.remove();
              var mine = el('div', 'turn turn-you');
              mine.appendChild(el('p', 'turn-who', '你選擇'));
              mine.appendChild(el('p', '', o.text));
              log.appendChild(mine);
              next();
              var last = log.lastElementChild;
              if (last && last.scrollIntoView) last.scrollIntoView({ block: 'nearest' });
            }));
          });
          box.appendChild(row);
          log.appendChild(box);
          box.querySelector('button').focus({ preventScroll: true });
        }
      };
      var end = function () {
        var card = el('div', 'game-card');
        card.appendChild(el('p', 'log', '（つづく）待續'));
        var line = '這兩次，你有 ' + tally.julian + ' 次用了雙宇的方式、' + tally.ginni + ' 次用了子琦的方式。';
        card.appendChild(el('h2', 'game-ask', line));
        card.appendChild(el('p', 'sub', 'LSA 不評哪一邊比較好，只是讓你看見自己習慣站在哪一邊。'));
        var row = el('div', 'actions');
        row.appendChild(btn('重新開始', 'primary', start));
        row.appendChild(link('讀這則彩蛋對應的文章 LSA_012', '../../lsa-012/index.html'));
        card.appendChild(row);
        log.appendChild(card);
      };
      next();
    };
    start();
  }

  // =========================================================
  // 03 傳訊碎片：收集狀態只存在讀者自己的瀏覽器
  // =========================================================
  if (game === 'fragments') {
    var KEY = 'lsa-fragments';
    var got = function () { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } };
    var render = function () {
      clear();
      var have = got();
      var n = data.fragments.filter(function (f) { return have.indexOf(f.id) >= 0; }).length;
      var head = el('div', 'game-card');
      head.appendChild(el('p', 'log', '已收到 ' + n + ' / ' + data.fragments.length + ' 段傳訊'));
      head.appendChild(el('h2', 'game-ask', n === data.fragments.length ? '完整對話已解鎖：' + data.title : '收集中：' + data.title));
      head.appendChild(el('p', 'sub', '每篇文章的簽名附近，藏著一顆 🥚。點它就會收到一段傳訊。'));
      root.appendChild(head);
      var log = el('div', 'dialogue');
      if (data.scene) log.appendChild(el('p', 'turn-scene', n ? data.scene : '（場景尚未解鎖）'));
      data.fragments.forEach(function (f, idx) {
        var slot = el('section', 'fragment');
        slot.appendChild(el('p', 'log', '傳訊碎片 ' + (idx + 1)));
        if (have.indexOf(f.id) >= 0) {
          f.turns.forEach(function (t) { slot.appendChild(bubble(t)); });
        } else {
          slot.classList.add('locked');
          slot.appendChild(el('p', 'fragment-lock', '▒▒▒▒▒▒ 尚未收到'));
          var a = el('a', '', '線索：藏在〈' + f.hint + '〉這篇文章裡 →');
          a.href = f.href;
          var p = el('p'); p.appendChild(a);
          slot.appendChild(p);
        }
        log.appendChild(slot);
      });
      if (n === data.fragments.length) log.appendChild(el('p', 'log', '（つづく）待續'));
      root.appendChild(log);
      if (n) {
        var row = el('div', 'actions');
        row.appendChild(btn('清除收集紀錄，重新開始', '', function () {
          try { localStorage.removeItem(KEY); } catch (e) {}
          render();
        }));
        root.appendChild(row);
      }
    };
    render();
  }

  // =========================================================
  // 04 五層除錯練習：寫的內容只在這個分頁裡，不送出、不儲存
  // =========================================================
  if (game === 'five-layers') {
    var layers = data.layers;
    var answers = [];
    var step = function (i) {
      clear();
      var L = layers[i];
      var card = el('div', 'game-card');
      card.appendChild(el('p', 'log', L.id + ' · ' + (i + 1) + ' / ' + layers.length + ' · ' + (L.view === 'julian' ? '雙宇的理性視角' : '子琦的感性視角')));
      card.appendChild(el('h2', 'game-ask', L.name));
      var label = el('label', 'game-prompt', L.prompt);
      label.setAttribute('for', 'ans');
      card.appendChild(label);
      var ta = el('textarea', 'game-text');
      ta.id = 'ans'; ta.rows = 4; ta.value = answers[i] || '';
      ta.placeholder = L.example;
      card.appendChild(ta);
      var row = el('div', 'actions');
      if (i > 0) row.appendChild(btn('← 上一層', '', function () { answers[i] = ta.value; step(i - 1); }));
      row.appendChild(btn(i + 1 < layers.length ? '下一層 →' : '完成，看我的五層筆記', 'primary', function () { answers[i] = ta.value; i + 1 < layers.length ? step(i + 1) : end(); }));
      card.appendChild(row);
      root.appendChild(card);
      ta.focus({ preventScroll: true });
    };
    var end = function () {
      clear();
      var card = el('div', 'game-card');
      card.appendChild(el('p', 'log', '我的五層筆記'));
      card.appendChild(el('h2', 'game-ask', '這是你今天拆解出來的東西'));
      var dl = el('dl', 'notes');
      var text = '我的五層筆記（LSA 人生系統架構）\n';
      layers.forEach(function (L, i) {
        var a = (answers[i] || '').trim() || '（略過）';
        dl.appendChild(el('dt', '', L.id + ' ' + L.name));
        dl.appendChild(el('dd', '', a));
        text += '\n' + L.id + ' ' + L.name + '\n' + a + '\n';
      });
      card.appendChild(dl);
      card.appendChild(el('p', 'sub', '關掉這個分頁，內容就會消失。想留著的話，先複製下來。'));
      var row = el('div', 'actions');
      row.appendChild(btn('複製我的五層筆記', '', function () { copy(text, '已複製五層筆記'); }));
      row.appendChild(btn('重新開始', '', function () { answers = []; step(0); }));
      card.appendChild(row);

      // 自己寫完五層之後，常常會卡在「然後呢？」：把提示詞＋筆記一起帶給 AI，讓它一次問一個問題陪你往下整理
      if (data.prompt) {
        var ai = el('div', 'game-card handoff');
        ai.appendChild(el('h2', 'game-ask', '想再深入一點？帶去給 AI 繼續問'));
        ai.appendChild(el('p', 'sub', '按下按鈕，會一次複製「五層提問提示詞＋你剛剛的筆記」。貼到你常用的 AI（ChatGPT、Gemini、Claude 都可以），它會從你的筆記接著，一次問你一個問題。'));
        ai.appendChild(el('p', 'sub', '提醒：AI 服務可能會保存對話內容，筆記裡不需要寫任何人的真實姓名。'));
        var row2 = el('div', 'actions');
        var handoff = data.prompt + '\n\n---\n\n以下是我先自己寫好的五層筆記。請先讀完，再從「開場」開始，用一次一個問題的方式陪我往下整理：\n\n' + text;
        row2.appendChild(btn('📋 複製提示詞＋我的筆記', 'primary', function () { copy(handoff, '已複製！貼到你常用的 AI 就能開始'); }));
        row2.appendChild(link('這是什麼提示詞？', '../../toolkit/index.html'));
        ai.appendChild(row2);
        root.appendChild(card);
        root.appendChild(ai);
      } else {
        root.appendChild(card);
      }
      focusFirst(card);
    };
    step(0);
  }
})();
