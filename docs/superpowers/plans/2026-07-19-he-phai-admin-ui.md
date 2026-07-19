# Hệ phái Khất sĩ Admin UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an admin ops console under `/admin` with a flat Mantine AppShell sidebar for invites, temples, Tăng/Ni members, and read-only org units — including lean create/edit, lock/unlock, and claim-gated access — without client Firestore PII access.

**Architecture:** Nested `/admin` routes with AppShell + claim gate. TanStack Query `queryOptions` call admin `createServerFn` handlers that `assertAdmin` then run domain use-cases / repo list methods against Firebase Admin. `inviteId` becomes nullable for admin-created drafts; unlock restores `draft` (idempotent if already draft).

**Tech Stack:** TanStack Start/Router/Query, Mantine AppShell, Firebase Auth claims + Admin SDK, Paraglide (`messages/vi.json`), Vitest + Testing Library, Cypress, pnpm

**Spec:** `docs/superpowers/specs/2026-07-19-he-phai-admin-ui-design.md`

## Global Constraints

- Database: Firebase Firestore + Storage only; PII via Admin SDK server fns only (no client Firestore PII reads)
- Admin access: Firebase custom claim `admin === true`; client gate is UX-only; every admin server fn re-checks via `assertAdmin`
- Sidebar (flat): Lời mời · Tịnh xá/thất · Tăng · Ni · Tổ chức
- Forms this phase: lean fields only (full paper-form editors deferred)
- Unlock: supported and **idempotent** (already-draft → return as-is); invite revoke/expiry: not in this plan
- Org units UI: read-only (no seed button)
- Error payload from server fns: `{ ok: false, code: string, message: string }` (`toErrorPayload` in `mapDomainError.ts`) — never `{ error: { … } }`
- UI copy via Paraglide Vietnamese (`messages/vi.json` → `pnpm run paraglide`)
- Work in current workspace only — **never** `git worktree add`
- Before coding: create branch `feat/he-phai-admin-ui` from `main` (Task 0)
- Follow TDD: failing test → implement → pass → commit per task
- Prefer Vitest for UI; one thin Cypress journey only

## File Structure

| File | Responsibility |
| --- | --- |
| `docs/superpowers/specs/2026-07-19-he-phai-khatsi-database-design.md` | Amend `inviteId` to `string \| null` |
| `tanstack-app/src/domain/types.ts` | `inviteId: string \| null` on Temple/Member |
| `tanstack-app/src/repositories/memberRepo.ts` | `unlock`, `list`, nullable `inviteId` on create |
| `tanstack-app/src/repositories/templeRepo.ts` | `unlock`, `list`, nullable `inviteId` on create |
| `tanstack-app/src/repositories/inviteRepo.ts` | `list` invites |
| `tanstack-app/src/repositories/orgUnitRepo.ts` | `listOrgUnits` |
| `tanstack-app/src/repositories/adminListTypes.ts` | Shared `AdminListPage<T>` |
| `tanstack-app/src/test/memoryStores.ts` | Shared in-memory Member/Temple/Invite stores for unit tests |
| `tanstack-app/src/use-cases/unlockMember.ts` | Unlock member |
| `tanstack-app/src/use-cases/unlockTemple.ts` | Unlock temple |
| `tanstack-app/src/use-cases/saveAdminMember.ts` | Admin create/update member (no invite token) |
| `tanstack-app/src/use-cases/saveAdminTemple.ts` | Admin create/update temple (no invite token) |
| `tanstack-app/src/server/adminFns.ts` | New list/get/save/unlock server fns (call use-cases + repos directly; **no** separate list use-case files) |
| `tanstack-app/src/server/validators.ts` | Validators for new admin inputs |
| `tanstack-app/src/server/mapDomainError.ts` | Existing `ErrorPayload`; add `isErrorPayload` export |
| `firebase/firestore.indexes.json` | All composites needed for admin lists (see Task 3) |
| `tanstack-app/package.json` | Direct `@tanstack/react-query` dependency |
| `tanstack-app/src/query/queryClient.ts` | Shared `QueryClient` factory |
| `tanstack-app/src/query/adminKeys.ts` | Query key factories |
| `tanstack-app/src/query/adminQueries.ts` | `queryOptions` for admin reads |
| `tanstack-app/src/auth/useAdminClaim.ts` | Read `admin` claim (`getIdTokenResult(true)` once) |
| `tanstack-app/src/components/admin/AdminShell.tsx` | AppShell + sidebar |
| `tanstack-app/src/components/admin/AdminDenied.tsx` | Non-admin message |
| `tanstack-app/src/components/admin/*Page.tsx` | Invites, temples, members, org units screens |
| `tanstack-app/src/routes/admin.tsx` | `/admin` layout + gate |
| `tanstack-app/src/routes/admin/*.tsx` | Child routes |
| `tanstack-app/src/routes/__root.tsx` | QueryClientProvider; hide AppHeader on `/admin` |
| `tanstack-app/src/components/LoginPage.tsx` | Honor `redirect` search param |
| `tanstack-app/messages/vi.json` | Admin UI copy |
| `tanstack-app/cypress/e2e/admin.cy.ts` | Thin admin smoke |

---

### Task 0: Create feature branch

**Files:** none (git only)

- [ ] **Step 1: Confirm on `main` and create branch**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git checkout main
git pull
git checkout -b feat/he-phai-admin-ui
```

Expected: current branch is `feat/he-phai-admin-ui`.

If not on `main` / pull fails / dirty tree blocks checkout: stop and ask the user before continuing.

---

### Task 1: Make `inviteId` nullable (types + DB design doc)

**Files:**
- Modify: `tanstack-app/src/domain/types.ts`
- Modify: `tanstack-app/src/repositories/memberRepo.ts` (`CreateOrUpdateMemberDraftInput.inviteId`)
- Modify: `tanstack-app/src/repositories/templeRepo.ts` (`CreateOrUpdateTempleDraftInput.inviteId`)
- Modify: `docs/superpowers/specs/2026-07-19-he-phai-khatsi-database-design.md` (temple + member `inviteId` rows)
- Test: re-run existing draft tests (no fake type-cast unit test)

**Interfaces:**
- Consumes: existing `Member`, `Temple`
- Produces: `inviteId: string | null` on both types and draft input types; design doc matches

- [ ] **Step 1: Change types and draft inputs**

In `types.ts`, change `inviteId: string` → `inviteId: string | null` on `Member` and `Temple`.

In `memberRepo.ts` and `templeRepo.ts`:

```ts
inviteId: string | null
```

In the DB design doc, for both temples and members lifecycle tables, change:

| `inviteId` | string \| null | Invite used to create; **null** when created by admin without an invite |

- [ ] **Step 2: Run related tests**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/use-cases/memberDraft.test.ts src/use-cases/templeDraft.test.ts
```

