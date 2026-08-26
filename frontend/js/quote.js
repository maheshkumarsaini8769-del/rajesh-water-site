/* ============================================================
   Rajesh Water — Bulk Order Quote Modal
   Shared by index.html and products.html
   ============================================================ */
(function () {
  if (!window.PRODUCTS || !document.getElementById('quoteOverlay')) return;
  var OVERLAY = document.getElementById('quoteOverlay');
  var FORM_STAGE = document.getElementById('quoteFormStage');
  var SUCCESS = document.getElementById('quoteSuccessStage');
  var ERR = document.getElementById('qFormErr');
  var current = null, qty = 1, waText = '';
  function el(id) { return document.getElementById(id); }
  function findProduct(id) {
    for (var i = 0; i < window.PRODUCTS.length; i++) { if (window.PRODUCTS[i].id === id) return window.PRODUCTS[i]; }
    return null;
  }
  function renderProduct() {
    if (!current) return;
    el('quoteImg').src = current.img;
    el('quoteName').textContent = current.label || (current.name + ' \u2014 ' + current.size);
    el('quoteMeta').textContent = current.size + ' \u2022 ' + current.boxSize + ' bottles per box \u2022 Packaging: box of ' + current.boxSize;
    el('quoteQty').textContent = qty;
  }
  function clearErrors() {
    Array.prototype.forEach.call(document.querySelectorAll('.rw-q-input.is-error'), function (i) { i.classList.remove('is-error'); });
    ERR.textContent = '';
  }
  function resetFields() {
    ['qName', 'qMobile', 'qAddress', 'qCity', 'qPincode', 'qMsg'].forEach(function (id) { var f = el(id); if (f) f.value = ''; });
    if (el('qDate')) el('qDate').value = '';
    clearErrors();
  }
  function closeQuote() {
    OVERLAY.classList.remove('is-open');
    OVERLAY.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rw-quote-lock');
    var btn = el('qSubmitBtn');
    if (btn) { btn.disabled = false; el('qSubmitLabel').textContent = 'Bulk Order'; }
  }
  window.rwOpenQuote = function (card) {
    var p = null;
    if (card) { p = findProduct(card.getAttribute('data-id')); }
    if (!p) { p = findProduct('p001') || window.PRODUCTS[0]; }
    if (!p) return;
    current = p;
    qty = Math.max(p.minBoxes || 1, 1);
    renderProduct();
    resetFields();
    SUCCESS.classList.remove('is-visible');
    FORM_STAGE.style.display = '';
    OVERLAY.classList.add('is-open');
    OVERLAY.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rw-quote-lock');
    setTimeout(function () { var f = el('qName'); if (f) f.focus(); }, 340);
  };
  var bulkBtn = document.getElementById('bulkQuoteBtn');
  if (bulkBtn) {
    bulkBtn.addEventListener('click', function () {
      if (typeof window.rwOpenQuote === 'function') { window.rwOpenQuote(null); }
      else { location.href = 'products.html'; }
    });
  }
  document.getElementById('quoteMinus').addEventListener('click', function () {
    qty = Math.max(qty - 1, (current && current.minBoxes) || 1);
    el('quoteQty').textContent = qty;
  });
  document.getElementById('quotePlus').addEventListener('click', function () {
    qty = Math.min(qty + 1, 500);
    el('quoteQty').textContent = qty;
  });
  document.getElementById('qSubmitBtn').addEventListener('click', function () {
    var name = el('qName').value.trim();
    var mobile = el('qMobile').value.trim();
    var address = el('qAddress').value.trim();
    var city = el('qCity').value.trim();
    var pincode = el('qPincode').value.trim();
    var date = el('qDate').value;
    var msg = el('qMsg').value.trim();
    var bad = [];
    if (name.length < 2) { bad.push('qName'); }
    if (!/^[6-9]\d{9}$/.test(mobile)) { bad.push('qMobile'); }
    if (address.length < 5) { bad.push('qAddress'); }
    if (city.length < 2) { bad.push('qCity'); }
    if (!/^\d{6}$/.test(pincode)) { bad.push('qPincode'); }
    clearErrors();
    if (bad.length) {
      bad.forEach(function (id) { el(id).classList.add('is-error'); });
      ERR.textContent = 'Please fill the required fields correctly, then try again.';
      el(bad[0]).focus();
      return;
    }
    waText = [
      'Hello Rajesh Water,',
      'I would like to place a bulk order.',
      'Product: ' + (current.label || current.name),
      'Size: ' + current.size,
      'Quantity: ' + qty + ' Boxes (' + current.boxSize + ' bottles per box)',
      'Name: ' + name,
      'Mobile: ' + mobile,
      'Address: ' + address + ', ' + city + ' - ' + pincode,
      'Preferred Delivery: ' + (date || 'Flexible'),
      'Message: ' + (msg || '-')
    ].join('\n');
    var label = el('qSubmitLabel');
    label.innerHTML = '<span class="rw-spinner"></span> Sending\u2026';
    el('qSubmitBtn').disabled = true;
    setTimeout(function () {
      try {
        var saved = [];
        try { saved = JSON.parse(localStorage.getItem('rw_quote_enquiries') || '[]'); } catch (e) {}
        saved.push({ id: Date.now(), productId: current.id, product: current.label || current.name, size: current.size, qty: qty, name: name, mobile: mobile, address: address, city: city, pincode: pincode, date: date, message: msg, ts: new Date().toISOString() });
        localStorage.setItem('rw_quote_enquiries', JSON.stringify(saved));
      } catch (e) {}
      FORM_STAGE.style.display = 'none';
      SUCCESS.classList.add('is-visible');
    }, 950);
  });
  document.getElementById('qWABtn').addEventListener('click', function () {
    var url = 'https://wa.me/' + ((window.SITE_DATA && window.SITE_DATA.contact && window.SITE_DATA.contact.whatsapp) || '917742735762') + '?text=' + encodeURIComponent(waText);
    window.open(url, '_blank', 'noopener');
  });
  document.getElementById('quoteCloseBtn').addEventListener('click', closeQuote);
  document.getElementById('qClose2Btn').addEventListener('click', closeQuote);
  OVERLAY.addEventListener('click', function (e) { if (e.target === OVERLAY) closeQuote(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && OVERLAY.classList.contains('is-open')) closeQuote();
  });
})();
