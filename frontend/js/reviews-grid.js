/* ============================================================
   Rajesh Water — Homepage Review Grid (top 6)
   ============================================================ */
(function () {
  var grid = document.getElementById('reviewGrid');
  if (!grid) return;

  function allReviews() {
    var base = (window.SITE_DATA && window.SITE_DATA.reviews && window.SITE_DATA.reviews.grid) || [
      { name: 'Aman Sharma', rating: 5, text: 'Regular monthly supply, always on time and the bottles are sealed and clean.', product: '500 ML Box', date: 'Aug 2026' },
      { name: 'Priya Verma', rating: 5, text: 'Ordered for a family function \u2014 the 2 LITRE boxes worked perfectly for 150+ guests.', product: '2 LITRE Box', date: 'Jul 2026' },
      { name: 'Hotel Rajput Palace', rating: 4, text: 'Consistent bulk delivery for our restaurant. Sturdy packaging that stores well.', product: 'Bulk Supply', date: 'Jun 2026' },
      { name: 'Rohit Mehta', rating: 5, text: 'Messaged on WhatsApp in the morning, boxes reached by afternoon. Smooth and quick.', product: '1 LITRE Box', date: 'Jul 2026' },
      { name: 'Sneha Kulkarni', rating: 4, text: 'Cold drink boxes for our office pantry at a fair price. Will order again next month.', product: 'Cold Drinks', date: 'Jun 2026' }
    ];
    var server = (window.RW_SERVER_REVIEWS && window.RW_SERVER_REVIEWS.length) ? window.RW_SERVER_REVIEWS : [];
    var users = (window.RW_USER_REVIEWS && window.RW_USER_REVIEWS.length) ? window.RW_USER_REVIEWS : [];
    return server.concat(users).concat(base);
  }

  function initials(name) {
    return name.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
  }

  function stars(n) {
    var s = '';
    for (var i = 1; i <= 5; i++) s += i <= n ? '\u2605' : '\u2606';
    return s;
  }

  function render() {
    var all = allReviews();
    all.sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); });
    var top = all.slice(0, 6);
    grid.innerHTML = top.map(function (r) {
      return '<div class="rw-review-card">' +
        '<div class="rw-review-stars">' + stars(r.rating) + '</div>' +
        '<p class="rw-review-text">\u201c' + (r.text || '') + '\u201d</p>' +
        '<div class="rw-review-author">' +
          '<div class="rw-review-avatar">' + initials(r.name || '?') + '</div>' +
          '<div><div class="rw-review-name">' + (r.name || '') + '</div>' +
          '<div class="rw-review-meta">' + (r.product || '') + (r.date ? ' \u00b7 ' + r.date : '') + '</div></div>' +
        '</div></div>';
    }).join('');
  }

  render();
  window.addEventListener('rw:reviews-updated', render);

  fetch('/api/reviews').then(function (r) { return r.ok ? r.json() : []; })
    .then(function (list) {
      if (Array.isArray(list) && list.length) {
        window.RW_SERVER_REVIEWS = list;
        render();
      }
    }).catch(function () {});
})();
