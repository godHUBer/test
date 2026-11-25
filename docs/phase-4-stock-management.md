# Phase 4 — staff stock and photograph management

## Status / safety boundary

Core stock-management code, the workflow upgrade, and local end-to-end tests are implemented. **No selected-project migration, invitation, account change, upload, data import, credential retrieval or deployment was performed.** The user's compatibility approval remains recorded; their **“backups not verified yet”** answer still blocks remote activation. Core local tests are not a substitute for real Supabase verification and dealership staff acceptance.

The public preview remains a labelled snapshot. `/admin/inventory`, its nested editor/preview routes, and `/admin/logs` fail closed without staff configuration and both schema contracts. No test identity/session is available on the main preview. Test infrastructure runs separately with entirely synthetic records/tokens.

## Staff workflow

1. Open Inventory from the staff workspace. Current status counts are computed by the authorised database, never invented operational or revenue totals.
2. Create a draft with a permanent lowercase/hyphenated ID. ID is also the public URL identifier and cannot be edited. Existing IDs/URLs, numeric lakh prices, photo references, statuses and history are preserved by the migration.
3. Edit specifications, exact asking price, original source link, bounded plain-text overview/highlights, unknown transmission, display order and (manager only) featured selection. No rich HTML or arbitrary photo-path fields are accepted from a form.
4. Upload an authorised photograph privately. Pending state is shown while processing; a successful upload must be reloaded before review/selection. No filename, EXIF or location metadata is retained in the processed image.
5. A manager/owner with MFA reviews the short-lived private preview and explicitly approves making each image public. **This makes the approved photo public even while the vehicle remains a draft.** That is a separate consent action, not accidental draft publication. Public bytes/caches cannot reliably be recalled.
6. Choose approved photos, reorder them with the earlier/later buttons and save. The first selected photo is the cover. For drafts, ready private selections can be previewed without populating public image paths; public stock requires published selections. Saving selection deliberately replaces prior legacy references; ordinary specification edits never do.
7. Preview the record through the staff-only route. It is not a public availability claim and does not include the private operational note.
8. A manager/owner publishes a complete vehicle, reserves it, marks it sold, withdraws it to archive or restores an archived/hidden record to draft. Every transition has an expected version, reason and UI confirmation. Sold-to-available is an explicit logged correction. Restoring never silently republishes.
9. Public inventory/home selections/dropdowns read current available records on subsequent requests in live mode; reserved/sold details remain labelled unavailable, sold keeps its last asking price and archive is not public. Existing open browser tabs are not realtime-synchronised.
10. Review the stock register and permitted audit entries. Private operational notes are stored separately from public cars and their contents are not duplicated into audit differences. No acquisition cost, buyer contact or realised sale price is inferred or stored by this phase.

### Permissions

| Capability | Staff | Manager / owner with MFA |
|---|---|---|
| Read inventory and stock register | Yes | Yes |
| Create a vehicle | Draft only | Draft only |
| Edit specifications / private note | Drafts only | All statuses |
| Upload private photos | Drafts only | All statuses |
| Preview photo assets | Own uploads | All registered uploads |
| Approve photos for public use | No | Yes, explicit consent |
| Change selected cover/gallery | Own ready/published assets, draft only | Valid registered ready/published assets; public stock requires published |
| Publish/reserve/sell/archive/restore/feature | No | Yes |
| Read audit | Own car actions via RLS | Operational car actions; owners retain broader existing access |
| Hard-delete/purge data or published files | No | Not a routine app action |

Roles and MFA are checked afresh in server actions and independently in RPCs/RLS. Pending, legacy editor, inactive and owner/manager AAL1 sessions cannot write. The manager upload authority is not an invitation/account authority.

## Database upgrade and concurrency

`supabase/migrations/20261124210000_staff_inventory_workflow.sql` is a **second, local-only upgrade** after the six existing migrations and Phase 2's hardening upgrade. Apply transactionally only after the backup/drift/approval gates. It is not a standalone schema bootstrap.

