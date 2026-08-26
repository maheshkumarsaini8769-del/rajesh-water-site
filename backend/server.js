/* ============================================================
   Rajesh Water - local server with shared review + business store
   Run: node server.js   (serves site + admin, port 3000)
   API:
     GET  /api/reviews            -> all reviews from all visitors
     POST /api/reviews            -> add review  {name,rating,text,product,date}
     POST /api/reviews/delete     -> delete review  {id}
     GET  /api/biz                -> full business data (inventory, sales, purchases)
     POST /api/biz                -> replace business data (admin saves)
     POST /api/orders             -> add pending order from the website
     GET  /api/orders/config      -> integration status (whatsapp, truecaller)
POST /api/truecaller/begin   -> start Truecaller Mobile Web verification {phone} -> {nonce, deepLink}
      POST /api/truecaller/callback -> Truecaller webhook {requestId, accessToken, endpoint} -> fetch profile -> grant
      GET  /api/truecaller/status  -> poll ?phone= -> {verified, token} | {pending} | {rejected}
      POST /api/orders/create      -> create order (requires phone + verificationToken from Truecaller grant)
     GET  /api/orders/my          -> customer orders by order token (?token=) or Truecaller grant (?phone=&vt=)
      GET  /api/admin/orders              -> all orders (admin; requires x-admin-token when admin.pin set)
      POST /api/admin/orders/status      -> update order status (admin; state-machine enforced, records confirmedAt/completedAt/cancelledAt/rejectReason)
      POST /api/admin/orders/note        -> save owner note (admin)
      POST /api/admin/login              -> admin login {pin} -> {token} (12h)
   Stores:
     data/user-reviews.json  (shared by everyone)
     data/business.json      (shared by everyone)
     data/orders.json        (customer orders + tracking)
     data/server-config.json (integrations: whatsapp + truecaller â€” secrets stay server-side)
   ============================================================ */
var http = require('http');
var https = require('https');
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var root = path.resolve(__dirname);            /* backend/ — data, config, secrets */
var APP_DIR = path.resolve(__dirname, '..', 'frontend');  /* frontend/ — static site + admin UI */
var port = Number(process.env.PORT || process.argv[2] || 3000);
var PORT_BOT = Number(process.env.WA_BOT_PORT) || 3001;

/* ---- .env loader (MONGODB_URI stays server-side, never reaches the frontend) ---- */
try {
  fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/).forEach(function (line) {
    var m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch (e) {}

var db = require('./db');
var REVIEW_FILE = path.join(root, 'data', 'user-reviews.json');
var BIZ_FILE = path.join(root, 'data', 'business.json');
var ORDERS_FILE = path.join(root, 'data', 'orders.json');
var CONFIG_FILE = path.join(root, 'data', 'server-config.json');

var EMPTY_BIZ = {
  settings: { bizName: 'Rajesh Water', minStock: 15, initialCapital: 0 },
  products: [],
  purchases: [],
  sales: [],
  adjustments: [],
  pendingOrders: [],
  opened: Date.now()
};

var types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2'
};

/* In-memory mirror of the stores. On Vercel (serverless) the filesystem is
   read-only/ephemeral, so Mongo is the live store and MEM is hydrated from it
   at boot. On local runs MEM falls back to the JSON files. */
var MEM = { orders: null, biz: null, reviews: null, siteData: {} };
function memCopy(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }

var CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, PUT, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-token, Authorization',
  'Access-Control-Max-Age': '86400'
};

function readReviews() {
  if (MEM.reviews) return memCopy(MEM.reviews);
  try {
    var l = JSON.parse(fs.readFileSync(REVIEW_FILE, 'utf8'));
    MEM.reviews = l;
    return memCopy(l);
  } catch (e) { return []; }
}
function writeReviews(list) {
  MEM.reviews = list;
  try { fs.writeFileSync(REVIEW_FILE, JSON.stringify(list, null, 2)); } catch (e) {}
  if (db.state().on) db.saveReviews(list).catch(function (err) { db.markError('reviews', err); });
}

function send(res, code, data, ct) {
  res.writeHead(code, Object.assign({ 'Content-Type': ct || 'application/json; charset=utf-8' }, CORS_HEADERS));
  res.end(typeof data === 'string' ? data : JSON.stringify(data));
}

/* Proxy a GET to the local wa-bot (port 3001) so the scan-QR page is reachable
   through the public tunnel at /wa too (mobile se bhi scanner khul jayega). */
function proxyTo(port, req, res) {
  var service = http.request({ host: '127.0.0.1', port: port, path: '/', method: 'GET' }, function (r) {
    var chunks = '';
    r.on('data', function (c) { chunks += c; });
    r.on('end', function () {
      res.writeHead(r.statusCode || 200, { 'Content-Type': r.headers['content-type'] || 'text/html; charset=utf-8' });
      res.end(chunks);
    });
  });
  service.on('error', function () { send(res, 502, 'wa-bot not running (node wa-bot.js chalao)', 'text/plain'); });
  service.end();
}

/* ---------- business store (data/business.json) ---------- */
function readBiz() {
  if (MEM.biz) return memCopy(MEM.biz);
  try {
    var b = JSON.parse(fs.readFileSync(BIZ_FILE, 'utf8'));
    if (!b || !Array.isArray(b.products)) return JSON.parse(JSON.stringify(EMPTY_BIZ));
    MEM.biz = b;
    return memCopy(b);
  } catch (e) { return JSON.parse(JSON.stringify(EMPTY_BIZ)); }
}
function writeBiz(b) {
  MEM.biz = b;
  try { fs.writeFileSync(BIZ_FILE, JSON.stringify(b, null, 2)); } catch (e) {}
  if (db.state().on) db.saveBiz(b).catch(function (err) { db.markError('biz', err); });
}

/* ---------- site content (data/site-data.js) ---------- */
var SITE_DATA_FILE = path.join(APP_DIR, 'data', 'site-data.js');
function readSiteDataJs() {
  if (MEM.siteData && Object.keys(MEM.siteData).length) return memCopy(MEM.siteData);
  try {
    var c = fs.readFileSync(SITE_DATA_FILE, 'utf8');
    var i = c.lastIndexOf('='), j = c.lastIndexOf(';');
    if (i < 0) return {};
    MEM.siteData = JSON.parse(c.slice(i + 1, j > i ? j : undefined));
    return memCopy(MEM.siteData);
  } catch (e) { return {}; }
}
function writeSiteDataJs(obj) {
  MEM.siteData = obj;
  try { fs.writeFileSync(SITE_DATA_FILE, 'window.SITE_DATA = ' + JSON.stringify(obj, null, 2) + ';\n'); } catch (e) {}
  if (db.state().on) db.saveSiteData(obj).catch(function (err) { db.markError('sitedata', err); });
}

/* ---------- notifications (admin panel alerts) ---------- */
var NOTIF_FILE = path.join(APP_DIR, 'data', 'notifications.json');
function readNotifications() {
  if (MEM.notifications) return memCopy(MEM.notifications);
  try {
    var d = JSON.parse(fs.readFileSync(NOTIF_FILE, 'utf8'));
    if (Array.isArray(d)) { MEM.notifications = d; return memCopy(d); }
  } catch (e) {}
  return [];
}
function writeNotifications(list) {
  MEM.notifications = list;
  try { fs.writeFileSync(NOTIF_FILE, JSON.stringify(list, null, 2)); } catch (e) {}
  if (db.state().on) db.saveNotifications(list).catch(function (err) { db.markError('notifications', err); });
}
function pushNotification(type, orderId, title, body, phone) {
  var list = readNotifications();
  var n = { id: 'n' + Date.now() + Math.floor(Math.random() * 1000), type: type, orderId: orderId, title: title, body: body, phone: phone || '', read: false, at: Date.now() };
  list.unshift(n);
  if (list.length > 200) list = list.slice(0, 200);
  writeNotifications(list);
  return n;
}

/* ============================================================
   Orders + verification (data/orders.json, data/server-config.json)
   Integrity rules:
- Phone verification is REAL and server-side via the official
      Truecaller Mobile Websites SDK (truecallersdk:// deep link +
      registered callback webhook). There is NO OTP anywhere in this project.
   - The backend never trusts the client: a single-use grant token is
     issued only AFTER Truecaller confirms the number, and it is consumed
     when the order is created. The Truecaller API key stays on the server.
   - No fake Truecaller / WhatsApp calls. Every external integration is
     config-gated in data/server-config.json; without credentials the APIs
     report "not configured" honestly (frontend shows the real state).
   ============================================================ */
var STATUSES = ['received', 'confirmed', 'preparing', 'out', 'delivered', 'complete_requested', 'completed', 'cancelled'];
var STATUS_LABEL = {
  received: 'Order Received', confirmed: 'Order Confirmed', preparing: 'Preparing',
  out: 'Out for Delivery', delivered: 'Delivered',
  complete_requested: 'Complete Requested', completed: 'Completed', cancelled: 'Cancelled'
};
/* Spec status sections: PENDING -> CONFIRMED -> COMPLETED (+ CANCELLED archive).
   Internal tracking states (preparing/out/delivered/complete_requested) belong to CONFIRMED. */
