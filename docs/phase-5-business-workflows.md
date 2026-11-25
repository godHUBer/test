# Phase 5 — enquiries, appointments, service requests and business settings

**Status: core workflow implemented and tested locally; not activated on the selected Supabase project.** The recorded backup/recovery gate is still unresolved. No credentials were retrieved, migrations applied, customer records written, staff invited or remote files uploaded for this phase. The main preview remains an unverified snapshot, not live stock or an operational intake service.

## What is available

| Area | Behaviour |
| --- | --- |
| `/contact` | Configured online general/car/viewing/finance/insurance requests; otherwise the existing explicit compose-email form. |
| `/cars/[slug]` | Available-car enquiry/viewing/finance/insurance requests tied to the permanent stock ID; sold/reserved details do not present an enquiry form. Availability is rechecked inside intake/confirmation transactions. |
| `/sell-your-car` | Sell/exchange requests with private make/model/year/odometer/ownership/insurance/location details. Optional unknown facts may stay blank. No automatic valuation, stock creation or seller-document upload. |
| `/services` | Published service catalogue and requests for a **customer-owned vehicle**, independent of sale stock. In snapshot/unavailable mode the page explicitly asks customers to call instead of inventing catalogue entries. |
| `/admin/business` | Status/type-filtered, paginated queue (20/page), permission-scoped totals, unassigned requests and follow-up dates. No customer-facing lookup endpoint exists. |
| `/admin/business/[id]` | Private contact/request/seller context, lead status and assignment, private notes, per-request viewing/service scheduling and recent workflow history. |
| `/admin/services` | Manager/owner creation, publication, ordering and deactivation of requestable services. No destructive deletion of historical services. |
| `/admin/settings` | Versioned manager/owner edits to public name/tagline/contact/address/map/hours and the advertised service-label list. This list is deliberately separate from the requestable service catalogue. |
| `/admin` | Actual stored new/unassigned/overdue-follow-up/upcoming-viewing/open-service counts, scoped by database permissions. No revenue or delivered-notification totals are invented. |

Public appearance/navigation is retained, with a Services destination added. Snapshot mode still composes emails; it does not pretend to persist requests. All earlier vehicle/media workflows remain available behind their original security gates.

## The customer promise

- Validation and consent are required. A stored-reference UUID is displayed **only after** a successful database RPC response with the expected reference shape. The reference is not an appointment confirmation, authentication credential, or public access link.
- The consent notice version is `2026-11-business-v1`; request time/notice version are stored with the request. No marketing subscription is created.
- Public intake creates an unassigned lead; a service request atomically creates its initial `requested` job. A viewing enquiry does **not** automatically create or confirm a timed appointment.
- **Automatic email/SMS/WhatsApp notifications are not enabled.** Staff must check the queue and contact the customer manually. Saving a confirmed appointment changes the database record only; it does not prove the customer was contacted.
- An ambiguous timeout does not produce success. Retry the **same unchanged form** before it expires: an idempotency key plus keyed payload fingerprint returns the original reference without a second lead or rate-limit charge. Changed-content retries with the same key are rejected. Do not reload to obtain a new key after an uncertain write; call the dealership if reconciliation is needed.
- Recoverable errors preserve controlled field values. Successful forms disable additional submission and ask staff to reload. Staff stale versions are rejected instead of silently overwriting another editor.

## Staff permissions and scheduling

Active ordinary staff can see and manage **assigned requests only**, including their private notes, appointments, service jobs and associated events. They cannot assign/reassign leads, alter catalogue/settings, read unassigned contacts, or write workflow tables directly. Managers/owners see the full queue and assign active staff. Their Phase 5 business access requires AAL2 and TOTP verification within ten minutes in both application and database checks; reverify at `/admin/mfa` when prompted. The prior inventory module's assurance rules are unchanged.

Lead states: `new`, `contacted`, `in_progress`, `converted`, `closed`, `spam`. Follow-up dates are private reminders, not a notification scheduler. Closing/converting/spam-marking a lead does not silently cancel its existing bookings: review them explicitly.

Viewing states: `requested → confirmed → completed`, with cancellation from requested/confirmed; cancelled viewings return to requested before confirmation. Creating a completed/cancelled record directly is forbidden. Completed records cannot be rewritten. Completion/cancellation retains the existing recorded times. Cancelling an existing appointment remains possible when its assigned staff member has been deactivated, so managers can reconcile then reassign.

