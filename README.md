# Sohan Automobile — website

A static, template-built marketing site for **Sohan Automobile**, a multi-brand new
and used car dealership at 27, Barowaritala Road, Beleghata / Garden Lane, Kolkata.

No framework, no build tooling beyond Python 3, no CDN, no analytics, no cookies.
Every page is a single self-contained HTML file (CSS and JS inlined) that works from
`file://` as well as over HTTP.

## Layout

```
build.py                    the generator — run this, never edit the .html outputs
src/*.src.html              page templates (the only place to edit copy)
assets/css/styles.css       the whole design system, inlined at build time
assets/js/site.js           progressive enhancement, inlined at build time (motion helpers at the end)
assets/data/inventory.json  the ONLY place car and company data is written
assets/img/logo.png         the dealership's own lockup, trimmed — the white artwork, for dark
assets/img/favicon*.png     square tiles cut from the logo's own "S", plus apple-touch-icon
assets/img/stock/           dealer listing photographs, 900×675 + 480×360 srcset
assets/img/gallery/         1400×1050 views used by the vehicle pages and lightbox
assets/img/hero-vehicle.jpg hero photograph (1680×940)
assets/fonts/               self-hosted woff2 subsets — no Google Fonts link
```

## Build

```bash
cd sohan-automobile
python3 build.py            # render the site into this folder
python3 build.py --check    # render to /tmp, report problems, touch nothing
```

`build.py` fails loudly on six things: an unknown token in a template, a token with no
value, a car whose photograph is missing, any stray markup in `<head>` (the guard that
would have caught a half-deleted data-URI favicon leaving an orphaned `<svg>` in the
document), a `styles.css` whose braces do not balance or whose `:root` has lost a token,
and a button variant that a template uses but the stylesheet never defines — or defines and
no template uses. The last two exist because a broken stylesheet fails *silently*: every
rule after the mistake is swallowed, so the page still renders, just without its geometry.
It prints the page count and total weight. There is no watcher — rerun the command after
editing.

`python3 /home/user/verify.py` is the acceptance check (links, alt text, filters, deep
links, the mobile sheet, form validation) and `python3 /home/user/sweep.py` walks all
11 page shapes at 8 viewport widths — 320 px to 1440 px — reporting horizontal overflow,
elements bleeding past the viewport, images that failed to load and any element still
painted with a light background, which on a dark site means a rule survived a rename.
Both live outside the site folder on purpose: they are checks, not deliverables.

Output: `index.html`, `inventory.html`, `sell-your-car.html`, `about.html`,
`showroom.html`, `contact.html`, `legal.html`, and one `car-<id>.html` per entry in
`inventory.json` (22 pages today).

## Editing

| Want to change | Edit |
| --- | --- |
| Copy, section order, new sections | `src/<page>.src.html` |
| A car: price, odometer, highlights, new arrival, sold car | `assets/data/inventory.json` |
| Phone, email, address, services | `assets/data/inventory.json` → `brand` |
| Colours, type scale, any component | `assets/css/styles.css` |
| Cards, filters, galleries, contact grid | `build.py` (the `render_*` functions) |
| Behaviour | `assets/js/site.js` |

Adding a car: put two photographs at `assets/img/stock/<id>.jpg` (+ `-sm` variant) and
`assets/img/gallery/<id>-1.jpg`, `<id>-2.jpg`, add an entry to `cars` in
`inventory.json`, rebuild. Cards, filters, counts, deep links and the sitemap-style
footer links all follow from that one entry. Removing one: delete the entry.

The large "Newest on the floor" card on the home page is whichever entry carries
`"featured": true`; if none does, the builder falls back to the newest year with the
lowest odometer. The six cards under it are the next entries in file order, so the
`cars` array doubles as the manual sort order.

### Template tokens

Templates may use only these; anything else aborts the build so a stale token can never
ship as literal `{{BRACES}}` text.