Expected: PASS (filler flows still pass string invite ids).

- [ ] **Step 3: Commit**

```bash
git add tanstack-app/src/domain/types.ts \
  tanstack-app/src/repositories/memberRepo.ts tanstack-app/src/repositories/templeRepo.ts \
  docs/superpowers/specs/2026-07-19-he-phai-khatsi-database-design.md
git commit -m "feat: allow null inviteId for admin-created records"
```

---

### Task 2: Shared memory stores + unlock member/temple

**Files:**
- Create: `tanstack-app/src/test/memoryStores.ts`
- Modify: `tanstack-app/src/repositories/memberRepo.ts`
- Modify: `tanstack-app/src/repositories/templeRepo.ts`
- Create: `tanstack-app/src/use-cases/unlockMember.ts`
- Create: `tanstack-app/src/use-cases/unlockTemple.ts`
- Create: `tanstack-app/src/use-cases/unlock.test.ts`
- Modify: `tanstack-app/src/use-cases/memberDraft.test.ts` — import shared store (drop local duplicate)
- Modify: `tanstack-app/src/use-cases/templeDraft.test.ts` — same

**Interfaces:**
- Produces:
  - `MemberStore.unlock(memberId: string): Promise<Member>`
  - `TempleStore.unlock(templeId: string): Promise<Temple>`
  - `unlockMember({ memberId }, store?): Promise<Member>`
  - `unlockTemple({ templeId }, store?): Promise<Temple>`
  - `createMemoryMemberStore(seed?: Member[]): MemberStore & { members: Map<…> }`
  - `createMemoryTempleStore(seed?: Temple[]): TempleStore & { temples: Map<…> }`

**Unlock semantics:** If record missing → `NOT_FOUND`. If already `draft` → return unchanged (idempotent). If `locked` → set `status: 'draft'`, `lockedAt: null`, `lockedBy: null`, bump `updatedAt`.

- [ ] **Step 1: Write the failing unlock test**

Create `tanstack-app/src/use-cases/unlock.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Member, Temple } from '#/domain/types'
import { createMemoryMemberStore, createMemoryTempleStore } from '#/test/memoryStores'
import { unlockMember } from './unlockMember'
import { unlockTemple } from './unlockTemple'

const lockedMember: Member = {
  id: 'm1',
  orgUnitId: 'gd-i',
  sanghaType: 'tang',
  status: 'locked',
  cccd: '001099012345',
  inviteId: 'inv-1',
  currentTempleId: null,
  photoPath: null,
  createdAt: '2026-07-19T00:00:00.000Z',
  updatedAt: '2026-07-19T01:00:00.000Z',
  lockedAt: '2026-07-19T01:00:00.000Z',
  lockedBy: 'admin-1',
}

describe('unlockMember', () => {
  it('sets status back to draft and clears lock metadata', async () => {
    const store = createMemoryMemberStore([lockedMember])
    const result = await unlockMember({ memberId: 'm1' }, store)
    expect(result.status).toBe('draft')
    expect(result.lockedAt).toBeNull()
    expect(result.lockedBy).toBeNull()
  })

  it('is idempotent when already draft', async () => {
    const store = createMemoryMemberStore([{ ...lockedMember, status: 'draft', lockedAt: null, lockedBy: null }])
    const result = await unlockMember({ memberId: 'm1' }, store)
    expect(result.status).toBe('draft')
  })

  it('throws NOT_FOUND for missing member', async () => {
    await expect(
      unlockMember({ memberId: 'missing' }, createMemoryMemberStore([])),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('unlockTemple', () => {
  it('sets status back to draft and clears lock metadata', async () => {
    const temple: Temple = {
      id: 't1',
      orgUnitId: 'gd-i',
      status: 'locked',
      managerPhones: ['0901234567'],
      inviteId: null,
      createdAt: '2026-07-19T00:00:00.000Z',
      updatedAt: '2026-07-19T01:00:00.000Z',
      lockedAt: '2026-07-19T01:00:00.000Z',
      lockedBy: 'admin-1',
    }
    const store = createMemoryTempleStore([temple])
    const result = await unlockTemple({ templeId: 't1' }, store)
    expect(result.status).toBe('draft')
    expect(result.lockedAt).toBeNull()
    expect(result.lockedBy).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm exec vitest run src/use-cases/unlock.test.ts
```

Expected: FAIL — cannot resolve modules.

- [ ] **Step 3: Implement `memoryStores.ts`, repo `unlock`, and use-cases**

Repo unlock (member; temple mirrors). Idempotent draft path:

```ts
async function unlock(memberId: string): Promise<Member> {
  const db = getAdminDb()
  const memberRef = db.collection(COLLECTIONS.members).doc(memberId)
  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(memberRef)
    if (!snap.exists) {
      throw new DomainError('NOT_FOUND', 'Member not found')
    }
    const existing = memberFromSnap(snap)
    if (existing.status === 'draft') {
      return existing
    }
    const now = new Date().toISOString()
    const member: Member = {
      ...existing,
      status: 'draft',
      lockedAt: null,
      lockedBy: null,
      updatedAt: now,
    }
    transaction.set(memberRef, memberData(member))
    return member
  })
}
```

