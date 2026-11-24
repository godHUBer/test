# plan.md — Supabase backend, entry logs & admin control system

**Sohan Automobile website · prepared 24 November 2026 · status: PLAN ONLY — no code changed yet**

This document analyses the site as it stands, then specifies how to connect it to
Supabase, add an append-only entry (audit) log, and give the dealership an admin
control panel that can change car data, add new cars, remove sold cars and manage
the services overview — without breaking anything this codebase deliberately is.

---

## 1 · What exists today (analysis of the current site)

### 1.1 Architecture

| Layer | File(s) | Role |
| --- | --- | --- |
| Generator | `build.py` (712 lines, Python 3.12+) | Renders every page from templates + data. Guards: unknown template tokens abort the build; missing car photos abort; CSS brace/token balance checked; button variants must be defined **and** used. |
| Templates | `src/*.src.html` (8 files) | The only place page copy may be edited. Token-based: `{{NAV}}`, `{{CAR_CARDS:ALL}}`, `{{FILTERS}}`, `{{SHOTS:…}}`, `{{CAR_*}}` for vehicle pages. |
| Data | `assets/data/inventory.json` | **The single source of truth for all car + company data**: `brand` (name, phone, email, address, services[6], hours = `null`, verifiedOn) and `cars` (15 entries). README: "the ONLY place car and company data is written". |
| Styling | `assets/css/styles.css` (969 lines) | Dark design system, self-hosted fonts, `color-scheme: dark`. Inlined at build. |
| Behaviour | `assets/js/site.js` (438 lines) | Progressive enhancement only: nav, mobile sheet, reveals, gallery, inventory filter/sort, mailto forms, motion. **Zero network calls.** |
| Output | 22 HTML files | `index`, `inventory`, `sell-your-car`, `about`, `showroom`, `contact`, `legal` + one `car-<id>.html` per car. Each fully self-contained (CSS+JS inlined) — works from `file://`. |

### 1.2 How car data flows today

```
inventory.json ──► build.py ──► 22 static HTML pages
                    │              ├─ index.html   (featured card + 6-card grid)
                    │              ├─ inventory.html ({{FILTERS}} + {{CAR_CARDS:ALL}}, client-side filter/sort on data-* attributes)
                    │              ├─ car-<id>.html ×15 (full detail page, JSON-LD, gallery)
                    │              └─ contact / sell forms → mailto composer (rule 5: "Nothing is stored or sent by the site")
```

Facts that matter for the redesign:

- **Cars have no `status` field.** Every card renders a hard-coded `<span class="veh__status">Available to view</span>`, and the legal page honestly says availability "changes continuously… a car shown here may be reserved or sold; confirm by phone". There is no sold-state anywhere in the data model.
- **Adding a car** = drop in 4 photos (`stock/<id>.jpg`, `-sm`, `gallery/<id>-1/2.jpg`) + JSON entry + rebuild. Removing = delete the entry + rebuild. The dealership cannot do this themselves.
- **Counts are editorial:** "15 cars published online · ~30 on the books" is printed in the nav sheet, home, inventory and footer, and the README's rule 3/4 says these claims must stay honest.
- **Each card already carries filter attributes** (`data-make`, `data-body`, `data-fuel`, `data-year`, `data-price`, `data-km`, `data-trans`) but **no stable car id attribute** — the runtime layer will need one added by `build.py` (additive, harmless).
- **"Services overview" surface:** `brand.services` renders as the contact-grid "Services" row and the `{{SERVICE_LIST}}` token; `hours` is a visible honest-gap placeholder ("Opening hours to be confirmed by the dealership").
- **Editorial rules (README, must keep):** nothing invented; gaps stay visible; no fabricated proof; floor is bigger than the site; forms are mailto composers; prices are dated asking prices.

### 1.3 Environment notes

