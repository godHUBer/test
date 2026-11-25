# Phase 2 — authentication and database security

## Status and execution boundary

**Local implementation and verification are complete for the scope below. The user approved the compatibility strategy on 24 November 2026, but confirmed backups are not verified. Remote migration remains blocked on backup/recovery readiness and configuration. Phase 2 is not yet complete end to end.** No migration in this repository has been applied to the connected project. No API keys, passwords, account/customer records, or photo files were retrieved; no users were invited or remote Auth settings changed. The local website deliberately accepts no credentials until configured.

The selected non-production project is `sohan-automobile` (`vxlxoiycolfojcnhnzfr`, `ap-south-1`). A read-only catalogue review confirms it is not empty. The existing six migrations are prerequisites, not scripts to replay. The new migration is an upgrade, **not** a fresh-project bootstrap.

## Read-only review findings

- Existing tables: `admin_profiles`, `cars`, `brand_settings`, `activity_log`; all have RLS enabled.
- `is_admin()` currently trusts `owner`/`editor` without active-account or MFA checks; `is_owner()` checks the role alone.
- `handle_new_admin()` creates a pending profile after an Auth user is inserted. Keep it: invitations/signups must not auto-grant staff permissions.
- All four existing tables have broad grants to `anon` and `authenticated`, including `TRUNCATE`. RLS does not protect truncation; grants must be restricted explicitly. This was observed through metadata only—no destructive exploit was attempted.
- `record_auth_event(action,email)` is callable by browser roles and accepts caller-supplied email and request-header IPs. Its records are not trustworthy authentication evidence. The new application does not call it; the upgrade revokes browser execution. Use Supabase Auth's trusted logs for actual sign-in events.
- `log_activity()` currently records differences across most row fields, actor email and request headers. The new implementation uses an allowlist, server actor identity and no copied emails or client-header identity. Historical entries remain unchanged and should be covered by the future retention review.
- Existing audit/update triggers and nine public indexes were observed. The role-administration guard and stock-event register are new.
- The `car-photos` bucket is public with no file-size or MIME restrictions. The upgrade preserves its current files/public read behaviour, restricts metadata for future uploads, and disables browser writes until a reviewed publishing workflow exists. It does **not** make existing public image URLs private.
- Actual Auth signup/MFA/email/redirect/rate-limit settings have not been verified. Do not assume they are correct based on the database metadata review.

## Compatibility strategy requiring approval

Upgrade the existing tables in place using `supabase/migrations/20261124180000_harden_existing_admin_security.sql`:

1. Preserve all existing car IDs, numeric lakh prices, photos, settings, account rows, statuses and historical audit entries. No seed/import is executed remotely.
2. Add profile `is_active`; allow owner/manager/staff roles alongside legacy editor/pending values. Editors/pending retain their stored value but gain **no** new staff capability. An owner explicitly assigns replacements; no implicit promotion occurs.
3. Preserve `hidden` distinctly; add draft/archived states, use draft only as the default for future vehicles, and add an optimistic version field. Do not assume hidden means sold or draft.
4. Restrict browser table/sequence grants; replace known policies. Unknown policy drift aborts the migration rather than silently retaining a potentially permissive policy. Future tables/sequences created by the migration role no longer inherit browser grants automatically.
5. Require MFA for owner/manager capabilities at both application and database boundaries. Owner account changes additionally require TOTP within ten minutes, checked against trusted token claims in both layers.
6. Make role changes possible only through an owner RPC, with a mutex tuple update and last-active-owner trigger. Concurrent changes serialize or abort for retry; higher-isolation stale snapshots must not bypass the guard.
7. Disable casual hard deletion. Staff edit drafts only; publishing/status changes use a manager/owner RPC with a reason and expected version. Add transactional stock-entry/status events and redacted audit changes. A failed audit insert rolls back the business write.
8. Add a private `car-drafts` bucket. Draft media paths are scoped to the uploader's Auth ID; managers/owners can review. No browser upsert/update, public publishing endpoint, or actual uploader is implemented yet. Decoded-byte validation and EXIF stripping remain mandatory with Phase 4 upload implementation; MIME metadata alone is insufficient.
9. Expose `admin_security_version()` as a contract marker. Missing/wrong version or unavailable profile checks block the new admin application.

### Intentional restrictions / compatibility effects