```ts
// unlockMember.ts
export type UnlockMemberInput = { memberId: string }
export async function unlockMember(
  input: UnlockMemberInput,
  memberStore: MemberStore = memberRepo,
): Promise<Member> {
  return memberStore.unlock(input.memberId)
}
```

Refactor draft tests to use `createMemoryMemberStore` / `createMemoryTempleStore` (include stub `list` / `unlock` on the shared stores from the start so later tasks do not break compiles).

- [ ] **Step 4: Run tests**

```bash
pnpm exec vitest run src/use-cases/unlock.test.ts src/use-cases/memberDraft.test.ts src/use-cases/templeDraft.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/test/memoryStores.ts \
  tanstack-app/src/repositories/memberRepo.ts tanstack-app/src/repositories/templeRepo.ts \
  tanstack-app/src/use-cases/unlockMember.ts tanstack-app/src/use-cases/unlockTemple.ts \
  tanstack-app/src/use-cases/unlock.test.ts \
  tanstack-app/src/use-cases/memberDraft.test.ts tanstack-app/src/use-cases/templeDraft.test.ts
git commit -m "feat: unlock locked temple and member records"
```

---

### Task 3: Admin list repositories + indexes

**Files:**
- Create: `tanstack-app/src/repositories/adminListTypes.ts`
- Create: `tanstack-app/src/repositories/adminList.memory.test.ts`
- Modify: `tanstack-app/src/repositories/inviteRepo.ts`
- Modify: `tanstack-app/src/repositories/orgUnitRepo.ts`
- Modify: `tanstack-app/src/repositories/templeRepo.ts`
- Modify: `tanstack-app/src/repositories/memberRepo.ts`
- Modify: `tanstack-app/src/test/memoryStores.ts` — implement `list` in memory
- Modify: `firebase/firestore.indexes.json`

**Interfaces:**

```ts
export type AdminListPage<T> = {
  items: T[]
  nextCursor: string | null
}

export type ListInvitesInput = {
  orgUnitId?: string
  formType?: FormType
  limit?: number
  cursor?: string
}

InviteStore.list(input: ListInvitesInput): Promise<AdminListPage<Invite>>

export type ListTemplesAdminInput = {
  orgUnitId?: string
  status?: RecordStatus
  limit?: number
  cursor?: string
}

TempleStore.list(input: ListTemplesAdminInput): Promise<AdminListPage<Temple>>

export type ListMembersAdminInput = {
  orgUnitId?: string
  sanghaType: SanghaType
  status?: RecordStatus
  limit?: number
  cursor?: string
}

MemberStore.list(input: ListMembersAdminInput): Promise<AdminListPage<Member>>

listOrgUnits(): Promise<OrgUnit[]>
```

Default `limit` = `25`. Cursor = last document id; `startAfter(cursorDocSnap)` after `orderBy`.  
Invites: `orderBy('createdAt', 'desc')`. Temples/members: `orderBy('updatedAt', 'desc')`.

**Indexes — add all of these now** (do not wait for runtime errors):

```json
{ "collectionGroup": "invites", "queryScope": "COLLECTION", "fields": [
  { "fieldPath": "orgUnitId", "order": "ASCENDING" },
  { "fieldPath": "formType", "order": "ASCENDING" },
  { "fieldPath": "createdAt", "order": "DESCENDING" }
]},
{ "collectionGroup": "invites", "queryScope": "COLLECTION", "fields": [
  { "fieldPath": "orgUnitId", "order": "ASCENDING" },
  { "fieldPath": "createdAt", "order": "DESCENDING" }
]},
{ "collectionGroup": "invites", "queryScope": "COLLECTION", "fields": [
  { "fieldPath": "formType", "order": "ASCENDING" },
  { "fieldPath": "createdAt", "order": "DESCENDING" }
]},
{ "collectionGroup": "temples", "queryScope": "COLLECTION", "fields": [
  { "fieldPath": "orgUnitId", "order": "ASCENDING" },
  { "fieldPath": "status", "order": "ASCENDING" },
  { "fieldPath": "updatedAt", "order": "DESCENDING" }
]},
{ "collectionGroup": "temples", "queryScope": "COLLECTION", "fields": [
  { "fieldPath": "orgUnitId", "order": "ASCENDING" },
  { "fieldPath": "updatedAt", "order": "DESCENDING" }
]},
{ "collectionGroup": "temples", "queryScope": "COLLECTION", "fields": [
  { "fieldPath": "status", "order": "ASCENDING" },
  { "fieldPath": "updatedAt", "order": "DESCENDING" }
]},
{ "collectionGroup": "members", "queryScope": "COLLECTION", "fields": [
  { "fieldPath": "sanghaType", "order": "ASCENDING" },
  { "fieldPath": "updatedAt", "order": "DESCENDING" }
]},
{ "collectionGroup": "members", "queryScope": "COLLECTION", "fields": [
  { "fieldPath": "sanghaType", "order": "ASCENDING" },
  { "fieldPath": "status", "order": "ASCENDING" },
  { "fieldPath": "updatedAt", "order": "DESCENDING" }
]},
{ "collectionGroup": "members", "queryScope": "COLLECTION", "fields": [
  { "fieldPath": "orgUnitId", "order": "ASCENDING" },
  { "fieldPath": "sanghaType", "order": "ASCENDING" },
  { "fieldPath": "updatedAt", "order": "DESCENDING" }
]},
{ "collectionGroup": "members", "queryScope": "COLLECTION", "fields": [
  { "fieldPath": "orgUnitId", "order": "ASCENDING" },
  { "fieldPath": "sanghaType", "order": "ASCENDING" },
  { "fieldPath": "status", "order": "ASCENDING" },
  { "fieldPath": "updatedAt", "order": "DESCENDING" }
]}
```

Keep existing indexes. Single-field `orderBy('updatedAt')` / `createdAt` / `order` use automatic single-field indexes.

- [ ] **Step 1: Write memory list tests**

