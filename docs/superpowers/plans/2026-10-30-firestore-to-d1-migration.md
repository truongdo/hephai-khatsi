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

**Tech stack:** Cloudflare D1 (SQLite), `wrangler d1 migrations`, Worker `env.DB`, `jose` (already used for Firebase ID token verification), `@cloudflare/vitest-pool-workers` for Worker + D1 tests (new dev dependency, the official way to run D1 in Vitest), `firebase-admin` (already a dev dependency) for the one-off export.

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
  org_unit_id TEXT NOT NULL REFERENCES org_units(id),
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
  org_unit_id TEXT NOT NULL REFERENCES org_units(id),
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

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  parent_type TEXT NOT NULL CHECK (parent_type IN ('members','temples')),
  parent_id TEXT NOT NULL,
  action TEXT NOT NULL, at TEXT NOT NULL,
  actor_type TEXT NOT NULL, actor_id TEXT NOT NULL,
  changes TEXT NOT NULL              -- JSON array
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
  retreat_id TEXT NOT NULL REFERENCES retreats(id),
  member_id TEXT NOT NULL, org_unit_id TEXT NOT NULL,
  status TEXT NOT NULL, registered_via TEXT NOT NULL, registered_by TEXT,
  approved_by TEXT, approved_at TEXT, rejection_reason TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX retreat_registrations_list ON retreat_registrations(retreat_id, created_at DESC, id);