var SECTION_LABEL = {
  received: 'PENDING', confirmed: 'CONFIRMED', preparing: 'CONFIRMED', out: 'CONFIRMED',
  delivered: 'CONFIRMED', complete_requested: 'CONFIRMED', completed: 'COMPLETED', cancelled: 'CANCELLED'
};
/* Allowed transitions only. 'complete_requested' is customer-initiated, never set by admin.
   Same-status requests are no-ops. Everything else is rejected (prevents double confirm/complete). */
var TRANSITIONS = {
  confirmed: ['received'],
  preparing: ['confirmed'],
  out: ['preparing'],
  delivered: ['out'],
  completed: ['delivered', 'complete_requested', 'confirmed', 'received'],
  cancelled: ['received', 'confirmed', 'preparing', 'out', 'delivered', 'complete_requested']
};

function readConfig() {
  var def = {
    whatsapp: { enabled: false, token: '', phoneId: '', owner: '' },
    truecaller: { enabled: false, apiKey: '', appName: '', callbackUrl: '' },
    waBot: { enabled: true, port: 3001, owner: '' },
    admin: { pin: '' }
  };
  function applyEnv(c) {
    /* Secrets live in .env (server-side). Env vars override the config file. */
    if (process.env.ADMIN_PIN && String(process.env.ADMIN_PIN)) c.admin.pin = String(process.env.ADMIN_PIN).trim();
    if (process.env.TRUECALLER_API_KEY && String(process.env.TRUECALLER_API_KEY)) c.truecaller.apiKey = String(process.env.TRUECALLER_API_KEY).trim();
    if (process.env.TRUECALLER_APP_NAME) c.truecaller.appName = String(process.env.TRUECALLER_APP_NAME).trim();
    if (process.env.TRUECALLER_CALLBACK_URL) c.truecaller.callbackUrl = String(process.env.TRUECALLER_CALLBACK_URL).trim();
    if (String(process.env.TRUECALLER_ENABLED || '').toLowerCase() === 'true') c.truecaller.enabled = true;
    if (process.env.WHATSAPP_TOKEN && String(process.env.WHATSAPP_TOKEN)) c.whatsapp.token = String(process.env.WHATSAPP_TOKEN).trim();
    if (process.env.WHATSAPP_PHONE_ID) c.whatsapp.phoneId = String(process.env.WHATSAPP_PHONE_ID).trim();
    if (process.env.WHATSAPP_OWNER) c.whatsapp.owner = String(process.env.WHATSAPP_OWNER).trim();
    if (String(process.env.WHATSAPP_ENABLED || '').toLowerCase() === 'true') c.whatsapp.enabled = true;
    if (process.env.WA_BOT_OWNER) c.waBot.owner = String(process.env.WA_BOT_OWNER).trim();
    if (process.env.WA_BOT_HOST) c.waBot.host = String(process.env.WA_BOT_HOST).trim();
    if (String(process.env.WA_BOT_ENABLED || '').toLowerCase() === 'false') c.waBot.enabled = false;
    if (process.env.WA_BOT_PORT) c.waBot.port = Number(process.env.WA_BOT_PORT) || c.waBot.port;
    return c;
  }
  try {
    var c = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    if (c && typeof c === 'object') {
      if (!c.whatsapp || typeof c.whatsapp !== 'object') c.whatsapp = def.whatsapp;
      else c.whatsapp = Object.assign({}, def.whatsapp, c.whatsapp);
      if (!c.truecaller || typeof c.truecaller !== 'object') c.truecaller = def.truecaller;
      else c.truecaller = Object.assign({}, def.truecaller, c.truecaller);
      if (!c.waBot || typeof c.waBot !== 'object') c.waBot = def.waBot;
      else c.waBot = Object.assign({}, def.waBot, c.waBot);
      if (!c.admin || typeof c.admin !== 'object') c.admin = def.admin;
      else c.admin = Object.assign({}, def.admin, c.admin);
      return applyEnv(c);
    }
  } catch (e) {}
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(def, null, 2)); } catch (e) {}
  return applyEnv(def);
}
var CFG = readConfig();

function readOrders() {
  if (MEM.orders) return memCopy(MEM.orders);
  try {
    var d = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
    if (d && Array.isArray(d.orders)) { MEM.orders = d; return memCopy(d); }
  } catch (e) {}
  return { seq: 10000, orders: [] };
}
function writeOrders(d) {
  MEM.orders = d;
  try {
    var tmp = ORDERS_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(d, null, 2));
    fs.renameSync(tmp, ORDERS_FILE);
  } catch (e) {}
  if (db.state().on) db.saveOrders(d).catch(function (err) { db.markError('orders', err); });
}

/* On boot: when MongoDB is reachable it is the source of truth — pull the latest
   snapshots and rebuild the local files from them (safe, idempotent). */
async function syncFromMongo() {
  var todo = [];
  if (db.state().on) {
    var parts = await Promise.all([db.loadOrders(), db.loadBiz(), db.loadReviews(), db.loadSiteData(), db.loadNotifications()]);
    if (parts[0]) { writeOrders(parts[0]); console.log('[mongo] orders restored from MongoDB (' + parts[0].orders.length + ' records).'); }
    if (parts[1]) { writeBiz(parts[1]); console.log('[mongo] business data restored from MongoDB.'); }
    if (parts[2]) { writeReviews(parts[2]); console.log('[mongo] reviews restored from MongoDB (' + parts[2].length + ' records).'); }
    if (parts[3]) { writeSiteDataJs(parts[3]); console.log('[mongo] site content restored from MongoDB.'); }
    if (parts[4]) { writeNotifications(parts[4]); console.log('[mongo] notifications restored from MongoDB (' + parts[4].length + ' records).'); }
    return true;
  }
  return false;
}

function catalogPrices() {
  var map = {};
  try {
    var b = readBiz();
    (b.products || []).forEach(function (p) { if (p && p.id) map[p.id] = { name: p.name, price: Number(p.price) || 0, bottlesPerBox: Number(p.bottlesPerBox) || 12 }; });
  } catch (e) {}
  return map;
}

function etaText(createdAt) {
  var d = new Date(createdAt);
  if (d.getHours() < 14) return 'Today, between 4:00 PM and 8:00 PM';
  var tm = new Date(d); tm.setDate(tm.getDate() + 1);
  return 'Tomorrow, between 9:00 AM and 1:00 PM';
}

/* ---------- Truecaller Mobile Web verification state (Mongo-backed when connected; in-memory fallback) ---------- */
var TC_GRANTS = new Map();    // phone -> {token, exp}; single-use grant issued only after Truecaller confirms the number
var TC_PENDING = new Map();   // requestNonce -> {phone, createdAt}; created by /api/truecaller/begin
var TC_REJECTED = new Map();  // phone -> timestamp; user dismissed the Truecaller profile dialog
var NONCES = new Set();       // client submission nonces (duplicate prevention)

/* Serverless (Vercel) shared state: hydrate maps from MongoDB on reads, persist after every mutation. */
async function tcHydrate() {
  if (!db.state().on) return;
  try {
    var st = await db.loadTcState();
    if (!st) return;
    TC_GRANTS.clear(); TC_PENDING.clear(); TC_REJECTED.clear(); NONCES.clear();
    (st.grants || []).forEach(function (g) { TC_GRANTS.set(g.phone, { token: g.token, exp: g.exp }); });
    (st.pending || []).forEach(function (p) { TC_PENDING.set(p.nonce, { phone: p.phone, createdAt: p.createdAt }); });
    (st.rejected || []).forEach(function (r) { TC_REJECTED.set(r.phone, { at: r.at, reason: r.reason }); });
    (st.nonces || []).forEach(function (n) { NONCES.add(n); });
  } catch (e) {}
}
async function tcPersist() {
  if (!db.state().on) return;
  try {
    await db.saveTcState({
      grants: Array.from(TC_GRANTS.entries()).map(function (e) { return { phone: e[0], token: e[1].token, exp: e[1].exp }; }),
      pending: Array.from(TC_PENDING.entries()).map(function (e) { return { nonce: e[0], phone: e[1].phone, createdAt: e[1].createdAt }; }),
      rejected: Array.from(TC_REJECTED.entries()).map(function (e) { return { phone: e[0], at: e[1].at, reason: e[1].reason }; }),
      nonces: Array.from(NONCES)
    });
  } catch (e) {}
}

/* Debug log for Truecaller flow — data/tc-debug.log (rotated at ~200KB). */
function tcLog(line) {
  var f = path.join(root, 'data', 'tc-debug.log');
  try {
    var st = fs.statSync(f);
    if (st.size > 200 * 1024) { fs.writeFileSync(f, ''); }
  } catch (e) {}
  try { fs.appendFileSync(f, new Date().toISOString() + ' ' + line + '\n'); } catch (e) {}
}