```ts
// adminList.memory.test.ts
import { describe, expect, it } from 'vitest'
import { createMemoryTempleStore, createMemoryMemberStore } from '#/test/memoryStores'

describe('memory temple list', () => {
  it('filters by status and paginates with cursor', async () => {
    const store = createMemoryTempleStore([
      temple({ id: 't1', status: 'draft', updatedAt: '2026-07-19T03:00:00.000Z' }),
      temple({ id: 't2', status: 'locked', updatedAt: '2026-07-19T02:00:00.000Z' }),
      temple({ id: 't3', status: 'draft', updatedAt: '2026-07-19T01:00:00.000Z' }),
    ])
    const page1 = await store.list({ status: 'draft', limit: 1 })
    expect(page1.items.map((t) => t.id)).toEqual(['t1'])
    expect(page1.nextCursor).toBe('t1')
    const page2 = await store.list({ status: 'draft', limit: 1, cursor: page1.nextCursor! })
    expect(page2.items.map((t) => t.id)).toEqual(['t3'])
    expect(page2.nextCursor).toBeNull()
  })
})

describe('memory member list', () => {
  it('requires sanghaType and filters', async () => {
    const store = createMemoryMemberStore([
      member({ id: 'm1', sanghaType: 'tang' }),
      member({ id: 'm2', sanghaType: 'ni' }),
    ])
    const page = await store.list({ sanghaType: 'tang', limit: 25 })
    expect(page.items).toHaveLength(1)
    expect(page.items[0]!.id).toBe('m1')
  })
})
```

Helper factories `temple` / `member` can live at the top of the test file.

- [ ] **Step 2: Run — expect fail until `list` exists on memory stores**

```bash
pnpm exec vitest run src/repositories/adminList.memory.test.ts
```

- [ ] **Step 3: Implement `list` on repos + memory stores; update `firestore.indexes.json`; add `listOrgUnits`**

Firestore list pattern (invites example):

```ts
async function list(input: ListInvitesInput): Promise<AdminListPage<Invite>> {
  const limit = input.limit ?? 25
  let q: FirebaseFirestore.Query = getAdminDb().collection(COLLECTIONS.invites)
  if (input.orgUnitId) q = q.where('orgUnitId', '==', input.orgUnitId)
  if (input.formType) q = q.where('formType', '==', input.formType)
  q = q.orderBy('createdAt', 'desc').limit(limit)
  if (input.cursor) {
    const cursorSnap = await getAdminDb()
      .collection(COLLECTIONS.invites)
      .doc(input.cursor)
      .get()
    if (cursorSnap.exists) q = q.startAfter(cursorSnap)
  }
  const snap = await q.get()
  const items = snap.docs.map(
    (doc) => ({ id: doc.id, ...(doc.data() as Omit<Invite, 'id'>) }),
  )
  const nextCursor =
    snap.docs.length === limit ? snap.docs[snap.docs.length - 1]!.id : null
  return { items, nextCursor }
}
```

```ts
export async function listOrgUnits(): Promise<OrgUnit[]> {
  const snap = await getAdminDb()
    .collection(COLLECTIONS.orgUnits)
    .orderBy('order', 'asc')
    .get()
  return snap.docs.map(
    (doc) => ({ id: doc.id, ...(doc.data() as Omit<OrgUnit, 'id'>) }),
  )
}
```

- [ ] **Step 4: Run memory list tests — PASS**

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/repositories tanstack-app/src/test/memoryStores.ts \
  firebase/firestore.indexes.json
git commit -m "feat: add admin list queries and Firestore indexes"
```

---

### Task 4: Admin save use-cases (no invite token)

**Files:**
- Create: `tanstack-app/src/use-cases/saveAdminMember.ts`
- Create: `tanstack-app/src/use-cases/saveAdminTemple.ts`
- Create: `tanstack-app/src/use-cases/saveAdminDraft.test.ts`

**Interfaces:**

```ts
export type SaveAdminMemberCreateInput = {
  orgUnitId: string
  sanghaType: SanghaType
  cccd: string
  patch: MemberProfilePatch
}

export type SaveAdminMemberUpdateInput = {
  memberId: string
  orgUnitId: string
  sanghaType: SanghaType
  patch: MemberProfilePatch
  // cccd taken from existing record — not accepted on update
}

export type SaveAdminMemberInput =
  | SaveAdminMemberCreateInput
  | SaveAdminMemberUpdateInput

export function isAdminMemberUpdate(
  input: SaveAdminMemberInput,
): input is SaveAdminMemberUpdateInput {
  return 'memberId' in input && typeof input.memberId === 'string'
}

export async function saveAdminMember(
  input: SaveAdminMemberInput,
  memberStore?: MemberStore,
): Promise<{ member: Member; mode: 'created' | 'updated' }>

export type SaveAdminTempleInput = {
  orgUnitId: string
  templeId?: string
  patch: TempleProfilePatch
  explicitPhones?: string[]
}

