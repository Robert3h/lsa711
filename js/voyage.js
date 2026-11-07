// 小遊戲 05「38 光年航程」（2026-11-07 試作）：星羽號從 The Loop 搭乘站出發，飛往 LSA-711 軌道站。
// 遊戲本身就是另一種逛「全部傳訊」的方式：沿途接到的訊號＝真的傳訊，抵達時列出這趟收到的文章。
// 設定取自星羽號設定集：不在行星表面起降，從軌道搭乘站出港 → 離開重力井後切換曲速 → 38 光年約 7 天。
// 操作：滑鼠（游標左右）、鍵盤（← → 或 A D，空白鍵暫停）、手機（手指左右滑）。沒有音效。
// 系統設定「減少動態效果」的讀者：不跑動畫，直接列出這趟航線會經過的訊號，想玩再按。
(function () {
  var root = document.querySelector('.voyage');
  if (!root) return;
  var $ = function (s) { return root.querySelector(s); };
  var form = $('.voy-start'), input = $('#voy-q'), stage = $('.voy-stage'), cv = $('canvas');
  var hud = $('.voy-hud'), toast = $('.voy-toast'), result = $('.voy-result'), pauseBtn = $('.voy-pause');
  var ctx = cv.getContext('2d');
  var SHIP = new Image(); SHIP.src = root.getAttribute('data-ship');
  var FLIGHT = 60, SIGNALS = 8;            // 一趟 60 秒、沿途 8 則訊號
  // 畫布固定用深色太空：淺色主題下也一樣，白色機身才看得到（只在畫布裡，頁面其他地方照主題）
  var C = { bg: '#0b0d10', star: '#a2a6aa', data: '#6fd3e3', accent: '#d97757', ink: '#ececea', noise: '#5a5f66' };
  var W = 360, H = 520, dpr = 1, s = null, raf = 0;

  function esc(t) {
    return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // 這趟航線上的 8 則訊號：讀者有寫一句話，就先放比對最接近的（最多 3 則），其餘隨機；本站全文的優先
  function pickDocs(q) {
    var F = window.LSA_FINDER, picked = [];
    if (q && window.LSAFind) picked = window.LSAFind.search(q).ids.slice();
    var onsite = [], other = [];
    F.docs.forEach(function (d, i) { if (picked.indexOf(i) < 0) (/^\.\.\//.test(d.u) ? onsite : other).push(i); });
    var rest = shuffle(onsite).concat(shuffle(other));
    var ids = picked.concat(rest).slice(0, SIGNALS);
    var first = picked.length;               // 比對到的那幾則排在前段，比較容易被接到
    return ids.slice(0, first).concat(shuffle(ids.slice(first)));
  }
  // 文章網址在 finder-data.js 裡是相對於「全部傳訊」頁（../slug/），這裡要再往上一層
  function href(d) { return /^\.\.\//.test(d.u) ? '../../' + d.u.slice(3) : d.u; }
  function isExt(d) { return !/^\.\.\//.test(d.u); }

  function resize() {
    var r = stage.getBoundingClientRect();
    W = Math.round(r.width);
    H = Math.round(Math.min(W * 1.4, Math.max(360, window.innerHeight - 160)));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 改尺寸會清空畫布：暫停中（例如手機轉向）也要立刻補畫一格，不然畫面會變全黑
    if (s) { s.x = Math.min(Math.max(s.x, 20), W - 20); s.tx = s.x; if (s.stars) draw(); }
  }

  function newFlight(q) {
    var docs = pickDocs(q), stars = [];
    for (var i = 0; i < 90; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, z: 0.3 + Math.random() * 0.7 });
    s = { t: 0, last: 0, paused: false, done: false, x: W / 2, tx: W / 2, key: 0, hit: 0, slow: 1,
          stars: stars, noise: [], sig: [], got: [], nextNoise: 6, docs: docs, warpShown: false };
    // 訊號都排在曲速那一段（第 7 秒到第 44 秒）平均出現，位置隨機但不貼邊
    docs.forEach(function (id, k) {
      s.sig.push({ id: id, at: 7 + k * (37 / (SIGNALS - 1)), x: 40 + Math.random() * (W - 80), y: -30, on: false, taken: false });
    });
  }

  function say(html) {
    toast.innerHTML = html;
    toast.classList.remove('is-on'); void toast.offsetWidth; toast.classList.add('is-on');
  }

  // 航程分三段（依《LSA-711 星球世界觀設定集》v1.1 草稿）：
  //   0–5 秒：常規模式從 The Loop 出港（三環噴藍白等離子體）；離開地球重力井後才能曲速
  //   5–48 秒：曲速（曲速泡，尾端不噴火），這段走完 38 光年
  //   48–60 秒：約 3 AU 曲速邊界解除曲速，看到白羽、金羽兩顆太陽，三環點火減速到 LSA-711 軌道站
  var WARP_ON = 5, WARP_OFF = 48;
  function warp() { return s.t >= WARP_ON && s.t < WARP_OFF; }
  function speed() { return (warp() ? 1 : s.t < WARP_ON ? 0.25 : 0.35) * s.slow; }

  function step(dt) {
    s.t += dt;
    var sp = speed();
    if (s.hit > 0) { s.hit -= dt; if (s.hit <= 0) s.slow = 1; }
    if (s.key) s.tx = s.x + s.key * 320 * dt;
    s.tx = Math.min(Math.max(s.tx, 20), W - 20);
    s.x += (s.tx - s.x) * Math.min(1, dt * 10);
    var shipY = H - 70;

    s.stars.forEach(function (st) {
      st.y += st.z * 420 * sp * dt + 6 * dt;
      if (st.y > H) { st.y -= H; st.x = Math.random() * W; }
    });

    if (warp() && !s.warpShown) { s.warpShown = true; say('<span class="log">MODE</span> 離開地球重力井，曲速泡展開'); }
    if (s.t >= WARP_OFF && !s.exitShown) { s.exitShown = true; say('<span class="log">MODE</span> 抵達曲速邊界（約 3 AU），解除曲速，三環點火減速'); }

    // 雜訊：撞到不會結束航程，只會減速 1 秒（LSA 不是在比誰比較厲害）
    if (s.t > s.nextNoise && s.t < WARP_OFF - 2) {
      var w = 26 + Math.random() * 40;
      s.noise.push({ x: Math.random() * (W - w), y: -40, w: w, h: 14 + Math.random() * 18 });
      s.nextNoise = s.t + 0.7 + Math.random() * 0.9;
    }
    s.noise.forEach(function (n) {
      n.y += 260 * sp * dt + 40 * dt;
      if (!n.done && n.y + n.h > shipY - 26 && n.y < shipY + 26 && s.x + 7 > n.x && s.x - 7 < n.x + n.w) {
        n.done = true; s.hit = 1; s.slow = 0.45;
      }
    });
    s.noise = s.noise.filter(function (n) { return n.y < H + 40; });

    s.sig.forEach(function (g) {
      if (!g.on && s.t >= g.at) g.on = true;
      if (!g.on || g.taken) return;
      g.y += 200 * Math.max(sp, 0.6) * dt;
      var dx = g.x - s.x, dy = g.y - shipY;
      if (dx * dx + dy * dy < 30 * 30) {
        g.taken = true; s.got.push(g.id);
        var d = window.LSA_FINDER.docs[g.id];
        say('<span class="log">SIGNAL ' + s.got.length + '</span> ' + esc(d.t) + (d.m ? '<br><span class="voy-mood">適合：' + esc(d.m) + '</span>' : ''));
      }
    });

    var ly = Math.min(38, Math.max(0, 38 * (s.t - WARP_ON) / (WARP_OFF - WARP_ON)));
    hud.textContent = (warp() ? '曲速 ' : s.t < WARP_ON ? '常規 出港 ' : '常規 減速 ') + ly.toFixed(1) + '/38 光年 · 訊號 ' + s.got.length + '/' + SIGNALS;
    if (s.t >= FLIGHT) finish();
  }

  function draw() {
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    var sp = speed();
    ctx.strokeStyle = C.star; ctx.fillStyle = C.star;
    s.stars.forEach(function (st) {
      ctx.globalAlpha = 0.35 + st.z * 0.5;
      var len = warp() ? st.z * 26 * sp + 1 : 1.5;
      ctx.fillRect(st.x, st.y - len, st.z > 0.7 ? 1.6 : 1, len);
    });
    ctx.globalAlpha = 1;

    var font = '12px ' + getComputedStyle(document.body).fontFamily;
    // 出發：地球軌道上的 The Loop（設定集：直徑約 1 km 的第二代重力場站，外環不轉、中央有中心塔）
    if (s.t < 7) {
      var a = Math.max(0, 1 - s.t / 7), oy = H - 30 + s.t * 26;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#16324a';                                     // 地球：畫面底部露出一段弧線
      ctx.beginPath(); ctx.arc(W / 2, oy + W * 0.95, W * 1.05, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#4f86b8'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = C.star; ctx.lineWidth = 3;                   // The Loop 外環（斜看成橢圓）
      ctx.beginPath(); ctx.ellipse(W / 2, oy - 40, W * 0.44, 30, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1; ctx.beginPath();                            // 輻條＋中心塔
      for (var i = 0; i < 6; i++) { var g = i * Math.PI / 3; ctx.moveTo(W / 2, oy - 40); ctx.lineTo(W / 2 + Math.cos(g) * W * 0.44, oy - 40 + Math.sin(g) * 30); }
      ctx.stroke();
      ctx.fillStyle = C.star; ctx.beginPath(); ctx.ellipse(W / 2, oy - 40, 14, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(W / 2 - 2, oy - 62, 4, 22);
      ctx.font = font; ctx.textAlign = 'left';
      // 字放在左側，不要和停在中間的船身疊在一起
      ctx.fillText('The Loop', W * 0.06, oy - 78);
      ctx.fillStyle = '#7fa8cc'; ctx.fillText('地球軌道', W * 0.06, oy - 62);
      ctx.globalAlpha = 1;
    }
    // 解除曲速後：雙星系的兩顆太陽，白羽（冷白、較亮）與金羽（暖金）
    if (s.t >= WARP_OFF) {
      ctx.globalAlpha = Math.min(1, (s.t - WARP_OFF) / 2);
      // 放在左側中段：之後 LSA-711 從上方變大時，才不會把兩顆太陽擋住
      var sx = W * 0.1, sy = H * 0.5;
      ctx.fillStyle = '#eef3ff'; ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2c46b'; ctx.beginPath(); ctx.arc(sx + 22, sy + 4, 5, 0, Math.PI * 2); ctx.fill();
      ctx.font = font; ctx.textAlign = 'left'; ctx.fillStyle = C.star;
      ctx.fillText('白羽・金羽', sx - 8, sy + 26);
      ctx.globalAlpha = 1;
    }
    // 抵達：LSA-711 和它的軌道站
    if (s.t > FLIGHT - 8) {
      var k = (s.t - (FLIGHT - 8)) / 8, r = 20 + k * W * 0.32, py = -r + k * (H * 0.32 + r);
      ctx.fillStyle = '#1c2a30'; ctx.beginPath(); ctx.arc(W / 2, py, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = C.data; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(W / 2, py, r * 1.5, r * 0.32, -0.2, 0, Math.PI * 2); ctx.stroke();
      ctx.font = font;
      ctx.fillStyle = C.data; ctx.textAlign = 'center'; ctx.fillText('LSA-711', W / 2, py + r + 22);
    }

    ctx.fillStyle = C.noise;
    s.noise.forEach(function (n) {
      ctx.globalAlpha = n.done ? 0.25 : 0.85;
      for (var i = 0; i < 4; i++) ctx.fillRect(n.x + Math.random() * n.w * 0.6, n.y + i * n.h / 4, n.w * (0.3 + Math.random() * 0.5), n.h / 5);
    });
    ctx.globalAlpha = 1;

    s.sig.forEach(function (g) {
      if (!g.on || g.taken || g.y > H + 30) return;
      var p = 1 + Math.sin(s.t * 5 + g.at) * 0.15;
      ctx.strokeStyle = C.data; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(g.x, g.y, 14 * p, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = C.data; ctx.beginPath(); ctx.arc(g.x, g.y, 4, 0, Math.PI * 2); ctx.fill();
    });

    // 星羽號：素材是機頭朝右的側視圖，轉 90 度讓機頭朝上
    var shipY = H - 70, blink = s.hit > 0 && Math.floor(s.t * 12) % 2;
    ctx.save(); ctx.translate(s.x, shipY); ctx.rotate(-Math.PI / 2);
    if (warp()) {
      // 曲速：船身外一圈曲速泡，尾端不噴火（設定集：三環通電產生曲速泡）
      ctx.strokeStyle = '#cfe3ff'; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.45;
      ctx.beginPath(); ctx.ellipse(-2, 0, 42, 16, 0, 0, Math.PI * 2); ctx.stroke();
    } else {
      // 常規模式：三環往後噴出藍白色等離子體（側視只看得到兩環）
      ctx.fillStyle = '#bfe0ff'; ctx.globalAlpha = 0.75;
      var f = 10 + Math.random() * 6;
      ctx.fillRect(-32 - f, -5, f, 2.4); ctx.fillRect(-32 - f * 0.8, 1.5, f * 0.8, 2.4);
    }
    ctx.globalAlpha = blink ? 0.4 : 1;
    if (SHIP.complete && SHIP.naturalWidth) ctx.drawImage(SHIP, -32, -8.5, 64, 17);
    ctx.restore(); ctx.globalAlpha = 1;
  }

  function loop(ts) {
    raf = 0;
    if (!s || s.done || s.paused) return;
    var dt = s.last ? Math.min((ts - s.last) / 1000, 0.05) : 0;
    s.last = ts;
    step(dt);
    if (!s.done) { draw(); raf = requestAnimationFrame(loop); }
  }

  function setPause(p) {
    if (!s || s.done) return;
    s.paused = p; s.last = 0;
    pauseBtn.textContent = p ? '繼續' : '暫停';
    pauseBtn.setAttribute('aria-pressed', String(p));
    if (p) { hud.textContent += ' · 已暫停'; } else if (!raf) raf = requestAnimationFrame(loop);
  }

  function list(ids) {
    return '<ol>' + ids.map(function (i) {
      var d = window.LSA_FINDER.docs[i];
      return '<li><a href="' + esc(href(d)) + '"' + (isExt(d) ? ' target="_blank" rel="noopener"' : '') + '>' + esc(d.t) + '</a>' +
        '<span class="log">' + esc(d.d) + ' · ' + esc(d.r) + (isExt(d) ? ' · Vocus' : ' · 本站閱讀') + '</span>' +
        (d.m ? '<span class="voy-mood">適合：' + esc(d.m) + '</span>' : '') + '</li>';
    }).join('') + '</ol>';
  }

  function finish() {
    s.done = true; draw();
    stage.hidden = true;
    var n = s.got.length;
    result.innerHTML = '<p class="log">ARRIVED · LSA-711 軌道站</p><h2>抵達 LSA-711</h2>' +
      '<p>38 光年，設定上約 7 天的航程。' + (n ? '這趟你接收了 ' + n + ' / ' + SIGNALS + ' 則傳訊：' : '這趟的訊號都擦身而過了。') + '</p>' +
      (n ? list(s.got) : '') +
      '<div class="actions"><button type="button" class="btn primary voy-again">再飛一次</button>' +
      '<a class="btn" href="../../archive/index.html">看全部傳訊</a></div>';
    result.hidden = false;
    result.querySelector('.voy-again').addEventListener('click', reset);
    result.querySelector('h2').focus();
  }

  function reset() {
    result.hidden = true; stage.hidden = true; form.hidden = false; s = null; input.focus();
  }

  function launch(q, animate) {
    form.hidden = true; result.hidden = true;
    if (!animate) {
      // 減少動態：直接列出這趟航線會經過的訊號
      var ids = pickDocs(q);
      result.innerHTML = '<p class="log">ROUTE · The Loop → LSA-711</p><h2>這趟航線的 ' + ids.length + ' 則訊號</h2>' +
        '<p>你的裝置設定了「減少動態效果」，所以直接列出來。想看飛行動畫，可以按下面的按鈕。</p>' + list(ids) +
        '<div class="actions"><button type="button" class="btn voy-fly">還是用動畫飛一次</button></div>';
      result.hidden = false;
      result.querySelector('.voy-fly').addEventListener('click', function () { launch(q, true); });
      return;
    }
    stage.hidden = false;
    resize(); newFlight(q);
    // 捲到整個遊戲畫面都看得到的位置（扣掉上方固定的導覽列）
    var top = stage.getBoundingClientRect().top + window.pageYOffset - 72;
    window.scrollTo(0, Math.max(0, top));
    toast.innerHTML = ''; pauseBtn.textContent = '暫停'; pauseBtn.setAttribute('aria-pressed', 'false');
    say('<span class="log">DEPART</span> 從地球軌道上的 The Loop 出港，常規模式');
    if (!raf) raf = requestAnimationFrame(loop);
    cv.focus();
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    launch(input.value.trim(), !reduce);
  });

  // 操作：滑鼠移動或手指拖曳 → 船跟著左右；鍵盤 ← → A D；空白鍵暫停
  function pointer(ev) {
    if (!s) return;
    var r = cv.getBoundingClientRect();
    s.tx = (ev.clientX - r.left) * (W / r.width);
  }
  cv.addEventListener('pointermove', pointer);
  cv.addEventListener('pointerdown', pointer);
  document.addEventListener('keydown', function (ev) {
    if (!s || s.done || stage.hidden) return;
    var k = ev.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { s.key = -1; ev.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { s.key = 1; ev.preventDefault(); }
    else if (k === ' ' && document.activeElement !== pauseBtn) { setPause(!s.paused); ev.preventDefault(); }
  });
  document.addEventListener('keyup', function (ev) {
    if (s && /^(ArrowLeft|ArrowRight|a|A|d|D)$/.test(ev.key)) s.key = 0;
  });
  pauseBtn.addEventListener('click', function () { if (s) setPause(!s.paused); });
  // 切到別的分頁或 App 時自動暫停，回來不會發現已經飛完了
  document.addEventListener('visibilitychange', function () { if (document.hidden) setPause(true); });
  window.addEventListener('resize', function () { if (s && !stage.hidden) resize(); });
})();
