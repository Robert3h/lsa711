// 〈Binary Star Ambient〉：不用音檔、由瀏覽器即時演奏的背景音樂（2026-11-28，Robert 試聽後喜歡）。
// 聲音的設計（72 BPM、Fmaj9→Em7→Dm9→Cmaj9、三層聲音、隨機留白）照 Robert 給的原型，沒有改。
// 和原型不同的地方只有「排程」：原型每拍用 setTimeout 才出聲，手機切到背景時計時器會被放慢、拍子會亂；
// 這裡改成提前 1.5 秒把音符排進音訊時鐘，計時器慢一點也不會斷拍。
// 只在讀者按下播放後才建立音訊（瀏覽器規定），給 music.js 呼叫：LSAAmbient.start(音量)、LSAAmbient.stop()。
(function () {
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;   // 太舊的瀏覽器就不提供這首，music.js 只會播 mp3 那首

  var BEAT = 60 / 72;
  var AHEAD = 1.5;   // 提前排多少秒
  var CHORDS = [
    { pad: [174.61, 220.00, 261.63, 329.63, 392.00], bass: 87.31, scale: [349.23, 392.00, 440.00, 523.25, 659.25] },
    { pad: [164.81, 196.00, 246.94, 293.66, 392.00], bass: 82.41, scale: [329.63, 392.00, 493.88, 587.33, 659.25] },
    { pad: [146.83, 174.61, 220.00, 261.63, 329.63], bass: 73.42, scale: [293.66, 349.23, 440.00, 523.25, 659.25] },
    { pad: [130.81, 164.81, 196.00, 246.94, 293.66], bass: 65.41, scale: [261.63, 329.63, 392.00, 493.88, 587.33] }
  ];
  // 每拍出聲的機率：第 0 拍固定落一顆低音，其他拍有留白
  var CHANCE = [0, 0.25, 0.65, 0.55, 0.2, 0.7, 0.6, 0.45];

  var ctx = null, out = null, master = null, timer = null, playing = false;
  var step = 0, nextAt = 0;

  function setup() {
    if (ctx) return;
    ctx = new AC();
    var comp = ctx.createDynamicsCompressor();   // 好幾個音疊在一起時不破音
    comp.threshold.value = -24; comp.knee.value = 30; comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = 0.0001;
    comp.connect(master); master.connect(ctx.destination);
    out = comp;
  }

  function pad(freqs, t, dur) {
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(520, t);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.045, t + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.15);
    f.connect(g); g.connect(out);
    freqs.forEach(function (fr) {
      [-4, 4].forEach(function (cents) {   // 兩個微微走音的振盪器，聲音比較寬
        var o = ctx.createOscillator(); o.type = 'triangle';
        o.frequency.setValueAtTime(fr, t); o.detune.setValueAtTime(cents, t);
        o.connect(f); o.start(t); o.stop(t + dur * 1.2);
      });
    });
  }

  function bass(fr, t, dur) {
    var o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(fr, t);
    f.type = 'lowpass'; f.frequency.setValueAtTime(240, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.1);
  }

  function piano(fr, t, vel) {
    var dur = BEAT * 3.2;
    var o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g2 = ctx.createGain();
    o1.type = 'sine'; o2.type = 'triangle';
    o1.frequency.setValueAtTime(fr, t); o2.frequency.setValueAtTime(fr * 2, t);
    g2.gain.setValueAtTime(0.15, t);
    var f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(920, t); f.frequency.exponentialRampToValueAtTime(360, t + dur);
    var env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(vel, t + 0.035);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o1.connect(f); o2.connect(g2); g2.connect(f); f.connect(env); env.connect(out);
    o1.start(t); o2.start(t); o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }

  function beat(t) {
    var chord = CHORDS[Math.floor(step / 8) % CHORDS.length], b = step % 8;
    if (b === 0) {
      pad(chord.pad, t, BEAT * 8);
      bass(chord.bass, t, BEAT * 8);
      piano(chord.scale[0], t, 0.13);
    } else if (Math.random() < CHANCE[b]) {
      var n = chord.scale[Math.floor(Math.random() * chord.scale.length)];
      piano(Math.random() > 0.78 ? n * 2 : n, t, 0.07 + Math.random() * 0.05);
    }
    step++;
  }

  function schedule() {
    while (nextAt < ctx.currentTime + AHEAD) { beat(nextAt); nextAt += BEAT; }
  }

  // 音量從「現在的值」開始變，按停止又馬上按播放時才不會跳一下
  function rampTo(v, sec) {
    var now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now);
    master.gain.linearRampToValueAtTime(v, now + sec);
  }

  window.LSAAmbient = {
    start: function (vol) {
      setup();
      if (ctx.state === 'suspended') ctx.resume();
      if (playing) return;
      playing = true;
      nextAt = ctx.currentTime + 0.1;
      rampTo(vol, 1.5);
      schedule();
      timer = setInterval(schedule, 250);
    },
    stop: function () {
      if (!playing) return;
      playing = false;
      clearInterval(timer);
      rampTo(0.0001, 1.2);   // 已經排好的音符在淡出中自然結束
    }
  };
})();