export async function saveAdminTemple(
  input: SaveAdminTempleInput,
  templeStore?: TempleStore,
): Promise<{ temple: Temple; mode: 'created' | 'updated' }>
```

Rules:
- Create member: `normalizeCccd(input.cccd)`; `inviteId: null`
- Update member: `getById`; `NOT_FOUND` / `RECORD_LOCKED`; require `orgUnitId`/`sanghaType` match existing; use **stored** `cccd` (ignore any CCCD in patch)
- Temples: `buildManagerPhones` / `mergeManagerPhones`; `inviteId: null` on create; preserve on update
- Sanitize patches with the same protected-key stripping as filler saves

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { createMemoryMemberStore, createMemoryTempleStore } from '#/test/memoryStores'
import { saveAdminMember } from './saveAdminMember'
import { saveAdminTemple } from './saveAdminTemple'

describe('saveAdminMember', () => {
  it('creates a draft with inviteId null', async () => {
    const store = createMemoryMemberStore([])
    const { member, mode } = await saveAdminMember(
      {
        orgUnitId: 'gd-i',
        sanghaType: 'tang',
        cccd: '001099012345',
        patch: { phapDanh: 'Thiện' },
      },
      store,
    )
    expect(mode).toBe('created')
    expect(member.inviteId).toBeNull()
    expect(member.phapDanh).toBe('Thiện')
  })

  it('rejects invalid cccd on create', async () => {
    await expect(
      saveAdminMember(
        { orgUnitId: 'gd-i', sanghaType: 'tang', cccd: 'bad', patch: {} },
        createMemoryMemberStore([]),
      ),
    ).rejects.toMatchObject({ code: 'CCCD_INVALID' })
  })

  it('updates by memberId without requiring cccd in input', async () => {
    const store = createMemoryMemberStore([
      {
        id: 'm1',
        orgUnitId: 'gd-i',
        sanghaType: 'tang',
        status: 'draft',
        cccd: '001099012345',
        inviteId: 'inv-1',
        currentTempleId: null,
        photoPath: null,
        createdAt: '2026-07-19T00:00:00.000Z',
        updatedAt: '2026-07-19T00:00:00.000Z',
        lockedAt: null,
        lockedBy: null,
        phapDanh: 'Old',
      },
    ])
    const { member, mode } = await saveAdminMember(
      {
        memberId: 'm1',
        orgUnitId: 'gd-i',
        sanghaType: 'tang',
        patch: { phapDanh: 'New' },
      },
      store,
    )
    expect(mode).toBe('updated')
    expect(member.phapDanh).toBe('New')
    expect(member.inviteId).toBe('inv-1')
    expect(member.cccd).toBe('001099012345')
  })
})

describe('saveAdminTemple', () => {
  it('creates a draft with inviteId null when phone present', async () => {
    const store = createMemoryTempleStore([])
    const { temple, mode } = await saveAdminTemple(
      {
        orgUnitId: 'gd-i',
        patch: {
          danhHieu: 'TX Test',
          truTriHienNay: { dienThoai: '0901234567' },
        },
      },
      store,
    )
    expect(mode).toBe('created')
    expect(temple.inviteId).toBeNull()
    expect(temple.managerPhones).toContain('0901234567')
  })
})
```

Fix imports so `saveAdminTemple` comes from `./saveAdminTemple`.

- [ ] **Step 2: Run to verify fail**

```bash
pnpm exec vitest run src/use-cases/saveAdminDraft.test.ts
```

Expected: FAIL — modules missing.

- [ ] **Step 3: Implement use-cases**

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/use-cases/saveAdminMember.ts \
  tanstack-app/src/use-cases/saveAdminTemple.ts \
  tanstack-app/src/use-cases/saveAdminDraft.test.ts
git commit -m "feat: add admin save use-cases without invite token"
```

---

### Task 5: Admin server functions + validators + `isErrorPayload`

**Files:**
- Modify: `tanstack-app/src/server/mapDomainError.ts` — export `isErrorPayload`
- Modify: `tanstack-app/src/server/validators.ts`
- Modify: `tanstack-app/src/server/validators.test.ts`
- Modify: `tanstack-app/src/server/adminFns.ts`

**Interfaces:**
- Consumes: `assertAdmin`, unlock/save use-cases, repo `list` / `getById` / `listOrgUnits`
- Produces:

```ts
export function isErrorPayload(value: unknown): value is ErrorPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    (value as { ok: unknown }).ok === false &&
    typeof (value as { code: unknown }).code === 'string' &&
    typeof (value as { message: unknown }).message === 'string'
  )
}
```

| Fn | Input beyond idToken | Success return |
| --- | --- | --- |
| `listOrgUnitsFn` | — | `OrgUnit[]` |
| `listInvitesFn` | filters + cursor + limit | `AdminListPage<Invite>` |
| `listTemplesFn` | filters + cursor + limit | `AdminListPage<Temple>` |
| `listMembersFn` | sanghaType + filters + cursor | `AdminListPage<Member>` |
| `getTempleFn` | `templeId` | `Temple` |
| `getMemberFn` | `memberId` | `Member` |
| `saveAdminTempleFn` | `SaveAdminTempleInput` fields | save result |
| `saveAdminMemberFn` | discriminated create/update fields | save result |
| `unlockTempleFn` | `templeId` | `Temple` |
| `unlockMemberFn` | `memberId` | `Member` |

Keep existing `createInviteFn`, `lock*Fn`, `seedOrgUnitsFn`.  
On get-by-id null → throw `DomainError('NOT_FOUND', …)` then `toErrorPayload`.

```ts
export const unlockMemberFn = createServerFn({ method: 'POST' })
  .validator(validateUnlockMemberFnInput)
  .handler(async ({ data }) => {
    try {
      await assertAdmin(data.idToken)
      return await unlockMember({ memberId: data.memberId })
    } catch (err) {
      return toErrorPayload(err)
    }
  })
```

- [ ] **Step 1: Write validator + `isErrorPayload` tests**

```ts
import { describe, expect, it } from 'vitest'
import { isErrorPayload, toErrorPayload } from './mapDomainError'
import { DomainError } from '#/domain/errors'

describe('isErrorPayload', () => {
  it('recognizes toErrorPayload shape', () => {
    const payload = toErrorPayload(new DomainError('FORBIDDEN', 'nope'))
    expect(isErrorPayload(payload)).toBe(true)
    expect(payload).toEqual({ ok: false, code: 'FORBIDDEN', message: 'nope' })
  })

  it('rejects success-shaped values', () => {
    expect(isErrorPayload({ id: 'x' })).toBe(false)
    expect(isErrorPayload({ error: { code: 'x' } })).toBe(false)
  })
})
```

Also add validator cases for unlock / list / save admin inputs (mirror existing `validators.test.ts` style with concrete expects).

- [ ] **Step 2: Run — expect fail for missing `isErrorPayload` / validators**

- [ ] **Step 3: Implement validators + server fns + `isErrorPayload`**

- [ ] **Step 4: `pnpm exec vitest run src/server/validators.test.ts src/server/mapDomainError.ts` — if mapDomainError has no test file, put `isErrorPayload` tests in `mapDomainError.test.ts`**

```bash
pnpm exec vitest run src/server/validators.test.ts src/server/mapDomainError.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/server/mapDomainError.ts tanstack-app/src/server/mapDomainError.test.ts \
  tanstack-app/src/server/validators.ts tanstack-app/src/server/validators.test.ts \
  tanstack-app/src/server/adminFns.ts