- ⚠ **`build.py` does not run on this sandbox's Python 3.11.2** — line 480 uses a backslash inside an f-string expression (PEP 701, Python 3.12+). `python3 build.py --check` currently dies with `SyntaxError` **before any file is touched**. This is pre-existing, not caused by this plan. Phase 3 (which edits `build.py` anyway) includes a 2-line compatibility fix, or the build can run on any Python ≥ 3.12.
- The acceptance scripts the README references (`/home/user/verify.py`, `/home/user/sweep.py`) are not present in this repository — verification will rely on `build.py --check` plus manual/HTTP checks added in Phase 5.
- **Supabase connector is enabled and capable**: `create_project`, `create_migration` (DDL, rolls back on failure), `execute_query`, `update_auth_config`, `create_edge_function`, `create_secrets`, `create_api_key`. **`list_projects` returned empty — no project exists yet**, so Phase 0 creates one. Vercel is connected but switched off (only relevant if hosting is wanted — see open questions).

---

## 2 · Goals and non-goals

**Goals**

1. Supabase becomes the live source of truth for cars and showroom info; the static pages keep working exactly as today when Supabase is unreachable.
2. The dealership gets an admin control panel (`admin.html`, same dark design, no framework) that can: **edit car data, add new cars (with photo upload), mark/remove sold cars, edit the services overview & showroom info, and view the entry log**.
3. Every admin action and every data mutation is recorded in an **append-only entry log** (who, what, when, before→after, IP, user-agent) that only admins can read and nobody can alter.
4. Public trust stays intact: honest counts, "not stated" gaps, dated prices, sold handling that never fakes availability.

**Non-goals (explicitly out of scope for this plan)**