- Adds `cars.media_order`, a protected `vehicle_media` registry, private operational-note table and feature-selection mutex. Existing records/media paths are not imported, reset or mass-rewritten.
- Revokes direct authenticated INSERT/UPDATE/DELETE on `cars`; creation/edits use whitelisted `save_vehicle`, statuses use `set_car_status`, photos use `set_vehicle_photos`, and notes use `save_vehicle_note`. This supersedes Phase 2's direct draft-edit grants and closes raw-client optimistic-concurrency bypasses.
- RPCs have fixed empty `search_path`, explicit grants, fresh active/MFA capability checks, bounded inputs and row locks. Supplied expected version must match; another editor receives SQLSTATE `40001`, not a silent overwrite.
- Creating the same permanent ID twice is rejected by the primary key; it does not create another stock entry. Existing immutable IDs are not converted to UUIDs.
- Selecting a featured vehicle clears previously featured rows under a serialising mutex. This also versions/audits those automatic changes, so an older editor of a previous featured vehicle must reload. Legacy multiple flags are not mass-rewritten on migration; the first explicit feature choice reconciles them. Phase 3 retains a deterministic display fallback when no flag is selected.
- Archive/restore/sale reversal uses the existing allowed transition graph. Reserving also clears featured status. A new vehicle cannot publish without a cover path and bounded core specifications; newly uploaded covers can only come from the approved registry workflow. Existing public cover references remain grandfathered and require staff review during actual reconciliation.
- No hard deletion or fabricated historical arrival dates. Stock events record database entry/status actor/time/reason; a stock entry is not proof of the physical arrival date.
- Specification/status/note/photo-selection changes and their audit entries commit transactionally. Audit failure rolls back the business change. Photo-selection audit records counts/cover-change flags; note audit records that a note changed, not its content.
- Registry lifecycle logs attribute direct staff operations to `auth.uid()`. Service completion uses the previously authorised uploader or publication approver; it does not pretend a service token is a staff session.
- Application-only data fields stay in the protected registry/note tables. Public reads still project the Phase 3 allowlist without private notes, file-management paths, upload state or costs.
- The separate `inventory_workflow_version() = 4` marker gates all stock screens/actions. Phase 2's identity/MFA contract marker stays at 2.

The isolated engine executes row-locking SQL but does not provide real multi-session stress evidence. Deadlocks/serialization failures must be treated as conflicts requiring reload. Rehearse concurrent stock edits, photo selection/removal/publication, feature selection and deactivation in an actual isolated Supabase/PostgreSQL environment before activation.

## Photograph processing / credential isolation

- `sharp` decodes the actual image, accepts only still JPEG/PNG/WebP, rejects animated/multipage/executable/SVG/HTML inputs, limits the input to 5 MiB and 24 million decoded pixels, and requires at least 320×240 px. Orientation is applied and the image is resized inside 2400×2400, then re-encoded to WebP without metadata. Processed output is rechecked.
- Original filenames/bytes are not persisted by the app. Object names are unpredictable UUIDs in the uploader's namespace; browser MIME types/extensions are not trusted. Public copies are re-decoded/re-encoded as defence in depth.
- Phase 4 removes Phase 2's direct browser insert/delete draft-object policies. Only the isolated server broker writes processed bytes; direct SDK uploads cannot bypass decoding via a permissive private bucket policy. Public bucket writes remain unavailable to ordinary browser roles.
- Browser roles can reserve an upload only for an editable/version-matched car. Reservations are limited to 20 active registry entries per vehicle and 10 new reservations per uploader per five minutes, with an advisory transaction lock for concurrent reservation counting. This is **not** a replacement for infrastructure/request limits: the processor still needs deployment-level abuse/resource controls before launch.
- Completion RPCs are executable only by `service_role`, not authenticated/anonymous clients. Upload completion checks bounds/state/freshness and active uploader role. Publication completion requires a recent approved request and a still-active manager/owner.
- Routine car reads/writes use the request-scoped staff client. `MEDIA_STORAGE_SECRET_KEY` is a separate, optional server-only broker credential used for Storage I/O, signed previews and narrowly named completion RPCs. It is never used for ordinary car CRUD, never sent to the browser and never reused silently from the invitation credential.
- Supabase's service credential is inherently broad; the code's narrow use is not a claim that the provider key itself is database-scoped. Secure it in the deployment secret manager, limit server access, rotate after exposure, and prefer a suitably isolated processing service if stronger credential isolation is required.
- Private preview URLs are signed for 60 seconds only after a role-authorised registry SELECT; the server never signs arbitrary caller-supplied paths. They remain bearer links until expiry and cannot promise instant revocation if a role changes mid-window. Staff/auth pages are no-store/noindex/no-referrer.
- Missing broker configuration disables upload/publication/signing, not authorised specification/status editing. Missing auth/workflow configuration blocks all editor mutations.

