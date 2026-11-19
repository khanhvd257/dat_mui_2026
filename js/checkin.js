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
  var section = document.getElementById('checkin');
  var petalBox = section.querySelector('.petals');
  var current = null;

  // cánh mai rơi trên khung chứng nhận (CSS animation, tắt khi người dùng giảm chuyển động)
  function startPetals() {
    petalBox.style.setProperty('--fall', (section.offsetHeight + 60) + 'px');
    if (petalBox.childElementCount) return;
    for (var i = 0; i < 16; i++) {
      var p = document.createElement('i');
      p.style.left = (Math.random() * 100).toFixed(1) + '%';
      p.style.setProperty('--s', (14 + Math.random() * 16).toFixed(0) + 'px');
      p.style.setProperty('--d', (7 + Math.random() * 7).toFixed(1) + 's');
      p.style.setProperty('--x', ((Math.random() - .5) * 120).toFixed(0) + 'px');
      p.style.animationDelay = (-Math.random() * 12).toFixed(1) + 's';
      petalBox.appendChild(p);
    }
  }

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

  /* ---------- nền vàng hoa mai (vẽ bằng canvas, ngẫu nhiên cố định theo số chứng nhận) ---------- */
  var FOOT = 144;                                            // chân phiếu = banner (2400×320 → 1080×144)
  function rngFrom(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  }
  // một bông mai 5 cánh; c0/c1 là màu giữa/ngoài cánh
  function flower(ctx, x, y, r, rot, alpha, c0, c1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = alpha;
    for (var k = 0; k < 5; k++) {
      ctx.save(); ctx.rotate(k * 2 * Math.PI / 5);
      var g = ctx.createRadialGradient(0, -r * .55, r * .04, 0, -r * .55, r * .62);
      g.addColorStop(0, c0); g.addColorStop(1, c1);
      ctx.beginPath(); ctx.arc(0, -r * .55, r * .52, 0, 6.2832);
      ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(176,110,0,.38)'; ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = '#E4812B'; ctx.beginPath(); ctx.arc(0, 0, r * .2, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = '#C46A12'; ctx.lineWidth = 1.3;
    for (var j = 0; j < 10; j++) {
      var a = j * 6.2832 / 10, x2 = Math.cos(a) * r * .44, y2 = Math.sin(a) * r * .44;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * .2, Math.sin(a) * r * .2); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.fillStyle = '#8A3B0A'; ctx.beginPath(); ctx.arc(x2, y2, 1.8, 0, 6.2832); ctx.fill();
    }
    ctx.restore();
  }
  function petal(ctx, x, y, r, rot, alpha) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = alpha;
    ctx.fillStyle = '#F6CF4A'; ctx.beginPath(); ctx.ellipse(0, 0, r, r * .78, 0, 0, 6.2832); ctx.fill(); ctx.restore();
  }
  // nền trắng; hoa mai chỉ rải thưa và rất nhạt (không lấn chữ)
  function paintBackground(ctx, W, H) {
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
  }
  function drawMai(ctx, W, H, seed, top) {
    var rnd = rngFrom(seed || 'mai'), bottom = H - FOOT, STEP = 190, x, y, n = 0;
    ctx.save(); ctx.beginPath(); ctx.rect(0, top, W, bottom - top); ctx.clip();
    for (y = top + 10; y < bottom + STEP; y += STEP) {
      for (x = -30 + (n % 2) * STEP / 2; x < W + STEP; x += STEP) {
        // vùng chữ (bên trái, giữa) thưa hơn; rìa phải và các góc dày hơn một chút
        var edge = x > W * 0.72 || x < 40;
        if (rnd() > (edge ? 0.85 : 0.38)) continue;
        var px = x + (rnd() - .5) * 90, py = y + (rnd() - .5) * 90, r = 24 + rnd() * 30, t = rnd();
        if (t < .72) flower(ctx, px, py, r, rnd() * 6.28, .24, '#FFF3C4', '#F6CF4A');     // mai vàng nhạt
        else petal(ctx, px, py, 8 + rnd() * 8, rnd() * 6.28, .22);
      }
      n++;
    }
    ctx.restore();
  }

  function draw(data) {
    var W = 1080, H = 1500, PAD = 72, ctx = canvas.getContext('2d');
    var fontsReady = (document.fonts && document.fonts.load)
      ? Promise.all([document.fonts.load('900 60px Roboto'), document.fonts.load('700 30px Roboto'), document.fonts.load('400 30px Roboto')]).catch(function () {})
      : Promise.resolve();

    return Promise.all([loadImg('assets/img/hero.webp'), loadImg('assets/logo/viettel-logo-white.svg'), loadImg('assets/img/banner.webp'), fontsReady]).then(function (r) {
      var photo = r[0], logo = r[1], banner = r[2];

      ctx.clearRect(0, 0, W, H);
      paintBackground(ctx, W, H);

      // ảnh đầu trang (cover, ưu tiên phần có công trình & rừng)
      var PH = 560, scale = Math.max(W / photo.width, PH / photo.height);
      var sw = W / scale, sh = PH / scale, sx = (photo.width - sw) / 2, sy = (photo.height - sh) * 0.72;
      ctx.drawImage(photo, sx, sy, sw, sh, 0, 0, W, PH);
      var g = ctx.createLinearGradient(0, 0, 0, 220); g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, 220);
      ctx.drawImage(logo, PAD, 56, 200, 200 * 170 / 800);

      // dải đỏ
      ctx.fillStyle = '#EE0033'; ctx.fillRect(0, PH, W, 12);

      // nền hoa mai
      drawMai(ctx, W, H, data.serial, PH + 12);

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

      // chân phiếu: banner thay cho dòng chữ Viettel cũ
      ctx.drawImage(banner, 0, H - FOOT, W, FOOT);
    });
  }

  /* ---------- hiển thị ---------- */
  function showCert(data, scroll) {
    current = data;
    section.classList.add('has-cert'); startPetals();
    hello.textContent = 'Chào mừng ' + data.name + ' đến với gian hàng REPLY 2006';
    form.hidden = true; result.hidden = false; certError.hidden = true;
    draw(data).then(function () {
      if (navigator.canShare && typeof File === 'function') shareBtn.hidden = false;
      if (scroll) result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function () { showError('Không tải được ảnh nền cho chứng nhận. Vui lòng thử lại.'); });
  }
  function showForm() { section.classList.remove('has-cert'); result.hidden = true; form.hidden = false; input.value = ''; input.focus(); }
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
    if (window.datMuiMusic) window.datMuiMusic.start();   // lượt chạm của khách cho phép phát nhạc
    showCert(data, true);
  });
  input.addEventListener('input', function () { nameError.hidden = true; input.removeAttribute('aria-invalid'); });

  // khách đã check-in trước đó trên thiết bị này
  var saved = load();
  if (saved && saved.name && saved.serial) showCert(saved, false);
})();
