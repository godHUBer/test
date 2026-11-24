/* =============================================================================
   Sohan Automobile — site behaviour
   Everything here is progressive enhancement: content and links work with JS
   disabled. No frameworks, no external requests, ~9 KB.
   Sections: nav · mobile sheet · reveals · gallery · filters · forms · motion
   ============================================================================= */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* -------------------------------------------------------------- helpers */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* --------------------------------------------------- sticky / overlay nav */
  function initNav() {
    var nav = $('.nav--overlay');
    if (!nav) return;
    var sentinel = $('.hero');
    function sync() {
      var y = window.pageYOffset || document.documentElement.scrollTop;
      var threshold = sentinel ? Math.min(sentinel.offsetHeight - 88, window.innerHeight - 88) : 40;
      nav.classList.toggle('is-stuck', y > Math.max(threshold, 24));
    }
    var raf = false;
    window.addEventListener('scroll', function () {
      if (raf) return;
      raf = true;
      requestAnimationFrame(function () { raf = false; sync(); });
    }, { passive: true });
    sync();
  }

  /* ------------------------------------------------------------ mobile sheet */
  function initSheet() {
    var open = $('[data-sheet-open]'), sheet = $('#sheet'), page = $('html');
    if (!sheet) return;
    var last = null;
    function show(on) {
      sheet.classList.toggle('is-open', on);
      document.body.classList.toggle('is-locked', on);
      if (open) open.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (on) {
        last = document.activeElement;
        /* the panel is still visibility:hidden for one frame, so wait for it before focusing */
        var f = $('a, button', sheet);
        if (f) requestAnimationFrame(function () {
          requestAnimationFrame(function () { try { f.focus(); } catch (e) { /* noop */ } });
        });
      } else if (last) { last.focus(); }
    }
    $$('[data-sheet-open]').forEach(function (b) {
      b.addEventListener('click', function () { show(true); });
    });
    $$('[data-sheet-close]').forEach(function (b) {
      b.addEventListener('click', function () { show(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sheet.classList.contains('is-open')) show(false);
    });
    $$('a', sheet).forEach(function (a) { a.addEventListener('click', function () { show(false); }); });
    if (page) void page;
  }

  /* ----------------------------------------------------- scroll reveals --- */
  function initReveal() {
    var items = $$('[data-reveal]');
    if (!items.length) return;
    if (reduced || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    items.forEach(function (el, i) {
      var d = el.getAttribute('data-reveal-delay');
      el.style.setProperty('--d', (d ? +d : (i % 3) * 90) + 'ms');
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------------- FAQ accordion --- */
  function initFaq() {
    $$('.faq details').forEach(function (d) {
      d.addEventListener('toggle', function () {
        if (!d.open) return;
        $$('.faq details[open]').forEach(function (o) { if (o !== d) o.open = false; });
      });
    });
  }

  /* ---------------------------------------------------- vehicle gallery --- */
  function initGallery() {
    var gal = $('[data-gallery]');
    if (!gal) return;
    var frames = $$('[data-frame]', gal);
    if (!frames.length) return;
    var thumbs = $$('[data-thumb]', gal);
    var counter = $('[data-gallery-count]', gal);
    var i = 0;
    function show(n) {
      i = (n + frames.length) % frames.length;
      frames.forEach(function (f, k) { f.classList.toggle('is-shown', k === i); });
      thumbs.forEach(function (t, k) { t.setAttribute('aria-current', k === i ? 'true' : 'false'); });
      if (counter) counter.textContent = (i + 1) + ' / ' + frames.length;
      var box = $('[data-lightbox]');
      if (box && box.classList.contains('is-open')) {
        var img = $('img', box); if (img) img.src = frames[i].currentSrc || frames[i].src;
      }
    }
    thumbs.forEach(function (t, k) { t.addEventListener('click', function () { show(k); }); });
    $$('[data-gallery-prev]', gal).forEach(function (b) { b.addEventListener('click', function () { show(i - 1); }); });
    $$('[data-gallery-next]', gal).forEach(function (b) { b.addEventListener('click', function () { show(i + 1); }); });
    gal.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(i - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); show(i + 1); }
    });
    show(0);

    /* lightbox (optional, only when the markup asks for it) */
    var zoom = $('[data-lightbox-open]', gal), box = $('[data-lightbox]');
    if (zoom && box) {
      var cap = $('.lightbox__cap', box);
      function open() {
        box.classList.add('is-open');
        document.body.classList.add('is-locked');
        var f = frames[i];
        var bimg = $('img', box);
        bimg.src = f.currentSrc || f.src;
        bimg.alt = f.getAttribute('alt') || '';
        if (cap) cap.textContent = f.getAttribute('alt') || '';
        $('.lightbox__close', box).focus();
      }
      function close() { box.classList.remove('is-open'); document.body.classList.remove('is-locked'); zoom.focus(); }
      zoom.addEventListener('click', open);
      box.addEventListener('click', function (e) { if (e.target === box || e.target.hasAttribute('data-lightbox-close')) close(); });
      document.addEventListener('keydown', function (e) { if (box.classList.contains('is-open') && e.key === 'Escape') close(); });
    }
  }

  /* ------------------------------------------- inventory filter + sort --- */
  function initInventory() {
    var root = $('[data-inventory]');
    if (!root) return;
    var cards = $$('[data-card]', root);
    var selects = $$('[data-filter]', root);
    var chips = $$('.chip[data-value]', root);
    var sortSel = $('[data-sort]', root);
    var countEl = $('[data-count]', root);
    var emptyEl = $('[data-empty]', root);
    var allBtn = $('[data-clear]', root);
    var grid = $('[data-grid]', root);
    var original = cards.slice();

    /* a chip is a segmented control: exactly one pressed, 'all' being the default */
    function chipValue() {
      var on = chips.filter(function (c) {
        return c.getAttribute('aria-pressed') === 'true' && c.getAttribute('data-value') !== 'all';
      });
      return on.length ? on[0].getAttribute('data-value') : 'all';
    }
    function pressChip(value) {
      chips.forEach(function (c) {
        c.setAttribute('aria-pressed', c.getAttribute('data-value') === value ? 'true' : 'false');
      });
    }
    function readControls() {
      var state = {};
      selects.forEach(function (s) { state[s.getAttribute('data-filter')] = s.value; });
      state.body = chipValue();
      return state;
    }
    function apply(push) {
      /* re-read the grid: the live data layer may have removed sold cars or
         appended panel-added ones after boot, so the counts must follow */
      cards = $$('[data-card]', root);
      original = cards.slice();
      var state = readControls();
      var shown = 0, order = [];

      cards.forEach(function (c) {
        var ok = true;
        Object.keys(state).forEach(function (k) {
          var want = state[k];
          if (!want || want === 'all') return;
          var have = c.getAttribute('data-' + k) || '';
          if (k === 'budget') {
            var p = parseFloat(c.getAttribute('data-price'));
            var parts = want.split('-');
            var lo = parseFloat(parts[0]) || 0, hi = parseFloat(parts[1]) || Infinity;
            ok = ok && p >= lo && p <= hi;
          } else if (k === 'year') {
            ok = ok && parseInt(c.getAttribute('data-year'), 10) >= parseInt(want, 10);
          } else {
            ok = ok && have === want;
          }
        });
        c.hidden = !ok;
        if (ok) { shown++; order.push(c); }
      });

      if (sortSel && sortSel.value === 'featured') {
        order.slice().forEach(function (c) { grid.appendChild(c); });
      } else if (sortSel && sortSel.value !== 'featured') {
        var key = sortSel.value;
        order.sort(function (a, b) {
          var av = key === 'price' ? +a.getAttribute('data-price') : key === 'km' ? +a.getAttribute('data-km') : +a.getAttribute('data-year');
          var bv = key === 'price' ? +b.getAttribute('data-price') : key === 'km' ? +b.getAttribute('data-km') : +b.getAttribute('data-year');
          var desc = key === 'year' || sortSel.getAttribute('data-dir') === 'desc';
          return desc ? bv - av : av - bv;
        });
        order.forEach(function (c) { grid.appendChild(c); });
      }

      if (countEl) countEl.textContent = shown;
      if (emptyEl) emptyEl.hidden = shown !== 0;
      /* the first paint after a change takes the grid in turns; the load does not */
      if (push !== false) soStagger(order);

      if (push !== false) {
        var q = Object.keys(state).filter(function (k) { return state[k] && state[k] !== 'all'; })
          .map(function (k) { return k + '=' + encodeURIComponent(state[k]); });
        if (sortSel && sortSel.value !== 'featured') q.push('sort=' + sortSel.value);
        var url = location.pathname + (q.length ? '?' + q.join('&') : '');
        try { history.replaceState(null, '', url); } catch (e) { /* file:// */ }
      }
    }

    selects.forEach(function (el) { el.addEventListener('change', function () { apply(); }); });
    chips.forEach(function (c) {
      c.addEventListener('click', function (e) {
        e.preventDefault();
        pressChip(c.getAttribute('data-value'));
        /* the pop answers the click, so a chip arriving pressed from a shared link stays still */
        if (!reduced) {
          c.classList.remove('is-popped');
          void c.offsetWidth;
          c.classList.add('is-popped');
        }
        apply();
      });
    });
    if (sortSel) sortSel.addEventListener('change', function () { apply(); });
    if (allBtn) allBtn.addEventListener('click', function () {
      selects.forEach(function (s) { s.value = 'all'; });
      pressChip('all');
      if (sortSel) sortSel.value = 'featured';
      original.forEach(function (c) { grid.appendChild(c); });
      apply();
    });

    /* deep links: ?make=Tata&sort=price */
    var params = new URLSearchParams(location.search);
    var primed = false;
    params.forEach(function (v, k) {
      var sel = selects.filter(function (s) { return s.getAttribute('data-filter') === k; })[0];
      if (sel) {
        if (sel.value !== v) { sel.value = v; primed = true; }
        return;
      }
      if (k === 'sort' && sortSel) { sortSel.value = v; primed = true; return; }
      if (chips.some(function (c) { return c.getAttribute('data-value') === v; })) { pressChip(v); primed = true; }
    });
    if (primed) {
      /* a shared link should look like a filtered page, not an unfiltered one */
      if (allBtn) allBtn.hidden = false;
    }
    apply(false);
  }

  /* ------------------------------------------------------------ forms --- */
  function initForms() {
    $$('form[data-mailto]').forEach(function (form) {
      var status = $('.form__status', form);
      var to = form.getAttribute('data-mailto');
      var subject = form.getAttribute('data-subject') || 'Enquiry';

      function validField(f) {
        var wrap = f.closest('.field');
        var ok = true;
        if (f.hasAttribute('required')) {
          if (!f.value.trim()) ok = false;
          if (f.type === 'tel' && ok && f.value.replace(/\D/g, '').length < 10) ok = false;
          if (f.type === 'email' && ok && f.value.indexOf('@') < 1) ok = false;
        }
        if (wrap) { wrap.classList.toggle('is-invalid', !ok); }
        f.setAttribute('aria-invalid', ok ? 'false' : 'true');
        return ok;
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var fields = $$('input, select, textarea', form).filter(function (f) { return !f.disabled && f.type !== 'submit'; });
        var allOk = true, firstBad = null;
        fields.forEach(function (f) {
          var ok = validField(f);
          if (!ok && !firstBad) firstBad = f;
          allOk = allOk && ok;
        });
        if (!allOk) {
          if (status) { status.className = 'form__status is-on form__status--err'; status.textContent = 'Please complete the highlighted fields — they are needed before we can look into this.'; }
          if (firstBad) firstBad.focus();
          return;
        }
        var lines = [];
        fields.forEach(function (f) {
          if (!f.name) return;
          var v = f.type === 'radio' && !f.checked ? null : f.value.trim();
          if (v === null || v === '') return;
          lines.push(f.name + ': ' + v);
        });
        var extra = form.getAttribute('data-context');
        if (extra) lines.unshift(extra);
        var body = lines.join('\n') + '\n\n— Sent from ' + location.host + (document.title ? ' (' + document.title.split('|')[0].trim() + ')' : '');
        var href = 'mailto:' + to + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
        var note = 'Opening your email app with these details. If nothing happens, copy the text below and send it to ' + to + ' yourself, or call the showroom.';
        if (status) {
          status.className = 'form__status is-on form__status--ok';
          status.innerHTML = esc(note) + '<pre class="copy-block">' + esc(lines.join('\n')) + '</pre>'
            + '<button type="button" class="btn btn--line btn--sm" data-copy>Copy enquiry details</button>';
          var copy = $('[data-copy]', status);
          if (copy) copy.addEventListener('click', function () {
            var t = lines.join('\n');
            if (navigator.clipboard) { navigator.clipboard.writeText(t).then(function () { copy.textContent = 'Copied'; }, function () { copy.textContent = 'Press Ctrl+C'; }); }
          });
        }
        window.location.href = href;
      });

      /* clear the error state as soon as the shopper starts fixing it */
      $$('input, select, textarea', form).forEach(function (f) {
        f.addEventListener('input', function () {
          var w = f.closest('.field');
          if (w && w.classList.contains('is-invalid')) validField(f);
        });
      });
    });
  }

  /* ------------------------------------- "book a viewing" secondary CTA -- */
  function initViewing() {
    $$('[data-prefill-viewing]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sel = document.getElementById('e-when');
        if (sel) {
          var want = btn.getAttribute('data-prefill-viewing');
          Array.prototype.forEach.call(sel.options, function (o) { if (o.value === want || o.text === want) sel.value = o.value; });
        }
        var name = document.getElementById('e-name');
        if (name) setTimeout(function () { name.focus({ preventScroll: true }); }, 420);
      });
    });
  }

  /* ---------------------------------------------------- motion helpers --- */
  /* The choreography itself lives in styles.css. What JS is needed for is the
     two things CSS cannot know: where the pointer is, and how long a number
     should take to arrive. Both stay quiet under prefers-reduced-motion. */
  function soStagger(cards) {
    if (reduced) return;
    cards.forEach(function (c, i) {
      c.style.setProperty('--sd', Math.min(i, 11) * 34 + 'ms');
      c.classList.remove('is-filtering');
      void c.offsetWidth;
      c.classList.add('is-filtering');
    });
  }

  function initMotion() {
    var hero = $('.hero__media');
    if (hero && !reduced) {
      hero.addEventListener('animationend', function (e) {
        if (e.animationName !== 'so-curtain') return;
        $$('.hero__media, .hero__inner > *').forEach(function (el) { el.style.willChange = 'auto'; });
      });
    }
    $$('.veh').forEach(function (card) {
      var box = $('.veh__media', card) || card;
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
        card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
      }, { passive: true });
      if (!box) return;
      card.addEventListener('pointerleave', function () {
        card.style.setProperty('--mx', '50%'); card.style.setProperty('--my', '0%');
      }, { passive: true });
    });
    $$('.is-filtering').forEach(function (el) {
      el.addEventListener('animationend', function (e) {
        if (e.target !== el) return;
        el.classList.remove('is-filtering'); el.style.removeProperty('--sd');
      });
    });
  }

  /* numbers that wind up like the thing they describe */
  function initCounters() {
    var items = $$('[data-countup]').filter(function (el) {
      return /^\d[\d,]*$/.test(el.textContent.trim());
    });
    if (!items.length) return;
    if (reduced || !('IntersectionObserver' in window)) return;   /* markup already holds the answer */
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target); wind(en.target);
      });
    }, { threshold: .6 });
    items.forEach(function (el) { io.observe(el); });
    function wind(el) {
      var target = parseInt(el.textContent.replace(/[^\d]/g, ''), 10);
      if (!isFinite(target) || target < 2) return;
      var plain = el.getAttribute('data-countup') === 'plain';   /* a year is not a quantity */
      var t0 = 0, ms = 950;
      requestAnimationFrame(function step(now) {
        if (!t0) t0 = now;
        var k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
        var v = Math.round(target * e);
        el.textContent = plain ? String(v) : v.toLocaleString('en-IN');
        if (k < 1) requestAnimationFrame(step);
        else el.textContent = plain ? String(target) : target.toLocaleString('en-IN');
      });
    }
  }

  /* ----------------------------------------------------------- misc --- */
  function initYear() {
    $$('[data-year-now]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }

  function boot() {
    initNav(); initSheet(); initReveal(); initFaq(); initGallery(); initInventory(); initForms(); initViewing(); initYear(); initMotion(); initCounters();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
