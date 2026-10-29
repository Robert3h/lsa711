// 傳訊給我（2026-10-29）：把表單送到 Robert 的 Google Apps Script，由它存進試算表並寄信到 lsa711.cybertron@gmail.com。
// 送出前只檢查「想說的話」有沒有寫；稱呼、Email 都可以空白，降低開口的門檻。
(function () {
  var form = document.querySelector('form.transmit');
  if (!form) return;
  var EN = form.getAttribute('data-lang') === 'en';
  var endpoint = form.getAttribute('data-endpoint');
  var status = form.querySelector('.transmit-status');
  var btn = form.querySelector('button[type="submit"]');
  var label = btn.textContent;
  var MAIL = 'lsa711.cybertron@gmail.com';
  var T = EN ? {
    empty: 'Please write something first — even one sentence is enough.',
    sending: 'Sending…',
    fail: 'The signal didn’t get through. Please try again in a moment, or email ' + MAIL + '.',
    off: 'Messaging isn’t switched on yet. For now, please email ' + MAIL + '.',
    done: 'Signal sent 📡', thanks: 'Thank you. I’ll try to read every message.', again: 'Send another'
  } : {
    empty: '先寫一點想說的話吧，一句就夠了。',
    sending: '傳送中…',
    fail: '訊號沒有送出去。請稍後再試，或直接寄信到 ' + MAIL + '。',
    off: '傳訊功能還在準備中，暫時請寄信到 ' + MAIL + '。',
    done: '訊號已送出 📡', thanks: '謝謝你。我會盡量看每一則。', again: '再傳一則'
  };
  function say(msg, bad) { status.textContent = msg; status.classList.toggle('is-bad', !!bad); }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var msg = form.message.value.trim();
    if (!msg) { say(T.empty, true); form.message.focus(); return; }
    if (!endpoint) { say(T.off, true); return; }
    btn.disabled = true; btn.textContent = T.sending; say('');
    var data = new URLSearchParams({
      name: form.name.value.trim(), message: msg, email: form.email.value.trim(),
      website: form.website.value, lang: EN ? 'en' : 'zh',
      page: document.referrer || location.href      // 從哪一頁點進來的，方便 Robert 知道讀者剛讀了什麼
    });
    fetch(endpoint, { method: 'POST', body: data })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (j) { if (!j.ok) throw new Error('not ok'); done(); })
      .catch(function () { btn.disabled = false; btn.textContent = label; say(T.fail, true); });
  });

  // 送出成功：表單換成一段確認訊息；「再傳一則」把表單叫回來（內容已清空）
  function done() {
    form.reset(); btn.disabled = false; btn.textContent = label; say('');
    var box = document.createElement('div');
    box.className = 'transmit-done';
    box.setAttribute('tabindex', '-1');
    box.innerHTML = '<p class="log"></p><p class="lead"></p>';
    box.querySelector('.log').textContent = T.done;
    box.querySelector('.lead').textContent = T.thanks;
    var again = document.createElement('button');
    again.type = 'button'; again.className = 'btn'; again.textContent = T.again;
    again.addEventListener('click', function () { box.remove(); form.hidden = false; form.message.focus(); });
    box.appendChild(again);
    form.hidden = true;
    form.parentNode.insertBefore(box, form);
    box.focus();
  }
})();
