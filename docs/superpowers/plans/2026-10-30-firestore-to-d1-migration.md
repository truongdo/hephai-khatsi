# Firestore → Cloudflare D1 Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each phase is its own branch/PR and must leave `main` deployable.

**Goal:** Move all application data (org units, invites, members, temples, audit logs, phone indexes, retreats, retreat registrations) from Cloud Firestore to a Cloudflare D1 database bound to the existing Worker, with no change in what users see and no loss of data or audit history.

**Decided (requester, 2026-10-30):** keep login and roles on Firebase, move only the data.

**Out of scope:** Firebase **Auth** stays (custom claims, Google / email sign-in, `set-he-phai-admin.mjs`, Identity Toolkit in `directoryRoleApi.ts`). R2 (photos/documents) and Typesense stay. UI copy and screens do not change.

**Architecture (target):** the browser no longer talks to a database. Every read/write goes to new Worker routes under `/api/data/*`; the Worker verifies the Firebase ID token (staff) or the invite token (filler / retreat self-registration), enforces the authorization that `firebase/firestore.rules` enforces today, and runs SQL on a `DB` D1 binding. Client repositories keep their current `*Store` interfaces (`MemberStore`, `TempleStore`, `RetreatStore`, …) but are re-implemented as thin `fetch` clients, so `use-cases`, `query`, routes and components do not change.

```
before:  routes → query → use-cases → repositories ──Firestore SDK──▶ Firestore (rules = authz)
after:   routes → query → use-cases → repositories ──fetch──▶ Worker /api/data/* (authz in TS) ──▶ D1
```

**Tech stack:** Cloudflare D1 (SQLite), `wrangler d1 migrations`, Worker `env.DB`, `jose` (already used for Firebase ID token verification), `@cloudflare/vitest-plugin` for Worker + D1 tests (new dev dependency, the official way to run D1 in Vitest; formerly `@cloudflare/vitest-pool-workers`), `firebase-admin` (already a dev dependency) for the one-off export.

## Why this is more than a storage swap

1. **Authorization moves.** Today `firebase/firestore.rules` (555 lines) is the only authorization boundary; clients write directly. D1 is reachable only from the Worker, so every rule (role checks, `directoryOrgOk`, lock/unlock transitions, filler save-and-lock, media-only updates, `tinhTrang` admin-only, directory-role fields immutable, retreat status transitions, registration review shape) must be re-implemented as server-side TypeScript. This is the highest-risk part of the migration and gets its own phase and test suite.
2. **Transactions change.** The repos use `runTransaction` for read-modify-write (member/temple save, lock, unlock, phone index maintenance, audit log append, delete). D1 has no interactive transactions; it has atomic `db.batch([...])`. Pattern: read in the Worker, compute the new row with the existing pure domain code, then write in one batch guarded by a `version` (or `updated_at`) check; on a lost race return `409` and let the client retry once.
3. **Queries get simpler.** SQL indexes replace the 64 Firestore composite indexes, the `memberPhoneIndex` / `templeManagerPhoneIndex` collections (they exist only because rules forbid open list queries) and the many `getCountFromServer` calls (one `GROUP BY` query per stats screen).

## Current state inventory

| Area | Firestore today | Notes for D1 |
|------|-----------------|--------------|
| Collections | `orgUnits`, `invites`, `members` (+ `auditLogs` subcollection), `temples` (+ `auditLogs`), `memberPhoneIndex`, `templeManagerPhoneIndex`, `retreats`, `retreatRegistrations` (`src/firebase/collections.ts`) | 8 tables; the two phone indexes become an index / join table |
| SDK callers | `src/repositories/{memberRepo,templeRepo,retreatRepo,retreatRegistrationRepo,inviteRepo,orgUnitRepo,auditLogRepo,memberStatsRepo,templeStatsRepo}.ts`, `src/firebase/firestore.ts`, `src/test/memoryStores.ts` | Layering already holds: nothing above repositories imports the SDK |
| Transactions | 17 `runTransaction` in `memberRepo.ts` / `templeRepo.ts`; `writeBatch` in `orgUnitRepo.ts`, `retreatRegistrationRepo.ts` | → Worker handlers + `db.batch` |
| Paginated lists | members (by `sortBy` / hạ lạp tab), temples, retreats, registrations, audit logs; cursor = last doc snapshot | → keyset cursor `(sort_value, id)` encoded as opaque string |
| Counts | `getCountFromServer` in `memberStatsRepo`, `templeStatsRepo`, `countByHaLapTab` | → `COUNT(*)` / `GROUP BY` |
| Worker Firestore REST | `firestoreRest.ts` (photos/docs/search read members, temples, invites), `firestoreAdminRest.ts` (directory role read/patch, list secretaries) | → direct D1 queries |
| Rules / indexes | `firebase/firestore.rules`, `firebase/firestore.indexes.json`, `firestoreRules.integration.test.ts` | Rules tests are ported as Worker authz tests, then deleted |
| Scripts | `seed-org-units.ts`, `backfill-*.ts` (Firestore web SDK) | Seed → SQL migration; backfills → run once before export, then retired |
| Search | Client fire-and-forgets upsert/delete to `/api/search/*` after saves (`src/search/notifySearchIndex.ts`) | Worker can sync Typesense itself after a write (`ctx.waitUntil`) |

