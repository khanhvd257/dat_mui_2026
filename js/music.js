/* Nhạc nền từ assets/img/dat_mui_audio.mp3 – tự phát khi vào trang.
   - Mỗi lần tải trang (vào mới, tải lại F5, mở lại tab) nhạc bắt đầu lại từ đầu; không lưu vị trí hay lựa chọn tắt qua các lần tải.
   - Mỗi lần nhạc bắt đầu nghe được âm lượng tăng dần từ 0 lên tối đa trong ~1,5 giây.
   - Trong cùng một lần mở trang: không tự dừng khi chuyển tab; bộ lắng nghe lượt chạm luôn được giữ để bật lại nhạc;
     nếu khách chủ động bấm tắt thì nhạc tắt cho đến khi bấm bật lại.
   - Trình duyệt chặn phát có tiếng khi chưa có thao tác: thử có tiếng → nếu bị chặn thì phát im lặng → bật tiếng ở lần chạm đầu tiên. */
(function () {
  'use strict';

  var SRC = 'assets/img/dat_mui_audio.mp3';
  var VOL_MAX = 1, RAMP_MS = 1500;
  var RESUME_WINDOW = 12 * 3600 * 1000;                      // chỉ nối tiếp vị trí cũ nếu cách chưa quá 12 giờ
  var btn = document.getElementById('music-btn');
  if (!btn) return;
  var label = btn.querySelector('.music-btn__label');

  var audio = new Audio();
  audio.src = SRC; audio.loop = true; audio.preload = 'auto'; audio.volume = 0;   // luôn bắt đầu từ im lặng rồi tăng dần

  try { ['viettel-datmui-music', 'viettel-datmui-music-pos', 'viettel-datmui-music-pos-v2'].forEach(function (k) { localStorage.removeItem(k); }); } catch (e) { /* dọn dữ liệu cũ */ }
  var wantOn = true;                                         // mỗi lần tải trang đều bắt đầu ở trạng thái bật
  var needsTap = false;                                      // true: trình duyệt đang chặn, chờ lượt chạm để có tiếng
  var GESTURES = ['pointerdown', 'touchstart', 'touchend', 'keydown', 'click'];

  /* ---------- giao diện nút ---------- */
  var wasAudible = false, rampRaf = 0, rampMs = RAMP_MS;
  function ramp(ms) {                                        // tăng âm lượng 0 → tối đa (ease in-out)
    cancelAnimationFrame(rampRaf);
    var t0 = performance.now();
    audio.volume = 0;
    (function step(now) {
      var k = Math.min(1, (now - t0) / ms);
      audio.volume = VOL_MAX * k * k * (3 - 2 * k);
      if (k < 1) rampRaf = requestAnimationFrame(step);
    })(t0);
  }

  function ui() {
    var playing = !audio.paused && !audio.muted;
    if (playing && !wasAudible) ramp(rampMs);                // vừa bắt đầu nghe được → tăng dần
    if (!playing && audio.volume !== 0) { cancelAnimationFrame(rampRaf); audio.volume = 0; }   // chuẩn bị cho lần sau
    wasAudible = playing;
    var waiting = wantOn && needsTap && !playing;
    btn.classList.toggle('is-playing', playing);
    btn.classList.toggle('is-waiting', waiting);
    btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    btn.setAttribute('aria-label', playing ? 'Tắt nhạc nền' : (waiting ? 'Chạm để bật tiếng nhạc nền' : 'Bật nhạc nền'));
    label.textContent = waiting ? 'Chạm để nghe nhạc' : 'Nhạc';
  }

  /* ---------- phát / bật tiếng ---------- */
  function tryPlay() {
    var p = audio.play();
    if (p && p.then) return p.then(function () { return true; }, function () { return false; });
    return Promise.resolve(!audio.paused);
  }

  // thử có tiếng; bị chặn thì phát im lặng và chờ lượt chạm
  function autoplay() {
    if (!wantOn) return ui();
    audio.muted = false;
    tryPlay().then(function (ok) {
      if (ok) { needsTap = false; return ui(); }
      needsTap = true; audio.muted = true;
      tryPlay().then(ui);
    });
  }

  // gọi trong lượt thao tác của khách: bật tiếng / phát lại
  function unlock() {
    if (!wantOn) return;
    audio.muted = false;
    if (!audio.paused) { needsTap = false; return ui(); }
    tryPlay().then(function (ok) { needsTap = !ok; ui(); });
  }

  function onGesture(e) {
    if (e.target && e.target.closest && e.target.closest('.music-btn, .curtain')) return;   // nút nhạc và màn rèm tự xử lý
    if (wantOn && (audio.paused || audio.muted)) unlock();
  }
  GESTURES.forEach(function (t) { document.addEventListener(t, onGesture, true); });   // luôn giữ, không gỡ

  btn.addEventListener('click', function () {
    if (audio.paused || audio.muted) { wantOn = true; unlock(); }
    else { wantOn = false; audio.pause(); ui(); }
  });

  audio.addEventListener('play', ui);
  audio.addEventListener('pause', ui);
  audio.addEventListener('volumechange', ui);

  /* ---------- quay lại trang / tab ---------- */
  function resume() {
    if (!wantOn) return;
    if (audio.paused) { tryPlay().then(function (ok) { if (!ok) { needsTap = true; audio.muted = true; tryPlay().then(ui); } ui(); }); }
    else if (audio.muted) { needsTap = true; ui(); }
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) resume();
  });
  window.addEventListener('pageshow', function (e) { if (e.persisted) resume(); });   // quay lại bằng nút Back (bộ nhớ đệm)
  window.addEventListener('focus', resume);

  /* ---------- thông tin phát nhạc cho màn hình khóa / thông báo của hệ điều hành ---------- */
  if ('mediaSession' in navigator && window.MediaMetadata) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: 'Sóng về Đất Mũi, Tết về muôn nhà', artist: 'Viettel Cà Mau · REPLY 2006' });
    navigator.mediaSession.setActionHandler('play', function () { wantOn = true; unlock(); });
    navigator.mediaSession.setActionHandler('pause', function () { wantOn = false; audio.pause(); });
  }

  // bật nhạc có tiếng, tăng âm lượng dần trong ms mili-giây (dùng khi mở màn rèm)
  function startWithFade(ms) {
    rampMs = ms || RAMP_MS;
    unlock();
  }

  window.datMuiMusic = { start: unlock, startWithFade: startWithFade, audio: audio };
  autoplay();
  ui();
})();
