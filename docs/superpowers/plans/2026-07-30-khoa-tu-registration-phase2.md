# Khóa tu — Phase 2: Đăng ký Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship self-service and proxy registration for Giáo đoàn retreats: per-retreat invites, phone identity (confirm existing or full new-member form), `extraAnswers`, shared eligibility guards, and an admin read-only registration list.

**Architecture:** Extend `Invite` with `kind: 'filler' | 'retreat_registration'`; idempotent invite doc id/token `retreat_{retreatId}`; top-level `retreatRegistrations` with deterministic ids `{retreatId}_{memberId}`; shared `createRetreatRegistration` use-case; public `/r/$token` wizard; admin `/admin/retreats/$id/registrations`. Window/`quyenDangKy`/org/duplicate guards in use-cases; Firestore rules for public retreat get, shaped self-create, staff list; no registration updates in Phase 2.

**Tech Stack:** TypeScript, Firestore, Vitest (+ `@firebase/rules-unit-testing`), TanStack Router/Query, Mantine, Paraglide (`messages/vi.json`).

## Global Constraints

- Spec: [docs/superpowers/specs/2026-07-30-khoa-tu-registration-phase2-design.md](../specs/2026-07-30-khoa-tu-registration-phase2-design.md)
- Parent roadmap: [docs/superpowers/specs/2026-07-25-khoa-tu-roadmap-design.md](../specs/2026-07-25-khoa-tu-roadmap-design.md)
- Invite doc id **equals** `token` (existing filler pattern: `public`). Retreat invite: id = token = `retreat_${retreatId}`.
- Registration doc id = `${retreatId}_${memberId}` (enforces uniqueness).
- Creates always set `status: 'pending'`, `approvedBy: null`, `approvedAt: null`.
- Proxy does **not** create members — only phone lookup of existing same-org members.
- Self may create full member via existing filler editor patterns with locked `orgUnitId` and `inviteId` = retreat invite id.
- No approve/reject/update/delete of registrations in this phase.
- Import alias: `#/domain/...`, `#/repositories/...`, `#/use-cases/...`, `#/query/...`, `#/components/...`.
- No comments unless explaining non-obvious WHY.
- Workspace rule: implement on a **new branch from `main`** (`feat/khoa-tu-registration-phase2`); do **not** use git worktrees.
- TDD: failing test → implement → pass → commit per task.
- Run unit tests from `tanstack-app`: `pnpm test -- <path>`. Rules/integration: existing emulator suite.

---

## File Structure

- Modify: `tanstack-app/src/domain/types.ts` — extend `Invite`
- Create: `tanstack-app/src/domain/invite.ts` — `parseInvite`, `retreatRegistrationInviteId`, kind helpers
- Create: `tanstack-app/src/domain/invite.test.ts`
- Create: `tanstack-app/src/domain/retreatRegistration.ts` — types + guards (`assertRegistrationOpen`, `assertQuyenAllows`, `validateExtraAnswers`)
- Create: `tanstack-app/src/domain/retreatRegistration.test.ts`
- Modify: `tanstack-app/src/domain/errors.ts` — add `ALREADY_EXISTS` (and reuse `INVALID_STATUS` / `INVALID_INPUT`)
- Modify: `tanstack-app/src/firebase/collections.ts` — `retreatRegistrations`
- Modify: `tanstack-app/src/repositories/inviteRepo.ts` — write/read extended invite fields; keep `getByToken` = get by doc id
- Modify: `tanstack-app/src/use-cases/createInvite.ts` — set `kind: 'filler'`
- Create: `tanstack-app/src/use-cases/ensureRetreatRegistrationInvite.ts` (+ test)
- Create: `tanstack-app/src/repositories/retreatRegistrationRepo.ts` (+ memory test)
- Create: `tanstack-app/src/use-cases/createRetreatRegistration.ts` (+ test)
- Modify: `firebase/firestore.rules` — public retreat get; invite create fields; `retreatRegistrations` match
- Modify: `firebase/firestore.indexes.json` — `retreatId + createdAt`
- Modify: `tanstack-app/src/firebase/firestoreRules.integration.test.ts`
- Modify: `tanstack-app/src/query/adminKeys.ts`, `adminQueries.ts` — registrations list query
- Create: `tanstack-app/src/query/registrationQueries.ts` — public invite/retreat queries for `/r`
- Create: admin registrations UI + route; copy-link control
- Create: `/r/$token` routes + self-registration UI components
- Modify: `tanstack-app/messages/vi.json` — all new copy
- Modify: roadmap phase 2 status → Đã lập kế hoạch / Đang thực hiện as appropriate

