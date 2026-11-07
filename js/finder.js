// 全部傳訊頁「找 3 篇」（2026-11-07）：讀者打一句話，依文字相似度推薦 3 篇。
// 不用 AI、不連網：索引（finder-data.js）由 build_site.py 產生，比對全在讀者的瀏覽器裡做，打的字不會送出。
// 拆詞方式要和 build_site.py 的 find_tokens 一樣：中文兩個字一組、英數字整個字。
(function () {
  var form = document.querySelector('.finder-form');
  var input = form && form.querySelector('input');
  var out = document.querySelector('.finder-out');
  var MIN = 60;          // 分數太低＝只是剛好撞到一兩個常見詞，當作沒找到（2026-11-07 用 10 句測試句調出來的）

  function tokens(s) {
    var runs = s.toLowerCase().match(/[一-鿿]+|[a-z0-9]+/g) || [];
    var t = [];
    runs.forEach(function (r) {
      if (r[0] < '一') { if (r.length > 1) t.push(r); }
      else if (r.length === 1) t.push(r);
      else for (var k = 0; k < r.length - 1; k++) t.push(r.slice(k, k + 2));
    });
    return t;
  }

  // 索引檔第一次用到才下載，平常逛全部傳訊不用多載這份資料
  function load(done) {
    if (window.LSA_FINDER) return done();
    var s = document.createElement('script');
    s.src = form.getAttribute('data-src');
    s.onload = done;
    s.onerror = function () { show('<p>索引載入失敗，請重新整理再試一次。</p>'); };
    document.head.appendChild(s);
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  function show(html) { out.innerHTML = html; }

  function search(q) {
    var F = window.LSA_FINDER, score = {}, hits = {};
    var seen = {};
    tokens(q).forEach(function (t) {
      if (seen[t]) return; seen[t] = 1;
      (F.index[t] || []).forEach(function (p) {
        score[p[0]] = (score[p[0]] || 0) + p[1];
        (hits[p[0]] = hits[p[0]] || []).push([t, p[1]]);
      });
    });
    var ids = Object.keys(score).map(Number).filter(function (i) { return score[i] >= MIN; })
      .sort(function (a, b) { return score[b] - score[a]; }).slice(0, 3);
    return { ids: ids, hits: hits };
  }

  // 小遊戲「38 光年航程」也用同一套比對（2026-11-07），不另外寫一份，免得兩邊算法不一樣
  window.LSAFind = { search: search };
  if (!form) return;

  // 「相關字」：把對到的兩字組接回讀者原本打的詞（說太＋太悲＋悲觀 → 太悲觀），不顯示碎片
  function words(q, hits) {
    var m = {}, out = [];
    hits.forEach(function (h) { m[h[0]] = 1; });
    // 用讀者原本的大小寫顯示（打 AI 就顯示 AI），比對時才轉小寫
    (q.match(/[一-鿿]+|[a-z0-9]+/gi) || []).forEach(function (r) {
      if (r[0] < '一') { if (m[r.toLowerCase()]) out.push(r); return; }
      if (r.length === 1) { if (m[r]) out.push(r); return; }
      var cov = [];
      for (var k = 0; k < r.length - 1; k++) if (m[r.slice(k, k + 2)]) { cov[k] = cov[k + 1] = 1; }
      var s = '';
      for (k = 0; k <= r.length; k++) {
        if (cov[k]) s += r[k];
        else { if (s.length > 1) out.push(s); s = ''; }
      }
    });
    return out.filter(function (w, i) { return out.indexOf(w) === i; })
      .sort(function (a, b) { return b.length - a.length; }).slice(0, 3);
  }

  function item(d, words) {
    var ext = !/^\.\.\//.test(d.u);
    var why = words && words.length ? '<span class="finder-why">相關字：' + words.map(esc).join('、') + '</span>' : '';
    return '<li><a href="' + esc(d.u) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + esc(d.t) + '</a>' +
      '<span class="log">' + esc(d.d) + ' · ' + esc(d.r) + (ext ? ' · Vocus' : ' · 本站閱讀') + '</span>' +
      (d.m ? '<span class="finder-mood">適合：' + esc(d.m) + '</span>' : '') + why + '</li>';
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var q = input.value.trim();
    if (!q) { show('<p>先寫一句話再按「找 3 篇」。</p>'); input.focus(); return; }
    load(function () {
      var F = window.LSA_FINDER, r = search(q);
      if (!r.ids.length) {
        // 對不到時改成「情境清單」：讀者照自己的處境挑，不是每次都塞同樣 3 篇（Robert 2026-11-07）
        // 情境越填越多時只先列 8 條，其餘按「看全部」再展開
        var MAX = 8, all = F.fallback;
        var li = function (i, k) {
          var d = F.docs[i];
          return '<li' + (k >= MAX ? ' hidden' : '') + '><a href="' + esc(d.u) + '">' + esc(d.m) + '</a>' +
            '<span class="finder-mood">' + esc(d.t) + '</span></li>';
        };
        show('<p>沒有找到很接近的。也可以從下面挑一個最像你現在的狀況：</p><ul class="finder-moods">' +
          all.map(li).join('') + '</ul>' +
          (all.length > MAX ? '<button type="button" class="btn finder-more">看全部 ' + all.length + ' 條</button>' : ''));
        var more = out.querySelector('.finder-more');
        if (more) more.addEventListener('click', function () {
          out.querySelectorAll('.finder-moods li[hidden]').forEach(function (x) { x.hidden = false; });
          more.remove();
        });
        return;
      }
      show('<p>依文字相似度，最接近的 ' + r.ids.length + ' 篇：</p><ol>' + r.ids.map(function (i) {
        return item(F.docs[i], words(q, r.hits[i]));
      }).join('') + '</ol>');
    });
  });
})();
