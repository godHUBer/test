/* =============================================================================
   Sohan Automobile — admin panel client
   Speaks raw REST to the dealership's Supabase project (auth, PostgREST,
   storage). Session token + refresh token live in localStorage under one key;
   every mutating call rides an admin JWT through row-level security, and every
   mutation lands in the append-only activity log on the server side. The
   publishable key below is public by design; no service key ever reaches a
   browser. ~18 KB, no dependencies.
   ============================================================================= */
(function () {
  'use strict';

  var REF = 'vxlxoiycolfojcnhnzfr';
  var KEY = 'sb_publishable_7OTbCZGA4jhjP4sL6KAg0A_fjsfo9js';
  var BASE = 'https://' + REF + '.supabase.co';
  var REST = BASE + '/rest/v1';
  var AUTH = BASE + '/auth/v1';
  var STORE = BASE + '/storage/v1';
  var SKEY = 'sohan.admin.session';

  /* -------------------------------------------------------------- helpers */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function carName(r) { return r.year + ' ' + r.make + ' ' + r.model + ' — ' + r.id; }
  function fmtWhen(iso) {
    var d = new Date(iso);
    return isNaN(d) ? esc(iso) : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  }
  function setStatus(el, msg, kind) {
    if (!el) return;
    el.textContent = msg || '';
    el.className = el.className.replace(/\b(is-err|is-ok)\b/g, '').trim();
    if (kind) el.classList.add(kind);
  }

  /* ------------------------------------------------------------- session */
  function save(s) { try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) { /* private mode */ } }
  function load() {
    try { return JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) { return null; }
  }
  function clear() { try { localStorage.removeItem(SKEY); } catch (e) { /* noop */ } }
  function fresh(s) { return s && s.access_token && s.expires_at > Date.now() + 30000; }

  function refresh(s) {
    return fetch(AUTH + '/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { 'apikey': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: s.refresh_token })
    }).then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('refresh failed')); })
      .then(function (j) {
        var ns = { access_token: j.access_token, refresh_token: j.refresh_token,
                   expires_at: Date.now() + (j.expires_in || 3600) * 1000 };
        save(ns); return ns;
      }).catch(function () { clear(); showLogin(); throw new Error('Session expired — sign in again.'); });
  }

  /* REST wrapper: adds apikey + Bearer, retries once through a refresh on 401 */
  function req(url, opts, noAuth, retried) {
    opts = opts || {};
    opts.headers = Object.assign({ 'apikey': KEY }, opts.headers || {});
    var s = load();
    if (s && !noAuth) opts.headers['Authorization'] = 'Bearer ' + s.access_token;
    return fetch(url, opts).then(function (r) {
      if (r.status === 401 && !retried && !noAuth && s && s.refresh_token) {
        return refresh(s).then(function () { return req(url, opts, noAuth, true); });
      }
      if (!r.ok) {
        return r.json().catch(function () { return null; }).then(function (j) {
          var msg = j && (j.message || j.error_description || j.error) ? (j.message || j.error_description || j.error) : ('HTTP ' + r.status);
          throw new Error(msg);
        });
      }
      if (r.status === 204) return null;
      return r.json().catch(function () { return null; });
    });
  }
  function rpc(fn, args, noAuth) {
    return req(REST + '/rpc/' + fn, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'params=single-object' },
      body: JSON.stringify(args || {})
    }, noAuth);
  }

  /* ----------------------------------------------------------------- auth */
  var mode = 'in';                       /* 'in' | 'up' */
  function flipMode() {
    mode = mode === 'in' ? 'up' : 'in';
    $('#l-in').textContent = mode === 'in' ? 'Sign in' : 'Create the account';
    $('#l-mode').textContent = mode === 'up' ? 'I already have an account — sign in' :
      'First time? Create the owner account';
    setStatus($('#l-status'), mode === 'up' ?
      'Setup mode: use the email you want as the owner identity. New accounts start with no permissions.' : '');
  }

  function authCall(path, body) {
    return fetch(AUTH + path, {
      method: 'POST',
      headers: { 'apikey': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().then(function (j) { j.__status = r.status; return j; });
    });
  }

  function takeSession(j, email) {
    if (!j || !j.access_token) throw new Error(j && (j.error_description || j.msg || j.message) || 'Sign-in failed.');
    save({ access_token: j.access_token, refresh_token: j.refresh_token,
           expires_at: Date.now() + (j.expires_in || 3600) * 1000, email: email || (j.user && j.user.email) });
    return j;
  }

  function doAuth(e) {
    e.preventDefault();
    var status = $('#l-status');
    var email = $('#l-email').value.trim(), pass = $('#l-pass').value;
    if (!email || !pass) { setStatus(status, 'Email and password are both needed.', 'is-err'); return; }
    setStatus(status, mode === 'in' ? 'Signing in…' : 'Creating the account…');
    authCall(mode === 'in' ? '/token?grant_type=password' : '/signup', { email: email, password: pass })
      .then(function (j) {
        if (j.__status >= 400) {
          rpc('record_auth_event', { p_action: 'auth.login_failed', p_email: email }, true).catch(function () {});
          throw new Error(j.error_description || j.msg || 'The showroom did not accept those details.');
        }
        takeSession(j, email);
        return rpc('record_auth_event', { p_action: mode === 'in' ? 'auth.login' : 'auth.signup' }).catch(function () {});
      })
      .then(function () { boot(); })
      .catch(function (err) { setStatus(status, String(err.message || err), 'is-err'); });
  }

  function doLogout() {
    var s = load();
    rpc('record_auth_event', { p_action: 'auth.logout' }).catch(function () {});
    if (s) fetch(AUTH + '/logout?scope=global', {
      method: 'POST', headers: { 'apikey': KEY, Authorization: 'Bearer ' + s.access_token }
    }).catch(function () {});
    clear(); showLogin();
    setStatus($('#l-status'), 'Signed out.');
  }

  function doPassword(e) {
    e.preventDefault();
    var np = $('#p-new').value, status = $('#pw-status');
    if (np.length < 6) { setStatus(status, 'At least six characters.', 'is-err'); return; }
    req(AUTH + '/user', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: np }) })
      .then(function () {
        setStatus(status, 'Password changed.', 'is-ok');
        $('#pw-form').reset();
        return rpc('record_auth_event', { p_action: 'auth.password_changed' }).catch(function () {});
      })
      .catch(function (err) { setStatus(status, String(err.message || err), 'is-err'); });
  }

  /* --------------------------------------------------------------- state */
  var state = { rows: [], brand: null, log: [], role: null, email: null, carFilter: 'all' };

  function loadAll() {
    var s = load();
    var me = s && s.email ? Promise.resolve(s.email)
      : req(AUTH + '/user').then(function (u) { return u && u.email; });
    return Promise.all([
      req(REST + '/cars?select=' + encodeURIComponent('*') + '&order=sort_order.asc'),
      req(REST + '/brand_settings?id=eq.1&select=*'),
      me,
      req(REST + '/admin_profiles?select=user_id,email,role&order=email.asc').catch(function () { return null; }),
      req(REST + '/activity_log?select=' + encodeURIComponent('*') + '&order=at.desc&limit=100').catch(function () { return []; })
    ]).then(function (r) {
      state.rows = r[0] || [];
      state.brand = (r[1] || [])[0] || null;
      state.email = r[2] || null;
      var prof = r[3], uid = load() && null;
      state.role = null;
      if (prof) {
        /* find own row by matching email (admin_profiles allows reading all for admins) */
        for (var i = 0; i < prof.length; i++) {
          if (state.email && prof[i].email === state.email) { state.role = prof[i].role; break; }
        }
      }
      state.log = r[4] || [];
      renderWho(); renderOverview(); renderCars(); renderBrandForm(); renderLog();
    });
  }

  /* ------------------------------------------------------------- renderers */
  function showLogin() { $('#adm-login').hidden = false; $('#adm-app').hidden = true; }
  function showApp() { $('#adm-login').hidden = true; $('#adm-app').hidden = false; }

  function renderWho() {
    $('#adm-email').textContent = state.email || '';
    $('#acc-email').textContent = state.email || '';
    var r = state.role || 'pending';
    $('#adm-role').textContent = r;
    $('#adm-role').className = 'adm-role' + (r === 'pending' ? ' adm-role--pending' : '');
    $('#acc-role').textContent = r;
    if (r === 'pending') {
      setStatus($('#ov-counts-note') || $('#ov-refresh'), '', '');
      $('#ov-log').innerHTML = '<tr><td>Your account is registered but has no permissions yet. ' +
        'The site operator promotes it to owner from the database, and this panel unlocks.</td></tr>';
    }
  }

  function renderOverview() {
    var c = { available: 0, reserved: 0, sold: 0, hidden: 0 };
    state.rows.forEach(function (r) { c[r.status] = (c[r.status] || 0) + 1; });
    var feat = state.rows.filter(function (r) { return r.featured; }).length;
    var labels = [['Available', c.available], ['Reserved', c.reserved], ['Sold', c.sold],
                  ['Hidden', c.hidden], ['Featured', feat], ['Total rows', state.rows.length]];
    $('#ov-counts').innerHTML = labels.map(function (p) {
      return '<div><dt>' + esc(p[0]) + '</dt><dd class="tnum">' + esc(p[1]) + '</dd></div>';
    }).join('');
    $('#ov-log').innerHTML = state.log.slice(0, 10).map(logRow).join('') ||
      '<tr><td>No log entries visible yet.</td></tr>';
  }

  function logRow(e) {
    var changes = e.changes && Object.keys(e.changes).length
      ? '<code class="adm-logcode" title="' + esc(JSON.stringify(e.changes)) + '">' +
        esc(JSON.stringify(e.changes).slice(0, 90)) + '…</code>'
      : '<span class="adm-logcode">—</span>';
    return '<tr><td class="tnum">' + fmtWhen(e.at) + '</td><td>' + esc(e.action) + '</td>' +
      '<td>' + esc(e.actor_email || '—') + '</td><td>' + esc(e.summary) + '</td><td>' + changes + '</td></tr>';
  }

  function renderCars() {
    var tb = $('#cars-tbody');
    var rows = state.rows.filter(function (r) { return state.carFilter === 'all' || r.status === state.carFilter; });
    tb.innerHTML = rows.map(function (r) {
      return '<tr data-row="' + esc(r.id) + '">' +
        '<td><b style="color:var(--ink)">' + esc(r.year + ' ' + r.make + ' ' + r.model) + '</b><br>' +
        '<span class="adm-logcode">' + esc(r.id) + '</span></td>' +
        '<td class="tnum">' + esc(r.year) + '</td>' +
        '<td><input class="tnum" data-f="price_lakh" value="' + esc(r.price_lakh) + '" type="number" step="0.01" min="0.1"></td>' +
        '<td><input class="tnum" data-f="km" value="' + esc(r.km) + '" type="number" min="0"></td>' +
        '<td><select class="w-status" data-f="status">' +
        ['available', 'reserved', 'sold', 'hidden'].map(function (s) {
          return '<option' + (r.status === s ? ' selected' : '') + '>' + s + '</option>';
        }).join('') + '</select></td>' +
        '<td style="text-align:center"><input type="checkbox" data-f="featured"' + (r.featured ? ' checked' : '') + ' style="width:auto"></td>' +
        '<td><div class="adm-actions">' +
        '<button class="btn btn--solid btn--sm" data-act="save">Save</button>' +
        '<button class="btn btn--line btn--sm" data-act="del">Delete</button></div></td></tr>';
    }).join('') || '<tr><td colspan="7">No cars with that status.</td></tr>';
  }

  function renderBrandForm() {
    var b = state.brand;
    if (!b) { setStatus($('#brand-status'), 'The brand row has not been seeded yet.', 'is-err'); return; }
    $('#b-name').value = b.name || ''; $('#b-tag').value = b.tagline || '';
    $('#b-phone').value = b.phone_display || ''; $('#b-phref').value = b.phone_href || '';
    $('#b-email').value = b.email || ''; $('#b-addr').value = b.address_short || '';
    $('#b-city').value = b.address_city || ''; $('#b-area').value = b.area || '';
    $('#b-map').value = b.map_url || ''; $('#b-hours').value = b.hours || '';
    $('#b-services').value = (b.services || []).join('\n');
  }

  function renderLog() {
    var f = $('#log-filter').value || '';
    var rows = state.log.filter(function (e) { return !f || e.action.indexOf(f) === 0; });
    $('#log-tbody').innerHTML = rows.map(logRow).join('') || '<tr><td>Nothing logged under this filter yet.</td></tr>';
    setStatus($('#log-status'), rows.length + ' entries shown.', 'is-ok');
  }

  /* ---------------------------------------------------------------- tabs */
  function selectTab(id) {
    $$('.adm-tab').forEach(function (t) { t.setAttribute('aria-selected', String(t.id === 'tab-' + id)); });
    $$('.adm-panel').forEach(function (p) { p.hidden = p.id !== 'p-' + id; });
    if (id === 'activity') renderLog();
    if (id === 'overview') renderOverview();
  }

  /* ------------------------------------------------------------ car CRUD */
  function saveCar(tr) {
    var id = tr.getAttribute('data-row');
    var orig = null;
    for (var i = 0; i < state.rows.length; i++) if (state.rows[i].id === id) orig = state.rows[i];
    if (!orig) return;
    var patch = {};
    var price = parseFloat($('[data-f="price_lakh"]', tr).value);
    var km = parseInt($('[data-f="km"]', tr).value, 10);
    if (isFinite(price) && price !== Number(orig.price_lakh)) patch.price_lakh = price;
    if (isFinite(km) && km !== orig.km) patch.km = km;
    var st = $('[data-f="status"]', tr).value;
    if (st !== orig.status) patch.status = st;
    var feat = $('[data-f="featured"]', tr).checked;
    if (feat !== orig.featured) patch.featured = feat;
    if (!Object.keys(patch).length) { setStatus($('#cars-status'), 'Nothing changed for ' + id + '.', 'is-ok'); return; }
    setStatus($('#cars-status'), 'Saving ' + id + '…');
    req(REST + '/cars?id=eq.' + encodeURIComponent(id), {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(patch)
    }).then(function () { return loadAll(); })
      .then(function () { setStatus($('#cars-status'), 'Saved — the change is logged.', 'is-ok'); })
      .catch(function (err) { setStatus($('#cars-status'), String(err.message || err), 'is-err'); });
  }

  function deleteCar(tr) {
    var id = tr.getAttribute('data-row');
    if (!window.confirm('Permanently delete "' + id + '"? This is logged and cannot be undone — ' +
      'prefer setting the status to hidden if the car may come back.')) return;
    setStatus($('#cars-status'), 'Deleting ' + id + '…');
    req(REST + '/cars?id=eq.' + encodeURIComponent(id), { method: 'DELETE', Prefer: 'return=minimal' })
      .then(function () { return loadAll(); })
      .then(function () { setStatus($('#cars-status'), 'Deleted — the removal is logged.', 'is-ok'); })
      .catch(function (err) { setStatus($('#cars-status'), String(err.message || err), 'is-err'); });
  }

  /* ------------------------------------------------------------- uploads */
  function shrink(file, maxW) {
    return new Promise(function (res, rej) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, maxW / img.naturalWidth);
        var c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k);
        c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (b) { URL.revokeObjectURL(url); res(b || file); }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); res(file); };
      img.src = url;
    });
  }

  function upload(path, blob) {
    var s = load();
    return fetch(STORE + '/object/car-photos/' + path, {
      method: 'POST',
      headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + s.access_token,
                 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
      body: blob
    }).then(function (r) {
      if (!r.ok) throw new Error('photo upload failed for ' + path + ' (HTTP ' + r.status + ')');
      return true;
    });
  }

  /* ------------------------------------------------------------- add car */
  function addCar(e) {
    e.preventDefault();
    var status = $('#add-status');
    var id = $('#a-id').value.trim().toLowerCase();
    var year = parseInt($('#a-year').value, 10);
    var price = parseFloat($('#a-price').value);
    var km = parseInt($('#a-km').value, 10);
    if (!/^[a-z0-9-]+$/.test(id) || !year || !isFinite(price) || price <= 0 || !isFinite(km)) {
      setStatus(status, 'Check the reference (lowercase+hyphens), year, price and odometer.', 'is-err'); return;
    }
    var row = {
      id: id, sort_order: (state.rows.length + 1) * 10,
      featured: $('#a-featured').checked,
      year: year, make: $('#a-make').value.trim(), model: $('#a-model').value.trim(),
      variant: $('#a-variant').value.trim(), km: km, fuel: $('#a-fuel').value,
      transmission: $('#a-trans').value || null, body: $('#a-body').value,
      price_lakh: price, price_note: $('#a-note').value.trim() || null,
      reg: $('#a-reg').value.trim() || 'Kolkata (WB)',
      highlights: $('#a-high').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      overview: $('#a-over').value.trim()
    };
    if (!row.make || !row.model || !row.variant) { setStatus(status, 'Make, model and variant are required.', 'is-err'); return; }
    setStatus(status, 'Adding the car…');
    var photo = $('#a-photo').files[0], gallery = $$('#a-gallery').length ? $('#a-gallery').files : [];
    req(REST + '/cars', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(row)
    }).then(function () { return loadAll(); })
      .then(function () {
        if (!photo) { setStatus(status, 'Car added (logged). No photograph yet — the public card shows a pending block.', 'is-ok'); return null; }
        setStatus(status, 'Car added — uploading photographs…', 'is-ok');
        return shrink(photo, 900).then(function (big) { return upload('cars/' + id + '.jpg', big); })
          .then(function () { return shrink(photo, 480); }).then(function (sm) { return upload('cars/' + id + '-sm.jpg', sm); })
          .then(function () {
            var chain = Promise.resolve();
            Array.prototype.forEach.call(gallery, function (g, i) {
              chain = chain.then(function () {
                return shrink(g, 1400).then(function (b) { return upload('cars/' + id + '-' + (i + 1) + '.jpg', b); });
              });
            });
            return chain;
          })
          .then(function () {
            return req(REST + '/cars?id=eq.' + encodeURIComponent(id), {
              method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
              body: JSON.stringify({ photo_stock: 'cars/' + id + '.jpg',
                                     photos_gallery: Array.prototype.map.call(gallery, function (g, i) { return 'cars/' + id + '-' + (i + 1) + '.jpg'; }) })
            });
          })
          .then(function () {
            $('#add-form').reset();
            setStatus(status, 'Car added with photographs — everything is logged.', 'is-ok');
          });
      })
      .catch(function (err) { setStatus(status, String(err.message || err), 'is-err'); });
  }

  /* --------------------------------------------------------- brand save */
  function saveBrand(e) {
    e.preventDefault();
    var status = $('#brand-status');
    var patch = {
      name: $('#b-name').value.trim(), tagline: $('#b-tag').value.trim(),
      phone_display: $('#b-phone').value.trim(), phone_href: $('#b-phref').value.trim(),
      email: $('#b-email').value.trim(), address_short: $('#b-addr').value.trim(),
      address_city: $('#b-city').value.trim(), area: $('#b-area').value.trim(),
      map_url: $('#b-map').value.trim(),
      hours: $('#b-hours').value.trim() || null,
      services: $('#b-services').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean)
    };
    setStatus(status, 'Saving showroom info…');
    req(REST + '/brand_settings?id=eq.1', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(patch)
    }).then(function () { return loadAll(); })
      .then(function () { setStatus(status, 'Saved — the change is logged.', 'is-ok'); })
      .catch(function (err) { setStatus(status, String(err.message || err), 'is-err'); });
  }

  function refreshLog() {
    setStatus($('#log-status'), 'Refreshing…');
    req(REST + '/activity_log?select=' + encodeURIComponent('*') + '&order=at.desc&limit=100')
      .then(function (rows) { state.log = rows || []; renderLog(); })
      .catch(function (err) { setStatus($('#log-status'), String(err.message || err), 'is-err'); });
  }

  /* ---------------------------------------------------------------- boot */
  function boot() {
    var s = load();
    if (!fresh(s)) {
      if (s && s.refresh_token) {
        refresh(s).then(function () { return loadAll(); })
          .then(function () { showApp(); })
          .catch(function (err) { setStatus($('#l-status'), String(err.message || err), 'is-err'); });
        return;
      }
      showLogin();
      return;
    }
    loadAll().then(function () { showApp(); })
      .catch(function (err) { setStatus($('#l-status'), String(err.message || err), 'is-err'); showLogin(); });
  }

  function wire() {
    $('#adm-login-form').addEventListener('submit', doAuth);
    $('#l-mode').addEventListener('click', flipMode);
    $('#adm-out').addEventListener('click', doLogout);
    $('#pw-form').addEventListener('submit', doPassword);
    $('#ov-refresh').addEventListener('click', function () { loadAll(); });
    $('#cars-refresh').addEventListener('click', function () { loadAll(); });
    $('#log-refresh').addEventListener('click', refreshLog);
    $('#log-filter').addEventListener('change', renderLog);
    $('#add-form').addEventListener('submit', addCar);
    $('#brand-form').addEventListener('submit', saveBrand);
    $$('.adm-tab').forEach(function (t) {
      t.addEventListener('click', function () { selectTab(t.id.replace('tab-', '')); });
    });
    $$('#cars-chips .adm-chip').forEach(function (c) {
      c.addEventListener('click', function () {
        state.carFilter = c.getAttribute('data-st');
        $$('#cars-chips .adm-chip').forEach(function (o) {
          o.setAttribute('aria-pressed', String(o === c));
        });
        renderCars();
      });
    });
    $('#cars-tbody').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-act]');
      if (!b) return;
      var tr = b.closest('tr[data-row]');
      if (!tr) return;
      if (b.getAttribute('data-act') === 'save') saveCar(tr); else deleteCar(tr);
    });
    /* auto-slug the reference from make/model/year once they exist */
    ['#a-make', '#a-model', '#a-year'].forEach(function (sel) {
      $(sel).addEventListener('change', function () {
        if ($('#a-id').value) return;
        var slug = (($('#a-model').value || $('#a-make').value) + ' ' + ($('#a-year').value || ''))
          .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        if (slug) $('#a-id').value = slug;
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () { wire(); boot(); });
})();
