# Sohan Automobile — Live Website & Admin System Rebuild Plan

**Prepared:** 24 November 2026  
**Status:** Proposal only — implementation requires approval.  
**Scope of this change:** Create this document only. Do not modify the website, inventory, build scripts, dependencies, deployment, or Supabase resources.

## 1. Objective

Rebuild the existing static dealership website into a production-ready, database-driven application connected to Supabase. Authorised dealership users should be able to add vehicles, edit specifications and prices, upload photographs, publish listings, remove sold cars from public stock, manage enquiries and service requests, and review business activity without editing code or rebuilding HTML files.

Keep the existing dealership identity, useful content, photographs, responsive layouts, and accessibility behaviours. A full technical rebuild does not require an unrelated visual redesign. Any substantial design changes should be reviewed before implementation.

### Intended results

- One authoritative inventory in Supabase, not a JSON file plus manually maintained pages.
- Secure, invitation-only staff access with owner-controlled permissions.
- Real website form submissions stored reliably in the database.
- An admin dashboard showing inventory, leads, viewings, service work, and recent activity.
- Searchable vehicle entry logs, change history, and security events.
- Public inventory updates without code changes or redeployment.
- Traceable migration of all existing listings and URLs.

## 2. Repository audit: what exists today

This is a source-code and content audit of the checked-out repository, not a completed browser-based visual or production security audit. No existing Supabase project was selected or inspected, and no remote resources were changed. The Supabase connector is enabled; selecting the intended project remains an implementation prerequisite.

| Area | Observed implementation | Consequence |
| --- | --- | --- |
| Site architecture | `build.py`, eight `src/*.src.html` templates, seven general pages and 15 generated car pages | Adding a car requires editing data, adding files, and rebuilding |
| Public pages | Home, inventory, sell/exchange, about, showroom, contact, legal, and vehicle details | Every page family must be accounted for in the migration |
| Inventory source | `assets/data/inventory.json`, containing `brand` and 15 `cars` | No database, CRUD API, or staff editor |
| Vehicle data | ID, year, make/model/variant, kilometres, fuel, transmission, body, asking price, price note, region, location, highlights, source URL, overview, optional featured flag | Good migration source, but no status, internal stock reference, audit metadata, or timestamps |
| Existing stock | Six SUVs, four hatchbacks, three MUVs, two sedans; asking prices ₹1.30–9.90 lakh | Import these 15 records, not invented replacement stock |
| Data gaps | Transmission is null for 10 vehicles; confirmed opening hours are absent | Preserve unknowns and show honest labels rather than guessing |
| Inventory UI | Browser-side make, budget, minimum-year, fuel, transmission and body filters; price/km/year sorts; URL query state | Preserve filter semantics and shareable links, then move querying/pagination to the database |
| Vehicle details | Specification rows, completeness indicator, galleries, lightbox, related vehicles, viewing CTA and enquiry form | Convert to reusable, live-data-driven components |
| Forms | Contact, sell/exchange, and vehicle-detail forms use `data-mailto` and `initForms()` in `assets/js/site.js` | They open an email composer; no submission, booking or lead is stored by the site |
| Services | Six service labels in brand data and workshop/finance/insurance choices in the contact form | No service workflow or operational overview exists |
| Authentication | No staff login, account recovery, roles, route protection, or database authorisation | Must be designed end to end, not simulated with a hidden admin URL |
| Media | 30 stock JPEG files, including small variants; 30 gallery JPEGs; hero, logo, favicon assets and self-hosted fonts | Reuse genuine assets and preserve attribution/provenance |
| Presentation | Shared dark green/emerald stylesheet, Instrument Serif / Plus Jakarta Sans / Inter, responsive navigation, mobile focus trap, galleries, FAQ and reduced-motion support | Preserve the established visual language and interactions |
| Generated output | CSS and JS inlined into every generated HTML page | Replace duplicated output with shared application assets |
| Stock counts | `FLOOR_COUNT = 30` is hard-coded in `build.py`; public count derives from the JSON array | Live counts must come from managed records; do not create 15 fictitious vehicles to reach 30 |
| Availability | Cards say “Available to view”; structured data sets `InStock` without a vehicle status model | Sold/reserved states need consistent treatment across all public surfaces |
| Image/content coupling | Hero and some showroom/story shots reference fixed inventory array positions | Separate editorial media from sellable stock so selling a car cannot break a page |
| Legal content | Explicitly promises no server-side form storage, no accounts, and no cookies; terms remain a draft | Revise and obtain approval before introducing stored enquiries and staff sessions |
| SEO | Page titles, relative canonicals, Open Graph tags on several templates and vehicle JSON-LD | Preserve metadata and improve canonical/image URLs and stock availability markup |
| Tests and tooling | README references `/home/user/verify.py` and `/home/user/sweep.py`, neither present in this checkout; no package manifest or versioned app test suite | Add reproducible checks and CI inside the repository |

