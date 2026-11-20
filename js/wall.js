/* Dải chữ chạy phía sau phiếu check-in: tên các khách đã check-in (lấy từ máy chủ /api/checkins).
   Nếu không có máy chủ (mở file tĩnh), dải chỉ hiện các tên được thêm ngay trong phiên này. */
(function () {
  'use strict';
  var wall = document.querySelector('.checkin__wall');
  var section = document.getElementById('checkin');
  if (!wall || !section) return;

  var ROWS = 3, MIN_ITEMS = 12, SPEED = 60;           // px/giây
  var names = [], sig = '', timer = null;

  function signature() { return names.length + '|' + (names[0] || '') + '|' + (names[names.length - 1] || ''); }

  function render() {
    var s = signature();
    if (s === sig) return;
    sig = s;
    wall.textContent = '';
    if (!names.length) return;
    for (var r = 0; r < ROWS; r++) {
      var list = names.filter(function (_, i) { return i % ROWS === r; });
      if (!list.length) list = names.slice();
      while (list.length < MIN_ITEMS) list = list.concat(list);
      var row = document.createElement('div'); row.className = 'wall__row' + (r % 2 ? ' wall__row--rev' : '');
      var track = document.createElement('div'); track.className = 'wall__track';
      for (var c = 0; c < 2; c++) {                      // hai bản liền nhau để vòng lặp không hở
        var grp = document.createElement('span'); grp.className = 'wall__group';
        if (c) grp.setAttribute('aria-hidden', 'true');
        list.forEach(function (n) {
          var b = document.createElement('b'); b.textContent = n; grp.appendChild(b);
          var d = document.createElement('i'); d.setAttribute('aria-hidden', 'true'); grp.appendChild(d);
        });
        track.appendChild(grp);
      }
      row.appendChild(track); wall.appendChild(row);
      // tốc độ theo độ dài thực của dải
      (function (t) {
        requestAnimationFrame(function () { t.style.animationDuration = Math.max(30, (t.scrollWidth / 2) / SPEED) + 's'; });
      })(track);
    }
  }

  function setNames(arr) { names = arr; render(); }

  function fetchList() {
    if (!window.fetch) return;
    fetch('api/checkins', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (d) {
        if (d && Array.isArray(d.items)) {
          var server = d.items.map(function (i) { return String(i.name || ''); }).filter(Boolean);
          // giữ lại tên vừa thêm tại chỗ nếu máy chủ chưa kịp trả về
          names.forEach(function (n) { if (server.indexOf(n) === -1 && local.indexOf(n) !== -1) server.unshift(n); });
          setNames(server);
        }
      }).catch(function () { /* không có máy chủ: giữ nguyên */ });
  }

  var local = [];
  window.datMuiWall = {
    add: function (name) {
      if (!name) return;
      local.push(name);
      names = [name].concat(names); sig = ''; render();
    },
    refresh: fetchList
  };

  fetchList();
  timer = setInterval(function () { if (!document.hidden && section.classList.contains('has-cert')) fetchList(); }, 30000);
})();
