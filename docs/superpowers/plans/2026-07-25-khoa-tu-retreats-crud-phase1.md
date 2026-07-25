# Khóa tu — Phase 1: CRUD khóa tu (Giáo đoàn) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship scoped admin CRUD for Giáo đoàn retreats (`retreats` collection), role-aware Firestore/Storage rules, and a `kiem_soat` capability split so only `he_phai_admin` / `giao_doan_admin` (plus legacy `admin: true`) can manage directory data and retreats.

**Architecture:** Pure domain types + status helpers and capability functions; `retreatRepo` for Firestore I/O; use-cases that take `AuthClaims` and enforce scope/status; TanStack `queryOptions` + admin pages mirroring temples. Rules gain `canWriteDirectory` / retreat org-scope helpers alongside legacy `admin == true`.

**Tech Stack:** TypeScript, Firebase Auth custom claims, Firestore, Vitest (+ `@firebase/rules-unit-testing` for rules), TanStack Router/Query, Mantine, Paraglide (`messages/vi.json`).

## Global Constraints

- Spec: [docs/superpowers/specs/2026-07-25-khoa-tu-retreats-crud-phase1-design.md](../specs/2026-07-25-khoa-tu-retreats-crud-phase1-design.md)
- Phase 1 creates only `type: 'giao_doan'`; never write `status: 'finalized'`.
- Date/time fields on `Retreat` are **ISO-8601 strings** (same as `Member`/`Temple` `createdAt`), not Firestore `Timestamp` objects in app types.
- Legacy `admin: true` (no `role`) remains full `he_phai_admin` power in client helpers and rules.
- `kiem_soat` may enter `/admin` shell but must not list/write members, temples, orgUnits (admin writes), invites (admin), phone-index admin deletes, or retreats.
- Import alias: `#/domain/...`, `#/repositories/...`, `#/use-cases/...`, `#/query/...`, `#/components/...`.
- No comments unless explaining non-obvious WHY.
- Workspace rule: implement on a **new branch from `main`** (`feat/khoa-tu-retreats-phase1`); do **not** use git worktrees.
- TDD: failing test → implement → pass → commit per task.
- Run unit tests from `tanstack-app`: `pnpm test -- <path>`. Integration/rules tests need emulators per `package.json` (`test:integration` / existing firestore rules suite).

---

## File Structure

- Modify: `tanstack-app/src/domain/authClaims.ts` — add `canManageDirectory`, `canManageRetreats`
- Modify: `tanstack-app/src/domain/authClaims.test.ts` — capability tests
- Modify: `tanstack-app/src/domain/errors.ts` — add `INVALID_STATUS` code
- Create: `tanstack-app/src/domain/retreat.ts` — `Retreat` types + transition/validation helpers
- Create: `tanstack-app/src/domain/retreat.test.ts`
- Modify: `tanstack-app/src/firebase/collections.ts` — `retreats: 'retreats'`
- Modify: `tanstack-app/src/repositories/adminListTypes.ts` — `ListRetreatsAdminInput`
- Create: `tanstack-app/src/repositories/retreatRepo.ts`
- Create: `tanstack-app/src/use-cases/createRetreat.ts` (+ open/close/update/delete)
- Create: matching `*.test.ts` for use-cases (memory/fake store)
- Modify: `firebase/firestore.rules`, `firebase/storage.rules`
- Modify: `tanstack-app/src/firebase/firestoreRules.integration.test.ts`, `storageRules.integration.test.ts`
- Modify: `tanstack-app/src/query/adminKeys.ts`, `adminQueries.ts`
- Modify: `AdminShell`, `adminBreadcrumbs`, existing admin list/form pages (capability gates), `routes/admin/index.tsx`
- Create: retreat admin pages + routes under `admin/retreats`
- Modify: `tanstack-app/messages/vi.json` — nav/form/list strings
- Modify: roadmap phase table status → Đã lập kế hoạch / Đang thực hiện as appropriate

---

### Task 1: Capability helpers + `INVALID_STATUS`