### Baseline issue discovered, not fixed

Running `python3 build.py --check` with the installed **Python 3.11.2** fails with `SyntaxError: f-string expression part cannot include a backslash` at `build.py:481`, originating in gallery-image f-string construction. The README's general Python 3 compatibility claim therefore does not hold for this environment. No generated pages were rewritten. During implementation, capture a reproducible legacy baseline using a compatible runtime or an explicitly approved small fix; the new application should not depend on this generator at runtime.

### Additional migration corrections

- The sell form hard-codes `max="2026"`; derive permitted years from current date/business rules.
- Validate optional email fields when non-empty, numeric values, field lengths, consent, and enum values on the server, not only in the browser.
- Resolve ambiguous year wording: data uses `year`, filters say “Registered from,” and some specs say manufacture year. Preserve the legacy year and label it only after dealership confirmation; model separate manufacture/registration years if needed.
- Replace dated, stock-dependent prose such as “only/newest/lowest” where it could become incorrect after an inventory update.
- Replace fixed fuel summaries with live facets. Confirm budget boundary rules so a price on a boundary is handled consistently.
- Do not copy existing structured data blindly: validate vehicle schema properties, absolute image URLs, and availability.

## 3. Proposed architecture

### Recommended stack

- **Next.js App Router + TypeScript:** server-rendered public pages for SEO, reusable components, protected admin routes, server-side form and management endpoints.
- **Supabase PostgreSQL:** inventory, leads, service requests, roles, and audit records.
- **Supabase Auth:** invitation-only staff accounts, password recovery, session management, MFA for privileged users.
- **Supabase Storage:** public approved vehicle media and separate private upload/document storage.
- **Supabase JS + SSR helpers:** typed database access and request-scoped staff sessions.
- **Schema validation:** shared validation rules, repeated at trusted server/database boundaries.
- **Testing:** unit tests, local database/RLS integration tests, and Playwright browser tests.
- **Deployment:** a Next.js-capable host plus Supabase. Hosting provider, project region, budgets and domain remain decisions, not actions authorised by this plan.

A framework is a recommendation, not a prerequisite imposed by Supabase. Keeping static pages and adding client-side database reads would be a smaller change, but would leave duplicated layouts, weaker initial-render SEO and a fragmented admin/security layer. The proposed rebuild provides one maintainable application.

### Request and trust boundaries

```text
Visitor -> server-rendered public routes -> restricted public inventory projection
Visitor -> validated, rate-limited submission endpoint -> private lead/request records
Staff -> Supabase Auth -> authenticated application -> RLS-protected business data
Owner -> re-authenticated privileged endpoint -> invitations / role administration
Database transactions -> protected audit triggers -> append-only audit records
Approved image publishing -> public media bucket
Private uploads / documents -> private bucket -> authorised signed URLs
```

- Prefer request-scoped staff credentials so RLS applies to ordinary admin operations.
- Public visitors must never get privileged keys or direct access to private tables.
- Restricted public views/RPCs must expose approved columns only; RLS alone does not hide individual columns. Use invoker-security views where appropriate and review grants explicitly.
- Server rendering is not itself authorisation. Every write endpoint, RPC, storage policy and database table must enforce access independently of the UI.
- If a privileged server key is necessary for invitations or anonymous intake, isolate it to a narrow endpoint, re-check permissions/inputs there, and never accept a caller-supplied actor identity. Privileged keys bypass RLS.
- Start with fresh server reads or explicit cache invalidation after mutations. A successful publish, price update, or sale must not leave stale public cards, dropdowns, related listings, counts or JSON-LD.
- Realtime is optional for dashboard convenience, not required for correct inventory. Prefer refetch-on-focus and reliable post-write refresh initially; subscribe only to authorised data if added later.

## 4. Public website rebuild, page by page