git commit -m "feat: expose admin list, get, save, and unlock server functions"
```

---

### Task 6: TanStack Query client + admin queryOptions

**Files:**
- Modify: `tanstack-app/package.json` / lockfile — add `@tanstack/react-query`
- Create: `tanstack-app/src/query/queryClient.ts`
- Create: `tanstack-app/src/query/adminKeys.ts`
- Create: `tanstack-app/src/query/adminQueries.ts`
- Create: `tanstack-app/src/query/adminKeys.test.ts`
- Modify: `tanstack-app/src/routes/__root.tsx` — wrap with `QueryClientProvider`

**Interfaces:**

```ts
export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, retry: 1 },
    },
  })
}

export const adminKeys = {
  all: ['admin'] as const,
  orgUnits: () => [...adminKeys.all, 'orgUnits'] as const,
  invites: (filters: ListInvitesInput) =>
    [...adminKeys.all, 'invites', filters] as const,
  temples: (filters: ListTemplesAdminInput) =>
    [...adminKeys.all, 'temples', filters] as const,
  temple: (id: string) => [...adminKeys.all, 'temple', id] as const,
  members: (filters: ListMembersAdminInput) =>
    [...adminKeys.all, 'members', filters] as const,
  member: (id: string) => [...adminKeys.all, 'member', id] as const,
}

async function unwrapAdmin<T>(result: T | ErrorPayload): Promise<T> {
  if (isErrorPayload(result)) {
    throw new DomainError(result.code as DomainErrorCode, result.message)
  }
  return result
}

export function orgUnitsQuery(getIdToken: () => Promise<string>) {
  return queryOptions({
    queryKey: adminKeys.orgUnits(),
    queryFn: async () =>
      unwrapAdmin(
        await listOrgUnitsFn({ data: { idToken: await getIdToken() } }),
      ),
    staleTime: 5 * 60_000,
  })
}
```

Same pattern for invites/temples/members list + temple/member detail queries.

In `__root.tsx`, create client with `useState(() => createAppQueryClient())` inside `RootDocument` (avoid SSR singleton leakage):

```tsx
function RootDocument({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createAppQueryClient())
  // ...
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* AppHeader conditional — Task 7 */}
        {children}
      </AuthProvider>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 1: Install**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm add @tanstack/react-query
```

- [ ] **Step 2: Key factory test**

```ts
import { describe, expect, it } from 'vitest'
import { adminKeys } from './adminKeys'

describe('adminKeys', () => {
  it('nests under admin', () => {
    expect(adminKeys.orgUnits()[0]).toBe('admin')
    expect(adminKeys.member('m1')).toEqual(['admin', 'member', 'm1'])
  })
})
```

- [ ] **Step 3: Implement + wrap provider**

- [ ] **Step 4: `pnpm exec vitest run src/query/adminKeys.test.ts` — PASS**

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/package.json tanstack-app/pnpm-lock.yaml \
  tanstack-app/src/query tanstack-app/src/routes/__root.tsx
git commit -m "feat: add TanStack Query admin key factories and provider"
```

---

### Task 7: Admin claim gate + AppShell + login redirect param

**Files:**
- Create: `tanstack-app/src/auth/useAdminClaim.ts`
- Create: `tanstack-app/src/auth/useAdminClaim.test.tsx`
- Create: `tanstack-app/src/components/admin/AdminDenied.tsx`
- Create: `tanstack-app/src/components/admin/AdminShell.tsx`
- Create: `tanstack-app/src/components/admin/AdminShell.test.tsx`
- Create: `tanstack-app/src/routes/admin.tsx`
- Create: `tanstack-app/src/routes/admin/index.tsx`
- Modify: `tanstack-app/src/routes/__root.tsx` — hide `AppHeader` when path starts with `/admin`
- Modify: `tanstack-app/src/routes/login.tsx` — validate `redirect` search
- Modify: `tanstack-app/src/components/LoginPage.tsx`
- Modify: `tanstack-app/src/components/LoginPage.test.tsx`
- Modify: `tanstack-app/messages/vi.json`
- Run: `pnpm run paraglide` and `pnpm run generate-routes`

**Interfaces:**

```ts
export type AdminClaimState =
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'denied' }
  | { status: 'admin'; getIdToken: () => Promise<string> }

export function useAdminClaim(): AdminClaimState
```

Claim check: after `user` is set, call `await user.getIdTokenResult(true)` (**force refresh**) once per mount of the admin layout / hook effect; `claims.admin === true`. Provide `getIdToken: () => user.getIdToken()`.

**Safe redirect helper** (shared by login + admin gate):

```ts
// src/auth/safeRedirect.ts
export function safeRedirectPath(raw: unknown, fallback = '/'): string {
  if (typeof raw !== 'string') return fallback
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback
  return raw
}
```

**Admin layout:**

```tsx
import { Navigate, Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'
import { Loader, Center } from '@mantine/core'
import { useAdminClaim } from '#/auth/useAdminClaim'
import { AdminDenied } from '#/components/admin/AdminDenied'
import { AdminShell } from '#/components/admin/AdminShell'

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
})

function AdminLayout() {
  const claim = useAdminClaim()
  const location = useRouterState({ select: (s) => s.location })

  if (claim.status === 'loading') {
    return (
      <Center p="xl">
        <Loader aria-label="loading" />
      </Center>
    )
  }
  if (claim.status === 'signed_out') {
    const redirect = `${location.pathname}${location.searchStr}`
    return <Navigate to="/login" search={{ redirect }} />
  }
  if (claim.status === 'denied') return <AdminDenied />
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  )
}
```

**`admin/index.tsx`:** `<Navigate to="/admin/invites" />`

**AdminShell nav:**

| Label key | To |
| --- | --- |
| `admin_nav_invites` | `/admin/invites` |
| `admin_nav_temples` | `/admin/temples` |
| `admin_nav_tang` | `/admin/members/tang` |
| `admin_nav_ni` | `/admin/members/ni` |
| `admin_nav_org_units` | `/admin/org-units` |