- Head/meta: `{{TITLE}} {{DESCRIPTION}} {{CANONICAL}} {{STYLES}}`
- Chrome: `{{NAV}} {{FOOTER}} {{SCRIPT}}`
- Body/footers need `data-page="home|inventory|sell|about|showroom|contact|legal"`, and
  the home template also carries `data-nav="overlay"` (transparent nav over the hero).
- Company/data: `{{BRAND}} {{PHONE}} {{PHONE_HREF}} {{EMAIL}} {{ADDRESS}} {{ADDRESS_CITY}}
  {{AREA}} {{MAP_URL}} {{YEAR}} {{LEAD}} {{VERIFIED}} {{PUBLISHED}} {{FLOOR}}
  {{PRICE_MIN}} {{PRICE_MAX}} {{MAKES}} {{SERVICE_LIST}} {{SOURCE_INVENTORY}} {{SOURCE_SITE}}`
- Generated blocks: `{{CAR_CARDS:FEATURED|GRID|ALL|SIM:id1,id2}}`, `{{FILTERS}}`,
  `{{CONTACT_GRID}}`, `{{SHOTS:FLOOR|STORY|id,...}}`, `{{HERO_IMAGE}}`,
  `{{CAR_OPTIONS:optional}}`, `{{IMG:<car-id>}}`
- Honest-gap placeholders (rendered as labelled voids, not lorem):
  `{{PLACEHOLDER:Label|note}}`, `{{PLACEHOLDER:Label|note:dark}}`, and the shortcuts
  `{{PH:hours|warranty|inspection|finance|valuation|testdrive|social|team}}`
- Vehicle pages only: the `CAR_*` keys produced by `car_tokens()` in `build.py`
  (`CAR_TITLE`, `CAR_DESC`, `CAR_NAME`, `CAR_VARIANT`, `CAR_PRICE`, `CAR_PRICE_NOTE`,
  `CAR_KM`, `CAR_FUEL`, `CAR_TRANS`, `CAR_YEAR`, `CAR_BODY`, `CAR_REG`, `CAR_LOCATION`,
  `CAR_OVERVIEW`, `CAR_TAGS`, `CAR_HIGHLIGHT_NOTE`, `CAR_LISTING_URL`, `CAR_ID`,
  `CAR_SPEC_ROWS`, `CAR_FRAMES`, `CAR_THUMBS`, `CAR_FRAMES_COUNT`, `CAR_GALLERY_COUNT`,
  `CAR_LIGHTBOX`, `CAR_COMPLETE`, `CAR_SIMILAR`, `CAR_JSONLD`)

## Brand artwork and palette

`uploads/Logo 1.png` (wine) and `uploads/Logo 1W.png` (white) are the dealership's supplied
artwork: 1400×1400 transparent PNGs whose mark trims to 918×385 (aspect 2.38:1). Nothing is
redrawn — `assets/img/logo.png` is the white file cropped, resized to 400×168 and re-saved, so
the car line and letterforms are the originals. It is the only logo file the site uses (nav,
footer, mobile sheet), because every one of those surfaces is now dark.

* The site is dark themed: black grounds tinted green, with the mark's wine replaced by
  emerald fills and mint accents. See the `:root` block in `assets/css/styles.css`.
* Grounds, darkest to lightest: `--bg #070B09` (page) → `--bg-2 #0A100D` (tinted band) →
  `--surface #0E1612` (cards) → `--surface-2 #16231C` (form fields, raised within a card) →
  `--panel #0C1C16` (story and CTA bands) → `--graphite #08110D` (footer). Elevation on a
  dark page reads as *lighter fill*, not as shadow, so each step is only a few L* apart.
* Type on dark: `--ink #E8F2EA` (17.3:1 on the page ground), `--ink-2 #A6C0AE` (10.2:1),
  `--stone #7B9486` for small-caps labels (6.1:1, and the large-text threshold at `--s3`).