| Existing route | Rebuilt behaviour |
| --- | --- |
| `index.html` | Preserve hero, story, FAQ and calls to action; load featured/available vehicles and counts from live data; provide honest no-stock fallbacks |
| `inventory.html` | Live searchable inventory, existing filters and sorts, URL state, pagination, counts, clear filters, no-results and error states; exclude drafts, sold and archived stock |
| `car-<id>.html` | Dynamic vehicle route with gallery, specifications, price, current status, verified/updated dates, related cars and a persistent enquiry action |
| `sell-your-car.html` | Store sell/exchange submissions, contact information, vehicle details and consent; private photo uploads if approved |
| `about.html` | Preserve verified history and editorial sections; use managed company information; no invented testimonials or certifications |
| `showroom.html` | Managed address, map link, confirmed hours if supplied, independent showroom images and a viewing-request flow |
| `contact.html` | Real general/car/service enquiries with references and useful confirmation/error messages; retain phone/email alternatives |
| `legal.html` | Approved privacy notice, data handling/retention information, contact route for deletion requests, accurate session/storage disclosures and signed-off terms |

### Routing and compatibility

Use clean application routes such as `/`, `/inventory`, `/cars/[slug]`, `/sell-your-car`, `/about`, `/showroom`, `/contact`, `/legal`, and `/admin/...`.

- Add permanent redirects from all seven legacy general-page URLs and all 15 existing vehicle URLs, preserving relevant filter parameters and enquiry anchors where feasible.
- Import existing vehicle IDs as initial stable slugs. Use UUIDs for database identity and a separate unique internal stock number so another vehicle of the same make/year is possible.
- Keep a redirect history if a published slug changes; do not silently break links.
- Default sold-car policy: retain a public “sold/unavailable” detail page with no active booking CTA, and suggest available alternatives. Exclude it from active inventory. Archived/withdrawn listings return an appropriate unavailable/404/410 response according to the approved retention policy; never expose private drafts.
- Generate absolute canonicals, social preview URLs, a sitemap for indexable public routes and robots rules. Admin routes must be `noindex`, but this is not an access control.

### Public UX requirements

Preserve mobile navigation, focus management, keyboard gallery/lightbox controls, alt text, reduced-motion support and the current design language. Add loading, empty, error and retry states; successful submissions must be announced accessibly and shown only after durable storage succeeds. Never turn a database outage into an apparent “no stock” result.

## 5. Admin access and permissions

“User” initially means an invited dealership staff member, not a public customer account. Visitors can browse and enquire without signing in.

| Capability | Owner | Admin / manager | Staff |
| --- | --- | --- | --- |
| View dashboard | Full | Full operational | Assigned/permitted operational scope |
| Create/edit vehicle drafts and photographs | Yes | Yes | Yes |
| Publish, reserve, mark sold, archive or restore | Yes | Yes | No by default |
| Manage leads, viewings and service requests | All | All | Assigned records only |
| View internal financial/sale details | Yes | If explicitly permitted | No by default |
| View activity logs | All | Operational scope, excluding role/security administration | Own/assigned activity only |
| Edit public company details/service catalogue | Yes | Yes | No |
| Export customer data | Yes | Explicit permission only | No |
| Invite/deactivate users or change roles | Yes | No by default | No |
| Hard-delete/purge records | Controlled maintenance only | No | No |

Implement a small documented capability map, not a custom permission-builder in the first release. Owner-approved defaults can be simplified if the dealership only needs one administrator initially.

### Authentication lifecycle

- Invitation acceptance, sign-in, sign-out, forgotten password, reset-password and expired-link handling.
- No public signup that grants staff privileges. No default or shared admin password.
- Bootstrap the first owner through a documented one-time trusted setup process.
- Store roles and account-active state in a protected database table, not user-editable metadata or browser storage.
- Evaluate current active status and permissions on sensitive requests; do not rely solely on stale JWT role claims. Revoke sessions when deactivating accounts where supported.
- Require MFA for owners/admins and recent re-authentication for role changes, data exports and destructive actions; confirm recovery procedures before launch.
- Prevent removing/deactivating the last active owner. Log role changes with actor, target, previous/new role and timestamp.
- Use secure session handling, narrowly allowed auth redirect URLs, safe return URLs, login throttling, and CSRF/origin protection for cookie-authenticated mutations.

## 6. Proposed database model

Final SQL will be created as versioned migrations after approval. All tables below require explicit grants, constraints, indexes and RLS policies before being exposed.

