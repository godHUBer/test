# Phase 1 — application foundation

## Delivered boundary

This phase adds an executable Next.js App Router / strict TypeScript application, reusable page/navigation/footer/status components, shared assets, clean public routes, legacy redirects, a safe admin placeholder, tests and CI. **It does not implement a live database, authentication, vehicle CRUD or persistent enquiries.** The existing static source files remain untouched.

### Why a compatibility bridge?

The checked-in generated HTML is the current visual/content baseline. The Python generator fails on the available Python 3.11 runtime. Rather than change it or prematurely rewrite every page and data flow, `scripts/prepare-site.mjs` extracts the trusted repository markup into ignored `.generated/site.json` and copies assets into ignored `public/` outputs. It fails on unmapped HTML or unexpected script/event-handler content in the main page markup.

- `lib/routes.ts` declares all seven general and 15 vehicle routes.
- `components/site-chrome.tsx` shares navigation/footer across pages and marks the active route. The legal page no longer incorrectly highlights About.
- `components/legacy-page.tsx` is the explicitly temporary raw-markup boundary. It preserves vehicle lightboxes outside the main/footer and page attributes used by styling.
- `components/site-enhancements.tsx` owns mobile-menu opening/closing, reliable initial focus after the visibility transition, Tab trapping, Escape and focus return. The asset adapter disables only the legacy `initSheet()` bootstrap call to avoid duplicate menu listeners; it keeps the remaining gallery/filter/form/motion enhancements. The original script itself is unchanged. Application-only CSS allows the menu to scroll on short screens.
- Original images, fonts, brand colours, spacing and copy are retained. Relative media/font paths become root-relative for nested car routes.
- Public links deliberately cause full document navigation, not client-side Next.js transitions: the retained legacy enhancements initialise once per document. Do not add Next `Link` navigation into this bridge without a React-managed interaction lifecycle.
- No arbitrary HTML from users or Supabase may pass through this adapter. Later database content must be validated and escaped in typed components.

This bridge is scaffolding, **not the final page implementation**. In Phase 3 replace inventory/cards/details with typed data-driven components and migrate editorial page sections incrementally. Remove the bridge after all page families have parity coverage. Until then editing JSON alone does not change the extracted HTML: the checked-in generated files are intentionally the source of the preview.

## Run locally

Requires Node.js 22+ and npm. A lockfile is included.

```sh
npm ci
cp .env.example .env.local # optional; do not commit secrets
npm run dev               # listens on 0.0.0.0:3000
```

`predev`/`prebuild` regenerate `.generated/site.json`, `public/assets/`, `public/site.css`, and `public/site.js`. All are ignored; do not edit generated copies. No external fonts/CDN or Supabase keys are required. Preview hosts under `*.e2b.app` are allowed in dev. The application does not call a browser-local backend.

```sh
npm run check             # baseline hashes, asset preparation, generated types, TS, lint, unit tests
npm run build             # production compilation and 22 public pre-renders
npm run start             # serve production build on 0.0.0.0:3000
npm run test:e2e          # production build must already exist; starts test server on 3100
```

`SITE_URL` is optional locally. Set it to the approved public HTTPS origin for canonical metadata when deploying. There is no guessed production domain. Supabase environment entries are placeholders reserved for Phase 2; no client is instantiated and no credentials were retrieved. A privileged key must never use a `NEXT_PUBLIC_` variable.

### Browser test runtime

Linux x64 tests use npm-packaged `@sparticuz/chromium`. The test runner extracts its bundled NSS libraries into a temporary directory and cleans them afterwards, avoiding apt/browser downloads in the restricted sandbox. The browser is test-only, not an application dependency. On other platforms, or to use installed Chrome, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its absolute executable path. Chromium launch flags in `playwright.config.ts` are test-only; unsafe web-security overrides are removed. A Playwright report and screenshots are written into ignored `playwright-report/` and `test-results/`.

## Baseline and regression coverage

`docs/legacy-baseline.json` records SHA-256 hashes for all 111 legacy HTML/template/asset/build files. `npm run baseline:check` fails if any change, disappear or are added to the baseline set. Only use `node scripts/baseline.mjs --record` after deliberately reviewing a baseline change; CI must never refresh it automatically.

The existing Python build is not invoked by the application or tests. This phase does not fix its known syntax issue, nor rely on the absent external verification scripts described by the original README.

Automated checks cover:

- Exact decimal lakh-to-integer-rupee conversion and rejection of invalid/unsafe inputs, ready for later import tooling.
- Unique clean routes and permanent redirects for all 22 legacy pages.
- Extracted page titles, descriptions, main landmarks, headings, media paths, no leftover template tokens and vehicle lightboxes.
- All 22 application pages at 320, 390, 768 and 1440 px: HTTP status, heading, single main landmark, decoded images, no horizontal overflow and no uncaught browser errors.
- All 22 legacy redirects preserving URL query parameters, plus unknown public/admin paths returning 404.
- SUV deep-link filtering/reset; vehicle gallery/lightbox; invalid contact form submission; honest/noindex admin placeholder.
- Mobile menu focus cycling and Escape focus return.
- Inventory content and links without JavaScript.
- Reproducible paired legacy/application screenshots for all eight page families at 390 and 1440 px, captured locally with reduced motion and font readiness. These are review artefacts, not an automatically enforced pixel-difference threshold or a full accessibility audit.

The legacy baseline screenshot fixture intercepts `http://legacy.test/` and serves only local repository files. It makes no outbound connection to that host. Normal application code does not use that hostname.

CI runs reproducible installation, checks, production build and browser tests, then retains reports/screenshots for seven days. The workflow is added but remote CI execution is not claimed until GitHub actually runs it.

## Limitations and next gates

- Inventory remains a dated legacy snapshot, not current stock or a Supabase query.
- Forms remain mailto composers and explicitly disclose this. Server-side enquiry storage and accurate revised privacy copy arrive together in Phase 5.
- `/admin` exposes no business data and accepts no credentials; it is not an authentication implementation or proof that RLS is ready.
- Supabase's existing schema must be reconciled before creating tables. Follow the Phase 0 findings in `plan.md`; do not drop/reset objects or map editor roles silently.
- No authentication invitations, remote database changes, hosting deployment, notifications, paid services, or production cutover were performed.
- Comprehensive security/accessibility review, new schema permission tests, current-stock verification and final SEO/structured data are later gates.
- Original static output remains a fallback and visual baseline. Its original README instructions are retained below the new application notice in the root README.
