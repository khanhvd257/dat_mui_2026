/* Nhạc nền từ assets/img/nhac.mp3 – tự phát khi vào trang.
   Trình duyệt chỉ cho phát có tiếng sau khi khách có thao tác, nên làm theo 3 bước:
   1) thử phát có tiếng ngay khi vào trang (được nếu trình duyệt cho phép);
   2) nếu bị chặn → phát im lặng (muted) ngay, bài vẫn chạy;
   3) ở lần chạm/nhấn phím đầu tiên của khách → bật tiếng ngay (không phải tải lại bài).
   Nút ở góc màn hình để tắt/bật; lựa chọn "tắt" được nhớ trên thiết bị.
   Nhạc tự dừng khi chuyển tab/khóa màn hình và phát tiếp khi quay lại. */
(function () {
  'use strict';

  var SRC = 'assets/img/nhac.mp3', KEY = 'viettel-datmui-music';
  var btn = document.getElementById('music-btn');
  if (!btn) return;
  var label = btn.querySelector('.music-btn__label');

  var audio = new Audio();
  audio.src = SRC; audio.loop = true; audio.preload = 'auto'; audio.volume = 0.55;

  function pref() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function setPref(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* bỏ qua */ } }

  var wantOn = pref() !== 'off';
  var pausedByHide = false;
  var needsTap = false;                                      // true khi trình duyệt chặn phát có tiếng và đang chờ khách chạm
  var GESTURES = ['pointerdown', 'touchend', 'keydown', 'click'];

  function ui() {
    var playing = !audio.paused && !audio.muted;
    var waiting = wantOn && needsTap && !playing;        // đang chạy im lặng (hoặc bị chặn hẳn), chờ khách chạm
    btn.classList.toggle('is-playing', playing);
    btn.classList.toggle('is-waiting', waiting);
    btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    btn.setAttribute('aria-label', playing ? 'Tắt nhạc nền' : (waiting ? 'Chạm để bật tiếng nhạc nền' : 'Bật nhạc nền'));
    label.textContent = waiting ? 'Chạm để nghe nhạc' : 'Nhạc';
  }

  function listen(on) {
    GESTURES.forEach(function (t) { document[on ? 'addEventListener' : 'removeEventListener'](t, onGesture, true); });
  }

  // đưa nhạc về trạng thái "có tiếng" – gọi trong lượt thao tác của khách
  function unlock() {
    if (!wantOn) return;
    audio.muted = false;
    var p = audio.paused ? audio.play() : null;
    if (p && p.then) p.then(function () { needsTap = false; ui(); listen(false); }, function () { needsTap = true; ui(); });
    else { needsTap = audio.paused; ui(); if (!audio.paused) listen(false); }
  }

  function onGesture(e) {
    if (e.target && e.target.closest && e.target.closest('.music-btn')) return;   // nút nhạc tự xử lý
    unlock();
  }

  btn.addEventListener('click', function () {
    if (audio.muted || audio.paused) { wantOn = true; setPref('on'); unlock(); }
    else { wantOn = false; setPref('off'); audio.pause(); }
  });

  audio.addEventListener('play', ui);
  audio.addEventListener('pause', ui);
  audio.addEventListener('volumechange', ui);

  // 1) + 2) tự phát khi vào trang
  function autoplay() {
    if (!wantOn) return;
    audio.muted = false;
    var p = audio.play();
    if (!p || !p.then) return;
    p.then(function () { needsTap = false; ui(); listen(false); }, function () {
      needsTap = true;                                     // bị chặn → phát im lặng, chờ chạm để có tiếng
      audio.muted = true;
      var q = audio.play();
      if (q && q.then) q.then(ui, ui); else ui();
    });
  }

  // 3) chờ lượt chạm đầu tiên để bật tiếng
  if (wantOn) listen(true);
  autoplay();

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { if (!audio.paused) { pausedByHide = true; audio.pause(); } }
    else if (pausedByHide) { pausedByHide = false; if (wantOn) { var p = audio.play(); if (p && p.catch) p.catch(function () {}); } }
  });

  window.datMuiMusic = { start: unlock, audio: audio };
  ui();
})();