| Table / group | Purpose and principal fields |
| --- | --- |
| `staff_profiles` | Auth user ID, display name, protected role, active state, created/updated timestamps |
| `vehicles` | UUID, unique stock number, unique slug, legacy ID, make/model/variant, legacy year and confirmed year fields, odometer km, fuel, transmission, body type, integer asking price in INR, price note, registration region, location, plain-text overview, status, featured flag, display order, source URL, verified date, published/sold/archived timestamps, created/updated by, version |
| `vehicle_internal_details` | Private acquisition cost, internal notes, document references and any approved sale information; never part of public vehicle responses |
| `vehicle_images` | Vehicle ID, storage object path, alt text, dimensions, sort order, cover flag, draft/public media state, uploader and timestamps |
| `vehicle_highlights` | Ordered highlights with provenance/confirmation where appropriate |
| `vehicle_stock_events` | Entry, reservation, sale, archive and restoration history; vehicle, actor, event type, time and reason |
| `leads` | Type (general/car/sell/exchange/finance/insurance), optional vehicle, contact fields, message, source page, status, assigned staff, consent notice version/time, created/updated timestamps |
| `seller_vehicle_details` | Lead ID, submitted make/model/year, odometer, owner sequence, insurance, condition, location and notes; does not automatically create public stock |
| `lead_notes` | Private follow-up notes, actor and time; access follows the related lead |
| `appointments` | Optional lead and vehicle, requested versus confirmed time, showroom/home test drive type, status, assignee and internal notes |
| `services` | Managed catalogue: service name, description, order, public visibility and active state |
| `service_requests` | Lead/customer reference, optional stock vehicle or external vehicle description, requested service, scheduled time, assignee, status, estimate/final amount if actually recorded, notes |
| `service_events` | Status changes and service history linked to requests/vehicles, without exposing customer details publicly |
| `site_settings` / `editorial_media` | Confirmed contact details, hours, business information, independent hero/showroom assets, approved homepage selections and optional reported-floor figure with verification date |
| `audit_logs` | Protected actor, action, entity type/ID, safe before/after changes, server timestamp, request correlation ID and limited contextual metadata |
| `notification_outbox` | Durable post-submission/admin alerts, delivery state, retry information and deduplication key; enable when notification delivery is implemented |

### Integrity rules

- Convert `priceLakh` exactly into integer rupees: `6.0 -> 600000`, `8.55 -> 855000`. Avoid floating-point money storage.
- Keep unknown transmission and other facts nullable; public wording distinguishes unknown from absent or unsupported features.
- Require a minimum validated field set and an approved cover image before publication. Drafts can be incomplete.
- Constrain statuses and transitions. Enforce non-negative prices/km, sensible years, field lengths and referential integrity.
- Maintain at most one cover image per vehicle and, by default, one active homepage-featured vehicle. Define deterministic fallback order when none is selected.
- Add indexes for public visibility/status/order and commonly used filters; leads/services by status, assignee and date; logs by entity/actor/time. Confirm query plans with representative data.
- Use UTC database timestamps, displayed in `Asia/Kolkata`; dates without time remain dates.
- Use optimistic concurrency (`version` or equivalent) to warn when two staff members edit the same record.
- Separate operational archives from privacy-driven deletion; retain safe history without retaining unnecessary personal data indefinitely.

## 7. Vehicle management and sold-car removal

### Screens

- Searchable inventory table with status tabs, thumbnail, stock number, make/model/year, asking price, km, last update and authorised actions.
- New/edit vehicle form grouped into identity, specification, price, description/highlights, media, visibility and private notes.
- Photograph uploader with validation, progress, retry, cover selection, reorder and deletion confirmation.
- Preview as a visitor before publishing.
- Per-vehicle history of entry, edits, price changes, publication, reservations and sale/archive events.

### Lifecycle

```text
Draft -> Available <-> Reserved -> Sold -> Archived
Draft / Available / Reserved -> Archived (withdrawn, with reason)
Archived -> Draft (controlled restore)
Sold -> Available only through an explicit manager/owner correction with reason
```

Publishing makes a vehicle publicly available; `published_at` is metadata, not a separate conflicting status. Restoring a record should not silently republish it. Validate any extra transition in the implementation's state machine.

**“Remove sold car” means remove it from active public stock, not erase its history.** Marking sold records the actor/time/reason and clears featured status, updates all public read surfaces, and retains the stock record and existing lead links. Recording sale price/customer details is optional, private, and must not be inferred from the asking price.

