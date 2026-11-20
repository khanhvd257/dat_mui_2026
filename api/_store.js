/* Lưu check-in trên Vercel bằng Redis (Upstash) qua REST – không cần thư viện.
   Biến môi trường (Vercel tự thêm khi bạn gắn Upstash Redis từ Marketplace):
     KV_REST_API_URL + KV_REST_API_TOKEN   (hoặc UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN) */
'use strict';

var URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
var TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

var LIST_KEY = 'reply2006:checkins';      // danh sách JSON {name, ts, serial}, mới nhất ở đầu
var SERIAL_KEY = 'reply2006:serials';     // tập số chứng nhận để chống trùng
var MAX_ENTRIES = 20000;
var LIST_LIMIT = 150;
var RATE_MAX = 8;                         // lượt check-in / IP / phút
var SERIAL_RE = /^VT-CM-\d{8}-[A-Z2-9]{5}$/;

function configured() { return !!(URL_ && TOKEN); }

function pipeline(cmds) {
  return Promise.resolve().then(function () { return fetch(URL_.replace(/\/$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds)
  }); }).then(function (r) {
    if (!r.ok) throw new Error('redis ' + r.status);
    return r.json();
  }).then(function (arr) {
    return arr.map(function (x) { if (x.error) throw new Error(x.error); return x.result; });
  });
}

function cleanName(v) {
  if (typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
}

function sameOrigin(req) {
  var o = req.headers.origin;
  if (!o) return true;
  try { return new URL(o).host === req.headers.host; } catch (e) { return false; }
}

function clientIp(req) {
  return String(req.headers['x-real-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0] || 'unknown').trim();
}

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(obj));
}

module.exports = { configured: configured, pipeline: pipeline, cleanName: cleanName, sameOrigin: sameOrigin, clientIp: clientIp, json: json,
  LIST_KEY: LIST_KEY, SERIAL_KEY: SERIAL_KEY, MAX_ENTRIES: MAX_ENTRIES, LIST_LIMIT: LIST_LIMIT, RATE_MAX: RATE_MAX, SERIAL_RE: SERIAL_RE };