**LoginPage:** resolve `redirect` from route search via `Route.useSearch()`; after sign-in and when already signed-in, `navigate({ to: safeRedirectPath(redirect) })`.

**vi.json minimum:**  
`admin_title`, `admin_denied_title`, `admin_denied_body`, `admin_nav_invites`, `admin_nav_temples`, `admin_nav_tang`, `admin_nav_ni`, `admin_nav_org_units`, `admin_sign_out`

- [ ] **Step 1: Failing tests**

`useAdminClaim.test.tsx`: mock user with `getIdTokenResult: async () => ({ claims: { admin: true } })` → `admin`; `{ claims: {} }` → `denied`; no user → `signed_out`.

`AdminShell.test.tsx`: renders nav link text from Paraglide.

`LoginPage.test.tsx`: with search `redirect: '/admin/invites'`, after mocked Google sign-in, `navigate` called with that path (not `/`).

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Implement claim hook, shell, denied, routes, login redirect, hide AppHeader on `/admin`**

- [ ] **Step 4:**

```bash
pnpm run paraglide && pnpm run generate-routes
pnpm exec vitest run src/auth/useAdminClaim.test.tsx \
  src/components/admin/AdminShell.test.tsx src/components/LoginPage.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/auth tanstack-app/src/components/admin \
  tanstack-app/src/components/LoginPage.tsx tanstack-app/src/components/LoginPage.test.tsx \
  tanstack-app/src/routes tanstack-app/src/routeTree.gen.ts tanstack-app/messages/vi.json
git commit -m "feat: add admin AppShell claim gate and login redirect"
```

---

### Task 8: Org units read-only page

**Files:**
- Create: `tanstack-app/src/routes/admin/org-units.tsx`
- Create: `tanstack-app/src/components/admin/OrgUnitsPage.tsx`
- Create: `tanstack-app/src/components/admin/OrgUnitsPage.test.tsx`
- Modify: `tanstack-app/messages/vi.json`

- [ ] **Step 1: Failing test**

```tsx
it('renders org unit rows', async () => {
  vi.mock('#/query/adminQueries', () => ({
    orgUnitsQuery: () => ({
      queryKey: ['admin', 'orgUnits'],
      queryFn: async () => [
        { id: 'gd-i', code: 'I', name: 'Giáo đoàn I', kind: 'giao_doan', order: 1, allowsTang: true, allowsNi: true },
      ],
      staleTime: 0,
    }),
  }))
  // render OrgUnitsPage inside QueryClientProvider + admin claim stub
  expect(await screen.findByText('Giáo đoàn I')).toBeTruthy()
})
```

(Adjust mock style to match how other tests mock modules in this repo.)

- [ ] **Step 2: Implement `OrgUnitsPage` with `useQuery(orgUnitsQuery(getIdToken))` and Mantine `Table` columns code, name, kind**

- [ ] **Step 3: PASS**

- [ ] **Step 4: Commit**

```bash
git add tanstack-app/src/routes/admin/org-units.tsx \
  tanstack-app/src/components/admin/OrgUnitsPage.tsx \
  tanstack-app/src/components/admin/OrgUnitsPage.test.tsx \
  tanstack-app/messages/vi.json tanstack-app/src/routeTree.gen.ts
git commit -m "feat: add read-only admin org units page"
```

---

### Task 9: Invites page (list + create + copy link)

**Files:**
- Create: `tanstack-app/src/routes/admin/invites.tsx`
- Create: `tanstack-app/src/components/admin/InvitesPage.tsx`
- Create: `tanstack-app/src/components/admin/InvitesPage.test.tsx`
- Modify: `messages/vi.json`

**UX:**
- Filters: org unit Select, form type Select
- Table: org unit name (join from orgUnits query), formType, createdAt, createdBy, copy button
- Create modal: org unit + form type → `createInviteFn` → show `/f/{token}` + `navigator.clipboard.writeText`
- Load more when `nextCursor` present

Share URL: `` `${window.location.origin}/f/${token}` ``

- [ ] **Step 1: Failing Vitest**

```tsx
it('lists invite rows and opens create modal', async () => {
  const user = userEvent.setup()
  // mock invitesQuery → one invite; orgUnitsQuery → matching unit
  renderInvitesPage()
  expect(await screen.findByText(/member_tang|Tăng/i)).toBeTruthy()
  await user.click(screen.getByRole('button', { name: /tạo|thêm/i }))
  expect(await screen.findByRole('dialog')).toBeTruthy()
})
```

- [ ] **Step 2: Implement page + route**

- [ ] **Step 3: PASS + commit**

```bash
git add tanstack-app/src/routes/admin/invites.tsx \
  tanstack-app/src/components/admin/InvitesPage.tsx \
  tanstack-app/src/components/admin/InvitesPage.test.tsx \
  tanstack-app/messages/vi.json tanstack-app/src/routeTree.gen.ts
git commit -m "feat: add admin invites list and create with copy link"
```

---

### Task 10: Temples list + lean create/detail

**Files:**
- Create: `tanstack-app/src/routes/admin/temples.tsx`
- Create: `tanstack-app/src/routes/admin/temples.new.tsx`
- Create: `tanstack-app/src/routes/admin/temples.$id.tsx`
- Create: `tanstack-app/src/components/admin/TemplesListPage.tsx`
- Create: `tanstack-app/src/components/admin/TempleFormPage.tsx`
- Create: `tanstack-app/src/components/admin/TemplesListPage.test.tsx`
- Create: `tanstack-app/src/components/admin/TempleFormPage.test.tsx`
- Modify: `messages/vi.json`

**List:** filters org unit + status; columns `danhHieu`, first `managerPhones[0]`, status, updatedAt; CTA → `/admin/temples/new`; row → `/admin/temples/$id`.

**Form fields:** org unit (disabled on edit), `danhHieu`, trụ trì `dienThoai`, optional `diaChiMoi`.  
Draft: Save + Lock. Locked: read-only + Unlock. Show invite id or label “Tạo bởi admin”.

- [ ] **Step 1: Failing tests**