function makeWaMessage(o) {
  var lines = [
    '\u{1F6D2} NEW ORDER\n',
    'Order ID: #' + o.id + '\n',
    'Customer:',
    'Name: ' + o.name,
    'Phone: +91' + o.phone + '\n',
    'Delivery Address:',
    o.address,
    o.city + ', ' + o.pincode + '\n',
    'Products:'
  ];
  (o.items || []).forEach(function (it) {
    lines.push('\u2022 ' + it.name + ' ' + it.size + ' \u00D7 ' + it.qty + ' \u2014 \u20B9' + it.lineTotal);
  });
  lines.push('\nTotal: \u20B9' + o.total + '\n');
  lines.push('Payment: ' + (o.type || 'Cash on Delivery'));
  return lines.join('\n');
}
function makeWaCompleteMessage(o) {
  return [
    '\u2705 ORDER COMPLETED & PAID\n',
    'Order ID: #' + o.id + '\n',
    'Customer: ' + o.name + ' (+91' + o.phone + ')\n',
    'Total: \u20B9' + o.total + '\n',
    'Payment: ' + (o.type || 'Cash on Delivery') + ' \u2192 Paid\n',
    'Sale recorded in business reports \u2014 stock + profit updated.'
  ].join('\n');
}

function sendWhatsApp(o) {
  var wa = CFG.whatsapp || {};
  var persist = function () {
    var d = readOrders();
    var t = null;
    for (var i = 0; i < d.orders.length; i++) { if (d.orders[i].id === o.id) { t = d.orders[i]; break; } }
    if (t) { t.notified = o.notified; t.notifyError = o.notifyError; writeOrders(d); }
  };
  if (!wa.enabled || !wa.token || !wa.phoneId || !wa.owner) {
    o.notified = false;
    o.notifyError = 'WHATSAPP_API_NOT_CONFIGURED';
    console.log('[wa] WhatsApp Business Cloud API not configured - order ' + o.id + ' not auto-sent. Edit data/server-config.json (whatsapp.enabled=true, token, phoneId, owner).');
    persist();
    return;
  }
  if (o.notifyError === 'WHATSAPP_API_NOT_CONFIGURED') { persist(); return; }
  var payload = JSON.stringify({ messaging_product: 'whatsapp', to: wa.owner, type: 'text', text: { body: makeWaMessage(o) } });
  var req = https.request({
    host: 'graph.facebook.com',
    path: '/v21.0/' + wa.phoneId + '/messages',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + wa.token }
  }, function (r) {
    var chunks = '';
    r.on('data', function (c) { chunks += c; });
    r.on('end', function () {
      var ok2 = r.statusCode >= 200 && r.statusCode < 300;
      o.notified = ok2;
      o.notifyError = ok2 ? null : 'WA_SEND_FAILED_HTTP_' + r.statusCode;
      console.log('[wa] order ' + o.id + ' -> owner WhatsApp: ' + (ok2 ? 'SENT' : 'FAILED (' + r.statusCode + ') ' + chunks.slice(0, 160)));
      persist();
    });
  });
req.on('error', function (e) { o.notified = false; o.notifyError = 'WA_NETWORK_ERROR'; console.log('[wa] network error for ' + o.id + ': ' + e.message); persist(); });
  req.end(payload);
}

/* Owner WhatsApp notification via the local wa-bot (node wa-bot.js).
   Returns a promise — resolves true/false. */
function persistWa(o) {
  var d = readOrders();
  var t = null;
  for (var i = 0; i < d.orders.length; i++) { if (d.orders[i].id === o.id) { t = d.orders[i]; break; } }
  if (t) { t.notified = o.notified; t.notifyError = o.notifyError; writeOrders(d); }
}
function notifyOwnerWhatsApp(o, customText) {
  return new Promise(function (resolve) {
    var wb = CFG.waBot || {};
    if (wb.enabled && wb.owner) {
      var payload = JSON.stringify({ to: wb.owner, text: customText || makeWaMessage(o) });
      var host = wb.host || 'localhost';
      var port = host === 'localhost' ? (Number(wb.port) || 3001) : 443;
      var useHttps = host !== 'localhost';
      var reqFn = useHttps ? https.request : http.request;
      var reqOpts = useHttps
        ? { hostname: host, port: 443, path: '/send', method: 'POST', headers: { 'Content-Type': 'application/json' } }
        : { host: 'localhost', port: Number(wb.port) || 3001, path: '/send', method: 'POST', headers: { 'Content-Type': 'application/json' } };
      var req = reqFn(reqOpts, function (r) {
        var chunks = '';
        r.on('data', function (c) { chunks += c; });
        r.on('end', function () {
          var okB = r.statusCode >= 200 && r.statusCode < 300;
          o.notified = okB;
          o.notifyError = okB ? null : 'WA_BOT_HTTP_' + r.statusCode;
          if (!okB) console.log('[wa] bot returned ' + r.statusCode + ': ' + chunks.slice(0, 160));
          persistWa(o);
          resolve(okB);
        });
      });
      req.on('error', function (e) {
        o.notified = false; o.notifyError = 'WA_BOT_OFFLINE';
        console.log('[wa] owner bot offline (' + e.message + ') - order ' + o.id + ' ka message nahi gaya.');
        persistWa(o);
        resolve(false);
      });
      req.setTimeout(5000, function () { req.destroy(); o.notified = false; o.notifyError = 'WA_BOT_TIMEOUT'; persistWa(o); resolve(false); });
      req.end(payload);
    } else {
      o.notified = false; o.notifyError = 'NO_OWNER_WA_CHANNEL';
      console.log('[wa] wa-bot not configured');
      resolve(false);
    }
  });
}

function readBody(req, res, cb, max) {
  var body = '';
  req.on('data', function (chunk) { body += chunk; if (body.length > (max || 2e6)) req.destroy(); });
  req.on('end', function () {
    var payload = {};
    try { payload = JSON.parse(body || '{}'); } catch (e) {}
    cb(payload);
  });
}

/* ============================================================
   Truecaller Mobile Websites SDK (official flow)
   1. Client: POST /api/truecaller/begin {phone} -> server makes a
      requestNonce and returns the truecallersdk:// deep link.
   2. Browser opens the deep link; the Truecaller app asks the user
      to approve sharing their profile.
   3. Truecaller POSTs {requestId(=nonce), accessToken, endpoint} to
      the callback URL registered on developer.truecaller.com. The
      server fetches the user profile (GET endpoint, Bearer token),
      cross-checks the number and issues a single-use grant.
   4. Checkout polls GET /api/truecaller/status until verified.
   NOTE: the callback URL must be a PUBLIC https URL — Truecaller
   cannot reach localhost. For local testing use a tunnel
   (cloudflared/ngrok) and register that URL on the dev portal.
   ============================================================ */
function tcComplete() {
  var t = CFG.truecaller || {};
  return !!(t.enabled && t.apiKey);
}
function tcPartial() {
  var t = CFG.truecaller || {};
  return !!(t.enabled && !t.apiKey);
}

async function handleTcBegin(req, res, payload) {
  var tc = CFG.truecaller || {};
  if (!tcComplete()) {
    send(res, 200, { ok: false, configured: false, error: 'Truecaller not configured — owner ko data/server-config.json me truecaller.apiKey add karni hai.' });
    return;
  }
  await tcHydrate();
  var phone = String(payload.phone || '').replace(/\D/g, '');
  if (!/^[6-9]\d{9}$/.test(phone)) { send(res, 400, { ok: false, error: 'invalid phone' }); return; }
var nonce = 'RW' + Date.now().toString(36) + crypto.randomBytes(2).toString('hex');
  TC_PENDING.set(nonce, { phone: phone, createdAt: Date.now() });
  if (TC_PENDING.size > 5000) { TC_PENDING.clear(); }
  var now = Date.now();
  TC_REJECTED.forEach(function (v, k) { if (now - (v.at || v) > 5 * 60 * 1000) TC_REJECTED.delete(k); });
  await tcPersist();
  tcLog('begin phone=+91' + phone + ' nonce=' + nonce);
  var deepLink = 'truecallersdk://truesdk/web_verify?type=btmsheet' +
    '&requestNonce=' + encodeURIComponent(nonce) +
    '&partnerKey=' + encodeURIComponent(tc.apiKey) +
    (tc.appName ? '&partnerName=' + encodeURIComponent(tc.appName) : '') +
    '&lang=en&ctaColor=%2338D9FF&ctaTextColor=%23000&btnShape=square' +
    '&skipOption=' + encodeURIComponent('Continue without verification') +
    '&ttl=60000';
  send(res, 200, { ok: true, nonce: nonce, deepLink: deepLink });
}