**Files:**
- Modify: `tanstack-app/src/domain/authClaims.ts`
- Modify: `tanstack-app/src/domain/authClaims.test.ts`
- Modify: `tanstack-app/src/domain/errors.ts`

**Interfaces:**
- Consumes: existing `AuthClaims`, `AdminRole`
- Produces:
  - `export function canManageDirectory(claims: AuthClaims): boolean`
  - `export function canManageRetreats(claims: AuthClaims): boolean`
  - `DomainErrorCode` includes `'INVALID_STATUS'`

- [ ] **Step 1: Write the failing tests**

Append to `authClaims.test.ts`:

```ts
import {
  canAccessOrgUnit,
  canManageDirectory,
  canManageRetreats,
  parseAuthClaims,
} from './authClaims'

describe('canManageDirectory / canManageRetreats', () => {
  it('allows he_phai_admin', () => {
    const c = { role: 'he_phai_admin' as const, orgUnitId: null }
    expect(canManageDirectory(c)).toBe(true)
    expect(canManageRetreats(c)).toBe(true)
  })

  it('allows giao_doan_admin', () => {
    const c = { role: 'giao_doan_admin' as const, orgUnitId: 'gd-i' }
    expect(canManageDirectory(c)).toBe(true)
    expect(canManageRetreats(c)).toBe(true)
  })

  it('denies kiem_soat', () => {
    const c = { role: 'kiem_soat' as const, orgUnitId: 'gd-i' }
    expect(canManageDirectory(c)).toBe(false)
    expect(canManageRetreats(c)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tanstack-app && pnpm test -- src/domain/authClaims.test.ts`

Expected: FAIL — `canManageDirectory` / `canManageRetreats` not exported

- [ ] **Step 3: Write minimal implementation**

In `authClaims.ts`:

```ts
export function canManageDirectory(claims: AuthClaims): boolean {
  return claims.role === 'he_phai_admin' || claims.role === 'giao_doan_admin'
}

export function canManageRetreats(claims: AuthClaims): boolean {
  return canManageDirectory(claims)
}
```

In `errors.ts`, add `'INVALID_STATUS'` to `DomainErrorCode`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tanstack-app && pnpm test -- src/domain/authClaims.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/domain/authClaims.ts tanstack-app/src/domain/authClaims.test.ts tanstack-app/src/domain/errors.ts
git commit -m "$(cat <<'EOF'
feat: add directory/retreat capability helpers for admin roles

