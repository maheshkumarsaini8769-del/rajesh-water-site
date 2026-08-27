/* ============================================================
   Rajesh Water — Inventory & Sales management (admin business module)
   Loaded by admin.html. All data lives in data/business.json
   (saved through server.js /api/biz, localStorage fallback).
   Every number is computed from recorded transactions only.
   ============================================================ */
(function () {
  "use strict";

  /* ---------------- state ---------------- */
  var S = {
    settings: { bizName: 'Rajesh Water', minStock: 15, initialCapital: 0 },
    products: [],
    purchases: [],
    sales: [],
    adjustments: [],
    pendingOrders: [],
    loaded: false
  };
  var tab = 'biz-dash';
  var saving = false;
  var apiOk = false;
  var LS_KEY = 'rw_biz_fallback';

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var toast = function (m, isErr) { if (window.RW && window.RW.toast) window.RW.toast(m, isErr); };

  var fmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
  function money(n) { return '\u20B9' + fmt.format(Math.round(Number(n) || 0)); }
  function num(n) { n = Number(n); return isFinite(n) ? n : 0; }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  /* ---------------- dates ---------------- */
  function dateKey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function todayKey() { return dateKey(new Date()); }
  function addDays(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }
  function startOfWeek(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); var wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return x; }
  function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function inRange(k, f, t) { return k >= f && k <= t; }
  function shortDate(k) { var p = String(k).split('-'); return p.length === 3 ? p[2] + '/' + p[1] : k; }
  function prettyDate(k) {
    var p = String(k).split('-');
    if (p.length !== 3) return k;
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return p[2] + ' ' + months[(Number(p[1]) || 1) - 1] + ' ' + p[0];
  }

  /* ---------------- product helpers ---------------- */
  function productById(id) {
    for (var i = 0; i < S.products.length; i++) if (S.products[i].id === id) return S.products[i];
    return null;
  }
  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim(); }
  /* match a website order line (label like "Kinley 1 LITRE") to an inventory product */
  function matchProduct(name, size) {
    var n = norm(name), sz = norm(size);
    for (var i = 0; i < S.products.length; i++) {
      var p = S.products[i];
      var pn = norm(p.name), ps = norm(p.size);
      if (sz && ps && n === (pn + ' ' + ps)) return p;
      if (sz && ps && n === (ps + ' ' + pn)) return p;
      if (n === pn) return p;
    }
    for (var j = 0; j < S.products.length; j++) {
      var q = S.products[j];
      var qn = norm(q.name);
      if (qn && n && n.indexOf(qn) !== -1) return q;
    }
    return null;
  }

  /* ---------------- stock engine (replay from transactions) ---------------- */
  function boxBottles(p) { return Math.max(1, num(p.bottlesPerBox) || 12); }
  function stockInBottles(p) { return num(p.stockBottles); }
  function stockBoxes(p) { return Math.floor(stockInBottles(p) / boxBottles(p)); }
  function stockLoose(p) { return stockInBottles(p) - stockBoxes(p) * boxBottles(p); }
  function purchasedBoxes(p) {
    var t = 0;
    (S.purchases || []).forEach(function (r) { if (r && r.productId === p.id) t += num(r.boxes); });
    return t;
  }
  function stockStatus(p, minStock) {
    var b = stockInBottles(p);
    var bought = purchasedBoxes(p);
    if (bought <= 0) return 'none';
    if (b <= 0) return 'out';
    if (b < Math.max(1, num(minStock) || 0) * boxBottles(p)) return 'low';
    return 'ok';
  }
  function replayStock(products, purchases, sales, adjustments) {
    var map = {};
    products.forEach(function (p) { map[p.id] = 0; });
    (purchases || []).forEach(function (r) {
      if (!r || r.cancelled || map[r.productId] == null) return;
      map[r.productId] += Math.max(0, num(r.boxes)) * Math.max(1, num(r.bottlesPerBox) || 12);
    });
    (sales || []).forEach(function (r) {
      if (!r || r.status === 'cancelled' || map[r.productId] == null) return;
      map[r.productId] -= Math.max(0, num(r.boxes)) * Math.max(1, num(r.bottlesPerBox) || 12) + Math.max(0, num(r.bottles));
    });
    (adjustments || []).forEach(function (r) {
      if (!r || map[r.productId] == null) return;
      var q = Math.max(0, num(r.qty)) * (r.unit === 'box' ? Math.max(1, num(r.bottlesPerBox) || 12) : 1);
      map[r.productId] -= q;
    });
    products.forEach(function (p) {
      map[p.id] = Math.max(0, Math.round(map[p.id]));
      if (p.stockBottles !== map[p.id]) p.stockBottles = map[p.id];
    });
    return products;
  }

  /* ---------------- KPI (from completed sales) ---------------- */
  function kpiOf(sales) {
    var k = { sales: 0, online: 0, cash: 0, cogs: 0, profit: 0, orders: 0, boxes: 0, bottles: 0, products: 0 };
    var seen = {};
    (sales || []).forEach(function (r) {
      if (!r || r.status === 'cancelled') return;
      k.sales += num(r.total); k.cogs += num(r.cost); k.profit += num(r.profit);
      if (r.payment === 'cash') k.cash += num(r.total); else k.online += num(r.total);
      k.orders++;
      k.boxes += num(r.boxes);
      k.bottles += num(r.bottles);
      if (r.productId) seen[r.productId] = 1;
    });
    k.products = Object.keys(seen).length;
    return k;
  }
  function salesInRange(sales, from, to) {
    var out = [];
    (sales || []).forEach(function (r) {
      if (!r || r.status === 'cancelled') return;
      if (inRange(String(r.date || ''), from, to)) out.push(r);
    });
    return out;
  }

  /* ---------------- load / save ---------------- */
  function seedFromCatalog() {
    var out = [];
    try {
      if (window.SITE_DATA && window.SITE_DATA.products) {
        window.SITE_DATA.products.forEach(function (p) {
          if (!p || !p.name) return;
          out.push({
            id: p.id || ('bp' + Math.random().toString(36).slice(2, 8)),
            name: p.name, brand: '', category: p.category || '',
            size: p.size || '', bottlesPerBox: num(p.boxSize) || 12,
            price: num(p.price), cost: num(p.price), minStock: num(S.settings.minStock) || 15,
            stockBottles: 0
          });
        });
      }
    } catch (e) {}
    return out;
  }
  function loadLocal() {
    try { var raw = localStorage.getItem(LS_KEY); if (raw) { var d = JSON.parse(raw); if (d && Array.isArray(d.products)) { S = d; S.loaded = true; return true; } } } catch (e) {}
    return false;
  }
  function mergeLocalIntoServer() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return false;
      var loc = JSON.parse(raw);
      if (!loc || !Array.isArray(loc.products)) return false;
      var merged = 0;
      function gap(list, local, idFn) {
        (local || []).forEach(function (r) {
          if (!r || !r.id) return;
          var exists = (list || []).some(function (x) { return x.id === r.id; });
          if (!exists) { list.push(r); merged++; }
        });
      }
      gap(S.purchases, loc.purchases);
      gap(S.sales, loc.sales);
      gap(S.adjustments, loc.adjustments);
      gap(S.pendingOrders, loc.pendingOrders);
      if (merged) {
        replayStock(S.products, S.purchases, S.sales, S.adjustments);
        saveBiz(true);
        localStorage.removeItem(LS_KEY);
        return true;
      }
    } catch (e) {}
    return false;
  }
  function load(cb) {
    if (window.fetch) {
      fetch('/api/biz').then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (d && Array.isArray(d.products)) {
            S = d; S.loaded = true; apiOk = true;
            if (!S.settings) S.settings = { bizName: 'Rajesh Water', minStock: 15, initialCapital: 0 };
            if (!S.settings.seeded) { S.products = seedFromCatalog(); S.settings.seeded = true; saveBiz(true); }
            replayStock(S.products, S.purchases, S.sales, S.adjustments);
            if (mergeLocalIntoServer()) { cb && cb(); toast('Browser ki purani entries server data me merge kar di. \u2713'); return; }
          } else if (!loadLocal()) { seedAndSave(); }
          cb && cb();
        })
        .catch(function () {
          apiOk = false;
          if (!loadLocal()) { seedAndSave(); }
          cb && cb();
        });
    } else {
      if (!loadLocal()) seedAndSave();
      cb && cb();
    }
  }
  function seedAndSave() {
    S.products = seedFromCatalog();
    S.settings.seeded = true;
    S.loaded = true;
    saveBiz(false);
  }
  /* Re-fetch business data from the server so Today's earning / sale list
     update right after an online order is completed (not just orders list). */
  function reloadBizData(cb) {
    if (window.fetch) {
      var prevOrdSection = S._ordSection;
      var prevOrdSearch = S._ordSearch;
      fetch('/api/biz').then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (d && Array.isArray(d.products)) {
            S = d; S.loaded = true; apiOk = true;
            S._ordSection = prevOrdSection;
            S._ordSearch = prevOrdSearch;
            if (!S.settings) S.settings = { bizName: 'Rajesh Water', minStock: 15, initialCapital: 0 };
            replayStock(S.products, S.purchases, S.sales, S.adjustments);
          }
          cb && cb();
        })
        .catch(function () { cb && cb(); });
    } else { cb && cb(); }
  }
  function saveBiz(silent) {
    if (saving) return;
    saving = true;
    try {
      var doc = JSON.parse(JSON.stringify(S));
      if (window.fetch) {
        fetch('/api/biz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(doc)
        }).then(function (r) { apiOk = r.ok; if (!apiOk) saveLocal(doc); })
          .catch(function () { apiOk = false; saveLocal(doc); })
          .then(function () { saving = false; if (!silent) toast(apiOk ? 'Saved to business data. \u2713' : 'Server unavailable — saved to this browser only.'); });
      } else {
        saveLocal(doc);
        saving = false;
        if (!silent) toast('Server unavailable — saved to this browser only.');
      }
    } catch (e) { saving = false; }
  }
  function saveLocal(doc) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(doc)); } catch (e) {}
  }

  /* ---------------- actions ---------------- */
  function uid(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function todayIso() { return todayKey(); }
  function timeOf(r) {
    var t = r.at || Date.now();
    var d = new Date(t);
    var h = d.getHours(), m = d.getMinutes();
    var ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ap;
  }

  function addProduct(data) {
    var p = {
      id: uid('bp'), name: String(data.name || '').trim(), brand: String(data.brand || '').trim(),
      category: String(data.category || '').trim(), size: String(data.size || '').trim(),
      bottlesPerBox: Math.max(1, num(data.bottlesPerBox) || 12),
      price: Math.max(0, num(data.price)), cost: Math.max(0, num(data.cost)),
      minStock: Math.max(0, num(data.minStock) || 15), stockBottles: 0
    };
    S.products.push(p);
    return p;
  }
  function updateProduct(id, data) {
    var p = productById(id);
    if (!p) return null;
    if (data.name != null) p.name = String(data.name).trim();
    if (data.brand != null) p.brand = String(data.brand).trim();
    if (data.category != null) p.category = String(data.category).trim();
    if (data.size != null) p.size = String(data.size).trim();
    if (data.bottlesPerBox != null) p.bottlesPerBox = Math.max(1, num(data.bottlesPerBox) || 12);
    if (data.price != null) p.price = Math.max(0, num(data.price));
    if (data.cost != null) p.cost = Math.max(0, num(data.cost));
    if (data.minStock != null) p.minStock = Math.max(0, num(data.minStock));
    return p;
  }
  function addPurchase(data) {
    var p = productById(data.productId);
    if (!p) return null;
    var boxes = Math.max(1, Math.round(num(data.boxes)));
    var cpb = Math.max(0, num(data.costPerBox));
    var total = boxes * cpb;
    var paidIn = data.paid;
      var recPaid = (paidIn === undefined || paidIn === null || paidIn === '') ? total : Math.max(0, Math.min(num(paidIn), total));
      var rec = {
      id: uid('pu'), date: data.date || todayIso(), productId: p.id, product: p.name,
      boxes: boxes, costPerBox: cpb, total: total,
      payment: data.payment === 'online' ? 'online' : 'cash',
      paid: recPaid,
      supplier: String(data.supplier || '').trim(), notes: String(data.notes || '').trim(),
      bottlesPerBox: boxBottles(p), at: Date.now()
    };
    if (data.updateCost !== false && cpb > 0) p.cost = cpb;
    S.purchases.unshift(rec);
    return rec;
  }
  function addAdjustment(data) {
    var p = productById(data.productId);
    if (!p) return null;
    var q = Math.max(0, Math.round(num(data.qty)));
    var rec = {
      id: uid('ad'), date: data.date || todayIso(), productId: p.id, product: p.name,
      qty: q, unit: data.unit === 'box' ? 'box' : 'bottle',
      type: String(data.type || 'Manual correction').trim(),
      notes: String(data.notes || '').trim(), bottlesPerBox: boxBottles(p), at: Date.now()
    };
    S.adjustments.unshift(rec);
    replayStock(S.products, S.purchases, S.sales, S.adjustments);
    return rec;
  }
  function recordSale(o) {
    var p = productById(o.productId);
    if (!p) return null;
    var boxes = Math.max(0, Math.round(num(o.boxes)));
    var bottles = Math.max(0, Math.round(num(o.bottles)));
    var bpb = boxBottles(p);
    if (boxes === 0 && bottles === 0) return null;
    var need = boxes * bpb + bottles;
    if (need > stockInBottles(p)) return { error: 'Not enough stock for ' + p.name + ' (need ' + need + ' bottles, have ' + stockInBottles(p) + ')' };
    var ppb = Math.max(0, num(o.pricePerBox) || p.price);
    var total = boxes * ppb + bottles * (ppb / bpb);
    var cost = boxes * p.cost + bottles * (p.cost / bpb);
    var paidIn = o.paid;
      var recPaid = (paidIn === undefined || paidIn === null || paidIn === '') ? total : Math.max(0, Math.min(num(paidIn), total));
      var rec = {
      id: uid('sl'), date: o.date || todayIso(), ref: o.ref || (uid('SL-').toUpperCase()),
      customer: String(o.customer || '').trim(), phone: String(o.phone || '').trim(),
      productId: p.id, product: p.name, size: p.size,
      boxes: boxes, bottles: bottles, bottlesPerBox: bpb,
      pricePerBox: ppb, total: total, cost: cost, profit: total - cost,
      payment: o.payment === 'cash' ? 'cash' : 'online',
      paid: recPaid,
      status: 'completed', source: o.source || 'manual',
      notes: String(o.notes || '').trim(), at: Date.now()
    };
    S.sales.unshift(rec);
    replayStock(S.products, S.purchases, S.sales, S.adjustments);
    return rec;
  }
  function paidOf(r) {
    if (!r) return 0;
    var v = r.paid;
    if (v === undefined || v === null || v === '') return num(r.total);
    return Math.max(0, Math.min(num(v), num(r.total)));
  }
  function pendingOf(r) { return Math.max(0, num(r.total) - paidOf(r)); }
  function payStatus(r) {
    if (r && r.status === 'cancelled') return '<span class="badge err">Cancelled</span>';
    return pendingOf(r) <= 0 ? '<span class="badge ok">Paid</span>' : '<span class="badge warn">Pending</span>';
  }
  function updatePayment(kind, id, paid) {
    var list = kind === 'purchase' ? S.purchases : S.sales;
    var r = null;
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) { r = list[i]; break; } }
    if (!r) return false;
    r.paid = Math.max(0, Math.min(num(paid), num(r.total)));
    if (kind !== 'purchase' && r.paid >= num(r.total)) r.status = 'completed';
    saveBiz();
    return true;
  }
  function paymentModal(kind, id) {
    var list = kind === 'purchase' ? S.purchases : S.sales;
    var r = null;
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) { r = list[i]; break; } }
    if (!r) return;
    var paid = paidOf(r), pending = pendingOf(r);
    var who = kind === 'purchase' ? esc(r.supplier || r.product) : esc(r.customer || r.product);
    var html = '<div class="modal-back" id="modalBack"><div class="modal modal-wrap" style="max-width:420px">' +
      '<button class="modal-close" id="modalClose">\u2715</button>' +
      '<h3>' + (kind === 'purchase' ? 'Purchase Payment' : 'Sale Payment') + '</h3>' +
      '<div class="hint">' + esc(r.product) + (r.size ? ' ' + esc(r.size) : '') + ' \u00B7 ' + who + '</div>' +
      '<div class="detail-dl">' +
      '<dt>Total amount</dt><dd class="money-cell">' + money(r.total) + '</dd>' +
      '<dt>Already received / paid</dt><dd class="money-cell">' + money(paid) + '</dd>' +
      '<dt>Pending</dt><dd class="money-cell" style="color:var(--warn)">' + money(pending) + '</dd>' +
      '<dt>Payment type</dt><dd><span class="badge ' + (r.payment === 'cash' ? 'ok' : 'blu') + '">' + (r.payment === 'cash' ? 'Cash' : 'Online') + '</span></dd>' +
      '</div>' +
      '<div class="field" style="margin-top:8px"><label>Amount abhi receive/paid hua (₹)</label>' +
      '<input type="number" id="pmPaid" min="0" step="1" value="' + paid + '" style="width:100%"></div>' +
      '<div class="hint" style="margin:6px 0">Pending auto = Total \u2212 Paid. Poora amount aa jaye to status <b>Paid / Complete</b> ho jayega.</div>' +
      '<div class="row" style="margin-bottom:10px;gap:8px;flex-wrap:wrap">' +
      '<button class="btn small ghost" id="pmFull" type="button">Full Amount</button>' +
      '<button class="btn small ghost" id="pmZero" type="button">Reset to 0</button></div>' +
      '<div class="modal-foot"><button class="btn ghost" id="modalClose2" type="button">Cancel</button>' +
      '<button class="btn" id="pmSave" type="button">Save Payment</button></div>' +
      '</div></div>';
    showModal(html, function () {
      var inp = $('pmPaid');
      if ($('pmFull')) $('pmFull').onclick = function () { if (inp) inp.value = num(r.total); };
      if ($('pmZero')) $('pmZero').onclick = function () { if (inp) inp.value = 0; };
      $('pmSave').onclick = function () {
        var v = num(inp ? inp.value : 0);
        updatePayment(kind, id, v);
        closeModal();
        toast('Payment updated: Paid ' + money(Math.min(v, num(r.total))) + ', Pending ' + money(Math.max(0, num(r.total) - v)) + '.');
        render();
      };
    });
  }
  function cancelSale(id) {
    var r = null;
    for (var i = 0; i < S.sales.length; i++) if (S.sales[i].id === id) { r = S.sales[i]; break; }
    if (!r) return false;
    r.status = 'cancelled';
    replayStock(S.products, S.purchases, S.sales, S.adjustments);
    return true;
  }
  function confirmOrder(id) {
    var o = null;
    for (var i = 0; i < S.pendingOrders.length; i++) if (S.pendingOrders[i].id === id) { o = S.pendingOrders[i]; break; }
    if (!o) return false;
    var created = 0, skipped = [], errors = [];
    (o.items || []).forEach(function (it) {
      var p = matchProduct(it.name, it.size);
      if (!p) { skipped.push(it.name || it.size || 'item'); return; }
      var res = recordSale({
        productId: p.id, boxes: it.boxes, bottles: it.bottles,
        pricePerBox: it.pricePerBox || p.price, customer: o.customer,
        phone: o.phone, date: String(o.date || '').slice(0, 10),
        ref: o.ref, payment: 'online', source: 'website', notes: it.size ? (it.name + ' ' + it.size) : it.name
      });
      if (res && res.error) { errors.push(res.error); return; }
      if (res) created++;
    });
    var idx = S.pendingOrders.indexOf(o);
    if (idx >= 0) S.pendingOrders.splice(idx, 1);
    replayStock(S.products, S.purchases, S.sales, S.adjustments);
    return { created: created, skipped: skipped, errors: errors };
  }
  function cancelOrder(id) {
    for (var i = 0; i < S.pendingOrders.length; i++) if (S.pendingOrders[i].id === id) { S.pendingOrders.splice(i, 1); return true; }
    return false;
  }

  /* ---------------- customers (derived from sales) ---------------- */
  function customersOf() {
    var map = {};
    S.sales.forEach(function (r) {
      if (r.status === 'cancelled' || !r.customer) return;
      var key = (r.customer + '|' + (r.phone || '')).toLowerCase();
      if (!map[key]) map[key] = { name: r.customer, phone: r.phone || '', orders: 0, total: 0, last: '' };
      map[key].orders++;
      map[key].total += num(r.total);
      if (String(r.date) > map[key].last) map[key].last = String(r.date);
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }
  function suppliersOf() {
    var map = {};
    S.purchases.forEach(function (r) {
      if (!r.supplier) return;
      var key = String(r.supplier).toLowerCase();
      if (!map[key]) map[key] = { name: r.supplier, phone: '', orders: 0, total: 0, last: '' };
      map[key].orders++;
      map[key].total += num(r.total);
      if (String(r.date) > map[key].last) map[key].last = String(r.date);
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }
  function custRecords(kind) {
    if (kind === 'purchase') return S.purchases.filter(function (r) { return r && String(r.supplier || '').trim(); });
    return S.sales.filter(function (r) { return r && r.status !== 'cancelled' && String(r.customer || '').trim(); });
  }
  function custDateFrom(period) {
    if (period === 'today') return todayKey();
    if (period === '7d') return dateKey(addDays(new Date(), -6));
    if (period === 'month') return dateKey(startOfMonth(new Date()));
    return '0000-00-00';
  }
  function custInPeriod(r, period) {
    return String(r.date) >= custDateFrom(period);
  }
  function custAgg(list, period) {
    var o = { orders: 0, boxes: 0, bottles: 0, amount: 0, paid: 0, pending: 0, products: {} };
    list.forEach(function (r) {
      if (!custInPeriod(r, period)) return;
      o.orders++;
      o.boxes += num(r.boxes);
      o.bottles += num(r.bottles);
      o.amount += num(r.total);
      o.paid += paidOf(r);
      o.pending += pendingOf(r);
      var key = (r.product || '') + '|' + (r.size || '');
      if (!o.products[key]) o.products[key] = { product: r.product || '?', size: r.size || '', boxes: 0, bottles: 0, amount: 0 };
      var pr = o.products[key];
      pr.boxes += num(r.boxes);
      pr.bottles += num(r.bottles);
      pr.amount += num(r.total);
    });
    return o;
  }
  /* main-search integration: same customer + same day => ONE list entry;
     matches customer name OR bottle/product name (customer ke naam + bottle dono se find hota hai) */
  function customerSearch(q, kindFilter) {
    var out = [];
    if (!S.loaded) return out;
    var kw = String(q || '').trim().toLowerCase();
    if (!kw) return out;
    function walk(kind, recs, nameField) {
      var seen = {};
      recs.forEach(function (r) {
        var name = String(r[nameField] || '').trim();
        if (!name) return;
        var prod = String(r.product || '').trim() + (r.size ? ' ' + String(r.size).trim() : '');
        var nameHit = name.toLowerCase().indexOf(kw) !== -1;
        var prodHit = prod.toLowerCase().indexOf(kw) !== -1;
        if (!nameHit && !prodHit) return;
        var key = name + '|' + r.date;
        var g = seen[key];
        if (!g) {
          g = seen[key] = { name: name, kind: kind, date: r.date, orders: 0, boxes: 0, bottles: 0, amount: 0, paid: 0, pending: 0, nameHit: !!nameHit, products: {} };
          out.push(g);
        }
        if (nameHit) g.nameHit = true;
        if (prodHit) {
          var pk = (r.product || '') + '|' + (r.size || '');
          if (g.products[pk] === undefined) g.products[pk] = prod;
        }
        g.orders++;
        g.boxes += num(r.boxes);
        g.bottles += num(r.bottles);
        g.amount += num(r.total);
        g.paid += paidOf(r);
        g.pending += pendingOf(r);
      });
    }
    if (!kindFilter || kindFilter === 'sell') walk('sell', S.sales.filter(function (r) { return r.status !== 'cancelled'; }), 'customer');
    if (!kindFilter || kindFilter === 'purchase') walk('purchase', S.purchases, 'supplier');
    out.sort(function (a, b) {
      if (a.nameHit !== b.nameHit) return a.nameHit ? -1 : 1;
      return String(b.date).localeCompare(String(a.date));
    });
    return out.slice(0, 12);
  }
  function openCustomerDashboard(name, kind, date) {
    S._custOpen = { name: name, kind: kind, date: date || null, period: S._custPeriod || '7d', day: null };
    goto('biz-customers');
  }
  function boxesBreakModal(name, kind, period, dateOnly) {
    var list = custRecords(kind).filter(function (r) {
      var who = kind === 'purchase' ? r.supplier : r.customer;
      if (String(who || '').trim() !== name) return false;
      if (!custInPeriod(r, period)) return false;
      if (dateOnly && String(r.date) !== dateOnly) return false;
      return true;
    });
    var agg = custAgg(list, period);
    var keys = Object.keys(agg.products).sort(function (a, b) { return agg.products[b].boxes - agg.products[a].boxes; });
    var html = '<div class="modal-back" id="modalBack"><div class="modal modal-wrap">' +
      '<button class="modal-close" id="modalClose">\u2715</button>' +
      '<h3>Bottle-wise Boxes</h3>' +
      '<div class="hint">' + esc(name) + ' \u00B7 ' + (kind === 'purchase' ? 'Purchase' : 'Sell') + ' \u00B7 ' + (dateOnly ? prettyDate(dateOnly) : periodLabel(period)) + '</div>' +
      '<div class="htable-wrap" style="margin-top:10px"><table class="htable" style="min-width:380px"><thead><tr>' +
      '<th>#</th><th>Bottle / Product</th><th>Side</th><th>Boxes</th><th>Loose</th><th class="money-cell">Amount</th></tr></thead><tbody>';
    keys.forEach(function (k, i) {
      var pr = agg.products[k];
      html += '<tr><td class="row-num">' + (i + 1) + '</td><td><b>' + esc(pr.product) + '</b></td><td>' + esc(pr.size || '—') + '</td>' +
        '<td><b>' + pr.boxes + '</b></td><td>' + (pr.bottles || '—') + '</td><td class="money-cell">' + money(pr.amount) + '</td></tr>';
    });
    if (!keys.length) html += '<tr><td colspan="6" class="hint">No boxes in this period.</td></tr>';
    html += '</tbody></table></div><div class="modal-foot"><button class="btn ghost" id="modalClose2">Close</button></div></div></div>';
    showModal(html);
  }
  function periodLabel(period) {
    if (period === 'today') return 'Today';
    if (period === '7d') return 'Last 7 days';
    if (period === 'month') return 'This month';
    return 'All time';
  }
  /* customer/supplier name -> clickable link that opens that person's report dashboard */
  function custLink(name, kind, date) {
    name = String(name || '').trim();
    if (!name) return '<span class="muted">—</span>';
    return '<button type="button" class="custlink" data-custopen="' + esc(name) + '" data-custkind="' + kind + '" data-custdate="' + esc(String(date || '')) + '" title="' + (kind === 'purchase' ? 'Supplier' : 'Customer') + ' report">' + esc(name) + '</button>';
  }
  function wireCustOpen() {
    $('content').querySelectorAll('button[data-custopen]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        openCustomerDashboard(b.getAttribute('data-custopen'), b.getAttribute('data-custkind'), b.getAttribute('data-custdate'));
      });
    });
  }

  /* ---------------- charts (canvas, no libraries) ---------------- */
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  function setupCanvas(cv) {
    var dpr = window.devicePixelRatio || 1;
    var w = cv.parentNode ? cv.parentNode.clientWidth : 300;
    var h = cv.clientHeight || cv.getAttribute('data-h') || 220;
    cv.width = Math.max(10, w * dpr); cv.height = Math.max(10, h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx: ctx, w: w, h: h };
  }
  function barChart(cv, labels, values, color, opts) {
    opts = opts || {};
    var g = setupCanvas(cv), ctx = g.ctx, w = g.w, h = g.h;
    if (!values.length) { ctx.fillStyle = '#5E6B7D'; ctx.font = '12px Segoe UI'; ctx.fillText('No data yet', 12, h / 2); return; }
    var max = Math.max.apply(null, values.map(Math.abs)) || 1;
    var padL = 44, padB = 24, padT = 14, padR = 8;
    var cw = (w - padL - padR) / values.length;
    values.forEach(function (v, i) {
      var bh = Math.abs(v) / max * (h - padT - padB);
      var x = padL + i * cw + cw * 0.14, bw = cw * 0.72;
      var y = h - padB - bh;
      if (opts.stack2 && opts.values2) {
        var b2 = Math.abs(opts.values2[i]) / max * (h - padT - padB);
        ctx.fillStyle = opts.color2 || 'rgba(143,179,201,.4)';
        ctx.fillRect(x, h - padB - b2, bw, b2);
        bh = bh - b2;
        y = h - padB - b2 - bh;
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      rr(ctx, x, y, bw, Math.max(0, bh), 4);
      ctx.fill();
      ctx.fillStyle = '#7E8CA0'; ctx.font = '10px Segoe UI';
      ctx.textAlign = 'center';
      ctx.fillText(shortDate(labels[i]), x + bw / 2, h - 8);
      ctx.fillStyle = '#F4F8FC'; ctx.font = 'bold 9.5px Segoe UI';
      ctx.fillText(fmt.format(v), x + bw / 2, y - 3);
    });
  }
  function lineChart(cv, labels, values, color) {
    var g = setupCanvas(cv), ctx = g.ctx, w = g.w, h = g.h;
    if (!values.length) { ctx.fillStyle = '#5E6B7D'; ctx.font = '12px Segoe UI'; ctx.fillText('No data yet', 12, h / 2); return; }
    var max = Math.max.apply(null, values) || 1;
    var padL = 44, padB = 22, padT = 12, padR = 8;
    var cw = (w - padL - padR) / values.length;
    ctx.strokeStyle = 'rgba(143,179,201,.25)'; ctx.lineWidth = 1;
    for (var gv = 0; gv <= 4; gv++) {
      var gy = padT + (h - padT - padB) * gv / 4;
      ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(w - padR, gy); ctx.stroke();
      ctx.fillStyle = '#5E6B7D'; ctx.font = '9.5px Segoe UI'; ctx.textAlign = 'right';
      ctx.fillText(fmt.format(max * (1 - gv / 4)), padL - 4, gy + 3);
    }
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
    var lastX = null;
    values.forEach(function (v, i) {
      var x = padL + i * cw + cw / 2, y = padT + (1 - v / max) * (h - padT - padB);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      lastX = x;
    });
    ctx.stroke();
    ctx.fillStyle = color;
    values.forEach(function (v, i) {
      var x = padL + i * cw + cw / 2, y = padT + (1 - v / max) * (h - padT - padB);
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7E8CA0'; ctx.font = '10px Segoe UI'; ctx.textAlign = 'center';
      ctx.fillText(shortDate(labels[i]), x, h - 8);
    });
  }
  function donutChart(cv, items, colors, centerLabel) {
    var g = setupCanvas(cv), ctx = g.ctx, w = g.w, h = g.h;
    var total = items.reduce(function (a, b) { return a + b; }, 0);
    if (!total) { ctx.fillStyle = '#5E6B7D'; ctx.font = '12px Segoe UI'; ctx.fillText('No data yet', 12, h / 2); return; }
    var cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 12, r = R * 0.6;
    var a = -Math.PI / 2;
    items.forEach(function (v, i) {
      var ang = v / total * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R, a, a + ang);
      ctx.arc(cx, cy, r, a + ang, a, true);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      a += ang;
    });
    ctx.fillStyle = '#F4F8FC'; ctx.font = 'bold 13px Segoe UI'; ctx.textAlign = 'center';
    ctx.fillText(centerLabel || '', cx, cy - 2);
    ctx.fillStyle = '#5E6B7D'; ctx.font = '9.5px Segoe UI';
    ctx.fillText('total', cx, cy + 13);
  }
  function hbarChart(cv, labels, values, color) {
    var g = setupCanvas(cv), ctx = g.ctx, w = g.w, h = g.h;
    if (!values.length) { ctx.fillStyle = '#5E6B7D'; ctx.font = '12px Segoe UI'; ctx.fillText('No data yet', 12, h / 2); return; }
    var max = Math.max.apply(null, values) || 1;
    var rowH = Math.min(30, (h - 12) / values.length);
    var padL = 8, labW = Math.min(w * 0.42, 170);
    values.forEach(function (v, i) {
      var y = 8 + i * rowH;
      var bw = (w - padL - labW - 44) * v / max;
      ctx.fillStyle = '#7E8CA0'; ctx.font = '10px Segoe UI'; ctx.textAlign = 'left';
      ctx.fillText(String(labels[i]).slice(0, 22), padL, y + rowH / 2 + 3);
      ctx.fillStyle = color;
      ctx.beginPath();
      rr(ctx, padL + labW, y, Math.max(2, bw), rowH - 6, 4);
      ctx.fill();
      ctx.fillStyle = '#F4F8FC'; ctx.font = 'bold 10px Segoe UI'; ctx.textAlign = 'left';
      ctx.fillText(fmt.format(v), padL + labW + bw + 6, y + rowH / 2 + 3);
    });
  }

  /* ---------------- small UI pieces ---------------- */
  function kpiCard(label, value, note, cls, id) {
    return '<div class="kpi-card ' + (cls || '') + '"' + (id ? ' id="' + id + '"' : '') + (id ? ' style="cursor:pointer"' : '') + '><div class="k">' + label + '</div><div class="v">' + value + '</div>' + (note ? '<div class="n">' + note + '</div>' : '') + '</div>';
  }
  function statusBadge(p, minStock) {
    var st = stockStatus(p, minStock);
    if (st === 'out') return '<span class="badge err">Out of stock</span>';
    if (st === 'low') return '<span class="badge warn">Low stock</span>';
    if (st === 'none') return '<span class="badge gray">No stock yet</span>';
    return '<span class="badge ok">In stock</span>';
  }
  function productOption(p, selected) {
    return '<option value="' + esc(p.id) + '"' + (p.id === selected ? ' selected' : '') + '>' + esc(p.name) + (p.size ? ' ' + esc(p.size) : '') + ' (' + stockBoxes(p) + ' boxes)</option>';
  }
  function selectProducts(selected, first) {
    var out = '<option value="">' + esc(first || '— select product —') + '</option>';
    S.products.forEach(function (p) { out += productOption(p, selected); });
    return out;
  }
  function footerBtns(buttons) {
    var out = '';
    buttons.forEach(function (b) {
      out += '<button class="btn ' + (b.cls || '') + '" id="' + b.id + '" type="button"' + (b.danger ? ' style="background:linear-gradient(135deg,#FF5C7A,#8A2440)"' : '') + '>' + b.label + '</button>';
    });
    return out;
  }
  function goto(t) {
    tab = t;
    if (window.RW && window.RW.goto) window.RW.goto(t);
    else if (window.RW && window.RW.render) window.RW.render();
  }

  /* ---------------- search bar (desktop always visible / mobile icon-expand) ---------------- */
  function searchBarHtml(opts) {
    var v = esc(String(opts.q || ''));
    var type = opts.type || 'sell';
    return '<div class="rw-sbar" id="' + opts.id + 'Wrap">' +
      '<button type="button" class="btn small ghost rw-sicon" data-sicon="' + opts.id + '" title="Search">\uD83D\uDD0D</button>' +
      '<input type="text" class="searchin rw-search-in" id="' + opts.id + '" placeholder="' + esc(opts.placeholder || 'Search\u2026') + '" value="' + v + '">' +
      (opts.noType ? '' :
      '<select class="rw-type" id="' + opts.id + 'Type" title="Sell / Purchase">' +
      '<option value="sell"' + (type === 'sell' ? ' selected' : '') + '>Sell</option>' +
      '<option value="purchase"' + (type === 'purchase' ? ' selected' : '') + '>Purchase</option>' +
      '</select>') +
      '<button type="button" class="btn small ghost rw-x" data-x="' + opts.id + '" title="Close">\u2715</button>' +
      '</div>';
  }
  function wireSearchBar(id, onQuery, onType) {
    var inp = $(id);
    if (!inp) return;
    var wrap = $(id + 'Wrap');
    inp.addEventListener('input', function () { onQuery(inp.value); });
    if (wrap) {
      var ic = wrap.querySelector('[data-sicon="' + id + '"]');
      if (ic) ic.addEventListener('click', function () { wrap.classList.add('open'); inp.focus(); });
      var x = wrap.querySelector('[data-x="' + id + '"]');
      if (x) x.addEventListener('click', function () { wrap.classList.remove('open'); inp.value = ''; onQuery(''); });
    }
    inp.addEventListener('keydown', function (e) { if (e.key === 'Escape' && wrap) wrap.classList.remove('open'); });
    if (onType) {
      var sel = $(id + 'Type');
      if (sel) sel.addEventListener('change', function () { onType(sel.value, inp.value); });
    }
  }
  (function injectSearchCss() {
    var st = document.createElement('style');
    st.textContent = '.rw-sbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;flex:1;min-width:0}' +
      '.rw-sbar .rw-search-in{min-width:160px;flex:1}' +
      '.rw-sicon{display:none}.rw-x{display:none}' +
      '.hide-mob{display:none!important}' +
      '.row-num{font-weight:700;color:var(--acc);min-width:26px}' +
      '.rw-type{-webkit-appearance:none;-moz-appearance:none;appearance:none;background:var(--panel2);color:var(--text,#e8eef7);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:8px 12px;font-size:12.5px;font-weight:600;cursor:pointer;max-width:110px}' +
      '@media(min-width:721px){.hide-mob{display:table-cell}}' +
      '@media(max-width:720px){.rw-sicon{display:inline-flex}.rw-sbar .rw-search-in{display:none}' +
      '.rw-sbar.open .rw-search-in{display:inline-flex;min-width:0;flex:1}' +
      '.rw-sbar.open .rw-x{display:inline-flex}}';
    document.head.appendChild(st);
  })();

  /* ---------------- tab renderers ---------------- */
  function rDash() {
    var k = kpiOf(salesInRange(S.sales, todayKey(), todayKey()));
    var all = kpiOf(S.sales);
    var pendingN = (S.pendingOrders || []).length;
    var low = [], out = [];
    S.products.forEach(function (p) {
      var st = stockStatus(p, S.settings.minStock);
      if (st === 'out') out.push(p); else if (st === 'low') low.push(p);
    });
    var totalBoxes = 0, costVal = 0, sellVal = 0, purchVal = 0;
    S.products.forEach(function (p) {
      totalBoxes += stockBoxes(p);
      costVal += stockInBottles(p) * (num(p.cost) / boxBottles(p));
      sellVal += stockInBottles(p) * (num(p.price) / boxBottles(p));
    });
    S.purchases.forEach(function (r) { purchVal += num(r.total); });
    var invest = num(S.settings.initialCapital) + purchVal;

    var html = '';
    html += '<div class="quick" style="margin-bottom:18px">' +
      '<button class="btn" id="qaProduct">+ Add Product</button>' +
      '<button class="btn" id="qaStock">+ Add Stock</button>' +
      '<button class="btn" id="qaCash">Cash Sale</button>' +
      '<button class="btn" id="qaOnline">Online Sale</button>' +
      '<button class="btn ghost" id="qaInventory">View Inventory</button>' +
      '<button class="btn ghost" id="qaOrders">View Orders</button>' +
      '<button class="btn ghost" id="qaReports">View Reports</button>' +
      '</div>';

    var d7 = dateKey(addDays(new Date(), -6));
    var topP = null, topB = 0;
    S.sales.forEach(function (r) {
      if (r.status === 'cancelled' || r.date < d7) return;
      var p = productById(r.productId);
      var b = num(r.boxes) * (p ? boxBottles(p) : 1) + num(r.bottles);
      if (b > topB) { topB = b; topP = p; }
    });
    var bi = '';
    if (!S.sales.length) {
      bi = 'No sales recorded yet \u2014 analytics will activate as soon as the first sale is logged.';
    } else if (topP && stockInBottles(topP) > 0) {
      var days = Math.max(1, Math.round(stockInBottles(topP) / (topB / 7)));
      bi = '<b>' + esc(topP.name) + ' ' + esc(topP.size) + '</b> is the fastest mover this week (' + topB + ' bottles in 7 days). At the current selling rate, remaining stock of <b>' + stockBoxes(topP) + ' boxes</b> is expected to last approximately <b>' + days + ' day' + (days === 1 ? '' : 's') + '</b>.';
    } else if (topP) {
      bi = '<b>' + esc(topP.name) + '</b> is the fastest mover this week but is currently <b>out of stock</b> \u2014 restock soon to avoid losing sales.';
    } else {
      bi = 'No sales in the last 7 days \u2014 inventory is stable. Log a cash sale or confirm an online order to activate deeper insights.';
    }
    html += '<div class="bi-panel" id="biPanel"><span class="bi-go">Open Reports &rarr;</span>' +
      '<div class="bi-head"><span class="spark">&#10024;</span> Business Intelligence</div>' +
      '<div class="bi-text">' + bi + '</div>' +
      '<div class="bi-tags"><span class="bi-tag">Sales trend</span><span class="bi-tag purple">Analytics forecast</span>' +
      (out.length ? '<span class="bi-tag" style="border-color:rgba(255,92,122,.3);background:rgba(255,92,122,.08);color:var(--err)">Out of stock</span>' : (low.length ? '<span class="bi-tag" style="border-color:rgba(255,200,87,.28);background:rgba(255,200,87,.07);color:var(--warn)">Low stock</span>' : '')) +
      '</div></div>';

    html += '<div class="kpi">' +
      kpiCard('Today Sales', money(k.sales), 'Online ' + money(k.online) + ' + Cash ' + money(k.cash)) +
      kpiCard('Today Profit', money(k.profit), 'COGS ' + money(k.cogs), 'green') +
      kpiCard('Today Orders', k.orders, k.boxes + ' boxes · ' + k.bottles + ' loose bottles') +
      kpiCard('Total Stock', totalBoxes + ' boxes', money(costVal) + ' cost value', 'small') +
      kpiCard('Inventory Cost', money(costVal), 'what remaining stock cost') +
      kpiCard('Potential Selling', money(sellVal), 'expected profit ' + money(sellVal - costVal), 'green') +
      kpiCard('Total Investment', money(invest), 'capital + purchases') +
      kpiCard('All-Time Sales', money(all.sales), all.orders + ' orders · profit ' + money(all.profit)) +
      kpiCard('Pending Orders', pendingN, 'online orders waiting', pendingN ? 'yellow' : '') +
      kpiCard('Low Stock', low.length, 'below ' + num(S.settings.minStock) + ' boxes', low.length ? 'yellow' : '') +
      kpiCard('Out of Stock', out.length, 'need restock now', out.length ? 'red' : '') +
      '</div>';

    if (pendingN) {
      html += '<div class="card"><h3>New Online Orders <span class="pill warn" style="margin-left:8px">' + pendingN + ' pending</span></h3>' +
        '<div class="alert-item warn" data-open-orders="1"><span><b>' + pendingN + ' website order(s)</b> aaye hain — open karke <b>Confirm</b> karo, profit + stock sab automatically add ho jayega. Kaunse item ka stock hoga wo bhi yahan dikhega.</span><span class="badge warn">Check now</span></div>' +
        '</div>';
    }

    html += '<div class="card"><h3>Website Orders <span class="pill" id="webOrdBadge">\u2026</span></h3>' +
      '<div id="webOrdBody"><p class="hint">Loading website orders\u2026</p></div></div>';

    if (low.length || out.length) {
      html += '<div class="card"><h3>Stock Alerts <span class="pill ' + (out.length ? 'err' : 'warn') + '" style="margin-left:8px">' + (low.length + out.length) + ' alerts</span></h3>';
      low.forEach(function (p) {
        html += '<div class="alert-item warn" data-open-inv="' + p.id + '"><span><b>' + esc(p.name) + '</b> — only <b>' + stockBoxes(p) + ' boxes</b> left (' + stockInBottles(p) + ' bottles)</span><span class="badge warn">Low stock</span></div>';
      });
      out.forEach(function (p) {
        html += '<div class="alert-item err" data-open-inv="' + p.id + '"><span><b>' + esc(p.name) + '</b> is currently out of stock.</span><span class="badge err">Out of stock</span></div>';
      });
      html += '</div>';
    }

    html += '<div class="card"><h3>Today · This Week · This Month · All Time</h3><div class="periods">';
    periods().forEach(function (pr) {
      var pk = kpiOf(salesInRange(S.sales, pr.from, pr.to));
      html += '<div class="period-card"><h4>' + pr.label + '</h4>' +
        '<div class="row"><span>Sales</span><b>' + money(pk.sales) + '</b></div>' +
        '<div class="row"><span>Online</span><b>' + money(pk.online) + '</b></div>' +
        '<div class="row"><span>Cash</span><b>' + money(pk.cash) + '</b></div>' +
        '<div class="row"><span>COGS</span><b>' + money(pk.cogs) + '</b></div>' +
        '<div class="row"><span>Profit</span><b>' + money(pk.profit) + '</b></div>' +
        '<div class="row"><span>Orders</span><b>' + pk.orders + '</b></div>' +
        '<div class="row"><span>Boxes</span><b>' + pk.boxes + '</b></div>' +
        '</div>';
    });
    html += '</div></div>';

    html += '<div class="chart-row">' +
      '<div class="card"><h3>Sales — Last 14 Days</h3><div class="chart-box" id="cSalesBox"><canvas id="cSales"></canvas></div></div>' +
      '<div class="card"><h3>Payment Split</h3><div class="chart-box" id="cPayBox"><canvas id="cPay"></canvas></div></div>' +
      '<div class="card"><h3>Profit Trend — Last 8 Weeks</h3><div class="chart-box" id="cProfitBox"><canvas id="cProfit"></canvas></div></div>' +
      '<div class="card"><h3>Top Products</h3><div class="chart-box tall" id="cProdBox"><canvas id="cProd"></canvas></div></div>' +
      '<div class="card"><h3>Inventory Health</h3><div class="chart-box" id="cInvBox"><canvas id="cInv"></canvas></div></div>' +
      '</div>';
    return html;
  }
  function periods() {
    var t = new Date();
    return [
      { label: 'Today', from: dateKey(t), to: dateKey(t) },
      { label: 'This Week', from: dateKey(startOfWeek(t)), to: dateKey(t) },
      { label: 'This Month', from: dateKey(startOfMonth(t)), to: dateKey(t) },
      { label: 'All Time', from: '0000-00-00', to: '9999-12-31' }
    ];
  }

  function rInventory() {
    var q = (S._invSearch || '').toLowerCase();
    var html = '';
    html += '<div class="card"><h3>Inventory</h3>' +
      '<div class="sortbar" style="flex-wrap:wrap">' +
      searchBarHtml({ id: 'invSearch', q: S._invSearch || '', placeholder: 'Search product / brand / size\u2026', noType: true }) +
      '<button class="btn small" id="btnAddProduct">+ Add Product</button>' +
      '<button class="btn small ghost" id="btnAddStock">+ Add Stock</button>' +
      '<span class="hint" style="margin-left:auto">Click a row to adjust / quick sale.</span>' +
      '</div>' +
      '<div class="htable-wrap"><table class="htable"><thead><tr>' +
      '<th>#</th><th>Product</th><th>Side / Product Type</th>' +
      '<th class="money-cell">Quantity</th><th class="money-cell">Sell Price</th>' +
      '<th class="money-cell">Purchase Price</th><th class="money-cell">Total</th><th>Status</th><th>Action</th>' +
      '</tr></thead><tbody>';
    var idx = 0;
    S.products.forEach(function (p) {
      var n = (p.name + ' ' + (p.brand || '') + ' ' + (p.size || '') + ' ' + (p.category || '')).toLowerCase();
      if (q && n.indexOf(q) === -1 && p.id !== q) return;
      idx++;
      var sold = 0;
      S.sales.forEach(function (r) { if (r.productId === p.id && r.status !== 'cancelled') sold += num(r.boxes) + num(r.bottles) / boxBottles(p); });
      var totalVal = stockInBottles(p) * (num(p.price) / boxBottles(p));
      html += '<tr data-prod="' + p.id + '" style="cursor:pointer">' +
        '<td class="row-num">' + idx + '</td>' +
        '<td><b>' + esc(p.name) + '</b></td>' +
        '<td>' + (p.category ? esc(p.category) : '—') + (p.size ? ' <span class="hint">/ ' + esc(p.size) + '</span>' : '') + (p.brand ? ' <span class="hint">· ' + esc(p.brand) + '</span>' : '') + '</td>' +
        '<td class="money-cell"><b>' + stockBoxes(p) + ' box' + (stockBoxes(p) === 1 ? '' : 'es') + '</b>' + (stockLoose(p) ? ' + <b>' + stockLoose(p) + '</b> loose' : '') +
        '<div class="hint">' + stockInBottles(p) + ' bottles total</div></td>' +
        '<td class="money-cell">' + money(p.price) + '<div class="hint">per box</div></td>' +
        '<td class="money-cell">' + money(p.cost) + '<div class="hint">per box</div></td>' +
        '<td class="money-cell"><b>' + money(totalVal) + '</b><div class="hint">stock value</div></td>' +
        '<td>' + statusBadge(p, S.settings.minStock) + '</td>' +
        '<td><div class="mini"><button data-act="editp" data-i="' + p.id + '" title="Edit">&#9998;</button>' +
        '<button data-act="adj" data-i="' + p.id + '" title="Adjust">&#8693;</button></div></td>' +
        '</tr>';
    });
    if (!idx) html += '<tr><td colspan="9" class="hint">No products match.</td></tr>';
    html += '</tbody></table></div></div>';
    if (S.adjustments.length) {
      html += '<div class="card"><h3>Recent Adjustments</h3><div class="htable-wrap"><table class="htable"><thead><tr>' +
        '<th>Date</th><th>Product</th><th>Qty</th><th>Unit</th><th>Type</th><th>Notes</th></tr></thead><tbody>';
      S.adjustments.slice(0, 10).forEach(function (r) {
        html += '<tr><td>' + prettyDate(r.date) + '</td><td>' + esc(r.product) + '</td><td>' + r.qty + '</td><td>' + r.unit + '</td><td>' + esc(r.type) + '</td><td>' + esc(r.notes) + '</td></tr>';
      });
      html += '</tbody></table></div></div>';
    }
    return html;
  }

  function rProducts() {
    var html = '<div class="card"><h3>Products Master</h3>' +
      '<div class="sortbar"><button class="btn small" id="btnAddProduct2">+ Add Product</button>' +
      '<span class="hint">Editing cost/price only affects future sales. Past sales keep their original values.</span></div>' +
      '<div class="htable-wrap"><table class="htable"><thead><tr>' +
      '<th>Name</th><th>Brand</th><th>Category</th><th>Size</th><th>Bottles/Box</th>' +
      '<th class="money-cell">Cost/Box</th><th class="money-cell">Price/Box</th><th>Min Stock</th><th>Status</th><th></th>' +
      '</tr></thead><tbody>';
    S.products.forEach(function (p) {
      html += '<tr><td><b>' + esc(p.name) + '</b></td><td>' + esc(p.brand) + '</td><td>' + esc(p.category) + '</td>' +
        '<td>' + esc(p.size) + '</td><td>' + boxBottles(p) + '</td>' +
        '<td class="money-cell">' + money(p.cost) + '</td><td class="money-cell">' + money(p.price) + '</td>' +
        '<td>' + num(p.minStock) + '</td><td>' + statusBadge(p, S.settings.minStock) + '</td>' +
        '<td><div class="mini"><button data-act="editp" data-i="' + p.id + '" title="Edit">&#9998;</button>' +
        '<button data-act="rmp" data-i="' + p.id + '" class="rm" title="Delete">&#10005;</button></div></td></tr>';
    });
    html += '</tbody></table></div></div>';
    return html;
  }

  function rStock() {
    var html = '<div class="card"><h3>Add Stock (Purchase / Stock-In)</h3>' +
      '<div class="grid">' +
      '<div class="field full"><label>Product <b>*</b></label><select id="stProd">' + selectProducts() + '</select></div>' +
      '<div class="field"><label>Boxes purchased <b>*</b></label><input type="number" id="stBoxes" min="1" value="10"></div>' +
      '<div class="field"><label>Cost per box (₹) <b>*</b></label><input type="number" id="stCost" min="0" step="1" value="0"></div>' +
      '<div class="field"><label>Purchase date</label><input type="date" id="stDate" value="' + todayIso() + '"></div>' +
      '<div class="field"><label>Payment type</label><select id="stPay"><option value="cash">Cash</option><option value="online">Online</option></select></div>' +
      '<div class="field"><label>Amount paid (₹)</label><input type="number" id="stPaid" min="0" step="1" placeholder="Full amount"></div>' +
      '<div class="field"><label>Supplier</label><input type="text" id="stSupplier" placeholder="Optional"></div>' +
      '<div class="field full"><label>Notes</label><input type="text" id="stNotes" placeholder="Optional"></div>' +
      '</div>' +
      '<div class="row" style="margin-top:10px"><button class="btn" id="stSave">+ Add to Inventory</button>' +
      '<span class="hint" id="stHint">Select a product — cost auto-fills from its master record.</span></div>' +
      '</div>' +
      '<div class="card"><h3>Recent Purchases</h3><div class="htable-wrap"><table class="htable"><thead><tr>' +
      '<th>Date</th><th>Product</th><th>Boxes</th><th class="money-cell">Cost/Box</th><th class="money-cell">Total</th><th>Supplier</th><th>Notes</th>' +
      '</tr></thead><tbody>';
    S.purchases.slice(0, 15).forEach(function (r) {
      html += '<tr><td>' + prettyDate(r.date) + '</td><td><b>' + esc(r.product) + '</b></td><td>' + r.boxes + '</td>' +
        '<td class="money-cell">' + money(r.costPerBox) + '</td><td class="money-cell"><b>' + money(r.total) + '</b></td>' +
        '<td>' + esc(r.supplier) + '</td><td>' + esc(r.notes) + '</td></tr>';
    });
    html += '</tbody></table></div></div>';
    return html;
  }

  function rCash() {
    var html = '<div class="card"><h3>Cash Sale Entry</h3><p class="sub">Manual sale — customer didn\u2019t order via the website. Stock deducts immediately.</p>' +
      '<div class="grid">' +
      '<div class="field full"><label>Product <b>*</b></label><div class="combo-wrap"><input type="text" id="csProdInput" placeholder="Type to search product..." autocomplete="off"><div class="combo-dropdown" id="csProdDropdown" style="display:none"></div><input type="hidden" id="csProd"></div></div>' +
      '<div class="field"><label>Boxes</label><input type="number" id="csBoxes" min="0" value="0"></div>' +
      '<div class="field"><label>Loose bottles</label><input type="number" id="csBottles" min="0" value="0"></div>' +
      '<div class="field"><label>Selling price per box (₹)</label><input type="number" id="csPrice" min="0" value="0"></div>' +
      '<div class="field"><label>Sale date</label><input type="date" id="csDate" value="' + todayIso() + '"></div>' +
      '<div class="field"><label>Amount received (₹)</label><input type="number" id="csPaid" min="0" step="1" placeholder="Full amount"></div>' +
      '<div class="field full"><label>Customer name</label><input type="text" id="csName" placeholder="Optional"></div>' +
      '<div class="field full"><label>Notes</label><input type="text" id="csNotes" placeholder="Optional"></div>' +
      '</div>' +
'<div class="row" style="margin-top:10px;flex-wrap:wrap">' +
      '<span class="hint" id="csStockLine" style="width:100%"></span>' +
      '<span class="hint" id="csCostLine">Cost per box: — · Profit: —</span>' +
      '<span style="flex:1"></span>' +
      '<b style="font-size:16px" id="csAmt">Total: ₹0</b>' +
      '<button class="btn" id="csSave">+ Record Cash Sale</button></div>' +
      '</div>' +
      '<div class="card"><h3>Recent Cash Sales</h3><div class="htable-wrap"><table class="htable"><thead><tr>' +
      '<th>Date</th><th>Product</th><th>Boxes</th><th>Bottles</th><th class="money-cell">Amount</th><th class="money-cell">Cost</th><th class="money-cell">Profit</th><th>Customer</th>' +
      '</tr></thead><tbody>';
    var cash = S.sales.filter(function (r) { return r.payment === 'cash' && r.status !== 'cancelled'; });
    cash.slice(0, 15).forEach(function (r) {
      html += '<tr><td>' + prettyDate(r.date) + '</td><td><b>' + esc(r.product) + '</b></td><td>' + r.boxes + '</td><td>' + r.bottles + '</td>' +
        '<td class="money-cell">' + money(r.total) + '</td><td class="money-cell">' + money(r.cost) + '</td>' +
        '<td class="money-cell" style="color:var(--ok)">' + money(r.profit) + '</td><td>' + esc(r.customer) + '</td></tr>';
    });
    html += '</tbody></table></div></div>';
    return html;
  }

  var ORD_LABEL = { received: 'Order Received', confirmed: 'Order Confirmed', preparing: 'Preparing', out: 'Out for Delivery', delivered: 'Delivered', complete_requested: 'Complete Requested', completed: 'Completed', cancelled: 'Cancelled' };
  var ORD_KEYS = ['received', 'confirmed', 'preparing', 'out', 'delivered', 'complete_requested', 'completed', 'cancelled'];
  function secOf(o) {
    if (o && o.section) return o.section;
    var st = o ? o.status : '';
    if (st === 'received') return 'PENDING';
    if (st === 'completed') return 'COMPLETED';
    if (st === 'cancelled') return 'CANCELLED';
    return 'CONFIRMED';
  }
  var SEC_TABS = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];
  var SEC_CLS = { PENDING: 'warn', CONFIRMED: 'blu', COMPLETED: 'ok', CANCELLED: 'err' };
  var SEC_TXT = { PENDING: '\uD83D\uDFE1 PENDING', CONFIRMED: '\uD83D\uDD35 CONFIRMED', COMPLETED: '\uD83D\uDFE2 COMPLETED', CANCELLED: '\uD83D\uDD34 CANCELLED' };
  function ordToken() { return (localStorage.getItem('rw_admin_tok') || ''); }
  function setOrdToken(t) { if (t) localStorage.setItem('rw_admin_tok', t); }
  function ordFetch(url, opts, cb) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    opts.headers['x-admin-token'] = ordToken();
    fetch(url, opts).then(function (r) {
      if (r.status === 401) {
        r.json().catch(function () { return {}; }).then(function (d) { if (cb) cb({ needLogin: true, error: (d && d.error) || 'Login required' }); });
        return;
      }
      r.json().catch(function () { return {}; }).then(function (d) { if (cb) cb(d); });
    }).catch(function () { if (cb) cb({ netError: true, error: 'Server unreachable' }); });
  }

  function rOrders() {
    var sec = S._ordSection || 'PENDING';
    var tabs = SEC_TABS.map(function (s) {
      return '<button class="btn small' + (sec === s ? ' on' : '') + '" data-osec="' + s + '" type="button">' + SEC_TXT[s] + ' <span class="pill" id="osec_' + s + '">\u2026</span></button>';
    }).join('');
    var html = '<div class="card"><h3>Orders &amp; Tracking <span class="pill" id="adOrdCount">\u2026</span></h3>' +
      '<p class="sub">Verified website orders. New orders appear here as PENDING — call the customer, then Confirm or Reject. Customer\u2019s "See Your Order" screen updates instantly. Only COMPLETED orders count in sales reports.</p>' +
      '<div class="sortbar" style="flex-wrap:wrap">' + tabs + '</div>' +
      '<div class="sortbar" style="flex-wrap:wrap">' +
      '<input type="text" id="adOrdSearch" placeholder="Search order ID, name or phone\u2026" value="' + esc(String(S._ordSearch || '')) + '" style="min-width:180px">' +
      '<select id="adOrdStatus"><option value="">Detail status (all)</option>' +
      ORD_KEYS.map(function (s) { return '<option value="' + s + '">' + ORD_LABEL[s] + '</option>'; }).join('') +
      '</select>' +
      '<span class="hint" id="adOrdStats" style="flex:1;text-align:right"></span></div>' +
      '<div id="adOrdBox"><p class="hint">Loading orders\u2026</p></div></div>';
    html += rOrdersLegacy();
    return html;
  }

  function wireTrackedOrders() {
    var box = $('adOrdBox');
    if (!box) return;
    var search = $('adOrdSearch');
    var sel = $('adOrdStatus');
    var orders = [];
    function fmtDate(ts) {
      var d = new Date(ts);
      try { return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
    }
    function fmtFull(ts) {
      try { return new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
    }
    function secCounts() {
      var c = { PENDING: 0, CONFIRMED: 0, COMPLETED: 0, CANCELLED: 0 };
      orders.forEach(function (o) { var s = secOf(o); c[s] = (c[s] || 0) + 1; });
      return c;
    }
    function renderLogin() {
      box.innerHTML = '<div style="padding:10px 0">' +
        '<h3>Admin Locked</h3>' +
        '<p class="sub">Admin PIN is set on the server (data/server-config.json \u2192 admin.pin). Enter it to see customer orders.</p>' +
        '<input type="password" id="adPin" placeholder="Admin PIN" style="max-width:220px;margin-top:8px"> ' +
        '<button class="btn small" id="adPinGo" type="button">Unlock</button>' +
        '<p class="hint" id="adPinMsg" style="margin-top:6px"></p></div>';
      var go = function () {
        var pin = $('adPin') ? $('adPin').value : '';
        var msg = $('adPinMsg');
        if (!pin) { if (msg) msg.textContent = 'Enter the PIN.'; return; }
        fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: pin }) })
          .then(function (r) { return r.json().catch(function () { return {}; }); })
          .then(function (d) {
            if (d && d.ok && d.token) { setOrdToken(d.token); load(); }
            else if (msg) { msg.textContent = (d && d.error) || 'Wrong PIN'; msg.style.color = 'var(--err)'; }
          });
      };
      if ($('adPinGo')) $('adPinGo').onclick = go;
      if ($('adPin')) $('adPin').addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    }
    function ordSetStatus(o, status, reason) {
      /* P16+P17: disable only THIS order's button, not the whole list */
      var btnEl = box ? box.querySelector('[data-complete="' + o.id + '"], [data-confirm="' + o.id + '"], [data-reject="' + o.id + '"]') : null;
      if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Saving\u2026'; }
      ordFetch('/api/admin/orders/status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: o.id, status: status, reason: reason || '' })
      }, function (d) {
        if (btnEl) { btnEl.disabled = false; }
        if (d && d.ok) {
          var lbl = status === 'completed' ? 'Completed' : (status === 'cancelled' ? 'Cancelled' : ORD_LABEL[status] || status);
          toast('#' + o.id + ' \u2192 ' + lbl);
          /* P3+P8: Update ONLY this order locally — no full reload, no disappearance */
          for (var i = 0; i < orders.length; i++) {
            if (orders[i].id === o.id) {
              orders[i].status = status;
              if (!orders[i].statusHistory) orders[i].statusHistory = [];
              orders[i].statusHistory.push({ status: status, at: Date.now() });
              if (status === 'completed') orders[i].completedAt = Date.now();
              if (status === 'cancelled') orders[i].cancelledAt = Date.now();
              if (status === 'confirmed') orders[i].confirmedAt = Date.now();
              break;
            }
          }
          /* P4: NO vibration/sound on complete — only notify on NEW orders */
          var newSec = secOf(orders[i] || {});
          if (status === 'completed') {
            reloadBizData(function () { S._ordSection = newSec; renderAd(); });
          }
          else {
            S._ordSection = newSec;
            renderAd();
          }
          if (btnEl) { btnEl.textContent = lbl; }
        } else if (d && d.error) {
          toast(d.error, true);
          if (btnEl) { btnEl.textContent = 'Retry'; }
        } else {
          toast('Server unreachable', true);
          if (btnEl) { btnEl.textContent = 'Retry'; }
        }
      });
    }
    function rwDialog(title, body, okLabel, cls, cb) {
      var html = '<div class="modal-back" id="modalBack"><div class="modal modal-wrap" style="max-width:440px">' +
        '<button class="modal-close" id="modalClose">\u2715</button>' +
        '<h3>' + title + '</h3>' +
        '<div style="color:var(--muted);font-size:13px;line-height:1.65">' + body + '</div>' +
        '<div class="modal-foot"><button class="btn ghost" id="modalClose2" type="button">Cancel</button>' +
        '<button class="btn ' + (cls || '') + '" id="dlgOk" type="button">' + okLabel + '</button></div></div></div>';
      showModal(html, function () {
        var ok = $('dlgOk');
        if (ok) ok.onclick = function () { closeModal(); cb(); };
      });
    }
    function confirmOrderDialog(o) {
      rwDialog('Confirm this order?',
        '<div style="font-size:16px;font-weight:800;padding:8px 10px;border-radius:10px;margin:0 0 10px;' + (o.verified ? 'color:var(--ok);background:rgba(53,224,161,.1)' : 'color:var(--err);background:rgba(255,92,122,.12)') + '">' + (o.verified ? '\u2713 TRUECALLER VERIFIED' : '\u26A0 NOT VERIFIED — PHONE SE CONFIRM KARO') + '</div>' +
        'Confirm karte hi order <b>COMPLETED</b> ho jayega — <b>online sale list me add</b> hoga aur <b>Today\u2019s earning me paise update</b> ho jayenge (stock + profit auto deduct).<br><br>' +
        'Order <b>#' + esc(o.id) + '</b><br>' +
        'Customer: <b>' + esc(o.name) + '</b> \u00B7 +91' + esc(o.phone) + '<br>Total: <b>' + money(o.total) + '</b>' +
        '<br><div class="hint" style="margin-top:6px">Owner Notes: ' + (o.ownerNotes ? esc(o.ownerNotes) : '—') + '</div>',
        'Confirm & Complete', 'ok', function () { ordSetStatus(o, 'completed', ''); });
    }
    function completeOrderDialog(o) {
      var boxes = 0, bottles = 0;
      (o.items || []).forEach(function (it) { boxes += num(it.boxes); bottles += num(it.bottles); });
      rwDialog('Mark this order as completed?',
        'Order <b>#' + esc(o.id) + '</b> — sirf actual delivery ke baad complete karo.<br><br>' +
        'Final amount: <b>' + money(o.total) + '</b><br>Items: <b>' + (o.items || []).length + '</b> \u00B7 ' + boxes + ' boxes + ' + bottles + ' loose bottles<br>Payment: <b>' + esc(o.type || '') + '</b> \u2192 <b>Paid</b>' +
        '<br><div class="hint" style="margin-top:6px">Yahan click karne ke baad hi order COMPLETED hoga — sale business reports me count hogi (stock + profit update, sirf ek baar).</div>',
        'Mark as Completed', 'ok', function () { ordSetStatus(o, 'completed', ''); });
    }
    function rejectOrderDialog(o) {
      var reasons = ['Out of stock', 'Customer unavailable', 'Wrong address', 'Price issue', 'Customer cancelled', 'Other'];
      var opts = reasons.map(function (r, i) {
        return '<label style="display:block;padding:4px 0;cursor:pointer"><input type="radio" name="rjReason" value="' + esc(r) + '"' + (i === 0 ? ' checked' : '') + '> ' + esc(r) + '</label>';
      }).join('');
      var html = '<div class="modal-back" id="modalBack"><div class="modal modal-wrap" style="max-width:440px">' +
        '<button class="modal-close" id="modalClose">\u2715</button>' +
        '<h3>Reject Order #' + esc(o.id) + '</h3>' +
        '<div style="color:var(--muted);font-size:13px;line-height:1.6">Why is this order being rejected? The customer will see it as <b>CANCELLED</b>.</div>' +
        '<div style="margin:10px 0">' + opts + '</div>' +
        '<input type="text" id="rjOther" placeholder="Other reason\u2026" style="width:100%;margin-bottom:6px">' +
        '<div class="modal-foot"><button class="btn ghost" id="modalClose2" type="button">Cancel</button>' +
        '<button class="btn danger" id="rjGo" type="button">Reject Order</button></div></div></div>';
      showModal(html, function () {
        var go = $('rjGo');
        if (go) go.onclick = function () {
          var r = '';
          document.querySelectorAll('input[name="rjReason"]').forEach(function (x) { if (x.checked) r = x.value; });
          if (r === 'Other') r = ($('rjOther') ? $('rjOther').value : '').trim() || 'Other';
          closeModal();
          ordSetStatus(o, 'cancelled', r);
        };
      });
    }
    function deleteOrder(o) {
      rwDialog('Permanently delete order #' + esc(o.id) + '?',
        'Ye sirf cancelled orders ke liye hai — data hamesha ke liye delete ho jayega (sync nahi hoga).',
        'Delete Permanently', 'danger', function () {
          ordFetch('/api/admin/orders/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: o.id }) }, function (d) {
            if (d && d.ok) { toast('#' + o.id + ' deleted permanently'); load(); }
            else if (d && d.error) toast(d.error, true);
            else toast('Server unreachable', true);
          });
        });
    }
    function orderModal(id) {
      var o = null;
      for (var i = 0; i < orders.length; i++) { if (orders[i].id === id) { o = orders[i]; break; } }
      if (!o) return;
      var sec = secOf(o);
      var items = (o.items || []).map(function (it) {
        return '<tr><td>' + esc(it.name) + ' ' + esc(it.size) + '</td><td style="text-align:center">' + it.qty + '</td>' +
          '<td style="text-align:center">' + (it.boxes || 0) + ' box' + ((it.boxes || 0) === 1 ? '' : 'es') + ' + ' + (it.bottles || 0) + '</td>' +
          '<td class="money-cell">\u20B9' + it.price + '</td><td class="money-cell">\u20B9' + it.lineTotal + '</td></tr>';
      }).join('');
      var hist = (o.statusHistory || []).map(function (h) {
        return '<div style="margin:2px 0">\u2022 ' + esc(ORD_LABEL[h.status] || h.status) + ' <span class="hint">' + fmtFull(h.at) + '</span></div>';
      }).join('');
      var telHref = 'tel:+91' + esc(o.phone);
      var dd = function (t, v) { return '<div class="row" style="justify-content:space-between;gap:10px;padding:2px 0"><span class="hint">' + t + '</span><b style="text-align:right">' + v + '</b></div>'; };
      var html = '<div class="modal-back" id="modalBack"><div class="modal modal-wrap">' +
        '<button class="modal-close" id="modalClose">\u2715</button>' +
        '<h3>Order ' + esc(o.id) + ' <span class="badge ' + SEC_CLS[sec] + '">' + SEC_TXT[sec] + '</span></h3>' +
        '<div class="detail-dl">' +
        '<dt>Customer</dt><dd>' + esc(o.name) + ' <a href="' + telHref + '" class="btn small" style="margin-left:6px">\uD83D\uDCDE Call</a></dd>' +
        '<dt>Verified phone</dt><dd>+91' + esc(o.phone) + ' ' + (o.verified ? '<span class="badge ok">Truecaller verified</span>' : '<span class="badge gray">not verified</span>') + '</dd>' +
        '<dt>Address</dt><dd>' + esc(o.address) + '<br><span class="hint">' + esc(o.city) + ' \u00B7 ' + esc(o.pincode) + '</span></dd>' +
        (o.note ? '<dt>Delivery note</dt><dd>' + esc(o.note) + '</dd>' : '') +
        '<dt>Order date/time</dt><dd>' + fmtFull(o.createdAt) + '</dd>' +
        '<dt>Verification status</dt><dd>' + esc(o.verificationStatus || (o.verified ? 'Verified (Truecaller)' : 'Not verified')) + '</dd>' +
        '<dt>Payment</dt><dd>' + esc(o.type || '') + ' \u00B7 <span class="badge ' + (o.paymentStatus === 'Paid' ? 'ok' : 'warn') + '">' + esc(o.paymentStatus || 'Pending') + '</span></dd>' +
        '<dt>Total amount</dt><dd class="money-cell">\u20B9' + o.total + '</dd>' +
        '<dt>Current status</dt><dd><span class="badge ' + SEC_CLS[sec] + '">' + SEC_TXT[sec] + '</span> <span class="hint">(' + esc(ORD_LABEL[o.status] || o.status) + ')</span></dd>' +
        (o.confirmedAt ? '<dt>Confirmation time</dt><dd>' + fmtFull(o.confirmedAt) + '</dd>' : '') +
        (o.completedAt ? '<dt>Completion time</dt><dd>' + fmtFull(o.completedAt) + '</dd>' : '') +
        (o.cancelledAt ? '<dt>Cancellation time</dt><dd>' + fmtFull(o.cancelledAt) + (o.rejectReason ? '<br><span class="hint">Reason: ' + esc(o.rejectReason) + '</span>' : '') + '</dd>' : '') +
        (o.customerCompletedAt ? '<dt>Customer marked complete</dt><dd>' + fmtFull(o.customerCompletedAt) + '</dd>' : '') +
        '<dt>Owner notes</dt><dd><textarea id="omNotes" style="width:100%;min-height:64px" placeholder="e.g. Customer confirmed delivery tomorrow morning.">' + esc(o.ownerNotes || '') + '</textarea>' +
        '<button class="btn small" id="omNotesSave" type="button" style="margin-top:6px">Save Notes</button></dd>' +
        '<dt>Status history</dt><dd>' + (hist || '<span class="hint">—</span>') + '</dd>' +
        '</div>' +
        '<div style="margin:10px 0"><div class="htable-wrap"><table class="htable" style="min-width:460px"><thead><tr><th>Item</th><th style="text-align:center">Bottles</th><th style="text-align:center">Box + loose</th><th class="money-cell">Rate/bottle</th><th class="money-cell">Total</th></tr></thead><tbody>' + items + '</tbody></table></div></div>' +
        '<div class="modal-foot" style="flex-wrap:wrap;gap:8px">' +
        '<a class="btn" href="' + telHref + '" style="margin-right:auto">\uD83D\uDCDE Call Customer</a>' +
        (sec === 'PENDING' ? '<button class="btn ok" id="omConfirm" type="button">Confirm Order</button><button class="btn danger" id="omReject" type="button">Reject Order</button>' : '') +
        (sec === 'CONFIRMED' ? '<button class="btn ok" id="omComplete" type="button">Mark as Completed</button><button class="btn danger" id="omReject" type="button">Cancel Order</button>' : '') +
        '<button class="btn ghost" id="modalClose2" type="button">Close</button></div>' +
        '</div></div>';
      showModal(html, function () {
        var ms = $('omNotesSave');
        if (ms) ms.onclick = function () {
          var nv = $('omNotes') ? $('omNotes').value : '';
          ordFetch('/api/admin/orders/note', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: o.id, note: nv }) }, function (d) {
            if (d && d.ok) { toast('Owner notes saved for #' + o.id); o.ownerNotes = d.note; }
            else if (d && d.error) toast(d.error, true);
            else toast('Server unreachable', true);
          });
        };
        var cf = $('omConfirm');
        if (cf) cf.onclick = function () { closeModal(); confirmOrderDialog(o); };
        var cp = $('omComplete');
        if (cp) cp.onclick = function () { closeModal(); completeOrderDialog(o); };
        var rj = $('omReject');
        if (rj) rj.onclick = function () { closeModal(); rejectOrderDialog(o); };
      });
    }
    function ordCard(o) {
      var sec = secOf(o);
      var items = (o.items || []).map(function (it) {
        return '<tr><td>' + esc(it.name) + ' ' + esc(it.size) + '</td><td style="text-align:center">' + it.qty + '</td>' +
          '<td style="text-align:center">' + (it.boxes || 0) + ' box' + ((it.boxes || 0) === 1 ? '' : 'es') + ' + ' + (it.bottles || 0) + '</td>' +
          '<td class="money-cell">\u20B9' + it.price + '</td><td class="money-cell">\u20B9' + it.lineTotal + '</td></tr>';
      }).join('');
      var last = (o.statusHistory || []).slice(-1)[0];
      var waState = o.notified === true ? '<span class="hint" style="color:var(--ok)">WA: notified</span>'
        : (o.notifyError ? '<span class="hint" title="' + esc(o.notifyError) + '" style="color:var(--warn)">WA: not sent</span>' : '<span class="hint">WA: pending</span>');
      var custReq = o.status === 'complete_requested'
        ? '<div class="hint" style="color:var(--warn);font-weight:600">Customer ne order complete mark kiya hai — aap "Mark as Completed" karo tabhi final hoga.</div>' : '';
      var notes = o.ownerNotes ? '<div class="hint" style="margin-top:4px">\uD83D\uDCCD Owner notes: ' + esc(o.ownerNotes) + '</div>' : '';
      var act = '';
      if (sec === 'PENDING') {
        act = '<button class="btn small" data-v="' + esc(o.id) + '" type="button">View Details</button>' +
          '<a class="btn small" href="tel:+91' + esc(o.phone) + '">\uD83D\uDCDE Call Customer</a>' +
          '<button class="btn small ok" data-confirm="' + esc(o.id) + '" type="button">Confirm Order</button>' +
          '<button class="btn small danger" data-reject="' + esc(o.id) + '" type="button">Reject Order</button>';
      } else if (sec === 'CONFIRMED') {
        act = '<button class="btn small" data-v="' + esc(o.id) + '" type="button">View Details</button>' +
          '<a class="btn small" href="tel:+91' + esc(o.phone) + '">\uD83D\uDCDE Call Customer</a>' +
          '<button class="btn small ok" data-complete="' + esc(o.id) + '" type="button">' + (o.status === 'complete_requested' ? 'Complete (Customer requested)' : 'Mark as Completed') + '</button>' +
          '<button class="btn small danger" data-reject="' + esc(o.id) + '" type="button">Cancel Order</button>';
      } else if (sec === 'COMPLETED') {
        act = '<button class="btn small" data-v="' + esc(o.id) + '" type="button">View Details</button>' +
          '<a class="btn small" href="tel:+91' + esc(o.phone) + '">\uD83D\uDCDE Call</a>' +
          '<span class="hint" style="color:var(--ok)">Sale recorded \u2713</span>';
      } else {
        act = '<button class="btn small" data-v="' + esc(o.id) + '" type="button">View Details</button>' +
          (o.rejectReason ? '<span class="hint">Reject reason: ' + esc(o.rejectReason) + '</span>' : '') +
          '<button class="btn small danger" data-del="' + esc(o.id) + '" type="button">Delete Permanently</button>';
      }
      var secColors = { PENDING: 'rgba(255,200,87,.5)', CONFIRMED: 'rgba(56,217,255,.5)', COMPLETED: 'rgba(53,224,161,.5)', CANCELLED: 'rgba(255,92,122,.5)' };
      var secBg = { PENDING: 'rgba(255,200,87,.06)', CONFIRMED: 'rgba(56,217,255,.06)', COMPLETED: 'rgba(53,224,161,.06)', CANCELLED: 'rgba(255,92,122,.06)' };
      return '<div class="card" style="background:' + (secBg[sec] || 'var(--panel2)') + ';padding:12px 14px;border-left:4px solid ' + (secColors[sec] || 'var(--line)') + '">' +
        '<div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px">' +
        '<span><b>#' + esc(o.id) + '</b> <span class="badge ' + SEC_CLS[sec] + '">' + SEC_TXT[sec] + '</span> <span class="hint">' + fmtDate(o.createdAt) + '</span> ' + waState + '</span>' +
        '<b class="money-cell">\u20B9' + o.total + '</b></div>' +
        custReq + notes +
        '<div class="hint">' + esc(o.name) + ' \u00B7 <a href="tel:+91' + esc(o.phone) + '" style="color:var(--acc)">+91' + esc(o.phone) + '</a> \u00B7 ' + esc(o.type || '') + ' \u00B7 ' + esc(o.paymentStatus || 'Pending') + '</div>' +
        '<div class="hint">' + esc(o.address) + ', ' + esc(o.city) + ' ' + esc(o.pincode) + (o.note ? ' — note: ' + esc(o.note) : '') + '</div>' +
        '<div class="htable-wrap" style="margin-top:8px"><table class="htable" style="min-width:420px"><thead><tr><th>Item</th><th style="text-align:center">Bottles</th><th style="text-align:center">Box + loose</th><th class="money-cell">Rate</th><th class="money-cell">Total</th></tr></thead><tbody>' + items + '</tbody></table></div>' +
        '<div class="row" style="margin-top:10px;justify-content:flex-start;align-items:center;flex-wrap:wrap;gap:8px">' + act + '</div>' +
        '<div class="hint" style="margin-top:6px">Last update: ' + (last ? fmtDate(last.at) + ' — ' + esc(ORD_LABEL[last.status] || last.status) : '—') + ' \u00B7 ETA: ' + esc(o.eta || '—') + '</div>' +
        '</div>';
    }
    function wireCards() {
      if (box) box.querySelectorAll('[data-osec]').forEach(function (b) {
        b.addEventListener('click', function () {
          S._ordSection = b.getAttribute('data-osec');
          box.querySelectorAll('[data-osec]').forEach(function (x) { x.classList.toggle('on', x === b); });
          renderAd();
        });
      });
      box.querySelectorAll('[data-v]').forEach(function (b) {
        b.addEventListener('click', function () { orderModal(b.getAttribute('data-v')); });
      });
      box.querySelectorAll('[data-confirm]').forEach(function (b) {
        b.addEventListener('click', function () {
          var o = null;
          for (var i = 0; i < orders.length; i++) { if (orders[i].id === b.getAttribute('data-confirm')) { o = orders[i]; break; } }
          if (o) confirmOrderDialog(o);
        });
      });
      box.querySelectorAll('[data-complete]').forEach(function (b) {
        b.addEventListener('click', function () {
          var o = null;
          for (var i = 0; i < orders.length; i++) { if (orders[i].id === b.getAttribute('data-complete')) { o = orders[i]; break; } }
          if (o) completeOrderDialog(o);
        });
      });
      box.querySelectorAll('[data-reject]').forEach(function (b) {
        b.addEventListener('click', function () {
          var o = null;
          for (var i = 0; i < orders.length; i++) { if (orders[i].id === b.getAttribute('data-reject')) { o = orders[i]; break; } }
          if (o) rejectOrderDialog(o);
        });
      });
      box.querySelectorAll('[data-del]').forEach(function (b) {
        b.addEventListener('click', function () {
          var o = null;
          for (var i = 0; i < orders.length; i++) { if (orders[i].id === b.getAttribute('data-del')) { o = orders[i]; break; } }
          if (o) deleteOrder(o);
        });
      });
    }
    function renderAd() {
      if (!box) return;
      var sec = S._ordSection || 'PENDING';
      var q = String(S._ordSearch || '').toLowerCase();
      var st = sel ? sel.value : '';
      var list = orders.filter(function (o) {
        if (secOf(o) !== sec) return false;
        if (st && o.status !== st) return false;
        if (!q) return true;
        return (o.id + ' ' + o.name + ' ' + o.phone + ' ' + o.city + ' ' + o.address).toLowerCase().indexOf(q) !== -1;
      });
      var cnt = $('adOrdCount');
      if (cnt) cnt.textContent = orders.length + ' total';
      var sc = secCounts();
      SEC_TABS.forEach(function (s) { var el = $('osec_' + s); if (el) el.textContent = sc[s] || 0; });
      var stats = $('adOrdStats');
      if (stats) {
        var compSales = 0;
        orders.forEach(function (o) { if (o.status === 'completed') compSales += num(o.total); });
        stats.textContent = 'Completed sales: ' + money(compSales) + ' \u00B7 Pending: ' + sc.PENDING + ' \u00B7 Confirmed: ' + sc.CONFIRMED + ' \u00B7 Completed: ' + sc.COMPLETED + ' \u00B7 Cancelled: ' + sc.CANCELLED;
      }
      if (!list.length) { box.innerHTML = '<p class="hint">No ' + sec.toLowerCase() + ' orders' + (st ? ' with "' + esc(ORD_LABEL[st]) + '"' : '') + ' match.</p>'; return; }
      box.innerHTML = list.map(ordCard).join('');
      wireCards();
      if (S._openOrderId) {
        var oid = S._openOrderId;
        S._openOrderId = null;
        var target = null;
        for (var i = 0; i < orders.length; i++) { if (orders[i].id === oid) { target = orders[i]; break; } }
        if (target) { if (secOf(target) !== sec) { S._ordSection = secOf(target); renderAd(); } else { orderModal(oid); } }
      }
    }
    function load() {
      ordFetch('/api/admin/orders', {}, function (d) {
        if (d && d.needLogin) { renderLogin(); return; }
        if (d && d.netError) { box.innerHTML = '<p class="hint">Could not load orders — is the server running?</p>'; return; }
        if (d && d.ok && Array.isArray(d.orders)) {
          /* P3+P8: Merge — replace orders array without blanking first */
          orders = d.orders;
        }
        if (!box) return;
        box.querySelectorAll('[data-osec]').forEach(function (b) {
          var s = b.getAttribute('data-osec');
          var on = (!S._ordSection && s === 'PENDING') || (S._ordSection === s);
          b.classList.toggle('on', on);
        });
        renderAd();
      });
    }
    if (search) { search.addEventListener('input', function () { S._ordSearch = search.value; renderAd(); }); }
    if (sel) { sel.addEventListener('change', renderAd); }
    load();
  }

  var dashOrdTimer = null;
  var ordWatchSeq = null;
  var ordWatchTimer = null;
  var ordStartDone = 0;

  /* Notification bells: vibration + beep. Chrome/Android lets navigator.vibrate
     and Web Audio run only after the user has interacted with the page once,
     so every first gesture here primes them. */
  function primeAlertGestures() {
    ['touchstart', 'pointerdown', 'click', 'keydown'].forEach(function (ev) {
      document.addEventListener(ev, function () {
        /* P4: Don't vibrate on every gesture — only AudioContext for sound */
        if (!alertAudioCtx) {
          var AC = window.AudioContext || window.webkitAudioContext;
          if (AC) { try { alertAudioCtx = new AC(); } catch (e) {} }
        }
        if (alertAudioCtx && alertAudioCtx.state === 'suspended') { try { alertAudioCtx.resume(); } catch (e) {} }
      }, { capture: true, passive: true });
    });
  }
  var alertAudioCtx = null;
  function alertBeep() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!alertAudioCtx) alertAudioCtx = new AC();
      if (alertAudioCtx.state === 'suspended') alertAudioCtx.resume();
      var t = alertAudioCtx.currentTime;
      [[880, 0], [1175, 0.35], [0, 0.7]].forEach(function (p) {
        var osc = alertAudioCtx.createOscillator();
        var gain = alertAudioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = p[0] || 1;
        gain.gain.setValueAtTime(0.0001, t + p[1]);
        gain.gain.exponentialRampToValueAtTime(0.28, t + p[1] + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + p[1] + 0.32);
        osc.connect(gain);
        gain.connect(alertAudioCtx.destination);
        osc.start(t + p[1]);
        osc.stop(t + p[1] + 0.34);
      });
      setTimeout(function () { if (alertAudioCtx && alertAudioCtx.state === 'suspended') alertAudioCtx.resume(); }, 600);
    } catch (e) {}
  }
  function alertShake() {
    if (!navigator.vibrate) return;
    try {
      navigator.vibrate([900, 150, 900, 150, 1600]);
      setTimeout(function () { try { navigator.vibrate([900, 200, 1200]); } catch (e2) {} }, 4300);
    } catch (e) {}
  }
  function notifyAlert() { alertShake(); alertBeep(); }

  /* One global poller for new orders — runs on every tab, not just Dashboard. */
  function ordWatchTick() {
    ordFetch('/api/admin/orders', {}, function (d) {
      var body = document.getElementById('webOrdBody');
      if (d && d.ok) {
        var maxSeq = num(d.seq);
        if (ordWatchSeq !== null && maxSeq > ordWatchSeq) {
          var fresh = (d.orders || []).filter(function (o) { return secOf(o) === 'PENDING' && num(o.seq) > num(ordWatchSeq); });
          if (fresh.length) {
            fresh.forEach(ordNotify);
            notifyAlert();
          }
        }
        ordWatchSeq = maxSeq;
        if (ordWatchSeq !== null && !ordStartDone) {
          ordStartDone = 1;
          ordStartSummary(d);
        }
        if (body) dashOrdersStats(d, body);
      } else if (body && d && d.needLogin) {
        body.innerHTML = '<p class="hint">Admin PIN lock hai \u2014 <button class="btn small" id="webOrdUnlock" type="button">Unlock karke dekho</button></p>';
        var ul = document.getElementById('webOrdUnlock');
        if (ul) ul.onclick = function () { goto('biz-orders'); };
      } else if (body && d && d.netError) {
        body.innerHTML = '<p class="hint">Server unreachable — orders load nahi ho rahe.</p>';
      }
    });
  }
  function startOrderWatch() {
    if (ordWatchTimer) return;
    primeAlertGestures();
    ordWatchTick();
    ordWatchTimer = setInterval(ordWatchTick, 3000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) ordWatchTick(); });
  }

  function ordStartSummary(d) {
    /* On first load, quietly summarize very recent pending orders so the owner
       immediately notices orders that arrived before the panel opened. */
    var cutoff = Date.now() - 3 * 60 * 1000;
    var recent = (d.orders || []).filter(function (o) { return secOf(o) === 'PENDING' && o.createdAt >= cutoff; });
    if (recent.length && !document.getElementById('ordNotif')) {
      var o = recent[0];
      ordNotify(o, true, recent.length);
    }
  }

  function ordNotify(o, quiet, extraCount) {
    var old = document.getElementById('ordNotif');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var d = document.createElement('div');
    d.id = 'ordNotif';
    d.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);right:auto;bottom:auto;z-index:9999;background:linear-gradient(135deg,#0E1626,#101B2E);border:1px solid rgba(255,200,87,.45);border-radius:16px;padding:16px 20px;max-width:360px;box-shadow:0 12px 40px rgba(0,0,0,.55);cursor:pointer;color:#fff;font-size:13px;font-family:Inter,system-ui,sans-serif';
    var boxes = 0;
    (o.items || []).forEach(function (it) { boxes += num(it.boxes); });
    var title = quiet ? 'ABHI AAWA PENDING ORDER' : '\uD83D\uDD14 \uD83D\uDD14 NEW ORDER';
    if (extraCount > 1) title += ' +' + (extraCount - 1) + ' AUR';
    d.innerHTML = '<div style="font-weight:800;color:#FFC857;font-size:17px;margin-bottom:6px">' + title + '</div>' +
      '<div style="font-size:15px">Order <b>#' + esc(o.id) + '</b> — <b>' + esc(o.name) + '</b></div>' +
      '<div style="font-size:22px;font-weight:800;margin-top:4px">' + money(o.total) + '</div>' +
      '<div style="color:#8B98AD;margin-top:4px">' + boxes + ' boxes \u00B7 ' + (o.verified ? 'Phone verified' : '<span style="color:#FFB4A2;font-weight:700">NOT VERIFIED — PHONE SE CONFIRM KARO</span>') + '</div>';
    d.onclick = function () { if (d.parentNode) d.parentNode.removeChild(d); S._ordSection = 'PENDING'; S._openOrderId = o.id; goto('biz-orders'); };
    document.body.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 20000);
  }
  function dashOrdersStats(d, body) {
    var orders = (d.ok && Array.isArray(d.orders)) ? d.orders : [];
    var pending = 0, confirmed = 0, compToday = 0, cancToday = 0, compSales = 0;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var t0 = today.getTime();
    orders.forEach(function (o) {
      var s = secOf(o);
      if (s === 'PENDING') pending++;
      else if (s === 'CONFIRMED') confirmed++;
      else if (s === 'COMPLETED') { if (o.completedAt && o.completedAt >= t0) { compToday++; compSales += num(o.total); } }
      else if (s === 'CANCELLED') { if (o.cancelledAt && o.cancelledAt >= t0) cancToday++; }
    });
    var b = $('webOrdBadge');
    if (b) { b.textContent = pending + ' pending'; b.className = 'pill' + (pending ? ' warn' : ''); }
    body.innerHTML = '<div class="kpi" style="margin:0">' +
      kpiCard('New Pending Orders', pending, 'need confirm / reject', pending ? 'yellow' : '') +
      kpiCard('Confirmed Orders', confirmed, 'in progress', '') +
      kpiCard('Completed Today', compToday, 'finished today', compToday ? 'green' : '') +
      kpiCard('Cancelled Today', cancToday, 'rejected today', cancToday ? 'red' : '') +
      kpiCard('Today\u2019s Completed Sales', money(compSales), compToday + ' order count', compToday ? 'green' : '') +
      '</div>' +
      '<div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:10px;margin-top:12px">' +
      (pending ? '<div class="alert-item warn" data-open-orderstab="1" style="flex:1;min-width:220px;cursor:pointer"><span><b>' + pending + ' pending order(s)</b> — Orders tab kholo aur Confirm / Reject karo.</span><span class="badge warn">Open Orders</span></div>' : '<span class="hint">No pending orders \u2014 naya order aate hi yahan aur notification milegi.</span>') +
      '<button class="btn small ghost" id="webOrdGo" type="button">Open Orders \u2192</button></div>';
    var go = $('webOrdGo');
    if (go) go.onclick = function () { S._ordSection = 'PENDING'; goto('biz-orders'); };
    body.querySelectorAll('[data-open-orderstab]').forEach(function (el) {
      el.addEventListener('click', function () { S._ordSection = 'PENDING'; goto('biz-orders'); });
    });
  }

  function wireDashOrders() {
    var body = $('webOrdBody');
    if (!body) return;
    if (dashOrdTimer) { clearInterval(dashOrdTimer); dashOrdTimer = null; }
    startOrderWatch();
    ordWatchTick();
  }

  function rOrdersLegacy() {
    var html = '<div class="card"><h3>Online Orders — Pending</h3><p class="sub">Orders from the website appear here. Confirm = stock deducts + sale recorded. Cancel = nothing changes.</p>';
    var pending = S.pendingOrders || [];
    if (!pending.length) {
      html += '<p class="hint">No pending orders. Website orders land here automatically (needs the server running).</p>';
    } else {
      pending.forEach(function (o) {
        var est = { cost: 0, profit: 0, matched: 0, unmatched: [] };
        var itemRows = '';
        (o.items || []).forEach(function (it) {
          var p = matchProduct(it.name, it.size);
          var bpb = p ? boxBottles(p) : 12;
          var ppb = num(it.pricePerBox) || (p ? num(p.price) : 0);
          var rev = num(it.boxes) * ppb + num(it.bottles) * (ppb / bpb);
          var cst = p ? num(it.boxes) * num(p.cost) + num(it.bottles) * (num(p.cost) / bpb) : 0;
          if (!p) { est.unmatched.push(it.name || it.size || 'item'); } else { est.matched++; est.cost += cst; est.profit += rev - cst; }
          itemRows += '<tr><td>' + esc(it.name) + '</td><td>' + esc(it.size) + '</td><td>' + it.boxes + '</td><td>' + it.bottles + '</td>' +
            '<td class="money-cell">' + money(ppb) + '</td><td class="money-cell">' + money(cst) + '</td>' +
            '<td class="money-cell" style="color:var(--ok)">' + money(rev - cst) + '</td>' +
            '<td>' + (p ? '<span class="badge ok">' + esc(p.name) + ' · ' + stockBoxes(p) + ' boxes left</span>' : '<span class="badge err">Not in inventory</span>') + '</td></tr>';
        });
        html += '<div class="card" style="background:var(--panel2)">' +
          '<div class="row" style="justify-content:space-between;flex-wrap:wrap">' +
          '<span><b>' + esc(o.ref || o.id) + '</b> <span class="badge blu">' + (o.source === 'website' ? 'Website' : 'Manual') + '</span> <span class="hint">' + prettyDate(String(o.date || '').slice(0, 10)) + '</span></span>' +
          '<b>' + money(o.total) + '</b></div>' +
          (o.customer ? '<div class="hint">' + esc(o.customer) + (o.phone ? ' · ' + esc(o.phone) : '') + '</div>' : '') +
          (o.address ? '<div class="hint">' + esc(o.address) + '</div>' : '') +
          '<div class="htable-wrap" style="margin-top:8px"><table class="htable" style="min-width:640px"><thead><tr><th>Item</th><th>Size</th><th>Boxes</th><th>Bottles</th><th class="money-cell">Rate/Box</th><th class="money-cell">Est. Cost</th><th class="money-cell">Est. Profit</th><th>Stock match</th></tr></thead><tbody>' + itemRows +
          '</tbody></table></div>' +
          '<div class="row" style="margin-top:10px;justify-content:space-between;flex-wrap:wrap">' +
          '<span class="hint">Confirm par ' + est.matched + '/' + (o.items || []).length + ' items stock se deduct + profit add hoga. Est. cost ' + money(est.cost) + ', est. profit <b style="color:var(--ok)">' + money(est.profit) + '</b>' +
          (est.unmatched.length ? ' · <span style="color:var(--warn)">Inventory me nahi: ' + esc(est.unmatched.join(', ')) + '</span>' : '') + '</span>' +
          '<span class="row"><button class="btn small" data-act="okorder" data-i="' + o.id + '">✓ Confirm Order</button>' +
          '<button class="btn small danger" data-act="rmorder" data-i="' + o.id + '">✕ Cancel Order</button></span>' +
          '</div></div>';
      });
    }
    html += '</div>';

    html += '<div class="card"><h3>Manual Online Sale</h3><p class="sub">For orders confirmed over WhatsApp — record here so online sales count.</p>' +
      '<div class="grid">' +
      '<div class="field full"><label>Product <b>*</b></label><select id="osProd">' + selectProducts() + '</select></div>' +
      '<div class="field"><label>Boxes</label><input type="number" id="osBoxes" min="0" value="0"></div>' +
      '<div class="field"><label>Loose bottles</label><input type="number" id="osBottles" min="0" value="0"></div>' +
      '<div class="field"><label>Selling price per box (₹)</label><input type="number" id="osPrice" min="0" value="0"></div>' +
      '<div class="field"><label>Order date</label><input type="date" id="osDate" value="' + todayIso() + '"></div>' +
      '<div class="field full"><label>Customer name</label><input type="text" id="osName" placeholder="Optional"></div>' +
      '</div>' +
      '<div class="row" style="margin-top:10px;flex-wrap:wrap"><span class="hint" id="osStockLine" style="width:100%"></span><span class="hint" id="osCostLine">Cost: — · Profit: —</span><span style="flex:1"></span>' +
      '<b style="font-size:16px" id="osAmt">Total: ₹0</b><button class="btn" id="osSave">+ Record Online Sale</button></div>' +
      '</div>';
    return html;
  }

  function rSales() {
    var f = S._sf || { from: '', to: '', product: '', pay: '', status: '', q: '' };
    var html = '<div class="card"><h3>Sales History</h3>' +
      '<div class="sortbar" style="flex-wrap:wrap">' +
      searchBarHtml({ id: 'fQ', q: f.q, type: f.type || 'sell', placeholder: 'Customer / supplier / product\u2026' }) +
      '<input type="date" id="fFrom" value="' + esc(f.from) + '" title="From">' +
      '<input type="date" id="fTo" value="' + esc(f.to) + '" title="To">' +
      '<select id="fProduct" style="max-width:150px"><option value="">All products</option>' +
      S.products.map(function (p) { return '<option value="' + p.id + '"' + (f.product === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') +
      '</select>' +
      '<select id="fPay" style="max-width:120px"><option value="">All payments</option>' +
      '<option value="online"' + (f.pay === 'online' ? ' selected' : '') + '>Online</option>' +
      '<option value="cash"' + (f.pay === 'cash' ? ' selected' : '') + '>Cash</option></select>' +
      '<select id="fStatus" style="max-width:140px"><option value="">All statuses</option>' +
      '<option value="completed"' + (f.status === 'completed' ? ' selected' : '') + '>Completed</option>' +
      '<option value="cancelled"' + (f.status === 'cancelled' ? ' selected' : '') + '>Cancelled</option></select>' +
      '<button class="btn small ghost" id="fReset">Reset</button>' +
      '</div>' +
      '<div class="htable-wrap"><table class="htable"><thead><tr>' +
      '<th>#</th><th>Customer</th><th>Product</th><th>Side / Type</th><th class="money-cell">Quantity</th>' +
      '<th class="money-cell">Amount</th><th class="money-cell">Paid</th><th class="money-cell">Pending</th>' +
      '<th>Payment Type</th><th>Status</th><th>Date</th><th>Action</th>' +
      '</tr></thead><tbody>';
    var rows = S.sales.filter(function (r) {
      if (f.from && String(r.date) < f.from) return false;
      if (f.to && String(r.date) > f.to) return false;
      if (f.product && r.productId !== f.product) return false;
      if (f.pay && r.payment !== f.pay) return false;
      if (f.status && r.status !== f.status) return false;
      var q = (f.q || '').toLowerCase();
      if (q) {
        var hay = ((r.customer || '') + ' ' + (r.supplier || '') + ' ' + (r.product || '') + ' ' + (r.size || '') + ' ' + (r.ref || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    if (!rows.length) html += '<tr><td colspan="12" class="hint">No sales match these filters.</td></tr>';
    rows.forEach(function (r, i) {
      var pn = productById(r.productId);
      var side = r.size || (pn ? pn.category || '' : '');
      html += '<tr data-sale="' + r.id + '" style="cursor:pointer">' +
        '<td class="row-num">' + (i + 1) + '</td>' +
        '<td>' + custLink(r.customer, 'sell', r.date) + '</td>' +
        '<td><b>' + esc(r.product) + '</b></td>' +
        '<td>' + esc(side || '—') + '</td>' +
        '<td class="money-cell">' + (r.boxes ? r.boxes + ' box' + (r.boxes === 1 ? '' : 'es') : '') + (r.boxes && r.bottles ? ' + ' : '') + (r.bottles ? r.bottles + ' loose' : '') + '</td>' +
        '<td class="money-cell"><b>' + money(r.total) + '</b></td>' +
        '<td class="money-cell">' + money(paidOf(r)) + '</td>' +
        '<td class="money-cell" style="color:' + (pendingOf(r) > 0 ? 'var(--warn)' : 'var(--ok)') + '">' + money(pendingOf(r)) + '</td>' +
        '<td><span class="badge ' + (r.payment === 'cash' ? 'ok' : 'blu') + '">' + (r.payment === 'cash' ? 'Cash' : 'Online') + '</span></td>' +
        '<td>' + payStatus(r) + '</td>' +
        '<td class="hide-mob">' + prettyDate(r.date) + '</td>' +
        '<td><div class="mini"><button data-act="view" data-i="' + r.id + '" title="View">&#128065;</button>' +
        '<button data-act="pay" data-i="' + r.id + '" title="Update Payment">\u20B9</button>' +
        (r.status === 'completed' ? '<button data-act="cancel" data-i="' + r.id + '" class="rm" title="Cancel / refund stock">&#10005;</button>' : '') +
        '</div></td></tr>';
    });
    html += '</tbody></table></div></div>';
    return html;
  }

  function rPurchases() {
    var f = S._pf || { q: '', type: 'purchase' };
    var html = '<div class="card"><h3>Purchase History</h3>' +
      '<div class="sortbar" style="flex-wrap:wrap">' +
      searchBarHtml({ id: 'puQ', q: f.q, type: f.type || 'purchase', placeholder: 'Supplier / product\u2026' }) +
      '<button class="btn small" id="btnAddStock2">+ Add New Stock</button>' +
      '<span class="hint" style="margin-left:auto">Every purchase adds to stock and to total investment.</span>' +
      '</div>' +
      '<div class="htable-wrap"><table class="htable"><thead><tr>' +
      '<th>#</th><th>Supplier</th><th>Product</th><th>Side / Type</th><th class="money-cell">Quantity</th>' +
      '<th class="money-cell">Amount</th><th class="money-cell">Paid</th><th class="money-cell">Pending</th>' +
      '<th>Payment Type</th><th>Status</th><th>Date</th><th>Action</th>' +
      '</tr></thead><tbody>';
    var rows = S.purchases.filter(function (r) {
      var q = (f.q || '').toLowerCase();
      if (!q) return true;
      var hay = ((r.supplier || '') + ' ' + (r.product || '') + ' ' + (r.size || '')).toLowerCase();
      return hay.indexOf(q) !== -1;
    });
    if (!rows.length) html += '<tr><td colspan="12" class="hint">No purchases found' + (f.q ? ' matching "' + esc(f.q) + '"' : ' yet — add stock from the Add Stock tab') + '.</td></tr>';
    rows.forEach(function (r, i) {
      var pn = productById(r.productId);
      var side = r.size || (pn ? pn.category || '' : '');
      html += '<tr data-pu="' + r.id + '">' +
        '<td class="row-num">' + (i + 1) + '</td>' +
        '<td>' + custLink(r.supplier, 'purchase', r.date) + '</td>' +
        '<td><b>' + esc(r.product) + '</b></td>' +
        '<td>' + esc(side || '—') + '</td>' +
        '<td class="money-cell">' + r.boxes + ' box' + (r.boxes === 1 ? '' : 'es') + '</td>' +
        '<td class="money-cell"><b>' + money(r.total) + '</b></td>' +
        '<td class="money-cell">' + money(paidOf(r)) + '</td>' +
        '<td class="money-cell" style="color:' + (pendingOf(r) > 0 ? 'var(--warn)' : 'var(--ok)') + '">' + money(pendingOf(r)) + '</td>' +
        '<td><span class="badge ' + ((r.payment || 'cash') === 'cash' ? 'ok' : 'blu') + '">' + ((r.payment || 'cash') === 'cash' ? 'Cash' : 'Online') + '</span></td>' +
        '<td>' + payStatus(r) + '</td>' +
        '<td class="hide-mob">' + prettyDate(r.date) + '</td>' +
        '<td><div class="mini"><button data-act="pupay" data-i="' + r.id + '" title="Update Payment">\u20B9</button></div></td></tr>';
    });
    html += '</tbody></table></div></div>';
    return html;
  }

  function rReports() {
    var html = '<div class="card"><h3>Profit & Reports</h3>' +
      '<div class="sortbar">' +
      '<button class="btn small ' + (S._rp === 'today' ? 'on' : '') + '" data-rp="today">Today</button>' +
      '<button class="btn small ' + (S._rp === 'week' ? 'on' : '') + '" data-rp="week">This Week</button>' +
      '<button class="btn small ' + (S._rp === 'month' ? 'on' : '') + '" data-rp="month">This Month</button>' +
      '<button class="btn small ' + (S._rp === 'lastmonth' ? 'on' : '') + '" data-rp="lastmonth">Last Month</button>' +
      '<button class="btn small ' + (S._rp === 'all' || !S._rp ? 'on' : '') + '" data-rp="all">All Time</button>' +
      '<input type="date" id="rpFrom" value="' + esc(S._rpFrom || '') + '" title="Custom from">' +
      '<input type="date" id="rpTo" value="' + esc(S._rpTo || '') + '" title="Custom to">' +
      '<button class="btn small ghost" id="rpApply">Apply Custom</button>' +
      '</div>' +
      '<div class="kpi" style="grid-template-columns:repeat(4,1fr)">' +
      kpiCard('Total Sales', money(RP.sales), RP.orders + ' orders') +
      kpiCard('Online Sales', money(RP.online), '', 'small') +
      kpiCard('Cash Sales', money(RP.cash), '', 'small') +
      kpiCard('COGS', money(RP.cogs), 'cost of goods sold') +
      kpiCard('Gross Profit', money(RP.profit), RP.sales ? Math.round(RP.profit / RP.sales * 100) + '% margin' : '', 'green') +
      kpiCard('Boxes Sold', RP.boxes, 'units sold ' + (RP.boxes * 12 + RP.bottles)) +
      kpiCard('Products Sold', RP.products, 'distinct products') +
      '</div>' +
      '</div>' +
      '<div class="card"><h3>Product Performance</h3>' +
      '<div class="sortbar">' +
      '<button class="btn small ' + (S._psort === 'sales' || !S._psort ? 'on' : '') + '" data-psort="sales">Highest Sales</button>' +
      '<button class="btn small ' + (S._psort === 'profit' ? 'on' : '') + '" data-psort="profit">Highest Profit</button>' +
      '<button class="btn small ' + (S._psort === 'qty' ? 'on' : '') + '" data-psort="qty">Most Sold</button>' +
      '<button class="btn small ' + (S._psort === 'low' ? 'on' : '') + '" data-psort="low">Lowest Stock</button>' +
      '<button class="btn small ' + (S._psort === 'high' ? 'on' : '') + '" data-psort="high">Highest Stock</button>' +
      '</div>' +
      '<div class="htable-wrap"><table class="htable"><thead><tr>' +
      '<th>Product</th><th>Boxes Sold</th><th>Bottles Sold</th><th class="money-cell">Sales</th><th class="money-cell">Online</th><th class="money-cell">Cash</th>' +
      '<th class="money-cell">Cost</th><th class="money-cell">Profit</th><th>Margin</th><th>Stock</th><th>Status</th>' +
      '</tr></thead><tbody>';
    PERF.forEach(function (row) {
      html += '<tr><td><b>' + esc(row.p.name) + '</b></td><td>' + row.boxes + '</td><td>' + row.bottles + '</td>' +
        '<td class="money-cell">' + money(row.sales) + '</td><td class="money-cell">' + money(row.online) + '</td><td class="money-cell">' + money(row.cash) + '</td>' +
        '<td class="money-cell">' + money(row.cost) + '</td><td class="money-cell" style="color:var(--ok)">' + money(row.profit) + '</td>' +
        '<td>' + (row.sales ? Math.round(row.profit / row.sales * 100) : 0) + '%</td>' +
        '<td>' + stockBoxes(row.p) + ' boxes</td><td>' + statusBadge(row.p, S.settings.minStock) + '</td></tr>';
    });
    html += '</tbody></table></div></div>';
    return html;
  }

  function rToday() {
    var tk = todayKey();
    var today = salesInRange(S.sales, tk, tk);
    var cash = today.filter(function (r) { return r.payment === 'cash'; });
    var online = today.filter(function (r) { return r.payment === 'online'; });
    var ck = kpiOf(cash), ok2 = kpiOf(online);
    var html = '<div class="card"><h3>Today\u2019s Sales</h3><p class="sub">' + prettyDate(tk) + ' — aaj ke din me kya kya bika (online + cash dono).</p>' +
      '<div class="dash-grid">' +
      kpiCard('Total Today', money(ck.sales + ok2.sales), today.length + ' sales', '') +
      kpiCard('Cash Payments', money(ck.sales), cash.length + ' sales', '') +
      kpiCard('Online Payments', money(ok2.sales), online.length + ' sales', 'blu') +
      kpiCard('Profit Today', money(ck.profit + ok2.profit), '', '') +
      '</div></div>';
    function table(list, title, tone) {
      var out = '<div class="card"><h3>' + title + '</h3>';
      if (!list.length) out += '<p class="hint">Aaj is payment me koi sale nahi hui.</p>';
      else {
        out += '<div class="htable-wrap"><table class="htable"><thead><tr>' +
          '<th>Time</th><th>Sale ID</th><th>Customer</th><th>Product</th><th>Boxes</th><th>Bottles</th><th>Payment</th>' +
          '<th class="money-cell">Amount</th><th class="money-cell">Cost</th><th class="money-cell">Profit</th><th></th>' +
          '</tr></thead><tbody>';
        list.forEach(function (r) {
          out += '<tr>' + '<td>' + timeOf(r) + '</td><td>' + esc(r.ref) + '</td><td>' + custLink(r.customer, 'sell', r.date) + '</td>' +
            '<td><b>' + esc(r.product) + '</b> ' + esc(r.size) + '</td>' +
            '<td>' + r.boxes + '</td><td>' + r.bottles + '</td>' +
            '<td><span class="badge ' + (r.payment === 'cash' ? 'ok' : 'blu') + '">' + (r.payment === 'cash' ? 'Cash Payment' : 'Online Payment') + '</span></td>' +
            '<td class="money-cell"><b>' + money(r.total) + '</b></td><td class="money-cell">' + money(r.cost) + '</td>' +
            '<td class="money-cell" style="color:var(--ok)">' + money(r.profit) + '</td>' +
            '<td><div class="mini"><button data-act="view" data-i="' + r.id + '" title="View">&#128065;</button></div></td></tr>';
        });
        out += '</tbody></table></div>';
        var tk2 = kpiOf(list);
        out += '<div class="row" style="margin-top:10px;justify-content:space-between;flex-wrap:wrap"><span class="hint">Total: <b>' + money(tk2.sales) + '</b> · ' + tk2.boxes + ' boxes · ' + tk2.bottles + ' loose bottles</span></div>';
      }
      out += '</div>';
      return out;
    }
    html += table(cash, 'Cash Payments (Offline)', 'ok') + table(online, 'Online Payments', 'blu');
    return html;
  }

  function rAlerts() {
    var low = [], out = [], none = [];
    S.products.forEach(function (p) {
      var st = stockStatus(p, S.settings.minStock);
      if (st === 'out') out.push(p); else if (st === 'low') low.push(p); else if (st === 'none') none.push(p);
    });
    var html = '<div class="card"><h3>Low Stock Alerts</h3>' +
      '<p class="sub">Products at or below ' + num(S.settings.minStock) + ' boxes. Click a product to open its details.</p>';
    if (!low.length && !out.length) html += '<p class="hint">Koi product low stock me nahi hai. \u2713</p>';
    low.forEach(function (p) {
      html += '<div class="alert-item warn" data-open-inv="' + p.id + '"><span><b>' + esc(p.name) + '</b> — only <b>' + stockBoxes(p) + ' boxes</b> left (' + stockInBottles(p) + ' bottles, min ' + num(p.minStock) + ')</span><span class="badge warn">Low stock</span></div>';
    });
    html += '</div><div class="card"><h3>Out of Stock</h3>';
    if (!out.length) html += '<p class="hint">Koi product out of stock nahi hai. \u2713</p>';
    out.forEach(function (p) {
      html += '<div class="alert-item err" data-open-inv="' + p.id + '"><span><b>' + esc(p.name) + '</b> is currently out of stock.</span><span class="badge err">Out of stock</span></div>';
    });
    if (none.length) {
      html += '</div><div class="card"><h3>Not Stocked Yet</h3><p class="sub">In products ka stock abhi add nahi hua hai (Add Stock se daalein). Ye low-stock alert me nahi dikhte.</p>';
      none.forEach(function (p) {
        html += '<div class="alert-item" data-open-inv="' + p.id + '"><span><b>' + esc(p.name) + '</b> — no stock added yet</span><span class="badge gray">No stock yet</span></div>';
      });
    }
    html += '</div>';
    return html;
  }

  function rCustomers() {
    if (S._custOpen) return rCustomerDash();
    var kind = S._custListKind || 'sell';
    var html = '<div class="card"><h3>Customers</h3><p class="sub">Har customer/supplier ke saare orders 1 list me — kisi bhi line par tap karo to uski puri report (today / 7 days / month) khulegi. Top search bar (Ctrl K) me bhi naam se Dhund sakte ho.</p>' +
      '<div class="sortbar" style="flex-wrap:wrap">' +
      '<button class="btn small ' + (kind === 'sell' ? 'on' : '') + '" data-clist="sell" type="button">Sell Customers</button>' +
      '<button class="btn small ' + (kind === 'purchase' ? 'on' : '') + '" data-clist="purchase" type="button">Purchase Customers</button>' +
      '</div>' +
      '<div class="htable-wrap"><table class="htable"><thead><tr>' +
      '<th>#</th><th>' + (kind === 'purchase' ? 'Supplier' : 'Customer') + '</th><th>Bottles</th><th>Orders</th><th class="money-cell">Boxes</th>' +
      '<th class="money-cell">Amount</th><th class="money-cell">Paid</th><th class="money-cell">Pending</th><th>Last</th><th></th>' +
      '</tr></thead><tbody>';
    var list = kind === 'purchase' ? suppliersOf() : customersOf();
    var nm = {};
    list.forEach(function (c) {
      var k = c.name.toLowerCase();
      if (!nm[k]) nm[k] = { name: c.name, orders: 0, total: 0, last: '' };
      nm[k].orders += c.orders;
      nm[k].total += c.total;
      if (c.last > nm[k].last) nm[k].last = c.last;
    });
    list = Object.keys(nm).map(function (k) { return nm[k]; });
    list.sort(function (a, b) { return b.total - a.total; });
    if (!list.length) html += '<tr><td colspan="10" class="hint">' + (kind === 'purchase' ? 'No suppliers yet — add stock with a supplier name.' : 'No customers yet — add a cash or online sale with a name.') + '</td></tr>';
    list.forEach(function (c, i) {
      var recs = custRecords(kind).filter(function (r) {
        return String(kind === 'purchase' ? r.supplier : r.customer).trim() === c.name;
      });
      var agg = custAgg(recs, 'all');
      var pm = {};
      recs.forEach(function (r) {
        var pk = (r.product || '?') + '|' + (r.size || '');
        if (pm[pk] === undefined) pm[pk] = (r.product || '?') + (r.size ? ' ' + r.size : '');
      });
      var pnames = Object.keys(pm).map(function (k) { return pm[k]; });
      var bottleTxt = pnames.length ? pnames.slice(0, 2).join(', ') + (pnames.length > 2 ? ' +' + (pnames.length - 2) + ' more' : '') : '—';
      html += '<tr style="cursor:pointer" data-custrow="' + esc(c.name) + '" data-custkind="' + kind + '">' +
        '<td class="row-num">' + (i + 1) + '</td>' +
        '<td><b>' + esc(c.name) + '</b></td>' +
        '<td>' + esc(bottleTxt) + '</td>' +
        '<td>' + c.orders + '</td>' +
        '<td class="money-cell">' + agg.boxes + (agg.bottles ? ' + ' + agg.bottles + ' loose' : '') + '</td>' +
        '<td class="money-cell"><b>' + money(c.total) + '</b></td>' +
        '<td class="money-cell">' + money(agg.paid) + '</td>' +
        '<td class="money-cell" style="color:' + (agg.pending > 0 ? 'var(--warn)' : 'var(--ok)') + '">' + money(agg.pending) + '</td>' +
        '<td class="hide-mob">' + prettyDate(c.last) + '</td>' +
        '<td><button class="btn small ghost" data-custopen="' + esc(c.name) + '" data-custkind="' + kind + '">Open Report</button></td></tr>';
    });
    html += '</tbody></table></div></div>';
    return html;
  }

  function rCustomerDash() {
    var c = S._custOpen;
    var kind = c.kind;
    var name = c.name;
    var period = c.period ? c.period : '7d';
    var list = custRecords(kind).filter(function (r) {
      return String(kind === 'purchase' ? r.supplier : r.customer).trim() === name;
    });
    var agg = custAgg(list, period);
    var pl = periodLabel(period);
    var perBtns = ['today', '7d', 'month', 'all'].map(function (p) {
      return '<button class="btn small ' + (period === p ? 'on' : '') + '" data-per="' + p + '" type="button">' + periodLabel(p) + '</button>';
    }).join('');
    var html = '<div class="card">' +
      '<div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:8px">' +
      '<h3 style="margin:0">' + esc(name) + ' <span class="badge ' + (kind === 'purchase' ? 'blu' : 'ok') + '">' + (kind === 'purchase' ? 'PURCHASE' : 'SELL') + '</span></h3>' +
      '<button class="btn small ghost" id="cDashBack" type="button">\u2190 All Customers</button></div>' +
      '<div class="sortbar" style="flex-wrap:wrap">' + perBtns + '<span class="hint">' + pl + ' ka total</span></div>' +
      '<div class="kpi" style="margin-top:6px">' +
      kpiCard('Orders Given', agg.orders, pl, '') +
      kpiCard('Boxes Given', agg.boxes + (agg.bottles ? ' + ' + agg.bottles + ' loose' : ''), 'tap \u2192 kaunse bottle ke', agg.boxes ? 'green' : '', 'kpiBoxes') +
      kpiCard('Amount', money(agg.amount), pl, '') +
      kpiCard('Paid', money(agg.paid), pl, '') +
      kpiCard('Pending', money(agg.pending), pl + ' me baki', agg.pending > 0 ? 'yellow' : '') +
      '</div>' +
      '<div class="hint" style="margin-top:8px" id="cDashHint">\uD83D\uDCCD "Boxes" card par tap karo — pata chalega kis bottle ke kitne box diye. Neeche har din ka total.</div>' +
      '</div>';
    var days = {};
    list.forEach(function (r) { if (custInPeriod(r, period)) { (days[r.date] = days[r.date] || []).push(r); } });
    var dayKeys = Object.keys(days).sort(function (a, b) { return String(b).localeCompare(String(a)); });
    if (!dayKeys.length) {
      html += '<div class="card"><p class="hint">' + pl + ' me koi entry nahi.</p></div>';
      return html;
    }
    html += '<div class="card"><h3>Day-wise</h3>';
    dayKeys.forEach(function (dk) {
      var drecs = days[dk];
      var da = custAgg(drecs, 'all');
      var open = c.day === dk;
      html += '<div class="card" style="background:var(--panel2);padding:10px 12px;margin-bottom:10px">' +
        '<div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px;cursor:pointer" data-day="' + esc(dk) + '">' +
        '<span><b>' + prettyDate(dk) + '</b> <span class="badge blu">' + da.orders + ' order' + (da.orders === 1 ? '' : 's') + '</span></span>' +
        '<span class="hint">' + da.boxes + ' boxes' + (da.bottles ? ' + ' + da.bottles + ' loose' : '') + ' \u00B7 ' + money(da.amount) +
        ' \u00B7 Pending <b style="color:' + (da.pending > 0 ? 'var(--warn)' : 'var(--ok)') + '">' + money(da.pending) + '</b>' +
        (open ? ' \u25B2' : ' \u25BC') + '</span></div>' +
        (open
          ? '<div class="htable-wrap" style="margin-top:8px"><table class="htable" style="min-width:520px"><thead><tr>' +
            '<th>#</th><th>Product</th><th>Side</th><th>Quantity</th><th class="money-cell">Amount</th>' +
            '<th class="money-cell">Paid</th><th class="money-cell">Pending</th><th>Payment</th><th>Action</th></tr></thead><tbody>' +
            drecs.map(function (r, i) {
              return '<tr><td class="row-num">' + (i + 1) + '</td>' +
                '<td><b>' + esc(r.product) + '</b></td><td>' + esc(r.size || '—') + '</td>' +
                '<td>' + (r.boxes ? r.boxes + ' box' + (r.boxes === 1 ? '' : 'es') : '') + (r.boxes && r.bottles ? ' + ' : '') + (r.bottles ? r.bottles + ' loose' : '') + '</td>' +
                '<td class="money-cell">' + money(r.total) + '</td>' +
                '<td class="money-cell">' + money(paidOf(r)) + '</td>' +
                '<td class="money-cell" style="color:' + (pendingOf(r) > 0 ? 'var(--warn)' : 'var(--ok)') + '">' + money(pendingOf(r)) + '</td>' +
                '<td><span class="badge ' + ((r.payment || 'cash') === 'cash' ? 'ok' : 'blu') + '">' + ((r.payment || 'cash') === 'cash' ? 'Cash' : 'Online') + '</span></td>' +
                '<td><div class="mini">' +
                (kind === 'purchase'
                  ? '<button data-act="pupay" data-i="' + r.id + '" title="Update Payment">\u20B9</button>'
                  : '<button data-act="view" data-i="' + r.id + '" title="View">&#128065;</button><button data-act="pay" data-i="' + r.id + '" title="Payment">\u20B9</button>') +
                '</div></td></tr>';
            }).join('') +
            '</tbody></table></div>'
          : '') +
        '</div>';
    });
    html += '</div>';
    return html;
  }

  function rSettings() {
    var html = '<div class="card"><h3>Business Settings</h3><div class="grid">' +
      '<div class="field"><label>Business name</label><input type="text" id="bsName" value="' + esc(S.settings.bizName) + '"></div>' +
      '<div class="field"><label>Default minimum stock (boxes)</label><input type="number" id="bsMin" min="0" value="' + num(S.settings.minStock) + '"></div>' +
      '<div class="field"><label>Initial capital / opening inventory value (₹)</label><input type="number" id="bsCap" min="0" value="' + num(S.settings.initialCapital) + '"></div>' +
      '<div class="field"><label>Storage</label><div class="hint" style="margin-top:6px">' + (apiOk ? 'Server file (data/business.json) — shared.' : 'This browser only (localStorage).') + '</div></div>' +
      '</div>' +
      '<div class="row" style="margin-top:12px"><button class="btn" id="bsSave">Save Settings</button></div>' +
      '</div>' +
      '<div class="card"><h3>Business Data Backup</h3>' +
      '<div class="row"><button class="btn small ghost" id="bsExport">Export business.json</button>' +
      '<button class="btn small ghost" id="bsImport">Import business.json</button>' +
      '<button class="btn small danger" id="bsReset">Reset business data</button></div>' +
      '<div class="hint" style="margin-top:10px">Export downloads the full inventory + sales + purchases file. Import restores it. Reset wipes all business data back to the fresh catalog — careful!</div>' +
      '</div>';
    return html;
  }

  /* ---------------- detail modal builders ---------------- */
  function saleModal(id) {
    var r = null;
    for (var i = 0; i < S.sales.length; i++) if (S.sales[i].id === id) { r = S.sales[i]; break; }
    if (!r) return;
    var b = function (t, v) { return '<div class="row" style="justify-content:space-between"><span class="hint">' + t + '</span><b>' + v + '</b></div>'; };
    var html = '<div class="modal-back" id="modalBack"><div class="modal modal-wrap">' +
      '<button class="modal-close" id="modalClose">&#10005;</button>' +
      '<h3>Sale ' + esc(r.ref) + '</h3>' +
      '<div class="detail-dl">' +
      '<dt>Date</dt><dd>' + prettyDate(r.date) + '</dd>' +
      '<dt>Product</dt><dd>' + esc(r.product) + (r.size ? ' ' + esc(r.size) : '') + '</dd>' +
      '<dt>Quantity</dt><dd>' + r.boxes + ' boxes + ' + r.bottles + ' bottles (' + r.bottlesPerBox + ' / box)</dd>' +
      '<dt>Payment</dt><dd>' + r.payment + '</dd>' +
      '<dt>Source</dt><dd>' + (r.source === 'website' ? 'Website order' : 'Manual entry') + '</dd>' +
      '<dt>Customer</dt><dd>' + esc(r.customer || '—') + (r.phone ? ' · ' + esc(r.phone) : '') + '</dd>' +
      '<dt>Amount</dt><dd>' + money(r.total) + '</dd>' +
      '<dt>Paid</dt><dd>' + money(paidOf(r)) + '</dd>' +
      '<dt>Pending</dt><dd style="color:' + (pendingOf(r) > 0 ? 'var(--warn)' : 'var(--ok)') + '">' + money(pendingOf(r)) + '</dd>' +
      '<dt>Cost</dt><dd>' + money(r.cost) + '</dd>' +
      '<dt>Profit</dt><dd style="color:var(--ok)">' + money(r.profit) + '</dd>' +
      '<dt>Status</dt><dd><span class="badge ' + (r.status === 'cancelled' ? 'err' : 'ok') + '">' + r.status + '</span> ' + payStatus(r) + '</dd>' +
      (r.notes ? '<dt>Notes</dt><dd>' + esc(r.notes) + '</dd>' : '') +
      '</div>' +
      '<div class="modal-foot">' +
      (r.status === 'completed' ? '<button class="btn danger" id="modalCancel">Cancel Sale (restore stock)</button>' : '') +
      '<button class="btn" id="modalPay" style="margin-right:auto">\u20B9 Update Payment</button>' +
      '<button class="btn ghost" id="modalClose2">Close</button></div>' +
      '</div></div>';
    showModal(html, function () {
      var c = $('modalCancel');
      if (c) c.onclick = function () { cancelSale(r.id); saveBiz(); closeModal(); goto('biz-sales'); };
      var p = $('modalPay');
      if (p) p.onclick = function () { closeModal(); paymentModal('sale', r.id); };
    });
  }
  function productModal(id) {
    var isNew = !id;
    var p = id ? productById(id) : null;
    var v = function (k, d) { return p && p[k] != null ? esc(p[k]) : esc(d || ''); };
    var n = function (k, d) { return p && p[k] != null ? num(p[k]) : esc(d || ''); };
    var html = '<div class="modal-back" id="modalBack"><div class="modal modal-wrap">' +
      '<button class="modal-close" id="modalClose">&#10005;</button>' +
      '<h3>' + (isNew ? 'Add Product' : 'Edit ' + esc(p.name)) + '</h3>' +
      '<div class="grid">' +
      '<div class="field"><label>Product name <b>*</b></label><input type="text" id="pmName" value="' + v('name') + '"></div>' +
      '<div class="field"><label>Brand</label><input type="text" id="pmBrand" value="' + v('brand') + '"></div>' +
      '<div class="field"><label>Category</label><input type="text" id="pmCat" value="' + v('category') + '"></div>' +
      '<div class="field"><label>Bottle size</label><input type="text" id="pmSize" value="' + v('size') + '" placeholder="1 LITRE"></div>' +
      '<div class="field"><label>Bottles per box <b>*</b></label><input type="number" id="pmBpb" min="1" value="' + n('bottlesPerBox', 12) + '"></div>' +
      '<div class="field"><label>Minimum stock (boxes)</label><input type="number" id="pmMin" min="0" value="' + n('minStock', S.settings.minStock) + '"></div>' +
      '<div class="field"><label>Cost per box (₹)</label><input type="number" id="pmCost" min="0" value="' + n('cost') + '"></div>' +
      '<div class="field"><label>Selling price per box (₹)</label><input type="number" id="pmPrice" min="0" value="' + n('price') + '"></div>' +
      '</div>' +
      '<div class="hint">Price/cost changes apply to future sales only.</div>' +
      '<div class="modal-foot"><button class="btn danger" id="pmDelete" style="margin-right:auto">Delete</button>' +
      '<button class="btn ghost" id="modalClose2">Cancel</button><button class="btn" id="pmSave">Save</button></div>' +
      '</div></div>';
    showModal(html, function () {
      $('pmSave').onclick = function () {
        var data = {
          name: $('pmName').value, brand: $('pmBrand').value, category: $('pmCat').value, size: $('pmSize').value,
          bottlesPerBox: $('pmBpb').value, minStock: $('pmMin').value, cost: $('pmCost').value, price: $('pmPrice').value
        };
        if (!data.name.trim()) { toast('Product name is required.', true); return; }
        if (isNew) addProduct(data); else updateProduct(id, data);
        saveBiz(); closeModal(); goto('biz-products');
      };
      var del = $('pmDelete');
      if (del) del.onclick = function () {
        if (!confirm('Delete this product from the master? Past sales/purchases stay in history.')) return;
        S.products = S.products.filter(function (x) { return x.id !== id; });
        saveBiz(); closeModal(); goto('biz-products');
      };
    });
  }
  function adjustModal(id) {
    var p = productById(id);
    if (!p) return;
    var html = '<div class="modal-back" id="modalBack"><div class="modal modal-wrap">' +
      '<button class="modal-close" id="modalClose">&#10005;</button>' +
      '<h3>Adjust Stock — ' + esc(p.name) + '</h3>' +
      '<p class="sub">For damaged / broken / expired / missing stock or manual correction. Current stock: <b>' + stockInBottles(p) + ' bottles</b> (' + stockBoxes(p) + ' boxes + ' + stockLoose(p) + ').</p>' +
      '<div class="grid">' +
      '<div class="field"><label>Quantity to remove <b>*</b></label><input type="number" id="adQty" min="1" value="1"></div>' +
      '<div class="field"><label>Unit</label><select id="adUnit"><option value="bottle">Bottles</option><option value="box">Boxes</option></select></div>' +
      '<div class="field full"><label>Reason / type</label><select id="adType">' +
      '<option>Damaged</option><option>Broken</option><option>Expired</option><option>Missing</option><option>Manual correction</option></select></div>' +
      '<div class="field full"><label>Notes</label><input type="text" id="adNotes" placeholder="Optional"></div>' +
      '<div class="field full"><label>Date</label><input type="date" id="adDate" value="' + todayIso() + '"></div>' +
      '</div>' +
      '<div class="modal-foot"><button class="btn ghost" id="modalClose2">Cancel</button>' +
      '<button class="btn danger" id="adSave">Remove from Stock</button></div>' +
      '</div></div>';
    showModal(html, function () {
      $('adSave').onclick = function () {
        var q = num($('adQty').value);
        if (q < 1) { toast('Enter a quantity.', true); return; }
        addAdjustment({
          productId: id, qty: q, unit: $('adUnit').value, type: $('adType').value,
          notes: $('adNotes').value, date: $('adDate').value
        });
        saveBiz(); closeModal(); goto('biz-inventory');
      };
    });
  }
  function customerModal(idx) {
    var cust = customersOf().sort(function (a, b) { return b.total - a.total; })[idx];
    if (!cust) return;
    var rows = S.sales.filter(function (r) {
      return r.status !== 'cancelled' && r.customer === cust.name && (r.phone || '') === cust.phone;
    });
    var html = '<div class="modal-back" id="modalBack"><div class="modal modal-wrap">' +
      '<button class="modal-close" id="modalClose">&#10005;</button>' +
      '<h3>' + esc(cust.name) + '</h3>' +
      '<div class="detail-dl"><dt>Phone</dt><dd>' + esc(cust.phone || '—') + '</dd>' +
      '<dt>Orders</dt><dd>' + cust.orders + '</dd><dt>Total Spent</dt><dd>' + money(cust.total) + '</dd>' +
      '<dt>Last Order</dt><dd>' + prettyDate(cust.last) + '</dd></div>' +
      '<div class="htable-wrap" style="margin-top:12px"><table class="htable" style="min-width:420px"><thead><tr>' +
      '<th>Date</th><th>Product</th><th>Payment</th><th class="money-cell">Amount</th></tr></thead><tbody>';
    rows.slice(0, 20).forEach(function (r) {
      html += '<tr><td>' + prettyDate(r.date) + '</td><td>' + esc(r.product) + '</td><td>' + r.payment + '</td><td class="money-cell">' + money(r.total) + '</td></tr>';
    });
    html += '</tbody></table></div><div class="modal-foot"><button class="btn ghost" id="modalClose2">Close</button></div>' +
      '</div></div>';
    showModal(html);
  }
  function showModal(html, wire) {
    var div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div);
    var close = function () { if (div.parentNode) div.parentNode.removeChild(div); };
    var c1 = div.querySelector('#modalClose'), c2 = div.querySelector('#modalClose2');
    if (c1) c1.onclick = close;
    if (c2) c2.onclick = close;
    div.addEventListener('click', function (e) { if (e.target && e.target.id === 'modalBack') close(); });
    if (wire) wire();
  }
  function closeModal() {
    var m = document.getElementById('modalBack');
    if (m && m.parentNode) m.parentNode.removeChild(m);
  }

  /* ---------------- wiring ---------------- */
  function afterRender() {
    var cv;
    if (tab === 'biz-dash') {
      var k = kpiOf(salesInRange(S.sales, todayKey(), todayKey()));
      var all = kpiOf(S.sales);
      $('qaProduct').onclick = function () { productModal(null); };
      $('qaStock').onclick = function () { goto('biz-stock'); };
      $('qaCash').onclick = function () { goto('biz-cash'); };
      $('qaOnline').onclick = function () { goto('biz-orders'); };
      $('qaInventory').onclick = function () { goto('biz-inventory'); };
      $('qaOrders').onclick = function () { goto('biz-orders'); };
      $('qaReports').onclick = function () { goto('biz-reports'); };
      var biPanel = $('biPanel');
      if (biPanel) { biPanel.onclick = function () { goto('biz-reports'); }; }
      $('content').querySelectorAll('[data-open-inv]').forEach(function (el) {
        el.addEventListener('click', function () { S._invSearch = el.getAttribute('data-open-inv'); goto('biz-inventory'); });
      });
      $('content').querySelectorAll('[data-open-orders]').forEach(function (el) {
        el.addEventListener('click', function () { S._ordSection = 'PENDING'; goto('biz-orders'); });
      });
      wireDashOrders();
      /* charts */
      var days = [], vals = [], valsCash = [], valsOnline = [];
      for (var i = 13; i >= 0; i--) {
        var dk = dateKey(addDays(new Date(), -i));
        days.push(dk);
        var pk = kpiOf(salesInRange(S.sales, dk, dk));
        vals.push(pk.sales); valsCash.push(pk.cash); valsOnline.push(pk.online);
      }
      if ((cv = $('cSales'))) barChart(cv, days, vals, '#38D9FF', { stack2: true, values2: valsCash, color2: 'rgba(53,224,161,.55)' });
      if ((cv = $('cPay'))) donutChart(cv, [all.online, all.cash], ['#38D9FF', '#35E0A1'], money(all.sales));
      var wkLabels = [], wkVals = [];
      for (var w = 7; w >= 0; w--) {
        var wStart = addDays(startOfWeek(new Date()), -7 * w);
        var wEnd = addDays(wStart, 6);
        wkLabels.push(dateKey(wStart));
        wkVals.push(kpiOf(salesInRange(S.sales, dateKey(wStart), dateKey(wEnd))).profit);
      }
      if ((cv = $('cProfit'))) lineChart(cv, wkLabels, wkVals, '#35E0A1');
      var pPerf = perfRows();
      var top = pPerf.slice(0, 6);
      if ((cv = $('cProd'))) hbarChart(cv, top.map(function (r) { return r.p.name; }), top.map(function (r) { return r.sales; }), '#38D9FF');
      var lowN = 0, outN = 0, okN = 0, noneN = 0;
      S.products.forEach(function (p) {
        var st = stockStatus(p, S.settings.minStock);
        if (st === 'out') outN++; else if (st === 'low') lowN++; else if (st === 'none') noneN++; else okN++;
      });
      if ((cv = $('cInv'))) donutChart(cv, [okN, lowN, outN, noneN], ['#35E0A1', '#FFC857', '#FF5C7A', '#5E6B7D'], S.products.length + ' products');
    }
    if (tab === 'biz-inventory') {
      wireSearchBar('invSearch', function () {
        var el = $('invSearch');
        var pos = el ? (el.selectionStart || el.value.length) : 0;
        S._invSearch = el ? el.value : '';
        render();
        var q2 = $('invSearch');
        if (q2) { q2.focus(); try { q2.setSelectionRange(pos, pos); } catch (e) {} }
      });
      $('btnAddProduct').onclick = function () { productModal(null); };
      $('btnAddStock').onclick = function () { goto('biz-stock'); };
      $('content').querySelectorAll('tr[data-prod]').forEach(function (tr) {
        tr.addEventListener('click', function () {
          var id = tr.getAttribute('data-prod');
          var act = tr.querySelector('button[data-act]');
          if (act && act.getAttribute('data-act') === 'editp') return productModal(id);
          adjustModal(id);
        });
      });
      $('content').querySelectorAll('button[data-act]').forEach(function (b) {
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          var act = b.getAttribute('data-act'), id = b.getAttribute('data-i');
          if (act === 'editp') productModal(id);
          else if (act === 'adj') adjustModal(id);
        });
      });
    }
    if (tab === 'biz-products') {
      $('btnAddProduct2').onclick = function () { productModal(null); };
      $('content').querySelectorAll('button[data-act]').forEach(function (b) {
        b.addEventListener('click', function () {
          var act = b.getAttribute('data-act'), id = b.getAttribute('data-i');
          if (act === 'editp') productModal(id);
          else if (act === 'rmp') {
            if (!confirm('Delete this product?')) return;
            S.products = S.products.filter(function (x) { return x.id !== id; });
            saveBiz(); render();
          }
        });
      });
    }
    if (tab === 'biz-stock') {
      var stSel = $('stProd');
      function stCostHint() {
        var p = productById(stSel.value);
        if (p) { $('stCost').value = p.cost; $('stHint').textContent = p.name + ': last cost ₹' + p.cost + '/box, ' + boxBottles(p) + ' bottles/box. Stock ab: ' + stockBoxes(p) + ' boxes (' + stockInBottles(p) + ' bottles).'; }
        else { $('stCost').value = 0; $('stHint').textContent = 'Select a product — cost auto-fills from its master record.'; }
      }
      stSel.addEventListener('change', stCostHint);
      stCostHint();
      $('stSave').onclick = function () {
        var pid = stSel.value;
        if (!pid) { toast('Select a product first.', true); return; }
        var boxes = num($('stBoxes').value);
        if (boxes < 1) { toast('Boxes must be at least 1.', true); return; }
        var cost = $('stCost').value;
        var paidVal = $('stPaid').value;
        if (paidVal === '') paidVal = boxes * num(cost);
        var rec = addPurchase({ productId: pid, boxes: boxes, costPerBox: cost, supplier: $('stSupplier').value, notes: $('stNotes').value, date: $('stDate').value, payment: $('stPay').value, paid: paidVal });
        saveBiz(); render();
        toast('Stock added: ' + rec.boxes + ' boxes of ' + rec.product + '. \u2713');
      };
    }
    if (tab === 'biz-cash') {
      var csInput = $('csProdInput');
      var csHidden = $('csProd');
      var csDropdown = $('csProdDropdown');
      function renderComboOptions(filter) {
        var f = norm(filter || '');
        var html = '';
        S.products.forEach(function (p) {
          var label = p.name + ' ' + p.size;
          if (f && norm(label).indexOf(f) === -1) return;
          html += '<div class="combo-item" data-pid="' + p.id + '">' + esc(label) + ' — ₹' + p.price + '/box</div>';
        });
        if (!html) html = '<div class="combo-item" style="color:#5a6b6e">No products found</div>';
        csDropdown.innerHTML = html;
      }
      csInput.addEventListener('focus', function () { renderComboOptions(csInput.value); csDropdown.style.display = 'block'; });
      csInput.addEventListener('input', function () { renderComboOptions(csInput.value); csDropdown.style.display = 'block'; csHidden.value = ''; });
      csDropdown.addEventListener('click', function (e) {
        var item = e.target.closest('.combo-item');
        if (!item) return;
        var pid = item.getAttribute('data-pid');
        if (!pid) return;
        var p = productById(pid);
        if (p) { csInput.value = p.name + ' ' + p.size; csHidden.value = pid; csCalc(); }
        csDropdown.style.display = 'none';
      });
      document.addEventListener('click', function (e) { if (!e.target.closest('.combo-wrap')) csDropdown.style.display = 'none'; });
      function csCalc() {
        var p = productById(csHidden.value);
        var boxes = num($('csBoxes').value), bottles = num($('csBottles').value);
        if (p) {
          $('csPrice').value = p.price;
          var ppb = num($('csPrice').value) || p.price;
          var bpb = boxBottles(p);
          var total = boxes * ppb + bottles * (ppb / bpb);
          var cost = boxes * p.cost + bottles * (p.cost / bpb);
          var have = stockInBottles(p);
          var after = have - (boxes * bpb + bottles);
          $('csStockLine').innerHTML = '<b>' + esc(p.name) + ' ' + esc(p.size) + '</b> — stock ab: <b>' + stockBoxes(p) + ' boxes</b> (' + have + ' bottles). Entry ke baad: <b style="color:' + (after < num(S.settings.minStock) * bpb ? 'var(--warn)' : 'var(--ok)') + '">' + Math.floor(after / bpb) + ' boxes</b> bachenge' + (after < num(S.settings.minStock) * bpb ? ' — low stock alert!' : '');
          $('csCostLine').textContent = 'Cost: ' + money(cost) + ' · Profit: ' + money(total - cost);
          $('csAmt').textContent = 'Total: ' + money(total);
        } else { $('csStockLine').textContent = ''; $('csCostLine').textContent = 'Select a product.'; $('csAmt').textContent = 'Total: ₹0'; }
      }
      csInput.addEventListener('change', csCalc);
      ['csBoxes', 'csBottles', 'csPrice'].forEach(function (id) { $(id).addEventListener('input', csCalc); });
      csCalc();
      $('csSave').onclick = function () {
        var pid = csHidden.value;
        if (!pid) { toast('Select a product first.', true); return; }
        var res = recordSale({
          productId: pid, boxes: $('csBoxes').value, bottles: $('csBottles').value,
          pricePerBox: $('csPrice').value, customer: $('csName').value, notes: $('csNotes').value,
          date: $('csDate').value, payment: 'cash', source: 'manual', paid: $('csPaid').value
        });
        if (res && res.error) { toast(res.error, true); return; }
        saveBiz(); render();
        var p2 = productById(pid);
        toast('Cash sale recorded. \u2713 ' + (p2 ? esc(p2.name) + ' me ab ' + stockBoxes(p2) + ' boxes bache hain.' : ''));
      };
    }
    if (tab === 'biz-orders') {
      wireTrackedOrders();
      $('content').querySelectorAll('button[data-act]').forEach(function (b) {
        b.addEventListener('click', function () {
          var act = b.getAttribute('data-act'), id = b.getAttribute('data-i');
          if (act === 'okorder') {
            var res = confirmOrder(id);
            saveBiz(); render();
            var msg = 'Order confirmed. ' + res.created + ' sale(s) recorded.';
            if (res.skipped.length) msg += ' Not matched to inventory: ' + res.skipped.join(', ') + '.';
            if (res.errors.length) msg += ' ' + res.errors.join(' ');
            toast(msg, !!(res.skipped.length || res.errors.length));
          } else if (act === 'rmorder') {
            if (!confirm('Cancel this pending order? No stock is affected.')) return;
            cancelOrder(id); saveBiz(); render();
            toast('Order cancelled.');
          }
        });
      });
      var osSel = $('osProd');
      function osCalc() {
        var p = productById(osSel.value);
        var boxes = num($('osBoxes').value), bottles = num($('osBottles').value);
        if (p) {
          $('osPrice').value = p.price;
          var ppb = num($('osPrice').value) || p.price;
          var bpb = boxBottles(p);
          var total = boxes * ppb + bottles * (ppb / bpb);
          var cost = boxes * p.cost + bottles * (p.cost / bpb);
          var have = stockInBottles(p);
          var after = have - (boxes * bpb + bottles);
          $('osStockLine').innerHTML = '<b>' + esc(p.name) + ' ' + esc(p.size) + '</b> — stock ab: <b>' + stockBoxes(p) + ' boxes</b> (' + have + ' bottles). Entry ke baad: <b style="color:' + (after < num(S.settings.minStock) * bpb ? 'var(--warn)' : 'var(--ok)') + '">' + Math.floor(after / bpb) + ' boxes</b> bachenge' + (after < num(S.settings.minStock) * bpb ? ' — low stock alert!' : '');
          $('osCostLine').textContent = 'Cost: ' + money(cost) + ' · Profit: ' + money(total - cost);
          $('osAmt').textContent = 'Total: ' + money(total);
        } else { $('osStockLine').textContent = ''; $('osCostLine').textContent = 'Select a product.'; $('osAmt').textContent = 'Total: ₹0'; }
      }
      osSel.addEventListener('change', osCalc);
      ['osBoxes', 'osBottles', 'osPrice'].forEach(function (id) { $(id).addEventListener('input', osCalc); });
      osCalc();
      $('osSave').onclick = function () {
        var pid = osSel.value;
        if (!pid) { toast('Select a product first.', true); return; }
        var res = recordSale({
          productId: pid, boxes: $('osBoxes').value, bottles: $('osBottles').value,
          pricePerBox: $('osPrice').value, customer: $('osName').value,
          date: $('osDate').value, payment: 'online', source: 'manual'
        });
        if (res && res.error) { toast(res.error, true); return; }
        saveBiz(); render();
        var p2 = productById(pid);
        toast('Online sale recorded. \u2713 ' + (p2 ? esc(p2.name) + ' me ab ' + stockBoxes(p2) + ' boxes bache hain.' : ''));
      };
    }
    if (tab === 'biz-today') {
      $('content').querySelectorAll('button[data-act="view"]').forEach(function (b) {
        b.addEventListener('click', function () { saleModal(b.getAttribute('data-i')); });
      });
      wireCustOpen();
    }
    if (tab === 'biz-sales') {
      var f = S._sf || {};
      function saveF() {
        S._sf = {
          from: $('fFrom').value, to: $('fTo').value, product: $('fProduct').value,
          pay: $('fPay').value, status: $('fStatus').value, q: $('fQ').value
        };
        render();
      }
      ['fFrom', 'fTo', 'fProduct', 'fPay', 'fStatus'].forEach(function (id) { $(id).addEventListener('change', saveF); });
      wireSearchBar('fQ', function () {
        var el = $('fQ');
        S._sf = S._sf || {};
        S._sf.q = el ? el.value : '';
        var pos = el ? (el.selectionStart || el.value.length) : 0;
        render();
        var q3 = $('fQ');
        if (q3) { q3.focus(); try { q3.setSelectionRange(pos, pos); } catch (e) {} }
      }, function (type, q) {
        S._sf = S._sf || {};
        S._sf.type = type;
        if (type === 'purchase') {
          S._pf = { q: q || S._sf.q || '', type: 'purchase' };
          goto('biz-purchases');
        } else { render(); }
      });
      $('fReset').onclick = function () { S._sf = {}; render(); };
      $('content').querySelectorAll('tr[data-sale]').forEach(function (tr) {
        tr.addEventListener('click', function () { saleModal(tr.getAttribute('data-sale')); });
      });
      $('content').querySelectorAll('button[data-act]').forEach(function (b) {
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          var act = b.getAttribute('data-act'), id = b.getAttribute('data-i');
          if (act === 'view') saleModal(id);
          else if (act === 'pay') paymentModal('sale', id);
          else if (act === 'cancel') {
            if (!confirm('Cancel this sale? Its stock will be restored and it stays in history as cancelled.')) return;
            cancelSale(id); saveBiz(); render();
            toast('Sale cancelled, stock restored.');
          }
        });
      });
      wireCustOpen();
    }
    if (tab === 'biz-purchases') {
      wireSearchBar('puQ', function () {
        var el = $('puQ');
        S._pf = S._pf || {};
        S._pf.q = el ? el.value : '';
        render();
      }, function (type, q) {
        S._pf = S._pf || {};
        S._pf.type = type;
        if (type === 'sell') {
          S._sf = S._sf || {};
          S._sf.q = q || S._pf.q || '';
          S._sf.type = 'sell';
          goto('biz-sales');
        } else { render(); }
      });
      var as2 = $('btnAddStock2');
      if (as2) as2.onclick = function () { goto('biz-stock'); };
      $('content').querySelectorAll('button[data-act="pupay"]').forEach(function (b) {
        b.addEventListener('click', function () { paymentModal('purchase', b.getAttribute('data-i'));         });
      });
      wireCustOpen();
    }
    if (tab === 'biz-reports') {
      $('content').querySelectorAll('button[data-rp]').forEach(function (b) {
        b.addEventListener('click', function () { S._rp = b.getAttribute('data-rp'); S._rpFrom = ''; S._rpTo = ''; render(); });
      });
      $('content').querySelectorAll('button[data-psort]').forEach(function (b) {
        b.addEventListener('click', function () { S._psort = b.getAttribute('data-psort'); render(); });
      });
      $('rpApply').onclick = function () { S._rp = 'custom'; S._rpFrom = $('rpFrom').value; S._rpTo = $('rpTo').value; render(); };
    }
    if (tab === 'biz-customers') {
      if (S._custOpen) {
        $('cDashBack').onclick = function () { S._custOpen = null; render(); };
        $('content').querySelectorAll('button[data-per]').forEach(function (b) {
          b.addEventListener('click', function () {
            S._custOpen.period = b.getAttribute('data-per');
            S._custPeriod = S._custOpen.period;
            S._custOpen.day = null;
            render();
          });
        });
        $('content').querySelectorAll('[data-day]').forEach(function (el) {
          el.addEventListener('click', function () {
            var dk = el.getAttribute('data-day');
            S._custOpen.day = (S._custOpen.day === dk) ? null : dk;
            render();
          });
        });
        $('kpiBoxes').onclick = function () { boxesBreakModal(S._custOpen.name, S._custOpen.kind, S._custOpen.period); };
        $('content').querySelectorAll('button[data-act="view"]').forEach(function (b) {
          b.addEventListener('click', function () { saleModal(b.getAttribute('data-i')); });
        });
        $('content').querySelectorAll('button[data-act="pay"]').forEach(function (b) {
          b.addEventListener('click', function () { paymentModal('sale', b.getAttribute('data-i')); });
        });
        $('content').querySelectorAll('button[data-act="pupay"]').forEach(function (b) {
          b.addEventListener('click', function () { paymentModal('purchase', b.getAttribute('data-i')); });
        });
      } else {
        $('content').querySelectorAll('button[data-clist]').forEach(function (b) {
          b.addEventListener('click', function () {
            S._custListKind = b.getAttribute('data-clist');
            render();
          });
        });
        $('content').querySelectorAll('tr[data-custrow]').forEach(function (tr) {
          tr.addEventListener('click', function () {
            openCustomerDashboard(tr.getAttribute('data-custrow'), tr.getAttribute('data-custkind'));
          });
        });
        wireCustOpen();
      }
    }
    if (tab === 'biz-settings') {
      $('bsSave').onclick = function () {
        S.settings.bizName = $('bsName').value;
        S.settings.minStock = Math.max(0, num($('bsMin').value) || 15);
        S.settings.initialCapital = Math.max(0, num($('bsCap').value));
        saveBiz(); render();
        toast('Business settings saved. \u2713');
      };
      $('bsExport').onclick = function () {
        var blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'business.json';
        a.click();
        toast('Business data exported. \u2713');
      };
      $('bsImport').onclick = function () {
        var inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = '.json';
        inp.onchange = function () {
          var f = inp.files && inp.files[0];
          if (!f) return;
          var rd = new FileReader();
          rd.onload = function () {
            try {
              var d = JSON.parse(rd.result);
              if (!d || !Array.isArray(d.products)) throw new Error('bad');
              S = d; S.loaded = true;
              replayStock(S.products, S.purchases, S.sales, S.adjustments);
              saveBiz(); render();
              toast('Business data imported. \u2713');
            } catch (e) { toast('That is not a valid business.json file.', true); }
          };
          rd.readAsText(f);
        };
        inp.click();
      };
      $('bsReset').onclick = function () {
        if (!confirm('Reset ALL inventory, sales, purchases and adjustments? This cannot be undone.')) return;
        S.settings = { bizName: S.settings.bizName, minStock: S.settings.minStock, initialCapital: 0 };
        S.products = seedFromCatalog();
        S.purchases = []; S.sales = []; S.adjustments = []; S.pendingOrders = [];
        saveBiz(); render();
        toast('Business data reset to fresh catalog.');
      };
    }
  }

  /* ---------------- perf rows (for reports + charts) ---------------- */
  function perfRows() {
    var rows = S.products.map(function (p) {
      var r = { p: p, sales: 0, online: 0, cash: 0, cost: 0, profit: 0, boxes: 0, bottles: 0 };
      S.sales.forEach(function (s) {
        if (s.productId !== p.id || s.status === 'cancelled') return;
        r.sales += num(s.total); r.cost += num(s.cost); r.profit += num(s.profit);
        r.boxes += num(s.boxes); r.bottles += num(s.bottles);
        if (s.payment === 'cash') r.cash += num(s.total); else r.online += num(s.total);
      });
      return r;
    });
    var sort = S._psort || 'sales';
    rows.sort(function (a, b) {
      if (sort === 'profit') return b.profit - a.profit;
      if (sort === 'qty') return (b.boxes * 12 + b.bottles) - (a.boxes * 12 + a.bottles);
      if (sort === 'low') return stockInBottles(a.p) - stockInBottles(b.p);
      if (sort === 'high') return stockInBottles(b.p) - stockInBottles(a.p);
      return b.sales - a.sales;
    });
    return rows;
  }
  var RP = { sales: 0, online: 0, cash: 0, cogs: 0, profit: 0, orders: 0, boxes: 0, bottles: 0, products: 0 };
  var PERF = [];

  /* ---------------- render ---------------- */
  function render() {
    if (!S.loaded) return;
    var content = $('content');
    var html = '';
    var from = '0000-00-00', to = '9999-12-31';
    if (tab === 'biz-dash') html = rDash();
    else if (tab === 'biz-today') html = rToday();
    else if (tab === 'biz-products') html = rProducts();
    else if (tab === 'biz-inventory') html = rInventory();
    else if (tab === 'biz-stock') html = rStock();
    else if (tab === 'biz-cash') html = rCash();
    else if (tab === 'biz-orders') html = rOrders();
    else if (tab === 'biz-sales') html = rSales();
    else if (tab === 'biz-purchases') html = rPurchases();
    else if (tab === 'biz-reports') {
      var rp = S._rp || 'all';
      if (rp === 'today') { from = todayKey(); to = todayKey(); }
      else if (rp === 'week') { from = dateKey(startOfWeek(new Date())); to = todayKey(); }
      else if (rp === 'month') { from = dateKey(startOfMonth(new Date())); to = todayKey(); }
      else if (rp === 'lastmonth') {
        var lm = new Date(); lm.setMonth(lm.getMonth() - 1);
        from = dateKey(new Date(lm.getFullYear(), lm.getMonth(), 1));
        to = dateKey(new Date(lm.getFullYear(), lm.getMonth() + 1, 0));
      }
      else if (rp === 'custom') { from = S._rpFrom || '0000-00-00'; to = S._rpTo || '9999-12-31'; }
      RP = kpiOf(salesInRange(S.sales, from, to));
      PERF = perfRows();
      html = rReports();
    }
    else if (tab === 'biz-alerts') html = rAlerts();
    else if (tab === 'biz-customers') html = rCustomers();
    else if (tab === 'biz-settings') html = rSettings();
    else { toast('Unknown business tab: ' + tab, true); return; }
    content.innerHTML = html;
    afterRender();
    if (typeof window.rwBizAfterTab === 'function') window.rwBizAfterTab();
  }

  /* ---------------- public API ---------------- */
  window.BIZ = {
    render: function (t) { tab = t; render(); },
    loaded: function () { return S.loaded; },
    getState: function () { return S; },
    reloadBizData: function (cb) { reloadBizData(cb); },
    customerSearch: function (q, kind) { return customerSearch(q, kind); },
    openCustomerDashboard: function (name, kind, date) { openCustomerDashboard(name, kind, date); },
    _t: {
      money: money, dateKey: dateKey, todayKey: todayKey, addDays: addDays, startOfWeek: startOfWeek,
      startOfMonth: startOfMonth, inRange: inRange, kpiOf: kpiOf, salesInRange: salesInRange,
      boxBottles: boxBottles, stockStatus: stockStatus, matchProduct: matchProduct,
      replayStock: replayStock, seedFromCatalog: seedFromCatalog
    }
  };

  /* first load: fetch business data from the server, then re-render the active tab */
  load(function () {
    if ($('content')) {
      replayStock(S.products, S.purchases, S.sales, S.adjustments);
      if (window.RW && window.RW.render) window.RW.render();
    }
  });

  /* Global order watcher — naya website order aate hi notification + vibration, har tab par. */
  startOrderWatch();
})();