async function handleTcCallback(req, res, payload) {
  /* Truecaller posts here (URL must be registered on developer.truecaller.com).
     On Vercel serverless we MUST persist the grant to MongoDB BEFORE acknowledging,
     otherwise the instance can freeze after the 200 and the grant is lost -> orders 401. */
  var tc = CFG.truecaller || {};
  if (!tcComplete()) { send(res, 200, { ok: true }); return; }
  var nonce = String(payload.requestId || '').trim();
  var status = String(payload.status || '');
  await tcHydrate();
  var pending = TC_PENDING.get(nonce);
  tcLog('callback nonce=' + nonce + ' status=' + status + ' hasToken=' + (!!payload.accessToken) + ' endpoint=' + String(payload.endpoint || '').slice(0, 50));
  if (!pending) { send(res, 200, { ok: true }); return; }
  if (status === 'user_rejected') {
    TC_PENDING.delete(nonce);
    TC_REJECTED.set(pending.phone, { at: Date.now(), reason: 'rejected' });
    tcLog('user rejected profile for +91' + pending.phone);
    await tcPersist();
    send(res, 200, { ok: true });
    return;
  }
  if (!payload.accessToken) {
    /* Informational statuses (e.g. flow_invoked) or unknowns — NOT a rejection;
       keep the nonce pending so the real success callback can still arrive. */
    tcLog('ignoring status without token: ' + status);
    send(res, 200, { ok: true });
    return;
  }
  var accessToken = String(payload.accessToken || '').trim();
  var raw = String(payload.endpoint || '').trim();
  if (!accessToken || !raw) { send(res, 200, { ok: true }); return; }
  var parts = raw.replace(/^https?:\/\//, '').split('/');
  https.get({
    host: parts[0],
    path: '/' + parts.slice(1).join('/'),
    headers: { 'Authorization': 'Bearer ' + accessToken, 'Cache-Control': 'no-cache' }
  }, function (resp) {
    var chunks = '';
    resp.on('data', function (c) { chunks += c; });
    resp.on('end', async function () {
      try {
        var profile = null;
        try { profile = JSON.parse(chunks); } catch (e) {}
        var nums = (profile && profile.phoneNumbers) || [];
        var tcPhone = String(Array.isArray(nums) ? (nums[0] || '') : '').replace(/\D/g, '');
        if (tcPhone.length === 12 && tcPhone.slice(0, 2) === '91') { tcPhone = tcPhone.slice(2); }
        tcLog('profile http=' + resp.statusCode + ' body=' + chunks.slice(0, 120).replace(/\s+/g, ' ') + ' | parsedPhone=+' + tcPhone);
        var p = TC_PENDING.get(nonce);
        if (!p) { send(res, 200, { ok: true }); return; }
        TC_PENDING.delete(nonce);
        if (tcPhone !== pending.phone) {
          TC_REJECTED.set(pending.phone, { at: Date.now(), reason: 'mismatch' });
          tcLog('mismatch: expected +91' + pending.phone + ' got +91' + tcPhone);
          await tcPersist();
          send(res, 200, { ok: true });
          return;
        }
        var token = crypto.randomBytes(24).toString('hex');
        TC_GRANTS.set(pending.phone, { token: token, exp: Date.now() + 15 * 60 * 1000 });
        if (TC_GRANTS.size > 2000) { TC_GRANTS.clear(); }
        tcLog('VERIFIED +91' + pending.phone + ' nonce=' + nonce.slice(0, 12) + '...');
        await tcPersist();
        send(res, 200, { ok: true });
      } catch (e) {
        tcLog('callback processing error: ' + (e && e.message));
        send(res, 200, { ok: true });
      }
    });
  }).on('error', function (e) {
    tcLog('profile fetch error: ' + e.message);
    send(res, 200, { ok: true });
  });
}

async function handleTcStatus(req, res, qs) {
  await tcHydrate();
  var phone = String(qs.phone || '').replace(/\D/g, '');
  var grant = TC_GRANTS.get(phone);
  if (grant && grant.exp > Date.now()) {
    send(res, 200, { ok: true, verified: true, token: grant.token });
    return;
  }
  var rj = TC_REJECTED.get(phone);
  if (rj && Date.now() - (rj.at || rj) < 5 * 60 * 1000) {
    send(res, 200, { ok: true, rejected: true, error: (rj && rj.reason === 'mismatch') ? 'Truecaller ke profile par jo number hai wo aapne likhe number se alag hai - apna Truecaller number daalo.' : 'Aapne profile share nahi ki - Verify with Truecaller dobara dabao.' });
    return;
  }
  /* Any live pending nonce for this phone? */
  var now = Date.now();
  var newest = 0;
  TC_PENDING.forEach(function (v) { if (v.phone === phone && v.createdAt > newest) newest = v.createdAt; });
  if (newest && now - newest > 65 * 1000) {
    TC_PENDING.forEach(function (v, k) { if (v.phone === phone && now - v.createdAt > 65 * 1000) TC_PENDING.delete(k); });
    tcPersist();
    send(res, 200, { ok: true, expired: true, error: 'Truecaller ka callback nahi aaya - matlab callback URL registered nahi hai ya site public/HTTPS nahi hai (localhost par Truecaller nahi pahunch sakta). Phone par Truecaller app se hi verify hota hai.' });
    return;
  }
  send(res, 200, { ok: true, pending: true, age: newest ? Math.round((now - newest) / 1000) : 0 });
}

function pubOrder(o) {
  return {
    id: o.id, token: o.token, name: o.name, phone: o.phone, address: o.address, city: o.city,
    pincode: o.pincode, note: o.note, items: o.items, total: o.total, type: o.type,
    status: o.status, statusHistory: o.statusHistory || [], createdAt: o.createdAt,
    eta: o.eta, notified: o.notified, notifyError: o.notifyError || null,
    verified: !!o.verified, verificationStatus: o.verificationStatus || '', paymentStatus: o.paymentStatus || 'Pending'
  };
}

async function handleOrderCreate(req, res, payload) {
  await tcHydrate();
  var name = String(payload.name || '').trim().slice(0, 80);
  var phone = String(payload.phone || '').replace(/\D/g, '');
  var address = String(payload.address || '').trim().slice(0, 300);
  var city = String(payload.city || '').trim().slice(0, 60);
  var pincode = String(payload.pincode || '').trim().slice(0, 10);
  var note = String(payload.note || '').trim().slice(0, 300);
  var type = payload.type === 'upi' ? 'UPI' : 'Cash on Delivery';
  var nonce = String(payload.nonce || '');
  if (!name || !/^[6-9]\d{9}$/.test(phone) || !address || !city || !/^\d{6}$/.test(pincode)) {
    send(res, 400, { ok: false, error: 'missing or invalid fields' });
    return;
  }
  var grant = TC_GRANTS.get(phone);
  var vt = String(payload.verificationToken || '');
  var okGrant = !!(grant && grant.token === vt && Date.now() <= grant.exp);
  var verified = false;
  var verificationStatus = 'Not verified';

  if (okGrant) {
    TC_GRANTS.delete(phone); /* single-use grant — consumed on order creation */
    tcPersist();
    verified = true;
    verificationStatus = 'Verified (Truecaller)';
  } else if (tcComplete()) {
    send(res, 401, { ok: false, error: 'Phone verification failed. Verify your number with Truecaller and try again.' });
    return;
  } else {
    /* Truecaller incomplete/pending on server — allow order unverified */
    verified = false;
    verificationStatus = 'Pending Owner Confirmation';
  }

  if (!Array.isArray(payload.items) || !payload.items.length) { send(res, 400, { ok: false, error: 'empty order' }); return; }
  if (nonce && NONCES.has(nonce)) {
    send(res, 409, { ok: false, duplicate: true, error: 'Duplicate submission — this order was already placed.' });
    return;
  }
  var prices = catalogPrices();
  var items = [];
  var total = 0;
  payload.items.slice(0, 25).forEach(function (it) {
    var id = String(it.id || '');
    var p = prices[id];
    var qty = Math.max(1, Math.min(200, Math.round(Number(it.qty) || 0)));
    if (!p || !qty) return;
    var bpb = Number(p.bottlesPerBox) || 12;
    var line = {
      id: id, name: p.name, size: String(it.size || '').slice(0, 40),
      qty: qty, boxes: Math.floor(qty / bpb), bottles: qty % bpb, bottlesPerBox: bpb,
      price: p.price, lineTotal: qty * p.price
    };
    items.push(line);
    total += line.lineTotal;
  });
  if (!items.length) { send(res, 400, { ok: false, error: 'no valid items in order' }); return; }
  var d = readOrders();
  var now = Date.now();
  var dup = null;
  for (var i = 0; i < d.orders.length; i++) {
    var o = d.orders[i];
    if (o.phone === phone && o.total === total && Math.abs(now - o.createdAt) < 600000) { dup = o; break; }
  }
  if (dup) {
    send(res, 409, { ok: false, duplicate: true, order: pubOrder(dup), error: 'Duplicate submission â€” this order was already placed.' });
    return;
  }
  d.seq = (d.seq || 10000) + 1;
  var order = {
    id: 'SW-' + d.seq,
    seq: d.seq,
    token: crypto.randomBytes(24).toString('hex'),
    name: name, phone: phone, address: address, city: city, pincode: pincode, note: note,
    items: items, total: total, type: type,
    status: 'received',
    statusHistory: [{ status: 'received', at: now }],
    createdAt: now, eta: etaText(now),
    verified: verified, verificationStatus: verificationStatus,
    paymentStatus: 'Pending', ownerNotes: '',
    notified: false, notifyError: null
  };
  d.orders.unshift(order);
  if (d.orders.length > 1000) d.orders = d.orders.slice(0, 1000);
  if (nonce) { NONCES.add(nonce); if (NONCES.size > 5000) NONCES.clear(); }
writeOrders(d);
  var itemSummary = items.map(function (it) { return it.name + ' ' + it.size + ' x' + it.qty; }).join(', ');
  pushNotification('order', order.id, 'New Order #' + order.id, name + ' \u2014 \u20B9' + total + ' \u2014 ' + itemSummary + ' \u2014 ' + city, phone);
  send(res, 200, { ok: true, order: pubOrder(order), whatsappConfigured: !!((CFG.waBot || {}).enabled && (CFG.waBot || {}).owner), ownerPhone: (CFG.waBot || {}).owner || (CFG.whatsapp || {}).owner || '' });
  notifyOwnerWhatsApp(order).then(function (ok) { if (ok) console.log('[order] WA sent for ' + order.id); else console.log('[order] WA failed for ' + order.id); }).catch(function () {});
}

async function handleOrderComplete(req, res, payload) {
  await tcHydrate();
  var token = String(payload.token || '');
  var phone = String(payload.phone || '').replace(/\D/g, '');
  var d = readOrders();
  var order = null;
  if (token) {
    for (var i = 0; i < d.orders.length; i++) {
      if (d.orders[i].token && d.orders[i].token === token) { order = d.orders[i]; break; }
    }
  } else if (/^[6-9]\d{9}$/.test(phone)) {
    var vt = String(payload.vt || '');
    var grant = TC_GRANTS.get(phone);
    if (grant && grant.token === vt && Date.now() <= grant.exp) {
      for (var j = 0; j < d.orders.length; j++) { if (d.orders[j].phone === phone) { order = d.orders[j]; break; } }
    }
  }
  if (!order) { send(res, 401, { ok: false, error: 'Not authorized. Verify your mobile number with Truecaller first.' }); return; }
  if (order.status === 'cancelled') { send(res, 400, { ok: false, error: 'This order was cancelled.' }); return; }
  if (order.status === 'complete_requested' || order.status === 'completed') {
    send(res, 200, { ok: true, status: order.status, message: 'Completion already recorded. The owner confirms it in the admin panel before it is final.' });
    return;
  }
  if (order.status !== 'out' && order.status !== 'delivered') {
    send(res, 400, { ok: false, error: 'You can mark the order complete only after it is out for delivery or delivered.' });
    return;
  }
  order.status = 'complete_requested';
  order.statusHistory.push({ status: 'complete_requested', at: Date.now() });
  order.customerCompletedAt = Date.now();
  writeOrders(d);
  console.log('[orders] #' + order.id + ' customer marked complete â€” waiting for owner confirmation in admin panel.');
  send(res, 200, { ok: true, status: 'complete_requested', message: 'Marked complete. The owner must confirm it in the admin panel â€” after that your order will show Completed.' });
}

async function handleMyOrders(req, res, qp) {
  await tcHydrate();
  var token = String(qp.token || '');
  var phone = String(qp.phone || '').replace(/\D/g, '');
  var authorized = false;
  var d = readOrders();
  if (token) {
    for (var i = 0; i < d.orders.length; i++) {
      if (d.orders[i].token && d.orders[i].token === token) { phone = d.orders[i].phone; authorized = true; break; }
    }
  } else if (/^[6-9]\d{9}$/.test(phone)) {
    var vt = String(qp.vt || '');
    var grant = TC_GRANTS.get(phone);
    if (grant && grant.token === vt && Date.now() <= grant.exp) authorized = true;
  }
  if (!authorized) { send(res, 401, { ok: false, error: 'Not authorized. Verify your mobile number with Truecaller first.' }); return; }
  var mine = d.orders.filter(function (o) { return o.phone === phone; }).map(pubOrder);
  send(res, 200, { ok: true, orders: mine });
}

/* ---------- Admin auth ---------- */
var ADMIN_TOKENS = new Map(); // token -> expiry; PIN from data/server-config.json (admin.pin)
function adminPin() {
  return String((CFG.admin || {}).pin || '');
}
function pruneAdminTokens() {
  var now = Date.now();
  ADMIN_TOKENS.forEach(function (exp, tok) { if (now > exp) ADMIN_TOKENS.delete(tok); });
}
function requireAdmin(req, res) {
  var pin = adminPin();
  if (!pin) {
    if (!CFG._adminOpenWarned) { CFG._adminOpenWarned = true; console.log('[auth] admin.pin is EMPTY in data/server-config.json â€” admin API is OPEN. Set a PIN to lock it.'); }
    return true;
  }
  pruneAdminTokens();
  var tok = String(req.headers['x-admin-token'] || '');
  if (tok && ADMIN_TOKENS.get(tok) && Date.now() <= ADMIN_TOKENS.get(tok)) return true;
  send(res, 401, { ok: false, error: 'Unauthorized: admin login required. POST /api/admin/login with the PIN from data/server-config.json.' });
  return false;
}
function handleAdminLogin(req, res, payload) {
  var pin = adminPin();
  if (!pin) {
    send(res, 200, { ok: true, token: null, openAccess: true, message: 'No admin PIN configured â€” admin panel is open. Set admin.pin in data/server-config.json to lock it.' });
    return;
  }
  if (String(payload.pin || '') !== pin) { send(res, 401, { ok: false, error: 'Wrong PIN' }); return; }
  pruneAdminTokens();
  var tok = crypto.randomBytes(24).toString('hex');
  ADMIN_TOKENS.set(tok, Date.now() + 12 * 3600 * 1000);
  console.log('[auth] admin logged in.');
  send(res, 200, { ok: true, token: tok, openAccess: false });
}

function adminOrderJson(o) {
  var p = pubOrder(o);
  delete p.token;
  p.section = SECTION_LABEL[o.status] || 'PENDING';
  p.ownerNotes = o.ownerNotes || '';
  p.confirmedAt = o.confirmedAt || null;
  p.completedAt = o.completedAt || null;
  p.cancelledAt = o.cancelledAt || null;
  p.rejectReason = o.rejectReason || '';
  p.customerCompletedAt = o.customerCompletedAt || null;
  p.stockApplied = !!o.stockApplied;
  return p;
}

function handleAdminOrders(req, res) {
  if (!requireAdmin(req, res)) return;
  var d = readOrders();
  var list = d.orders.map(adminOrderJson);
  send(res, 200, { ok: true, seq: d.seq, orders: list });
}

function handleAdminOrderStatus(req, res, payload) {
  if (!requireAdmin(req, res)) return;
  var id = String(payload.id || '');
  var status = String(payload.status || '');
  if (STATUSES.indexOf(status) === -1) { send(res, 400, { ok: false, error: 'invalid status' }); return; }
  if (status === 'complete_requested') { send(res, 400, { ok: false, error: 'complete_requested is customer-initiated â€” admin sets completed directly.' }); return; }
  var d = readOrders();
  for (var i = 0; i < d.orders.length; i++) {
    if (d.orders[i].id === id) {
      var o = d.orders[i];
      if (o.status === status) { send(res, 200, { ok: true, status: status, id: id }); return; }
      var allowed = TRANSITIONS[status];
      if (!allowed || allowed.indexOf(o.status) === -1) {
        send(res, 400, { ok: false, error: 'Cannot move #' + id + ' from ' + SECTION_LABEL[o.status] + ' (' + STATUS_LABEL[o.status] + ') to ' + SECTION_LABEL[status] + ' (' + STATUS_LABEL[status] + ').' });
        return;
      }
      var now = Date.now();
      o.status = status;
      o.statusHistory.push({ status: status, at: now });
      if (status === 'confirmed') {
        o.confirmedAt = now;
        o.cancelledAt = null; o.rejectReason = '';
      }
      if (status === 'cancelled') {
        o.cancelledAt = now;
        o.rejectReason = String(payload.reason || '').slice(0, 300);
      }
if (status === 'completed') {
        o.completedAt = now;
        o.paymentStatus = 'Paid';
      }
      if (status === 'completed' && !o.stockApplied) {
        var saleInfo = recordCompletedOrderSale(o);
        o.stockApplied = true;
        o.saleRecorded = saleInfo.recorded > 0;
        o.saleSkipped = saleInfo.skipped;
        console.log('[sales] #' + o.id + ' completed \u2014 recorded ' + saleInfo.recorded + ' sale line(s) into business.json' + (saleInfo.skipped.length ? '; skipped unmatched: ' + saleInfo.skipped.join(', ') : '') + '.');
      }
writeOrders(d);
      send(res, 200, { ok: true, status: status, id: id, section: SECTION_LABEL[status] });
      return;
    }
  }
  send(res, 404, { ok: false, error: 'order not found' });
}

/* When an order becomes COMPLETED its sale is recorded into business.json (idempotent via o.stockApplied).
   This is the ONLY place a tracked order becomes a completed sale: PENDING/CONFIRMED never count. */
function recordCompletedOrderSale(o) {
  var b = readBiz();
  var recorded = 0, skipped = [];
  function todayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  (o.items || []).forEach(function (it) {
    var p = null;
    for (var j = 0; j < (b.products || []).length; j++) { if (b.products[j].id === it.id) { p = b.products[j]; break; } }
    if (!p) {
      for (var k = 0; k < (b.products || []).length; k++) {
        if (b.products[k].name === it.name && (!it.size || b.products[k].size === it.size)) { p = b.products[k]; break; }
      }
    }
    if (!p) { skipped.push(it.name + (it.size ? ' ' + it.size : '')); return; }
    var boxes = Number(it.boxes) || Math.floor((Number(it.qty) || 0) / (Number(it.bottlesPerBox) || 12));
    var bottles = Number(it.bottles) || ((Number(it.qty) || 0) % (Number(it.bottlesPerBox) || 12));
    var bpb = Number(p.bottlesPerBox) || Number(it.bottlesPerBox) || 12;
    /* Order items carry a per-bottle price; business.json stores price/cost per box. */
    var ppb = Math.max(0, (Number(it.price) || 0) * bpb);
    var total = boxes * ppb + bottles * (ppb / bpb);
    var cost = boxes * (Number(p.cost) || 0) + bottles * ((Number(p.cost) || 0) / bpb);
    b.sales = b.sales || [];
    b.sales.unshift({
      id: 'sl' + Date.now() + Math.floor(Math.random() * 1000),
      date: todayIso(), ref: o.id, customer: o.name, phone: o.phone,
      productId: p.id, product: p.name, size: p.size,
      boxes: boxes, bottles: bottles, bottlesPerBox: bpb,
      pricePerBox: ppb, total: total, cost: cost, profit: total - cost,
      payment: 'online',
      status: 'completed', source: 'website-order', notes: 'Order #' + o.id + (o.note ? ' â€” ' + o.note : ''),
      at: Date.now()
    });
    recorded++;
  });
  if (recorded) writeBiz(b);
  return { recorded: recorded, skipped: skipped };
}

function handleAdminOrderNote(req, res, payload) {
  if (!requireAdmin(req, res)) return;
  var id = String(payload.id || '');
  var note = String(payload.note || '').trim().slice(0, 1000);
  var d = readOrders();
  for (var i = 0; i < d.orders.length; i++) {
    if (d.orders[i].id === id) {
      d.orders[i].ownerNotes = note;
      writeOrders(d);
      send(res, 200, { ok: true, id: id, note: note });
      return;
    }
  }
  send(res, 404, { ok: false, error: 'order not found' });
}

function handleAdminOrderDelete(req, res, payload) {
  if (!requireAdmin(req, res)) return;
  var id = String(payload.id || '');
  var d = readOrders();
  for (var i = 0; i < d.orders.length; i++) {
    if (d.orders[i].id === id) {
      if (d.orders[i].status !== 'cancelled') {
        send(res, 400, { ok: false, error: 'Only cancelled orders can be permanently deleted.' });
        return;
      }
      d.orders.splice(i, 1);
      writeOrders(d);
      console.log('[orders] #' + id + ' permanently deleted by admin.');
      send(res, 200, { ok: true, id: id });
      return;
    }
  }
  send(res, 404, { ok: false, error: 'order not found' });
}

function handleDashboard(req, res) {
  if (!db.state().on) { send(res, 200, { ok: true, mongo: false, stats: null }); return; }
  Promise.all([db.loadOrders(), db.loadBiz(), db.loadEvents()]).then(function (parts) {
    var ordersDoc = parts[0] || { orders: [] };
    var bizDoc = parts[1] || { products: [], sales: [], pendingOrders: [] };
    var events = parts[2] || [];
    var now = Date.now();
    var today = new Date().toISOString().slice(0, 10);
    var weekAgo = new Date(now - 7 * 86400000).toISOString().slice(0, 10);
    var monthStart = new Date(now - 30 * 86400000).toISOString().slice(0, 10);
    var allOrders = ordersDoc.orders || [];
    var sales = bizDoc.sales || [];
    var products = bizDoc.products || [];
    var pending = allOrders.filter(function (o) { return o.status === 'received' || o.status === 'confirmed' || o.status === 'preparing' || o.status === 'out'; });
    var completed = allOrders.filter(function (o) { return o.status === 'completed'; });
    var cancelled = allOrders.filter(function (o) { return o.status === 'cancelled'; });
    var todaySales = sales.filter(function (s) { return s.date === today; });
    var weekSales = sales.filter(function (s) { return s.date >= weekAgo; });
    var monthSales = sales.filter(function (s) { return s.date >= monthStart; });
    var totalRevenue = sales.reduce(function (sum, s) { return sum + (Number(s.total) || 0); }, 0);
    var totalProfit = sales.reduce(function (sum, s) { return sum + (Number(s.profit) || 0); }, 0);
    var whatsappClicks = events.filter(function (e) { return e.type === 'whatsapp_click'; }).length;
    var todayWhatsapp = events.filter(function (e) { return e.type === 'whatsapp_click' && e.at && new Date(e.at).toISOString().slice(0, 10) === today; }).length;
    var lowStock = products.filter(function (p) { return (Number(p.stockBottles) || 0) > 0 && (Number(p.stockBottles) || 0) < (Number(p.minStock) || 15); });
    var outOfStock = products.filter(function (p) { return (Number(p.stockBottles) || 0) === 0 && (Number(p.minStock) || 15) > 0; });
    var customers = {};
    allOrders.forEach(function (o) { if (o.phone) customers[o.phone] = (customers[o.phone] || 0) + 1; });
    var topProducts = {};
    sales.forEach(function (s) { var k = s.product || s.name || 'Unknown'; topProducts[k] = (topProducts[k] || 0) + (Number(s.boxes) || 0); });
    var topList = Object.keys(topProducts).map(function (k) { return { name: k, quantity: topProducts[k] }; }).sort(function (a, b) { return b.quantity - a.quantity; }).slice(0, 5);
    send(res, 200, {
      ok: true, mongo: true,
      stats: {
        totalOrders: allOrders.length, pendingOrders: pending.length, completedOrders: completed.length, cancelledOrders: cancelled.length,
        totalSales: sales.length, todaySales: todaySales.length, weekSales: weekSales.length, monthSales: monthSales.length,
        totalRevenue: totalRevenue, totalProfit: totalProfit,
        totalCustomers: Object.keys(customers).length, totalProducts: products.length,
        lowStock: lowStock.length, outOfStock: outOfStock.length,
        whatsappClicks: whatsappClicks, todayWhatsapp: todayWhatsapp,
        topProducts: topList, recentOrders: allOrders.slice(-5).reverse()
      }
    });
  }).catch(function (e) { send(res, 500, { ok: false, error: e.message }); });
}

function handleArchive(req, res, payload) {
  var period = String(payload.period || '').slice(0, 7);
  if (!period || !/^\d{4}-\d{2}$/.test(period)) { send(res, 400, { ok: false, error: 'period required (YYYY-MM)' }); return; }
  if (!db.state().on) { send(res, 503, { ok: false, error: 'MongoDB not connected' }); return; }
  db.loadArchives().then(function (existing) {
    var list = existing || [];
    var already = list.find(function (a) { return a.period === period; });
    if (already) { send(res, 200, { ok: true, archive: already, existed: true }); return; }
    return db.loadOrders().then(function (ordersDoc) {
      return db.loadBiz().then(function (bizDoc) {
        var allOrders = (ordersDoc && ordersDoc.orders) || [];
        var allSales = (bizDoc && bizDoc.sales) || [];
        var eligibleOrders = allOrders.filter(function (o) { return o.date && o.date.slice(0, 7) === period; });
        var eligibleSales = allSales.filter(function (s) { return s.date && s.date.slice(0, 7) === period; });
        var totalSales = eligibleSales.reduce(function (sum, s) { return sum + (Number(s.total) || 0); }, 0);
        var archive = { period: period, status: 'completed', recordCount: eligibleSales.length + eligibleOrders.length, totalSales: totalSales, totalOrders: eligibleOrders.length, sales: eligibleSales, orders: eligibleOrders, createdAt: Date.now() };
        return db.addArchive(archive).then(function () {
          send(res, 200, { ok: true, archive: archive, existed: false });
        });
      });
    });
  }).catch(function (e) { send(res, 500, { ok: false, error: e.message }); });
}

function handleApi(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/reviews') {
    send(res, 200, readReviews());
    return true;
  }
  if (req.method === 'POST' && (pathname === '/api/reviews' || pathname === '/api/reviews/delete')) {
    var body = '';
    req.on('data', function (chunk) { body += chunk; if (body.length > 1e6) req.destroy(); });
    req.on('end', function () {
      var payload = {};
      try { payload = JSON.parse(body || '{}'); } catch (e) {}
      var list = readReviews();
      if (pathname === '/api/reviews') {
        var r = payload.review || payload;
        if (r && r.name && r.text && r.rating >= 1 && r.rating <= 5) {
          var rev = {
            id: 'r' + Date.now() + Math.floor(Math.random() * 1000),
            name: String(r.name).slice(0, 60),
            rating: Number(r.rating),
            text: String(r.text).slice(0, 800),
            product: String(r.product || '').slice(0, 60),
            date: String(r.date || ''),
            at: Date.now()
          };
          list.unshift(rev);
          if (list.length > 200) list = list.slice(0, 200);
          writeReviews(list);
          send(res, 200, { ok: true, id: rev.id });
        } else {
          send(res, 400, { ok: false, error: 'bad review' });
        }
      } else {
        var target = payload.id;
        var before = list.length;
        list = list.filter(function (x) { return x.id !== target; });
        writeReviews(list);
        send(res, 200, { ok: true, removed: before - list.length });
      }
    });
    return true;
  }
  if (req.method === 'GET' && pathname === '/api/biz') {
    send(res, 200, readBiz());
    return true;
  }
  if (req.method === 'POST' && pathname === '/api/biz') {
    if (!requireAdmin(req, res)) return;
    var bb = '';
    req.on('data', function (chunk) { bb += chunk; if (bb.length > 4e6) req.destroy(); });
    req.on('end', function () {
      var payload = null;
      try { payload = JSON.parse(bb || '{}'); } catch (e) { send(res, 400, { ok: false, error: 'bad json' }); return; }
      if (!payload || !Array.isArray(payload.products)) { send(res, 400, { ok: false, error: 'not a business doc' }); return; }
      var cur = readBiz();
      if (payload.pendingOrders) cur.pendingOrders = payload.pendingOrders;
      if (payload.products) cur.products = payload.products;
      if (payload.purchases) cur.purchases = payload.purchases;
      if (payload.sales) cur.sales = payload.sales;
      if (payload.adjustments) cur.adjustments = payload.adjustments;
      if (payload.settings) cur.settings = payload.settings;
writeBiz(cur);
      send(res, 200, { ok: true });
    });
    return true;
  }
  if (req.method === 'GET' && pathname === '/api/site-data') {
    send(res, 200, { ok: true, content: readSiteDataJs() });
    return true;
  }
  if (req.method === 'POST' && pathname === '/api/site-data') {
    if (!requireAdmin(req, res)) return;
    var sdb = '';
    req.on('data', function (chunk) { sdb += chunk; if (sdb.length > 3e6) req.destroy(); });
    req.on('end', function () {
      var payload = null;
      try { payload = JSON.parse(sdb || '{}'); } catch (e) { send(res, 400, { ok: false, error: 'bad json' }); return; }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) { send(res, 400, { ok: false, error: 'site data must be a json object' }); return; }
      writeSiteDataJs(payload);
      send(res, 200, { ok: true });
    });
    return true;
  }
  if (req.method === 'GET' && pathname === '/api/db-status') {
    send(res, 200, { ok: true, mongo: db.state() });
    return true;
  }
  if (req.method === 'POST' && pathname === '/api/orders') {
    var ob = '';
    req.on('data', function (chunk) { ob += chunk; if (ob.length > 2e6) req.destroy(); });
    req.on('end', function () {
      var payload = {};
      try { payload = JSON.parse(ob || '{}'); } catch (e) {}
      var cur = readBiz();
      var order = {
        id: 'O' + Date.now() + Math.floor(Math.random() * 1000),
        ref: String(payload.ref || ('RW-' + Date.now().toString(36).toUpperCase().slice(-6))),
        at: Number(payload.at) || Date.now(),
        date: String(payload.date || new Date().toISOString().slice(0, 10)),
        customer: String(payload.customer || '').slice(0, 80),
        phone: String(payload.phone || '').slice(0, 20),
        address: String(payload.address || '').slice(0, 300),
        total: Number(payload.total) || 0,
        items: Array.isArray(payload.items) ? payload.items.slice(0, 50).map(function (it) {
          return { name: String(it.name || '').slice(0, 80), size: String(it.size || '').slice(0, 40), boxes: Number(it.boxes) || 0, bottles: Number(it.bottles) || 0, pricePerBox: Number(it.pricePerBox) || 0 };
        }) : [],
        status: 'pending',
        source: 'website'
      };
      if (!order.items.length && !order.total) { send(res, 400, { ok: false, error: 'empty order' }); return; }
      cur.pendingOrders = cur.pendingOrders || [];
      cur.pendingOrders.unshift(order);
      if (cur.pendingOrders.length > 300) cur.pendingOrders = cur.pendingOrders.slice(0, 300);
      writeBiz(cur);
      send(res, 200, { ok: true, id: order.id });
    });
    return true;
  }
