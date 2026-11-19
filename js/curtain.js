/* Màn rèm mở đầu – hiện ở mọi lần tải trang (kể cả tải lại F5 hoặc mở lại tab).
   Thêm ?curtain=0 vào địa chỉ để bỏ qua khi phát triển.
   Chạm / nhấn Enter / Space → rèm mở trong ~2 giây, phát nhạc (lượt chạm này là thao tác hợp lệ của khách),
   ảnh nền thu phóng và chữ chạy từ hai bên. */
(function () {
  'use strict';

  var root = document.documentElement;
  var curtain = document.getElementById('curtain');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----- tách tiêu đề thành từng ký tự để chạy chữ ----- */
  function split() {
    var h = document.querySelector('.hero__content h1');
    if (!h || h.classList.contains('is-split')) return;
    Array.prototype.forEach.call(h.querySelectorAll('.hl'), function (line) {
      var text = line.textContent.trim(), i = 0;
      line.textContent = '';
      text.split(/\s+/).forEach(function (word, wi) {
        if (wi) line.appendChild(document.createTextNode(' '));
        var w = document.createElement('span'); w.className = 'hl-w';
        word.split('').forEach(function (ch) {
          var s = document.createElement('span'); s.className = 'hl-ch'; s.textContent = ch; s.style.setProperty('--i', i++); w.appendChild(s);
        });
        line.appendChild(w);
      });
    });
    h.classList.add('is-split');
  }
  split();

  var guarded = ['header', 'main', 'footer'].map(function (s) { return document.querySelector(s); }).filter(Boolean);
  function setInert(on) { guarded.forEach(function (el) { if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert'); }); }

  // đã xem rồi (hoặc không có màn) → bỏ màn, trang chạy như bình thường
  if (!curtain || !root.classList.contains('has-curtain')) {
    if (curtain) curtain.remove();
    return;
  }

  var openBtn = curtain.querySelector('.curtain__open');
  var skipBtn = curtain.querySelector('.curtain__skip');
  var opened = false;

  root.classList.add('curtain-lock');
  setInert(true);

  function open(fast) {
    if (opened) return;
    opened = true;
    fast = fast || reduce;

    // 1) nhạc: phải gọi ngay trong lượt chạm của khách (trình duyệt mới cho phát có tiếng)
    if (window.datMuiMusic && window.datMuiMusic.startWithFade) window.datMuiMusic.startWithFade(1500);

    // 2) bắt đầu chuyển động ở khung hình kế tiếp, tách khỏi việc khởi động âm thanh để không bị khựng
    requestAnimationFrame(function () {
      if (fast) curtain.classList.add('is-fast');
      curtain.classList.add('is-open');                       // khung hình đầu chỉ chạy rèm…
      setTimeout(function () { root.classList.add('hero-play'); }, fast ? 0 : 150);   // …rồi mới đến ảnh nền thu phóng và chữ
    });

    // 3) gỡ màn khi cánh rèm và diềm đã ra khỏi màn hình (không cần mờ dần vì đã ra ngoài khung)
    var total = fast ? (reduce ? 700 : 1000) : 2400;
    setTimeout(function () {
      curtain.remove();
      root.classList.remove('has-curtain', 'curtain-lock');
      setInert(false);
    }, total);
  }

  openBtn.addEventListener('click', function () { open(false); });
  // bàn phím: Enter / Space mở màn ngay cả khi chưa focus vào nút (Tab sẽ focus vào nút, có viền hiển thị)
  document.addEventListener('keydown', function (e) {
    if (opened || (e.key !== 'Enter' && e.key !== ' ')) return;
    if (e.target === skipBtn) return;
    e.preventDefault(); open(false);
  });
  skipBtn.addEventListener('click', function (e) { e.stopPropagation(); open(true); });
})();
