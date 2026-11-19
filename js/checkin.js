/* Check-in & Chứng nhận số – chạy hoàn toàn trên trình duyệt, không gửi dữ liệu đi đâu.
   Tên và thời điểm check-in chỉ lưu trong localStorage của thiết bị.
   Lưu ý: số chứng nhận được sinh ngẫu nhiên trên máy khách, mang tính lưu niệm
   (không có máy chủ để xác thực). */
(function () {
  'use strict';

  var KEY = 'viettel-datmui-checkin-v1';
  var form = document.getElementById('checkin-form');
  if (!form) return;

  var input = document.getElementById('guest-name');
  var nameError = document.getElementById('name-error');
  var result = document.getElementById('cert-result');
  var hello = document.getElementById('cert-hello');
  var canvas = document.getElementById('cert-canvas');
  var dlBtn = document.getElementById('cert-download');
  var shareBtn = document.getElementById('cert-share');
  var resetBtn = document.getElementById('cert-reset');
  var certError = document.getElementById('cert-error');
  var current = null;

  /* ---------- lưu trữ cục bộ ---------- */
  function load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
  function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* bỏ qua */ } }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) { /* bỏ qua */ } }

  /* ---------- tiện ích ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtDate(ts) { var d = new Date(ts); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); }
  function fmtTime(ts) { var d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function makeSerial(ts) {
    var d = new Date(ts), chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', out = '', buf = new Uint8Array(5);
    (window.crypto || window.msCrypto).getRandomValues(buf);
    for (var i = 0; i < buf.length; i++) out += chars[buf[i] % chars.length];
    return 'VT-CM-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + out;
  }
  function loadImg(src) {
    return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; });
  }
  function cleanName(v) { return v.replace(/\s+/g, ' ').trim().slice(0, 40); }

  /* ---------- vẽ chứng nhận (1080 × 1500) ---------- */
  function spaced(ctx, px) { if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px'; }
  function fit(ctx, text, weight, maxPx, minPx, maxW) {
    var size = maxPx;
    do { ctx.font = weight + ' ' + size + 'px Roboto, Arial, sans-serif'; size -= 2; }
    while (ctx.measureText(text).width > maxW && size >= minPx);
    return size + 2;
  }

  function draw(data) {
    var W = 1080, H = 1500, PAD = 72, ctx = canvas.getContext('2d');
    var fontsReady = (document.fonts && document.fonts.load)
      ? Promise.all([document.fonts.load('900 60px Roboto'), document.fonts.load('700 30px Roboto'), document.fonts.load('400 30px Roboto')]).catch(function () {})
      : Promise.resolve();

    return Promise.all([loadImg('assets/img/hero.webp'), loadImg('assets/logo/viettel-logo-white.svg'), fontsReady]).then(function (r) {
      var photo = r[0], logo = r[1];

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);

      // ảnh đầu trang (cover, ưu tiên phần có công trình & rừng)
      var PH = 560, scale = Math.max(W / photo.width, PH / photo.height);
      var sw = W / scale, sh = PH / scale, sx = (photo.width - sw) / 2, sy = (photo.height - sh) * 0.72;
      ctx.drawImage(photo, sx, sy, sw, sh, 0, 0, W, PH);
      var g = ctx.createLinearGradient(0, 0, 0, 220); g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, 220);
      ctx.drawImage(logo, PAD, 56, 200, 200 * 170 / 800);

      // dải đỏ
      ctx.fillStyle = '#EE0033'; ctx.fillRect(0, PH, W, 12);

      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';

      // nhãn
      ctx.fillStyle = '#EE0033'; ctx.font = '700 26px Roboto, Arial, sans-serif'; spaced(ctx, 8);
      ctx.fillText('CHỨNG NHẬN SỐ', PAD, 654);

      // tiêu đề
      var TXT = W - PAD * 2;
      ctx.fillStyle = '#000000'; spaced(ctx, -1);
      var s1 = fit(ctx, 'ĐÃ ĐẾN VỚI GIAN HÀNG', '900', 64, 40, TXT);
      ctx.font = '900 ' + s1 + 'px Roboto, Arial, sans-serif';
      ctx.fillText('ĐÃ ĐẾN VỚI GIAN HÀNG', PAD, 748);

      ctx.fillStyle = '#EE0033'; spaced(ctx, -3);
      var s2 = fit(ctx, 'REPLY 2006', '900', 150, 80, TXT);
      ctx.font = '900 ' + s2 + 'px Roboto, Arial, sans-serif';
      ctx.fillText('REPLY 2006', PAD, 884);

      ctx.fillStyle = '#44494D'; spaced(ctx, 2);
      var s3 = fit(ctx, 'SÓNG VỀ ĐẤT MŨI, TẾT VỀ MUÔN NHÀ', '700', 34, 22, TXT);
      ctx.font = '700 ' + s3 + 'px Roboto, Arial, sans-serif';
      ctx.fillText('SÓNG VỀ ĐẤT MŨI, TẾT VỀ MUÔN NHÀ', PAD, 944);

      // đường kẻ
      ctx.fillStyle = '#E3E3E3'; ctx.fillRect(PAD, 990, W - PAD * 2, 2);

      // người nhận
      ctx.fillStyle = '#7b7f83'; ctx.font = '400 24px Roboto, Arial, sans-serif'; spaced(ctx, 3);
      ctx.fillText('TRAO CHO', PAD, 1050);
      spaced(ctx, 0);
      var ns = fit(ctx, data.name, '700', 96, 40, W - PAD * 2);
      ctx.fillStyle = '#000000'; ctx.font = '700 ' + ns + 'px Roboto, Arial, sans-serif';
      ctx.fillText(data.name, PAD, 1148);
      ctx.fillStyle = '#EE0033'; ctx.fillRect(PAD, 1178, 96, 6);

      // thời gian & số chứng nhận
      var colX = W / 2 + 20;
      ctx.fillStyle = '#7b7f83'; ctx.font = '400 20px Roboto, Arial, sans-serif'; spaced(ctx, 3);
      ctx.fillText('THỜI GIAN CHECK-IN', PAD, 1268); ctx.fillText('SỐ CHỨNG NHẬN', colX, 1268);
      ctx.fillStyle = '#000000'; ctx.font = '700 32px Roboto, Arial, sans-serif'; spaced(ctx, 0);
      ctx.fillText(fmtTime(data.ts) + ' · ' + fmtDate(data.ts), PAD, 1316);
      ctx.fillText(data.serial, colX, 1316);

      // chân trang
      ctx.fillStyle = '#000000'; ctx.fillRect(0, H - 118, W, 118);
      ctx.fillStyle = '#EE0033'; ctx.fillRect(PAD, H - 118 + 59 - 2, 44, 4);
      ctx.fillStyle = '#FFFFFF'; ctx.font = '700 26px Roboto, Arial, sans-serif'; spaced(ctx, 6); ctx.textBaseline = 'middle';
      ctx.fillText('VIETTEL – THEO CÁCH CỦA BẠN', PAD + 72, H - 118 + 59);
      ctx.textBaseline = 'alphabetic'; spaced(ctx, 0);
    });
  }

  /* ---------- hiển thị ---------- */
  function showCert(data, scroll) {
    current = data;
    hello.textContent = 'Chào mừng ' + data.name + ' đến với gian hàng REPLY 2006';
    form.hidden = true; result.hidden = false; certError.hidden = true;
    draw(data).then(function () {
      if (navigator.canShare && typeof File === 'function') shareBtn.hidden = false;
      if (scroll) result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function () { showError('Không tải được ảnh nền cho chứng nhận. Vui lòng thử lại.'); });
  }
  function showForm() { result.hidden = true; form.hidden = false; input.value = ''; input.focus(); }
  function showError(msg) { certError.textContent = msg; certError.hidden = false; }

  function toBlob() {
    return new Promise(function (res, rej) {
      try { canvas.toBlob(function (b) { b ? res(b) : rej(new Error('empty')); }, 'image/png'); }
      catch (e) { rej(e); }
    });
  }
  var FILE = 'chung-nhan-reply-2006-dat-mui.png';

  dlBtn.addEventListener('click', function () {
    toBlob().then(function (blob) {
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = FILE; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }).catch(function () { showError('Không thể tạo ảnh để tải. Hãy mở trang qua địa chỉ https:// (không mở trực tiếp từ file) rồi thử lại.'); });
  });

  shareBtn.addEventListener('click', function () {
    toBlob().then(function (blob) {
      var file = new File([blob], FILE, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) return navigator.share({ files: [file], title: 'Chứng nhận số – Gian hàng REPLY 2006: Sóng về Đất Mũi, Tết về muôn nhà' });
    }).catch(function (e) { if (e && e.name !== 'AbortError') showError('Thiết bị chưa hỗ trợ chia sẻ. Hãy dùng nút Tải chứng nhận.'); });
  });

  resetBtn.addEventListener('click', function () { clear(); current = null; showForm(); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = cleanName(input.value);
    if (!name) { nameError.hidden = false; input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
    nameError.hidden = true; input.removeAttribute('aria-invalid');
    var ts = Date.now();
    var data = { name: name, ts: ts, serial: makeSerial(ts) };
    save(data);
    showCert(data, true);
  });
  input.addEventListener('input', function () { nameError.hidden = true; input.removeAttribute('aria-invalid'); });

  // khách đã check-in trước đó trên thiết bị này
  var saved = load();
  if (saved && saved.name && saved.serial) showCert(saved, false);
})();