if (req.method === 'GET' && pathname === '/api/orders/config') {
    var wb = CFG.waBot || {};
    send(res, 200, {
      ok: true,
      whatsappConfigured: !!(wb.enabled && wb.owner),
      truecallerConfigured: tcComplete(),
      truecallerPendingMode: tcPartial()
    });
    return true;
  }
if (req.method === 'POST' && pathname === '/api/truecaller/begin') {
    readBody(req, res, function (p) { handleTcBegin(req, res, p).catch(function (e) { tcLog('begin error: ' + (e && e.message)); }); });
    return true;
  }
  if (req.method === 'POST' && pathname === '/api/truecaller/callback') {
    readBody(req, res, function (p) { handleTcCallback(req, res, p); });
    return true;
  }
  if (req.method === 'GET' && pathname === '/api/truecaller/status') {
    var sq = require('url').parse(req.url, true).query || {};
    handleTcStatus(req, res, sq).catch(function (e) { tcLog('status error: ' + (e && e.message)); });
    return true;
  }
  if (req.method === 'POST' && pathname === '/api/orders/create') {
    readBody(req, res, function (p) { handleOrderCreate(req, res, p).catch(function (e) { tcLog('create error: ' + (e && e.message)); }); });
    return true;
  }
  if (req.method === 'POST' && pathname === '/api/orders/complete') {
    readBody(req, res, function (p) { handleOrderComplete(req, res, p).catch(function (e) { tcLog('complete error: ' + (e && e.message)); }); });
    return true;
  }
  if (req.method === 'GET' && pathname === '/api/orders/my') {
    var parts = require('url').parse(req.url, true);
    handleMyOrders(req, res, parts.query || {}).catch(function (e) { tcLog('my orders error: ' + (e && e.message)); });
    return true;
  }
  if (req.method === 'GET' && pathname === '/api/admin/orders') {
    handleAdminOrders(req, res);
    return true;
  }
  if (req.method === 'GET' && pathname === '/api/notifications') {
    if (!requireAdmin(req, res)) return;
    var list = readNotifications();
    var unread = list.filter(function (n) { return !n.read; }).length;
    send(res, 200, { ok: true, notifications: list.slice(0, 100), unread: unread });
    return true;
  }
  if (req.method === 'POST' && pathname === '/api/notifications/read') {
    if (!requireAdmin(req, res)) return;
    var nb = '';
    req.on('data', function (chunk) { nb += chunk; if (nb.length > 1e6) req.destroy(); });
    req.on('end', function () {
      var payload = {};
      try { payload = JSON.parse(nb || '{}'); } catch (e) {}
      var list = readNotifications();
      if (payload.readAll) {
        list.forEach(function (n) { n.read = true; });
      } else if (payload.ids && Array.isArray(payload.ids)) {
        var ids = payload.ids;
        list.forEach(function (n) { if (ids.indexOf(n.id) !== -1) n.read = true; });
      }
      writeNotifications(list);
      var unread = list.filter(function (n) { return !n.read; }).length;
      send(res, 200, { ok: true, unread: unread });
    });
    return true;
  }
  if (req.method === 'POST' && pathname === '/api/notifications/reply') {
    if (!requireAdmin(req, res)) return;
    var rb = '';
    req.on('data', function (chunk) { rb += chunk; if (rb.length > 1e6) req.destroy(); });
    req.on('end', function () {
      var payload = {};
      try { payload = JSON.parse(rb || '{}'); } catch (e) {}
      var phone = String(payload.phone || '').replace(/\D/g, '');
      var message = String(payload.message || '').trim();
      if (!phone || !message) { send(res, 400, { ok: false, error: 'phone and message required' }); return; }
      if (!/^[6-9]\d{9}$/.test(phone)) { send(res, 400, { ok: false, error: 'invalid phone' }); return; }
      var wa = CFG.whatsapp || {};
      var waBot = CFG.waBot || {};
      var sent = false;
      if (waBot.enabled) {
        var http = require('http');
        var postData = JSON.stringify({ to: '91' + phone, text: message });
        var req2 = http.request({ hostname: '127.0.0.1', port: waBot.port || 3001, path: '/send', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) } }, function (res2) { sent = true; });
        req2.on('error', function () {});
        req2.write(postData);
        req2.end();
      }
      send(res, 200, { ok: true, sent: sent });
    });
    return true;
  }
  if (req.method === 'GET' && pathname === '/api/whatsapp-config') {
    if (!requireAdmin(req, res)) return;
    var wa = CFG.whatsapp || {};
    send(res, 200, { ok: true, enabled: !!wa.enabled, phoneId: wa.phoneId || '', owner: wa.owner || '917742735762' });
    return true;
  }
  if (req.method === 'POST' && pathname === '/api/whatsapp-config') {
    if (!requireAdmin(req, res)) return;
    var wcb = '';
    req.on('data', function (chunk) { wcb += chunk; if (wcb.length > 1e6) req.destroy(); });
    req.on('end', function () {
      var payload = {};
      try { payload = JSON.parse(wcb || '{}'); } catch (e) {}
      if (!payload.token || !payload.phoneId) { send(res, 400, { ok: false, error: 'token and phoneId required' }); return; }
      try {
        var cfgPath = require('path').join(__dirname, 'data', 'server-config.json');
        var cfg = JSON.parse(require('fs').readFileSync(cfgPath, 'utf8'));
        cfg.whatsapp = cfg.whatsapp || {};
        cfg.whatsapp.enabled = payload.enabled !== false;
        cfg.whatsapp.token = payload.token;
        cfg.whatsapp.phoneId = payload.phoneId;
        cfg.whatsapp.owner = payload.owner || '917742735762';
        require('fs').writeFileSync(cfgPath, JSON.stringify(cfg, null, 4));
        CFG.whatsapp = cfg.whatsapp;
        send(res, 200, { ok: true });
      } catch (e) { send(res, 500, { ok: false, error: e.message }); }
    });
    return true;
  }
  if (req.method === 'POST' && pathname === '/api/admin/login') {
    readBody(req, res, function (p) { handleAdminLogin(req, res, p); });
    return true;
  }
  if (req.method === 'POST' && pathname === '/api/admin/logout') {
    var tok = String(req.headers['x-admin-token'] || '');
    if (tok) ADMIN_TOKENS.delete(tok);
    send(res, 200, { ok: true });
    return true;
  }
  if (req.method === 'POST' && pathname === '/api/admin/orders/status') {
    readBody(req, res, function (p) { handleAdminOrderStatus(req, res, p); });
    return true;
  }
  if (req.method === 'POST' && pathname === '/api/admin/orders/note') {
    readBody(req, res, function (p) { handleAdminOrderNote(req, res, p); });
    return true;
  }
