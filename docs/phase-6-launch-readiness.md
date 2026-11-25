# Phase 6 — local hardening and launch readiness

**Local hardening delivered. Launch NOT approved or executed.** The plan's Phase 6 exit condition is an approved launch checklist, a tested rollback/recovery and no critical unresolved issues. That exit condition is **not met**: verified recovery readiness, real Supabase/provider/native-concurrency checks, real staff/manual accessibility acceptance, confirmed public data/privacy/retention/deferred-scope approval and production deployment still need evidence. The earlier user answer was **backups not verified**. No remote connector calls, credential retrieval, migrations, imports, uploads, invitations, DNS changes or deployment occurred in this phase.

## Implemented locally

- Automated axe-core WCAG 2/2.1 A/AA-tagged scans, without rule exclusions, across public page families/mobile menu, configured enquiry/seller/service/vehicle forms and owner/manager stock/business/settings screens. A 320px long-unbroken-text intake-success/private-record test checks reflow and accessibility. Small CSS containment changes protect stored references and untrusted plain text; the protected legacy files remain unchanged.
- Browser checks for `nosniff`, restricted device/payment permissions, baseline CSP, private no-store/noindex/no-referrer responses and absence of synthetic service secrets/refresh-token material from public HTML and loaded script bundles.
- Baseline CSP `base-uri 'self'; object-src 'none'`, `X-Content-Type-Options`, public referrer and Permissions-Policy headers. Private proxy responses retain stronger no-referrer/no-store/noindex rules. No frame restriction breaks the embedded preview. Full script/framing CSP and domain-specific HSTS remain deployment hardening gates, not falsely claimed protections.
- Strict staff Auth project-origin validation now also rejects embedded credentials, non-root paths, query strings and fragments instead of silently discarding them.
- An **offline** inventory reconciliation CLI with exact-price/null/ordering/media-reference comparison, duplicate/missing/extra IDs, safe metadata-only differences, source/input hashes and all 45 local legacy image byte hashes. It never connects to a database or imports/publishes anything.
- A fail-closed, source-digest-bound release evidence checker with nine explicit gates, reviewed artifact hashes/dates, runtime configuration checks and secret-safe output. Its default/current outcome is **BLOCKED**; a manifest alone is not approval.
- CI now includes legacy dry-run validation, production dependency audit and a candidate manifest alongside the prior checks/build/browser suite. It never deploys or activates Supabase. Operational recovery and real staff acceptance scripts are documented separately.

## Commands and output

```sh
npm ci
npm run check
npm run inventory:dry-run
npm run build
npm run test:e2e
npm audit --omit=dev
npm run release:manifest
```

`release:manifest` writes `.generated/release-manifest.json`. The deterministic SHA-256 digest covers first-party app/components/library/scripts/SQL/tests/docs/CI/config/lockfile **and legacy source inputs/assets**. Generated outputs, local evidence/backups, credentials, `.env` and `node_modules` are not scanned. It is source identity, not a signature, reproducible-build proof, remote asset inventory or deployed-artifact attestation. Symlinked release-source paths are rejected. Run again after **any source or documentation change**; old evidence then needs review/rebinding.

### Offline inventory/media comparison

After approval, obtain an authorised **public-column-only** car export into an ignored local file. Do not fetch or paste customer/admin/audit/secret data for this comparison. The tool accepts a JSON array, not a SQL dump, with at most 5000 records / 10 MiB:

```sh
npm run inventory:reconcile -- --input .local/release/public-cars.json
```

Fields compared: `id` identity; `year`, `make`, `model`, `variant`, `km`, `fuel`, `transmission`, `body`, `price_lakh`, `price_note`, `reg`, `location`, `highlights`, `overview`, `listing_url`, `sort_order`, `featured`, `photo_stock`, `photos_gallery`. `status` must be a recognised stored status and is reported separately, not compared to an assumed legacy availability. Prices compare as exact rupees; leading `/assets/` and `assets/` local references are equivalent. Ordered lists remain ordered. No arbitrary remote URL/path rewriting or guessing of missing facts occurs.

- Exit `0`: projection matches legacy and all expected local legacy images exist. **This does not confirm availability, media on the provider or correctness of newer business records.**
- Exit `1`: missing/duplicate/extra rows, field differences, unrecognised status or missing local images require review. Legitimate post-snapshot edits should not be overwritten just to turn the report green.
- Exit `2`: invalid/inaccessible/oversized input. The output is replaced with an explicit failed report to avoid reusing an old success.
- Output `.generated/inventory-reconciliation.json` contains IDs/field names, whitelisted status, hashes and local source asset paths, not supplied free-text values or unselected private fields. Treat even record identifiers as restricted operational evidence under the approved policy.
- `availabilityConfirmed` remains **false in every result**. The local media hashes cover 15 cover + 30 gallery files, not actual downloaded Supabase objects. Replaced approved photos can legitimately differ. Byte availability/privacy/restoration and current stock require the separate real environment checklist.

No actual selected-project export/reconciliation was performed. Unit/CLI success uses synthetic projections of the legacy snapshot. The existing dry run still validates 15 records and 10 unknown transmissions without remote writes. A safe idempotent real importer remains a separately reviewed task; this comparator is not one.