Service states: `requested → scheduled → in_progress → completed`; requested/scheduled/in-progress may be cancelled, and cancelled jobs can return to requested. Completed jobs cannot be rewritten. Completion/cancellation preserves times; rescheduling is an explicit scheduled edit or a reset through requested. No parts, invoices, payments, workshop bays, technicians' shifts, reminders or workshop ERP are implied.

Scheduling rules:

1. Use explicit **Asia/Kolkata** local date/time fields; storage is timestamptz and staff history displays IST.
2. Confirmed/scheduled slots must be future intervals of at most three hours. This bound is a technical basic-scheduling rule, not a published estimate of actual repair duration.
3. Vehicle viewings require available sale stock and an active assigned staff member. Service scheduling requires active assigned staff but not a stock car.
4. Confirmed viewings cannot overlap for the same vehicle or staff member. Scheduled/in-progress service jobs cannot overlap that staff member's confirmed viewing/service slot. Adjacent, non-overlapping intervals are permitted. Requested viewings do not reserve capacity.
5. Version checks apply separately to the lead and appointment/job. A private schedule-guard tuple serialises schedule writes; request/car locks prevent assignment/availability decisions from racing those writes at normal isolation. Higher-isolation serialization failures must be reloaded/reviewed, not blindly retried.
6. Cancel active confirmed/scheduled/in-progress records before reassigning the lead. Marking stock sold/reserved does not silently delete historical appointments; staff must review affected bookings and contact customers. New confirmation for unavailable stock is rejected.

This is per-request basic scheduling with conflict rejection, **not** a consolidated free-slot calendar, recurring timetable, business-hours enforcement, customer self-booking system, or native concurrency certification.

## Database and secret boundaries

`supabase/migrations/20261124233000_business_workflows.sql` depends on both earlier local upgrades and adds contract marker 5. It preserves legacy cars/media/settings/history, adds settings versioning, and **revokes direct authenticated UPDATE of brand settings** in favour of the allowlisted RPC. Review this additional compatibility change before remote application. Existing historical public settings remain public; private customer data goes only into the new protected tables.

New workflow tables enable RLS, grant only authorised SELECT, and deny browser INSERT/UPDATE/DELETE/TRUNCATE. Named security-definer RPCs validate role, active assignment, versions, state and relevant references. The isolated intake RPC is executable only by `service_role`; anonymous visitors have neither customer-table INSERT nor SELECT. The application intentionally brokers this limited public write on the server, not by granting anonymous access to private tables.

- `BUSINESS_INTAKE_ENABLED=true` plus explicit live inventory mode, HTTPS site/project origins, `INTAKE_SECRET_KEY` and a random `INTAKE_HASH_SECRET` of at least 32 characters enable forms. Missing configuration leaves public compose-email alternatives, not fake database success.
- Intake uses a **separate optional server-only broker credential**. It never uses the invitation or media credential by fallback and never exposes it through `NEXT_PUBLIC_*`, component props or public projections. A standard Supabase service credential is still broadly privileged: restrict deployment access, isolate it, rotate appropriately and use a narrower broker role if the hosting/provider setup supports one. Environment separation alone does not turn a service key into a least-privilege database role.
- Staff actions use the user's cookie-authenticated client/RPC/RLS, not the intake service credential. Routine public reads use an anonymous client, not staff cookies or a secret.
- Native Next Server Action same-origin checks remain enabled. Signed per-render form keys/timestamps require at least two seconds and expire after two hours; a honeypot and bounded server validation supplement database-backed rate controls. These are abuse mitigations, not proof of humanity/CAPTCHA.
- Successful intake limits are **100 global, 3 per keyed normalised-contact bucket, and optionally 10 per keyed trusted-network bucket per 15-minute window**. Rejected transactions roll back counters. The keyed hashes do not store raw IP addresses or duplicate contact details in the limiter. Phone-format variations can create separate contact buckets; global and optional trusted-network controls are still needed.
- Network limiting is off unless `INTAKE_TRUSTED_IP_HEADER` is configured as `cf-connecting-ip` or `x-real-ip`. Only enable it when your ingress overwrites that header and prevents direct-origin bypass. Arbitrary `x-forwarded-for` input is not trusted. Invalid/missing configured network headers reject intake rather than bypassing network protection.
- Add verified edge/WAF rate controls and, if required after abuse review, a real provider-verified challenge **before launch**. The application controls alone are not DDoS/bot protection, and the shared 7 MiB Server Action body limit exists for the separate image workflow.

