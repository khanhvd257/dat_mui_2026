/* POST /api/checkin  { name, serial } */
'use strict';
var s = require('./_store');

module.exports = function (req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return s.json(res, 405, { error: 'method_not_allowed' }); }
  if (!s.sameOrigin(req)) return s.json(res, 403, { error: 'forbidden' });
  if (!s.configured()) return s.json(res, 503, { error: 'storage_not_configured' });

  var body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  var name = s.cleanName(body && body.name), serial = body && body.serial;
  if (!name) return s.json(res, 400, { error: 'name_required' });
  if (typeof serial !== 'string' || !s.SERIAL_RE.test(serial)) return s.json(res, 400, { error: 'bad_serial' });

  var rlKey = 'reply2006:rl:' + s.clientIp(req);
  s.pipeline([['INCR', rlKey], ['EXPIRE', rlKey, 60]]).then(function (r) {
    if (r[0] > s.RATE_MAX) { s.json(res, 429, { error: 'too_many_requests' }); return null; }
    return s.pipeline([['SADD', s.SERIAL_KEY, serial]]).then(function (a) {
      if (a[0] === 0) return s.pipeline([['LLEN', s.LIST_KEY]]).then(function (l) { s.json(res, 200, { ok: true, duplicate: true, total: l[0] }); });
      var entry = JSON.stringify({ name: name, ts: Date.now(), serial: serial });
      return s.pipeline([['LPUSH', s.LIST_KEY, entry], ['LTRIM', s.LIST_KEY, 0, s.MAX_ENTRIES - 1]]).then(function (p) {
        s.json(res, 201, { ok: true, total: Math.min(p[0], s.MAX_ENTRIES) });
      });
    });
  }).catch(function (e) {
    console.error('checkin error:', e && e.message);
    s.json(res, 502, { error: 'storage_error' });
  });
};
