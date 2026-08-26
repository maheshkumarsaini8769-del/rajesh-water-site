var fs = require('fs');
var f = process.argv[2];
var c = fs.readFileSync(f, 'utf8');
var start = c.indexOf('/* ---------- Admin auth');
var end = c.indexOf('function handleAdminLogin');
if (start === -1 || end === -1) { console.log('MARKERS NOT FOUND'); process.exit(1); }
var before = c.substring(0, start);
var after = c.substring(end);

var newBlock = [
'/* ---------- Admin auth (HMAC-signed — stateless, works on Vercel) ---------- */',
'function adminPin() {',
'  return String((CFG.admin || {}).pin || \'\');',
'}',
'/* Stateless HMAC-signed token: works across Vercel serverless cold starts.',
'   Format: <expiry>:<hex-hmac-sha256(pin+expiry)>',
'   Secret is the admin PIN itself. */',
'function signAdminToken(expiryMs) {',
'  var pin = adminPin();',
'  var payload = String(expiryMs);',
'  var sig = crypto.createHmac(\'sha256\', pin).update(payload).digest(\'hex\');',
'  return payload + \':\' + sig;',
'}',
'function verifyAdminToken(tok) {',
'  if (!tok || tok.indexOf(\':\') === -1) return false;',
'  var idx = tok.lastIndexOf(\':\');',
'  var expiry = Number(tok.substring(0, idx));',
'  var sig = tok.substring(idx + 1);',
'  if (!expiry || !sig) return false;',
'  var pin = adminPin();',
'  var expected = crypto.createHmac(\'sha256\', pin).update(String(expiry)).digest(\'hex\');',
'  if (sig !== expected) return false;',
'  return Date.now() <= expiry;',
'}',
'function requireAdmin(req, res) {',
'  var pin = adminPin();',
'  if (!pin) {',
'    if (!CFG._adminOpenWarned) { CFG._adminOpenWarned = true; console.log(\'[auth] admin.pin is EMPTY — admin API is OPEN.\'); }',
'    return true;',
'  }',
'  var tok = String(req.headers[\'x-admin-token\'] || \'\');',
'  if (tok && verifyAdminToken(tok)) return true;',
'  send(res, 401, { ok: false, error: \'Unauthorized: admin login required.\' });',
'  return false;',
'}',
''
].join('\n');

fs.writeFileSync(f, before + newBlock + after, 'utf8');
console.log('Done. Replaced', end - start, 'chars');
