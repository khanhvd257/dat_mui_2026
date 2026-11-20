/* GET /api/checkins → { total, items: [{ name, ts }] } (mới nhất trước) */
'use strict';
var s = require('./_store');

module.exports = function (req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return s.json(res, 405, { error: 'method_not_allowed' }); }
  if (!s.configured()) return s.json(res, 200, { total: 0, items: [] });   // chưa gắn Redis: dải chữ chỉ hiện tên trong phiên
  s.pipeline([['LRANGE', s.LIST_KEY, 0, s.LIST_LIMIT - 1], ['LLEN', s.LIST_KEY]]).then(function (r) {
    var items = r[0].map(function (x) { try { var e = JSON.parse(x); return { name: e.name, ts: e.ts }; } catch (err) { return null; } }).filter(Boolean);
    s.json(res, 200, { total: r[1], items: items });
  }).catch(function (e) {
    console.error('list error:', e && e.message);
    s.json(res, 502, { error: 'storage_error' });
  });
};