```dotenv
# Only provision after backup/security gates, using the approved project's secrets.
# Never paste credentials in Git or chat.
MEDIA_STORAGE_SECRET_KEY=
```

Next Server Actions use a bounded 7 MiB multipart request envelope, with a stricter 5 MiB image limit in the decoder. Mutations retain Next's same-origin protections; no broad `allowedOrigins` bypass was added. Verify the final reverse proxy forwards the correct host/origin. Do not solve deployment-origin failures by allowing arbitrary sites.

## Failure handling, cleanup and retention

Storage and PostgreSQL are **not** one transaction. Registry states are `pending → ready → publishing → published`; unused entries can be marked `removed`. Selected photos must be deselected and saved first. Removal asks for explicit confirmation, does not hard-delete the vehicle, and never purges public caches/history.

- A failed or ambiguous upload is not claimed as success. The broker attempts private-byte cleanup only after an authorised read confirms the metadata is still pending; it will not delete a known committed ready asset on a lost response.
- A failed/ambiguous publication warns that public exposure may have occurred. If state is confirmed `publishing`, the broker attempts cleanup of the newly allocated public path. It does not remove a known committed publication, overwrite an existing public object or retry blindly.
- Interrupted reservations may remain for reconciliation. Expired pending rows can be removed from the library; in-flight publication removal is blocked so an operator can investigate. Removing a registry entry retains the processed bytes pending an owner-approved retention/reconciliation process.
- No scheduled orphan purge, automated stuck-publication recovery or deletion of old public assets is enabled. This is intentional until real Storage semantics, recovery and retention are verified.

### Reviewed operator reconciliation procedure (not executed remotely)

1. Preserve the backup and relevant safe audit/registry state. Disable further writes to the affected asset/vehicle while reviewing; do not bulk-delete a bucket or drop metadata.
2. Using trusted administration, compare registry ID/state/path to actual private/public object existence and verify there are no selected/public vehicle references. Never export signed URLs, file bytes or staff data to chat/Git.
3. For ambiguous completion, establish whether the metadata transaction committed before touching bytes. `ready`/`published` means keep the committed asset unless an independently approved retirement plan says otherwise.
4. For abandoned `pending`, confirm no worker/request is still active. Remove only the exact unreferenced private object, then retire the metadata through an authorised path, recording the maintenance actor/action.
5. For expired `publishing`, confirm approver consent/status, worker termination and public exposure. Either clean up the exact unreferenced public copy and return the registry to a reviewed retryable state, or complete publication after renewed approval. No unreviewed RPC is exposed for this break-glass repair; use a separately reviewed, recorded maintenance transaction.
6. Never purge public bytes merely because a vehicle sold or was archived. Old detail URLs/caches may still reference them. Apply an owner-approved retention policy and test rollback before physical deletion.

## Screens and safe failure behaviour

- `/admin`: verified stock counts plus access/security links; no invented leads, bookings, service or revenue totals.
- `/admin/inventory`: searchable/paginated status-filtered stock table, exact asking prices, permanent IDs and versions.
- `/admin/inventory/new`: create draft.
- `/admin/inventory/[id]`: specification, lifecycle, photograph, private-note and per-vehicle stock history controls.
- `/admin/inventory/[id]/preview`: staff-only preview, no private note, no public-indexable offer.
- `/admin/logs`: bounded recent history filtered by vehicle, actor, action and Kolkata-local date range. Times display in Asia/Kolkata; database timestamps remain UTC.

