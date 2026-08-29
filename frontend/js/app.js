/* ============================================================
   Rajesh Water — Main app (cart, search, checkout, tracking)
   Shared by index.html and products.html
   ============================================================ */
(function () {
  "use strict";

  var KEY = 'rajesh-water-cart';
  var BUSINESS = (window.SITE_DATA && window.SITE_DATA.contact) ? { name: (window.SITE_DATA.brand && window.SITE_DATA.brand.name) ? window.SITE_DATA.brand.name.toUpperCase() : 'RAJESH WATER', whatsapp: window.SITE_DATA.contact.whatsapp || '917742735762' } : { name: 'RAJESH WATER', whatsapp: '917742735762' };
  var MIN_ORDER = 48;
  function esc(s) { var d = document.createElement('div'); d.appendChild(document.createTextNode(s || '')); return d.innerHTML; }
  var MAX_CARTONS = 40;
  var fmt = new Intl.NumberFormat('en-IN');

  var cart = Object.create(null);
  var pending = Object.create(null);

  var badge = document.getElementById('cartCount');
  var cartBtn = document.getElementById('cartBtn');
  var bar = document.getElementById('cartBar');
  var barCount = document.getElementById('cartBarCount');
  var barTotal = document.getElementById('cartBarTotal');
  var clearBtn = document.getElementById('cartClear');
  var toast = document.getElementById('cartToast');
  var toastTimer = null;
  var drawer = document.getElementById('cartDrawer');
  var backdrop = document.getElementById('drawerBackdrop');
  var closeBtn = document.getElementById('drawerClose');
  var itemsBox = document.getElementById('drawerItems');
  var emptyEl = document.getElementById('drawerEmpty');
  var foot = document.getElementById('drawerFoot');
  var totalEl = document.getElementById('drawerTotal');
  var checkoutBtn = document.getElementById('drawerCheckout');
  var checkoutLabel = document.getElementById('drawerCheckoutLabel');
  var headPill = document.getElementById('drawerHeadPill');
  var minOrderLabel = document.getElementById('minOrderLabel');
  var minOrderHead = document.getElementById('minOrderHead');
  var minOrderSub = document.getElementById('minOrderSub');
  var minOrderFill = document.getElementById('minOrderFill');
  var drawerBoxes = document.getElementById('drawerBoxes');

  var stepCart = document.getElementById('drawerStepCart');
  var stepCheckout = document.getElementById('drawerStepCheckout');
  var stepSuccess = document.getElementById('drawerStepSuccess');
  var coBack = document.getElementById('coBack');
  var coName = document.getElementById('coName');
  var coMobile = document.getElementById('coMobile');
  var coAddress = document.getElementById('coAddress');
  var coNameErr = document.getElementById('coNameErr');
  var coMobileErr = document.getElementById('coMobileErr');
  var coAddressErr = document.getElementById('coAddressErr');
  var coBoxes = document.getElementById('coBoxes');
  var coBottles = document.getElementById('coBottles');
  var coAmount = document.getElementById('coAmount');
  var coSubmit = document.getElementById('coSubmit');
  var coContinue = document.getElementById('coContinue');

  function money(n) { return '\u20B9' + fmt.format(n); }

  function cards() {
    return Array.prototype.slice.call(document.querySelectorAll('.rw-product-card'));
  }
  function cardOf(id) {
    for (var i = 0; i < cards().length; i++) {
      if (cards()[i].getAttribute('data-id') === id) return cards()[i];
    }
    return null;
  }
  function sizeOf(id) { var c = cardOf(id); return parseInt(c && c.getAttribute('data-box'), 10) || 12; }
  function minOf(id) { var c = cardOf(id); return parseInt(c && c.getAttribute('data-minboxes'), 10) || 1; }
  function priceOf(id) { var c = cardOf(id); return parseInt(c && c.getAttribute('data-price'), 10) || 0; }
  function labelOf(id) {
    var c = cardOf(id);
    if (!c) return '';
    return c.getAttribute('data-label') || c.getAttribute('data-name') || '';
  }
  function capOf(id) { return sizeOf(id) * MAX_CARTONS; }
  function minQtyOf(id) { return sizeOf(id) * minOf(id); }
  function catOf(id) { var c = cardOf(id); return (c && c.getAttribute('data-category')) || ''; }
  function imgOf(id) {
    var c = cardOf(id);
    if (!c) return '';
    var im = c.querySelector('img');
    return im ? im.src : '';
  }

  function loadCart() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY));
      if (!raw || typeof raw !== 'object') return;
      cart = Object.create(null);
      Object.keys(raw).forEach(function (id) {
        if (!cardOf(id)) return;
        cart[id] = {
          qty: Math.min(Math.max(Number(raw[id].qty) || 0, 0), capOf(id)),
          price: priceOf(id),
          label: labelOf(id),
          boxSize: sizeOf(id),
        };
      });
    } catch (e) { cart = Object.create(null); }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {}
  }

  function totalQuantity() { var t = 0, k; for (k in cart) { t += cart[k].qty; } return t; }
  function totalAmount() { var t = 0, k; for (k in cart) { t += cart[k].qty * cart[k].price; } return t; }
  function totalBoxes() { var t = 0, k; for (k in cart) { t += cart[k].qty / sizeOf(k); } return Math.round(t); }
  function boxLine() {
    var boxes = 0, extra = 0, k;
    for (k in cart) {
      boxes += Math.floor(cart[k].qty / sizeOf(k));
      extra += cart[k].qty % sizeOf(k);
    }
    return extra > 0 ? (boxes + ' boxes + ' + extra + ' bottles') : (boxes === 1 ? '1 box' : boxes + ' boxes');
  }
  function meetsMinimum() { return totalQuantity() >= MIN_ORDER; }

  function setQty(id, qty) {
    if (qty <= 0) { delete cart[id]; }
    else {
      cart[id] = {
        qty: Math.min(qty, capOf(id)),
        price: priceOf(id),
        label: labelOf(id),
        boxSize: sizeOf(id),
      };
    }
  }
  function increment(id) {
    if (!cart[id]) { setQty(id, sizeOf(id)); return; }
    cart[id].qty = Math.min(cart[id].qty + sizeOf(id), capOf(id));
  }
  function decrement(id) {
    if (!cart[id]) return;
    var next = cart[id].qty - sizeOf(id);
    if (next < sizeOf(id)) { cart[id].qty = sizeOf(id); return; }
    cart[id].qty = next;
  }

  function addPendingToCart(id) {
    var bs = sizeOf(id);
    var boxes = Math.min(pending[id] || 0, MAX_CARTONS);
    if (boxes < 1) boxes = 1;
    if (!cart[id]) {
      cart[id] = { qty: 0, price: priceOf(id), label: labelOf(id), boxSize: bs };
    }
    cart[id].qty = Math.min(cart[id].qty + boxes * bs, capOf(id));
    pending[id] = 0;
  }

  function applyToSteppers() {
    for (var i = 0; i < cards().length; i++) {
      var c = cards()[i];
      var el = c.querySelector('.rw-qty');
      if (!el) continue;
      var id = c.getAttribute('data-id');
      el.textContent = pending[id] || 1;
    }
    syncMaxHints();
  }
  function syncMaxHints() {
    Array.prototype.forEach.call(cards(), function (c) {
      var hint = c.querySelector('.rw-maxhint');
      if (!hint) return;
      var id = c.getAttribute('data-id');
      hint.classList.toggle('is-on', (pending[id] || 1) >= (parseInt(c.getAttribute('data-max'), 10) || 40));
    });
  }

  function notify(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('is-visible'); }, 2200);
  }

  function openDrawer() {
    if (!drawer) return;
    showStep('cart');
    drawer.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    document.querySelectorAll('.rw-fab-btn').forEach(function (el) { el.style.display = 'none'; });
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('is-open');
    document.body.style.overflow = '';
    document.querySelectorAll('.rw-fab-btn').forEach(function (el) { el.style.display = ''; });
  }

  function showStep(step) {
    stepCart.style.display = step === 'cart' ? '' : 'none';
    stepCheckout.style.display = step === 'checkout' ? '' : 'none';
    stepSuccess.style.display = step === 'success' ? '' : 'none';
  }

  function renderDrawer() {
    if (!itemsBox) return;
    itemsBox.innerHTML = '';
    var html = '', k;
    for (k in cart) {
      var it = cart[k];
      var boxes = Math.round(it.qty / sizeOf(k));
      var atMax = it.qty >= capOf(k);
      var bs = sizeOf(k);
      html +=
        '<div class="drawer-item" data-id="' + k + '">' +
          '<div class="drawer-item-top">' +
            '<div class="drawer-item-thumb"><img src="' + imgOf(k) + '" alt="' + it.label + '" loading="lazy"></div>' +
            '<div class="drawer-item-info">' +
              '<div class="drawer-item-name">' + it.label + '</div>' +
              '<div class="drawer-item-price">' + money(it.price) + ' / bottle \u00B7 ' + money(it.price * bs) + ' per box</div>' +
              '<div class="drawer-item-facts">' +
                (catOf(k) ? catOf(k) + ' \u00B7 ' : '') +
                '1 ' + (bs > 12 ? 'box' : 'carton') + ' = ' + bs + ' bottles' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="drawer-item-qty">' +
            '<button class="qty-btn qty-minus" type="button" aria-label="Decrease quantity">\u2212</button>' +
            '<span class="qty-val">' + boxes + '</span>' +
            '<button class="qty-btn qty-plus" type="button" aria-label="Increase quantity">+</button>' +
            '<button class="drawer-item-remove" type="button" aria-label="Remove">\u00D7</button>' +
          '</div>' +
          '<div class="drawer-item-line">' +
            (atMax ? 'Max ' + MAX_CARTONS + ' ' + (bs > 12 ? 'boxes' : 'cartons') + ' reached \u00B7 ' : '') +
            money(it.qty * it.price) +
          '</div>' +
        '</div>';
    }
    itemsBox.innerHTML = html;
    Array.prototype.forEach.call(itemsBox.querySelectorAll('.drawer-item'), function (row) {
      var id = row.getAttribute('data-id');
      row.querySelector('.qty-minus').addEventListener('click', function () {
        decrement(id); save(); applyToSteppers(); render();
      });
      row.querySelector('.qty-plus').addEventListener('click', function () {
        increment(id); save(); applyToSteppers(); render();
      });
      row.querySelector('.drawer-item-remove').addEventListener('click', function () {
        delete cart[id]; notify(labelOf(id) + ' removed from cart');
        save(); applyToSteppers(); render();
      });
    });
  }

  function renderFoot() {
    var has = Object.keys(cart).length > 0;
    if (foot) { foot.style.display = has ? '' : 'none'; }
    if (emptyEl) { emptyEl.classList.toggle('is-visible', !has); }
    if (totalEl) { totalEl.textContent = money(totalAmount()); }
    if (headPill) {
      var tb = totalBoxes();
      headPill.textContent = tb + (tb === 1 ? ' box' : ' boxes');
      headPill.style.display = has ? '' : 'none';
    }
    var ok = meetsMinimum();
    if (minOrderLabel) { minOrderLabel.textContent = ok ? 'Minimum order met' : 'Minimum order is ' + MIN_ORDER + ' bottles'; }
    if (minOrderHead) { minOrderHead.classList.toggle('ok', ok); minOrderHead.classList.toggle('no', !ok); }
    if (minOrderSub) {
      var tb2 = totalBoxes();
      minOrderSub.textContent = 'Your order: ' + tb2 + (tb2 === 1 ? ' box' : ' boxes') + ' \u00B7 Min ' + MIN_ORDER + ' bottles';
    }
    if (minOrderFill) {
      minOrderFill.style.width = Math.min((totalQuantity() / MIN_ORDER) * 100, 100) + '%';
      minOrderFill.classList.toggle('ok', ok);
      minOrderFill.classList.toggle('no', !ok);
    }
    if (drawerBoxes) { drawerBoxes.textContent = boxLine(); }
    if (checkoutBtn) {
      checkoutBtn.disabled = !(ok && has);
      if (checkoutLabel) {
        checkoutLabel.textContent = ok ? 'Place Order' : 'Add ' + (MIN_ORDER - totalQuantity()) + ' more bottles';
      }
    }
  }

  function render() {
    var tb = totalBoxes();
    if (badge) { badge.textContent = tb; badge.classList.toggle('is-visible', tb > 0); }
    if (cartBtn) { cartBtn.setAttribute('aria-label', 'Shopping cart, ' + tb + (tb === 1 ? ' item' : ' items')); }
    if (barCount) { barCount.textContent = tb + (tb === 1 ? ' box' : ' boxes'); }
    if (barTotal) { barTotal.textContent = money(totalAmount()); }
    if (bar) { bar.classList.toggle('is-visible', tb > 0); }
    renderDrawer();
    renderFoot();
  }

  function clearCart() {
    cart = Object.create(null);
    pending = Object.create(null);
    save(); applyToSteppers(); render(); notify('Cart cleared');
  }

  function renderCheckoutSummary() {
    if (coBoxes) { coBoxes.textContent = boxLine(); }
    if (coBottles) { coBottles.textContent = totalQuantity() + ' bottles'; }
    if (coAmount) { coAmount.textContent = money(totalAmount()); }
  }

  /* ---------- Product grid ---------- */
  var countEl = document.getElementById('rwShopCount');
  var allCountEl = document.getElementById('productCount');

  function cardHtml(p) {
    var mb = p.minBoxes || 1;
    return '<article class="rw-product-card rounded-xl flex flex-col group relative"' +
      ' data-id="' + p.id + '" data-category="' + p.category + '" data-label="' + p.label + '"' +
      ' data-price="' + p.price + '" data-box="' + p.boxSize + '" data-minboxes="' + mb + '" data-max="' + (p.maxQty || 40) + '">' +
      '<div class="absolute top-4 left-4 z-10 bg-primary-container/10 px-3 py-1 rounded-full border border-primary-container/20"><span class="font-label-caps text-label-caps text-primary-container">' + p.category + '</span></div>' +
      (p.badge ? '<div class="absolute top-4 right-4 z-10 bg-secondary-container px-3 py-1 rounded-full shadow-[0_0_15px_rgba(139,124,255,0.5)]"><span class="font-label-caps text-label-caps text-white">' + p.badge + '</span></div>' : '') +
      '<div class="rw-prod-media relative">' +
        '<img class="rw-prod-img object-contain w-full h-full transition-opacity duration-500 group-hover:scale-105 transform" src="' + p.img + '" alt="' + p.name + ' ' + p.size + '" loading="lazy">' +
      '</div>' +
      '<div class="p-6 flex flex-col flex-grow">' +
        '<h3 class="font-headline-sm text-headline-sm text-primary mb-1">' + p.name + '</h3>' +
        '<p class="font-body-md text-text-muted mb-2">' + p.size + ' \u2022 ' + p.boxSize + ' bottles per box \u2022 Min ' + mb + (mb > 1 ? ' boxes' : ' box') + ' per order</p>' +
        '<div class="mt-auto pt-4 border-t border-border-subtle flex items-end justify-between">' +
          '<div>' +
            '<span class="font-label-caps text-label-caps text-text-muted block mb-1">\u20B9' + p.price + ' per bottle</span>' +
            '<span class="font-headline-md text-headline-md text-text-primary">\u20B9' + (p.price * p.boxSize) + ' <span class="font-label-caps text-label-caps text-text-muted">/ box</span></span>' +
          '</div>' +
          '<div class="flex items-center gap-3">' +
            '<button class="rw-qty-btn w-8 h-8 rounded-full flex items-center justify-center font-bold pb-1 rw-qty-minus" type="button">-</button>' +
            '<span class="font-headline-md text-headline-md text-primary w-6 text-center rw-qty">0</span>' +
            '<button class="rw-qty-btn w-8 h-8 rounded-full flex items-center justify-center font-bold pb-1 rw-qty-plus" type="button">+</button>' +
          '</div>' +
        '</div>' +
        '<div class="rw-maxhint" role="status">Max ' + (p.maxQty || 40) + ' boxes reached</div>' +
        '<button class="rw-add-btn" type="button" aria-label="Add to cart">Add to Cart</button>' +
        '<button class="rw-quote-btn" type="button" aria-label="Bulk order enquiry">Bulk Order</button>' +
      '</div>' +
    '</article>';
  }
  function renderProducts() {
    var grid = document.getElementById('productGrid');
    var gridAll = document.getElementById('productGridAll');
    if (!window.PRODUCTS) return;
    if (grid) { grid.innerHTML = window.PRODUCTS.filter(function (p) { return p.featured; }).map(cardHtml).join(''); }
    if (gridAll) { gridAll.innerHTML = window.PRODUCTS.map(cardHtml).join(''); }
    var featCount = window.PRODUCTS.filter(function (p) { return p.featured; }).length;
    if (countEl) { countEl.textContent = 'Showing ' + featCount + ' Products'; }
    if (allCountEl) { allCountEl.textContent = 'Showing ' + window.PRODUCTS.length + ' Products'; }
  }

  /* ---------- Catalog steppers ---------- */
  document.addEventListener('click', function (e) {
    var qBtn = e.target.closest('.rw-quote-btn');
    if (qBtn) { if (typeof window.rwOpenQuote === 'function') window.rwOpenQuote(qBtn.closest('.rw-product-card')); return; }
    var addBtn = e.target.closest('.rw-add-btn');
    if (addBtn) {
      var ac = addBtn.closest('.rw-product-card');
      if (ac) {
        var aid = ac.getAttribute('data-id');
        addPendingToCart(aid);
        addBtn.classList.remove('flash'); void addBtn.offsetWidth; addBtn.classList.add('flash');
        save(); applyToSteppers(); render();
      }
      return;
    }
    var btn = e.target.closest('.rw-qty-plus, .rw-qty-minus');
    if (!btn) return;
    var card = btn.closest('.rw-product-card');
    if (!card) return;
    var id = card.getAttribute('data-id');
    var cMax = parseInt(card.getAttribute('data-max'), 10) || MAX_CARTONS;
    if (btn.classList.contains('rw-qty-plus')) {
      if ((pending[id] || 1) >= cMax) { syncMaxHints(); return; }
      pending[id] = Math.min((pending[id] || 1) + 1, cMax);
    }
    else { pending[id] = Math.max((pending[id] || 1) - 1, 1); }
    syncMaxHints();
    applyToSteppers();
  });

  /* ---------- Nav smooth scroll ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('.navbar-links a, .navbar-brand'), function (a) {
    a.addEventListener('click', function (e) {
      var nav = a.getAttribute('data-nav');
      if (nav === 'home') { e.preventDefault(); if (location.hash) { history.replaceState(null, '', location.pathname + location.search); } window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      if (nav === 'cart') { e.preventDefault(); openDrawer(); return; }
      var map = { shop: 'rw-shop', products: 'products', about: 'about', support: 'support', deliver: 'deliver', bulk: 'bulk' };
      var el = document.getElementById(map[nav] || nav);
      if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });

  /* ---------- Search ---------- */
  var searchInput = document.getElementById('navSearch');
  var searchClear = document.getElementById('navSearchClear');
  var searchEmptyEl = document.getElementById('rwSearchEmpty');
  var emptyClearBtn = document.getElementById('rwSearchClearEmpty');
  var searchExpanded = false;
  function applySearch() {
    var q = (searchInput ? searchInput.value : '').trim().toLowerCase();
    var grid = document.getElementById('productGrid');
    if (q && grid && window.PRODUCTS && !searchExpanded) {
      grid.innerHTML = window.PRODUCTS.map(cardHtml).join('');
      applyToSteppers();
      searchExpanded = true;
    } else if (!q && searchExpanded) {
      renderProducts();
      searchExpanded = false;
    }
    var cnt = 0, feat = 0;
    cards().forEach(function (c) {
      var hay = ((c.getAttribute('data-label') || '') + ' ' + (c.getAttribute('data-category') || '')).toLowerCase();
      var hit = !q || hay.indexOf(q) !== -1;
      c.style.display = hit ? '' : 'none';
      if (hit) { cnt++; if (c.closest('#rw-shop')) { feat++; } }
    });
    if (countEl) { countEl.textContent = 'Showing ' + feat + (feat === 1 ? ' Product' : ' Products'); }
    if (allCountEl) { allCountEl.textContent = 'Showing ' + cnt + (cnt === 1 ? ' Product' : ' Products'); }
    if (searchEmptyEl) { searchEmptyEl.classList.toggle('hidden', !(q && cnt === 0)); searchEmptyEl.classList.toggle('flex', !!(q && cnt === 0)); }
    if (searchClear) { searchClear.classList.toggle('is-visible', !!q); }
  }
  if (searchInput) { searchInput.addEventListener('input', applySearch); }
  if (searchClear) { searchClear.addEventListener('click', function () { if (searchInput) { searchInput.value = ''; } applySearch(); if (searchInput) { searchInput.focus(); } }); }
  if (emptyClearBtn) { emptyClearBtn.addEventListener('click', function () { if (searchInput) { searchInput.value = ''; } applySearch(); if (searchInput) { searchInput.focus(); } }); }

  /* ---------- Search overlay ---------- */
  var searchOverlay = document.getElementById('searchOverlay');
  var searchOverlayInp = document.getElementById('searchOverlayInput');
  var searchOverlayResults = document.getElementById('searchOverlayResults');
  var searchOverlayClose = document.getElementById('searchOverlayClose');
  var srActive = -1;
  function rwEscS(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function rwOpenSearch() {
    if (!searchOverlay) return;
    if (searchOverlayInp) { searchOverlayInp.value = searchInput ? searchInput.value : ''; }
    searchOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
    renderSearchResults(searchOverlayInp ? searchOverlayInp.value : '');
    if (searchOverlayInp) { setTimeout(function () { searchOverlayInp.focus(); }, 60); }
  }
  function rwCloseSearch() {
    if (!searchOverlay) return;
    searchOverlay.hidden = true;
    document.body.style.overflow = '';
    collapseMobileSearch();
  }
  function renderSearchResults(q) {
    if (!searchOverlayResults) return;
    srActive = -1;
    var ql = (q || '').trim().toLowerCase();
    if (!ql) {
      searchOverlayResults.innerHTML = '<div class="rw-sr-hint">Try <b>"Bisleri"</b>, <b>"water"</b>, <b>"cold drinks"</b>, <b>"cola"</b> or <b>"juice"</b>\u2026</div>';
      return;
    }
    if (!window.PRODUCTS) { searchOverlayResults.innerHTML = ''; return; }
    var hits = [];
    for (var i = 0; i < window.PRODUCTS.length; i++) {
      var p = window.PRODUCTS[i];
      var hay = ((p.name || '') + ' ' + (p.label || '') + ' ' + (p.size || '') + ' ' + (p.category || '')).toLowerCase();
      if (hay.indexOf(ql) !== -1) hits.push(p);
      if (hits.length >= 24) break;
    }
    if (!hits.length) {
      searchOverlayResults.innerHTML = '<div class="rw-sr-hint">No matches for <b>"' + rwEscS(q) + '"</b> \u2014 press <b>Enter</b> to browse the full catalog.</div>';
      return;
    }
    searchOverlayResults.innerHTML = hits.map(function (p) {
      return '<button type="button" class="rw-sr-item" data-pid="' + p.id + '" role="option">' +
        '<img src="' + p.img + '" alt="' + p.name + ' ' + p.size + ' box" loading="lazy">' +
        '<span class="rw-sr-meta"><b>' + p.name + ' ' + p.size + '</b><small>\u20B9' + p.price + ' per bottle \u00B7 ' + p.boxSize + ' per box</small></span>' +
        '<span class="rw-sr-badge">' + p.category + '</span>' +
      '</button>';
    }).join('');
  }
  function rwReportSr() {
    var items = searchOverlayResults ? searchOverlayResults.querySelectorAll('.rw-sr-item') : [];
    for (var i = 0; i < items.length; i++) { items[i].classList.toggle('is-active', i === srActive); }
  }
  function rwSearchGo(pid) {
    rwCloseSearch();
    if (searchInput && searchInput.value) { searchInput.value = ''; applySearch(); }
    location.href = 'products.html?focus=' + encodeURIComponent(pid);
  }
  if (searchOverlay) {
    if (searchInput) { searchInput.addEventListener('focus', rwOpenSearch); }
    if (searchOverlayInp) {
      searchOverlayInp.addEventListener('input', function () {
        if (searchInput) { searchInput.value = searchOverlayInp.value; applySearch(); }
        renderSearchResults(searchOverlayInp.value);
      });
      searchOverlayInp.addEventListener('keydown', function (e) {
        var items = searchOverlayResults ? searchOverlayResults.querySelectorAll('.rw-sr-item') : [];
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          if (!items.length) return;
          srActive = (srActive + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
          rwReportSr();
          items[srActive].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (items[srActive] && items[srActive].getAttribute('data-pid')) { rwSearchGo(items[srActive].getAttribute('data-pid')); }
          else if (!items.length) { location.href = 'products.html'; }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          rwCloseSearch();
        }
      });
    }
    if (searchOverlayClose) { searchOverlayClose.addEventListener('click', rwCloseSearch); }
    if (searchOverlayResults) {
      searchOverlayResults.addEventListener('click', function (e) {
        var item = e.target.closest('.rw-sr-item');
        if (item && item.getAttribute('data-pid')) { rwSearchGo(item.getAttribute('data-pid')); }
      });
    }
    var rwBackdrops = document.querySelectorAll('[data-close-search]');
    for (var i = 0; i < rwBackdrops.length; i++) { rwBackdrops[i].addEventListener('click', rwCloseSearch); }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !searchOverlay.hidden) { rwCloseSearch(); }
    });
  }

  /* ---------- Order tracking ---------- */
  var trkModal = document.getElementById('trkModal');
  var trkClose = document.getElementById('trkClose');
  var navTrackBtn = document.getElementById('navTrackBtn');
  var trkPhone = document.getElementById('trkPhone');
  var trkVerify = document.getElementById('trkVerify');
  var trkAuthNote = document.getElementById('trkAuthNote');
  var trkStatus = document.getElementById('trkStatus');
  var trkAuth = document.getElementById('trkAuth');
  var trkOrdersWrap = document.getElementById('trkOrdersWrap');
  var trkOrdersEl = document.getElementById('trkOrdersEl');
  var trkEmptyEl = document.getElementById('trkEmptyEl');
  var trkHistOrdersEl = document.getElementById('trkHistOrdersEl');
  var trkHistEmptyEl = document.getElementById('trkHistEmptyEl');
  var trkTabActive = document.getElementById('trkTabActive');
  var trkTabHistory = document.getElementById('trkTabHistory');
  var trkActiveTab = 'active';
  var trkAllOrders = [];
  var trkUpdatedEl = document.getElementById('trkUpdatedEl');
  var trkPoll = null;
  var trkVerifiedToken = '';
  var TRK_STEP_LABEL = { received: 'Order Received', confirmed: 'Order Confirmed', preparing: 'Preparing', out: 'Out for Delivery', delivered: 'Delivered' };
  var TRK_STATUS_LABEL = { received: 'PENDING', confirmed: 'CONFIRMED', preparing: 'CONFIRMED', out: 'CONFIRMED', delivered: 'CONFIRMED', completed: 'COMPLETED', cancelled: 'CANCELLED' };
  function rwTrkTokens() { try { var l = JSON.parse(localStorage.getItem('rw_orders_tokens') || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
  function rwTrkFmtTime(ts) {
    var d = new Date(ts);
    try { return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
  }
  function rwTrkOpen() {
    if (!trkModal) return;
    trkModal.hidden = false;
    document.body.style.overflow = 'hidden';
    if (trkStatus) { trkStatus.textContent = ''; }
    if (trkAuth) { trkAuth.style.display = ''; }
    if (trkOrdersWrap) { trkOrdersWrap.style.display = 'none'; }
    trkActiveTab = 'active';
    if (trkTabActive) { trkTabActive.classList.add('is-active'); }
    if (trkTabHistory) { trkTabHistory.classList.remove('is-active'); }
    if (trkPoll) { clearInterval(trkPoll); }
    trkPoll = setInterval(function () { rwTrkLoad(true); }, 15000);
    rwTrkLoad(false);
  }
  function rwTrkCloseM() {
    if (!trkModal) return;
    trkModal.hidden = true;
    document.body.style.overflow = '';
    if (trkPoll) { clearInterval(trkPoll); trkPoll = null; }
  }
  function rwTrkLoad(silent) {
    var tokens = rwTrkTokens();
    var q = '';
    var phone = (trkPhone ? (trkPhone.value || '').replace(/\D/g, '') : '');
    if (tokens.length) {
      q = '?token=' + encodeURIComponent(tokens[tokens.length - 1].token);
    } else if (/^[6-9]\d{9}$/.test(phone)) {
      q = '?phone=' + encodeURIComponent(phone);
    } else {
      if (trkAuth) { trkAuth.style.display = ''; }
      return;
    }
    fetch('/api/orders/my' + q)
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (d) {
        if (d && d.ok && Array.isArray(d.orders)) {
          var list = tokens;
          d.orders.forEach(function (o) {
            if (!o.token) return;
            var f = false;
            for (var i = 0; i < list.length; i++) { if (list[i] && list[i].id === o.id) { f = true; } }
            if (!f) { list.push({ id: o.id, token: o.token, phone: o.phone, name: o.name, total: o.total, at: o.createdAt }); }
          });
          if (list.length > 10) list = list.slice(-10);
          try { localStorage.setItem('rw_orders_tokens', JSON.stringify(list)); } catch (e) {}
          rwTrkRender(d.orders);
        } else {
          rwTrkRender(null, (d && d.error) ? d.error : 'Could not load your orders.');
        }
      })
      .catch(function () { if (!silent) { rwTrkRender(null, 'Server unreachable.'); } });
  }
  function rwTrkRender(orders, err) {
    if (trkAuth) { trkAuth.style.display = 'none'; }
    if (trkOrdersWrap) { trkOrdersWrap.style.display = ''; }
    if (trkStatus) { trkStatus.textContent = err || ''; }
    if (!orders) {
      if (trkOrdersEl) { trkOrdersEl.innerHTML = ''; }
      if (trkHistOrdersEl) { trkHistOrdersEl.innerHTML = ''; }
      return;
    }
    trkAllOrders = orders;
    var active = orders.filter(function (o) { return o.status !== 'completed' && o.status !== 'cancelled'; });
    var history = orders.filter(function (o) { return o.status === 'completed' || o.status === 'cancelled'; });
    if (trkActiveTab === 'active') {
      if (trkOrdersEl) { trkOrdersEl.style.display = ''; }
      if (trkHistOrdersEl) { trkHistOrdersEl.style.display = 'none'; }
      if (!active.length) {
        if (trkOrdersEl) { trkOrdersEl.innerHTML = ''; }
        if (trkEmptyEl) { trkEmptyEl.style.display = ''; }
      } else {
        if (trkEmptyEl) { trkEmptyEl.style.display = 'none'; }
        if (trkOrdersEl) { trkOrdersEl.innerHTML = active.map(rwTrkOrderHtml).join(''); }
      }
    } else {
      if (trkOrdersEl) { trkOrdersEl.style.display = 'none'; }
      if (trkHistOrdersEl) { trkHistOrdersEl.style.display = ''; }
      if (!history.length) {
        if (trkHistOrdersEl) { trkHistOrdersEl.innerHTML = ''; }
        if (trkHistEmptyEl) { trkHistEmptyEl.style.display = ''; }
      } else {
        if (trkHistEmptyEl) { trkHistEmptyEl.style.display = 'none'; }
        if (trkHistOrdersEl) { trkHistOrdersEl.innerHTML = history.map(rwTrkOrderHtml).join(''); }
      }
    }
    if (trkUpdatedEl) { trkUpdatedEl.textContent = 'Updated: ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); }
  }
  function rwTrkOrderHtml(o) {
    var cancelled = o.status === 'cancelled';
    var completed = o.status === 'completed';
    var threeSteps = ['placed', 'processing', 'complete'];
    var statusMap = { received: 'placed', confirmed: 'processing', preparing: 'processing', out: 'processing', delivered: 'complete', completed: 'complete' };
    var current = statusMap[o.status] || 'placed';
    var idx = threeSteps.indexOf(current);
    var stepsHtml = threeSteps.map(function (s, i) {
      var lit = !cancelled && i <= idx;
      var label = s === 'placed' ? 'Order Placed' : s === 'processing' ? 'Processing' : 'Complete Order';
      return '<div class="trk-step' + (lit ? ' is-done' : '') + (s === current ? ' is-current' : '') + '"><span class="trk-dot"></span><span class="trk-step-label">' + label + '</span></div>';
    }).join('<div class="trk-conn"></div>');
    var hist = o.statusHistory || [];
    var last = hist[hist.length - 1];
    var big = cancelled ? 'Order Cancelled'
      : (completed ? 'Order Completed'
      : (o.status === 'received' ? 'Order Placed \u2014 Processing' : 'In Processing'));
    var msg = cancelled ? 'This order was cancelled. For any questions, contact the seller.'
      : (completed ? 'Your order has been completed. Thank you!'
      : 'Your order is being processed \u2014 the seller will contact you in a few minutes.');
    return '<div class="trk-order">' +
      '<div class="trk-order-head"><div><b>Order #' + rwEscS(o.id) + '</b></div><span class="trk-date">' + rwTrkFmtTime(o.createdAt) + '</span></div>' +
      '<div class="trk-big">' + big + '</div>' +
      '<p class="trk-msg">' + msg + '</p>' +
      (cancelled
        ? '<div class="trk-cancelled">Order Cancelled</div>'
        : '<div class="trk-timeline">' + stepsHtml + '</div>') +
      '<p class="trk-upd">Last update: ' + (last ? rwTrkFmtTime(last.at) : '\u2014') + '</p>' +
      '</div>';
  }

  /* ---------- Truecaller verification ---------- */
  function rwTcVerify(mobile, onDone) {
    fetch('/api/orders/config')
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .catch(function () { return {}; })
      .then(function (cfg) {
        if (!cfg || !cfg.truecallerConfigured) { onDone({ ok: false, configError: true }); return; }
        fetch('/api/truecaller/begin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: mobile })
        })
          .then(function (r) { return r.json().catch(function () { return {}; }); })
          .catch(function () { return {}; })
          .then(function (b) {
            if (!b || !b.ok || !b.deepLink) {
              onDone({ ok: false, error: (b && b.error) || 'Could not start Truecaller verification.' });
              return;
            }
            var polls = 0;
            function poll() {
              fetch('/api/truecaller/status?phone=' + encodeURIComponent(mobile))
                .then(function (r) { return r.json().catch(function () { return {}; }); })
                .catch(function () { return {}; })
                .then(function (st) {
                  if (st && st.ok && st.verified && st.token) { onDone({ ok: true, token: st.token }); return; }
                  if (st && st.ok && st.rejected) { onDone({ ok: false, error: st.error || 'Verification rejected.' }); return; }
                  if (st && st.ok && st.expired) { onDone({ ok: false, error: st.error || 'Verification expired.' }); return; }
                  polls += 1;
                  if (polls >= 20) { onDone({ ok: false, error: 'Verification timeout - Truecaller app par confirm karke dobara try karo.' }); return; }
                  setTimeout(poll, 2500);
                });
            }
            try { window.location.href = b.deepLink; } catch (e) {}
            poll();
          });
      });
  }
  if (trkVerify) {
    trkVerify.addEventListener('click', function () {
      var phone = (trkPhone.value || '').replace(/\D/g, '');
      if (!/^[6-9]\d{9}$/.test(phone)) { if (trkAuthNote) { trkAuthNote.textContent = 'Enter a valid 10-digit mobile number.'; } return; }
      trkVerify.disabled = true;
      if (trkAuthNote) { trkAuthNote.textContent = 'Loading your orders...'; }
      fetch('/api/orders/my?phone=' + encodeURIComponent(phone))
        .then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (d) {
          trkVerify.disabled = false;
          if (d && d.ok && Array.isArray(d.orders) && d.orders.length) {
            if (trkAuthNote) { trkAuthNote.textContent = 'Found ' + d.orders.length + ' order(s) \u2713'; }
            trkVerifiedToken = 'phone-auth';
            rwTrkRender(d.orders);
            if (trkAuth) { trkAuth.style.display = 'none'; }
            if (trkOrdersWrap) { trkOrdersWrap.style.display = ''; }
          } else if (d && d.ok && d.orders && !d.orders.length) {
            if (trkAuthNote) { trkAuthNote.textContent = 'Is phone number pe koi order nahi mila.'; }
          } else {
            if (trkAuthNote) { trkAuthNote.textContent = (d && d.error) || 'Could not load orders.'; }
          }
        })
        .catch(function () { trkVerify.disabled = false; if (trkAuthNote) { trkAuthNote.textContent = 'Server unreachable. Try again.'; } });
    });
  }
  if (trkPhone) {
    trkPhone.addEventListener('input', function () { trkVerifiedToken = ''; });
  }
  if (trkClose) { trkClose.addEventListener('click', rwTrkCloseM); }
  var trkBackdrops = document.querySelectorAll('[data-close-trk]');
  for (var i = 0; i < trkBackdrops.length; i++) { trkBackdrops[i].addEventListener('click', rwTrkCloseM); }
  if (navTrackBtn) { navTrackBtn.addEventListener('click', rwTrkOpen); }
  if (trkTabActive) { trkTabActive.addEventListener('click', function () { trkActiveTab = 'active'; trkTabActive.classList.add('is-active'); if (trkTabHistory) trkTabHistory.classList.remove('is-active'); if (trkAllOrders.length) rwTrkRender(trkAllOrders); }); }
  if (trkTabHistory) { trkTabHistory.addEventListener('click', function () { trkActiveTab = 'history'; trkTabHistory.classList.add('is-active'); if (trkTabActive) trkTabActive.classList.remove('is-active'); if (trkAllOrders.length) rwTrkRender(trkAllOrders); }); }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && trkModal && !trkModal.hidden) { rwTrkCloseM(); }
  });

  /* ---------- Mobile nav ---------- */
  var navBurger = document.getElementById('navBurger');
  var navLinks = document.getElementById('navLinks');
  var navSearchBox = document.querySelector('.navbar-search');
  function closeMobileMenu() {
    if (navBurger) { navBurger.classList.remove('is-active'); navBurger.setAttribute('aria-expanded', 'false'); navBurger.setAttribute('aria-label', 'Open menu'); }
    if (navLinks) { navLinks.classList.remove('is-open'); }
  }
  function collapseMobileSearch() { if (navSearchBox) { navSearchBox.classList.remove('is-expanded'); } }
  if (navBurger && navLinks) {
    navBurger.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = navLinks.classList.toggle('is-open');
      navBurger.classList.toggle('is-active', open);
      navBurger.setAttribute('aria-expanded', open ? 'true' : 'false');
      navBurger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      collapseMobileSearch();
    });
    Array.prototype.forEach.call(navLinks.querySelectorAll('a'), function (a) { a.addEventListener('click', closeMobileMenu); });
  }
  if (navSearchBox && searchInput) {
    navSearchBox.addEventListener('click', function (e) {
      if (e.target.closest('.nav-search-clear')) return;
      e.stopPropagation();
      closeMobileMenu();
      if (typeof rwOpenSearch === 'function') {
        searchInput.focus();
        rwOpenSearch();
      } else {
        navSearchBox.classList.add('is-expanded');
        searchInput.focus();
      }
    });
  }
  document.addEventListener('click', function (e) {
    if (navLinks && navLinks.classList.contains('is-open') && !e.target.closest('.navbar-links') && !e.target.closest('.navbar-burger')) { closeMobileMenu(); }
    if (navSearchBox && navSearchBox.classList.contains('is-expanded') && !e.target.closest('.navbar-search')) { collapseMobileSearch(); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeMobileMenu(); collapseMobileSearch(); } });

  /* ---------- Cart wiring ---------- */
  if (cartBtn) { cartBtn.addEventListener('click', openDrawer); }
  if (bar) { bar.addEventListener('click', openDrawer); }
  if (clearBtn) { clearBtn.addEventListener('click', clearCart); }
  if (closeBtn) { closeBtn.addEventListener('click', closeDrawer); }
  var backBtn = document.getElementById('drawerBack'); if (backBtn) { backBtn.addEventListener('click', closeDrawer); }
  if (backdrop) { backdrop.addEventListener('click', closeDrawer); }
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', function () {
      if (!meetsMinimum()) return;
      renderCheckoutSummary();
      showStep('checkout');
    });
  }
  if (coBack) { coBack.addEventListener('click', function () { showStep('cart'); }); }
  if (coContinue) {
    coContinue.addEventListener('click', function () {
      closeDrawer();
      cart = Object.create(null);
      pending = Object.create(null);
      save(); applyToSteppers(); render();
      coName.value = ''; coMobile.value = ''; coAddress.value = '';
      if (coCity) { coCity.value = ''; } if (coPincode) { coPincode.value = ''; } if (coNote) { coNote.value = ''; }
      phoneVerified = false; phoneVerifyToken = '';
      if (coVerifyBtn) { coVerifyBtn.disabled = false; coVerifyBtn.textContent = 'Verify with Truecaller'; }
      if (coVerifyStatus) { coVerifyStatus.textContent = ''; coVerifyStatus.className = 'co-verify-status'; }
      if (coVerifyNote) { coVerifyNote.textContent = VERIFY_DEFAULT_NOTE; }
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer && drawer.classList.contains('is-open')) { closeDrawer(); }
  });

  /* ---------- Phone verification ---------- */
  var coVerifyBtn = document.getElementById('coVerifyBtn');
  var coVerifyStatus = document.getElementById('coVerifyStatus');
  var coVerifyNote = document.getElementById('coVerifyNote');
  var coCity = document.getElementById('coCity');
  var coPincode = document.getElementById('coPincode');
  var coNote = document.getElementById('coNote');
  var coCityErr = document.getElementById('coCityErr');
  var coPincodeErr = document.getElementById('coPincodeErr');
  var phoneVerified = false;
  var phoneVerifyToken = '';
  var VERIFY_DEFAULT_NOTE = coVerifyNote ? coVerifyNote.textContent : '';
  var rwTcStrict = false;
  function rwApplyTcMode() {
    if (!rwTcStrict) return;
    rwSetVerify('Verification required', 'is-err');
    if (coVerifyNote) { coVerifyNote.textContent = 'Truecaller verification required before ordering \u2014 setup abhi incomplete hai (owner ko data/server-config.json me truecaller.appId + truecaller.sdkUrl add karne hain). Verification ke bina order place NAHI ho sakta.'; }
  }
  fetch('/api/orders/config')
    .then(function (r) { return r.json().catch(function () { return {}; }); })
    .catch(function () { return {}; })
    .then(function (cfg) { });
  function rwMobile() { return (coMobile.value || '').replace(/\D/g, ''); }
  function rwSetVerify(text, cls) {
    if (coVerifyStatus) { coVerifyStatus.textContent = text; coVerifyStatus.className = 'co-verify-status' + (cls ? ' ' + cls : ''); }
  }
  if (coMobile) {
    coMobile.addEventListener('input', function () {
      if (phoneVerified) {
        phoneVerified = false; phoneVerifyToken = '';
        rwSetVerify('Number changed \u2014 verify again', 'is-warn');
        if (coVerifyBtn) { coVerifyBtn.disabled = false; coVerifyBtn.textContent = 'Verify with Truecaller'; }
      }
    });
  }
  if (coVerifyBtn) {
    coVerifyBtn.addEventListener('click', function () {
      var vmobile = rwMobile();
      if (!/^[6-9]\d{9}$/.test(vmobile)) {
        coMobileErr.textContent = 'Enter a valid 10-digit Indian mobile number (starts with 6-9)';
        coMobile.classList.add('err');
        return;
      }
      coMobileErr.textContent = ''; coMobile.classList.remove('err');
      coVerifyBtn.disabled = true;
      rwSetVerify('Starting Truecaller verification...', 'is-pending');
      rwTcVerify(vmobile, function (d) {
        coVerifyBtn.disabled = false;
        if (d.ok) {
          phoneVerified = true;
          phoneVerifyToken = d.token;
          rwSetVerify('Number Verified \u2713', 'is-ok');
          coVerifyBtn.textContent = 'Verified with Truecaller';
          if (coVerifyNote) { coVerifyNote.textContent = 'Verified through the official Truecaller flow. Proceed to place your order.'; }
        } else if (d.configError) {
          phoneVerified = false; phoneVerifyToken = '';
          rwSetVerify('Truecaller not configured', 'is-err');
          if (coVerifyNote) { coVerifyNote.textContent = 'Truecaller verification is not set up on the server yet. The owner must add the Truecaller Web-app key (truecaller.apiKey) in data/server-config.json and register the callback URL on developer.truecaller.com before orders can be placed.'; }
        } else if (d.sdkError) {
          phoneVerified = false; phoneVerifyToken = '';
          rwSetVerify('Verification failed', 'is-err');
          if (coVerifyNote) { coVerifyNote.textContent = 'Truecaller verification sirf phone par Truecaller app se hoti hai - app install karke dobara try karo.'; }
        } else {
          phoneVerified = false; phoneVerifyToken = '';
          rwSetVerify('Phone verification failed', 'is-err');
          if (coVerifyNote) { coVerifyNote.textContent = (d.error || 'Phone verification failed. Please try again.') + ' Tap "Verify with Truecaller" to try again.'; }
        }
      });
    });
  }

  /* ---------- Place Order ---------- */
  var submitting = false;
  var lastOrderRef = null;
  var suTrackBtn = document.getElementById('suTrackBtn');
  var suOrderId = document.getElementById('suOrderId');
  var suName = document.getElementById('suName');
  var suTotal = document.getElementById('suTotal');
  var suEta = document.getElementById('suEta');
  var suWaNote = document.getElementById('suWaNote');
  function rwNonce() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
  function rwSaveToken(order) {
    try {
      var list = JSON.parse(localStorage.getItem('rw_orders_tokens') || '[]');
      if (!Array.isArray(list)) list = [];
      var seen = false;
      for (var i = 0; i < list.length; i++) { if (list[i] && list[i].id === order.id) { seen = true; } }
      if (!seen) { list.push({ id: order.id, token: order.token, phone: order.phone, name: order.name, total: order.total, at: order.createdAt }); }
      list = list.slice(-10);
      localStorage.setItem('rw_orders_tokens', JSON.stringify(list));
    } catch (e) {}
  }
  if (coSubmit) {
    coSubmit.addEventListener('click', function () {
      if (submitting) return;
      var name = (coName.value || '').trim();
      var mobile = rwMobile();
      var address = (coAddress.value || '').trim();
      var city = coCity ? (coCity.value || '').trim() : '';
      var pincode = coPincode ? (coPincode.value || '').trim() : '';
      var note = coNote ? (coNote.value || '').trim() : '';
      var err = false;
      coNameErr.textContent = ''; coMobileErr.textContent = ''; coAddressErr.textContent = '';
      if (coCityErr) { coCityErr.textContent = ''; }
      if (coPincodeErr) { coPincodeErr.textContent = ''; }
      coName.classList.remove('err'); coMobile.classList.remove('err'); coAddress.classList.remove('err');
      if (coCity) { coCity.classList.remove('err'); }
      if (coPincode) { coPincode.classList.remove('err'); }
      if (!name) { coNameErr.textContent = 'Name is required'; coName.classList.add('err'); err = true; }
      if (!/^[6-9]\d{9}$/.test(mobile)) { coMobileErr.textContent = 'Enter a valid 10-digit Indian mobile number (starts with 6-9)'; coMobile.classList.add('err'); err = true; }
      if (!address) { coAddressErr.textContent = 'Delivery address is required'; coAddress.classList.add('err'); err = true; }
      if (!city) { if (coCityErr) { coCityErr.textContent = 'City is required'; } if (coCity) { coCity.classList.add('err'); } err = true; }
      if (!/^\d{6}$/.test(pincode)) { if (coPincodeErr) { coPincodeErr.textContent = 'Enter a valid 6-digit pincode'; } if (coPincode) { coPincode.classList.add('err'); } err = true; }
      if (rwTcStrict && (!phoneVerified || !phoneVerifyToken)) {
        rwSetVerify('Verify your mobile number with Truecaller before placing the order', 'is-err');
        err = true;
      }
      if (err) return;
      rwSetVerify('', '');
      var items = [];
      Object.keys(cart).forEach(function (k) {
        var it = cart[k];
        items.push({ id: k, qty: Math.round(it.qty), size: it.boxSize + ' bottles' });
      });
      submitting = true;
      coSubmit.disabled = true;
      lastOrderRef = null;
      fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name, phone: mobile, address: address, city: city, pincode: pincode,
          note: note, items: items, type: 'cash', nonce: rwNonce(), verificationToken: phoneVerifyToken
        })
      })
        .then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (d) {
          if (d && d.ok && d.order) {
            lastOrderRef = d.order.id;
            try { localStorage.setItem(KEY + ':lastOrder', JSON.stringify({ ref: d.order.id, at: Date.now(), total: d.order.total })); } catch (e) {}
            rwSaveToken(d.order);
            if (suOrderId) { suOrderId.textContent = '#' + d.order.id; }
            if (suName) { suName.textContent = d.order.name; }
            if (suTotal) { suTotal.textContent = money(d.order.total); }
            if (suEta) { suEta.textContent = d.order.eta || '\u2014'; }

            /* Auto-open WhatsApp with full order details */
            var ownerPhone = d.ownerPhone || '';
            if (ownerPhone) {
              var itemLines = (d.order.items || []).map(function (it) { return '- ' + it.name + ' (' + it.size + ') x ' + it.qty + ' = ' + money(it.lineTotal || (it.qty * it.price)); }).join('%0A');
              var waMsg = '*New Order ' + d.order.id + '*%0A%0A' +
                '*Customer:* ' + (d.order.name || '') + '%0A' +
                '*Phone:* ' + (d.order.phone || '') + '%0A' +
                '*Address:* ' + (d.order.address || '') + '%0A' +
                '*City:* ' + (d.order.city || '') + ' - ' + (d.order.pincode || '') + '%0A' +
                (d.order.note ? '*Note:* ' + d.order.note + '%0A' : '') +
                '%0A*Items:*%0A' + itemLines + '%0A%0A' +
                '*Total:* ' + money(d.order.total) + '%0A' +
                '*Payment:* ' + (d.order.type || 'COD');
              var waLink = 'https://wa.me/' + ownerPhone + '?text=' + waMsg;
              var waWin = window.open(waLink, '_blank');
              if (!waWin || waWin.closed || typeof waWin.closed === 'undefined') {
                location.href = waLink;
              }
            }

            if (suWaNote) {
              suWaNote.style.display = '';
              if (ownerPhone) {
                suWaNote.textContent = 'Order placed! WhatsApp khul gaya hai owner ko order details bhejne ke liye.';
                suWaNote.style.color = '#4ade80';
              } else {
                suWaNote.textContent = 'Order saved! Team aapko contact karegi.';
                suWaNote.style.color = '#fbbf24';
              }
            }
            cart = Object.create(null);
            pending = Object.create(null);
            save(); applyToSteppers(); render();
            renderCheckoutSummary();
            showStep('success');
          } else if (d && d.duplicate && d.order) {
            notify('Order #' + d.order.id + ' was already placed for this cart');
            rwSaveToken(d.order);
            cart = Object.create(null);
            pending = Object.create(null);
            save(); applyToSteppers(); render();
          } else if (d && d.error) {
            notify(d.error);
          } else {
            notify('Order failed. Please try again.');
          }
        })
        .catch(function () { notify('Order failed \u2014 server unreachable. Please try again.'); })
        .finally(function () { submitting = false; if (coSubmit) { coSubmit.disabled = false; } });
    });
  }
  if (suTrackBtn) { suTrackBtn.addEventListener('click', function () { closeDrawer(); rwTrkOpen(); }); }

  /* ---------- Reviews (products page) ---------- */
  var REVIEWS = (window.SITE_DATA && window.SITE_DATA.reviews && window.SITE_DATA.reviews.grid) || [
    { name: 'Aman Sharma', rating: 5, text: 'Regular monthly supply, always on time and the bottles are sealed and clean.', product: '500 ML Box', date: 'Aug 2026', demo: true },
    { name: 'Priya Verma', rating: 5, text: 'Ordered for a family function \u2014 the 2 LITRE boxes worked perfectly for 150+ guests.', product: '2 LITRE Box', date: 'Jul 2026', demo: true },
    { name: 'Hotel Rajput Palace', rating: 4, text: 'Consistent bulk delivery for our restaurant. Sturdy packaging that stores well.', product: 'Bulk Supply', date: 'Jun 2026', demo: true }
  ];
  var SERVER_REVIEWS = [];
  function mergeServerReviews() {
    if (!SERVER_REVIEWS.length) return;
    var known = [];
    REVIEWS.forEach(function (r) { known.push(r.name + '|' + r.text); });
    var fresh = SERVER_REVIEWS.filter(function (s) {
      return known.indexOf(s.name + '|' + s.text) === -1;
    });
    if (fresh.length) REVIEWS = fresh.concat(REVIEWS);
  }
  function renderReviews() {
    mergeServerReviews();
    var grid = document.getElementById('reviewGrid');
    if (!grid) return;
    grid.innerHTML = REVIEWS.map(function (r, i) {
      var stars = '';
      for (var si = 1; si <= 5; si++) { stars += si <= r.rating ? '\u2605' : '\u2606'; }
      var replyHtml = r.reply ? '<div class="review-reply"><span class="review-reply-label">Owner reply:</span> ' + esc(r.reply) + '</div>' : '';
      return '<article class="review-card" style="animation-delay:' + (i * 130) + 'ms">' +
        '<div class="review-stars" aria-label="' + r.rating + ' out of 5 stars">' + stars + '</div>' +
        '<p class="review-text">\u201C' + r.text + '\u201D</p>' +
        '<div class="review-foot">' +
          '<span class="review-name">' + r.name + '</span>' +
          (r.product ? '<span class="review-meta"> \u00B7 ' + r.product + '</span>' : '') +
          (r.date ? '<span class="review-meta"> \u00B7 ' + r.date + '</span>' : '') +
          (r.demo ? '<span class="review-demo-chip">Demo</span>' : '') +
        '</div>' +
        replyHtml +
      '</article>';
    }).join('');
  }
  renderReviews();
  try {
    if (window.fetch) {
      fetch('/api/reviews').then(function (r) { return r.ok ? r.json() : []; })
        .then(function (list) {
          if (Array.isArray(list) && list.length) { SERVER_REVIEWS = list; renderReviews(); }
        }).catch(function () {});
    }
  } catch (e) {}

  /* ---------- User reviews (homepage) ---------- */
  var USER_REVIEWS_KEY = 'rw_user_reviews';
  var userReviews = [];
  try {
    var _saved = localStorage.getItem(USER_REVIEWS_KEY);
    if (_saved) userReviews = JSON.parse(_saved);
    if (!Array.isArray(userReviews)) userReviews = [];
  } catch (e) { userReviews = []; }
  window.RW_USER_REVIEWS = userReviews;
  function notifyReviewsChanged() {
    try { window.dispatchEvent(new Event('rw:reviews-updated')); } catch (e) {}
  }

  /* ---------- Write a Review form ---------- */
  var revForm = document.getElementById('reviewForm');
  var revStars = 0;
  if (revForm) {
    var revOpenBtn = document.getElementById('reviewOpenBtn');
    var revCancelBtn = document.getElementById('revCancel');
    var revSubmitBtn = document.getElementById('revSubmit');
    var revErrEl = document.getElementById('revErr');
    var revStarBtns = Array.prototype.slice.call(document.querySelectorAll('#revStars button'));
    revOpenBtn.addEventListener('click', function () { revForm.hidden = false; revOpenBtn.style.display = 'none'; });
    revCancelBtn.addEventListener('click', function () { revForm.hidden = true; revOpenBtn.style.display = ''; });
    revStarBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        revStars = Number(b.getAttribute('data-s'));
        revStarBtns.forEach(function (x) { x.classList.toggle('on', Number(x.getAttribute('data-s')) <= revStars); });
      });
    });
    revSubmitBtn.addEventListener('click', function () {
      var name = (document.getElementById('revName').value || '').trim();
      var prod = (document.getElementById('revProduct').value || '').trim();
      var text = (document.getElementById('revText').value || '').trim();
      if (!name || !text || !revStars) { revErrEl.textContent = 'Please add your name, a star rating and review text.'; return; }
      revErrEl.textContent = '';
      revSubmitBtn.disabled = true;
      revSubmitBtn.textContent = 'Submitting...';
      var now = new Date();
      var mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][now.getMonth()];
      var dateStr = mon + ' ' + now.getFullYear();
      var rev = { name: name, rating: revStars, text: text, product: prod, date: dateStr };
      /* Save to server first — this is the source of truth */
      fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rev)
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (d && d.ok) {
          /* Server saved — also add to local list for instant display */
          rev.id = d.id;
          rev.at = Date.now();
          userReviews.unshift(rev);
          try { localStorage.setItem(USER_REVIEWS_KEY, JSON.stringify(userReviews.slice(0, 50))); } catch (e) {}
          notifyReviewsChanged();
          revForm.hidden = true;
          revOpenBtn.style.display = '';
          revStarBtns.forEach(function (x) { x.classList.remove('on'); });
          revStars = 0;
          document.getElementById('revName').value = '';
          document.getElementById('revProduct').value = '';
          document.getElementById('revText').value = '';
          revErrEl.style.color = '#35E0A1';
          revErrEl.textContent = 'Thanks! Your review is now visible on all devices. \u2713';
        } else {
          revErrEl.style.color = '#FF5C7A';
          revErrEl.textContent = 'Failed to submit review. Please try again.';
        }
        revSubmitBtn.disabled = false;
        revSubmitBtn.textContent = 'Submit Review';
      }).catch(function () {
        revErrEl.style.color = '#FF5C7A';
        revErrEl.textContent = 'Network error. Check your connection and try again.';
        revSubmitBtn.disabled = false;
        revSubmitBtn.textContent = 'Submit Review';
      });
    });
  }

  /* ---------- Init ---------- */
  renderProducts();

  /* ---------- Product focus (products.html) ---------- */
  try {
    var focusPid = new URLSearchParams(location.search).get('focus');
    if (focusPid) {
      setTimeout(function () {
        var card = document.querySelector('.rw-product-card[data-id="' + focusPid + '"]');
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.classList.remove('rw-sr-flash'); void card.offsetWidth; card.classList.add('rw-sr-flash');
          setTimeout(function () { card.classList.remove('rw-sr-flash'); }, 2400);
        }
      }, 350);
    }
  } catch (e) {}

  loadCart();
  Object.keys(cart).forEach(function (k) {
    cart[k].price = priceOf(k);
    cart[k].label = labelOf(k);
    cart[k].boxSize = sizeOf(k);
  });
  save();
  applyToSteppers();
  render();
})();