## D1 schema (first migration `migrations/0001_init.sql`)

Hybrid layout: **columns** for every field that is filtered, sorted, joined or checked by authorization; the full record in a `data` JSON `TEXT` column so the large nested profile (`giaDinh`, `chucVuHePhai`, precept records, addresses, documents …) does not need dozens of columns and keeps today's shape for the client. The repository maps row → domain type (`Member`, `Temple`, …) in one function per table, so the wire format stays the existing domain types.

```sql
CREATE TABLE org_units (
  id TEXT PRIMARY KEY, code TEXT NOT NULL, name TEXT NOT NULL,
  kind TEXT NOT NULL, sort_order INTEGER NOT NULL,
  allows_tang INTEGER NOT NULL, allows_ni INTEGER NOT NULL
);

CREATE TABLE invites (
  id TEXT PRIMARY KEY,               -- = token ('public', 'retreat_<id>')
  kind TEXT NOT NULL, retreat_id TEXT, org_unit_id TEXT,
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, created_by TEXT NOT NULL
);

CREATE TABLE members (
  id TEXT PRIMARY KEY,               -- keep {orgUnitId}_{sanghaType}_{cccd}
  org_unit_id TEXT NOT NULL,
  sangha_type TEXT NOT NULL CHECK (sangha_type IN ('tang','ni')),
  cccd TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','locked')),
  phone TEXT,                        -- normalized dienThoai (replaces memberPhoneIndex)
  current_temple_id TEXT,
  invite_id TEXT,
  ha_lap_tab_rank TEXT, sap_xep_ha_lap TEXT,
  giao_pham_he_phai_rank TEXT, giao_pham_he_phai_rank_order INTEGER,
  org_unit_name TEXT,
  tinh_trang TEXT,
  directory_role TEXT, directory_auth_uid TEXT,
  locked_at TEXT, locked_by TEXT, edit_requested_at TEXT, edit_requested_by TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  data TEXT NOT NULL                 -- JSON of the remaining Member fields
);
CREATE UNIQUE INDEX members_identity ON members(org_unit_id, sangha_type, cccd);
CREATE INDEX members_phone ON members(org_unit_id, sangha_type, phone);
CREATE INDEX members_list_updated ON members(sangha_type, org_unit_id, status, updated_at, id);
CREATE INDEX members_list_rank ON members(sangha_type, org_unit_id, giao_pham_he_phai_rank_order, id);
CREATE INDEX members_list_org_name ON members(sangha_type, org_unit_name, id);
CREATE INDEX members_ha_lap ON members(sangha_type, ha_lap_tab_rank, org_unit_id, status, sap_xep_ha_lap, id);
CREATE INDEX members_temple ON members(current_temple_id);
CREATE INDEX members_directory_role ON members(directory_role) WHERE directory_role IS NOT NULL;

CREATE TABLE temples (
  id TEXT PRIMARY KEY,
  org_unit_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','locked')),
  invite_id TEXT, list_city_name TEXT, org_unit_name TEXT,
  locked_at TEXT, locked_by TEXT, edit_requested_at TEXT, edit_requested_by TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  data TEXT NOT NULL
);
CREATE INDEX temples_list_updated ON temples(org_unit_id, status, updated_at, id);
CREATE INDEX temples_list_city ON temples(org_unit_id, list_city_name, id);
CREATE INDEX temples_list_org_name ON temples(org_unit_name, id);

-- replaces templeManagerPhoneIndex (a phone can manage several temples)
CREATE TABLE temple_manager_phones (
  temple_id TEXT NOT NULL REFERENCES temples(id) ON DELETE CASCADE,
  org_unit_id TEXT NOT NULL, phone TEXT NOT NULL,
  PRIMARY KEY (org_unit_id, phone, temple_id)
);
CREATE INDEX temple_manager_phones_temple ON temple_manager_phones(temple_id);

-- Firestore audit log ids are unique only per parent (logs are copied with
-- their ids when a member moves), so the key includes the parent.
CREATE TABLE audit_logs (
  parent_type TEXT NOT NULL CHECK (parent_type IN ('members','temples')),
  parent_id TEXT NOT NULL, id TEXT NOT NULL,
  action TEXT NOT NULL, at TEXT NOT NULL,
  actor_type TEXT NOT NULL, actor_id TEXT NOT NULL,
  changes TEXT NOT NULL,             -- JSON array
  summary TEXT,
  PRIMARY KEY (parent_type, parent_id, id)
);
CREATE INDEX audit_logs_parent ON audit_logs(parent_type, parent_id, at DESC);

CREATE TABLE retreats (
  id TEXT PRIMARY KEY, type TEXT NOT NULL, org_unit_id TEXT NOT NULL,
  status TEXT NOT NULL, created_by TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX retreats_list ON retreats(org_unit_id, status, updated_at, id);

CREATE TABLE retreat_registrations (
  id TEXT PRIMARY KEY,               -- keep {retreatId}_{memberId}
  retreat_id TEXT NOT NULL,
  member_id TEXT NOT NULL, org_unit_id TEXT NOT NULL,
  status TEXT NOT NULL, registered_via TEXT NOT NULL, registered_by TEXT,
  approved_by TEXT, approved_at TEXT, rejection_reason TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX retreat_registrations_list ON retreat_registrations(retreat_id, created_at DESC, id);
```

