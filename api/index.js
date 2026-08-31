/* Vercel serverless entry point — deployed from project root.
   Requires backend/server.js which handles ALL API routes AND
   serves static frontend files from frontend/ directory. */

const backend = require('../backend/server');

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
    await backend.refreshMem();
    await backend.tcHydrate();
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Backend failed to boot: ' + (e && e.message || e));
    return;
  }

  const pathname = decodeURIComponent((req.url || '/').split('?')[0]);

  if (req.method === 'GET' && pathname === '/health') {
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    res.end('Backend is running');
    return;
  }

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