EOF
)"
```

---

### Task 2: Retreat domain types + transitions

**Files:**
- Create: `tanstack-app/src/domain/retreat.ts`
- Create: `tanstack-app/src/domain/retreat.test.ts`

**Interfaces:**
- Consumes: `DomainError`
- Produces:
  - `export type RetreatType = 'giao_doan' | 'he_phai'`
  - `export type RetreatStatus = 'draft' | 'open' | 'closed'`
  - `export type QuyenDangKy = 'tu_dang_ky' | 'proxy_only' | 'both'`
  - `export type RetreatExtraField = { key: string; label: string; required: boolean }`
  - `export type Retreat = { id: string; type: RetreatType; orgUnitId: string; name: string; diaDiem: string; noiDung: string; doiTuongThamDu: string; thoiGianBatDau: string; thoiGianKetThuc: string; dangKyMoTu: string; dangKyDongLuc: string; extraFields: RetreatExtraField[]; quyenDangKy: QuyenDangKy; status: RetreatStatus; createdBy: string; createdAt: string; updatedAt: string }`
  - `export type RetreatWritableFields = Omit<Retreat, 'id' | 'type' | 'orgUnitId' | 'status' | 'createdBy' | 'createdAt' | 'updatedAt'>`
  - `export function assertCanOpen(status: RetreatStatus): void`
  - `export function assertCanClose(status: RetreatStatus): void`
  - `export function assertCanDelete(status: RetreatStatus): void`
  - `export function validateRetreatFields(fields: RetreatWritableFields): void`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { DomainError } from './errors'
import {
  assertCanClose,
  assertCanDelete,
  assertCanOpen,
  validateRetreatFields,
  type RetreatWritableFields,
} from './retreat'

const validFields = (): RetreatWritableFields => ({
  name: 'Khóa tu hè',
  diaDiem: 'TX Trung Tâm',
  noiDung: 'Thiền',
  doiTuongThamDu: 'Tăng ni',
  thoiGianBatDau: '2026-08-01T00:00:00.000Z',
  thoiGianKetThuc: '2026-08-07T00:00:00.000Z',
  dangKyMoTu: '2026-07-01T00:00:00.000Z',
  dangKyDongLuc: '2026-07-20T00:00:00.000Z',
  extraFields: [{ key: 'phong', label: 'Phòng', required: false }],
  quyenDangKy: 'both',
})

describe('assertCanOpen', () => {
  it('allows draft and closed', () => {
    expect(() => assertCanOpen('draft')).not.toThrow()
    expect(() => assertCanOpen('closed')).not.toThrow()
  })
  it('rejects open', () => {
    expect(() => assertCanOpen('open')).toThrow(DomainError)
  })
})

describe('assertCanClose', () => {
  it('allows open only', () => {
    expect(() => assertCanClose('open')).not.toThrow()
    expect(() => assertCanClose('draft')).toThrow(DomainError)
  })
})

describe('assertCanDelete', () => {
  it('allows draft only', () => {
    expect(() => assertCanDelete('draft')).not.toThrow()
    expect(() => assertCanDelete('open')).toThrow(DomainError)
  })
})

describe('validateRetreatFields', () => {
  it('accepts valid fields', () => {
    expect(() => validateRetreatFields(validFields())).not.toThrow()
  })
  it('rejects empty name', () => {
    expect(() =>
      validateRetreatFields({ ...validFields(), name: '  ' }),
    ).toThrow(DomainError)
  })
  it('rejects duplicate extraField keys', () => {
    expect(() =>
      validateRetreatFields({
        ...validFields(),
        extraFields: [
          { key: 'a', label: 'A', required: true },
          { key: 'a', label: 'B', required: false },
        ],
      }),
    ).toThrow(DomainError)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tanstack-app && pnpm test -- src/domain/retreat.test.ts`

Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

Implement `retreat.ts`:

- `assertCanOpen`: throw `DomainError('INVALID_STATUS', ...)` unless status is `draft` or `closed`
- `assertCanClose`: only `open`
- `assertCanDelete`: only `draft`
- `validateRetreatFields`: trim-check non-empty strings for name/diaDiem/noiDung/doiTuongThamDu and the four date strings; `quyenDangKy` in the union; `extraFields` keys non-empty and unique (case-sensitive)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tanstack-app && pnpm test -- src/domain/retreat.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/domain/retreat.ts tanstack-app/src/domain/retreat.test.ts
git commit -m "$(cat <<'EOF'
feat: add Retreat domain types and status transition helpers

EOF
)"
```

---

### Task 3: `retreatRepo`

**Files:**
- Modify: `tanstack-app/src/firebase/collections.ts` — add `retreats: 'retreats'`
- Modify: `tanstack-app/src/repositories/adminListTypes.ts` — add `ListRetreatsAdminInput`
- Create: `tanstack-app/src/repositories/retreatRepo.ts`
- Create: `tanstack-app/src/repositories/retreatRepo.memory.test.ts` (fake in-memory store exercising the `RetreatStore` interface used by use-cases — prefer testing via a small in-memory implementation in the test file, same style as other `*.memory.test.ts`)

**Interfaces:**
- Consumes: `Retreat`, `COLLECTIONS`, `getClientFirestore`, `AdminListPage`
- Produces:

```ts
export type ListRetreatsAdminInput = {
  orgUnitId?: string
  status?: RetreatStatus
  limit?: number
  cursor?: string
}

export type CreateRetreatInput = {
  orgUnitId: string
  createdBy: string
  fields: RetreatWritableFields
}

export type RetreatStore = {
  create(input: CreateRetreatInput): Promise<Retreat>
  update(id: string, fields: RetreatWritableFields): Promise<Retreat>
  setStatus(id: string, status: RetreatStatus): Promise<Retreat>
  getById(id: string): Promise<Retreat | null>
  list(input: ListRetreatsAdminInput): Promise<AdminListPage<Retreat>>
  delete(id: string): Promise<void>
}