Controlled inputs retain unsaved specification/note/status-reason values after recoverable errors. A successful mutation explicitly asks for a document reload before another write. Pending controls prevent casual duplicate submits; stale versions/IDs are still enforced in the database. File inputs cannot be programmatically restored after a failed upload—reselect the file and review pending state before retrying.

Historical audit rows are preserved, but UI differences are allowlisted/redacted rather than redisplaying raw historical notes, email/IP or arbitrary media URLs. Logs show at most the latest 50 matching entries and are labelled accordingly; this is not a complete external immutable ledger. A full owner-authorised CSV export/download, background retention/purge, customised public image alt-text editor and upload percentage telemetry remain follow-up hardening work; no unsupported export/progress capability is presented as finished. Image alt text currently derives from the vehicle and view number; no fabricated scene descriptions are generated.

## Tests and evidence boundaries

```sh
npm ci
npm run check
npm run build
npm run test:e2e
npm audit --omit=dev
```

- New PostgreSQL suite applies both local upgrades to the catalogue-derived synthetic baseline and exercises RPC-only drafts/edits, exact prices, stale conflict/duplicate IDs, forbidden field/path writes, MFA, actual storage-policy denial, service-only completion, photo selection/publication, sold/reserve/reversal/archive/restore, actor/history preservation, private-note isolation/redaction, feature switching, audit rollback and deactivation.
- Image unit tests verify actual decoded formats, metadata removal, wrong-format/HTML/SVG rejection, small/oversized images and safe output. They do not certify an independent malware scan for documents; document uploads are not supported.
- A separate local TLS fixture emulates limited Auth/Storage/PostgREST transport while executing the real SQL/RPC/RLS against PGlite. Synthetic tokens are deliberately not signed production tokens; the fixture never claims to verify a real Supabase identity provider. Storage bytes live in memory for the test only.
- Browser tests exercise the actual Next staff pages/server actions: staff draft/edit/upload, manager photo approval and selection, publish/reserve/sell/reverse/archive/restore, private preview/note isolation, stock history, stale-editor input preservation, inactive/pending/AAL1 denial, and cross-origin Server Action rejection. A small-screen editor check supplements the existing public viewport suite.
- Existing public regressions and the earlier security suite remain in the checks. Local same-origin and file-processing success do not establish real SMTP/MFA provider, PostgREST version/caching or Storage HTTP/cleanup behaviour.

## Remaining activation / acceptance gates

The user's verified-backup gate remains first. Then recheck actual schema/policy drift and review **both** upgrade migrations together; Phase 4 deliberately tightens Phase 2's direct car/draft-storage write policies. Obtain approval of these new compatibility effects before applying remotely. Confirm the first owner, Auth/MFA/HTTPS setup, secure runtime/broker secrets and actual public record/media reconciliation. Rehearse on an isolated real Supabase project with test identities and failure injection, including concurrent writes and ambiguous Storage responses. Verify current native image dependency/platform support and deployment resource limits. Only then can real invited staff perform acceptance and Phase 4 be called remotely operational.

### Recorded local verification at delivery

Type-checking, lint and production build passed. Unit suite: **18 passed**. PostgreSQL suite: **22 reported results passed**, including the two grouped parent results (ten new workflow scenarios, nine existing security scenarios and a drift-abort case). Browser suite: **19 passed**, preserving 88 public route/viewport renders plus the synthetic admin workflow, stale/CSRF/role checks and public data scenarios. The reservation-limit/deactivated-completion scenario was rerun after the full browser suite and passed. `npm audit --omit=dev` reported zero production vulnerabilities. The deliberately rejected cross-origin action and stale update produce expected negative-test diagnostics. None of these results certify the selected remote project's configuration or production readiness.
