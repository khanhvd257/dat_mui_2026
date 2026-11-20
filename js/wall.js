/* Tên khách đã check-in chạy ở nền khu Check-in – hiện ngay khi vào trang, không cần nhập tên.
   Mỗi dòng chạy MỘT tên, chạy hết thì lấy tên kế tiếp. Tên được xáo ngẫu nhiên sau khi tải về
   (không theo thứ tự check-in); tên mới check-in được ưu tiên hiện sớm.
   Lấy từ /api/checkins (tự cập nhật). Không có máy chủ: chỉ hiện tên vừa nhập trong phiên. */
(function () {
  'use strict';
  var wall = document.querySelector('.checkin__wall');
  var section = document.getElementById('checkin');
  if (!wall || !section) return;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var POLL_MS = 20000, MIN_ROWS = 3, MAX_ROWS = 9;
  var all = [], queue = [], fresh = [], known = Object.create(null), local = [];
  var rows = [], started = false, inView = true, lastFetch = 0, builtW = 0;

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function shown() { var o = Object.create(null); rows.forEach(function (r) { if (r.name) o[r.name] = 1; }); return o; }

  // chọn tên kế tiếp: ưu tiên tên mới, rồi tên ngẫu nhiên chưa lặp trong vòng xáo, tránh trùng tên đang hiện
  function nextName() {
    if (!all.length) return null;
    var now = shown(), n, skipped = [];
    while (fresh.length) { n = fresh.shift(); if (!now[n]) return n; }
    var pick = null;
    for (var tries = 0; tries < all.length + 2 && pick === null; tries++) {
      if (!queue.length) queue = shuffle(all.slice());
      n = queue.pop();
      if (!now[n] || all.length <= rows.length) pick = n; else skipped.push(n);
    }
    if (skipped.length) queue = skipped.concat(queue);   // trả lại, dùng sau
    return pick === null ? all[Math.floor(Math.random() * all.length)] : pick;
  }

  function baseSpeed() { return window.innerWidth >= 900 ? 210 : 150; }   // px/giây (nhanh)

  function launch(row, initial) {
    var n = nextName();
    row.el.textContent = ''; row.name = null; row.anim = null;
    if (!n) return;
    var b = document.createElement('b');
    b.textContent = n; if (Math.random() < .5) b.className = 'is-fill';
    row.el.appendChild(b); row.name = n;
    var vw = row.el.clientWidth, w = b.offsetWidth, pad = 24;
    var from = row.dir > 0 ? -w - pad : vw + pad, to = row.dir > 0 ? vw + pad : -w - pad;
    if (reduce) {                                       // giảm chuyển động: đứng yên, đổi tên sau mỗi vài giây
      b.style.transform = 'translate3d(' + Math.max(0, Math.random() * (vw - w)).toFixed(0) + 'px,0,0)';
      row.timer = setTimeout(function () { launch(row, false); }, 5000 + Math.random() * 4000);
      return;
    }
    var dur = (vw + w + pad * 2) / (baseSpeed() * (0.75 + Math.random() * 0.5)) * 1000;
    var a = b.animate(
      [{ transform: 'translate3d(' + from + 'px,0,0)' }, { transform: 'translate3d(' + to + 'px,0,0)' }],
      { duration: dur, easing: 'linear', fill: 'both' });
    if (initial) a.currentTime = Math.random() * dur * 0.85;      // các dòng bắt đầu ở vị trí khác nhau
    a.onfinish = function () { launch(row, false); };
    row.anim = a;
    if (!inView) a.pause();
  }

  function rowTarget() {
    var probe = document.createElement('div'); probe.className = 'wall__row'; probe.style.visibility = 'hidden';
    wall.appendChild(probe);
    var h = probe.offsetHeight || 80; wall.removeChild(probe);
    var n = Math.floor(wall.clientHeight / (h * 1.45));
    return Math.max(MIN_ROWS, Math.min(MAX_ROWS, n, Math.max(MIN_ROWS, all.length)));
  }

  function clearRows() { rows.forEach(function (r) { if (r.anim) r.anim.cancel(); clearTimeout(r.timer); }); rows = []; wall.textContent = ''; }

  function build() {
    clearRows();
    if (!all.length) return;
    var count = rowTarget();
    builtW = wall.clientWidth;
    for (var i = 0; i < count; i++) {
      var el = document.createElement('div'); el.className = 'wall__row';
      wall.appendChild(el);
      rows.push({ el: el, dir: i % 2 ? -1 : 1, name: null, anim: null, timer: 0 });
    }
    rows.forEach(function (r) { launch(r, true); });
  }

  function setNames(arr) {
    var firstLoad = !started; started = true;
    arr.forEach(function (n) { if (!known[n]) { known[n] = 1; if (!firstLoad) fresh.push(n); } });
    local.forEach(function (n) { if (arr.indexOf(n) === -1) arr.push(n); });
    all = arr;
    queue = shuffle(all.slice());                       // xáo ngẫu nhiên mỗi lần lấy về
    if (!rows.length || rows.length < rowTarget()) build();
  }

  function fetchList() {
    if (!window.fetch) return;
    lastFetch = Date.now();
    fetch('api/checkins', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (d) {
        if (d && Array.isArray(d.items)) setNames(d.items.map(function (i) { return String(i.name || ''); }).filter(Boolean));
      }).catch(function () { /* không có máy chủ: giữ nguyên */ });
  }

  window.datMuiWall = {
    add: function (name) {
      if (!name) return;
      local.push(name); known[name] = 1; all.push(name); fresh.unshift(name); started = true;
      if (!rows.length) build();
    },
    refresh: fetchList
  };

  // dựng lại khi đổi kích thước (xoay máy, hiện phiếu làm khu check-in cao hơn…) nếu số dòng/độ rộng đổi
  if ('ResizeObserver' in window) {
    var t = null;
    new ResizeObserver(function () {
      clearTimeout(t);
      t = setTimeout(function () {
        if (!all.length) return;
        if (wall.clientWidth !== builtW || rowTarget() !== rows.length) build();
      }, 250);
    }).observe(wall);
  }

  // chỉ cập nhật/chạy khi khu Check-in đang trong tầm nhìn và tab đang mở
  function setInView(v) {
    inView = v;
    rows.forEach(function (r) { if (r.anim) { if (v) r.anim.play(); else r.anim.pause(); } });
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      setInView(en[0].isIntersecting);
      if (inView && Date.now() - lastFetch > POLL_MS) fetchList();
    }, { rootMargin: '200px 0px' }).observe(section);
  }
  setInterval(function () { if (inView && !document.hidden) fetchList(); }, POLL_MS);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && inView && Date.now() - lastFetch > POLL_MS) fetchList(); });

  fetchList();
})();