Notes:

- No foreign keys on imported tables (only `temple_manager_phones → temples`, with cascade): Firestore never enforced references (records of org units outside the seed, registrations of deleted retreats), so `scripts/verify-d1-import.ts` reports orphans instead of the import failing.
- Keep the existing document ids (deterministic member and registration ids, random temple/retreat ids) so R2 keys, Typesense ids, audit history and links stay valid.
- Timestamps stay ISO strings (they already are) so sort keys and `gmt7Date` helpers keep working.
- Denormalized sort keys (`domain/listSortKeys.ts`, `haLapSortKey.ts`) stay; they are computed in the Worker on write with the same domain functions. `org_unit_name` could later be replaced by a `JOIN org_units`, but not in this migration.
- The indexes in `0001_init.sql` cover the org-scoped list shapes only; lists with an optional `orgUnitId` / `status` filter and the stats counts by `giao_pham_he_phai_rank` / `list_city_name` get their indexes in phase 3 (new migration), once their SQL exists.
- The final list of list/count indexes is derived from the actual query shapes in `memberRepo.list` / `listByHaLapTab` / `templeRepo.list` / `retreatRepo.list` and checked with `EXPLAIN QUERY PLAN` in tests (no full scan on `members` / `temples`).
- D1 limits that shape the code: max 100 bound parameters per statement (chunk `IN (...)`, like today's `IN_QUERY_LIMIT`), 2 MB per row, 10 GB per database, statements per Worker invocation capped (keep exports paginated).

## Worker API (`src/worker/dataApi/*`)

Endpoints are shaped around the existing `*Store` methods and screens (guideline: one request per screen load, one per user action, writes return the updated record):

| Route (POST JSON unless noted) | Replaces | Caller |
|------|----------|--------|
| `org-units/{list,get}` (`list` also on GET, cached 5 min) | `orgUnitRepo` reads (public) | all |
| `invites/{get,create}` | `inviteRepo` (`create` builds the invite from `kind` / `retreatId`) | admin, filler |
| `members/{get,get-by-cccd,list-by-phone}` | `getById`, `getByCccd` (public), `listByOrgSanghaAndPhone` (invite token or directory writer) | filler, admin |
| `members/{list,list-ha-lap,count-ha-lap,by-temples,secretaries}` | `memberRepo` list reads; export = `list` with `limit` up to 500 | admin |
| `members/{save-draft,save-and-lock,update,request-edit,lock,unlock,set-photo,set-documents,set-tinh-trang,merge-document,remove-document,delete-many}` | `memberRepo` writes (each returns what the store method returns) | admin, filler |
| `temples/{get,list-by-phone,list,save-draft,save-and-lock,request-edit,lock,unlock,set-photo,delete-many}` | `templeRepo` | admin, filler |
| `retreats/{get,list,create,update,set-status,delete}` | `retreatRepo` | admin |
| `registrations/{get,list-by-retreat,create,review}` | `retreatRegistrationRepo` (`create` runs the use case's checks on the server; `review` returns the updated registrations) | admin, `/r/$token` |
| `audit-logs/list` | `listAuditLogs` | admin |
| `stats/{members,temples}` | `memberStatsRepo`, `templeStatsRepo` — **one** request returning all counts | admin |

Request auth: `Authorization: Bearer <Firebase ID token>` for staff (generalize `verifyFirebaseAdmin.ts` into `verifyFirebaseUser` returning `AuthClaims` via `domain/authClaims.ts`, so `kiem_soat` and secretaries are covered); `inviteToken` in the body for filler / self-registration, checked against `invites` in D1.

Authorization lives in pure functions `src/domain/authz/{members,temples,retreats,registrations,invites,orgUnits}.ts` (`canListMembers(claims, input)`, `checkMemberWrite(claims | invite, before, after)` …) that mirror the rules one-to-one, so they are unit-tested without D1. Handlers: parse/validate body → authenticate → load row(s) → `authz` → compute with domain code → `db.batch` (row + audit log + phone rows, `version` guard) → return record. `DomainError` codes map to HTTP statuses the client already understands.

Behaviour to keep from the rules (checklist for the authz port): public `get` of member/temple/registration by id (kept as is, see decisions), list only for directory writers scoped by `orgUnitId`, admin create shape (draft, not locked, `inviteId` null for giáo đoàn), filler create shape (locked by filler, no `tinhTrang`), filler update only save-and-lock / edit-request / media update (first portrait only when locked), core identity immutable, directory-role fields and secretary email immutable from the app, temple org-unit reassignment only by hệ phái admin on drafts, retreat create/status transitions/delete-only-draft, registration create shapes (self vs proxy) and review shape, audit logs append-only.

## Phases

Each phase is a separate PR from `main`; phases 1–3 ship with Firestore still the live backend.

### Phase 0 — Decisions and prep (no code)

- [ ] Read the decisions at the end of this document (all questions are settled; only the cutover date waits for the requester).
- [ ] Create the D1 database in the APAC region: `pnpm exec wrangler d1 create hephai-khatsi --location apac`; record the id. Create a `hephai-khatsi-preview` database for `wrangler dev` / preview. Preview created 2026-10-31 (`998c50bd-5c8e-41bc-9fe0-a255ba1c45d2`, `preview_database_id` of the `DB` binding; schema with `pnpm db:migrate:preview`).
- [ ] Run every pending `backfill:*` script against production Firestore so all denormalized fields exist before export.
- [ ] Measure current data volume (docs per collection, largest member doc) to size the import batches.

### Phase 1 — Schema, binding, test harness

- [x] Add `d1_databases` binding `DB` (+ `migrations_dir: "migrations"`) to `wrangler.jsonc`; add `DB: D1Database` to `src/worker/env.ts`. `database_id` `2cd8ee1d-a474-412c-aa19-f7088d4374a1` (database `hephai-khatsi`).
- [x] `migrations/0001_init.sql` (schema above) and `0002_seed_org_units.sql` generated from `domain/orgUnitSeed.ts` (`pnpm db:seed-sql:org-units`; a unit test fails when they drift).
- [x] Add `@cloudflare/vitest-plugin` and a third Vitest project `worker-d1` (`src/worker/**/*.d1.test.ts`) that applies migrations to a fresh in-memory D1 per test file (`src/worker/dataApi/test/`: setup, `clearData` for `beforeEach`, fixtures).
- [x] Row mappers `src/worker/dataApi/rows/{member,temple,retreat,registration,invite,orgUnit,auditLog}.ts`: `toRow(domain)` / `fromRow(row)`, round-trip tested in Node and through D1. Rules: column fields are not repeated in `data`; derived columns (`members.phone`, `giao_pham_he_phai_rank`) keep their source in `data`; NULL columns of optional fields read back as absent (`tinhTrang: null` reads back as absent); an invite id must equal its token; `version` is left to the write handlers.
- [x] Add scripts: `db:migrate:local` (`wrangler d1 migrations apply hephai-khatsi --local`), `db:migrate:remote`.

### Phase 2 — Server-side authorization (highest risk)

- [x] Port each `match` block of `firestore.rules` to `src/domain/authz/*.ts` as pure functions (`caller.ts` role predicates and `canListDirectory`; `members`, `temples`, `auditLogs`, `retreats`, `registrations`, `invites`, `orgUnits`; shared draft → locked lifecycle in `lockableRecord.ts`, field diff in `docDiff.ts`). Each takes the `Caller` (`null` = anonymous) and the record(s); writes by fillers also take `inviteExists`.
- [x] Port every case of `src/firebase/firestoreRules.integration.test.ts` to `src/domain/authz/*.test.ts` (same names, same allow/deny expectations). Add a table-driven test per role (`roles.test.ts`). Not ported: the phone index collections and the retired `memberCccdIndex` (no D1 counterpart; the Worker rebuilds `members.phone` / `temple_manager_phones`), public get-by-id and audit-log update/delete (no check / no endpoint).
- [x] Have a reviewer (Opus) compare the rules file and the authz module side by side before merging. No more-permissive case found; a giáo đoàn admin token without `orgUnitId` now matches no org unit.

Known deviations from the rules (deliberate): an absent field equals `null` (NULL columns read back as absent); a token with both `admin: true` and a `role` takes the role (`parseAuthClaims`).

Contract for the phase 3 handlers:
- Build `after` as the stored record merged with the request, with `id` (and for members the identity) taken from the stored row / path, never from the body.
- Pass domain records without `version` (it is not a domain field); otherwise `changedOnly` checks (edit request, media update, status transition, review) would deny every write.
- Audit logs are insert-only; derive `inviteExists` from the invites table.
- Carried over from the rules, decided in phase 3 (see below): audit-log read is now org-scoped; self registration checks the retreat's org unit and that it is open on the server.

### Phase 3 — Worker data API

- [x] `src/worker/dataApi/index.ts` router mounted in `src/worker.ts` before the search routes, **off unless `DATA_BACKEND=d1`** (`wrangler.jsonc` vars, default `firestore`, so nothing writes to D1 before the cutover); `verifyFirebaseUser` (any signed-in user → `Caller`, a token that does not verify → 401); body validation (`input.ts`, 1 MB cap); `DomainError` code → status (`http.ts`, new code `CONFLICT` → 409).
- [x] Handlers per table (`handlers/*.ts`) with D1 tests (`*.d1.test.ts`): happy path, authz denies, `version` conflict → 409, cursor stability, and `EXPLAIN QUERY PLAN` of every list/count query (no bare `SCAN <table>`). Migration `0003_data_api.sql`: the conflict guard, `version` on retreats / registrations, list and stats indexes.
- [x] Typesense sync in the write handlers (`searchSync.ts`, `ctx.waitUntil`, failures logged, never failing the save). `/api/search/reindex` gains an `import-from-db` phase (`{ collection, cursor }` → `{ imported, nextCursor }`) that builds the documents from D1.
- [x] `photosApi.ts`, `docsApi.ts`, `searchApi.ts`, `directoryRoleApi.ts` read through `recordSource.ts` (`recordSource` / `directoryMemberSource`): Firestore REST or D1 by the same `DATA_BACKEND` flag.

How writes work: read the row(s) with `version`, build `after` with the same domain code as the Firestore repo, run the phase 2 authz (and `canCreateAuditLog` for the entry), then one `db.batch`: the main write guarded by `version` (update / delete) or by "no existing row" (insert), followed by `INSERT INTO write_conflicts SELECT 1 WHERE changes() = 0`, whose trigger aborts the whole batch with `WRITE_CONFLICT` → `CONFLICT` (409). Dependent rows (audit entry, manager phones) are in the same batch.

Decided in phase 3:
- Server-set fields are built on the server: `createdBy` of retreats and invites, `registeredBy` / `approvedBy` / `approvedAt` / timestamps of registrations, ids (20-character random like Firestore auto ids for temples / retreats / audit logs). Profile patches drop the fields the store sets (`status`, lock fields, sort keys, `tinhTrang`, `version` …).
- Audit actors still come from the client (as with the rules): `canCreateAuditLog` decides whether the caller may write that actor.
- Audit-log reads are now org-scoped: directory writers of the record's org unit; history of a deleted record is hệ phái scope only.
- Self registration checks the retreat is open, the window, `quyenDangKy`, the member's org unit and extra answers on the server (the use case's checks). No invite token is required (as with the rules).
- Phone lookups (`members/list-by-phone`, `temples/list-by-phone`) need an existing invite token or a directory writer of the org unit. The filler invite is the fixed `public`, so this is no stronger than today (Firestore's phone index docs were public by id); returning less than full records is a later decision.
- Lists the rules only allowed with an org filter (`by-temples`, `secretaries`, `list-by-retreat`) are scoped to the caller's org unit for a giáo đoàn admin instead of failing.
- Lists skip rows whose sort column is NULL, like a Firestore `orderBy`; the hạ lạp fallback that recomputed tabs client-side is dropped (sort keys are always written by the Worker and backfilled before export).
- Moving a member to another org unit moves its audit history (`UPDATE OR REPLACE audit_logs`); deleting a member keeps its audit rows (Firestore left the subcollection too).
- A created member never carries directory-role fields (`canCreateMember`, stricter than the rules), and patches never set them nor `editRequested*`; as a result a member holding a directory role cannot be moved to another org unit (revoke first).
- `delete-many` and `registrations/review` are all-or-nothing: one record the caller may not touch → 403, one changed since it was read → 409; nothing is written. Missing ids are skipped on delete (like Firestore), refused on review (`NOT_FOUND`). They write one statement per 45 rows, so 500 ids stay well under D1's per-invocation query limit.
- Patch fields that feed columns and sort keys are type-checked (`PATCH_FIELD_CHECKS`); the rest of the profile is stored as sent, as before.
- Directory-role patches on D1 are a service write (no authz / audit), bumping `version`, like the Firestore REST patch.
- `ensureRetreatRegistrationInvite` re-creating a disabled invite is refused (`ALREADY_EXISTS`), as the rules refused the overwrite.

### Phase 4 — Client repositories over HTTP (behind a flag)

- [x] `src/data/apiClient.ts`: `fetch` wrapper that adds the Firebase ID token (`getCurrentUserIdToken` in `authRepo`, which waits for `authStateReady()` so loaders on page load are not anonymous), parses `{ code, message }` responses back into the same `DomainError`, retries a write once on `CONFLICT` (409). Public GETs (`org-units/list`) carry no token so the shared cache works.
- [x] New `src/repositories/d1/{memberRepo,templeRepo,retreatRepo,retreatRegistrationRepo,inviteRepo,orgUnitRepo,auditLogRepo,stats}.ts` implementing the existing `*Store` interfaces (factories `createD1*(api)` for tests; `paging.ts`: chunking to the Worker's 500-id cap, export pages of 500).
- [x] Select the implementation in one place per store with `VITE_DATA_BACKEND=firestore|d1` (`src/data/dataBackend.ts`, anything but `d1` is Firestore) — `export const memberRepo = DATA_BACKEND === 'd1' ? d1MemberRepo : firestoreMemberRepo`. Worker reads `DATA_BACKEND` from `vars`.
- [x] Drop client-side search notifications when the backend is `d1` (the Worker syncs): `notifySearchIndex.ts` returns early.
- [x] Run the existing unit and DOM suites with `VITE_DATA_BACKEND=d1`; tests that cover the Firestore implementation pin `#/data/dataBackend` to `firestore`. `src/worker/dataApi/clientRepos.d1.test.ts` runs every D1 repository through `fetch` → `handleDataApi` → local D1 (filler, admin, retreat/registration journeys), so a request shape the handlers do not accept fails in CI. Not done here: Cypress against `wrangler dev` + local D1 (needs a browser and seeded data; part of the phase 5 dry run). Query keys / `staleTime` / `setQueryData` seeding stay as they are.

Decided in phase 4:
- Phone lookups pass the filler's invite token: `MemberPhoneLookupInput` / `TemplePhoneLookupInput` gain an optional `inviteToken` (the use cases pass the route token; Firestore ignores it).
- Values the Worker sets are not sent: `createdBy` of retreats / invites, the whole server-built registration (only `retreatId`, `memberId`, `registeredVia`, `extraAnswers`), the reviewer and timestamps of a review.
- `getOrgUnitById` stays Firestore-only: only the Firestore repositories use it (the Worker loads org unit names itself); `org-units/get` has no client caller yet.
- The admin "reindex search" button keeps rebuilding from the client lists (works on both backends); switching it to the Worker's `import-from-db` phase is left to the cutover (phase 6).
- The list / id caps the client pages and chunks by (500) live in `src/domain/dataApiLimits.ts`, shared with the handlers.

Follow-ups after phase 4 (not blocking the cutover):
- Calls per screen are the same as on Firestore, not fewer: `resumeMemberByPhone` makes 3 requests (invite, then tăng and ni lookups; one if `members/list-by-phone` took an optional `sanghaType`), `createRetreatRegistration` 4 and `ensureRetreatRegistrationInvite` 3, re-reading what the Worker checks again; `reviewRetreatRegistrations` reads each registration before the review. Trim these use cases once Firestore is gone.
- Both implementations ship in every build (the ternary is not tree-shaken); phase 7 removes the Firestore side.
- An unknown route answers `NOT_FOUND` like a missing record; consider a plain 404 for unknown routes.

### Phase 5 — Data export / import

- [x] `scripts/export-firestore.ts` (`pnpm export:firestore [--out <dir>]`; `firebase-admin` with the service account from `.env`: `FIREBASE_SERVICE_ACCOUNT_JSON` (raw JSON, as for the Worker) or `GOOGLE_APPLICATION_CREDENTIALS` (file path)): page through every collection and both `auditLogs` subcollections (one `collectionGroup`), write NDJSON per collection to `.d1-migration/export-<time>/` (git-ignored), plus `manifest.json` with Firestore `count()`s per collection, per org unit × sangha (members) and per org unit (temples).
- [x] `scripts/import-d1.ts` (`pnpm import:d1 --export <dir> [--replace] [--apply --database <name> --remote|--local]`): map NDJSON → domain records like the `*FromSnap` helpers, then → rows with the phase 1 mappers (phone index collections are not imported; `members.phone` and `temple_manager_phones` are rebuilt from the records), emit SQL files of ≤ 5 MB in `<dir>/sql/` and apply them with `wrangler d1 execute <name> --file`. Logic in `src/worker/dataApi/import/` (`exportFormat.ts`, `importSql.ts`), tested in Node and through D1 (`import.d1.test.ts`).
- [x] `scripts/verify-d1-import.ts` (`pnpm verify:d1-import --export <dir> --database <name> --remote|--local`): per-table counts and per-org/sangha counts vs the manifest (Firestore) and the export, and each record (canonical JSON of `fromRow(row)` vs the exported doc mapped like the Firestore repos) — exits 1 unless 100 % equal (`verifyImport.ts`).
- [x] Dry-run end to end against the preview database with a fresh production export; time it. 2026-10-31, export of 02:39 UTC into `hephai-khatsi-preview`: verify `OK`, every record and 40/40 counts equal (11 org units, 3 invites, 761 members, 176 temples, 213 manager phones, 5 647 audit logs, 2 retreats, 1 registration). Import time was not recorded; at this size the export + import + verify fit well inside the 1-hour freeze.

Decided in phase 5:
- The import refuses to write any SQL when `checkImport` finds an error: a NOT NULL / CHECK column missing or of the wrong type, an invite whose token is not its id, two members with the same org unit + sangha + CCCD, a record over D1's 100 KB statement limit. Fix the data in Firestore and export again.
- It only warns (imports as is): orphans (records of an unknown org unit, audit logs of a deleted record, registrations of a missing retreat / member, as the notes above expect) and rows without a sort column (hidden from the lists sorted by it: run the `backfill:*` scripts and export again).
- Org units are written with `INSERT OR REPLACE` over the seed of `0002` (Firestore's copy wins); seeded units missing from Firestore stay and make verify fail on `org_units`, so they are seen.
- `--replace` deletes every data row first so dry runs can be repeated on the same database; without it a second import fails on the primary key. Neither the import nor verify has a default database: `--database` is always typed, and a remote `--replace` is refused unless the name ends in `-preview`. SQL files are applied one by one (not atomic): on a failure the script names the file and the database must be emptied before a new import.
- Verify compares canonical JSON directly instead of hashes (the data fits in memory); a top-level `null` equals an absent field, the known deviation of phase 2. It reads D1 with `wrangler d1 execute --json`, 200 rows per query by `rowid`. Besides the record, it compares the whole stored row (minus `version`) with `toRow(record)`, so the derived columns (`members.phone`, sort keys) are checked too.
- The export (`exportValue`, `auditLogParentFromPath` in `exportFormat.ts`) fails on a Firestore value the app cannot have written (references, geo points, bytes, non-finite numbers); `Timestamp`s become ISO strings.

Runbook (dry run, then cutover in phase 6):
0. Dry run only: `pnpm db:migrate:preview` (the preview database is the `preview_database_id` of the `DB` binding, so the Worker gets no extra binding; import / verify find it by name).
1. `pnpm export:firestore` (Firestore read-only during the cutover).
2. `pnpm import:d1 --export .d1-migration/export-<time> --replace --apply --database hephai-khatsi-preview --remote` (cutover: the production database, migrated with `pnpm db:migrate:remote`, without `--replace` on an empty database).
3. `pnpm verify:d1-import --export .d1-migration/export-<time> --database hephai-khatsi-preview --remote` must print `OK`.
4. Delete the export folder when done: it holds personal data.

### Phase 6 — Cutover (maintenance window)

Recommended: a short write freeze rather than dual writes (dual writes from the browser cannot be atomic across two databases and would need all of phase 2 anyway).

Prepared in code (2026-10-31, no production change):
- [x] Maintenance banner: `VITE_MAINTENANCE_MODE=true` at build time shows `MaintenanceBanner` (copy in `messages/vi.json`) above every page (`__root.tsx`); any other value, or none, hides it.
- [x] Read-only rules: `firebase/firestore.frozen.rules` is generated from `firestore.rules` (`pnpm rules:generate-frozen`, `src/firebase/frozenRules.ts`): every write rule becomes `if false`, every read rule stays, so the frozen app keeps reading. A unit test fails when the two files drift; `frozenRules.integration.test.ts` checks reads pass and staff / filler writes fail on the emulator. Deploy with `pnpm rules:freeze` (`firebase.frozen.json`), revert with `pnpm rules:unfreeze`.
- [x] Search reindex from D1: on the D1 backend the admin "Tạo lại chỉ mục tìm kiếm" button (`OrgUnitsPage`) runs `ensure`, then the Worker's `import-from-db` page by page (`reindexDirectorySearchFromDb`); nothing is loaded in the browser. On Firestore it keeps rebuilding from the client lists.

Cutover steps (requester runs them; each needs Wrangler and Firebase CLI logins with production access):
- [ ] Get the requester's explicit go-ahead and date (freeze of up to 1 hour approved; do not start without this confirmation).
- [ ] Announce the window (form fillers and admins). Deploy a build with a maintenance banner and Firestore rules set to read-only (`allow write: if false`).
- [ ] Export → import → verify (phase 5 scripts).
- [ ] Set `VITE_DATA_BACKEND=d1` / Worker `DATA_BACKEND=d1`, `pnpm deploy`, reindex Typesense from D1, smoke test (login per role, filler lookup by phone/CCCD, save-and-lock, photo upload, retreat registration, export Excel/PDF, stats).
- [ ] Rollback plan: redeploy the previous build and restore Firestore write rules (Firestore data is untouched while frozen). Writes made to D1 after cutover would be lost on rollback, so decide go / no-go within the window.
- [ ] Keep Firestore read-only for 30 days as a backup; D1 Time Travel gives point-in-time restore from then on.

Runbook (times are for ~800 members; the phase 5 dry run fit well inside the hour):

Before the window (any day before):
1. `git pull` on `main`; `pnpm install`; `pnpm test` green.
2. Production database schema: `pnpm db:migrate:remote` (applies `0001`–`0003` to `hephai-khatsi`, seeds org units). Check it holds no data rows: `pnpm exec wrangler d1 execute hephai-khatsi --remote --command "SELECT (SELECT COUNT(*) FROM members) + (SELECT COUNT(*) FROM temples) + (SELECT COUNT(*) FROM audit_logs) + (SELECT COUNT(*) FROM retreats) AS n"` must print `0` (the import has no `--replace` on production; empty it by hand if a test wrote to it).
3. Run the pending `backfill:*` scripts against Firestore (phase 0), so no row lacks a sort column.
4. `firebase login` / `pnpm exec wrangler whoami` on the machine that runs the cutover; `.env` holds `FIREBASE_SERVICE_ACCOUNT_JSON` (or `GOOGLE_APPLICATION_CREDENTIALS`) for the export.
5. Prepare the cutover commit on a branch, not merged yet: `wrangler.jsonc` `vars.DATA_BACKEND` → `"d1"`. It is merged into `main` in step 10 so every later `pnpm deploy` keeps the D1 backend.
6. Announce the date and the read-only hour to admins and form fillers.

Freeze (T+0):
7. Banner build on Firestore: in `.env` set `VITE_MAINTENANCE_MODE=true` (keep `VITE_DATA_BACKEND=firestore`), `pnpm deploy`. Open the site: the yellow banner shows.
8. `pnpm rules:freeze`. From now on every Firestore write is refused (saves show their usual error). Do not grant or revoke directory roles in the window: that route writes Firestore with the service account, which the rules do not stop, and the change would not reach D1. Wait ~1 minute for in-flight saves.

Move the data (T+5):
9. `pnpm export:firestore` → `.d1-migration/export-<time>/`; then
   `pnpm import:d1 --export .d1-migration/export-<time> --apply --database hephai-khatsi --remote` (a `checkImport` error writes nothing: fix the data in Firestore, which needs `pnpm rules:unfreeze` and a new freeze, or stop the window); then
   `pnpm verify:d1-import --export .d1-migration/export-<time> --database hephai-khatsi --remote` must print `OK`. Record a restore point: `pnpm exec wrangler d1 time-travel info hephai-khatsi`.

Switch (T+15):
10. Merge the cutover commit (step 5). In `.env` set `VITE_DATA_BACKEND=d1` and remove `VITE_MAINTENANCE_MODE`; `pnpm deploy` (Worker `DATA_BACKEND=d1` and the D1 client ship together; they must match).
11. Signed in as hệ phái admin: Giáo đoàn (`/admin/org-units`) → "Tạo lại chỉ mục tìm kiếm" (now rebuilt by the Worker from D1); the counts match verify's members / temples.
12. Smoke test, one pass each: login as hệ phái admin, giáo đoàn admin, kiểm soát; member and temple lists (tăng / ni, hạ lạp tabs, sort), search; open a record and its history; filler `/f/public`: lookup by phone and by CCCD, save-and-lock, edit request; portrait and document upload; admin lock / unlock; retreat create, invite link, `/r/<token>` self registration, review; Excel / PDF export; members and temples stats. Firestore must see no new writes (rules stay frozen).

Go / no-go (by T+60):
13. Go: keep Firestore frozen (do not run `rules:unfreeze`) for 30 days as the backup; delete `.d1-migration/export-<time>/` (personal data); announce the end of the window.
14. No-go (rollback): revert the cutover commit, `.env` back to `VITE_DATA_BACKEND=firestore` without `VITE_MAINTENANCE_MODE`, `pnpm deploy`, `pnpm rules:unfreeze`. Firestore is as it was at the freeze; anything written to D1 after step 10 is lost, so decide before users write much. Empty `hephai-khatsi` before the next attempt (step 2).

### Phase 7 — Cleanup

- [ ] Remove the Firestore implementations and the flag, `src/firebase/firestore.ts`, `collections.ts`, `src/test/memoryStores.ts` (or rewrite it on the D1 test harness), `firestoreRest.ts`, `firestoreAdminRest.ts` (keep `googleServiceAccount.ts` / `identityToolkit.ts` for directory roles), `firebase/firestore.rules`, `firebase/firestore.indexes.json`, Firestore emulator wiring and `*.integration.test.ts` that only cover Firestore, the obsolete `backfill:*` / `seed:org-units` scripts, `@firebase/rules-unit-testing`.
- [ ] Keep `firebase` (Auth only) and `firebase-admin` (claims script).
- [ ] Update `CLAUDE.md`, `README.md` and `.cursor/rules/firebase-tanstack.mdc`: data layering becomes `repositories → /api/data → D1`, authz lives in `src/domain/authz`, new commands (`db:migrate:*`), D1 in deploy steps.
- [ ] Delete the Firestore database after the 30-day backup period (separate, explicit decision).

## Effects to expect

- **Calls per screen:** stats screens go from ~10–20 `getCountFromServer` calls to 1 request; filler phone lookup goes from 2 reads (index + docs) to 1; save paths return the record (no refetch). List screens stay at 1 request per page.
- **Latency:** every read now passes through the Worker (one extra hop, but no Firestore SDK bootstrap; the `firebase/firestore` bundle chunk disappears from the client). With the database in APAC, expect similar or better latency for users in Vietnam; D1 read replication (Sessions API) can be enabled later if needed.
- **Cost:** Firestore per-read billing is replaced by D1 rows read/written; for this data size it should sit within the Workers Paid included quota.
- **Offline / caching:** the app does not rely on Firestore offline persistence; TanStack Query caching is unchanged.

## Risks

| Risk | Mitigation |
|------|------------|
| An authorization rule is missed or weakened | Phase 2 ports every rules test; side-by-side review; table-driven role tests; public endpoints accept only the invite-token shapes the rules allow |
| Lost update without interactive transactions | `version` column guard in every write batch, 409 + single client retry |
| Data mismatch after import | Hash-level verify script, dry run on preview DB, write freeze during cutover |
| Search index out of sync | Reindex from D1 right after cutover; Worker-side sync afterwards |
| Large exports hit Worker limits | Paginated export endpoint, the client already assembles pages (`listAllForExport`) |

## Decisions (requester, 2026-10-30)

- **Cutover write freeze of up to 1 hour is acceptable** (data volume is small, so it should be shorter). The date is **not** fixed: phase 6 starts only after the requester explicitly confirms it. Phases 0–5 proceed without waiting.
- **Public read by id is kept** as today: anyone who knows a member / temple / registration id can read it (the id is the bearer secret). No invite token on those reads.
- **Typesense sync moves into the Worker** (phase 3); the client-side search notifications are removed in phase 4.