if (req.method === 'POST' && pathname === '/api/admin/orders/delete') {
    readBody(req, res, function (p) { handleAdminOrderDelete(req, res, p); });
    return true;
  }
  /* ---- Analytics / Event Tracking ---- */
  if (req.method === 'POST' && pathname === '/api/track') {
    if (!requireAdmin(req, res)) return;
    readBody(req, res, function (p) {
      var evt = { type: String(p.type || '').slice(0, 40), page: String(p.page || '').slice(0, 100), productId: String(p.productId || '').slice(0, 60), source: String(p.source || '').slice(0, 60), ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim().slice(0, 45), ua: String(req.headers['user-agent'] || '').slice(0, 200), at: Date.now() };
      if (!evt.type) { send(res, 400, { ok: false, error: 'type required' }); return; }
      if (db.state().on) { db.addEvent(evt).then(function () { send(res, 200, { ok: true }); }).catch(function (e) { send(res, 500, { ok: false, error: e.message }); }); }
      else { send(res, 200, { ok: true }); }
    });
    return true;
  }
  if (req.method === 'GET' && pathname === '/api/track') {
    if (!requireAdmin(req, res)) return;
    if (db.state().on) { db.loadEvents().then(function (events) { send(res, 200, { ok: true, events: events || [] }); }).catch(function (e) { send(res, 500, { ok: false, error: e.message }); }); }
    else { send(res, 200, { ok: true, events: [] }); }
    return true;
  }
  /* ---- WhatsApp Click Tracking (public) ---- */
  if (req.method === 'POST' && pathname === '/api/track/whatsapp') {
    readBody(req, res, function (p) {
      var evt = { type: 'whatsapp_click', page: String(p.page || '').slice(0, 100), productId: String(p.productId || '').slice(0, 60), source: String(p.source || '').slice(0, 60), ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim().slice(0, 45), ua: String(req.headers['user-agent'] || '').slice(0, 200), at: Date.now() };
      if (db.state().on) { db.addEvent(evt).then(function () { send(res, 200, { ok: true }); }).catch(function () { send(res, 200, { ok: true }); }); }
      else { send(res, 200, { ok: true }); }
    });
    return true;
  }
  /* ---- Archives (admin) ---- */
  if (req.method === 'GET' && pathname === '/api/archives') {
    if (!requireAdmin(req, res)) return;
    if (db.state().on) { db.loadArchives().then(function (list) { send(res, 200, { ok: true, archives: list || [] }); }).catch(function (e) { send(res, 500, { ok: false, error: e.message }); }); }
    else { send(res, 200, { ok: true, archives: [] }); }
    return true;
  }
  if (req.method === 'POST' && pathname === '/api/admin/archive') {
    if (!requireAdmin(req, res)) return;
    readBody(req, res, function (p) {
      handleArchive(req, res, p);
    });
    return true;
  }
  /* ---- Dashboard Stats (admin) ---- */
  if (req.method === 'GET' && pathname === '/api/admin/dashboard') {
    if (!requireAdmin(req, res)) return;
    handleDashboard(req, res);
    return true;
  }
  if (req.method === 'POST') {
    /* Last resort: Truecaller may hit ANY path (base URL or registered path)
       with the callback — accept it wherever it lands. Reached only when no
       explicit route matched. */
    readBody(req, res, function (p) {
      tcLog('POST ' + req.url + ' body=' + JSON.stringify(p || {}).slice(0, 100));
      if (p && (p.requestId || p.accessToken || p.status)) { handleTcCallback(req, res, p); return; }
      send(res, 200, { ok: true });
    });
    return true;
  }
  return false;
}