* Green: `--brand #2FAE77` is for fills (buttons, active chips) and `--accent #7BE0AC` for
  accent type — mint is what carries weight on black, where a mid emerald would vanish. Text
  that sits on a bright fill uses `--void #04100A` rather than pure black.
* The favicon is not a new monogram: the "S" is cropped from the logo's own `SOHAN` band and
  set on a jade tile (`favicon-16/32/48/64.png`, `apple-touch-icon.png`, `favicon.ico`).
* `color-scheme: dark` is set once on `:root`, so native form controls, scrollbars and
  date pickers arrive dark without per-control patching; `<meta name="theme-color">` is
  `#070B09` on every page. The nav floats translucent and blurred over the hero, and only
  solidifies (`.is-stuck`) once the page scrolls — the overlay styling is scoped to
  `.nav--overlay:not(.is-stuck)` so it can never leave ivory-on-ivory links behind.

## Editorial rules this site follows

These are the reason the copy looks the way it does. Keep them.

1. **Nothing is invented.** Every figure on the site is copied from the dealership's own
   published material — its website for company details, its dealer-directory listings
   for each car — captured on the date printed as `{{VERIFIED}}`.
2. **Gaps stay visible.** Where a listing stated nothing (a transmission type, opening
   hours, a warranty programme), the page says so in the open. No placeholder is allowed
   to become a claim.
3. **No fabricated proof.** No invented testimonials, star ratings, awards, customer
   counts or "certified/assured" programmes. The customer-experience section says plainly
   that none are published and shows the forecourt instead.
4. **The floor is bigger than the site.** ~30 cars on the books, 15 published online —
   stated on the home page, the collection page and the menu, with a phone prompt.
5. **Forms are mailto composers.** They validate locally, then open the visitor's mail
   app with the message written out, plus a copy fallback. Nothing is stored or sent by
   the site.
6. **Prices are asking prices**, dated, with the reduction noted where the listing
   recorded one.

## Preview

```bash
python3 -m http.server 8000      # then open http://127.0.0.1:8000/
```

Or open `index.html` directly — the site has no fetch calls and every asset is either
inlined or referenced by a relative path.

## Verifying

`/home/user/verify.py` (outside this folder) drives headless Chromium over every page at
1440px and 390px and asserts: no broken images, no image without `alt`, no leftover
`{{token}}`, no horizontal overflow, no console or page errors, all internal links
resolve. It then exercises the inventory filters, the deep link
`inventory.html?body=SUV&sort=price`, the gallery/keyboard/lightbox, both forms
(required-field errors then the mailto composition), the "book a viewing" prefill, the
sticky nav, and the mobile sheet (focus moves in, Tab stays inside, Escape returns
focus). It also sweeps every page at 1440/1200/1024/900/768/480/390/320 px asserting
zero horizontal overflow. Last full run: **0 problems across 20 page/viewport renders
and 88 viewport checks**.

Quick manual checks worth repeating after a change:

```bash
python3 build.py --check
grep -c "{{" *.html            # must be 0 everywhere
```

## Accessibility and performance notes

- One `h1` per page, landmarks (`nav`/`main`/`footer`), skip link, visible focus rings,
  `aria-current` on the active nav item, `aria-live` on the results count and form status.
- Colour is not the only signal: available/not-stated differ in wording, not just hue.
  Every dark-theme pair was measured, not eyeballed: the lowest text combination still in
  use is `--stone` small-caps labels at 6.05:1, and `--brand` fills carry `--void` text at
  6.87:1. Nothing on a dark ground is pure white or pure black.
- Mobile menu traps and returns focus; `Escape` closes it; body scroll locks while open.
- Every image has explicit `width`/`height` (read from the JPEG by the builder) so there
  is no layout shift; below-the-fold images are `loading="lazy"`, cards use `srcset`.
