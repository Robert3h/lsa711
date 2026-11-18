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
  // 起飛前的說明也用 .voy-toast，所以只抓遊戲畫面下方那一個
  var hud = $('.voy-hud'), toast = $('.voy-stage .voy-toast'), result = $('.voy-result'), pauseBtn = $('.voy-pause');
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

  // 手機瀏覽器的網址列會隨捲動伸縮，innerHeight 跟著變；量「網址列出現時」的最小可見高度（100svh），
  // 整個遊戲畫面照它來排，網址列收起來也不會多切掉一截。舊瀏覽器不認得 svh 時退回 innerHeight。
  function viewH() {
    var p = document.createElement('div');
    p.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none';
    document.body.appendChild(p);
    var h = p.offsetHeight;
    document.body.removeChild(p);
    return Math.min(h || Infinity, window.innerHeight);
  }
  // 飛行中導覽列不釘在頂端、跟著頁面捲走（2026-11-17 Robert：手機上被上下遮到）：
  // 手機上導覽列折成兩排、約 116px，占掉畫面五分之一；飛完（抵達或再飛一次）就恢復釘住。
  function flying(on) { document.documentElement.classList.toggle('voy-flying', on); }
  // 飛行中導覽列已經捲走，不用扣；萬一還釘著（例如 CSS 沒載到），照實際高度扣（手機上兩排，高度不固定）
  function headerH() {
    if (document.documentElement.classList.contains('voy-flying')) return 0;
    var h = document.querySelector('.site-header');
    return h ? h.offsetHeight : 0;
  }
  var lastW = 0;
  function resize() {
    var r = stage.getBoundingClientRect();
    W = Math.round(r.width); lastW = window.innerWidth;
    // 畫布高度＝看得到的高度 − 導覽列 − 暫停列 − 下方廣播（照最長那則留好高度）− 一點喘息空間，
    // 讓暫停鈕、船、廣播三樣同時在畫面裡。手機橫拿太矮時至少 260，寧可廣播要往下捲，也不讓船太擠。
    toast.style.minHeight = toastNeed() + 'px';
    var bar = $('.voy-bar');
    var used = headerH() + bar.offsetHeight + 8 + toast.offsetHeight + 10 + 12;
    H = Math.round(Math.min(W * 1.4, Math.max(260, viewH() - used)));
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

  // 艦內廣播：機長雙宇報航行狀態，座艙長子琦對乘客說話（Robert 2026-11-07 確認台詞與分工）
  var CREW = { julian: ['機長 雙宇', root.getAttribute('data-julian')], ginni: ['座艙長 子琦', root.getAttribute('data-ginni')] };
  // 機長出發前廣播（Robert 2026-11-07）：先說這班船要去哪，2.5 秒後再報出港
  var HELLO = '各位乘客，這裡是機長雙宇。本班星羽號從地球軌道上的 The Loop 出發，前往 LSA-711，航程 38 光年。';
  function comm(who, html) {
    var c = CREW[who];
    return '<span class="voy-comm voy-comm-' + who + '"><img src="' + c[1] + '" width="40" height="40" alt="">' +
      '<span><span class="voy-who">' + c[0] + '</span>' + html + '</span></span>';
  }
  // 接到訊號時子琦說的話；resize() 也用它量「最長那則」有多高，兩邊共用才不會對不上
  function sigLine(d, n) {
    return '收到一則訊號<span class="log"> · SIGNAL ' + n + '</span>：' + esc(d.t) + (d.m ? '<br><span class="voy-mood">適合：' + esc(d.m) + '</span>' : '');
  }
  // 廣播區要留多高：在畫面外排一個看不見的分身，放進目前最長的那則訊號，量它在這支手機寬度下的高度。
  // 用分身而不是直接塞進廣播區，報讀軟體才不會把它念出來（廣播區是 aria-live）。
  function toastNeed() {
    var docs = (window.LSA_FINDER && window.LSA_FINDER.docs) || [], best = null, len = -1;
    docs.forEach(function (d) { var l = (d.t || '').length + (d.m || '').length; if (l > len) { len = l; best = d; } });
    var p = toast.cloneNode(false);
    p.removeAttribute('role'); p.removeAttribute('aria-live'); p.setAttribute('aria-hidden', 'true');
    p.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;min-height:0;width:' + toast.offsetWidth + 'px';
    p.innerHTML = comm('julian', HELLO);
    stage.appendChild(p);
    var h = p.offsetHeight;
    if (best) { p.innerHTML = comm('ginni', sigLine(best, SIGNALS)); h = Math.max(h, p.offsetHeight); }
    stage.removeChild(p);
    return h;
  }
  function say(who, html) {
    toast.innerHTML = who ? comm(who, html) : html;
    if (s) s.saidAt = s.t;
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

    if (s.t >= 2.5 && !s.departShown) { s.departShown = true; say('julian', '已脫離 The Loop，常規模式出港。'); }
    if (warp() && !s.warpShown) { s.warpShown = true; say('julian', '離開地球重力井，曲速泡展開。目標 LSA-711，38 光年。'); }
    if (s.t >= (WARP_ON + WARP_OFF) / 2 && !s.halfShown) { s.halfShown = true; if (s.t - s.saidAt > 2) say('julian', '航程過半，剩下 19 光年。'); }
    if (s.t >= WARP_OFF && !s.exitShown) { s.exitShown = true; say('julian', '抵達曲速邊界，解除曲速。三環點火，開始減速。'); }
    // 快抵達前，座艙長子琦介紹 LSA-711（Robert 2026-11-07 給的設定：類地行星、和地球差不多大、帶著土星那樣的環、兩顆恆星）
    if (s.t >= WARP_OFF + 3 && !s.sunShown) { s.sunShown = true; say('ginni', '你看！發出白色光芒的是白羽，金色的是金羽。LSA-711 有兩顆太陽喔。'); }
    if (s.t >= WARP_OFF + 7 && !s.planetShown) { s.planetShown = true; say('ginni', '前面就是 LSA-711：和地球差不多大的類地行星，還帶著一圈像土星那樣的環～'); }

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
        // 剛接到訊號時不要馬上蓋掉那則訊號的標題
        if (s.t - s.saidAt > 2.5) say('ginni', '哎呀，被雜訊擋到了，等一下就好～');
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
        say('ginni', sigLine(d, s.got.length));
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
      // Robert 2026-11-07：兩顆太陽放大一點；外圈淡淡的光暈，看得出是會發光的恆星，不是行星
      var sx = W * 0.14, sy = H * 0.62, k = ctx.globalAlpha;   // 放在星球最大時的下緣之下，不會被擋住
      [[sx, sy, 12, '#eef3ff'], [sx + 40, sy + 6, 9, '#f2c46b']].forEach(function (st) {
        ctx.globalAlpha = k * 0.18; ctx.fillStyle = st[3];
        ctx.beginPath(); ctx.arc(st[0], st[1], st[2] * 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = k; ctx.beginPath(); ctx.arc(st[0], st[1], st[2], 0, Math.PI * 2); ctx.fill();
      });
      ctx.font = font; ctx.textAlign = 'center'; ctx.fillStyle = C.star;
      ctx.fillText('白羽', sx, sy + 34); ctx.fillText('金羽', sx + 40, sy + 34);
      ctx.globalAlpha = 1;
    }
    // 抵達：LSA-711 和它的軌道站
    if (s.t > FLIGHT - 8) {
      var k = (s.t - (FLIGHT - 8)) / 8, r = 20 + k * W * 0.32, py = -r + k * (H * 0.32 + r);
      // 星環分前後兩半畫（Robert 2026-11-16：原本整圈畫在星球上面，後半圈透過星球看得到，像透明的）：
      // 先畫後半圈（上半弧），再畫星球蓋住它，最後畫前半圈（下半弧）
      ctx.strokeStyle = C.data; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(W / 2, py, r * 1.5, r * 0.32, -0.2, Math.PI, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#1c2a30'; ctx.beginPath(); ctx.arc(W / 2, py, r, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(W / 2, py, r * 1.5, r * 0.32, -0.2, 0, Math.PI); ctx.stroke();
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

  // ===== 紀念登機證（2026-11-17，Robert：讓讀者透過遊戲做出客製化登機證，可下載）=====
  // 只在讀者的瀏覽器裡用 Canvas 畫成 PNG：網站沒有資料庫，名字不送出、只記在這台裝置（localStorage）。
  // 艙等照這趟接到幾則訊號決定（Robert 2026-11-17 定）：8 則白羽艙、6～7 金羽艙、3～5 銀羽豪華艙、0～2 銀羽艙。
  //   規則不寫在遊戲頁上，抵達後由子琦廣播宣布（讀者好奇就會再飛一次）。
  // 票面配色只看艙等、不分網站深淺色（Robert：「那樣卡片變數太多」）：白羽艙象牙白、金羽艙黑底金線、銀羽兩艙深色系。
  // 版面參考 GrokBot 2026-11-17 的「三艙等票卡」：照片為主、細幾何線條、下方存根放 GATE＋條碼＋星芒。
  var CLS = {
    W:    { zh: '白羽艙',     en: 'FIRST CLASS',     bg: '#f6f2e9', line: '#c2a66a', ink: '#1e1c19', muted: '#7e776a', hi: '#a8843f', frames: 2, mark: 'light' },
    G:    { zh: '金羽艙',     en: 'BUSINESS',        bg: '#0e0d0b', line: '#c9a45c', ink: '#f2ebdb', muted: '#a69a80', hi: '#d9b56a', frames: 1, mark: 'dark' },
    'S+': { zh: '銀羽豪華艙', en: 'PREMIUM ECONOMY', bg: '#111a29', line: '#c5ccd6', ink: '#e9edf3', muted: '#93a0b3', hi: '#e9edf3', frames: 2, mark: 'dark' },
    S:    { zh: '銀羽艙',     en: 'ECONOMY',         bg: '#131821', line: '#7f8896', ink: '#e2e5ea', muted: '#8b939f', hi: '#cfd5dd', frames: 1, mark: 'dark' }
  };
  function tierOf(n) { return n >= 8 ? 'W' : n >= 6 ? 'G' : n >= 3 ? 'S+' : 'S'; }
  // 子琦宣布艙等（台詞 Claude 草擬，Robert 可改）
  function tierLine(t, n) {
    if (t === 'W') return '8 則訊號全部收到了！恭喜升等<b>白羽艙</b>，請從專屬通道登機～';
    if (t === 'G') return '收到 ' + n + ' 則訊號，這趟為您安排<b>金羽艙</b>。金羽酒廊已經準備好了喔～';
    if (t === 'S+') return '收到 ' + n + ' 則訊號，為您安排<b>銀羽豪華艙</b>，腿可以伸直一點了～';
    return (n ? '收到 ' + n + ' 則訊號，' : '訊號這次都擦身而過了，沒關係，') + '為您安排<b>銀羽艙</b>。下一趟說不定可以升等喔～';
  }
  function pad(k) { return (k < 10 ? '0' : '') + k; }
  function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  // 座位編碼照 product.md §5：白羽艙 W-01A（套房＋床位）、金羽艙 G-D3-12、銀羽豪華艙 S+-D4-08、銀羽艙 S-D4-36
  function seatOf(t) {
    if (t === 'W') return 'W-' + pad(rnd(1, 8)) + (Math.random() < 0.5 ? 'A' : 'K');
    if (t === 'G') return 'G-D' + rnd(2, 3) + '-' + pad(rnd(1, 24));
    if (t === 'S+') return 'S+-D4-' + pad(rnd(1, 20));
    return 'S-D' + rnd(4, 5) + '-' + pad(rnd(1, 60));
  }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function img(src) { var i = new Image(); i.src = src; return i; }
  var PHOTO = img(root.getAttribute('data-photo')), MARK = img(root.getAttribute('data-mark')), MARKL = img(root.getAttribute('data-mark-light'));
  var NAME_KEY = 'voy-name';
  function savedName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } }

  // ---- 畫圖小工具 ----
  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  // 四芒星（星芒標誌同一個形狀）：四個尖角用往中心凹的曲線連起來
  function sparkle(g, cx, cy, r) {
    g.beginPath(); g.moveTo(cx, cy - r);
    g.quadraticCurveTo(cx, cy, cx + r, cy); g.quadraticCurveTo(cx, cy, cx, cy + r);
    g.quadraticCurveTo(cx, cy, cx - r, cy); g.quadraticCurveTo(cx, cy, cx, cy - r); g.fill();
  }
  var BODY = getComputedStyle(document.body).fontFamily;
  var MONO = getComputedStyle(document.documentElement).getPropertyValue('--font-log') || 'monospace';
  function txt(g, str, x, y, size, color, o) {
    o = o || {};
    g.font = (o.weight || 400) + ' ' + size + 'px ' + (o.mono ? MONO : BODY);
    g.fillStyle = color; g.textAlign = o.align || 'left'; g.textBaseline = 'alphabetic';
    if ('letterSpacing' in g) g.letterSpacing = (o.sp || 0) + 'px';
    // 太長就縮小字級塞進寬度（例如很長的名字），不會跑出票面
    if (o.max) { var s0 = size; while (s0 > 12 && g.measureText(str).width > o.max) { s0 -= 2; g.font = (o.weight || 400) + ' ' + s0 + 'px ' + (o.mono ? MONO : BODY); } }
    g.fillText(str, x, y);
    var w = g.measureText(str).width;
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    return w;
  }
  function cover(g, im, x, y, w, h, r) {
    g.save(); rr(g, x, y, w, h, r); g.clip();
    if (im.complete && im.naturalWidth) {
      var k = Math.max(w / im.naturalWidth, h / im.naturalHeight), iw = im.naturalWidth * k, ih = im.naturalHeight * k;
      g.drawImage(im, x + (w - iw) / 2, y, iw, ih);   // 上緣對齊：寧可切小腿也不切頭（Robert 2026-11-16）
    } else { g.fillStyle = '#2a2f36'; g.fillRect(x, y, w, h); }
    g.restore();
  }
  // 條碼：純裝飾、不帶資料（跟 Grok 版一樣）；用名字＋日期當種子，同一張票每次畫出來一樣
  function barcode(g, x, y, w, h, seed, color) {
    var v = 0; for (var i = 0; i < seed.length; i++) v = (v * 31 + seed.charCodeAt(i)) >>> 0;
    g.fillStyle = color; var cx = x;
    while (cx < x + w - 6) { v = (v * 1103515245 + 12345) >>> 0; var bw = 2 + (v >>> 16) % 5; g.fillRect(cx, y, bw, h); cx += bw + 2 + (v >>> 8) % 5; }
  }
  // 訊號點：8 顆點，亮的是這趟真的接到的則數（有資料支撐，不是裝飾）
  function dots(g, cx, y, n, c) {
    for (var i = 0; i < SIGNALS; i++) {
      var x = cx + (i - (SIGNALS - 1) / 2) * 30;
      g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2);
      if (i < n) { g.fillStyle = c.hi; g.fill(); } else { g.strokeStyle = c.muted; g.lineWidth = 1.5; g.stroke(); }
    }
  }
  function field(g, x, y, label, value, sub, c, o) {
    txt(g, label, x, y, o.ls, c.muted, { mono: true, sp: 2 });
    var w = txt(g, value, x, y + o.gap, o.vs, c.ink, { weight: 600, mono: o.mono, max: o.max });
    if (o.chip) {   // 艙等旁邊的機位代號小框（W／G／S+／S）
      g.font = '600 ' + Math.round(o.vs * 0.55) + 'px ' + MONO;
      var cw = g.measureText(o.chip).width + 18, ch = o.vs * 0.8, cx = x + w + 14, cy = y + o.gap - o.vs * 0.72;
      g.strokeStyle = c.hi; g.lineWidth = 1.5; rr(g, cx, cy, cw, ch, 6); g.stroke();
      txt(g, o.chip, cx + cw / 2, cy + ch * 0.72, Math.round(o.vs * 0.55), c.hi, { weight: 600, mono: true, align: 'center' });
    }
    if (sub) txt(g, sub, x, y + o.gap + o.ss + 14, o.ss, c.muted, { mono: true, sp: 1 });
  }
  function routeRow(g, x1, x2, yl, yc, from, to, c, size) {
    txt(g, 'FROM', x1, yl, size * 0.4, c.muted, { mono: true, sp: 3 });
    txt(g, 'TO', x2, yl, size * 0.4, c.muted, { mono: true, sp: 3, align: 'right' });
    var wf = txt(g, from, x1, yc, size, c.ink, { weight: 600, mono: true });
    g.font = '600 ' + size + 'px ' + MONO; var wt = g.measureText(to).width;
    txt(g, to, x2, yc, size, c.hi, { weight: 600, mono: true, align: 'right' });
    var a = x1 + wf + 28, b = x2 - wt - 28, my = yc - size * 0.32;
    g.strokeStyle = c.line; g.lineWidth = 1.5; g.setLineDash([6, 8]);
    g.beginPath(); g.moveTo(a, my); g.lineTo(b, my); g.stroke(); g.setLineDash([]);
    g.fillStyle = c.hi; sparkle(g, (a + b) / 2, my, size * 0.26);
  }
  // 撕票孔：虛線＋兩端挖空的半圓（PNG 在缺口和圓角是透明的，貼到任何背景都像一張真的票）
  function perforation(g, W, H, pos, vertical, c) {
    g.strokeStyle = c.line; g.lineWidth = 1.5; g.setLineDash([10, 10]); g.beginPath();
    if (vertical) { g.moveTo(pos, 40); g.lineTo(pos, H - 40); } else { g.moveTo(40, pos); g.lineTo(W - 40, pos); }
    g.stroke(); g.setLineDash([]);
    var pts = vertical ? [[pos, 0], [pos, H]] : [[0, pos], [W, pos]];
    g.save(); g.globalCompositeOperation = 'destination-out';
    pts.forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], 28, 0, Math.PI * 2); g.fill(); });
    g.restore();
    g.strokeStyle = c.line; g.lineWidth = 2;
    pts.forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], 28, 0, Math.PI * 2); g.stroke(); });
  }
  function frame(g, W, H, c) {
    g.strokeStyle = c.line; g.lineWidth = 2; rr(g, 18, 18, W - 36, H - 36, 30); g.stroke();
    if (c.frames > 1) { g.globalAlpha = 0.5; g.lineWidth = 1; rr(g, 28, 28, W - 56, H - 56, 24); g.stroke(); g.globalAlpha = 1; }
  }
  function brand(g, x, y, size, c) {
    var m = c.mark === 'light' ? MARKL : MARK;
    if (m.complete && m.naturalWidth) g.drawImage(m, x, y - size * 0.82, size * 1.3, size * 1.3);
    else { g.fillStyle = c.ink; sparkle(g, x + size * 0.6, y - size * 0.3, size * 0.55); }
    txt(g, 'STARWING', x + size * 1.6, y, size, c.ink, { weight: 600, sp: size * 0.18 });
  }

  // T＝這張票的內容：{ t: 艙等, n: 訊號數, to: 目的地, seat, date, name }
  function drawTicket(cv2, T, wide) {
    var c = CLS[T.t], W = wide ? 1920 : 1080, H = wide ? 768 : 1920, g = cv2.getContext('2d');
    cv2.width = W; cv2.height = H;
    g.clearRect(0, 0, W, H);
    g.save(); rr(g, 0, 0, W, H, 44); g.clip(); g.fillStyle = c.bg; g.fillRect(0, 0, W, H); g.restore();
    frame(g, W, H, c);
    var name = T.name || '星羽號乘客', from = T.n ? 'LSA-711' : 'THE LOOP', gateLine = 'GATE 02 · 寫作系統 · 預計航程 38+ 光年';
    var seed = name + T.date + T.seat;
    if (!wide) {
      var P = 64, R = W - P;
      brand(g, P, 112, 34, c);
      txt(g, 'BOARDING PASS', R, 104, 30, c.ink, { mono: true, sp: 3, align: 'right', weight: 600 });
      txt(g, '登機證 · FLIGHT SW711', R, 142, 22, c.muted, { align: 'right', sp: 1 });
      cover(g, PHOTO, P, 176, W - 2 * P, 880, 18);
      g.strokeStyle = c.line; g.lineWidth = 1.5; rr(g, P, 176, W - 2 * P, 880, 18); g.stroke();
      routeRow(g, P, R, 1126, 1190, from, T.to, c, 56);
      txt(g, gateLine, P, 1244, 24, c.muted, { sp: 1 });
      g.globalAlpha = 0.5; g.fillStyle = c.line; g.fillRect(P, 1272, W - 2 * P, 1); g.globalAlpha = 1;
      field(g, P, 1322, 'PASSENGER 乘客', name, '', c, { ls: 20, gap: 54, vs: 44, ss: 18, max: 560 });
      field(g, P + 620, 1322, 'DATE 日期', T.date, '', c, { ls: 20, gap: 54, vs: 40, ss: 18, mono: true });
      field(g, P, 1452, 'CLASS 艙等', c.zh, c.en, c, { ls: 20, gap: 52, vs: 40, ss: 18, chip: T.t, max: 260 });
      field(g, P + 420, 1452, 'SEAT 座位', T.seat, '', c, { ls: 20, gap: 52, vs: 40, ss: 18, mono: true });
      field(g, P + 720, 1452, 'SIGNALS 訊號', T.n + ' / ' + SIGNALS, '', c, { ls: 20, gap: 52, vs: 40, ss: 18, mono: true });
      perforation(g, W, H, 1600, false, c);
      txt(g, 'GATE', P, 1690, 22, c.muted, { mono: true, sp: 3 });
      txt(g, '02', P - 4, 1804, 116, c.ink, { mono: true, weight: 300 });
      txt(g, '寫作系統', P, 1848, 24, c.muted);
      barcode(g, 330, 1668, 420, 96, seed, c.hi);
      dots(g, 540, 1810, T.n, c);
      txt(g, 'robert3h.github.io/lsa711', 540, 1862, 20, c.muted, { mono: true, align: 'center', sp: 1 });
      g.fillStyle = c.hi; sparkle(g, R - 56, 1736, 58);
      g.globalAlpha = 0.7; sparkle(g, R - 8, 1798, 20); g.globalAlpha = 1;   // 大星＋小星錯位：星芒標誌的意象
    } else {
      cover(g, PHOTO, 40, 40, 580, H - 80, 22);
      g.strokeStyle = c.line; g.lineWidth = 1.5; rr(g, 40, 40, 580, H - 80, 22); g.stroke();
      var L = 672, Rm = 1430;
      brand(g, L, 100, 30, c);
      txt(g, 'BOARDING PASS', Rm, 92, 26, c.ink, { mono: true, sp: 3, align: 'right', weight: 600 });
      txt(g, '登機證 · FLIGHT SW711', Rm, 126, 20, c.muted, { align: 'right', sp: 1 });
      routeRow(g, L, Rm, 200, 262, from, T.to, c, 50);
      txt(g, gateLine, L, 314, 22, c.muted, { sp: 1 });
      g.globalAlpha = 0.5; g.fillStyle = c.line; g.fillRect(L, 340, Rm - L, 1); g.globalAlpha = 1;
      field(g, L, 392, 'PASSENGER 乘客', name, '', c, { ls: 18, gap: 50, vs: 40, ss: 16, max: 440 });
      field(g, L + 500, 392, 'DATE 日期', T.date, '', c, { ls: 18, gap: 50, vs: 36, ss: 16, mono: true });
      field(g, L, 512, 'CLASS 艙等', c.zh, c.en, c, { ls: 18, gap: 48, vs: 36, ss: 16, chip: T.t, max: 230 });
      field(g, L + 340, 512, 'SEAT 座位', T.seat, '', c, { ls: 18, gap: 48, vs: 36, ss: 16, mono: true });
      field(g, L + 590, 512, 'SIGNALS 訊號', T.n + ' / ' + SIGNALS, '', c, { ls: 18, gap: 48, vs: 36, ss: 16, mono: true });
      txt(g, 'THE LOOP → LSA-711 · robert3h.github.io/lsa711', L, 700, 18, c.muted, { mono: true, sp: 1 });
      perforation(g, W, H, 1480, true, c);
      var cx = 1700;
      txt(g, 'GATE', cx, 128, 22, c.muted, { mono: true, sp: 3, align: 'center' });
      txt(g, '02', cx, 236, 104, c.ink, { mono: true, weight: 300, align: 'center' });
      txt(g, '寫作系統', cx, 280, 22, c.muted, { align: 'center' });
      txt(g, T.seat, cx, 336, 26, c.ink, { mono: true, align: 'center', weight: 600 });
      barcode(g, 1570, 372, 260, 84, seed, c.hi);
      dots(g, cx, 500, T.n, c);
      g.fillStyle = c.hi; sparkle(g, cx - 10, 620, 52);
      g.globalAlpha = 0.7; sparkle(g, cx + 44, 674, 18); g.globalAlpha = 1;
    }
  }

  function ticketHtml(T) {
    var c = CLS[T.t];
    return '<section class="voy-ticket" aria-labelledby="voy-ticket-h">' +
      '<h3 id="voy-ticket-h">你的紀念登機證</h3>' +
      '<div class="deck-pick voy-orient" role="group" aria-label="登機證方向">' +
        '<button type="button" class="ver-wide" data-o="wide" aria-pressed="false"><span class="ver-tag">建議</span>電腦版 橫式</button>' +
        '<button type="button" class="ver-tall" data-o="tall" aria-pressed="false"><span class="ver-tag">建議</span>手機版 直式</button></div>' +
      '<div class="voy-ticket-view"><canvas role="img" aria-label="紀念登機證：' + esc(c.zh) + '，座位 ' + esc(T.seat) + '，目的地 ' + esc(T.to) +
        '，這趟接收 ' + T.n + ' / ' + SIGNALS + ' 則訊號"></canvas></div>' +
      '<label for="voy-name">登機證上的名字<span class="opt">（可以留白；只記在這台裝置，不會送出）</span></label>' +
      '<input id="voy-name" type="text" maxlength="20" autocomplete="off" placeholder="例：Robert">' +
      '<div class="actions"><button type="button" class="btn primary voy-dl">下載登機證 PNG</button></div>' +
      '<p class="voy-note voy-dl-msg" role="status"></p></section>';
  }

  function bindTicket(T) {
    var box = result.querySelector('.voy-ticket'), view = box.querySelector('.voy-ticket-view'), c2 = view.querySelector('canvas');
    var nameIn = box.querySelector('#voy-name'), msg = box.querySelector('.voy-dl-msg'), btns = box.querySelectorAll('.voy-orient button');
    var wide = !(window.matchMedia && matchMedia('(orientation: portrait)').matches);   // 手機直拿先看直式，電腦先看橫式
    nameIn.value = T.name = savedName();
    function paint() {
      drawTicket(c2, T, wide);
      view.classList.toggle('is-wide', wide);
      [].forEach.call(btns, function (b) { b.setAttribute('aria-pressed', String((b.getAttribute('data-o') === 'wide') === wide)); });
    }
    [].forEach.call(btns, function (b) { b.addEventListener('click', function () { wide = b.getAttribute('data-o') === 'wide'; paint(); }); });
    nameIn.addEventListener('input', function () {
      T.name = nameIn.value.trim();
      try { localStorage.setItem(NAME_KEY, T.name); } catch (e) {}
      paint();
    });
    // 圖片還沒載完時先畫一次，載完再補畫
    [PHOTO, MARK, MARKL].forEach(function (im) { if (!im.complete) im.addEventListener('load', paint, { once: true }); });
    box.querySelector('.voy-dl').addEventListener('click', function () {
      var file = 'STARWING_SW711_' + T.t.replace('+', 'plus') + '_' + T.date + (wide ? '_wide' : '_tall') + '.png';
      try {
        c2.toBlob(function (blob) {
          if (!blob) { msg.textContent = '這個瀏覽器沒辦法直接下載，可以長按或右鍵上面的登機證另存圖片。'; return; }
          var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
          msg.textContent = '已下載：' + file;
        }, 'image/png');
      } catch (e) {
        // 用電腦直接打開本機檔案（file://）預覽時，瀏覽器的安全限制會擋下；放上網站後就能下載
        msg.textContent = '本機預覽無法下載（瀏覽器的安全限制），推上線後就可以。';
      }
    });
    paint();
  }

  function finish() {
    s.done = true; draw();
    stage.hidden = true; flying(false);
    var n = s.got.length, t = tierOf(n);
    var first = n ? window.LSA_FINDER.docs[s.got[0]] : null;
    // 目的地 TO＝第一則接到的訊號的原稿編號（LSA_013、A46…）；一則都沒接到，就是這班船本來的終點 LSA-711
    var T = { t: t, n: n, to: first && first.c ? first.c : 'LSA-711', seat: seatOf(t), date: today(), name: '' };
    result.innerHTML = '<p class="log">ARRIVED · LSA-711 軌道站</p><h2>抵達 LSA-711</h2>' +
      '<p class="voy-toast">' + comm('julian', '抵達 LSA-711 軌道站。') + '</p>' +
      '<p class="voy-toast">' + comm('ginni', tierLine(t, n)) + '</p>' +
      ticketHtml(T) +
      '<p>38 光年，設定上約 7 天的航程。' + (n ? '這趟你接收了 ' + n + ' / ' + SIGNALS + ' 則傳訊：' : '這趟的訊號都擦身而過了。') + '</p>' +
      (n ? list(s.got) : '') +
      // 子琦的設定集 hook（Robert 2026-11-07）：世界觀設定集還沒放上網站，先連到設定集頁的「星羽號綜合設定集」相簿
      '<p class="voy-toast">' + comm('ginni', '想知道 LSA-711 星球和星羽號的內裝長什麼樣嗎？請參考最新的設定集，放在賽博創界的設定集相簿裡。' +
        '<br><a href="../../cybertron/index.html#album-01">看設定集相簿 →</a>') + '</p>' +
      '<div class="actions"><button type="button" class="btn primary voy-again">再飛一次</button>' +
      '<a class="btn" href="../../archive/index.html">看全部傳訊</a></div>';
    result.hidden = false;
    bindTicket(T);
    result.querySelector('.voy-again').addEventListener('click', reset);
    result.querySelector('h2').focus();
  }

  function reset() {
    result.hidden = true; stage.hidden = true; flying(false); form.hidden = false; s = null; input.focus();
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
    stage.hidden = false; flying(true);
    resize(); newFlight(q);
    // 捲到整個遊戲畫面都看得到的位置（扣掉上方固定的導覽列，用實際量到的高度）
    var top = stage.getBoundingClientRect().top + window.pageYOffset - headerH() - 4;
    window.scrollTo(0, Math.max(0, top));
    toast.innerHTML = ''; pauseBtn.textContent = '暫停'; pauseBtn.setAttribute('aria-pressed', 'false');
    s.saidAt = -9;
    say('julian', HELLO);
    if (!raf) raf = requestAnimationFrame(loop);
    cv.focus();
  }

  // 不用 <form> 送出：沒有英文版的頁面按 English 會走 Google 翻譯（translate.goog），它會擋下所有表單（2026-11-07）。
  // 改成一般按鈕＋在輸入框按 Enter（注音選字中的 Enter 不算）
  function start() {
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    launch(input.value.trim(), !reduce);
  }
  form.querySelector('.actions button').addEventListener('click', start);
  input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && !ev.isComposing) { ev.preventDefault(); start(); } });

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
  // 只有寬度變了（手機轉向、電腦拉視窗）才重排；手機網址列伸縮只改高度，重排會讓畫面上下跳
  window.addEventListener('resize', function () { if (s && !stage.hidden && window.innerWidth !== lastW) resize(); });
})();

// ---------- 起飛前的「我是誰？」（2026-11-18）：點任一張看不清楚的登機證＝按「起飛」 ----------
(function () {
  var go = document.querySelector('.voy-start .actions .btn');
  if (!go) return;
  Array.prototype.forEach.call(document.querySelectorAll('.voy-mystery [data-go]'), function (b) {
    b.addEventListener('click', function () { go.click(); });
  });
})();
