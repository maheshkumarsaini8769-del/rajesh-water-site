"use strict";
/* Lightweight Orders Module — loads independently of admin-biz.js
   Provides instant order list with auto-refresh, status filters, search */

(function () {
  var token = (function () { try { return localStorage.getItem('rw_admin_tok') || ''; } catch (e) { return ''; } })();
  var orders = [];
  var filter = 'PENDING';
  var searchQ = '';
  var refreshTimer = null;
  var box = null;

  var SEC_TXT = { PENDING: 'PENDING', CONFIRMED: 'CONFIRMED', COMPLETED: 'COMPLETED', CANCELLED: 'CANCELLED' };
  var SEC_CLS = { PENDING: 'warn', CONFIRMED: 'blu', COMPLETED: 'ok', CANCELLED: 'err' };
  var SEC_CLR = { PENDING: '#FFC857', CONFIRMED: '#38D9FF', COMPLETED: '#35E0A1', CANCELLED: '#FF5C7A' };
  var SEC_BG = { PENDING: 'rgba(255,200,87,.06)', CONFIRMED: 'rgba(56,217,255,.06)', COMPLETED: 'rgba(53,224,161,.06)', CANCELLED: 'rgba(255,92,122,.06)' };
  var ORD_LABEL = { received: 'Order Placed', confirmed: 'Confirmed', preparing: 'Preparing', out: 'Out for Delivery', delivered: 'Delivered', completed: 'Completed', cancelled: 'Cancelled', complete_requested: 'Customer Requested' };

  function secOf(o) {
    if (!o) return 'PENDING';
    var st = o.status || '';
    if (st === 'received') return 'PENDING';
    if (st === 'completed') return 'COMPLETED';
    if (st === 'cancelled') return 'CANCELLED';
    return 'CONFIRMED';
  }
  function money(n) { return '\u20B9' + Math.round(Number(n) || 0).toLocaleString('en-IN'); }
  function fmtDate(ts) { try { return new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function num(n) { return Number(n) || 0; }
  function $(id) { return document.getElementById(id); }

  function apiFetch(url, opts, cb) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    opts.headers['x-admin-token'] = token;
    fetch(url, opts).then(function (r) {
      if (r.status === 401) { cb({ needLogin: true }); return; }
      r.json().catch(function () { return null; }).then(function (d) { cb(d || {}); });
    }).catch(function () { cb({ netError: true }); });
  }

  function toast(msg, isErr) {
    var t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = isErr ? 'err' : 'ok';
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.className = ''; }, 3500);
  }

  /* ---- RENDER ---- */
  function render() {
    if (!box) return;
    var secCounts = { PENDING: 0, CONFIRMED: 0, COMPLETED: 0, CANCELLED: 0 };
    orders.forEach(function (o) { var s = secOf(o); secCounts[s] = (secCounts[s] || 0) + 1; });

    var filtered = orders.filter(function (o) {
      if (secOf(o) !== filter) return false;
      if (searchQ) {
        var q = searchQ.toLowerCase();
        return ((o.id || '') + ' ' + (o.name || '') + ' ' + (o.phone || '') + ' ' + (o.city || '') + ' ' + (o.address || '')).toLowerCase().indexOf(q) !== -1;
      }
      return true;
    });

    var html = '<div style="display:flex;align-items:center;gap:12px;padding:14px 0;flex-wrap:wrap">' +
      '<h3 style="flex:1;margin:0">Orders <span style="color:var(--muted);font-size:13px">' + orders.length + ' total</span></h3>' +
      '<button class="btn small ghost" id="ordRefresh" type="button" style="font-size:18px;line-height:1" title="Refresh">&#8635;</button>' +
      '</div>';

    /* Status filter buttons */
    html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">';
    ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].forEach(function (s) {
      var on = filter === s;
      html += '<button data-osec="' + s + '" style="padding:6px 14px;border-radius:20px;border:1px solid ' + (on ? SEC_CLR[s] : 'var(--line)') + ';background:' + (on ? SEC_BG[s] : 'var(--panel2)') + ';color:' + (on ? SEC_CLR[s] : 'var(--muted)') + ';font-size:12px;font-weight:700;cursor:pointer;transition:all .15s">' +
        SEC_TXT[s] + ' <span style="opacity:.7">' + (secCounts[s] || 0) + '</span></button>';
    });
    html += '</div>';

    /* Search */
    html += '<input type="text" id="ordSearch" placeholder="Search ID, name, phone\u2026" value="' + esc(searchQ) + '" style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text);font-size:13px;margin-bottom:14px;box-sizing:border-box">';

    if (!filtered.length) {
      html += '<div style="text-align:center;padding:40px;color:var(--muted)"><div style="font-size:36px;margin-bottom:8px">&#128230;</div>No ' + filter.toLowerCase() + ' orders.</div>';
      box.innerHTML = html;
      bindEvents();
      return;
    }

    /* Order cards */
    filtered.forEach(function (o) {
      var sec = secOf(o);
      var items = (o.items || []).map(function (it) {
        return '<tr><td>' + esc(it.name) + ' ' + esc(it.size) + '</td><td style="text-align:center">' + it.qty + '</td><td style="text-align:right">' + money(it.lineTotal) + '</td></tr>';
      }).join('');

      var actions = '';
      if (sec === 'PENDING') {
        actions = '<button data-confirm="' + esc(o.id) + '" style="padding:7px 16px;border-radius:8px;border:0;cursor:pointer;font-size:12px;font-weight:700;background:#35E0A1;color:#000">Confirm</button>' +
          '<button data-cancel="' + esc(o.id) + '" style="padding:7px 16px;border-radius:8px;border:1px solid rgba(255,92,122,.3);cursor:pointer;font-size:12px;font-weight:700;background:rgba(255,92,122,.12);color:#FF5C7A">Reject</button>';
      } else if (sec === 'CONFIRMED') {
        actions = '<button data-complete="' + esc(o.id) + '" style="padding:7px 16px;border-radius:8px;border:0;cursor:pointer;font-size:12px;font-weight:700;background:#38D9FF;color:#000">Complete</button>' +
          '<button data-cancel="' + esc(o.id) + '" style="padding:7px 16px;border-radius:8px;border:1px solid rgba(255,92,122,.3);cursor:pointer;font-size:12px;font-weight:700;background:rgba(255,92,122,.12);color:#FF5C7A">Cancel</button>';
      } else if (sec === 'COMPLETED') {
        actions = '<span style="color:#35E0A1;font-size:12px;font-weight:600">&#10003; Sale recorded</span>';
      } else {
        actions = '<button data-revert="' + esc(o.id) + '" style="padding:7px 16px;border-radius:8px;border:1px solid rgba(56,217,255,.3);cursor:pointer;font-size:12px;font-weight:700;background:rgba(56,217,255,.12);color:#38D9FF">Revert to Pending</button>' +
          (o.rejectReason ? '<span style="color:#FF5C7A;font-size:12px;margin-left:8px">Reason: ' + esc(o.rejectReason) + '</span>' : '');
      }

      html += '<div class="ord-card" data-oid="' + esc(o.id) + '" style="background:' + SEC_BG[sec] + ';border-left:4px solid ' + SEC_CLR[sec] + ';border-radius:12px;padding:12px 14px;margin-bottom:8px;transition:all .2s">' +
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;cursor:pointer" class="ord-head">' +
        '<b style="font-size:15px">#' + esc(o.id) + '</b>' +
        '<span style="padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:' + (SEC_BG[sec]) + ';color:' + SEC_CLR[sec] + ';border:1px solid ' + SEC_CLR[sec] + '33">' + SEC_TXT[sec] + '</span>' +
        '<span style="flex:1;color:var(--text);font-weight:600">' + esc(o.name) + '</span>' +
        '<span style="color:var(--acc);font-size:13px;font-weight:600">' + esc(o.phone) + '</span>' +
        '<span style="color:var(--muted);font-size:12px">' + fmtDate(o.createdAt) + '</span>' +
        '<b style="color:var(--ok);font-size:16px">' + money(o.total) + '</b>' +
        '</div>' +
        '<div class="ord-body" style="margin-top:10px;border-top:1px solid var(--line);padding-top:10px">' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">' +
        '<div><div style="color:var(--muted);font-size:11px;text-transform:uppercase">Address</div><div style="font-size:13px">' + esc(o.address) + ', ' + esc(o.city) + ' ' + esc(o.pincode) + '</div></div>' +
        '<div><div style="color:var(--muted);font-size:11px;text-transform:uppercase">Payment</div><div style="font-size:13px">' + esc(o.type || 'COD') + '</div></div>' +
        (o.note ? '<div style="grid-column:1/-1"><div style="color:var(--muted);font-size:11px;text-transform:uppercase">Note</div><div style="font-size:13px">' + esc(o.note) + '</div></div>' : '') +
        '</div>' +
        '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:10px"><thead><tr style="color:var(--muted);font-size:11px;text-transform:uppercase"><th style="text-align:left;padding:4px 0">Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Total</th></tr></thead><tbody>' + items + '</tbody></table>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' + actions + '</div>' +
        '</div></div>';
    });

    box.innerHTML = html;
    bindEvents();
  }

  function bindEvents() {
    if (!box) return;
    box.querySelectorAll('[data-osec]').forEach(function (b) {
      b.addEventListener('click', function () { filter = b.getAttribute('data-osec'); render(); });
    });
    box.querySelectorAll('[data-confirm]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); setStatus(b.getAttribute('data-confirm'), 'confirmed'); });
    });
    box.querySelectorAll('[data-complete]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); setStatus(b.getAttribute('data-complete'), 'completed'); });
    });
    box.querySelectorAll('[data-cancel]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); if (confirm('Cancel this order?')) setStatus(b.getAttribute('data-cancel'), 'cancelled'); });
    });
    box.querySelectorAll('[data-revert]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); if (confirm('Revert this cancelled order back to pending?')) setStatus(b.getAttribute('data-revert'), 'received'); });
    });
    var refresh = $('ordRefresh');
    if (refresh) refresh.addEventListener('click', loadOrders);
    var search = $('ordSearch');
    if (search) search.addEventListener('input', function () { searchQ = search.value; render(); });
  }

  function setStatus(id, status) {
    apiFetch('/api/admin/orders/status', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id, status: status })
    }, function (d) {
      if (d && d.ok) {
        var lbl = status === 'completed' ? 'Completed' : (status === 'cancelled' ? 'Cancelled' : 'Confirmed');
        toast('#' + id + ' \u2192 ' + lbl);
        for (var i = 0; i < orders.length; i++) {
          if (orders[i].id === id) {
            orders[i].status = status;
            if (!orders[i].statusHistory) orders[i].statusHistory = [];
            orders[i].statusHistory.push({ status: status, at: Date.now() });
            break;
          }
        }
        render();
      } else if (d && d.needLogin) {
        toast('Session expired — refresh page', true);
      } else {
        toast((d && d.error) || 'Failed', true);
      }
    });
  }

  function loadOrders() {
    apiFetch('/api/admin/orders', {}, function (d) {
      if (d && d.needLogin) { toast('Session expired', true); return; }
      if (d && d.ok && Array.isArray(d.orders)) {
        var oldCount = orders.length;
        orders = d.orders;
        if (oldCount && orders.length > oldCount) {
          var newest = orders[0];
          toast('New order! #' + newest.id + ' from ' + newest.name);
          try { navigator.vibrate && navigator.vibrate(200); } catch (e) {}
        }
        render();
      }
    });
  }

  /* ---- PUBLIC API ---- */
  window.RWOrders = {
    init: function (container) {
      box = container;
      loadOrders();
      clearInterval(refreshTimer);
      refreshTimer = setInterval(loadOrders, 8000);
    },
    stop: function () {
      clearInterval(refreshTimer);
    },
    getCounts: function () {
      var c = { PENDING: 0, CONFIRMED: 0, COMPLETED: 0, CANCELLED: 0, total: orders.length };
      orders.forEach(function (o) { var s = secOf(o); c[s] = (c[s] || 0) + 1; });
      return c;
    }
  };
})();