```tsx
// TemplesListPage.test.tsx
it('renders temple name and links to detail', async () => {
  // mock templesQuery → [{ id: 't1', danhHieu: 'TX A', managerPhones: ['0901234567'], status: 'draft', updatedAt: '…' }]
  renderList()
  expect(await screen.findByText('TX A')).toBeTruthy()
})

// TempleFormPage.test.tsx
it('shows unlock when locked', async () => {
  // mock templeQuery → locked temple
  renderForm({ mode: 'edit' })
  expect(await screen.findByRole('button', { name: /mở khóa|unlock/i })).toBeTruthy()
})
```

- [ ] **Step 2: Implement routes + components + mutations invalidating `adminKeys.temples` / `adminKeys.temple(id)`**

- [ ] **Step 3: PASS + commit**

```bash
git add tanstack-app/src/routes/admin/temples.tsx \
  tanstack-app/src/routes/admin/temples.new.tsx \
  tanstack-app/src/routes/admin/temples.\$id.tsx \
  tanstack-app/src/components/admin/TemplesListPage.tsx \
  tanstack-app/src/components/admin/TempleFormPage.tsx \
  tanstack-app/src/components/admin/TemplesListPage.test.tsx \
  tanstack-app/src/components/admin/TempleFormPage.test.tsx \
  tanstack-app/messages/vi.json tanstack-app/src/routeTree.gen.ts
git commit -m "feat: add admin temple list and lean create/detail with lock"
```

---

### Task 11: Members list + lean create/detail (Tăng / Ni)

**Files:**
- Create: `tanstack-app/src/routes/admin/members.tang.tsx` → `/admin/members/tang`
- Create: `tanstack-app/src/routes/admin/members.ni.tsx` → `/admin/members/ni`
- Create: `tanstack-app/src/routes/admin/members.new.tsx`
- Create: `tanstack-app/src/routes/admin/members.$id.tsx`
- Create: `tanstack-app/src/components/admin/MembersListPage.tsx` (`sanghaType` prop)
- Create: `tanstack-app/src/components/admin/MemberFormPage.tsx`
- Create: `tanstack-app/src/components/admin/MembersListPage.test.tsx`
- Create: `tanstack-app/src/components/admin/MemberFormPage.test.tsx`
- Modify: `messages/vi.json`

**List:** filters org unit + status; columns phapDanh/theDanh, cccd, status, updatedAt; new → `/admin/members/new?sanghaType=tang|ni`.

**Form:** org unit; sanghaType from search on create / fixed on edit; CCCD editable **only on create**; phapDanh, theDanh, dienThoai. Save / Lock / Unlock.

- [ ] **Step 1: Failing tests** (same shape as temples; assert CCCD field absent/disabled on edit)

```tsx
it('does not allow editing cccd on existing member', async () => {
  renderMemberForm({ mode: 'edit', member: { cccd: '001099012345', status: 'draft' } })
  const cccd = screen.getByLabelText(/cccd/i)
  expect(cccd).toBeDisabled()
})
```

- [ ] **Step 2: Implement**

- [ ] **Step 3: PASS + commit**

```bash
git add tanstack-app/src/routes/admin/members.tang.tsx \
  tanstack-app/src/routes/admin/members.ni.tsx \
  tanstack-app/src/routes/admin/members.new.tsx \
  tanstack-app/src/routes/admin/members.\$id.tsx \
  tanstack-app/src/components/admin/MembersListPage.tsx \
  tanstack-app/src/components/admin/MemberFormPage.tsx \
  tanstack-app/src/components/admin/MembersListPage.test.tsx \
  tanstack-app/src/components/admin/MemberFormPage.test.tsx \
  tanstack-app/messages/vi.json tanstack-app/src/routeTree.gen.ts
git commit -m "feat: add admin member list and lean create/detail with lock"
```

---

### Task 12: Cypress thin smoke

**Files:**
- Create: `tanstack-app/cypress/e2e/admin.cy.ts`

```ts
describe('Admin', () => {
  it('sends anonymous users from /admin to login with return path', () => {
    cy.visit('/admin/invites')
    cy.url().should('include', '/login')
    cy.url().should('include', 'redirect')
    cy.contains('h1', 'Đăng nhập').should('be.visible')
  })
})
```

Do **not** require live admin claim in CI (no sidebar assertion without Auth stub infrastructure).

- [ ] **Step 1: Add spec**

- [ ] **Step 2: Run**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm test:e2e
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tanstack-app/cypress/e2e/admin.cy.ts
git commit -m "test: add Cypress smoke for admin login redirect"
```

---

### Task 13: Final verification

**Files:** none

- [ ] **Step 1: Run unit tests**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm test
```

Expected: PASS.

- [ ] **Step 2: Confirm clean tree**

```bash
git status
```

Expected: clean (or only intentional untracked files). Fix and commit leftovers if any.

Manual emulator checklist (optional, not blocking): claimed admin sidebar + invites + lean CRUD + lock/unlock + org units; non-admin denied; signed-out redirect with `redirect` param.

---

## Self-review notes (plan author)

| Review finding | Resolution in this revision |
| --- | --- |
| Wrong error payload shape | Documented `{ ok: false, code, message }` + `isErrorPayload` |
| Orphan list use-case files | Removed; server fns call repos/use-cases directly |
| Fake Task 1 failing test | Replaced with type change + draft regression + design doc amend |
| Incomplete indexes | Full composite list added in Task 3 |
| Blank signed-out gate | `<Navigate to="/login" search={{ redirect }} />` |
| Stale admin claim | `getIdTokenResult(true)` |
| Thin UI tasks | Concrete Vitest snippets for Tasks 8–11 |
| Memory store churn | Shared `#/test/memoryStores` from Task 2 |
| `cccd` required on update | Discriminated create/update inputs |
| Weak list tests | Memory pagination/filter tests in Task 3 |
| Cypress vs spec | Asserts redirect query; documents no live-admin CI |
| DB design drift | Task 1 amends inviteId nullability |
| Unlock on draft | Idempotent |
| Login redirect as separate late task | Folded into Task 7 |