Keep signing/hash configuration stable across replicas and ambiguous retries. Rotation invalidates outstanding form envelopes and alters retry/contact fingerprints; use a deliberate maintenance/reconciliation procedure. Do not paste secrets into chat or commit a populated environment file. `.env.example` contains names only.

## Audit, privacy and retention

Workflow triggers record actor/time and whitelisted status, assignment, follow-up and schedule/reference changes in `business_events`. They never copy contact names, phones, emails, request messages, seller details, customer-owned vehicle descriptions or note text into event diffs. Private notes remain available only inside authorised request access. Audit failure rolls back the associated business write, including intake/request/service-job/receipt creation. Catalogue maintenance records an actor-attributed event in the administrative log; settings changes retain the existing redacted settings trigger audit.

The application does not console-log request payloads or customer PII. **Hosting, proxy, monitoring and provider logs must be reviewed separately** to avoid body capture. All private pages are dynamic/noindex; neither sitemaps nor public inventory payloads contain these records.

The owner must approve the legal basis, privacy notice, retention duration, staff contact procedure and data-subject access/correction/removal process before real intake. There is no automatic customer-record/notes purge, anonymous export, public status lookup or destructive staff delete button. Retention/removal is a separately reviewed owner/operator procedure, including backups and relational/audit obligations; do not promise automatic deletion. Private intake receipts and keyed limiter buckets also need an approved maintenance/retention policy. The notice is explicit about operational retention pending that procedure and gives the dealership contact route; it is not a legal-compliance certification.

## Local evidence

```sh
npm run check
npm run build
npm run test:e2e
npm audit --omit=dev
git diff --check
```

Recorded full verification: **21 unit tests, 32 reported PostgreSQL results, 23 browser tests passed**, production build/typecheck/lint passed, **111 protected legacy files unchanged**, zero reported production dependency vulnerabilities. PostgreSQL count includes grouped parent results, not 32 independent scenarios. Phase 5 adds nine database scenarios and four browser tests. Expected stderr includes deliberate evil-Origin, private-read, stale-version and conflicting-slot rejections.

Tests cover consent/field/context validation, signed form age/expiry, Kolkata conversion, anonymous/direct-write denial, assigned-record RLS, stale versions, inactive/AAL1/expired-TOTP denial, private-note/audit redaction, transactional idempotency, contact/network/global limits, available-stock/active-service validation, cross-workflow conflicts, service lifecycle, audit rollback (including failed intake), settings version/field/role boundaries, and actual Next page/server-action flows for intake→assignment→staff notes, service scheduling/catalogue/settings, and explicit viewing confirmation/conflict rejection. Previous public and inventory/media regressions remain in the full suite, including 88 public route/viewport renders. Browser honeypot rejection proves no success reference and retained user input.

The TLS Auth/PostgREST/Storage fixture is **local test infrastructure only** using synthetic unsigned tokens and an isolated PGlite database. Never deploy it, expose its synthetic sessions, or use it with real data. It is not evidence of real Supabase JWT verification, provider HTTP behaviour, real staff acceptance, durable hosted persistence/restart behaviour, concurrent native PostgreSQL transactions or notification delivery.

## Activation gate — still closed

1. Verify restorable database, media and settings recovery readiness first. The user's earlier answer was **not verified yet**; no later phase request waives that gate.
2. Recheck selected-project schema/policy drift and review all three migrations together, including direct-write revocations and the additional public-service/business data surfaces. Obtain activation approval before remote writes.
3. Rehearse the approved upgrades and rollback/recovery on an isolated real Supabase environment. Configure real Auth/owner/MFA and test actual PostgREST, service credentials, RLS and current legacy record/media mapping.
4. Verify simultaneous intake retries, assignment/schedule/status races, serialization/deadlock handling, real timeout-after-commit reconciliation and restart behaviour with native/provider PostgreSQL sessions. The local serial fixture cannot certify this.
5. Sign off real business contact details, service offerings, privacy/retention policy, staff operating procedure, trusted-proxy/network headers, edge abuse controls and secret/logging isolation. No fabricated hours, prices, appointments or service offering should be published.
6. Have real invited staff accept the complete workflows on that environment. Only then enable real-customer intake and live deployment. Keep the main preview in labelled snapshot mode until these gates pass.
