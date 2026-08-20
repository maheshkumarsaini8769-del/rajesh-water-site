/* Vercel serverless entry point for the Rajesh Water backend.
   Vercel invokes this exported function per request instead of the
   long-running `node server.js` listener. It reuses the exact same
   route handling as the local server (server.js), so every existing
   API stays working. */

const backend = require('../server');

let bootPromise = null;
function ensureBoot() {
  if (!bootPromise) bootPromise = backend.boot().catch(function (e) {
    bootPromise = null;
    throw e;
  });
  return bootPromise;
}

module.exports = async function handler(req, res) {
  try {
    await ensureBoot();
  } catch (e) {
    /* Vercel cold start / MongoDB down — still answer so the deploy is reachable. */
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Backend failed to boot: ' + (e && e.message || e));
    return;
  }

  const pathname = decodeURIComponent((req.url || '/').split('?')[0]);

  /* Health check — the root of the backend deployment. */
  if (req.method === 'GET' && (pathname === '/' || pathname === '/health')) {
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    res.end('Backend is running');
    return;
  }

  /* CORS preflight before delegating to the shared handler. */
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, PUT, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-admin-token, Authorization',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return;
  }

  backend.appHandler(req, res);
};