Use transactions for status changes and their database log entries. Confirm destructive-looking actions and reject stale edits. Archived record/media purge is a separate owner-controlled retention process, not a casual delete button.

## 8. Entry logs and audit history

Treat “entry logs” as two required features until the dealership confirms otherwise:

1. **Vehicle stock register:** when each car entered inventory, who entered it, subsequent reservations/sales/withdrawals, and associated notes.
2. **Administrative audit trail:** who changed a price, description, photograph, status, lead assignment, service status or permission, and when.

Show searchable logs with date range, actor, entity, action and per-vehicle timelines. Provide owner-authorised exports with access checks, CSV-formula sanitisation and a logged export event.

### Trustworthiness and privacy

- Use database triggers for business-row changes so direct API writes cannot bypass logging; insert the audit row in the same transaction. An audit-write failure should roll back the business mutation.
- Revoke ordinary staff insert/update/delete access to audit tables. Do not accept actor/time fields as truth from the browser.
- Review trigger functions carefully, including fixed `search_path`, grants and any `SECURITY DEFINER` use.
- Privileged/server-originated writes must identify a validated staff actor through a controlled path, or clearly record a system actor. Never imply an `auth.uid()` exists for every background operation.
- Storage uploads are not transactionally atomic with PostgreSQL. Log successful metadata changes, use pending states, and clean up failed/orphaned uploads with a reviewed reconciliation process.
- Database change triggers cannot prove login failures or read access. Use Supabase Auth events/logs and trusted application events for sign-in/security visibility; verify available retention/export capabilities before promising a complete security log.
- Do not log passwords, tokens, full uploaded documents or unnecessary copies of customer messages/contact details. Keep before/after differences for approved fields and redact sensitive values.
- Logs are append-only against application roles, not immutable against a database owner. External tamper-resistant retention is an optional later requirement.

A physical showroom visitor gate register is **not** assumed; confirm separately if that is what “entry logs” also means.

## 9. Enquiries, appointments and service overview

### Reliable form submission

- Replace mailto-only submission with server-validated contact, car enquiry and sell/exchange intake.
- Preserve entered values on recoverable failure; disable duplicate submits while pending and use idempotency keys for retries.
- Validate contact fields, lengths, enum values and referenced vehicle status. Resolve car identity/price on the server, not from hidden browser fields.
- Store the enquiry and consent metadata before showing a success reference. A success reference must not grant public access to the record.
- Rate-limit using a shared server-side mechanism; add honeypots and time-based checks. Add a bot challenge if needed after assessing privacy and accessibility.
- Deny anonymous lead reads/updates/deletes. Prefer intake endpoints with no direct anonymous table access.
- If notifications are enabled, commit the record/outbox first, then send/retry notifications. Email failure must not lose the lead or cause duplicate entries.
- Keep phone/email fallbacks clearly available; never claim an email, booking or notification succeeded merely because a browser action ran.

### Operational management

- Lead states: New -> Contacted -> In progress -> Converted / Closed / Spam.
- Assign leads, add private notes and follow-up dates, and filter by source, vehicle, assignee and age.
- Create viewing/test-drive requests as pending, not confirmed bookings. Staff confirm an actual time after availability checks.
- Avoid overlapping confirmed vehicle/staff bookings with a database-backed concurrency rule where applicable; retain cancellation/reschedule history.
- Route workshop/service enquiries into a basic service workflow: Requested -> Scheduled -> In progress -> Completed / Cancelled.
- Track customer-owned vehicles separately from sale stock; service requests must not require a car to be listed for sale.
- Dashboard cards: available/reserved/sold stock, new/unassigned leads, upcoming confirmed viewings, open/overdue service jobs and recent activity. Define reporting date ranges clearly and calculate aggregates from authorised data.
- Show sales/service amounts only if actually captured and permitted. Do not present inventory asking-price totals as realised revenue.

**Initial service scope:** service catalogue, requests, scheduling, status/history and overview. A full workshop ERP (parts, labour stock, tax invoices, payroll, accounting or automated valuation) is excluded unless requested.

## 10. Storage and application security