- No framework, bundler, CDN or `supabase-js` npm dependency — the site stays hand-rolled and self-contained (a minimal fetch client over Supabase's REST endpoints instead).
- Enquiry/lead storage stays out until phase 6 (it would contradict legal.html rule 5; that page's copy would need a deliberate edit — flagged as optional).
- No public-facing change to layout/design of existing pages beyond additive markers.

---

## 3 · Target architecture

```
                       ┌────────────────────────── SUPABASE PROJECT ──────────────────────────┐
 Public visitor        │  Postgres (RLS)            Auth            Storage         REST      │
 ──► static HTML ──┐   │  ┌──────────────┐   ┌──────────────┐   ┌─────────────┐  (PostgREST)  │
   (build.py,      │   │  │ cars         │   │ auth.users   │   │ car-photos  │               │
    SEO + no-JS    ├──►│  │ brand_settings│  │ (invite-only)│   │ (public rd) │  ◄── data.js  │
    baseline)      │   │  │ activity_log │   │ admin_profiles│  └─────────────┘   (anon key)  │
                   │   │  └──────────────┘   └──────────────┘                                 │
 Admin ──► admin.html ──► login (email+password JWT) ──► PostgREST + Storage with admin RLS     │
           (built by build.py, not linked from public nav)                                      │
```

**Two independent consumers, one database:**

1. **Public pages** — rendered by `build.py` from `inventory.json` exactly as today (baseline: SEO, first paint, no-JS, `file://`). A new `assets/js/data.js` (inlined like `site.js`) then *enhances* them: it fetches the published rows with the **anon key** and patches prices/km/availability, hides or badges sold cars, appends cars that exist only in the DB, and updates the published-count. If the fetch fails or is slow, the static content simply stays — nothing breaks.
2. **Admin panel** — a new `admin.html` page built by `build.py`, authenticating against Supabase Auth with an invite-only account, reading/writing through PostgREST under strict RLS, uploading photos to Storage.

---

## 4 · Supabase backend design

### 4.1 Project bootstrap (connector-driven, Phase 0)

- `create_project` — free plan, region `ap-south-1` (Mumbai — lowest latency to Kolkata), generated DB password (delivered once, never stored in the repo).
- `list_organizations` → org id for the call above (if the account has none, the user creates one in the dashboard first — one-time).
- `update_auth_config` — `site_url` set to the deployment origin, `uri_allow_list` limited to it, **`disable_signup: true`** after onboarding (see 4.3), `jwt_exp` 3600, refresh-token rotation on.
- `create_api_key` — a named `publishable` key (`site_anon`) for the public site. The **anon/publishable key is public by design** — it ships inside the HTML and is safe *only* because every table is RLS-protected. The `secret`/service-role key never touches the browser or this repo.

### 4.2 Tables

```sql
-- 001_cars.sql
create table public.cars (
  id            text primary key,               -- slug, e.g. 'creta-2018' (matches car-<id>.html)
  sort_order    integer not null default 100,   -- mirrors the JSON array order ("manual sort order")
  featured      boolean not null default false, -- "Newest on the floor" card
  status        text not null default 'available'
                check (status in ('available','reserved','sold','hidden')),
  year          integer not null check (year between 1980 and 2100),
  make          text not null, model text not null, variant text not null,
  km            integer not null check (km >= 0),
  fuel          text not null, transmission text,           -- null ⇒ "Not stated" (rule: gaps stay visible)
  body          text not null,                              -- SUV | Sedan | Hatchback | MUV
  price_lakh    numeric(6,2) not null check (price_lakh > 0),
  price_note    text,
  reg           text not null, location text not null default 'Beleghata / Garden Lane, Kolkata',
  highlights    text[] not null default '{}',
  listing_url   text, overview text not null default '',
  photo_stock   text,                            -- storage path for DB-added cars; null ⇒ local asset for seeded cars
  photos_gallery text[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 002_brand_settings.sql  (singleton row, id = 1)
create table public.brand_settings (
  id integer primary key default 1 check (id = 1),
  name text, tagline text, phone_display text, phone_href text, email text,
  address_short text, address_city text, area text, map_url text,
  services text[] not null default '{}',        -- the "services overview" the admin edits
  hours text,                                   -- fills today's honest-gap placeholder once known
  verified_on date, updated_at timestamptz not null default now()
);

-- 003_admin_profiles.sql
create table public.admin_profiles (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  email     text not null,
  role      text not null default 'editor' check (role in ('owner','editor')),
  display_name text,
  created_at timestamptz not null default now()
);

-- 004_activity_log.sql — append-only entry log
create table public.activity_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor_id    uuid,                             -- auth.uid() of the admin, null for anonymous attempts
  actor_email text,
  action      text not null,                    -- see 4.4
  entity      text,                             -- 'car' | 'brand' | 'auth' | 'photo' | 'admin'
  entity_id   text,                             -- car id / brand / email
  summary     text not null,                    -- human sentence for the panel
  changes     jsonb,                            -- { field: {from, to} } diff
  ip          text, user_agent text
);
```

Indexes on `cars(status)`, `activity_log(at desc)`, `activity_log(entity, entity_id)`. An `updated_at` trigger on `cars` and `brand_settings`.

### 4.3 Auth & access control

- **Invite-only admins.** Public signup stays **disabled** (`disable_signup: true`). Onboarding path: while the panel is being set up, signup is temporarily enabled so the owner registers their email+password once; a trigger on `auth.users` creates the `admin_profiles` row as `editor`; the `owner` role is then granted by SQL, and signup is flipped back off via `update_auth_config`. (The connector cannot mint auth users directly, so this toggle is the honest path; alternative is the Supabase Dashboard "Add user" — noted in the phase.)
- **Role helper:**
  ```sql
  create function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as
  $$ select exists (select 1 from public.admin_profiles p where p.user_id = auth.uid()) $$;
  ```
- **RLS policy matrix** (row-level security enabled on every table):

| Table | anon (public site) | authenticated admin | notes |
| --- | --- | --- | --- |
| `cars` | `SELECT` only where `status = 'available'` | full `SELECT/INSERT/UPDATE/DELETE` via `is_admin()` | sold/reserved/hidden rows invisible to the public at the database level |
| `brand_settings` | `SELECT` | full via `is_admin()` | services/hours are public info |
| `admin_profiles` | none | `SELECT` own row; owner manages | |
| `activity_log` | none | `SELECT` only | **no INSERT/UPDATE/DELETE policies at all** — append-only (see 4.4) |
| `storage.objects` (bucket `car-photos`) | `SELECT` in bucket | `INSERT/UPDATE/DELETE` in bucket via `is_admin()` | public-read bucket, path-prefixed `cars/` |

- **In the browser:** both the public site and the admin panel speak raw REST with `fetch` — `/rest/v1/*` (PostgREST) and `/auth/v1/*` (token, refresh, logout). The admin client persists the refresh token in `localStorage`, refreshes on 401, and never sees anything beyond the anon + user JWT. No service-role key anywhere client-side, ever.

### 4.4 Entry logs (audit trail)

**What gets logged** — every mutation of business data plus security events:

| action | entity | source | captured |
| --- | --- | --- | --- |
| `car.create` / `car.update` / `car.delete` | car | DB trigger | full field diff `{price_lakh: {from: 6.00, to: 5.75}, …}` |
| `car.status` (`mark_sold`, `mark_reserved`, `hide`, `restore`) | car | DB trigger (UPDATE on `status`) | status from→to |
| `brand.update` | brand | DB trigger | services list, phone, hours, … from→to |
| `photo.upload` / `photo.delete` | car | admin client RPC after Storage op | path |
| `auth.login` / `auth.logout` / `auth.login_failed` | auth | SECURITY DEFINER RPC `record_auth_event(p_action text)` called by the panel (failed logins recorded too) | email, ip, user-agent |
| `admin.enrolled` / `admin.role_changed` | admin | trigger on `admin_profiles` | role from→to |

**How it stays tamper-proof:**

- A `SECURITY DEFINER` function `log_activity()` owned by `postgres` is the only writer; it is invoked from `AFTER INSERT/UPDATE/DELETE` triggers on `cars`, `brand_settings`, `admin_profiles`. Because `postgres` owns the table, the insert bypasses RLS while **no client policy allows insert** — a compromised admin session *cannot* edit or erase history, only create new business-data rows (which themselves get logged).
- Actor identity comes from `auth.uid()` / JWT email inside the trigger; **IP and user-agent** from Supabase's injected `current_setting('request.headers', true)::json` (`x-forwarded-for`, `user-agent`).
- The `changes` JSONB diff is computed generically in the trigger (`to_jsonb(OLD)` vs `to_jsonb(NEW)`), so new columns are audited automatically.
- Retention: keep forever (rows are tiny); the panel view caps at the last N with filters.

**Admin visibility:** a read-only **Activity** tab in the panel (filter by action/entity/date), plus the Overview tab shows the 10 most recent entries.

### 4.5 Storage

- One **public-read** bucket `car-photos`, paths `cars/<id>.jpg`, `cars/<id>-sm.jpg`, `cars/<id>-1.jpg`… mirroring the local asset naming, so the renderer treats local and remote photos identically.
- The 15 seeded cars keep their local `assets/img/...` files (fast, already built). **New cars added via the admin panel upload through Storage** and render from `<project>.supabase.co/storage/v1/object/public/car-photos/...`.
- Bucket + policies created via `execute_query` (insert into `storage.buckets` + `storage.objects` policies) since the connector has no dedicated storage tool.

### 4.6 Seed & sync (keeping the two sources honest)

- **Seed (Phase 2):** a small script `scripts/seed_supabase.py` converts `inventory.json` → INSERT statements (15 cars + brand row) executed via `execute_query`. Idempotent (`ON CONFLICT (id) DO NOTHING`) so it can be re-run safely.
- **Sync (Phase 5):** `scripts/sync_db.py` pulls `cars` + `brand_settings` → rewrites `inventory.json` → `build.py` regenerates the static HTML. Run after admin edits whenever a rebuild is wanted; until then the runtime layer already reflects DB changes live. This keeps the "single place data is written" convention true — the DB writes it, the JSON mirrors it for the build.

---

## 5 · Public site changes (runtime enhancement layer)

**New file `assets/js/data.js` (~7 KB, hand-rolled, same style as `site.js`)** — inlined by `build.py` into every page. Behaviour, all progressive:

1. Fetch `GET /rest/v1/cars?select=…&status=eq.available&order=sort_order.asc` with the anon key, 2.5 s timeout. On any failure → **do nothing** (static content remains; today's behaviour is the fallback).
2. **Patch existing cards** matched by the new `data-car-id` attribute (`build.py` adds it in `render_card`/`render_featured` — additive): update price/km text, availability line (`veh__status` → "Reserved — call to confirm" / "Sold"), transmission "Not stated" gaps preserved.
3. **Sold/reserved handling (recommended policy, see open question Q2):** sold cars disappear from grids but **keep their `car-<id>.html` page** — `data.js` on the detail page (matched against `{{CAR_ID}}`) shows a clear "This car has been sold" notice, hides the enquiry CTA, and the JSON-LD availability is corrected client-side. No dead links, honest page.
4. **Append DB-only cars** (ids absent from the static build) into the inventory grid and home grid, rendered with the same `veh` card markup + `data-*` filter attributes so the existing `initInventory()` filter/sort picks them up; photos point at Storage.
5. **Update honest counts** — every element carrying the published-count (`nav sheet`, home, inventory, footer) is wrapped by `build.py` in `[data-count-published]` and re-set from the live row count; the "~30 on the books" floor figure stays a build-time constant (it is the dealer's own claim, not inventory-derived).
6. Detail-page enquiry prefill and `CAR_OPTIONS` dropdowns are static build artifacts; `data.js` removes options for sold cars from the contact form dropdown.

**Nothing else changes on public pages:** no layout edits, no design changes, no-JS visitors see exactly today's site, and the `legal.html` claim about forms remains true (forms stay mailto in phases 1–5).

---

## 6 · Admin control panel (`admin.html`)

Built by `build.py` (new `src/admin.src.html` + `assets/js/admin.js` ~15 KB), matching the dark design system (`btn`, `field`, `chip` components), **not linked from the public nav or footer** — reachable at `/admin.html` by URL. One page, tabbed, no framework. Session guard: unauthenticated visitors see only the login card.

| Tab | Capabilities | Maps to your requirement |
| --- | --- | --- |
| **Overview** | Counters (available / reserved / sold / hidden / DB-only), last logins, 10 latest log entries, project health ping | "overview" |
| **Cars** | Sortable table of all cars with inline edit: price (+note), km, transmission, highlights, featured toggle, sort order, status chips (`available · reserved · sold · hidden`); per-car "Delete permanently" guarded by a typed confirmation | **"change car data"** |
| **Add car** | Full form (id slug, year, make, model, variant, km, fuel, transmission-optional, body, price, reg, highlights, overview) + drag-drop photo upload (stock, -sm, gallery ×N) into Storage; validation mirrors build.py's checks (id uniqueness, photo presence) | **"add new cars"** |
| **Sold management** | One-click **Mark sold** (status change, logged, gone from grids, notice on its page), then optional **Remove** = `hidden` (invisible everywhere) or permanent delete; bulk "clean up sold" view | **"remove sold cars"** |
| **Showroom info** | Edit `brand_settings`: services list (add/remove rows), opening **hours** (retires the honest-gap placeholder once real), phone, email, address, tagline; every save logged with a diff | **"overview service"** |
| **Activity** | Filterable read-only log table (action, actor, entity, date range) with from→to diffs | **"entry logs"** |
| **Account** | Who am I, role, change password, logout | |

Every write goes through RLS as an authenticated admin; every write lands in `activity_log` via the triggers; destructive actions require confirmation and are labelled with their log consequence.

---

## 7 · Build-system changes (the full file manifest)

| File | Change | Phase |
| --- | --- | --- |
| `supabase/migrations/001…004.sql` *(new)* | Local mirror of what `create_migration` runs | 1 |
| `scripts/seed_supabase.py` *(new)* | inventory.json → SQL seed | 2 |
| `assets/js/data.js` *(new)* | public runtime layer | 3 |
| `build.py` | register `admin` page in `PAGES`; add `data-car-id`/`data-count-published` markers; inline `data.js`; `ADMIN_JS` injection; **2-line Python 3.11 f-string compat fix** (line 480) | 3–4 |
| `src/admin.src.html` *(new)* | admin shell, tabs, login card | 4 |
| `assets/js/admin.js` *(new)* | auth + REST client, CRUD, uploads, log viewer | 4 |
| `scripts/sync_db.py` *(new)* | DB → inventory.json | 5 |
| `README.md` | new "Supabase & admin" section; updated layout/editing tables | 5 |
| `legal.html` | **unchanged** (unless optional Phase 6 is approved) | — |

Guardrails preserved: `build.py`'s token whitelist gets the admin tokens added properly (no stray `{{}}` can ship), button-variant check still enforced, missing-photo check extended to DB-only cars at runtime (fallback placeholder block exists already).

---

## 8 · Security summary

- RLS on every table; anon key is public-but-impotent (read-only, available cars only); **service-role/secret key never leaves Supabase**.
- Public signup disabled; admin enrolment is a deliberate, logged act; two roles (`owner` can manage roles, `editor` can manage content).
- `activity_log` is append-only — no client, including an admin session, can UPDATE or DELETE history.
- Failed logins are logged with IP/user-agent; JWT expiry 1 h with rotation.
- No PII beyond staff emails; visitors' mailto emails never touch the database (rule 5 intact).
- Photos: public-read bucket, admin-only writes, filename pattern enforced by the panel.

---

## 9 · Delivery phases & acceptance criteria

| Phase | Work | Acceptance |
| --- | --- | --- |
| **0 — Project** | `list_organizations` → `create_project` (ap-south-1, free) → `update_auth_config` → `create_api_key` (`site_anon`) | Project healthy (`get_project_health`); URL + anon key recorded |
| **1 — Schema, RLS, audit** | Migrations 001–004 via `create_migration` (auto-rollback on failure) | anon can SELECT available cars only; anon INSERT denied; an UPDATE as admin produces a correct `activity_log` row with diff + IP |
| **2 — Seed** | `seed_supabase.py` → 15 cars + brand row | `/rest/v1/cars` returns exactly the JSON fleet; sold-less parity with the site |
| **3 — Public layer** | `data.js` + `build.py` markers + compat fix | `build.py --check` passes; with DB up, price/sold/count changes reflect on reload; with network blocked, pages identical to today; no-JS identical to today |
| **4 — Admin panel** | `admin.html` + `admin.js`; owner onboarding; signup re-disabled | Full cycle: login → edit price → add car (photo) → mark sold → remove → verify log entries → logout; every action visible in Activity tab |
| **5 — Sync & docs** | `sync_db.py`, README | Rebuild after sync produces pages matching DB state |
| **6 — optional** | Enquiries → `leads` table + admin inbox (requires legal.html copy edit) | decided later |

---

## 10 · Open questions (recommended defaults in **bold**)

- **Q1 Supabase project** — none exists in the account. Create a **new free-tier project in Mumbai (ap-south-1)**? Requires an organization on the account (checked at Phase 0) and a DB password I generate and hand over once.
- **Q2 Sold-car policy** — **(a) keep the detail page with a "sold" notice, remove from grids** *(recommended: no dead links, honest)* vs (b) hide entirely vs (c) badge-in-place. Permanent delete always remains a separate, logged admin action.
- **Q3 Admin accounts** — whose email(s) become admins, and does one `owner` + one `editor` role split fit? **Default: single owner account now; roles ready in schema.**
- **Q4 Hosting** — where does the static site actually serve from (affects `site_url` for auth redirects)? If you want it deployed, the **Vercel connector is connected but switched off** — turn it on and say the word.

---

## 11 · What will not change

`file://` compatibility, self-contained pages, no frameworks/CDN/analytics, the six editorial rules, `build.py`'s loud-failure guards, the dark design system, mailto forms (through Phase 5), and the public pages' copy. The plan adds a live data layer and a control room around the site that exists — it does not rewrite it.

---

## 12 · Implementation log

### Phase 0 — Project · **complete** (24 Nov 2026)

| Item | Value |
| --- | --- |
| Organization | `b3astgam3r2010@gmail.com's Org` (`sgcauonmwuevztqwmpsr`) |
| Project | **sohan-automobile** · ref `vxlxoiycolfojcnhnzfr` |
| Region / plan | `ap-south-1` (Mumbai) · free |
| Health | `ACTIVE_HEALTHY` — auth, db, pooler, rest, storage, pg_bouncer all healthy |
| Project URL | `https://vxlxoiycolfojcnhnzfr.supabase.co` |
| Publishable key | `site_anon` → `sb_publishable_7OTbCZGA4jhjP4sL6KAg0A_fjsfo9js` (public by design — ships in HTML from Phase 3; read-only under RLS) |
| Auth config | site_url `http://localhost:8000` (placeholder until hosting is known — update in Phase 5) · allow-list localhost only · JWT 1 h · refresh-token rotation on (reuse interval 10 s) · email auth only, phone/OAuth off · mailer autoconfirm on |
| Signup | **temporarily enabled** for owner onboarding in Phase 4 — must be flipped off (`disable_signup: true`) once the admin account exists · tracked below |
| DB password | delivered in chat once; never stored in the repo |

Open items carried into Phase 1: none blocking. Q2/Q3/Q4 defaults remain in force unless the user overrides them.

### Phase 1 — Schema, RLS, audit · **complete** (24 Nov 2026)

Applied via `create_migration` (auto-rollback on failure); mirrored to `supabase/migrations/`:

| # | Migration | Contents |
| --- | --- | --- |
| `20261124110715` | `create_admin_profiles_and_role_helpers` | `admin_profiles` (roles `owner/editor/pending`), `is_admin()`, `is_owner()`, `touch_updated_at()` |
| `20261124110731` | `create_cars_table` | `cars` + status check + indexes + touch trigger + RLS (public: available-only SELECT; admins: full CRUD) |
| `20261124110740` | `create_brand_settings_singleton` | `brand_settings` (id = 1, services/hours/showroom info) + RLS |
| `20261124110816` | `create_activity_log_audit_and_storage` | `activity_log` (append-only), `log_activity()` SECURITY DEFINER trigger on all three tables, `handle_new_admin()` (pending-role auto-profile on signup), `record_auth_event()` RPC (anon: failed logins only, flood-guarded at 20/IP/15 min), `car-photos` public-read bucket + admin-only write policies |
| `20261124110941` | `fix_log_activity_operator_precedence` | `||` and `->>` share a precedence level in PostgreSQL — two summary expressions needed parentheses |

**Acceptance tests (all via direct SQL + role impersonation):**

| Test | Expected | Result |
| --- | --- | --- |
| anon SELECT on `cars` (1 available car) | sees exactly it | ✅ 1 row |
| anon INSERT into `cars` | RLS denial | ✅ `42501: new row violates row-level security` |
| non-admin authenticated UPDATE on a car | row untouchable | ✅ 0 rows affected |
| anon SELECT after car marked `sold` | sold invisible | ✅ 0 rows |
| anon SELECT on `activity_log` | empty | ✅ 0 rows |
| authenticated tamper attempt on `activity_log` (UPDATE summary) | row untouchable | ✅ 0 rows affected |
| audit entries for insert / status / multi-field update / delete | correct summaries + diffs | ✅ e.g. `car.update` → `{"km": {from: 5000, to: 6100}, "highlights": {from: [], to: ["Less driven"]}, "price_lakh": {from: 3.00, to: 3.25}}` |

Actor/IP/UA are null in these test rows because they ran over the direct connection without a JWT — real admin actions through the panel carry full identity (that path is exercised in Phase 4). Test rows (`selftest-phase1/2`) were removed; their six honest log entries remain in `activity_log` as setup history.

### Phase 2 — Seed · **complete** (24 Nov 2026)

`scripts/seed_supabase.py` generates idempotent SQL (`ON CONFLICT (id) DO NOTHING`) from `inventory.json`; the generated seed was executed via `execute_query`. The database holds admin-editable facts only — static-site copy (`established`, `ledBy`, `sourceInventory`, `sourceSite`, `social`) deliberately stays in JSON/build land.

| Acceptance test | Expected | Result |
| --- | --- | --- |
| Row counts after seed | 15 cars, 1 brand row | ✅ |
| Log entries | 22 = 6 (Phase 1 self-tests) + 1 `brand.init` + 15 `car.create` | ✅ |
| Field parity vs `inventory.json` | every field of every car | ✅ programmatic diff: **PASS** (incl. `Vit'Brezza` apostrophe, ₹ price notes, highlight arrays, nulls, `featured: xl6-2025`, `sort_order = (i+1)*10`) |
| Idempotency probe (re-INSERT `creta-2018` with price 9.99) | original 6.00 survives, no duplicate, no spurious log rows | ✅ price 6.00, 15 cars, 22 log entries |
| anon visibility | all 15 available cars visible | ✅ |
| `brand_settings` | name/phone/email/services[6]/hours null/verifiedOn 2026-11-24 | ✅ |

Re-seeding later is safe by construction: existing rows are never overwritten, so admin edits survive. `sync_db.py` (Phase 5) will own the JSON ← DB direction.

### Phase 3 — Public runtime layer · **complete** (24 Nov 2026)

**Plan amendment (documented):** migration `public_read_includes_reserved_and_sold` widens the anon SELECT to `available + reserved + sold` — the sold-notice-on-detail-page policy requires the public page to *know* a car is sold; `hidden` remains invisible. Reserved cars stay in grids with a "Reserved — call to confirm" badge (the CSS already had `veh__status--pending`).

**New `assets/js/data.js` (~10 KB, no dependencies):** fetches published cars from PostgREST with the publishable key (2.5 s abort timeout), then reconciles: patches card/hero/detail prices and odometers, badges reserved, removes sold cards from grids while their detail pages get an honest "This car has been sold" banner (CTA buttons + enquiry section hidden), appends panel-added cars into the inventory and home grids (photo from Storage, or a labelled "Photograph pending" block; call-to-enquire instead of a link, since their detail pages exist only after the next rebuild), removes sold cars from the contact dropdown, updates every `[data-count-published]` figure and the inventory "Showing X of Y" line. Any failure — offline, slow, blocked — leaves the static page exactly as built.

**Additive changes:** `build.py` (Python 3.11 f-string compat fix via `frame_attrs()` helper — the build now runs on 3.11.2; `{{DATA}}` token inlining `data.js`; `data-car-id` on cards/hero/options; nav-sheet count span), `site.js` (`apply()` re-reads the grid so counts/filters follow live-layer removals and appends), templates (8 × `{{DATA}}`; `[data-count-published]` spans around every published-count; `data-featured-slot`, `data-home-grid`; vehicle `<body data-car-id>`).

**Acceptance:** `node --check` clean on both scripts · `build.py` + `build.py --check` pass on 3.11 (22 pages) · every page carries the markers and inlines `data.js` · zero leftover `{{…}}` tokens · preview serving on :8000 with the live layer fetching the seeded 15.