- Existing editor-based admin clients will lose operational write permissions after activation. Existing public cars/settings reads remain supported, including sold detail records; active inventory must explicitly filter statuses in Phase 3.
- Owners/managers need TOTP before RLS permits privileged operations. No exception is made just because a UI button is hidden.
- A trusted database operator must bootstrap the initial owner if none exists; the application never creates a default owner/password. If the project already has owners, verify identities before changing anything.
- Existing `car-photos` browser upload/delete operations will stop working; this repository's Phase 1 site did not use them.
- Direct deletion of the final owner's Auth account can be blocked by the profile FK cascade trigger. Establish a second verified owner before removing an owner. Recovery/break-glass actions require identity verification and trusted operator access, not a public bypass.
- The existing numeric `price_lakh` is exact PostgreSQL numeric. Do not describe it as floating point or bulk-convert it without comparing existing data. Dry-run tooling reports exact rupee equivalents only.
- Version checks are enforced by the status RPC. Future general edit endpoints must also include the expected version in their update condition; raw draft UPDATE grants alone do not establish optimistic concurrency for every field.

## Application implementation

- Request-scoped Supabase SSR client with secure, HTTP-only, same-site cookies. No browser client holds a privileged key.
- Next.js `proxy.ts` refreshes/verifies staff/auth sessions and sends private/no-store, no-referrer and noindex headers. The proxy is not the sole authorisation check.
- Protected staff pages/actions independently call `getUser()`, require the security contract marker, read current database roles/active status, and check MFA. Database RLS independently enforces writes. No browser storage or editable user metadata is trusted for roles.
- Login, password-reset request, password setup, TOTP enrolment/verification, unfinished-enrolment removal, sign-out, owner role assignment and owner invitations are implemented. Pending/inactive/legacy-editor accounts cannot enter the workspace.
- Invitations are an isolated privileged operation: recent owner MFA first, validated email, then an Admin Auth client using a server-only secret. Invitations create pending accounts; role assignment is separate. No invitations have been sent during development.
- Public registration is not implemented. Disable public signup in provider settings before activation; the pending-profile trigger still prevents signup from becoming staff access.
- Recovery messages are account-enumeration resistant and do not claim an email was delivered. Password setup validates 12–128 characters and confirmation, enforces existing MFA where applicable, and attempts global sign-out; revocation failure is reported rather than presented as success.
- Staff deactivation immediately denies business access through fresh role checks/RLS even if an Auth token has not expired. It does not claim to invalidate every Auth token; verify provider revocation/session controls separately.
- `/admin/confirm` presents an explicit confirmation button; `/auth/confirm` consumes invite/recovery hashes only by same-origin POST. GET does not consume a hash. PKCE reset callbacks go to `/auth/callback`; return destinations are fixed, not caller-controlled URLs.
- TOTP QR codes are sensitive, rendered only to an authenticated staff session after intentional enrolment. They are not written to logs/files or analytics. Lost verified-factor recovery is a trusted operational process, not a public unenrolment button.
- Public legal copy now distinguishes essential staff-session cookies from analytics and customer enquiry storage. Legacy source files remain untouched; full owner-approved privacy/retention terms still gate launch/persistent forms.

## Local setup and tests

```sh
npm ci
npm run check              # baseline, TS, lint, unit + actual PostgreSQL RLS tests
npm run inventory:dry-run   # validates 15 source cars; writes ignored report only
npm run build
npm run test:e2e            # production server automatically started on :3100
```

Database tests use PGlite, an isolated PostgreSQL WASM engine with real roles, RLS and PL/pgSQL. `supabase/tests/legacy-fixture.sql` is a **local-only synthetic baseline**, not the remote migration history or a database backup. It reproduces the observed table/policy shape without customer data. No Docker or database credentials are required.

Tests exercise anonymous direct SQL denial, forbidden audit truncation/forgery, pending/editor denial, owner/manager MFA, staff draft-only writes, manager status reasons/versioning, owner protections, immediate deactivation, actor attribution, audit rollback and draft-storage metadata policies. They do not substitute for actual Supabase Auth, PostgREST or Storage HTTP tests, byte processing, or multi-connection concurrency tests.

The inventory dry run reads the existing JSON and checks IDs, number ranges, exact price conversion and stock photographs. It preserves unknown transmissions/provenance and proposes staging for review. It does not compare or overwrite existing remote car rows. Output stays in `.generated/inventory-dry-run.json` and contains no credentials.

### Configuration (after approval and migration)

Use ignored local environment files or a hosting secret manager, never Git or chat:

- `SITE_URL`: the exact approved HTTPS origin, with no path/query. Used for fixed callback destinations; arbitrary request headers are never used as a fallback.
- `NEXT_PUBLIC_SUPABASE_URL`: selected project's HTTPS URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: publishable/legacy anon key only. Configuration rejects a service-role JWT or `sb_secret_` key in this slot.
- `SUPABASE_SECRET_KEY`: optional server-only key, isolated to invitations. Omit to disable invitations. Never prefix this variable with `NEXT_PUBLIC_`.

No key was fetched and no connection configured for this preview. The runtime needs network access to the selected Supabase API; this sandbox's restricted outbound hosts do not establish that access. Real integration must be verified in an authorised environment with the needed network access.

## Remote activation checklist — not executed