export const retreatRepo: RetreatStore
```

- [ ] **Step 1: Write the failing memory-store contract test**

Create `retreatRepo.memory.test.ts` that defines a local `MemoryRetreatStore` implementing `RetreatStore` (map by id) and asserts create → getById → update → setStatus → list filter → delete. Import the `RetreatStore` / `CreateRetreatInput` types from `./retreatRepo` (file must exist exporting types; implementation can throw until Step 3).

If exporting types before impl is awkward, create the file with types + `export const retreatRepo` stub that throws, then fill in Step 3.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tanstack-app && pnpm test -- src/repositories/retreatRepo.memory.test.ts`

Expected: FAIL until store/types exist and behavior matches

- [ ] **Step 3: Implement Firestore `retreatRepo`**

Mirror `templeRepo.list` pagination (`orderBy('updatedAt','desc')`, `limit`, `startAfter` cursor doc). Persist ISO strings. `create` uses `doc(collection(...))` auto-id, sets `type: 'giao_doan'`, `status: 'draft'`, timestamps. `update` loads existing, merges writable fields only, bumps `updatedAt`. `setStatus` updates `status` + `updatedAt`. `delete` deletes the doc (status guard lives in use-case).

Also export a `createMemoryRetreatStore(): RetreatStore` from the test file or a tiny `retreatRepo.memory.ts` **only if** later use-case tests need it — prefer defining the memory store inside use-case tests (Task 4) to avoid extra production files.

- [ ] **Step 4: Run memory test PASS**

Run: `cd tanstack-app && pnpm test -- src/repositories/retreatRepo.memory.test.ts`

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/firebase/collections.ts tanstack-app/src/repositories/adminListTypes.ts tanstack-app/src/repositories/retreatRepo.ts tanstack-app/src/repositories/retreatRepo.memory.test.ts
git commit -m "$(cat <<'EOF'
feat: add retreats collection repo for admin CRUD

EOF
)"
```

---

### Task 4: Retreat use-cases

**Files:**
- Create: `tanstack-app/src/use-cases/createRetreat.ts`
- Create: `tanstack-app/src/use-cases/updateRetreat.ts`
- Create: `tanstack-app/src/use-cases/openRetreat.ts`
- Create: `tanstack-app/src/use-cases/closeRetreat.ts`
- Create: `tanstack-app/src/use-cases/deleteRetreat.ts`
- Create: `tanstack-app/src/use-cases/retreatUseCases.test.ts` (single suite with in-memory store)

**Interfaces:**
- Consumes: `AuthClaims`, `canManageRetreats`, `canAccessOrgUnit`, domain asserts, `RetreatStore`
- Produces:

```ts
createRetreat(claims: AuthClaims, input: {
  orgUnitId?: string
  createdBy: string
  fields: RetreatWritableFields
}, store?: RetreatStore): Promise<Retreat>

updateRetreat(claims: AuthClaims, input: {
  retreatId: string
  fields: RetreatWritableFields
}, store?: RetreatStore): Promise<Retreat>

openRetreat(claims: AuthClaims, retreatId: string, store?: RetreatStore): Promise<Retreat>
closeRetreat(claims: AuthClaims, retreatId: string, store?: RetreatStore): Promise<Retreat>
deleteRetreat(claims: AuthClaims, retreatId: string, store?: RetreatStore): Promise<void>
```

**Behavior:**
- All: if `!canManageRetreats(claims)` → `FORBIDDEN`
- `createRetreat`: resolve `orgUnitId` — if `giao_doan_admin`, must use `claims.orgUnitId` (non-null) and ignore/forbid mismatched input; if `he_phai_admin`, require `input.orgUnitId`. Validate fields. `store.create`.
- `update` / `open` / `close` / `delete`: `getById` → `NOT_FOUND`; `!canAccessOrgUnit(claims, retreat.orgUnitId)` → `FORBIDDEN`; then domain assert + store method.

- [ ] **Step 1: Write failing use-case tests**

Cover at least:
1. `giao_doan_admin` creates for own org
2. `giao_doan_admin` cannot create for other org
3. `kiem_soat` create → FORBIDDEN
4. `he_phai_admin` creates for any org
5. open/close/delete happy path + invalid status
6. `giao_doan_admin` cannot update other org’s retreat

Use an in-memory `RetreatStore` in the test file.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd tanstack-app && pnpm test -- src/use-cases/retreatUseCases.test.ts`