function appHandler(req, res) {
  var pathname = decodeURIComponent((req.url || '/').split('?')[0]);

  /* CORS preflight (browser sends OPTIONS before real request) */
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  if (handleApi(req, res, pathname)) return;

  if (pathname === '/health' || pathname === '/health/') { send(res, 200, 'Backend is running', 'text/plain'); return; }

  if (pathname === '/wa' || pathname === '/wa/') { proxyTo(PORT_BOT, req, res); return; }

  if (req.method === 'POST') { tcLog('unknown POST ' + req.url); }

  if (pathname === '/' || pathname === '/index.html') pathname = '/pages/index.html';
  if (pathname === '/products.html' || pathname === '/products') pathname = '/pages/products.html';
  if (pathname === '/admin' || pathname === '/admin.html') pathname = '/admin.html';
  var fp = path.normalize(path.join(APP_DIR, pathname));
  if (fp !== APP_DIR && !fp.startsWith(APP_DIR + path.sep)) { send(res, 403, 'Forbidden'); return; }
  fs.readFile(fp, function (err, data) {
    if (err) { send(res, 404, 'Not found: ' + pathname, 'text/plain'); return; }
    var hdrs = Object.assign({ 'Content-Type': types[path.extname(fp)] || 'application/octet-stream' }, CORS_HEADERS);
    var ext = path.extname(fp);
    if (ext === '.html' || ext === '.js' || ext === '.css' || ext === '.json') hdrs['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    else if (ext === '.webp' || ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.svg' || ext === '.gif' || ext === '.ico' || ext === '.woff' || ext === '.woff2') hdrs['Cache-Control'] = 'public, max-age=86400';
    res.writeHead(200, hdrs);
    res.end(data);
  });
}

async function boot() {
  await db.initDb();
  await syncFromMongo();
  await tcHydrate();
}

/* Vercel serverless: each request may hit a different warm instance, so refresh
   the in-memory caches from MongoDB before handling. Idempotent + cheap. */
var refreshMem = syncFromMongo;

/* Local run only: attach the HTTP listener. When required from api/index.js
   (Vercel serverless) it must NOT listen — the platform invokes appHandler. */
if (require.main === module) {
  boot().then(function () {
    http.createServer(appHandler).listen(port, function () {
      console.log('[rajesh-water] serving ' + root + ' at http://localhost:' + port);
      console.log('[rajesh-water] reviews API at http://localhost:' + port + '/api/reviews');
      console.log('[rajesh-water] mongo status: ' + (db.state().on ? 'ON (MongoDB)' : 'OFF (file fallback)'));
    });
  }).catch(function (e) { console.log('[boot] fatal: ' + (e && e.stack || e)); });
}

module.exports = { boot: boot, appHandler: appHandler, db: db, cfg: { get: function () { return CFG; } }, refreshMem: refreshMem, tcHydrate: tcHydrate };

