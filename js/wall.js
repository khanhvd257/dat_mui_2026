/* Dải tên khách đã check-in chạy ở nền khu Check-in – hiện ngay khi vào trang, không cần nhập tên.
   Lấy từ /api/checkins (tự cập nhật). Tên càng nhiều thì càng chia ra nhiều dòng (tối đa 8) để mỗi dòng ngắn, chạy nhanh vòng.
   Không có máy chủ (mở file tĩnh): chỉ hiện các tên được thêm ngay trong phiên này. */
(function () {
  'use strict';
  var wall = document.querySelector('.checkin__wall');
  var section = document.getElementById('checkin');
  if (!wall || !section) return;

  var MIN_ROWS = 3, MAX_ROWS = 8, PER_ROW = 6;      // mục tiêu ~6 tên / dòng
  var SPEED = 60, MAX_CYCLE = 70;                   // px/giây; một vòng không quá 70 giây
  var POLL_MS = 20000;
  var names = [], local = [], sig = '', inView = true, lastFetch = 0;

  function signature() { return names.length + '|' + names.slice(0, 3).join('/') + '|' + names[names.length - 1]; }
  function rowCount(n) { return Math.max(MIN_ROWS, Math.min(MAX_ROWS, Math.ceil(n / PER_ROW))); }

  function makeGroup(list, hidden) {
    var grp = document.createElement('span'); grp.className = 'wall__group';
    if (hidden) grp.setAttribute('aria-hidden', 'true');
    list.forEach(function (n) {
      var b = document.createElement('b'); b.textContent = n; grp.appendChild(b);
      var d = document.createElement('i'); d.setAttribute('aria-hidden', 'true'); grp.appendChild(d);
    });
    return grp;
  }

  function render() {
    var s = signature();
    if (s === sig) return;
    sig = s;
    wall.textContent = '';
    if (!names.length) return;

    var rows = rowCount(names.length);
    wall.className = 'checkin__wall wall--d' + (rows <= 3 ? 1 : rows <= 5 ? 2 : 3);

    // chia vòng tròn: tên mới nhất rải đều ở đầu các dòng
    var buckets = [];
    for (var r = 0; r < rows; r++) buckets.push([]);
    names.forEach(function (n, i) { buckets[i % rows].push(n); });

    var need = Math.max(window.innerWidth, 900) * 1.05;   // mỗi nhóm phải dài hơn khung nhìn để vòng lặp không hở
    buckets.forEach(function (list, r) {
      if (!list.length) list = names.slice(0, 1);
      var row = document.createElement('div'); row.className = 'wall__row' + (r % 2 ? ' wall__row--rev' : '');
      var track = document.createElement('div'); track.className = 'wall__track';
      var g1 = makeGroup(list, false); track.appendChild(g1);
      row.appendChild(track); wall.appendChild(row);

      // lặp danh sách cho tới khi đủ dài
      var guard = 0, items = list;
      while (g1.getBoundingClientRect().width < need && guard++ < 12) {
        items = items.concat(list);
        track.replaceChild(makeGroup(items, false), g1); g1 = track.firstChild;
      }
      var w = g1.getBoundingClientRect().width || need;
      track.appendChild(makeGroup(items, true));          // bản thứ hai nối liền
      var dur = Math.min(w / SPEED, MAX_CYCLE);
      track.style.animationDuration = dur.toFixed(1) + 's';
      track.style.animationDelay = (-Math.random() * dur).toFixed(1) + 's';   // các dòng lệch pha nhau
    });
  }

  function setNames(arr) { names = arr; render(); }

  function fetchList() {
    if (!window.fetch) return;
    lastFetch = Date.now();
    fetch('api/checkins', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (d) {
        if (!d || !Array.isArray(d.items)) return;
        var server = d.items.map(function (i) { return String(i.name || ''); }).filter(Boolean);
        local.forEach(function (n) { if (server.indexOf(n) === -1) server.unshift(n); });   // tên vừa nhập mà máy chủ chưa kịp trả
        setNames(server);
      }).catch(function () { /* không có máy chủ: giữ nguyên */ });
  }

  window.datMuiWall = {
    add: function (name) {
      if (!name) return;
      local.push(name);
      names = [name].concat(names); sig = ''; render();
    },
    refresh: fetchList
  };

  // chỉ cập nhật định kỳ khi khu Check-in đang trong tầm nhìn và tab đang mở
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      inView = en[0].isIntersecting;
      if (inView && Date.now() - lastFetch > POLL_MS) fetchList();
    }, { rootMargin: '200px 0px' }).observe(section);
  }
  setInterval(function () { if (inView && !document.hidden) fetchList(); }, POLL_MS);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && inView && Date.now() - lastFetch > POLL_MS) fetchList(); });

  fetchList();
})();
