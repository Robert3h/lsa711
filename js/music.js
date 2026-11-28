// 藝廊背景音樂：讀者自己決定要不要聽，絕不自動出聲。
// 第一次來：1.2 秒後滑出傳訊卡片；選過之後（記在讀者自己的瀏覽器）只留角落的 ♪，不再打擾。
// 瀏覽器規定要讀者先點一下才能出聲，所以「播放」一定要由讀者按下按鈕觸發。
// 2026-11-28 起有兩首：mp3〈Beneath the Amber〉和即時演奏的〈Binary Star Ambient〉（js/ambient.js）。
// 每次進來第一次按播放時隨機挑一首；播放中角落多一顆 ⇄，喜歡另一首的讀者自己換。
(function () {
  var audio = document.querySelector('.bgm');
  var card = document.querySelector('.transmission');
  var mini = document.querySelector('.tx-mini');
  var swap = document.querySelector('.tx-swap');
  if (!audio || !card || !mini) return;
  var label = mini.querySelector('.tx-label');
  var titleEl = mini.querySelector('.tx-title');
  var KEY = 'bgm-choice';
  var VOL = 0.6;          // 背景音樂不該蓋過讀者自己的思緒，音量留一點餘地
  var fadeTimer = null;

  var tracks = [{ kind: 'file', title: audio.getAttribute('data-title') || '' }];
  if (window.LSAAmbient) tracks.push({ kind: 'live', title: 'Binary Star Ambient' });
  var cur = -1;           // 這次造訪還沒挑歌

  function remember(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function recall() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }

  // 淡入淡出：突然出聲或突然斷掉都會嚇到人。iPhone 不允許程式調音量，會直接以原音量播放／停止。
  function fade(to, ms, done) {
    clearInterval(fadeTimer);
    var from = audio.volume, steps = Math.max(1, Math.round(ms / 50)), n = 0;
    fadeTimer = setInterval(function () {
      n++;
      audio.volume = Math.min(1, Math.max(0, from + (to - from) * n / steps));
      if (n >= steps) { clearInterval(fadeTimer); if (done) done(); }
    }, 50);
  }

  var EN_PAGE = (document.documentElement.lang || '').indexOf('en') === 0;   // 英文版設定集用英文
  function setPlaying(on) {
    mini.setAttribute('aria-pressed', on ? 'true' : 'false');
    mini.classList.toggle('is-playing', on);
    label.textContent = on ? (EN_PAGE ? 'Pause music' : '暫停音樂') : (EN_PAGE ? 'Play music' : '播放音樂');
    if (cur >= 0) titleEl.textContent = tracks[cur].title;
    if (swap) swap.hidden = !(on && tracks.length > 1);
  }

  function startTrack() {
    if (tracks[cur].kind === 'live') { window.LSAAmbient.start(0.85); return; }
    audio.volume = 0;
    var p = audio.play();
    fade(VOL, 1500);
    if (p && p.catch) p.catch(function () { setPlaying(false); label.textContent = EN_PAGE ? 'Music can’t play right now' : '音樂暫時無法播放'; });
  }
  function stopTrack() {
    if (tracks[cur].kind === 'live') { window.LSAAmbient.stop(); return; }
    fade(0, 600, function () { audio.pause(); });
  }

  function play() {
    if (cur < 0) cur = Math.floor(Math.random() * tracks.length);
    setPlaying(true);
    startTrack();
  }
  function pause() {
    setPlaying(false);
    stopTrack();
  }

  function showMini() { mini.hidden = false; }
  function closeCard() {
    card.classList.remove('show');
    // 等滑出動畫結束再真正隱藏，報讀軟體也就不會再讀到它
    setTimeout(function () { card.hidden = true; }, 400);
    showMini();
  }

  card.querySelector('.tx-play').addEventListener('click', function () {
    remember('play'); closeCard(); play(); mini.focus();
  });
  card.querySelector('.tx-no').addEventListener('click', function () {
    remember('no'); closeCard(); mini.focus();
  });
  mini.addEventListener('click', function () {
    if (mini.getAttribute('aria-pressed') === 'true') { remember('no'); pause(); }
    else { remember('play'); play(); }
  });
  if (swap) swap.addEventListener('click', function () {
    stopTrack();
    cur = (cur + 1) % tracks.length;
    setPlaying(true);
    startTrack();
  });

  // 讀者播放藝廊短片時，背景音樂先讓開，避免兩個聲音疊在一起
  Array.prototype.forEach.call(document.querySelectorAll('.clip video'), function (v) {
    v.addEventListener('play', function () { if (mini.getAttribute('aria-pressed') === 'true') pause(); });
  });

  if (recall()) {
    showMini();
  } else if (window.matchMedia('(max-width: 759px)').matches) {
    // 手機：卡片放進頁首說明區、不浮在劇照上（浮動卡片在窄螢幕上幾乎全寬，會一直擋住照片）
    var head = document.querySelector('.page-head');
    if (head) { head.appendChild(card); card.classList.add('inline'); }
    card.hidden = false;
    card.classList.add('show');
  } else {
    setTimeout(function () {
      card.hidden = false;
      // 先顯示、下一個畫面再加 show，滑入的過渡效果才會發生
      requestAnimationFrame(function () { requestAnimationFrame(function () { card.classList.add('show'); }); });
    }, 1200);
  }
})();