- Reveal animations are `opacity`/`transform` only and are disabled under
  `prefers-reduced-motion`; all content is visible if JS never runs.
- Heaviest page is `index.html` at ~115 KB of HTML (59 KB CSS + 19 KB JS inlined into
  every page); the photographs are the only large assets (~2 MB of cards, ~7 MB of
  gallery views).

## Motion

The animation layer is the last block of `styles.css`, under a `MOTION LAYER` banner.
Nine moves, all of them tied to something the page is already claiming:

| move | selector | what it does |
|---|---|---|
| curtain | `.hero__media` | the photograph is drawn upward with `clip-path`, so the type arrives before the car does |
| rise | `.hero__inner > *` | the six blocks of the hero enter on a 100 ms stagger, declared in CSS |
| breathe | `.hero__media img` | 20 s `scale(1 → 1.045)` alternate — the hero is never a still |
| sink | `.hero__media` | scroll-driven parallax, inside `@supports (animation-timeline: view())` |
| draw | `.rule`, `.nav::after` | hairlines grow from the left on `view()`; the nav carries a mint scroll-progress line over the hero only |
| glow | `.veh` | a 240×160 mint pool tracks the pointer through `--mx` / `--my`, set by JS |
| sheen | `.veh__media::after` | one 1.1 s diagonal sweep across the photograph on hover |
| re-entry | `.veh.is-filtering` | after a filter or sort, visible cards rise in turn at 34 ms, capped at 11 |
| wipe / zoom | `.gallery__stage img.is-shown`, `.lightbox img` | a frame turns over from the left instead of fading |

The three scroll-linked moves live inside `@supports (animation-timeline: view())`
and `@supports (animation-timeline: scroll())`. That is not decoration: a `scaleX(0)` fill
state that only a scroll timeline ever releases would leave every hairline invisible in a
browser without them, so the fallback there is a browser that never sees the rule at all
(verified by stripping the block at runtime — `.rule` falls back to `transform: none` and
paints at its full 1184 px).

Rules this layer follows — keep them:

1. **Nothing waits on JS.** Every animation is declared in CSS and runs off markup that
   already exists. JS only supplies what CSS cannot know: the pointer position and the
   number a counter should wind up to. `initCounters()` reads the final value out of the
   HTML, so if the script never runs the correct figure is what was already there.
2. **One release valve.** `@media (prefers-reduced-motion: reduce)` at the end of the layer
   clamps every duration to `.01ms`, kills the card lift and the glow, and is checked in
   `site.js` (`reduced`) before any of the three JS behaviours attach. Test it with
   Chromium's reduced-motion emulation — the hero renders fully settled and the stats read
   `15 · 30 · 1997` on the first frame.
3. **Only real pointers get hover choreography.** Hover rules are wrapped in
   `@media (hover: hover)` so a tap cannot strand a glow on a phone, and the chip "pop"
   rides a `.is-popped` class added on click — a chip arriving pressed from a shared
   `?body=SUV` link stays still.
4. **Numbers that move are honest numbers.** The hero odometer animates to the exact strings
   the markup already printed, and `data-countup="plain"` opts `Since 1997` out of
   thousand-separators, because a year is not a quantity.
5. **Hints are borrowed, not held.** `will-change` is set on the hero during its entrance and
   released back to `auto` on the `so-curtain` `animationend`, so nothing keeps a compositing
   layer for the rest of the session.
6. **Nothing here moves the page.** Every animation is compositor-only (`opacity`,
   `transform`, `clip-path`) and starts and ends on the geometry the markup already
   declares. Cumulative layout shift after the layer landed: `index.html` 0.0008,
   `inventory.html` 0.0046, `car-xl6-2025.html` 0.0449 — the last of those is a 161 ms
   text reflow in the gallery band that predates this layer, and all three sit far below the
   0.1 Good threshold. `document.scrollWidth` equals `innerWidth` on every page at rest.
