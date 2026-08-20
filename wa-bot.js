/* wa-bot.js — Owner WhatsApp bot (whatsapp-web.js)
   Runs alongside server.js on port 3001.
   - Open http://localhost:3001/ on the PC to see the QR code, scan it once with the owner's WhatsApp.
   - POST /send {to, text} -> sends the message from the owner's WhatsApp to `to` right away.
   - State written to wa-bot-state.json so the CLI can check status.

   Start: node wa-bot.js
   Dependencies: whatsapp-web.js, qrcode, puppeteer (= puppeteer-core alias -> system Chrome).
*/
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');

const PORT = 3001;
const STATE_FILE = path.join(__dirname, 'wa-bot-state.json');
const SESSION_DIR = path.join(__dirname, 'wa-session');
const CHROME = process.env.WA_CHROME ||
  (fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe') ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '');

let state = { status: 'starting', qr: null, ready: false, error: null, lastSend: null, ts: Date.now() };
let latestPage = ''; /* raw QR string for the QR page */
let pendingQueue = []; /* messages queued until client is ready */
let client = null;

function saveState(patch) {
  Object.assign(state, patch || {});
  state.ts = Date.now();
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); } catch (e) {}
}

function log(msg) { console.log('[wa-bot ' + new Date().toLocaleTimeString() + '] ' + msg); saveState({ message: msg.slice(0, 300) }); }

function makePage() {
  if (state.ready) {
    return '<!doctype html><html><head><meta charset="utf-8"><title>WhatsApp Bot</title></head>' +
      '<body style="font-family:sans-serif;background:#0E1626;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">' +
      '<div style="text-align:center"><div style="font-size:22px;font-weight:800;color:#53e0a1">\u2713 WhatsApp connected</div>' +
      '<p style="color:#8B98AD">Order aate hi owner number par message jaayega.</p></div></body></html>';
  }
  var qrImg = state.qr || latestPage;
  if (!qrImg) {
    return '<!doctype html><html><head><meta charset="utf-8"><title>WhatsApp Bot</title></head>' +
      '<body style="font-family:sans-serif;background:#0E1626;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">' +
      '<div style="text-align:center;color:#FFC857;font-size:18px;font-weight:700">Connecting&#8230; QR aane wala hai &#8212; page auto-refresh ho raha hai.</div></body></html>';
  }
  return '<!doctype html><html><head><meta charset="utf-8"><title>WhatsApp Bot — Scan QR</title></head>' +
    '<body style="font-family:sans-serif;background:#0E1626;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">' +
    '<div style="text-align:center"><div style="font-size:20px;font-weight:800;color:#FFC857;margin-bottom:14px">Scan QR with WhatsApp</div>' +
    '<img src="' + qrImg + '" alt="QR" style="border-radius:12px;max-width:280px;width:100%">' +
    '<p style="color:#8B98AD;margin-top:14px">WhatsApp \u2192 Settings \u2192 Linked devices \u2192 Link a device<br>Ya home screen par \u25B6 icon dabao (dono tarah khulega)<br>Uske baad yahi QR scan karo.</p>' +
    '<meta http-equiv="refresh" content="3"></div></body></html>';
}

function normalizeTo(to) { return /^[0-9+]+$/.test(to) ? to + '@c.us' : to; }

const server = http.createServer(function (req, res) {
  if (req.method === 'POST' && req.url === '/send') {
    var body = '';
    req.on('data', function (c) { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', function () {
      var p = {};
      try { p = JSON.parse(body || '{}'); } catch (e) {}
      var to = normalizeTo(String(p.to || '').replace(/[^0-9+@.a-z_]/gi, ''));
      var text = String(p.text || '');
      if (!to || !text) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end('{"ok":false,"error":"to/text required"}'); return; }
      if (!client || !state.ready) { pendingQueue.push({ to: to, text: text }); log('queued message for ' + to + ' (client not ready yet)'); res.writeHead(202, { 'Content-Type': 'application/json' }); res.end('{"ok":true,"queued":true}'); return; }
      client.sendMessage(to, text).then(function () {
        log('sent to ' + to + ': ' + text.slice(0, 60));
        saveState({ lastSend: { to: to, text: text.slice(0, 80), at: Date.now() } });
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true,"sent":true}');
      }).catch(function (e) {
        log('send error to ' + to + ': ' + (e && e.stack || e && e.message || e));
        saveState({ error: 'send: ' + (e && e.stack || e && e.message || e) });
        res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: String(e && e.message || e) }));
      });
    });
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(makePage());
});

server.listen(PORT, function () { log('listening on http://localhost:' + PORT + ' (open in PC browser to scan QR)'); });

function boot() {
  var opts = { authStrategy: new LocalAuth({ dataPath: SESSION_DIR }) };
  if (CHROME) { opts.puppeteer = { headless: false, args: ['--no-sandbox', '--disable-setuid-sandbox'], executablePath: CHROME }; }
  else { log('Chrome nahi mila — puppeteer apna browser chalaoge (pehli baar download hoga)'); }
  client = new Client(opts);

  client.on('qr', function (qr) {
    latestPage = qr;
    QRCode.toDataURL(qr, { width: 300, margin: 1 }).then(function (dataUrl) {
      saveState({ qr: dataUrl, status: 'awaiting_scan', error: null, ready: false });
      log('QR ready — abhi isse scan karo (http://localhost:3001/)');
    }).catch(function (e) { log('qr encode error: ' + e.message); });
  });

  client.on('loading_screen', function (percent) { log('loading_screen ' + percent + '%'); });
  client.on('change_state', function (st) { log('state -> ' + st); });

  client.on('authenticated', function () { log('authenticated (session saved)'); saveState({ status: 'authenticated' }); });

  client.on('ready', function () {
    log('READY — WhatsApp connected. Order notifications ab ON.');
    saveState({ status: 'ready', ready: true, qr: null, error: null });
    flushQueue();
  });

  client.on('auth_failure', function (msg) { log('auth failure: ' + msg); saveState({ status: 'auth_failure', error: String(msg) }); });

  client.on('disconnected', function (reason) { log('disconnected: ' + reason); saveState({ status: 'disconnected', ready: false }); });

  client.on('message', function (msg) {
    var text = (msg.body || '').trim().toLowerCase();
    if (text === 'status') {
      msg.reply('Bot active — order notification ready.');
    } else if (text === 'ping') {
      msg.reply('pong');
    }
  });

  client.initialize().then(function () { log('initialize() called'); }).catch(function (e) { log('initialize error: ' + (e && e.message || e)); saveState({ status: 'error', error: String(e && e.message || e) }); });
}

function flushQueue() {
  if (!client || !state.ready) return;
  var q = pendingQueue.splice(0, pendingQueue.length);
  q.forEach(function (m) {
    client.sendMessage(m.to, m.text).then(function () { log('sent queued -> ' + m.to); }).catch(function (e) { log('queued send error: ' + (e && e.message || e)); });
  });
}

process.on('SIGINT', function () { log('stopping'); saveState({ status: 'stopped' }); process.exit(0); });
process.on('uncaughtException', function (e) { log('uncaught: ' + (e && e.stack || e)); saveState({ status: 'error', error: String(e && e.message || e) }); });

boot();