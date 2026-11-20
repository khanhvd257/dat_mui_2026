/* Lưu check-in trên Vercel bằng Redis. Hỗ trợ 2 kiểu kết nối, tự chọn theo biến môi trường:
   1) REST (Upstash):  KV_REST_API_URL + KV_REST_API_TOKEN  (hoặc UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
   2) Giao thức Redis: KV_REDIS_URL (hoặc REDIS_URL, hoặc biến *_REDIS_URL) dạng redis://… / rediss://…  */
'use strict';

/* Tìm biến theo tên chuẩn trước, rồi tới bất kỳ biến nào có đuôi _REST_API_URL / _REST_API_TOKEN
   (Vercel đặt tiền tố theo tên bạn chọn khi nối store, ví dụ STORAGE_REST_API_URL).
   Bỏ qua biến *_READ_ONLY_TOKEN vì không ghi được. */
function findEnv(exact, suffix) {
  for (var i = 0; i < exact.length; i++) if (process.env[exact[i]]) return process.env[exact[i]];
  var keys = Object.keys(process.env);
  for (var j = 0; j < keys.length; j++) {
    if (keys[j].slice(-suffix.length) === suffix && keys[j].indexOf('READ_ONLY') === -1 && process.env[keys[j]]) return process.env[keys[j]];
  }
  return undefined;
}
var URL_ = findEnv(['KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL'], '_REST_API_URL') || findEnv([], '_REDIS_REST_URL');
var TOKEN = findEnv(['KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN'], '_REST_API_TOKEN') || findEnv([], '_REDIS_REST_TOKEN');

var LIST_KEY = 'reply2006:checkins';      // danh sách JSON {name, ts, serial}, mới nhất ở đầu
var SERIAL_KEY = 'reply2006:serials';     // tập số chứng nhận để chống trùng
var MAX_ENTRIES = 20000;
var LIST_LIMIT = 150;
var RATE_MAX = 8;                         // lượt check-in / IP / phút
var SERIAL_RE = /^VT-CM-\d{8}-[A-Z2-9]{5}$/;

var REDIS_URL = findEnv(['KV_REDIS_URL', 'REDIS_URL'], '_REDIS_URL');
if (REDIS_URL && !/^rediss?:\/\//.test(REDIS_URL)) REDIS_URL = undefined;

function configured() { return !!((URL_ && TOKEN) || REDIS_URL); }

/* ----- kiểu 1: REST ----- */
function restPipeline(cmds) {
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

/* ----- kiểu 2: giao thức Redis (node-redis), giữ kết nối giữa các lần gọi hàm ----- */
var clientPromise = null;
function getClient() {
  if (!clientPromise) {
    var client = require('redis').createClient({ url: REDIS_URL, socket: { connectTimeout: 5000, reconnectStrategy: false } });
    client.on('error', function () { clientPromise = null; });          // lỗi/đứt kết nối → lần gọi sau tạo lại
    clientPromise = client.connect().then(function () { return client; }, function (e) { clientPromise = null; throw e; });
  }
  return clientPromise;
}
function tcpPipeline(cmds) {
  return getClient().then(function (c) {
    return Promise.all(cmds.map(function (cmd) { return c.sendCommand(cmd.map(String)); }));
  });
}

function pipeline(cmds) { return (URL_ && TOKEN) ? restPipeline(cmds) : tcpPipeline(cmds); }

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
