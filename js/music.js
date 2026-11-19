/* Nhạc nền từ assets/img/nhac.mp3 – tự phát khi vào trang và phát xuyên suốt.

   Vì sao trước đây "thoát ra vào lại là mất nhạc": sau khi phát được, bộ lắng nghe lượt chạm bị gỡ;
   khi quay lại, trình duyệt (nhất là điện thoại) chặn phát tự động nên không còn gì để bật nhạc lên.
   Cách làm hiện tại:
   - Luôn thử tự phát khi vào trang (có tiếng → nếu bị chặn thì phát im lặng).
   - Bộ lắng nghe lượt chạm LUÔN được giữ: bất cứ lúc nào nhạc đang tắt tiếng/dừng mà khách chạm vào trang
     (và khách không chủ động tắt) → nhạc bật lại ngay.
   - Không tự dừng nhạc khi chuyển tab; khi quay lại tab/trang (kể cả từ bộ nhớ đệm "back") sẽ phát tiếp.
   - Lưu vị trí đang phát: tải lại trang hoặc vào lại thì nhạc chạy tiếp từ đoạn đang nghe.
   - Nút ở góc màn hình để tắt/bật; lựa chọn "tắt" của khách được nhớ trên thiết bị. */
(function () {
  'use strict';

  var SRC = 'assets/img/nhac.mp3', KEY = 'viettel-datmui-music', TKEY = KEY + '-pos';
  var RESUME_WINDOW = 12 * 3600 * 1000;                      // chỉ nối tiếp vị trí cũ nếu cách chưa quá 12 giờ
  var btn = document.getElementById('music-btn');
  if (!btn) return;
  var label = btn.querySelector('.music-btn__label');

  var audio = new Audio();
  audio.src = SRC; audio.loop = true; audio.preload = 'auto'; audio.volume = 0.55;

  function store(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* bỏ qua */ } }
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  var wantOn = read(KEY) !== 'off';                          // khách chưa từng tắt thì mặc định bật
  var needsTap = false;                                      // true: trình duyệt đang chặn, chờ lượt chạm để có tiếng
  var GESTURES = ['pointerdown', 'touchstart', 'touchend', 'keydown', 'click'];

  /* ---------- giao diện nút ---------- */
  function ui() {
    var playing = !audio.paused && !audio.muted;
    var waiting = wantOn && needsTap && !playing;
    btn.classList.toggle('is-playing', playing);
    btn.classList.toggle('is-waiting', waiting);
    btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    btn.setAttribute('aria-label', playing ? 'Tắt nhạc nền' : (waiting ? 'Chạm để bật tiếng nhạc nền' : 'Bật nhạc nền'));
    label.textContent = waiting ? 'Chạm để nghe nhạc' : 'Nhạc';
  }

  /* ---------- nối tiếp vị trí đang nghe ---------- */
  var savedAt = 0;
  function savePos(force) {
    var now = Date.now();
    if (!force && now - savedAt < 1500) return;
    savedAt = now;
    if (audio.currentTime > 0) store(TKEY, JSON.stringify({ t: audio.currentTime, at: now }));
  }
  function restorePos() {
    try {
      var o = JSON.parse(read(TKEY));
      if (o && o.t > 0 && Date.now() - o.at < RESUME_WINDOW && (!audio.duration || o.t < audio.duration - 2)) audio.currentTime = o.t;
    } catch (e) { /* bỏ qua */ }
  }
  var restored = false;
  audio.addEventListener('loadedmetadata', function () { if (!restored) { restored = true; restorePos(); } });
  audio.addEventListener('timeupdate', function () { savePos(false); });
  window.addEventListener('pagehide', function () { savePos(true); });

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
    if (e.target && e.target.closest && e.target.closest('.music-btn')) return;   // nút nhạc tự xử lý
    if (wantOn && (audio.paused || audio.muted)) unlock();
  }
  GESTURES.forEach(function (t) { document.addEventListener(t, onGesture, true); });   // luôn giữ, không gỡ

  btn.addEventListener('click', function () {
    if (audio.paused || audio.muted) { wantOn = true; store(KEY, 'on'); unlock(); }
    else { wantOn = false; store(KEY, 'off'); audio.pause(); ui(); }
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
    if (document.hidden) savePos(true); else resume();
  });
  window.addEventListener('pageshow', function (e) { if (e.persisted) resume(); });   // quay lại bằng nút Back (bộ nhớ đệm)
  window.addEventListener('focus', resume);

  /* ---------- thông tin phát nhạc cho màn hình khóa / thông báo của hệ điều hành ---------- */
  if ('mediaSession' in navigator && window.MediaMetadata) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: 'Sóng về Đất Mũi, Tết về muôn nhà', artist: 'Viettel Cà Mau · REPLY 2006' });
    navigator.mediaSession.setActionHandler('play', function () { wantOn = true; store(KEY, 'on'); unlock(); });
    navigator.mediaSession.setActionHandler('pause', function () { wantOn = false; store(KEY, 'off'); audio.pause(); });
  }

  window.datMuiMusic = { start: unlock, audio: audio };
  autoplay();
  ui();
})();