- [ ] **Step 3: Implement the five use-case modules**

Default `store = retreatRepo`.

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/use-cases/createRetreat.ts tanstack-app/src/use-cases/updateRetreat.ts tanstack-app/src/use-cases/openRetreat.ts tanstack-app/src/use-cases/closeRetreat.ts tanstack-app/src/use-cases/deleteRetreat.ts tanstack-app/src/use-cases/retreatUseCases.test.ts
git commit -m "$(cat <<'EOF'
feat: add scoped retreat create/update/open/close/delete use-cases

EOF
)"
```

---

### Task 5: Firestore + Storage rules

**Files:**
- Modify: `firebase/firestore.rules`
- Modify: `firebase/storage.rules`
- Modify: `tanstack-app/src/firebase/firestoreRules.integration.test.ts`
- Modify: `tanstack-app/src/firebase/storageRules.integration.test.ts`

**Interfaces:**
- Produces rules helpers (names exact):

```
function isLegacyAdmin()          // token.admin == true
function role()                   // token.role
function isHePhaiAdmin()          // legacy OR role == 'he_phai_admin'
function isGiaoDoanAdmin()        // role == 'giao_doan_admin'
function isKiemSoat()             // role == 'kiem_soat'
function isStaff()                // he_phai OR giao_doan OR kiem_soat OR legacy
function canWriteDirectory()      // he_phai OR giao_doan OR legacy (NOT kiem_soat)
function retreatOrgOk(orgUnitId)  // he_phai/legacy OR (giao_doan && token.orgUnitId == orgUnitId)
```

Replace directory **list/write/delete** gates that today use `isAdmin()` with `canWriteDirectory()` where the operation is admin-only management (members list/delete, temples list/delete, orgUnits write, invites list/create, phone index list/delete, and admin branch of member/temple create/update). Keep public `get` and invite-scoped non-admin paths unchanged.

Add:

```
match /retreats/{id} {
  allow get: if canWriteDirectory() && retreatOrgOk(resource.data.orgUnitId);
  allow list: if canWriteDirectory();
  allow create: if canWriteDirectory()
    && request.resource.data.type == 'giao_doan'
    && request.resource.data.status == 'draft'
    && retreatOrgOk(request.resource.data.orgUnitId)
    && request.resource.data.orgUnitId is string
    && request.resource.data.createdBy == request.auth.uid;
  allow update: if canWriteDirectory()
    && retreatOrgOk(resource.data.orgUnitId)
    && request.resource.data.type == resource.data.type
    && request.resource.data.orgUnitId == resource.data.orgUnitId
    && request.resource.data.createdBy == resource.data.createdBy
    && request.resource.data.createdAt == resource.data.createdAt;
  allow delete: if canWriteDirectory()
    && retreatOrgOk(resource.data.orgUnitId)
    && resource.data.status == 'draft';
}
```

Note: `giao_doan_admin` list queries **must** include `where('orgUnitId','==', claim.orgUnitId)` or Firestore will deny the query. Document in repo list call sites (Task 6 UI always passes it).

Storage: change `isAdmin()` used for member photo write/delete to `canWriteDirectory()` equivalent (same claim checks). Keep invite-token path.

- [ ] **Step 1: Add failing rules tests**

In `firestoreRules.integration.test.ts`:

```ts
function retreatDraft(overrides: Record<string, unknown> = {}) {
  return {
    type: 'giao_doan',
    orgUnitId: 'gd-i',
    name: 'Khoa',
    diaDiem: 'TX',
    noiDung: 'n',
    doiTuongThamDu: 't',
    thoiGianBatDau: '2026-08-01T00:00:00.000Z',
    thoiGianKetThuc: '2026-08-07T00:00:00.000Z',
    dangKyMoTu: '2026-07-01T00:00:00.000Z',
    dangKyDongLuc: '2026-07-20T00:00:00.000Z',
    extraFields: [],
    quyenDangKy: 'both',
    status: 'draft',
    createdBy: 'gd-admin',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('retreats + role claims', () => {
  it('giao_doan_admin can create/get in own org, not other org', async () => {
    const env = await getTestEnv()
    const gd = env.authenticatedContext('gd-admin', {
      role: 'giao_doan_admin',
      orgUnitId: 'gd-i',
    }).firestore()
    await assertSucceeds(setDoc(doc(gd, 'retreats/r1'), retreatDraft({ createdBy: 'gd-admin' })))
    await assertSucceeds(getDoc(doc(gd, 'retreats/r1')))
    await assertFails(
      setDoc(doc(gd, 'retreats/r2'), retreatDraft({ orgUnitId: 'gd-ii', createdBy: 'gd-admin' })),
    )
  })

  it('kiem_soat cannot write retreats or orgUnits', async () => {
    const env = await getTestEnv()
    const ks = env.authenticatedContext('ks', {
      role: 'kiem_soat',
      orgUnitId: 'gd-i',
    }).firestore()
    await assertFails(setDoc(doc(ks, 'retreats/r1'), retreatDraft({ createdBy: 'ks' })))
    await assertFails(
      setDoc(doc(ks, 'orgUnits/gd-x'), {
        code: 'gd-x',
        name: 'x',
        kind: 'giao_doan',
        order: 9,
        allowsTang: true,
        allowsNi: true,
      }),
    )
  })

  it('legacy admin:true can still write orgUnits and retreats', async () => {
    const env = await getTestEnv()
    const admin = env.authenticatedContext('admin-uid', { admin: true }).firestore()
    await assertSucceeds(
      setDoc(doc(admin, 'retreats/r3'), retreatDraft({ createdBy: 'admin-uid' })),
    )
  })
})
```

Add storage test: `kiem_soat` cannot `uploadBytes` as admin (no invite) to member photo; legacy admin still can.

- [ ] **Step 2: Run rules tests — expect FAIL**

Run integration script from `tanstack-app` (emulators up): use the existing `pnpm test:integration` or the project’s documented firestore rules test command so emulators are available.

Expected: FAIL on new cases (old `isAdmin()` still requires `admin: true`)

- [ ] **Step 3: Update rules**

Implement helpers and replace gates as specified. Keep existing member/temple invite logic; only swap admin branches to `canWriteDirectory()`.

- [ ] **Step 4: Run rules tests — expect PASS** (including pre-existing cases)

- [ ] **Step 5: Commit**

```bash
git add firebase/firestore.rules firebase/storage.rules tanstack-app/src/firebase/firestoreRules.integration.test.ts tanstack-app/src/firebase/storageRules.integration.test.ts
git commit -m "$(cat <<'EOF'
feat: teach Firestore/Storage rules about role-scoped admin access

EOF
)"
```

---

### Task 6: Query keys + gate existing admin UI for `kiem_soat`

**Files:**
- Modify: `tanstack-app/src/query/adminKeys.ts`
- Modify: `tanstack-app/src/query/adminQueries.ts`
- Modify: `tanstack-app/src/components/admin/AdminShell.tsx`
- Modify: `tanstack-app/src/components/admin/AdminShell.test.tsx`
- Modify: `tanstack-app/src/routes/admin/index.tsx`
- Modify: list/form pages that use `claim.status === 'admin'` for data access:
  - `TemplesListPage.tsx`, `TempleFormPage.tsx`
  - `MembersListPage.tsx`, `MemberFormPage.tsx`
  - `OrgUnitsPage.tsx`
- Modify tests that mock `useAdminClaim` if they need `role` (already often `he_phai_admin`)

**Interfaces:**
- Produces:

```ts
// adminKeys
retreats: (filters: ListRetreatsAdminInput) => [...adminKeys.all, 'retreats', filters]
retreat: (id: string) => [...adminKeys.all, 'retreat', id]

// adminQueries
retreatsQuery(filters), retreatQuery(id) // mirror templeQuery NOT_FOUND behavior
```

**AdminShell:** build `navItems` filtered by capability — directory items require `canManageDirectory`; add retreats item when `canManageRetreats` (label from i18n — add message keys in this task or Task 7; if messages missing, add minimal `admin_nav_retreats` now).

**`/admin/` index:** if `canManageDirectory` → navigate temples; else if `canManageRetreats` → navigate retreats; else render a small empty state (Title/Text) inside shell — not `Navigate` to temples.

**Pages:** `enabled: claim.status === 'admin' && canManageDirectory({ role: claim.role, orgUnitId: claim.orgUnitId })` (or helper that accepts claim). If admin but `!canManageDirectory`, render `<AdminDenied />` instead of the page body.

- [ ] **Step 1: Write/adjust failing AdminShell test**

Assert `kiem_soat` mock does not render temples/org-units nav links; `giao_doan_admin` does.

- [ ] **Step 2: Run AdminShell test — expect FAIL**

- [ ] **Step 3: Implement keys, queries, shell filter, index redirect, page gates**

Add to `vi.json` at least:

```json
"admin_nav_retreats": "Khóa tu",
"admin_kiem_soat_empty_title": "Chưa có chức năng",
"admin_kiem_soat_empty_body": "Tài khoản kiểm soát chưa có màn hình làm việc trong giai đoạn này."
```

Run `pnpm paraglide` as part of test script (already in `pnpm test`).

- [ ] **Step 4: Run affected unit tests PASS**

Run: `cd tanstack-app && pnpm test -- src/components/admin/AdminShell.test.tsx src/components/admin/TemplesListPage.test.tsx src/components/admin/MembersListPage.test.tsx src/components/admin/OrgUnitsPage.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/query/adminKeys.ts tanstack-app/src/query/adminQueries.ts tanstack-app/src/components/admin/AdminShell.tsx tanstack-app/src/components/admin/AdminShell.test.tsx tanstack-app/src/routes/admin/index.tsx tanstack-app/src/components/admin/TemplesListPage.tsx tanstack-app/src/components/admin/TempleFormPage.tsx tanstack-app/src/components/admin/MembersListPage.tsx tanstack-app/src/components/admin/MemberFormPage.tsx tanstack-app/src/components/admin/OrgUnitsPage.tsx tanstack-app/messages/vi.json
git commit -m "$(cat <<'EOF'
feat: gate admin directory UI by capability and add retreat query keys

EOF
)"
```

---

### Task 7: Retreat admin UI (list + form + routes)

**Files:**
- Create: `tanstack-app/src/components/admin/RetreatsListPage.tsx`
- Create: `tanstack-app/src/components/admin/RetreatsListPage.test.tsx`
- Create: `tanstack-app/src/components/admin/RetreatFormPage.tsx`
- Create: `tanstack-app/src/components/admin/RetreatFormPage.test.tsx`
- Create: `tanstack-app/src/routes/admin/retreats.tsx` (Outlet layout)
- Create: `tanstack-app/src/routes/admin/retreats.index.tsx`
- Create: `tanstack-app/src/routes/admin/retreats.new.tsx`
- Create: `tanstack-app/src/routes/admin/retreats.$id.tsx`
- Modify: `tanstack-app/src/components/admin/adminBreadcrumbs.ts` + test
- Modify: `tanstack-app/messages/vi.json` — remaining retreat strings
- Modify: `AdminShell` nav already has retreats from Task 6 — ensure `to: '/admin/retreats'`

**UI behavior (spec):**
- List: `AdminDataTable`; columns name, org unit, course dates, status, registration window; status filter; org filter only for `he_phai_admin`; for `giao_doan_admin` force `orgUnitId: claim.orgUnitId` in query (no org picker). Create button. Delete only if `draft`.
- Form: all writable fields + `extraFields` editor (add/remove rows). Create: org `Select` only for `he_phai_admin`. Edit: org disabled. Actions: Save (`updateRetreat`/`createRetreat`), Open, Close, Delete (draft).
- After mutations: invalidate `adminKeys.retreats` / `retreat(id)`.
- If `!canManageRetreats` → `AdminDenied`.

**i18n keys (add all used):** `admin_retreats_*` for titles, columns, status labels (`draft`/`open`/`closed`), actions (open/close/save/delete), form labels, validation toasts as needed.

- [ ] **Step 1: Write failing list/form smoke tests**

Mirror `TemplesListPage.test.tsx` / `TempleFormPage.test.tsx`: mock `useAdminClaim` as `giao_doan_admin`, mock queries/use-cases, assert heading / create link / key fields render.

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement pages, routes, breadcrumbs, messages**

Follow `temples.*` route file pattern. Run route generation if the project requires visiting files for TanStack Router codegen (check how other routes are registered — file-based; ensure `routeTree` picks them up via existing vite plugin).

- [ ] **Step 4: Run UI tests PASS**

Run: `cd tanstack-app && pnpm test -- src/components/admin/RetreatsListPage.test.tsx src/components/admin/RetreatFormPage.test.tsx src/components/admin/adminBreadcrumbs.test.ts`

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/admin/RetreatsListPage.tsx tanstack-app/src/components/admin/RetreatsListPage.test.tsx tanstack-app/src/components/admin/RetreatFormPage.tsx tanstack-app/src/components/admin/RetreatFormPage.test.tsx tanstack-app/src/routes/admin/retreats.tsx tanstack-app/src/routes/admin/retreats.index.tsx tanstack-app/src/routes/admin/retreats.new.tsx tanstack-app/src/routes/admin/retreats.\$id.tsx tanstack-app/src/components/admin/adminBreadcrumbs.ts tanstack-app/src/components/admin/adminBreadcrumbs.test.ts tanstack-app/messages/vi.json
git commit -m "$(cat <<'EOF'
feat: add admin UI for Giáo đoàn retreat CRUD

EOF
)"
```