- Public bucket: explicitly approved, sanitised listing/showroom images only. Draft photos must not become public just because their vehicle row is private.
- Private buckets: seller uploads, RC/insurance papers, service documents and other customer records; short-lived signed URLs after authorisation.
- Restrict uploads by authenticated role/record ownership, MIME type, actual decoded file format, dimensions and size; use unpredictable object names and safe paths. Strip EXIF/location metadata during processing.
- Do not accept executable content or arbitrary SVG/HTML uploads. Apply additional document scanning if private document uploads are introduced.
- Database RLS and storage policies must cover anonymous, active staff, inactive staff, admin and owner cases, including direct SDK/API calls.
- Validate user text; render descriptions as escaped plain text or tightly sanitised supported markup. Escape structured data safely.
- Configure HTTPS, secure cookies/session handling, content security policy, safe security headers and controlled auth redirects. Limit cross-origin endpoints; protect same-origin mutations.
- Use `.env.example` with placeholders and ignored local environment files. Only the project URL and publishable key may be browser-visible; secret/service-role keys remain server-only.
- Separate development/staging/production configuration. Do not copy production customer data into preview environments.
- Define backup/restore procedures for both database and storage; database backups alone do not back up media objects. Verify Supabase plan-dependent recovery/logging/branching features before relying on them.

## 11. Migration and rollout

1. **Freeze and inventory:** save the legacy baseline, enumerate all routes, data references, images and public claims; capture approved screenshots before changing UI.
2. **Approve schema and access:** confirm project, staff roles, status rules, scope, retention and legal notice; create versioned schema/RLS/storage migrations only after implementation approval.
3. **Dry-run import:** validate the JSON, map every field, produce a report and use stable legacy keys for an idempotent import.
4. **Import into a non-production environment:** bring over all 15 cars, ten unknown transmissions, brand details and matching images. Preserve source URLs and `verifiedOn = 2026-11-24` as historical provenance; import time is not fresh verification.
5. **Review publication:** stage imports as drafts until staff confirm availability. Do not assume all legacy cars remain available merely because they appear in static HTML.
6. **Decouple editorial content:** migrate hero/showroom assets and selections without positional dependencies on vehicle arrays.
7. **Reconcile:** compare counts, exact rupee prices, specifications, ordering, images, alt text, legacy links and null fields. No unverified increase from 15 to the reported ~30 stock figure.
8. **Staff acceptance:** exercise adding/editing/publishing/selling a car, managing a lead, updating a service request, and reading the history using real role boundaries.
9. **Production preparation:** configure environment, domain, approved auth redirects, first owner, MFA, privacy terms, notification sender if used, monitoring and backups.
10. **Controlled cutover:** back up immediately before migration, reconcile any final changes, enable the new application and redirects, and monitor errors/submissions.
11. **Rollback:** retain the original static artefact and route/config rollback steps. If a rollback affects lead intake, disable the new form or explicitly use the email fallback; preserve and reconcile database submissions received after cutover rather than reverting them away.

## 12. Phased implementation and approval gates

| Phase | Work | Exit condition |
| --- | --- | --- |
| 0 — Plan approval | Review this document and resolve launch-blocking decisions | Owner approves scope/architecture before website or Supabase changes |
| 1 — Reproducible foundation | App skeleton, shared styling/components, routes, environment template, in-repo test setup and legacy baseline captures | Application builds; page shells retain agreed appearance; no production changes |
| 2 — Database and security | Migrations, constraints, Auth, roles, RLS, storage policies, audit triggers and local seed/import tooling | Permission and direct-API tests pass before remote/public exposure |
| 3 — Live public site | Migrate all page families; inventory queries, detail routes, media, metadata, counts and redirects | Reconciled legacy content; live available stock renders correctly with safe failure states |
| 4 — Admin stock management | Dashboard, inventory CRUD, photo workflow, preview/publish/reserve/sell/archive/restore and logs | Invited authorised users can manage a car end to end without code or redeploy |
| 5 — Business workflows | Persistent forms, lead assignment, viewings, service overview, settings and optional notifications | Submissions are durable, private, actionable, deduplicated and traceable |
| 6 — Hardening and launch | Browser/security/accessibility tests, import reconciliation, staff acceptance, backups, runbooks and production deployment | Launch checklist approved; rollback tested; no critical unresolved issues |

Order work in reviewable changesets. No fixed delivery date or subscription cost is promised until project access, deployment constraints and service scope are confirmed.

### Proposed future repository structure