---

### Task 1: Invite domain + extended `Invite` type

**Files:**
- Modify: `tanstack-app/src/domain/types.ts`
- Create: `tanstack-app/src/domain/invite.ts`
- Create: `tanstack-app/src/domain/invite.test.ts`
- Modify: `tanstack-app/src/use-cases/createInvite.ts`
- Modify: `tanstack-app/src/repositories/inviteRepo.ts` (only if needed so stored shape round-trips new fields)

**Interfaces:**
- Consumes: existing `Invite` shape used by filler
- Produces:
  - `export type InviteKind = 'filler' | 'retreat_registration'`
  - Extended `Invite`: `kind`, `retreatId: string | null`, `orgUnitId: string | null`, `disabled: boolean`
  - `export function retreatRegistrationInviteId(retreatId: string): string` → `retreat_${retreatId}`
  - `export function parseInvite(id: string, data: Record<string, unknown>): Invite` — legacy docs without `kind` → `filler`, `retreatId/orgUnitId` null, `disabled` false

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { parseInvite, retreatRegistrationInviteId } from './invite'

describe('retreatRegistrationInviteId', () => {
  it('prefixes retreat id', () => {
    expect(retreatRegistrationInviteId('abc')).toBe('retreat_abc')
  })
})

describe('parseInvite', () => {
  it('defaults legacy filler docs', () => {
    expect(
      parseInvite('public', {
        token: 'public',
        createdAt: 't',
        createdBy: 'u',
      }),
    ).toEqual({
      id: 'public',
      token: 'public',
      createdAt: 't',
      createdBy: 'u',
      kind: 'filler',
      retreatId: null,
      orgUnitId: null,
      disabled: false,
    })
  })

  it('parses retreat_registration invites', () => {
    expect(
      parseInvite('retreat_r1', {
        token: 'retreat_r1',
        createdAt: 't',
        createdBy: 'u',
        kind: 'retreat_registration',
        retreatId: 'r1',
        orgUnitId: 'gd-i',
        disabled: false,
      }),
    ).toMatchObject({
      kind: 'retreat_registration',
      retreatId: 'r1',
      orgUnitId: 'gd-i',
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tanstack-app && pnpm test -- src/domain/invite.test.ts`

Expected: FAIL — module / exports missing

- [ ] **Step 3: Write minimal implementation**

Update `Invite` in `types.ts`:

```ts
export type InviteKind = 'filler' | 'retreat_registration'

export type Invite = {
  id: string
  token: string
  createdAt: string
  createdBy: string
  kind: InviteKind
  retreatId: string | null
  orgUnitId: string | null
  disabled: boolean
}
```

Implement `invite.ts` helpers. Update `createInvite` to set `kind: 'filler'`, `retreatId: null`, `orgUnitId: null`, `disabled: false`. Update `inviteRepo.getByToken` to return `parseInvite(snap.id, snap.data())`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tanstack-app && pnpm test -- src/domain/invite.test.ts`

Also run any existing invite/createInvite tests that break on the widened type and fix call sites minimally.

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/domain/types.ts tanstack-app/src/domain/invite.ts tanstack-app/src/domain/invite.test.ts tanstack-app/src/use-cases/createInvite.ts tanstack-app/src/repositories/inviteRepo.ts
git commit -m "$(cat <<'EOF'
feat: extend Invite with kind for retreat registration links.

EOF
)"
```

---

### Task 2: Registration domain guards

**Files:**
- Create: `tanstack-app/src/domain/retreatRegistration.ts`
- Create: `tanstack-app/src/domain/retreatRegistration.test.ts`
- Modify: `tanstack-app/src/domain/errors.ts` — add `'ALREADY_EXISTS'`

**Interfaces:**
- Consumes: `Retreat`, `QuyenDangKy`, `RetreatExtraField` from `#/domain/retreat`
- Produces:
  - `export type RegistrationStatus = 'pending' | 'approved' | 'rejected'`
  - `export type RegisteredVia = 'self' | 'proxy'`
  - `export type RetreatRegistration = { id: string; retreatId: string; memberId: string; orgUnitId: string; registeredVia: RegisteredVia; registeredBy: string | null; extraAnswers: Record<string, string>; status: RegistrationStatus; approvedBy: string | null; approvedAt: string | null; createdAt: string; updatedAt: string }`
  - `export function retreatRegistrationId(retreatId: string, memberId: string): string`
  - `export function assertRegistrationOpen(retreat: Pick<Retreat, 'status' | 'dangKyMoTu' | 'dangKyDongLuc'>, nowIso: string): void`
  - `export function assertQuyenAllows(quyen: QuyenDangKy, via: RegisteredVia): void`
  - `export function validateExtraAnswers(extraFields: RetreatExtraField[], answers: Record<string, string>): void`
  - `export function assertMemberOrgMatches(memberOrgUnitId: string, retreatOrgUnitId: string): void`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { DomainError } from './errors'
import {
  assertMemberOrgMatches,
  assertQuyenAllows,
  assertRegistrationOpen,
  retreatRegistrationId,
  validateExtraAnswers,
} from './retreatRegistration'

const base = {
  status: 'open' as const,
  dangKyMoTu: '2026-07-01T00:00:00.000+07:00',
  dangKyDongLuc: '2026-07-31T23:59:59.999+07:00',
}

describe('assertRegistrationOpen', () => {
  it('allows open retreat inside window', () => {
    expect(() =>
      assertRegistrationOpen(base, '2026-07-15T12:00:00.000+07:00'),
    ).not.toThrow()
  })

  it('rejects when status is not open', () => {
    expect(() =>
      assertRegistrationOpen({ ...base, status: 'closed' }, '2026-07-15T12:00:00.000+07:00'),
    ).toThrow(DomainError)
  })

  it('rejects outside window', () => {
    expect(() =>
      assertRegistrationOpen(base, '2026-08-01T00:00:00.000+07:00'),
    ).toThrow(DomainError)
  })
})

describe('assertQuyenAllows', () => {
  it('allows self when both', () => {
    expect(() => assertQuyenAllows('both', 'self')).not.toThrow()
  })
  it('rejects self when proxy_only', () => {
    expect(() => assertQuyenAllows('proxy_only', 'self')).toThrow(DomainError)
  })
  it('rejects proxy when tu_dang_ky', () => {
    expect(() => assertQuyenAllows('tu_dang_ky', 'proxy')).toThrow(DomainError)
  })
})

describe('validateExtraAnswers', () => {
  it('requires required keys', () => {
    expect(() =>
      validateExtraAnswers([{ key: 'room', label: 'Phòng', required: true }], {}),
    ).toThrow(DomainError)
  })
})

describe('retreatRegistrationId', () => {
  it('joins retreat and member ids', () => {
    expect(retreatRegistrationId('r1', 'gd-i_tang_001')).toBe('r1_gd-i_tang_001')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tanstack-app && pnpm test -- src/domain/retreatRegistration.test.ts`

Expected: FAIL — module missing

- [ ] **Step 3: Write minimal implementation**

Implement helpers: compare ISO strings lexicographically for window (same convention as stored GMT+7 ISO from Phase 1). Throw `INVALID_STATUS` when not open; `INVALID_INPUT` when outside window / bad quyen / missing answers; `FORBIDDEN` when org mismatch.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tanstack-app && pnpm test -- src/domain/retreatRegistration.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/domain/retreatRegistration.ts tanstack-app/src/domain/retreatRegistration.test.ts tanstack-app/src/domain/errors.ts
git commit -m "$(cat <<'EOF'
feat: add retreat registration domain types and guards.

EOF
)"
```

---

### Task 3: `retreatRegistrationRepo` + collection

**Files:**
- Modify: `tanstack-app/src/firebase/collections.ts`
- Create: `tanstack-app/src/repositories/retreatRegistrationRepo.ts`
- Create: `tanstack-app/src/repositories/retreatRegistrationRepo.memory.test.ts`

**Interfaces:**
- Consumes: `RetreatRegistration`, `retreatRegistrationId`
- Produces:
  - `export type RetreatRegistrationStore = { create(reg: RetreatRegistration): Promise<void>; getById(id: string): Promise<RetreatRegistration | null>; listByRetreat(input: { retreatId: string; limit?: number; cursor?: string }): Promise<AdminListPage<RetreatRegistration>> }`
  - `export const retreatRegistrationRepo: RetreatRegistrationStore`
  - Collection key `retreatRegistrations: 'retreatRegistrations'`

- [ ] **Step 1: Write the failing memory-store test**

Use an in-memory fake implementing `RetreatRegistrationStore` in the test file (same style as `retreatRepo.memory.test.ts` if present, or inline Map). Assert `create` then `getById` and `listByRetreat` order by `createdAt` desc.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tanstack-app && pnpm test -- src/repositories/retreatRegistrationRepo.memory.test.ts`

Expected: FAIL until store + types wired (write test against interface first; implement fake in test, then real repo in step 3 — or test real repo with emulator only later). Prefer: test an exported `createMemoryRetreatRegistrationStore()` helper colocated in the test file, and implement Firestore repo separately with a thin unit test that the module exports `create`/`getById`/`listByRetreat` functions matching the interface (if no emulator in unit run, keep memory fake as the behavioral test and a type-level export check).

Practical approach matching Phase 1: memory test of the **use-case** comes in Task 5; for this task, implement Firestore repo and a small test that `retreatRegistrationId` + data shape round-trip via a memory Map implementing the same interface used by use-cases.

- [ ] **Step 3: Implement Firestore repo**

```ts
// create: setDoc(doc(db, COLLECTIONS.retreatRegistrations, reg.id), omit id)
// getById: getDoc
// listByRetreat: query where retreatId ==, orderBy createdAt desc, limit, startAfter cursor
```

Add to `collections.ts`: `retreatRegistrations: 'retreatRegistrations'`.

- [ ] **Step 4: Run memory test PASS**

Run: `cd tanstack-app && pnpm test -- src/repositories/retreatRegistrationRepo.memory.test.ts`

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/firebase/collections.ts tanstack-app/src/repositories/retreatRegistrationRepo.ts tanstack-app/src/repositories/retreatRegistrationRepo.memory.test.ts
git commit -m "$(cat <<'EOF'
feat: add retreatRegistrationRepo for pending registrations.

EOF
)"
```

---

### Task 4: `ensureRetreatRegistrationInvite`

**Files:**
- Create: `tanstack-app/src/use-cases/ensureRetreatRegistrationInvite.ts`
- Create: `tanstack-app/src/use-cases/ensureRetreatRegistrationInvite.test.ts`
- Extend `InviteStore` if needed with nothing beyond `create` + `getByToken`

**Interfaces:**
- Consumes: `canManageRetreats`, `canAccessOrgUnit`, `retreatRepo.getById`, `retreatRegistrationInviteId`, `InviteStore`
- Produces:
  - `export async function ensureRetreatRegistrationInvite(claims: AuthClaims, input: { retreatId: string; createdBy: string }, inviteStore?: InviteStore, retreatStore?: Pick<RetreatStore, 'getById'>): Promise<Invite>`

Behavior:
1. Require `canManageRetreats`.
2. Load retreat; `NOT_FOUND` if missing; `FORBIDDEN` if `!canAccessOrgUnit(claims, retreat.orgUnitId)`.
3. `const id = retreatRegistrationInviteId(retreat.id)`; if `getByToken(id)` exists and not disabled, return it.
4. Else `create` invite: `{ id, token: id, kind: 'retreat_registration', retreatId: retreat.id, orgUnitId: retreat.orgUnitId, disabled: false, createdBy, createdAt: now }`.

- [ ] **Step 1: Write failing tests** with in-memory invite + retreat maps (giao_doan scoped deny; idempotent ensure).

- [ ] **Step 2: Run — expect FAIL**

Run: `cd tanstack-app && pnpm test -- src/use-cases/ensureRetreatRegistrationInvite.test.ts`

- [ ] **Step 3: Implement use-case**

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/use-cases/ensureRetreatRegistrationInvite.ts tanstack-app/src/use-cases/ensureRetreatRegistrationInvite.test.ts
git commit -m "$(cat <<'EOF'
feat: ensure per-retreat registration invite for copy-link.

EOF
)"
```

---

### Task 5: `createRetreatRegistration`

**Files:**
- Create: `tanstack-app/src/use-cases/createRetreatRegistration.ts`
- Create: `tanstack-app/src/use-cases/createRetreatRegistration.test.ts`

**Interfaces:**
- Consumes: domain guards, `RetreatStore.getById`, `MemberStore.getById` (or existing member get), `RetreatRegistrationStore`
- Produces:
  - `export async function createRetreatRegistration(input: { claims: AuthClaims | null; retreatId: string; memberId: string; registeredVia: RegisteredVia; registeredBy: string | null; extraAnswers: Record<string, string>; nowIso?: string }, deps?): Promise<RetreatRegistration>`

Behavior:
1. Load retreat; not found → `NOT_FOUND`.
2. `assertRegistrationOpen(retreat, nowIso ?? new Date().toISOString())`.
3. `assertQuyenAllows(retreat.quyenDangKy, registeredVia)`.
4. If `registeredVia === 'proxy'`: require `claims` and `canManageRetreats` + `canAccessOrgUnit(claims, retreat.orgUnitId)`; `registeredBy` must be non-null uid.
5. If `registeredVia === 'self'`: `claims` may be null; `registeredBy` must be null.
6. Load member; not found → `NOT_FOUND`; `assertMemberOrgMatches(member.orgUnitId, retreat.orgUnitId)`.
7. `validateExtraAnswers(retreat.extraFields, extraAnswers)`.
8. `id = retreatRegistrationId(retreatId, memberId)`; if `getById(id)` exists → `ALREADY_EXISTS`.
9. Persist `{ id, retreatId, memberId, orgUnitId: retreat.orgUnitId, registeredVia, registeredBy, extraAnswers, status: 'pending', approvedBy: null, approvedAt: null, createdAt, updatedAt }`.

- [ ] **Step 1: Write failing tests** covering: happy self, happy proxy, closed window, wrong quyen, wrong org, duplicate, proxy without claims.

- [ ] **Step 2: Run — FAIL**

Run: `cd tanstack-app && pnpm test -- src/use-cases/createRetreatRegistration.test.ts`

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/use-cases/createRetreatRegistration.ts tanstack-app/src/use-cases/createRetreatRegistration.test.ts
git commit -m "$(cat <<'EOF'
feat: add createRetreatRegistration with shared eligibility guards.

EOF
)"
```

---

### Task 6: Firestore rules + indexes + integration tests

**Files:**
- Modify: `firebase/firestore.rules`
- Modify: `firebase/firestore.indexes.json`
- Modify: `tanstack-app/src/firebase/firestoreRules.integration.test.ts`

**Interfaces:**
- Consumes: existing `canWriteDirectory`, `retreatOrgOk`
- Produces: rules behavior below

**Rules changes:**

1. **`invites` create** — keep `id == token` + `createdBy == uid`; allow extra fields. Optionally require:
   - filler: `kind == 'filler'` or missing (legacy) with `id == 'public'`
   - retreat: `kind == 'retreat_registration' && retreatId is string && orgUnitId is string && id == ('retreat_' + retreatId)`
2. **`retreats` get:** `allow get: if true;` (public by id). Keep list/write as Phase 1.
3. **`retreatRegistrations/{id}`:**
   - `allow get, list: if canWriteDirectory() && retreatOrgOk(resource.data.orgUnitId);` — for list queries, Firestore rules evaluate per-doc; staff queries must filter `orgUnitId` for giao_doan (same pattern as retreats).
   - `allow create:`  
     - Staff proxy: `canWriteDirectory() && retreatOrgOk(request.resource.data.orgUnitId) && request.resource.data.registeredVia == 'proxy' && request.resource.data.registeredBy == request.auth.uid && request.resource.data.status == 'pending' && request.resource.data.approvedBy == null && id == request.resource.data.retreatId + '_' + request.resource.data.memberId`  
     - Self: `!isStaff() && request.resource.data.registeredVia == 'self' && request.resource.data.registeredBy == null && request.resource.data.status == 'pending' && request.resource.data.approvedBy == null && same id shape`  
   - `allow update, delete: if false;`

4. **Indexes:** add

```json
{
  "collectionGroup": "retreatRegistrations",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "retreatId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

Optionally also `retreatId + orgUnitId + createdAt` if list queries constrain org for giao_doan_admin.

- [ ] **Step 1: Write failing integration tests** (anon get retreat succeeds; anon create self registration succeeds with pending shape; anon list fails; gd list own org succeeds / other org doc denied; staff update status fails; create retreat invite succeeds for admin).

Update existing tests that assumed `giao_doan_admin` **cannot** `getDoc` another org’s retreat — after public get, that assertion must flip to **succeeds**. `kiem_soat` get-by-id also succeeds; list/write still fail.

- [ ] **Step 2: Run integration suite — expect FAIL on new cases**

Run: from repo root / `tanstack-app` the project’s firestore rules test script (see `package.json` — typically `pnpm test:integration` or filter `firestoreRules.integration.test.ts`).

- [ ] **Step 3: Implement rules + indexes**

- [ ] **Step 4: Run integration — PASS**

- [ ] **Step 5: Commit**

```bash
git add firebase/firestore.rules firebase/firestore.indexes.json tanstack-app/src/firebase/firestoreRules.integration.test.ts
git commit -m "$(cat <<'EOF'
feat: open retreat get and add retreatRegistrations rules.

EOF
)"
```

---

### Task 7: Query options + admin registrations UI

**Files:**
- Modify: `tanstack-app/src/query/adminKeys.ts` — `retreatRegistrations(retreatId)`, keep `retreat(id)`
- Modify: `tanstack-app/src/query/adminQueries.ts` — `retreatRegistrationsQuery(retreatId)`
- Modify: `tanstack-app/messages/vi.json` — list/copy/proxy strings (run paraglide compile if required by repo)
- Create: `tanstack-app/src/components/admin/RetreatRegistrationsPage.tsx`
- Create: `tanstack-app/src/components/admin/RetreatRegistrationsPage.test.tsx`
- Create: `tanstack-app/src/components/admin/CopyRetreatRegistrationLinkButton.tsx` (mirror `AdminCopyFormLinkButton`, URL `/r/${token}`)
- Create: `tanstack-app/src/routes/admin/retreats.$id.registrations.tsx` (or nest under retreat layout — follow existing TanStack file-route conventions; if sibling conflict with `retreats.$id.tsx`, prefer path `/admin/retreats/$id/registrations` via `retreats.$id.registrations.tsx` and keep edit at `$id` / `$id/` as today)
- Modify: `RetreatFormPage` or list row — link “Đăng ký” / “Danh sách đăng ký” to the registrations route
- Modify: `adminBreadcrumbs` if the app uses a breadcrumb map

**UI behavior:**
- Gate with `canManageRetreats` (same as other retreat pages).
- Header: copy registration link; title with retreat name.
- Table: createdAt, memberId (and phapDanh/theDanh if easy via `memberQuery` batch or show id first), registeredVia, status badge.
- Proxy panel: sanghaType select + phone input → `resumeMemberByPhone` with token = retreat invite token (ensure invite first) and `orgUnitId` = retreat.orgUnitId → pick member → extraAnswers inputs from `retreat.extraFields` → submit `createRetreatRegistration` proxy.
- No approve buttons.

- [ ] **Step 1: Write component test** — renders empty list copy; shows proxy form controls; copy button present (mock ensure + clipboard like `AdminCopyFormLinkButton.test.tsx`).

- [ ] **Step 2: Run — FAIL**

Run: `cd tanstack-app && pnpm test -- src/components/admin/RetreatRegistrationsPage.test.tsx`

- [ ] **Step 3: Implement queries + page + route + i18n**

- [ ] **Step 4: Run — PASS** (also `adminKeys` tests if updated)

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/query/adminKeys.ts tanstack-app/src/query/adminQueries.ts tanstack-app/src/components/admin/RetreatRegistrationsPage.tsx tanstack-app/src/components/admin/RetreatRegistrationsPage.test.tsx tanstack-app/src/components/admin/CopyRetreatRegistrationLinkButton.tsx tanstack-app/src/routes/admin/retreats.$id.registrations.tsx tanstack-app/messages/vi.json
git commit -m "$(cat <<'EOF'
feat: add admin read-only retreat registrations page and copy link.

EOF
)"
```

---

### Task 8: Self-service `/r/$token` flow

**Files:**
- Create: `tanstack-app/src/query/registrationQueries.ts` — `retreatInviteByTokenQuery`, `publicRetreatQuery`
- Create: `tanstack-app/src/routes/r.$token.tsx` — layout: load invite; require `kind === 'retreat_registration'` && `!disabled`; load retreat; show outlet or gate errors
- Create: `tanstack-app/src/routes/r.$token.index.tsx` — phone + sanghaType entry (org locked from invite)
- Create: `tanstack-app/src/routes/r.$token.register.$memberId.tsx` — confirm summary + extraAnswers + submit
- Create: `tanstack-app/src/routes/r.$token.member.new.tsx` (and/or reuse filler member editor under `/r/$token/member/new` then navigate to register) — full member create with locked `orgUnitId` / `inviteId`
- Create: `tanstack-app/src/components/registration/*` as needed (`RetreatRegistrationEntry`, `RetreatRegistrationConfirm`, etc.) + tests
- Modify: `messages/vi.json`

**Flow wiring:**
1. Layout validates invite + retreat open/window/quyen for self (show Alert if not).
2. Index: phone lookup via `resumeMemberByPhone({ token, orgUnitId: invite.orgUnitId, sanghaType, phone })`.
3. 0 matches → navigate to new-member editor (reuse `MemberEditorForm` / filler save with retreat invite id); on save success → register route for that memberId.
4. 1 match → register route; many → pick list then register route.
5. Register route: read-only member summary; extraAnswers; `createRetreatRegistration` self; success Alert.

Do **not** allow editing existing member profile on the register route.

- [ ] **Step 1: Write component/route tests** for gate error when closed; success path with mocked use-cases (follow `FillerEntryForm` / admin form test patterns).

- [ ] **Step 2: Run — FAIL**

Run: `cd tanstack-app && pnpm test -- src/components/registration`

- [ ] **Step 3: Implement routes + components**

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/query/registrationQueries.ts tanstack-app/src/routes/r.\$token.tsx tanstack-app/src/routes/r.\$token.index.tsx tanstack-app/src/routes/r.\$token.register.\$memberId.tsx tanstack-app/src/components/registration tanstack-app/messages/vi.json
git commit -m "$(cat <<'EOF'
feat: add public /r token self-registration flow for khóa tu.

EOF
)"
```

---

### Task 9: Roadmap status + smoke checklist

**Files:**
- Modify: `docs/superpowers/specs/2026-07-25-khoa-tu-roadmap-design.md` — Phase 2 plan link + status `Đã lập kế hoạch` then `Đang thực hiện` / `Hoàn thành` when done
- Optionally add a short “Phase 2 smoke” subsection to the design or plan footer

- [ ] **Step 1: Update roadmap table**

| Phase 2 | … | Đã lập kế hoạch | [2026-07-30-khoa-tu-registration-phase2.md](../plans/2026-07-30-khoa-tu-registration-phase2.md) |

When implementation finishes on the feature branch, set **Hoàn thành** and Next step → Phase 3 design.

- [ ] **Step 2: Manual smoke (human)**  
  1. Admin open retreat → copy `/r/retreat_…` link  
  2. Self: new member full form → pending row appears  
  3. Self: existing phone → confirm → pending  
  4. Proxy: phone → pending with `proxy`  
  5. Duplicate / closed window rejected  
  6. Filler `/f/public` still works  

- [ ] **Step 3: Commit docs**

```bash
git add docs/superpowers/specs/2026-07-25-khoa-tu-roadmap-design.md
git commit -m "$(cat <<'EOF'
docs: link Phase 2 registration plan on the khóa tu roadmap.

EOF
)"
```

---

## Self-review (author)

| Spec requirement | Task |
| --- | --- |
| Per-retreat invite | 1, 4 |
| `retreatRegistrations` schema + uniqueness | 2, 3, 5 |
| Self + proxy channels + quyen/window/org | 5, 7, 8 |
| Full member create on self miss | 8 |
| Existing confirm-only | 8 |
| Proxy phone only, no create member | 7 |
| Admin read-only list + copy link | 7 |
| Rules: public retreat get, no status update | 6 |
| Filler unchanged | 1 (`kind: filler`), 8 does not touch `/f` |
| Indexes | 6 |

No TBD placeholders. Types aligned: `Invite.kind`, `retreatRegistrationId`, `createRetreatRegistration` signatures reused by Tasks 7–8.

---

## Execution notes

- Start: `git checkout main && git pull && git checkout -b feat/khoa-tu-registration-phase2`
- After merge: delete local feature branch per workspace rule.
- Deploy `firestore.rules` + `firestore.indexes.json` before production use of registration.