---

### Task 8: Roadmap status + final verification

**Files:**
- Modify: `docs/superpowers/specs/2026-07-25-khoa-tu-roadmap-design.md` — Phase 1 status `Hoàn thành` (or `Đang thực hiện` until this task’s verify passes, then `Hoàn thành`); Plan column → this plan file under `../plans/2026-07-25-khoa-tu-retreats-crud-phase1.md`

- [ ] **Step 1: Run full unit suite**

Run: `cd tanstack-app && pnpm test`

Expected: PASS

- [ ] **Step 2: Run rules integration suite with emulators**

Run the repo’s documented integration command; Expected: PASS

- [ ] **Step 3: Manual smoke (dev server)**

With a `giao_doan_admin` claim (and `admin: true` if still required in your env before rules deploy): create draft → edit → open → close → confirm delete blocked when open → delete when returned to draft only via… (note: cannot return to draft in Phase 1 — so delete only before first open). Create one draft and delete it.

- [ ] **Step 4: Update roadmap table**

Set Phase 1 Trạng thái to `Hoàn thành` and Plan link to this file.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-07-25-khoa-tu-roadmap-design.md
git commit -m "$(cat <<'EOF'
docs: mark khóa tu phase 1 complete in the roadmap

EOF
)"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
| --- | --- |
| Full form schema incl. `extraFields` / `quyenDangKy` | 2, 7 |
| Both GD + Hệ phái create | 4, 7 |
| Status actions draft→open↔closed; no finalized | 2, 4, 7 |
| Hard-delete draft only | 2, 4, 5, 7 |
| Editable metadata when open/closed; immutable type/orgUnitId | 4, 5 |
| `kiem_soat` capability split (nav + routes + rules) | 1, 5, 6 |
| Rules learn `role` + retreat scope | 5 |
| Repo + queryOptions + admin routes | 3, 6, 7 |
| Acceptance tests (unit + rules) | 1–5, 8 |

No intentional TBD placeholders. Types use ISO strings (called out in Global Constraints) to match existing domain, not Firestore Timestamp SDK types.
