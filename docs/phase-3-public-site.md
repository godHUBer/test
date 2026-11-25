# Phase 3 — data-driven public website

## Delivery status

The public-site implementation and local read-only integration tests are complete. **This is not a claim that the selected Supabase project is connected or that Phase 2 has been remotely activated.** The user-approved backup gate remains blocked because backups are not yet verified. No migrations, remote record changes, imports, key retrieval, Auth changes or paid services were performed in Phase 3.

The main preview remains an explicitly labelled, non-indexable snapshot. The production read-only Supabase adapter is implemented but requires approved configuration, network access and real-project verification before use. Do not bypass the Phase 2 security/backup gates merely because anonymous application queries use GET.

## What changed

### Inventory, cards, details and galleries

- Typed vehicle/brand models normalise the existing `cars` and `brand_settings` schema. Prices are exact integer rupees internally; lakh formatting preserves up to five decimal places rather than rounding away rupees.
- The new inventory route is server rendered, filters/sorts in Supabase in live mode, and paginates in pages of 12. Preview mode uses the same semantics against the legacy JSON. Make, minimum recorded year, body, fuel, gearbox, asking-price bands and model-name search persist in URL query parameters.
- Budget bands are lower-inclusive / upper-exclusive, eliminating overlapping boundary prices. The legacy `budget=0-5` link remains supported; `8-99` retains its legacy query identifier but correctly means ₹8 lakh and above, without an unintended ₹99 lakh ceiling.
- Filters progressively enhance native GET forms. Apply/clear/pagination also work without JavaScript. Unknown/stale filter choices remain visible as such instead of pretending the request was unfiltered.
- Public detail routes are dynamic and accept new valid IDs from the database, not just the original 15 build-time slugs. Published IDs must satisfy the documented safe lowercase slug format; the Phase 2 upgrade keeps IDs immutable. An approved future slug-history change must preserve redirects rather than rewriting identities casually.
- Available records alone populate active inventory, featured cards, editorial photo selections, related alternatives, counts and contact car options. Homepage featured fallback is deterministic (featured flag, manual order, ID), including zero/one-record cases.
- Sold details remain available as historical references with no enquiry/viewing form; the displayed historical amount is labelled last asking price, not sale price. Reserved records have an unavailable detail and no booking form. Draft/hidden/archived or absent IDs return 404 without a legacy-file fallback.
- Typed detail/specification components retain unknown values, distinguish “year as recorded” from manufacture/registration claims, escape dealer text, display provenance/update information and avoid equating an edit timestamp with an inspection.
- React-managed galleries include cover/gallery images, keyboard/thumbnail controls, native modal focus containment, Escape/focus return and missing/broken-image placeholders. A modal becomes visible before native focus is invoked, avoiding the legacy focus race.

### Editorial pages and shared chrome

- Home/about/showroom/contact/sell/legal content now renders from the trusted `src/*.src.html` copy through an allowlisted React token adapter. Shared navigation/footer, counts, company details, services/hours and car options are React props, not database text interpolated into raw HTML.
- The raw legacy page shell and legacy production reader were retired. `.generated/site.json` remains only a regression fixture from the original generated HTML. `.generated/editorial.json` contains trusted source templates for the current editorial renderer.
- The adapter supports only known text/attribute/block tokens and fails on unsupported tokens. It parses repository templates, **never HTML from Supabase or user input**. Dynamic strings become escaped React text/props. Any future rich-text capability needs its own sanitisation policy.
- Hard-coded “30 on the books”, featured-array positions and hero “in stock” vehicle captions no longer drive current stock claims. Hero artwork is an explicitly captioned archive asset independent of sellable stock. Editorial listing photo selections derive from available rows, not fixed car IDs.
- Known comparison-heavy legacy vehicle descriptions remain dealer-supplied wording and are labelled potentially dated; they are not silently rewritten into fabricated current facts. Staff must review them during stock reconciliation.
- The sell-form maximum year derives from the current year. Forms remain mailto composers until Phase 5. Their native action is also `mailto:` with POST/text encoding, avoiding accidental contact-data GET URLs when JavaScript is disabled. No website form submission/booking is claimed to be stored or confirmed.
- Historical company story/leadership/year copy remains sourced from the legacy record. The current schema does not provide an editor for every editorial sentence or historical fact.

## Source modes and configuration

```dotenv
# Safe default. Requires no keys and must not be treated as current stock.
PUBLIC_INVENTORY_MODE=snapshot

# Only after the approved security/backup/configuration gates and real verification:
# PUBLIC_INVENTORY_MODE=supabase
# NEXT_PUBLIC_SUPABASE_URL=<approved project HTTPS origin>
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable or legacy anon key>
# SITE_URL=<approved application HTTPS origin>
```

