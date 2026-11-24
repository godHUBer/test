/* =============================================================================
   Sohan Automobile — live data layer (Supabase)
   The pages render fully from the build-time snapshot, then this file asks the
   dealership's Supabase project for the current published inventory and
   reconciles the difference: prices and odometers are refreshed, reserved cars
   are badged, sold cars leave the grids (their own pages stay up with a notice),
   cars added through the admin panel appear, and every "N cars published"
   figure is corrected. If Supabase cannot be reached — offline, slow, blocked —
   nothing happens and the static page stands exactly as it shipped.
   The key below is the public publishable key: it can only read rows the
   database's row-level security exposes. ~10 KB, no dependencies.
   ============================================================================= */
(function () {
  'use strict';

  var REF = 'vxlxoiycolfojcnhnzfr';
  var KEY = 'sb_publishable_7OTbCZGA4jhjP4sL6KAg0A_fjsfo9js';
  var REST = 'https://' + REF + '.supabase.co/rest/v1/cars';
  var STORAGE = 'https://' + REF + '.supabase.co/storage/v1/object/public/car-photos/';
  var TIMEOUT = 2500;

  var CAM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
    '<path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.3-2h7.6l1.3 2h2.6A1.5 1.5 0 0 1 21 8.5v10A1.5 1.5 0 0 1 19.5 20h-15' +
    'A1.5 1.5 0 0 1 3 18.5z"/><circle cx="12" cy="13" r="3.6"/></svg>';

  /* -------------------------------------------------------------- helpers */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function price(p) { return '\u20B9 ' + Number(p).toFixed(2) + ' Lakh'; }
  function km(n) { return Number(n).toLocaleString('en-IN') + ' km'; }
  function phoneHref() {
    var a = $('a[href^="tel:"]');
    return a ? a.getAttribute('href') : 'tel:+919831189375';
  }

  /* ---------------------------------------------------------------- fetch */
  function fetchCars() {
    if (!('fetch' in window)) return Promise.reject(new Error('no fetch'));
    var url = REST + '?select=' + encodeURIComponent(
      'id,status,sort_order,featured,year,make,model,variant,km,fuel,transmission,body,' +
      'price_lakh,price_note,reg,location,highlights,overview,photo_stock') +
      '&order=sort_order.asc';
    var ctrl = 'AbortController' in window ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT) : null;
    return fetch(url, {
      headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY },
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (rows) {
      if (timer) clearTimeout(timer);
      return rows;
    }, function (err) {
      if (timer) clearTimeout(timer);
      throw err;
    });
  }

  /* ------------------------------------------------------- card patching */
  function patchCard(el, row) {
    el.setAttribute('data-price', row.price_lakh);
    el.setAttribute('data-km', row.km);
    var priceEl = $('.veh__price', el);
    if (priceEl) priceEl.textContent = price(row.price_lakh);
    var dd = $$('.veh__specs dd', el);
    if (dd[1]) dd[1].textContent = km(row.km);
    var st = $('.veh__status', el);
    if (st && row.status === 'reserved') {
      st.textContent = 'Reserved \u2014 call to confirm';
      st.classList.add('veh__status--pending');
    }
  }

  /* the large "Newest on the floor" card on the home page */
  function patchHero(el, row) {
    var priceEl = $('.price-lg', el);
    if (priceEl && priceEl.firstChild) priceEl.firstChild.nodeValue = price(row.price_lakh);
    var dd = $$('.veh-hero__specs dd', el);
    if (dd[2]) dd[2].textContent = km(row.km);
    if (row.status === 'reserved' && dd[6]) dd[6].textContent = 'Reserved \u2014 call the showroom';
    if (row.status === 'sold') {
      var slot = el.closest('[data-featured-slot]');
      if (slot) slot.hidden = true; else el.remove();
    }
  }

  /* ------------------------------------------------------- card building */
  function buildCard(row, tel) {
    var a = document.createElement('article');
    a.className = 'veh';
    a.setAttribute('data-card', '');
    a.setAttribute('data-car-id', row.id);
    a.setAttribute('data-make', row.make);
    a.setAttribute('data-body', row.body);
    a.setAttribute('data-fuel', row.fuel);
    a.setAttribute('data-year', row.year);
    a.setAttribute('data-price', row.price_lakh);
    a.setAttribute('data-km', row.km);
    a.setAttribute('data-trans', String(row.transmission || 'unlisted').split(' ')[0]);
    var hl = row.highlights || [];
    var flag = hl.indexOf('Less driven') > -1
      ? '<span class="veh__flag veh__flag--bright">Less driven</span>'
      : (hl.indexOf('Service history available') > -1 ? '<span class="veh__flag">Service history noted</span>' : '');
    var img = row.photo_stock
      ? '<img src="' + esc(STORAGE + row.photo_stock) + '" alt="' + esc(row.year + ' ' + row.make + ' ' + row.model +
          ' ' + row.variant + ' \u2014 ' + row.body + ' listed at ' + row.location) +
        '" width="900" height="675" loading="lazy" decoding="async">'
      : '<div class="ph" role="img" aria-label="Photograph pending: recently added to the floor">' +
        '<div class="ph__in">' + CAM + '<b>Photograph pending</b>' +
        '<span>Just added \u2014 call the showroom for photographs</span></div></div>';
    var trans = row.transmission ? esc(row.transmission) : '<span class="to-confirm">Not stated</span>';
    var status = row.status === 'reserved'
      ? '<span class="veh__status veh__status--pending">Reserved \u2014 call to confirm</span>'
      : '<span class="veh__status">Available to view</span>';
    /* a car added through the panel has no detail page until the next rebuild,
       so the card asks for a phone call instead of promising a link */
    a.innerHTML =
      '<div class="veh__media">' + flag + img +
      '<span class="veh__price tnum">' + esc(price(row.price_lakh)) + '</span></div>' +
      '<div class="veh__body"><div><h3 class="veh__title">' + esc(row.year + ' ' + row.make + ' ' + row.model) + '</h3>' +
      '<p class="veh__variant">' + esc(row.variant) + ' \u00B7 ' + esc(row.reg) + ' registration</p></div>' +
      '<dl class="veh__specs">' +
      '<div><dt>Year</dt><dd class="tnum">' + esc(row.year) + '</dd></div>' +
      '<div><dt>Odometer</dt><dd class="tnum">' + esc(km(row.km)) + '</dd></div>' +
      '<div><dt>Fuel</dt><dd>' + esc(row.fuel) + '</dd></div>' +
      '<div><dt>Gearbox</dt><dd>' + trans + '</dd></div>' +
      '</dl><div class="veh__foot">' + status +
      '<a class="tlink" href="' + esc(tel) + '">Call to enquire</a></div></div>';
    return a;
  }

  /* --------------------------------------------------- detail-page states */
  function soldBanner() {
    var main = $('#main');
    if (!main) return;
    var b = document.createElement('div');
    b.setAttribute('role', 'status');
    b.style.cssText = 'margin:18px 0;padding:16px 20px;border:1px solid rgba(123,224,172,.35);' +
      'border-radius:4px;background:rgba(47,174,119,.08)';
    b.innerHTML = '<strong style="color:var(--accent)">This car has been sold.</strong> ' +
      '<span style="color:var(--ink-2)">The page stays online for reference. The floor changes weekly \u2014 ' +
      'call the showroom for what is currently available.</span>';
    main.insertBefore(b, main.firstChild);
  }

  function detail(row, tel) {
    if (!row) return;                       /* hidden or unknown: the static page stands */
    var statusEl = $('.aside-status');
    if (row.status === 'sold') {
      soldBanner();
      if (statusEl) statusEl.textContent = 'Sold';
      $$('.aside-card a.btn').forEach(function (b) { b.hidden = true; });
      var enquire = $('#enquire');
      if (enquire) enquire.hidden = true;
    } else if (row.status === 'reserved') {
      if (statusEl) statusEl.textContent = 'Reserved \u2014 call to confirm';
    }
    var priceEl = $('.aside-price');
    if (priceEl) priceEl.textContent = price(row.price_lakh);
    var dd = $$('dl.grid-list dd');
    if (dd[1]) dd[1].textContent = km(row.km);
    void tel;
  }

  /* ------------------------------------------------------------ reconcile */
  function apply(rows) {
    var tel = phoneHref();
    var byId = {};
    rows.forEach(function (r) { byId[r.id] = r; });
    var available = rows.filter(function (r) { return r.status === 'available'; });

    /* 1 · every "N cars published online" figure on the page */
    $$('[data-count-published]').forEach(function (el) { el.textContent = String(available.length); });

    /* 2 · ids this build shipped, so panel-added cars are recognised */
    var staticIds = {};
    $$('article[data-car-id]').forEach(function (el) { staticIds[el.getAttribute('data-car-id')] = true; });

    /* 3 · the one-car detail page */
    var detailId = document.body.getAttribute('data-car-id');
    if (detailId) detail(byId[detailId], tel);

    /* 4 · cards and the featured hero */
    $$('article[data-car-id]').forEach(function (el) {
      var row = byId[el.getAttribute('data-car-id')];
      if (!row) return;                                   /* hidden: leave the static card */
      if (el.classList.contains('veh-hero')) { patchHero(el, row); return; }
      if (row.status === 'sold') { el.remove(); return; } /* grids drop sold cars */
      patchCard(el, row);
    });

    /* 5 · cars the build has never seen (added through the panel) */
    var fresh = rows.filter(function (r) {
      return (r.status === 'available' || r.status === 'reserved') && !staticIds[r.id];
    });
    if (fresh.length) {
      $$('[data-grid], [data-home-grid]').forEach(function (grid) {
        fresh.forEach(function (r) { grid.appendChild(buildCard(r, tel)); });
      });
    }

    /* 6 · the contact form's "which car?" dropdown */
    $$('option[data-car-id]').forEach(function (o) {
      var row = byId[o.getAttribute('data-car-id')];
      if (!row || row.status === 'sold') o.remove();
    });

    /* 7 · the inventory "Showing X of Y" line, after removals and appends */
    var invRoot = $('[data-inventory]');
    if (invRoot) {
      var countEl = $('[data-count]', invRoot);
      if (countEl) countEl.textContent = String($$('article[data-card]:not([hidden])', invRoot).length);
    }
  }

  fetchCars().then(function (rows) {
    try { apply(rows || []); } catch (e) { /* never break the page over live data */ }
  }).catch(function () { /* offline or slow: the static page stands, as built */ });
})();