```text
app/                     Public pages, admin routes and trusted endpoints
components/              Shared public and admin UI
lib/                     Supabase clients, auth/capabilities, queries and validation
public/assets/           Reused fonts, logo and appropriate static artwork
supabase/migrations/     Versioned schema, grants, RLS and function definitions
supabase/seed.sql        Non-sensitive local test data
scripts/                 Inventory/media import and reconciliation tooling
tests/                   Unit, permission/integration and browser tests
.env.example             Placeholder configuration only
README.md                Local setup, deployment and staff onboarding instructions
plan.md                  This approved/revised plan
```

Keep the existing static site intact until the replacement passes parity checks. Retire the generator/JSON as production sources only after cutover; keep a documented legacy snapshot through the agreed rollback window.

## 13. Verification and definition of done

### Automated checks

- Lint, type-check, unit tests and production build run in CI.
- Unit tests cover INR conversion/formatting, unknown specs, dynamic year rules, validation, allowed transitions and public visibility.
- Database/RLS tests demonstrate that anonymous users cannot read private data or mutate inventory, staff cannot escalate privileges/publish without permission, inactive users cannot operate, and the last-owner rule holds.
- Include storage policy tests, view/RPC column exposure checks and real direct API requests, not just tests that buttons are hidden.
- Integration tests cover import idempotency, audit transaction rollback, concurrent edits, duplicate submissions and sold-car enquiry races.
- Browser tests cover all public page families and admin workflows at desktop/mobile sizes, including widths from 320–1440 px, keyboard navigation, reduced motion, broken assets, console errors and horizontal overflow.
- Verify all legacy redirects, query deep links, statuses, canonicals, JSON-LD, sitemap exclusions and non-indexed admin routes.
- Exercise timeout/offline/database-error states, email notification failures and failed uploads; verify useful retry behaviour and no false success messages.
- Perform a backup restoration exercise and reconcile database/media after restore.

### Business acceptance checklist

- [ ] Owner can invite a staff member, set permissions and deactivate access.
- [ ] An authorised manager can add a car with multiple photos and publish it without editing files.
- [ ] A price/specification edit appears consistently on home, inventory, detail, enquiry options and structured data on the next fresh public request after a successful save.
- [ ] Selling/archiving removes a car from active stock and featured/related selections without deleting its history.
- [ ] No active stock, no featured car, one car and incomplete draft data all render safely.
- [ ] Every vehicle entry and material admin mutation has an attributable, protected history entry.
- [ ] All three existing form journeys persist a private record and show a durable-submission confirmation.
- [ ] Leads, viewing requests and basic service jobs can be assigned and managed from the dashboard.
- [ ] Customer information and internal financial details never appear in public APIs, HTML, metadata or logs exposed to visitors.
- [ ] All 15 source records are reconciled; only dealership-confirmed available stock is published.
- [ ] Privacy/terms, retention, recovery instructions and staff handover documentation are approved.

## 14. Decisions required before implementation

1. **Supabase target:** use an existing project or provision a new one? Which environment/region and budget? Inspect only the chosen project before planning migrations against it.
2. **Staff model:** who is the first owner, how many staff need access, and should staff be able to publish/sell cars or only prepare drafts? Supply account identities through the normal invitation process, not passwords or secret keys in chat.
3. **Visual scope:** preserve the current public appearance by default; approve any desired redesign separately.
4. **Sold listing policy:** approve the proposed sold detail page plus archive workflow, or choose complete public withdrawal. Audit/history remains private either way.
5. **Entry logs:** confirm stock register plus admin audit history, and whether a separate physical visitor register is needed.
6. **Service scope:** confirm basic scheduling/status management versus a later full workshop module.
7. **Data confirmation:** current availability of the 15 cars, meaning of the year field, confirmed opening hours and whether the reported floor count should still be displayed.
8. **Privacy and notifications:** retention periods, permitted staff exports, seller photo/document requirements, legal approval and email/SMS/WhatsApp expectations. No paid integrations assumed.
9. **Hosting and launch:** chosen provider/domain, access arrangements, staging strategy and acceptable cutover window.

### Explicitly outside the initial release

Online payments/deposits, customer self-service accounts, automated lender/insurance decisions, external dealer-directory scraping/synchronisation, WhatsApp automation, visitor analytics, a native mobile app and full accounting/workshop ERP. These can be scoped separately without blocking the core live inventory/admin system.

---

**Current execution boundary:** This turn delivers only `plan.md`. It does not authorise creating Supabase resources, running migrations, inviting users, installing dependencies, altering site behaviour, deploying or changing the current inventory.
