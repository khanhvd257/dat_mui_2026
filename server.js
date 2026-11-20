/* Máy chủ nhỏ cho trang REPLY 2006 – Sóng về Đất Mũi.
   - Phục vụ các file tĩnh của trang (chỉ index.html, assets/, css/, js/).
   - Nhận check-in:  POST /api/checkin   { name, serial }
   - Danh sách tên:  GET  /api/checkins  → { total, items: [{ name, ts }] }  (mới nhất trước)
   - Lưu vào file:   data/checkins.json  (ghi nguyên tử: file tạm rồi đổi tên)
   Chạy:  node server.js            (cổng mặc định 8080, đổi bằng PORT=3000 node server.js)
   Không cần cài thư viện ngoài (Node ≥ 14). */
'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');

var ROOT = __dirname;
var PORT = parseInt(process.env.PORT, 10) || 8080;
var DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
var DATA_FILE = path.join(DATA_DIR, 'checkins.json');
var MAX_ENTRIES = 20000;      // trần số lượt lưu
var LIST_LIMIT = 150;         // số tên trả về cho dải chữ chạy
var MAX_BODY = 2048;          // byte
var RATE_MAX = 8;             // số lượt check-in tối đa / IP / phút
var SERIAL_RE = /^VT-CM-\d{8}-[A-Z2-9]{5}$/;

var MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf'
};
var PUBLIC_DIRS = ['assets', 'css', 'js'];

/* ---------- dữ liệu ---------- */
var entries = [];
var serials = Object.create(null);

function loadData() {
  try {
    var arr = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (Array.isArray(arr)) entries = arr.filter(function (e) { return e && typeof e.name === 'string' && typeof e.serial === 'string'; });
  } catch (e) {
    if (e.code !== 'ENOENT') console.error('Không đọc được ' + DATA_FILE + ':', e.message);
  }
  entries.forEach(function (e) { serials[e.serial] = true; });
}

var writing = false, dirty = false;
function persist() {
  if (writing) { dirty = true; return; }
  writing = true; dirty = false;
  var tmp = DATA_FILE + '.tmp';
  fs.mkdir(DATA_DIR, { recursive: true }, function (err) {
    if (err) return done(err);
    fs.writeFile(tmp, JSON.stringify(entries, null, 1), 'utf8', function (err2) {
      if (err2) return done(err2);
      fs.rename(tmp, DATA_FILE, done);
    });
  });
  function done(e) {
    if (e) console.error('Lỗi ghi dữ liệu:', e.message);
    writing = false;
    if (dirty) persist();
  }
}

function cleanName(v) {
  if (typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
}

/* ---------- giới hạn tần suất (theo IP) ---------- */
var hits = Object.create(null);
function limited(ip) {
  var now = Date.now(), h = (hits[ip] || []).filter(function (t) { return now - t < 60000; });
  if (h.length >= RATE_MAX) { hits[ip] = h; return true; }
  h.push(now); hits[ip] = h; return false;
}
setInterval(function () {
  var now = Date.now();
  Object.keys(hits).forEach(function (ip) {
    hits[ip] = hits[ip].filter(function (t) { return now - t < 60000; });
    if (!hits[ip].length) delete hits[ip];
  });
}, 60000).unref();

/* ---------- tiện ích HTTP ---------- */
function send(res, code, body, headers) {
  var h = Object.assign({ 'X-Content-Type-Options': 'nosniff' }, headers || {});
  res.writeHead(code, h);
  res.end(body);
}
function json(res, code, obj) {
  send(res, code, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
}
function clientIp(req) { return req.socket.remoteAddress || 'unknown'; }
function sameOrigin(req) {
  var o = req.headers.origin;
  if (!o) return true;
  try { return new URL(o).host === req.headers.host; } catch (e) { return false; }
}

function handleApi(req, res, pathname) {
  if (pathname === '/api/checkins' && req.method === 'GET') {
    var items = entries.slice(-LIST_LIMIT).reverse().map(function (e) { return { name: e.name, ts: e.ts }; });
    return json(res, 200, { total: entries.length, items: items });
  }
  if (pathname === '/api/checkin' && req.method === 'POST') {
    if (!sameOrigin(req)) return json(res, 403, { error: 'forbidden' });
    if (limited(clientIp(req))) return json(res, 429, { error: 'too_many_requests' });
    var size = 0, chunks = [], aborted = false;
    req.on('data', function (c) {
      size += c.length;
      if (size > MAX_BODY) { aborted = true; json(res, 413, { error: 'too_large' }); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', function () {
      if (aborted) return;
      var body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { return json(res, 400, { error: 'bad_json' }); }
      var name = cleanName(body && body.name), serial = body && body.serial;
      if (!name) return json(res, 400, { error: 'name_required' });
      if (typeof serial !== 'string' || !SERIAL_RE.test(serial)) return json(res, 400, { error: 'bad_serial' });
      if (serials[serial]) return json(res, 200, { ok: true, duplicate: true, total: entries.length });   // gửi lại không tạo bản ghi mới
      if (entries.length >= MAX_ENTRIES) entries.shift();
      entries.push({ name: name, ts: Date.now(), serial: serial });
      serials[serial] = true;
      persist();
      return json(res, 201, { ok: true, total: entries.length });
    });
    return;
  }
  json(res, 404, { error: 'not_found' });
}

function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
  var rel;
  try { rel = decodeURIComponent(pathname); } catch (e) { return send(res, 400, 'Bad Request'); }
  if (rel === '/' || rel === '') rel = '/index.html';
  var parts = rel.split('/').filter(Boolean);
  var ok = rel === '/index.html' || (parts.length > 1 && PUBLIC_DIRS.indexOf(parts[0]) !== -1);
  if (!ok || parts.some(function (p) { return p === '..' || p.charAt(0) === '.'; })) return send(res, 404, 'Not Found');
  var file = path.join(ROOT, parts.join('/'));
  if (file.indexOf(ROOT + path.sep) !== 0) return send(res, 404, 'Not Found');

  fs.stat(file, function (err, st) {
    if (err || !st.isFile()) return send(res, 404, 'Not Found');
    var type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    var headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' };
    var start = 0, end = st.size - 1, code = 200, range = req.headers.range;
    if (range) {
      var m = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (m && (m[1] || m[2])) {
        if (m[1]) { start = parseInt(m[1], 10); if (m[2]) end = Math.min(parseInt(m[2], 10), end); }
        else { start = Math.max(st.size - parseInt(m[2], 10), 0); }
        if (start > end || start >= st.size) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); return res.end(); }
        code = 206; headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + st.size;
      }
    }
    headers['Content-Length'] = end - start + 1;
    res.writeHead(code, headers);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file, { start: start, end: end }).on('error', function () { res.destroy(); }).pipe(res);
  });
}

loadData();
http.createServer(function (req, res) {
  var pathname = (req.url || '/').split('?')[0];
  if (pathname.indexOf('/api/') === 0) return handleApi(req, res, pathname);
  serveStatic(req, res, pathname);
}).listen(PORT, function () {
  console.log('REPLY 2006 – http://localhost:' + PORT + '   (đã có ' + entries.length + ' lượt check-in, lưu tại ' + DATA_FILE + ')');
});