### Release evidence checker

Keep real evidence out of Git. In a private approved workspace, create `.local/release/evidence.json` from `docs/release-evidence.example.json`, which intentionally starts with all gates pending. Each gate needs a redacted artifact under `.local/release/`, its exact SHA-256, an accountable `reviewedBy` and UTC `reviewedAt` within 30 days. Artifacts are capped at 2 MiB; evidence input at 1 MiB. Paths cannot traverse out of the local evidence directory (including symlink escape). Do not include backup bytes, passwords, connection strings, tokens, QR codes or customer payloads in evidence artifacts.

Set `releaseDigest` from the **final candidate** manifest and retain `projectRef` for the selected project `vxlxoiycolfojcnhnzfr`. Reviews from a different release/project, missing/tampered artifacts, pending/malformed/stale reviews or unsafe/missing runtime configuration all block. The private artifacts must actually support these conclusions:

| Gate | Required real evidence | Current state |
| --- | --- | --- |
| `backup_restore` | Database + media + settings/Auth/config scope, actual isolated restore, reconciliation and measured approved RPO/RTO | Pending |
| `real_supabase_security` | Approved drift/migration review and real Auth/JWT/PostgREST/Storage/RLS/anonymous/staff/manager/owner checks | Pending |
| `native_concurrency` | Independent native sessions for stale edits, schedule/assignment/status races, intake idempotency and timeout-after-commit/restart reconciliation | Pending |
| `import_reconciliation` | Actual 15-ID/price/null/order/media comparison plus approved legitimate differences and dealership-confirmed current availability | Pending |
| `staff_acceptance` | Real invited-role end-to-end journeys, negative permissions, keyboard/screen reader, non-Chromium/mobile/zoom checks and retests | Pending |
| `privacy_retention` | Owner-approved notices/legal/retention/removal/contact procedures, actual services/hours/prices, manual lead-review staffing and deferred-feature scope decisions | Pending |
| `deployment_tls` | Approved hosting/domain/TLS/Auth redirects, target build, secret isolation, edge/WAF/rate/cache/Origin/network-header tests, full CSP/framing/HSTS decision | Pending |
| `monitoring_recovery` | Named on-call/alternate, alert delivery test, redacted logging, incident/rollback rehearsal and repeat-backup responsibility | Pending |
| `launch_approval` | Explicit accountable approval for this candidate, cutover window, scope/risks, all critical findings closed and rollback decision | Pending |

Run with configuration securely injected by the target hosting/CI secret manager, never secret values as command arguments:

```sh
npm run release:check -- --evidence .local/release/evidence.json
```

This CLI reads **process environment only**, not Next `.env.local` automatically. For the full planned launch scope it expects live inventory and enabled intake, an HTTPS non-preview domain, the selected consistent public/staff project origins, anonymous/publishable browser keys, server-only invitation/media/intake credentials and stable intake hashing secret. It rejects obvious public-secret exposure, test TLS overrides and unsupported trusted-network headers. It checks shape/consistency, **not** actual credential validity, domain ownership, random-secret entropy, provider plans or ingress behaviour; those need the real gates. No values/token claims/arbitrary input text are printed.

Exit `1` / report decision `BLOCKED` is intentional until all gates/configuration are reviewed. Exit `2` indicates invalid CLI usage. Only a fully reviewed evidence set plus valid configuration returns exit `0` / `REVIEWED_CANDIDATE`. Output is `.generated/release-readiness.json`; `passed` combines evidence and runtime checks. Neither the checker nor arbitrary `status: passed` text authenticates the reviewer, independently certifies artifacts, enforces hosting deployment policy, signs the candidate, applies migrations or authorises deployment. Keep approver identity/access controls in the real release process. The repository has no auto-deploy job.

## Local verification and limits

Recorded full-suite verification: **24 unit tests, 34 integration results (32 PostgreSQL/grouped results and two offline CLI scenarios), 27 browser tests passed**, production build/typecheck/lint passed, zero reported production dependency vulnerabilities. Dry run: 15 cars / 10 unknown transmissions / no remote writes. Details are recorded at the end of `plan.md`. Core commands cover TypeScript/lint, unit tests, isolated PostgreSQL permission/workflow tests, CLI negative tests, production build and browser regression/security/accessibility checks. The 111-file protected legacy baseline remains intact. Automated axe checks have no reported A/AA-tagged violations in the tested states; this is **not** comprehensive WCAG certification or a replacement for manual assistive-technology testing. Existing 88 public route/viewport renders and prior photo/inventory/business journeys remain in the browser suite.

The local Auth/PostgREST/Storage fixture uses synthetic unsigned tokens and serial isolated PGlite SQL. It must never be deployed or used with real data. It does not prove actual provider JWT verification, hosted durability, multi-session native PostgreSQL behaviour, remote media restoration, SMTP/MFA delivery or launch readiness. These limitations are represented by pending gates, not hidden by a green test suite.

Next steps are [the operations/recovery runbook](operations-runbook.md) and [the real staff acceptance sheet](staff-acceptance.md), beginning with verified restorable backups and the required approvals. The live preview remains in labelled snapshot mode with online intake disabled. **Phase 6 launch exit condition remains open.**
