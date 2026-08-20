/* ============================================================
   Rajesh Water - site stats tracker (v2)
   localStorage keys:
     rw_stats  - lifetime aggregates {visits, clicks, orders, quotes, ...}
     rw_daily  - per-day counters (last 90 days kept)
     rw_events - recent event log (capped, newest last)
   The admin Dashboard tab reads these.
   ============================================================ */
(function () {
  "use strict";

  var STAT_KEY = 'rw_stats';
  var DAY_KEY = 'rw_daily';
  var EV_KEY = 'rw_events';

  var S = {};
  try { S = JSON.parse(localStorage.getItem(STAT_KEY) || 'null') || {}; } catch (e) {}
  var DAYS = {};
  try { DAYS = JSON.parse(localStorage.getItem(DAY_KEY) || 'null') || {}; } catch (e) {}
  var EV = [];
  try { EV = JSON.parse(localStorage.getItem(EV_KEY) || 'null') || []; } catch (e) {}

  function dayKey() {
    var d = new Date();
    function p(n) { return n < 10 ? '0' + n : '' + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function day() {
    var k = dayKey();
    if (!DAYS[k]) DAYS[k] = { op: 0, cl: 0, ad: 0, s: 0, wa: 0, tel: 0, q: 0, od: 0, re: 0 };
    return DAYS[k];
  }
  function trimDays() {
    var keys = Object.keys(DAYS).sort();
    if (keys.length > 92) { keys.slice(0, keys.length - 92).forEach(function (k) { delete DAYS[k]; }); }
  }
  function saveAll() {
    try { localStorage.setItem(STAT_KEY, JSON.stringify(S)); } catch (e) {}
    try { localStorage.setItem(DAY_KEY, JSON.stringify(DAYS)); } catch (e) {}
    try { localStorage.setItem(EV_KEY, JSON.stringify(EV)); } catch (e) {}
  }
  function rec(type, x) {
    var e = { t: Date.now(), type: type };
    if (x) e.x = x;
    EV.push(e);
    if (EV.length > 600) EV = EV.slice(EV.length - 600);
    saveAll();
  }

  /* ---- lifetime aggregates ---- */
  S.visits = (S.visits || 0) + 1;
  var d = day();
  d.op = (d.op || 0) + 1;
  trimDays();

  function bump(field, n) {
    S[field] = (S[field] || 0) + (n || 1);
    day()[field] = (day()[field] || 0) + (n || 1);
    saveAll();
  }

  var clicksBuf = 0;
  document.addEventListener('click', function () {
    clicksBuf++;
    if (clicksBuf >= 5) { S.clicks = (S.clicks || 0) + clicksBuf; day().cl = (day().cl || 0) + clicksBuf; clicksBuf = 0; saveAll(); }
  });
  window.addEventListener('beforeunload', function () {
    if (clicksBuf) { S.clicks = (S.clicks || 0) + clicksBuf; day().cl = (day().cl || 0) + clicksBuf; }
    saveAll();
  });

  /* ---- device / browser / OS of this visit ---- */
  function uaInfo() {
    var ua = navigator.userAgent;
    var tablet = /iPad|Tablet|PlayBook/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
    var mobile = /Mobi|iPhone|Android/i.test(ua) && !tablet;
    var dev = tablet ? 'Tablet' : mobile ? 'Mobile' : 'Desktop';
    var b = 'Other';
    if (/Edg\//.test(ua)) b = 'Edge';
    else if (/OPR\/|Opera/i.test(ua)) b = 'Opera';
    else if (/Chrome\//.test(ua)) b = 'Chrome';
    else if (/Firefox\//.test(ua)) b = 'Firefox';
    else if (/Safari\//.test(ua)) b = 'Safari';
    var os = 'Other';
    if (/Windows/.test(ua)) os = 'Windows';
    else if (/Android/.test(ua)) os = 'Android';
    else if (/Mac OS/.test(ua)) os = 'macOS';
    else if (/iPhone|iPad|iPod/.test(ua) && !/Mac OS/.test(ua)) os = 'iOS';
    else if (/Linux/.test(ua)) os = 'Linux';
    return { dev: dev, b: b, os: os };
  }
  var curUa = uaInfo();
  var curPage = /products\.html/.test(location.pathname) ? 'products' : 'home';
  rec('visit', {
    p: curPage,
    r: (document.referrer || '').slice(0, 90),
    d: curUa.dev, b: curUa.b, os: curUa.os
  });

  /* ---- click-driven events ---- */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var a = t.closest('a');
    if (a) {
      var href = a.getAttribute('href') || '';
      if (href.indexOf('wa.me') !== -1) { if (S['wa'] === undefined) S.wa = 0; bump('wa'); rec('wa'); return; }
      if (href.indexOf('tel:') === 0) { if (S.tel === undefined) S.tel = 0; bump('tel'); rec('tel'); return; }
    }
    var add = t.closest('.rw-add-btn');
    if (add) {
      var card = add.closest('.rw-product-card');
      if (card) {
        bump('ad');
        rec('add', { i: card.getAttribute('data-id') || '', l: card.getAttribute('data-label') || '' });
      }
      return;
    }
  });

  /* ---- search events ---- */
  var searchT = null;
  function trackSearch() {
    var inp = document.getElementById('navSearch');
    if (!inp) return;
    var q = (inp.value || '').trim();
    if (!q) return;
    bump('s');
    rec('search', { q: q.slice(0, 50) });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      var inp = document.getElementById('navSearch');
      if (inp && e.target === inp) trackSearch();
    }
  });
  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('#navSearchClear')) trackSearch();
  });
  window.addEventListener('blur', function () {
    clearTimeout(searchT);
    searchT = setTimeout(trackSearch, 400);
  });

  /* ---- order events ---- */
  function watchOrder() {
    var successEl = document.getElementById('drawerStepSuccess');
    if (!successEl || typeof MutationObserver !== 'function') return;
    var successSeen = false;
    new MutationObserver(function () {
      if (successEl.style.display === 'block' && !successSeen) {
        successSeen = true;
        bump('od');
        var totalTxt = '';
        var totEl = document.getElementById('drawerTotal');
        if (totEl) totalTxt = (totEl.textContent || '').replace(/[^0-9]/g, '');
        var rev = Number(totalTxt) || 0;
        S.re = (S.re || 0) + rev;
        day().re = (day().re || 0) + rev;
        rec('order', { re: rev });
        saveAll();
        setTimeout(function () { successSeen = false; }, 6000);
      }
    }).observe(successEl, { attributes: true, attributeFilter: ['style'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchOrder);
  else watchOrder();

  /* ---- quote enquiries ---- */
  var lastQuotes = -1;
  setInterval(function () {
    var q = 0;
    try { q = JSON.parse(localStorage.getItem('rw_quote_enquiries') || '[]').length; } catch (e) {}
    if (q > (S.quotes || 0)) { S.quotes = q; rec('quote'); }
    lastQuotes = q;
    saveAll();
  }, 900);

  saveAll();

  window.RW_STATS = {
    get: function () { return S; },
    daily: function () { return DAYS; },
    events: function () { return EV; },
    reset: function () {
      S = { visits: 0, clicks: 0, orders: 0, quotes: 0, wa: 0, tel: 0, ad: 0, s: 0, re: 0 };
      DAYS = {}; EV = [];
      saveAll();
    }
  };
})();