- Mode is explicit. Adding staff authentication settings does not silently turn the snapshot into a live inventory.
- Snapshot mode shows a source/date warning on every public page, labels records as previews, omits vehicle sale-offer JSON-LD, returns an empty sitemap and blocks indexing in metadata/robots.
- Invalid live configuration or a failed query shows an inventory-read error and no substituted snapshot cars. It is not presented as an empty collection or as a sold/missing vehicle.
- Optional server-only `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_PUBLISHABLE_KEY` overrides take precedence over the shared `NEXT_PUBLIC_*` settings. Keep both pointed at the same approved project; the overrides also let isolated fixture tests avoid build-time-inlined public settings. Privileged keys are rejected in either case.
- Public queries use a separate anonymous Supabase client with session persistence/refresh disabled, no user-cookie forwarding, no service key, explicit public column projections and no mutations. Staff sessions never elevate public reads.
- Vehicle images accept safe local assets or the selected project's public `car-photos` URLs/paths. Signed/private bucket URLs, arbitrary remote origins and executable schemes are not embedded. External provenance links remain marked as external links.
- Public pages and fetches are uncached across requests. React memoisation only deduplicates matching reads within one render/request. A new request reflects the latest source; already-open tabs do not receive a realtime push in this phase.
- Facet/homepage selection reads use count-aware bounded catalogue paging (200 requested per batch, maximum 5,000 available rows). A lower project row cap is handled without skipping rows. Inconsistent counts, duplicate rows, oversized catalogues or malformed records fail closed rather than publish a silently partial stock count.
- Inventory result pages are queried separately with database filters, exact counts, stable sorting and range pagination. Unexpected partial pages fail explicitly. At this dealership's scale the extra facet read is acceptable; larger catalogues should move facets/aggregates to a reviewed public RPC/view.
- Public business fields absent in the current schema may use the explicitly historical legacy company record. On a source outage the notice identifies contact details as legacy; inventory never silently falls back. Null opening hours remain unconfirmed.

## SEO and availability

- All existing 22 `.html` URLs still permanently redirect, preserving queries; clean routes and newly added valid vehicle IDs are server rendered without rebuilding pages.
- Canonicals/social URLs use only an approved valid HTTPS `SITE_URL`; no guessed production hostname is shipped. Optional home social imagery is labelled as an archive photograph.
- Live vehicle JSON-LD uses actual available/reserved/sold status, exact INR asking prices, absolute image/page URLs, and schema-supported stock states. It does not invent VINs, inspections, ratings, certifications or precise manufacture dates.
- JSON-LD serialisation escapes `<`, `>` and `&` so dealer text cannot terminate a script element.
- The live sitemap contains general public routes and available vehicle routes only. It excludes admin/auth/private stock and sold/reserved records from active sitemap selections. Sold detail pages can still be reached/indexed under the approved retained-detail policy.
- Source-error pages are non-indexable and show a useful retry/contact state. Page-rendered read errors currently use an HTTP 200 error UI (not a false 404/zero-stock response); sitemap source failure raises an error rather than publish a misleading empty live sitemap. A future HTTP 503 transport layer can improve outage signalling without changing visibility rules.

## Tests and local fixtures

```sh
npm ci
npm run check
npm run build
npm run test:e2e
```

The browser suite retains the 22-page/four-width checks and now also launches an **isolated local TLS PostgREST-compatible fixture** plus a second application process in live-read mode. It uses a dummy publishable key and synthetic records only. No real Supabase call or test record mutation occurs. The fixture is test infrastructure, not an API to deploy.

- `scripts/public-api-fixture.mjs` accepts app GETs to public cars/settings only and rejects wildcard/private projections. It captures method, projection and cookie/credential classification without logging real secrets.
- The runner creates an ignored two-day self-signed test certificate with OpenSSL and trusts it only in the fixture application process. OpenSSL is required for these tests. Dummy fixture hostnames, keys and the example canonical origin do not enter the main preview configuration.
- Fixture scenarios exercise new slugs without rebuild, SQL filters/ranges, exact pagination, in-place source changes from available to sold, homepage/dropdown refresh, reserved/sold/hidden states, zero/one records, missing media, escaped text, outage handling, schema/robots/sitemap and rejection of unexpected private-status rows.
- Unit tests additionally cover exact price/unknown preservation, budget boundaries, invalid source credentials/options, safe media URLs, low server row caps, incomplete pages, safe schema escaping and public visibility constraints.
- The existing isolated PostgreSQL permission/trigger tests remain in `npm run check` and do not replace real-project Auth/PostgREST/Storage or concurrency verification.
- Paired old/new viewport screenshots remain generated review artefacts. Visual differences in source notices, correct counts/pagination, year wording and availability controls are intentional; there is no claim of an enforced pixel-perfect threshold.

## Remaining gates

1. Finish the existing Phase 2 backup/recovery gate, approved security migration, HTTPS origin/provider setup, first-owner assignment and real integration verification.
2. Review actual public car/settings rows and image paths in the selected project before connection. Do not overwrite existing records with snapshot seeds or publish unverified stock. No such comparison/import was performed here.
3. Securely configure the real publishable credentials and explicit live mode in an environment allowed to reach Supabase. Verify real row-level visibility and fresh requests after an authorised stock change.
4. Implement actual staff inventory/photo CRUD in Phase 4 and persistent leads/viewings/service intake in Phase 5. These public components/read queries do not create those capabilities.
5. Confirm final dealership facts, privacy/terms, accessibility/security acceptance, backups/restore and production deployment in the launch phase.

### Recorded local verification

At delivery: production build/type-check/lint succeeded; all 15 unit tests, the existing PostgreSQL suite (11 reported results including its grouped parent), and all 16 browser tests passed. The browser suite includes 88 legacy page/viewport checks and six local public-data scenarios. The home source notice is also checked against the fixed navigation bounds so its warning cannot be obscured. `npm audit --omit=dev` reported zero production vulnerabilities. These are local results, not a remote-project security or deployment certification.