```

Notes:

- Keep the existing document ids (deterministic member and registration ids, random temple/retreat ids) so R2 keys, Typesense ids, audit history and links stay valid.
- Timestamps stay ISO strings (they already are) so sort keys and `gmt7Date` helpers keep working.
- Denormalized sort keys (`domain/listSortKeys.ts`, `haLapSortKey.ts`) stay; they are computed in the Worker on write with the same domain functions. `org_unit_name` could later be replaced by a `JOIN org_units`, but not in this migration.
- The final list of list/count indexes is derived from the actual query shapes in `memberRepo.list` / `listByHaLapTab` / `templeRepo.list` / `retreatRepo.list` and checked with `EXPLAIN QUERY PLAN` in tests (no full scan on `members` / `temples`).
- D1 limits that shape the code: max 100 bound parameters per statement (chunk `IN (...)`, like today's `IN_QUERY_LIMIT`), 2 MB per row, 10 GB per database, statements per Worker invocation capped (keep exports paginated).

## Worker API (`src/worker/dataApi/*`)

Endpoints are shaped around the existing `*Store` methods and screens (guideline: one request per screen load, one per user action, writes return the updated record):

| Route (POST JSON unless noted) | Replaces | Caller |
|------|----------|--------|
| `GET /api/data/org-units` | `listOrgUnits` (public, cacheable) | all |
| `/api/data/invites/get`, `/create` | `inviteRepo` | admin, filler |
| `/api/data/members/{get,list,list-ha-lap,count-ha-lap,export-page,by-temples,secretaries}` | `memberRepo` reads | admin |
| `/api/data/members/{save-draft,save-and-lock,update,lock,unlock,set-tinh-trang,set-photo,merge-document,remove-document,delete-many,request-edit}` | `memberRepo` writes (each returns the updated `Member`) | admin, filler |
| `/api/data/filler/members/{by-cccd,by-phone}` | `getByCccd`, `listByOrgSanghaAndPhone` (invite token required) | filler |
| `/api/data/temples/...` | same split as members | admin, filler |
| `/api/data/retreats/...`, `/api/data/registrations/...` | `retreatRepo`, `retreatRegistrationRepo` | admin, `/r/$token` |
| `/api/data/audit-logs/list` | `listAuditLogs` | admin |
| `/api/data/stats/{members,temples}` | `memberStatsRepo`, `templeStatsRepo` — **one** request returning all counts | admin |

Request auth: `Authorization: Bearer <Firebase ID token>` for staff (generalize `verifyFirebaseAdmin.ts` into `verifyFirebaseUser` returning `AuthClaims` via `domain/authClaims.ts`, so `kiem_soat` and secretaries are covered); `inviteToken` in the body for filler / self-registration, checked against `invites` in D1.

Authorization lives in pure functions `src/domain/authz/{members,temples,retreats,registrations,invites,orgUnits}.ts` (`canListMembers(claims, input)`, `checkMemberWrite(claims | invite, before, after)` …) that mirror the rules one-to-one, so they are unit-tested without D1. Handlers: parse/validate body → authenticate → load row(s) → `authz` → compute with domain code → `db.batch` (row + audit log + phone rows, `version` guard) → return record. `DomainError` codes map to HTTP statuses the client already understands.

Behaviour to keep from the rules (checklist for the authz port): public `get` of member/temple/registration by id (or tighten it to invite-token callers — see open questions), list only for directory writers scoped by `orgUnitId`, admin create shape (draft, not locked, `inviteId` null for giáo đoàn), filler create shape (locked by filler, no `tinhTrang`), filler update only save-and-lock / edit-request / media update (first portrait only when locked), core identity immutable, directory-role fields and secretary email immutable from the app, temple org-unit reassignment only by hệ phái admin on drafts, retreat create/status transitions/delete-only-draft, registration create shapes (self vs proxy) and review shape, audit logs append-only.

## Phases

Each phase is a separate PR from `main`; phases 1–3 ship with Firestore still the live backend.

### Phase 0 — Decisions and prep (no code)

- [ ] Confirm the open questions at the end of this document.
- [ ] Create the D1 database in the APAC region: `pnpm exec wrangler d1 create hephai-khatsi --location apac`; record the id. Create a `hephai-khatsi-preview` database for `wrangler dev` / preview.
- [ ] Run every pending `backfill:*` script against production Firestore so all denormalized fields exist before export.
- [ ] Measure current data volume (docs per collection, largest member doc) to size the import batches.

### Phase 1 — Schema, binding, test harness

- [ ] Add `d1_databases` binding `DB` (+ `migrations_dir: "migrations"`) to `wrangler.jsonc`; add `DB: D1Database` to `src/worker/env.ts`.
- [ ] `migrations/0001_init.sql` (schema above) and `0002_seed_org_units.sql` generated from `domain/orgUnitSeed.ts`.
- [ ] Add `@cloudflare/vitest-pool-workers` and a third Vitest project `worker-d1` (`src/worker/**/*.d1.test.ts`) that applies migrations to a fresh in-memory D1 per test file.
- [ ] Row mappers `src/worker/dataApi/rows/{member,temple,retreat,registration,invite,orgUnit,auditLog}.ts`: `toRow(domain)` / `fromRow(row)`, round-trip tested with fixtures from existing tests.
- [ ] Add scripts: `db:migrate:local` (`wrangler d1 migrations apply hephai-khatsi --local`), `db:migrate:remote`.

### Phase 2 — Server-side authorization (highest risk)

- [ ] Port each `match` block of `firestore.rules` to `src/domain/authz/*.ts` as pure functions.
- [ ] Port every case of `src/firebase/firestoreRules.integration.test.ts` to `src/domain/authz/*.test.ts` (same names, same allow/deny expectations). Add a table-driven test per role (`he_phai_admin`, `he_phai_secretary`, `giao_doan_admin` own / other org, `kiem_soat`, legacy `admin`, anonymous filler with and without a valid invite).
- [ ] Have a reviewer (Opus) compare the rules file and the authz module side by side before merging.

### Phase 3 — Worker data API

- [ ] `src/worker/dataApi/index.ts` router mounted in `src/worker.ts` before the search routes; `verifyFirebaseUser`; body validation; error → status mapping.
- [ ] Handlers per table (members, temples, retreats, registrations, invites, org units, audit logs, stats) with D1 tests for: happy path, each authz deny, `version` conflict → 409, pagination cursor stability, export paging, `EXPLAIN QUERY PLAN` uses an index for each list/count query.
- [ ] Move Typesense sync into the write handlers (`ctx.waitUntil(upsert/delete)`, failures logged, never failing the save), keeping `/api/search/reindex` reading from D1.
- [ ] Switch `photosApi.ts`, `docsApi.ts`, `searchApi.ts`, `directoryRoleApi.ts` from `firestoreRest.ts` / `firestoreAdminRest.ts` to D1 queries **behind the same flag as phase 4** (they must read the same backend as the client).

### Phase 4 — Client repositories over HTTP (behind a flag)

- [ ] `src/data/apiClient.ts`: `fetch` wrapper that adds the Firebase ID token (from `authRepo`) or the invite token, parses `DomainError` responses.
- [ ] New `src/repositories/d1/{memberRepo,templeRepo,retreatRepo,retreatRegistrationRepo,inviteRepo,orgUnitRepo,auditLogRepo,stats}.ts` implementing the existing `*Store` interfaces.
- [ ] Select the implementation in one place per store with `VITE_DATA_BACKEND=firestore|d1` (default `firestore`) — `export const memberRepo = DATA_BACKEND === 'd1' ? d1MemberRepo : firestoreMemberRepo`. Worker reads `DATA_BACKEND` from `vars`.
- [ ] Drop client-side search notifications when the backend is `d1` (the Worker syncs).
- [ ] Run the existing unit, DOM and Cypress suites with `VITE_DATA_BACKEND=d1` against `wrangler dev` + local D1; fix gaps. Query keys / `staleTime` / `setQueryData` seeding stay as they are.

### Phase 5 — Data export / import

- [ ] `scripts/export-firestore.ts` (`firebase-admin`, service account from `.env`): page through every collection and both `auditLogs` subcollections, write NDJSON per collection to a local, git-ignored folder.
- [ ] `scripts/import-d1.ts`: map NDJSON → rows with the phase 1 mappers (phone index collections are not imported; `members.phone` and `temple_manager_phones` are rebuilt from the records), emit SQL files in chunks and apply with `wrangler d1 execute hephai-khatsi --remote --file`.
- [ ] `scripts/verify-d1-import.ts`: per-table counts, per-org/sangha counts vs Firestore stats, and a content hash of each record (canonical JSON of `fromRow(row)` vs the Firestore doc) — must be 100 % equal.
- [ ] Dry-run end to end against the preview database with a fresh production export; time it.

### Phase 6 — Cutover (maintenance window)

Recommended: a short write freeze rather than dual writes (dual writes from the browser cannot be atomic across two databases and would need all of phase 2 anyway).

- [ ] Announce a window (form fillers and admins). Deploy a build with a maintenance banner and Firestore rules set to read-only (`allow write: if false`).
- [ ] Export → import → verify (phase 5 scripts).
- [ ] Set `VITE_DATA_BACKEND=d1` / Worker `DATA_BACKEND=d1`, `pnpm deploy`, reindex Typesense from D1, smoke test (login per role, filler lookup by phone/CCCD, save-and-lock, photo upload, retreat registration, export Excel/PDF, stats).
- [ ] Rollback plan: redeploy the previous build and restore Firestore write rules (Firestore data is untouched while frozen). Writes made to D1 after cutover would be lost on rollback, so decide go / no-go within the window.
- [ ] Keep Firestore read-only for 30 days as a backup; D1 Time Travel gives point-in-time restore from then on.

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

## Open questions for the requester

1. **Public read by id.** Firestore allows anyone to `get` a member/temple/registration by id (the id is the bearer secret). Keep that, or require the invite token on those reads in the new API (safer, small client change)?
2. **Cutover window.** Is a short write freeze (est. under 1 hour, depending on data volume) acceptable, and when?
3. **Typesense sync** moved into the Worker in phase 3 — OK, or keep the client-side notifications for now?
