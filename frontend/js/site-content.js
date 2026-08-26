/* ============================================================
   Rajesh Water — site-content.js
   Applies window.SITE_DATA (edited via admin.html) to the live
   page: brand, logo, texts, contact numbers, reviews, theme.
   Load this AFTER data/site-data.js, BEFORE inline builders.
   
   v3: Static data instant + background fetch for live updates.
   No blocking API call on load.
   ============================================================ */
(function () {
  "use strict";

  var D = window.SITE_DATA || {};

  function applyProducts(data) {
    if (data && Array.isArray(data.products) && data.products.length) {
      window.PRODUCTS = data.products;
    }
  }

  function trust(d) { return d && (d.name || d.tagline) ? d : null; }

  function applyBrand() {
    if (!D.brand) return;
    var text = function (sel, val) {
      if (val == null) return;
      document.querySelectorAll(sel).forEach(function (el) {
        el.textContent = val;
      });
    };
    text('.nb-name', D.brand.name);
    text('.navbar-word small', D.brand.tagline);

    var imgSrc = D.brand.logoImage || '';
    document.querySelectorAll('.navbar-brand').forEach(function (brand) {
      var svg = brand.querySelector('.navbar-logo');
      if (!svg) return;
      if (imgSrc) {
        if (svg.tagName.toLowerCase() !== 'img') {
          var img = document.createElement('img');
          img.className = 'navbar-logo navbar-logo-img';
          img.src = imgSrc;
          img.alt = D.brand.name || '';
          img.draggable = false;
          svg.replaceWith(img);
        } else {
          svg.src = imgSrc;
        }
      } else if (svg.tagName.toLowerCase() === 'img') {
        var n = document.createElement('span');
        n.className = 'navbar-logo';
        n.style.display = 'none';
        svg.replaceWith(n);
      }
    });

    if (D.brand.logoFrom || D.brand.logoTo) {
      ['rwLogoGrad', 'rwLogoGradF'].forEach(function (id) {
        var g = document.getElementById(id);
        if (!g) return;
        var stops = g.querySelectorAll('stop');
        if (stops[0] && D.brand.logoFrom) stops[0].setAttribute('stop-color', D.brand.logoFrom);
        if (stops[1] && D.brand.logoTo) stops[1].setAttribute('stop-color', D.brand.logoTo);
      });
    }
  }

  function applyContact() {
    if (!D.contact) return;
    var wa = D.contact.whatsapp, ph = D.contact.phone;
    if (wa) {
      document.querySelectorAll('a[href*="wa.me/"]').forEach(function (a) {
        a.href = a.href.replace(/wa\.me\/\d+/, 'wa.me/' + wa);
      });
      if (D.contact.supportMsg) {
        document.querySelectorAll('.support-card[href*="wa.me/"]').forEach(function (a) {
          a.href = 'https://wa.me/' + wa + '?text=' + encodeURIComponent(D.contact.supportMsg);
        });
      }
    }
    if (ph) {
      document.querySelectorAll('a[href*="tel:+"]').forEach(function (a) {
        a.href = a.href.replace(/tel:\+\d+/, 'tel:+' + ph);
      });
      var fmtPh = '+91 ' + ph.slice(2, 7) + ' ' + ph.slice(7, 12);
      document.querySelectorAll('[data-s="support.c2l"]').forEach(function (el) {
        el.textContent = fmtPh + ' \u2192';
      });
    }
  }

  /* Map every element bearing data-s="a.b.c" to SITE_DATA.a.b.c */
  function applyTexts() {
    document.querySelectorAll('[data-s]').forEach(function (el) {
      var key = el.getAttribute('data-s');
      if (key === 'support.c2l') return;
      var parts = key.split('.');
      var node = D;
      for (var i = 0; i < parts.length && node; i++) node = node[parts[i]];
      if (node == null) return;
      el.textContent = node;
    });
  }

  function hexRgb(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function applyTheme() {
    if (!D.theme) return;
    var css = '';
    if (D.theme.accent) {
      var rgb = hexRgb(D.theme.accent);
      if (rgb) {
        css += '--ice:' + D.theme.accent + ';';
        css += '--ice-dim:rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.55);';
        css += '--line:rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.16);';
      }
      css += '--rw-accent:' + D.theme.accent + ';';
    }
    if (D.theme.deep) css += '--rw-deep:' + D.theme.deep + ';';
    var st = document.getElementById('site-theme');
    if (!st) {
      st = document.createElement('style');
      st.id = 'site-theme';
      document.head.appendChild(st);
    }
    st.textContent = ':root{' + css + '}';
    if (!D.theme.animate) document.documentElement.classList.add('rw-anim-off');
    else document.documentElement.classList.remove('rw-anim-off');
  }

  function applyStage() {
    var si = (D.hero && D.hero.stageImg) || [];
    for (var i = 0; i < 5; i++) {
      var src = si[i];
      if (!src) continue;
      document.querySelectorAll('.spin[data-i="' + i + '"] img').forEach(function (im) {
        im.src = src;
      });
    }
    var di = (D.hero && D.hero.deliverImg) || [];
    for (var i = 0; i < 5; i++) {
      var src = di[i];
      if (!src) continue;
      document.querySelectorAll('.drink[data-i="' + i + '"] img').forEach(function (im) {
        im.src = src;
      });
    }
    var bi = (D.about && D.about.bottleImg) || '';
    if (bi) {
      document.querySelectorAll('.about-bottle').forEach(function (im) { im.src = bi; });
    }
  }

  function applyAll(data) {
    if (!data || typeof data !== 'object') return;
    window.SITE_DATA = data;
    D = data;
    applyProducts(D);
    applyBrand();
    applyContact();
    applyTexts();
    applyStage();
    applyTheme();
    if (typeof window.renderProducts === 'function') {
      try { window.renderProducts(); } catch (e) {}
    }
  }

  function applyStatic() {
    if (!window.SITE_DATA) return;
    D = window.SITE_DATA;
    applyProducts(D);
    applyBrand();
    applyContact();
    applyTexts();
    applyStage();
    applyTheme();
  }

  /* Apply static data immediately, then fetch live in background */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      applyStatic();
      fetch('/api/site-data').then(function (r) { return r.json(); }).then(function (res) {
        if (res && res.ok && res.content) applyAll(res.content);
      }).catch(function () {});
    });
  } else {
    applyStatic();
    fetch('/api/site-data').then(function (r) { return r.json(); }).then(function (res) {
      if (res && res.ok && res.content) applyAll(res.content);
    }).catch(function () {});
  }

  window.siteApplyContent = applyStatic;
  window.siteContentApplied = true;
})();