1. Approve the compatibility effects above and confirm no other application depends on current editor permissions/public photo writes.
2. Confirm a restorable backup of existing data **and** a separate media backup/snapshot plus current Auth/bucket settings; keep private backups out of Git. This work has not created or tested a remote backup. Verify plan-dependent recovery availability before relying on Supabase backups. Since no file bytes are changed, policy rollback does not require rewriting media, but a verified media recovery plan still matters.
3. Re-read migration history/policies/constraints for drift. Inspect account-role counts and initial-owner identity through authorised administration; never invent account IDs or promote all editors.
4. Rehearse on an isolated copy with the actual schema, provider policies and synthetic accounts. Do not create test identities in the selected project without permission.
5. Apply the reviewed upgrade in one transaction via the migration mechanism; record its actual returned version. Do not replay the six prior migrations or reset/drop tables. Failed application must roll back entirely.
6. Disable public signup; confirm email login, secure refresh-token rotation, provider rate limits/bot protections, MFA availability/enforcement and an approved SMTP sender. These settings have not been read/changed here. Add infrastructure-backed abuse throttling if native provider controls are insufficient; an in-memory counter is not a distributed security control.
7. Set the provider Site URL to the approved origin and narrowly allow the app's callback/confirmation destinations. Do not use unrestricted wildcard production redirect URLs.
8. Configure invitation/recovery email templates for the explicit confirmation page, e.g. `{{ .SiteURL }}/admin/confirm?token_hash={{ .TokenHash }}&type=invite` (or `type=recovery`). Do not add `signup` to the accepted confirmation types. The PKCE callback is also available for reset flows initiated from the same browser.
9. Configure application environment through a trusted channel; bootstrap/select the first verified owner. Test invitation acceptance and pending-role behaviour before assigning permissions, then enrol/verify owner MFA.
10. Verify actual HTTP/API and session behaviour with anonymous, pending, editor, inactive, staff, manager/owner AAL1 and AAL2 identities: RLS, forged role metadata, audit writes/truncation, storage access, cookie flags, cross-origin action/confirmation denial, expired links and stale tokens. Run two-connection concurrent owner-demotion tests at READ COMMITTED and REPEATABLE READ; test serialization-error handling.
11. Exercise provider email throttling, TOTP replay/rate limits, QR secrecy, password reset and session revocation. Verify proxy/headers under the real HTTPS preview/deployment origin, not only localhost.
12. Record evidence and owner acceptance. Only then mark Phase 2 remotely activated; inventory CRUD and persistent enquiries remain later phases.

### Rollback / incident handling

Do not respond to an activation failure by restoring insecure broad grants. Stop staff mutations, preserve new audit/stock events and return the app to its fail-closed preview state by removing auth configuration if needed. If the migration fails, its transaction must leave existing objects untouched. If a committed upgrade needs reversal, use the verified backup/schema snapshot and a separately reviewed forward fix or rollback, maintaining last-owner access and security. Do not delete new event tables or discard post-activation records casually.

## Current backup gate — owner confirmation pending

The strategy is approved, but the user selected **“Not verified yet”** for backups. No remote migration will be applied until this gate is satisfied.

To establish readiness through trusted project administration (not by posting secrets or database exports in chat):

1. Identify an available, supported backup/export method for this project's actual Supabase plan. Confirm which database schemas, constraints, policies, grants, account/profile data and migration history it captures. A source-code snapshot or the local synthetic fixture is not a database backup.
2. Separately preserve the `car-photos` object bytes and a manifest of paths/counts. Database backups do not by themselves preserve Storage object bytes. Record bucket visibility, allowed types/limits and current policies, plus the relevant Auth/redirect/email/MFA settings; keep any sensitive configuration in protected storage.
3. Store encrypted backups outside this repository and outside this temporary sandbox, with access limited to authorised operators. Verify export completion and checksums. Ignored `backups/` or `.local/` paths prevent accidental Git inclusion but do not make an export persistent or secure on their own.
4. Rehearse a restore into an authorised isolated environment without modifying the selected project. Prevent restored systems from sending real customer/staff email. Compare car/status counts and exact prices, account-role counts and media completeness; confirm schema/policies/grants can be recovered. Record the restore outcome, not merely that an export file exists.
5. Record backup time, responsible operator, protected backup location reference, restore test time/result and any recovery gaps. Do not include passwords, service keys, staff/customer exports or private object contents in this document/chat.
6. Recheck database drift immediately before the later approved migration and preserve any records added since the backup. A stale backup is not enough if it would discard later entries.

No automatic backup, data download, restore rehearsal or destructive security probe was performed as part of the read-only metadata review. Once recovery readiness is confirmed, the remaining HTTPS origin, provider settings, first-owner identity and real integration tests still need completion before Phase 2 can be called live.
