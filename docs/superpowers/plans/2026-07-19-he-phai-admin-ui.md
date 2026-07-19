# Hệ phái Khất sĩ Admin UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an admin ops console under `/admin` with a flat Mantine AppShell sidebar for invites, temples, Tăng/Ni members, and read-only org units — including lean create/edit, lock/unlock, and claim-gated access — without client Firestore PII access.

**Architecture:** Nested `/admin` routes with AppShell + claim gate. TanStack Query `queryOptions` call admin `createServerFn` handlers that `assertAdmin` then run domain use-cases against Firebase Admin repositories. `inviteId` becomes nullable for admin-created drafts; unlock restores `draft`.

**Tech Stack:** TanStack Start/Router/Query, Mantine AppShell, Firebase Auth claims + Admin SDK, Paraglide (`messages/vi.json`), Vitest + Testing Library, Cypress, pnpm

**Spec:** `docs/superpowers/specs/2026-07-19-he-phai-admin-ui-design.md`

## Global Constraints

- Database: Firebase Firestore + Storage only; PII via Admin SDK server fns only (no client Firestore PII reads)
- Admin access: Firebase custom claim `admin === true`; client gate is UX-only; every admin server fn re-checks via `assertAdmin`
- Sidebar (flat): Lời mời · Tịnh xá/thất · Tăng · Ni · Tổ chức
- Forms this phase: lean fields only (full paper-form editors deferred)
- Unlock: supported; invite revoke/expiry: not in this plan
- Org units UI: read-only (no seed button)
- UI copy via Paraglide Vietnamese (`messages/vi.json` → `pnpm run paraglide`)
- Work in current workspace only — **never** `git worktree add`
- Before coding: create branch `feat/he-phai-admin-ui` from `main` (Task 0)
- Follow TDD: failing test → implement → pass → commit per task
- Prefer Vitest for UI; one thin Cypress journey only

## File Structure

| File | Responsibility |
| --- | --- |
| `tanstack-app/src/domain/types.ts` | `inviteId: string \| null` on Temple/Member |
| `tanstack-app/src/repositories/memberRepo.ts` | `unlock`, `list`, nullable `inviteId` on create |
| `tanstack-app/src/repositories/templeRepo.ts` | `unlock`, `list`, nullable `inviteId` on create |
| `tanstack-app/src/repositories/inviteRepo.ts` | `list` invites |
| `tanstack-app/src/repositories/orgUnitRepo.ts` | `listOrgUnits` |
| `tanstack-app/src/use-cases/unlockMember.ts` | Unlock member |
| `tanstack-app/src/use-cases/unlockTemple.ts` | Unlock temple |
| `tanstack-app/src/use-cases/saveAdminMember.ts` | Admin create/update member (no invite token) |
| `tanstack-app/src/use-cases/saveAdminTemple.ts` | Admin create/update temple (no invite token) |
| `tanstack-app/src/use-cases/listInvites.ts` | List invites use-case |
| `tanstack-app/src/use-cases/listTemplesAdmin.ts` | List temples for admin |
| `tanstack-app/src/use-cases/listMembersAdmin.ts` | List members for admin |
| `tanstack-app/src/server/adminFns.ts` | New list/get/save/unlock server fns |
| `tanstack-app/src/server/validators.ts` | Validators for new admin inputs |
| `firebase/firestore.indexes.json` | Invite list indexes if needed |
| `tanstack-app/package.json` | Direct `@tanstack/react-query` dependency |
| `tanstack-app/src/query/queryClient.ts` | Shared `QueryClient` factory |
| `tanstack-app/src/query/adminKeys.ts` | Query key factories |
| `tanstack-app/src/query/adminQueries.ts` | `queryOptions` for admin reads |
| `tanstack-app/src/auth/useAdminClaim.ts` | Read `admin` claim from ID token |
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

### Task 1: Make `inviteId` nullable on domain types

**Files:**
- Modify: `tanstack-app/src/domain/types.ts`
- Modify: `tanstack-app/src/repositories/memberRepo.ts` (`CreateOrUpdateMemberDraftInput.inviteId`)
- Modify: `tanstack-app/src/repositories/templeRepo.ts` (`CreateOrUpdateTempleDraftInput.inviteId`)
- Test: `tanstack-app/src/domain/types.test.ts` (extend)

**Interfaces:**
- Consumes: existing `Member`, `Temple`
- Produces: `inviteId: string | null` on both types and draft input types

- [ ] **Step 1: Write the failing test**

Add to `tanstack-app/src/domain/types.test.ts`:

```ts
import type { Member, Temple } from './types'

describe('inviteId nullability', () => {
  it('allows null inviteId on Member and Temple shapes', () => {
    const member = { inviteId: null } as Pick<Member, 'inviteId'>
    const temple = { inviteId: null } as Pick<Temple, 'inviteId'>
    expect(member.inviteId).toBeNull()
    expect(temple.inviteId).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails (or typecheck fails until types updated)**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/domain/types.test.ts
```

If the test already passes before type change because of structural typing, still proceed to Step 3 to change the types; then re-run existing member/temple draft tests.

- [ ] **Step 3: Update types**

In `types.ts`, change `inviteId: string` to `inviteId: string | null` on `Member` and `Temple`.

In `memberRepo.ts` and `templeRepo.ts`, change draft input:

```ts
inviteId: string | null
```

- [ ] **Step 4: Run related tests**

```bash
pnpm exec vitest run src/domain/types.test.ts src/use-cases/memberDraft.test.ts src/use-cases/templeDraft.test.ts
```

Expected: PASS (filler flows still pass string invite ids).

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/domain/types.ts tanstack-app/src/domain/types.test.ts \
  tanstack-app/src/repositories/memberRepo.ts tanstack-app/src/repositories/templeRepo.ts
git commit -m "feat: allow null inviteId for admin-created records"
```

---

### Task 2: Unlock member and temple

**Files:**
- Modify: `tanstack-app/src/repositories/memberRepo.ts`
- Modify: `tanstack-app/src/repositories/templeRepo.ts`
- Create: `tanstack-app/src/use-cases/unlockMember.ts`
- Create: `tanstack-app/src/use-cases/unlockTemple.ts`
- Create: `tanstack-app/src/use-cases/unlock.test.ts`

**Interfaces:**
- Consumes: `MemberStore.lock` / `TempleStore.lock` patterns
- Produces:
  - `MemberStore.unlock(memberId: string): Promise<Member>`
  - `TempleStore.unlock(templeId: string): Promise<Temple>`
  - `unlockMember({ memberId }, store?): Promise<Member>`
  - `unlockTemple({ templeId }, store?): Promise<Temple>`

- [ ] **Step 1: Write the failing test**

Create `tanstack-app/src/use-cases/unlock.test.ts` using in-memory stores (mirror `memberDraft.test.ts` / temple draft patterns). Include `unlock` on the memory store:

```ts
import { describe, expect, it } from 'vitest'
import { DomainError } from '#/domain/errors'
import type { Member, Temple } from '#/domain/types'
import { unlockMember } from './unlockMember'
import { unlockTemple } from './unlockTemple'

// Minimal memory stores with getById + unlock + lock already set status locked

describe('unlockMember', () => {
  it('sets status back to draft and clears lock metadata', async () => {
    const member: Member = {
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
    const store = memoryMemberStore([member])
    const result = await unlockMember({ memberId: 'm1' }, store)
    expect(result.status).toBe('draft')
    expect(result.lockedAt).toBeNull()
    expect(result.lockedBy).toBeNull()
  })

  it('throws NOT_FOUND for missing member', async () => {
    const store = memoryMemberStore([])
    await expect(unlockMember({ memberId: 'missing' }, store)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
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
    const store = memoryTempleStore([temple])
    const result = await unlockTemple({ templeId: 't1' }, store)
    expect(result.status).toBe('draft')
    expect(result.lockedAt).toBeNull()
    expect(result.lockedBy).toBeNull()
  })
})
```

Implement `memoryMemberStore` / `memoryTempleStore` in the test file with `unlock` that throws `DomainError('NOT_FOUND')` when missing, and otherwise sets `status: 'draft'`, `lockedAt: null`, `lockedBy: null`, bumps `updatedAt`.

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm exec vitest run src/use-cases/unlock.test.ts
```

Expected: FAIL — cannot resolve `./unlockMember` / `./unlockTemple`.

- [ ] **Step 3: Implement repo unlock + use-cases**

Add to `MemberStore` / `TempleStore`:

```ts
unlock(memberId: string): Promise<Member>
// temple: unlock(templeId: string): Promise<Temple>
```

Repo implementation (member; temple mirrors):

```ts
async function unlock(memberId: string): Promise<Member> {
  const db = getAdminDb()
  const memberRef = db.collection(COLLECTIONS.members).doc(memberId)
  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(memberRef)
    if (!snap.exists) {
      throw new DomainError('NOT_FOUND', 'Member not found')
    }
    const now = new Date().toISOString()
    const member: Member = {
      ...memberFromSnap(snap),
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

Use-cases:

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

```ts
// unlockTemple.ts — same pattern with templeId / templeRepo
```

Update in-memory stores in existing draft tests if TypeScript complains about missing `unlock` on `MemberStore` / `TempleStore` (add stub `unlock` that throws or implements).

- [ ] **Step 4: Run tests**

```bash
pnpm exec vitest run src/use-cases/unlock.test.ts src/use-cases/memberDraft.test.ts src/use-cases/templeDraft.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/repositories/memberRepo.ts tanstack-app/src/repositories/templeRepo.ts \
  tanstack-app/src/use-cases/unlockMember.ts tanstack-app/src/use-cases/unlockTemple.ts \
  tanstack-app/src/use-cases/unlock.test.ts tanstack-app/src/use-cases/memberDraft.test.ts \
  tanstack-app/src/use-cases/templeDraft.test.ts
git commit -m "feat: unlock locked temple and member records"
```

---

### Task 3: Admin list repositories

**Files:**
- Modify: `tanstack-app/src/repositories/inviteRepo.ts`
- Modify: `tanstack-app/src/repositories/orgUnitRepo.ts`
- Modify: `tanstack-app/src/repositories/templeRepo.ts`
- Modify: `tanstack-app/src/repositories/memberRepo.ts`
- Create: `tanstack-app/src/repositories/adminList.test.ts` (unit with mocked query shape **or** pure cursor helper tests)
- Modify: `firebase/firestore.indexes.json` if new composites required

**Interfaces:**
- Consumes: Admin Firestore
- Produces:

```ts
export type AdminListPage<T> = {
  items: T[]
  nextCursor: string | null
}

export type ListInvitesInput = {
  orgUnitId?: string
  formType?: FormType
  limit?: number
  cursor?: string // document id
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

Default `limit` = `25`. Cursor = last document id; use `startAfter(doc)` after fetching cursor snapshot. Order by `createdAt` desc for invites; `updatedAt` desc for temples/members.

- [ ] **Step 1: Write failing tests for listOrgUnits + list interface contracts**

Create `tanstack-app/src/repositories/adminList.types.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { AdminListPage } from './adminListTypes'

describe('AdminListPage', () => {
  it('carries items and nullable nextCursor', () => {
    const page: AdminListPage<{ id: string }> = {
      items: [{ id: 'a' }],
      nextCursor: null,
    }
    expect(page.items).toHaveLength(1)
    expect(page.nextCursor).toBeNull()
  })
})
```

Create `tanstack-app/src/repositories/adminListTypes.ts`:

```ts
export type AdminListPage<T> = {
  items: T[]
  nextCursor: string | null
}
```

- [ ] **Step 2: Implement list methods**

**`listOrgUnits`:**

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

**Invites list** (build query with optional equality filters, `orderBy('createdAt', 'desc')`, `limit`, cursor via `startAfter`):

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

Temples: optional `orgUnitId`, optional `status`, `orderBy('updatedAt', 'desc')`.  
Members: required `sanghaType`, optional `orgUnitId`/`status`, `orderBy('updatedAt', 'desc')`.

When both `orgUnitId` and `status` are set on members with `sanghaType`, existing composite index covers it. When only `sanghaType` + `updatedAt`, add indexes as Firestore requires (deploy/emulator will error with a link — add those composites to `firestore.indexes.json`).

For invites filtered by `orgUnitId` + `formType` + `createdAt`, add:

```json
{
  "collectionGroup": "invites",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "orgUnitId", "order": "ASCENDING" },
    { "fieldPath": "formType", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

Also add single-filter variants if needed (`orgUnitId`+`createdAt`, `formType`+`createdAt`).

- [ ] **Step 3: Export store methods and run typecheck / unit type test**

```bash
pnpm exec vitest run src/repositories/adminList.types.test.ts
pnpm exec tsc --noEmit
```

Expected: PASS (or fix type errors in in-memory test stores missing `list`).

- [ ] **Step 4: Commit**

```bash
git add tanstack-app/src/repositories firebase/firestore.indexes.json
git commit -m "feat: add admin list queries for invites, temples, members, org units"
```

---

### Task 4: Admin save use-cases (no invite token)

**Files:**
- Create: `tanstack-app/src/use-cases/saveAdminMember.ts`
- Create: `tanstack-app/src/use-cases/saveAdminTemple.ts`
- Create: `tanstack-app/src/use-cases/saveAdminDraft.test.ts`

**Interfaces:**
- Consumes: `memberRepo.createOrUpdateDraft`, `templeRepo.createOrUpdateDraft`, `normalizeCccd`, `buildManagerPhones` / `mergeManagerPhones`
- Produces:

```ts
export type SaveAdminMemberInput = {
  orgUnitId: string
  sanghaType: SanghaType
  cccd: string
  memberId?: string // if set, load + update that member (must match org/sangha/cccd rules)
  patch: MemberProfilePatch
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
- Normalize CCCD; throw `CCCD_REQUIRED` / `CCCD_INVALID` as in filler path
- Always pass `inviteId: null` on **create**; on **update** preserve existing `inviteId` (repo already preserves on update)
- Temples: build/merge `managerPhones` like `saveTempleDraft`; require ≥1 phone
- If `memberId` provided: `getById`, throw `NOT_FOUND` / `RECORD_LOCKED`; ensure `orgUnitId`/`sanghaType` match; use existing `cccd` (do not allow CCCD change in this phase — ignore patch attempts to change identity by using stored cccd)
- Sanitize patches with the same protected-key stripping as filler saves

- [ ] **Step 1: Write failing tests**

```ts
describe('saveAdminMember', () => {
  it('creates a draft with inviteId null', async () => {
    const store = emptyMemberStore()
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

  it('rejects invalid cccd', async () => {
    await expect(
      saveAdminMember(
        { orgUnitId: 'gd-i', sanghaType: 'tang', cccd: 'bad', patch: {} },
        emptyMemberStore(),
      ),
    ).rejects.toMatchObject({ code: 'CCCD_INVALID' })
  })
})

describe('saveAdminTemple', () => {
  it('creates a draft with inviteId null when phone present', async () => {
    const store = emptyTempleStore()
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

Reuse/adapt memory stores from draft tests (with `list`/`unlock` stubs).

- [ ] **Step 2: Run to verify fail**

```bash
pnpm exec vitest run src/use-cases/saveAdminDraft.test.ts
```

Expected: FAIL — modules missing.

- [ ] **Step 3: Implement use-cases**

Mirror filler sanitize + phone/CCCD logic; call repos with `inviteId: null` on create.

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/use-cases/saveAdminMember.ts \
  tanstack-app/src/use-cases/saveAdminTemple.ts \
  tanstack-app/src/use-cases/saveAdminDraft.test.ts
git commit -m "feat: add admin save use-cases without invite token"
```

---

### Task 5: Admin server functions + validators

**Files:**
- Modify: `tanstack-app/src/server/validators.ts`
- Modify: `tanstack-app/src/server/validators.test.ts`
- Modify: `tanstack-app/src/server/adminFns.ts`

**Interfaces:**
- Consumes: `assertAdmin`, new use-cases, repo list/get
- Produces server fns (all POST, all take `idToken`):

| Fn | Input beyond idToken | Returns |
| --- | --- | --- |
| `listOrgUnitsFn` | — | `OrgUnit[]` or error payload |
| `listInvitesFn` | filters + cursor + limit | `AdminListPage<Invite>` |
| `listTemplesFn` | filters + cursor + limit | `AdminListPage<Temple>` |
| `listMembersFn` | sanghaType + filters + cursor | `AdminListPage<Member>` |
| `getTempleFn` | `templeId` | `Temple` or NOT_FOUND |
| `getMemberFn` | `memberId` | `Member` or NOT_FOUND |
| `saveAdminTempleFn` | `SaveAdminTempleInput` fields | save result |
| `saveAdminMemberFn` | `SaveAdminMemberInput` fields | save result |
| `unlockTempleFn` | `templeId` | `Temple` |
| `unlockMemberFn` | `memberId` | `Member` |

Keep existing `createInviteFn`, `lock*Fn`, `seedOrgUnitsFn`.

Pattern for each handler:

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

For get-by-id: if null, throw `DomainError('NOT_FOUND', ...)`.

- [ ] **Step 1: Write validator tests for new inputs** (mirror existing `validators.test.ts`)

- [ ] **Step 2: Run — expect fail for missing validators**

- [ ] **Step 3: Implement validators + server fns**

- [ ] **Step 4: Run `pnpm exec vitest run src/server/validators.test.ts` — PASS**

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/server/validators.ts tanstack-app/src/server/validators.test.ts \
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
- Create: `tanstack-app/src/query/adminQueries.test.ts`
- Modify: `tanstack-app/src/routes/__root.tsx` — wrap with `QueryClientProvider`

**Interfaces:**

```ts
// queryClient.ts
export function createAppQueryClient(): QueryClient

// adminKeys.ts
export const adminKeys = {
  all: ['admin'] as const,
  orgUnits: () => [...adminKeys.all, 'orgUnits'] as const,
  invites: (filters: ListInvitesInput) => [...adminKeys.all, 'invites', filters] as const,
  temples: (filters: ListTemplesAdminInput) => [...adminKeys.all, 'temples', filters] as const,
  temple: (id: string) => [...adminKeys.all, 'temple', id] as const,
  members: (filters: ListMembersAdminInput) => [...adminKeys.all, 'members', filters] as const,
  member: (id: string) => [...adminKeys.all, 'member', id] as const,
}

// adminQueries.ts — each needs getIdToken: () => Promise<string>
export function orgUnitsQuery(getIdToken: () => Promise<string>) {
  return queryOptions({
    queryKey: adminKeys.orgUnits(),
    queryFn: async () => {
      const result = await listOrgUnitsFn({ data: { idToken: await getIdToken() } })
      // if error payload, throw
      return result as OrgUnit[]
    },
    staleTime: 5 * 60_000,
  })
}
// similarly invitesQuery, templesQuery, membersQuery, templeQuery, memberQuery
```

Helper to detect error payload (reuse shape from `toErrorPayload` — typically `{ error: { code, message } }`).

- [ ] **Step 1: Install dependency**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm add @tanstack/react-query
```

- [ ] **Step 2: Write key factory test**

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

- [ ] **Step 3: Implement queryClient, keys, queryOptions; wrap provider in `__root.tsx`**

```tsx
const queryClient = createAppQueryClient()
// inside MantineProvider / AuthProvider:
<QueryClientProvider client={queryClient}>{/* ... */}</QueryClientProvider>
```

Create client once per browser session (module singleton or `useState(() => createAppQueryClient())` in root to avoid SSR sharing — prefer per-request/browser-safe pattern used by TanStack Start; for this app, `useState` factory inside `RootDocument` is fine).

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/package.json tanstack-app/pnpm-lock.yaml \
  tanstack-app/src/query tanstack-app/src/routes/__root.tsx
git commit -m "feat: add TanStack Query admin key factories and provider"
```

---

### Task 7: Admin claim gate + AppShell layout + i18n

**Files:**
- Create: `tanstack-app/src/auth/useAdminClaim.ts`
- Create: `tanstack-app/src/auth/useAdminClaim.test.tsx`
- Create: `tanstack-app/src/components/admin/AdminDenied.tsx`
- Create: `tanstack-app/src/components/admin/AdminShell.tsx`
- Create: `tanstack-app/src/components/admin/AdminShell.test.tsx`
- Create: `tanstack-app/src/routes/admin.tsx`
- Create: `tanstack-app/src/routes/admin/index.tsx` (redirect to invites)
- Modify: `tanstack-app/src/routes/__root.tsx` — hide `AppHeader` when path starts with `/admin`
- Modify: `tanstack-app/messages/vi.json` — admin strings
- Run: `pnpm run generate-routes` / paraglide as needed

**Interfaces:**

```ts
export type AdminClaimState =
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'denied' }
  | { status: 'admin'; getIdToken: () => Promise<string> }

export function useAdminClaim(): AdminClaimState
```

Implementation: use `useAuth()`; when `user` set, `user.getIdTokenResult()` and check `claims.admin === true`. Provide `getIdToken: () => user.getIdToken()`.

**Admin layout (`routes/admin.tsx`):**

```tsx
export const Route = createFileRoute('/admin')({
  component: AdminLayout,
})

function AdminLayout() {
  const claim = useAdminClaim()
  const navigate = useNavigate()

  if (claim.status === 'loading') return <Loader />
  if (claim.status === 'signed_out') {
    // navigate to /login?redirect=<current>
    return null
  }
  if (claim.status === 'denied') return <AdminDenied />
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  )
}
```

**AdminShell:** Mantine `AppShell` with `NavLink` items:

| Label key | To |
| --- | --- |
| `admin_nav_invites` | `/admin/invites` |
| `admin_nav_temples` | `/admin/temples` |
| `admin_nav_tang` | `/admin/members/tang` |
| `admin_nav_ni` | `/admin/members/ni` |
| `admin_nav_org_units` | `/admin/org-units` |

Header: `admin_title` + identity + sign out (`useAuth().signOut`).

**vi.json keys (minimum):**  
`admin_title`, `admin_denied_title`, `admin_denied_body`, `admin_nav_invites`, `admin_nav_temples`, `admin_nav_tang`, `admin_nav_ni`, `admin_nav_org_units`, `admin_sign_out`

- [ ] **Step 1: Write failing AdminShell / useAdminClaim tests** (mock AuthContext + `getIdTokenResult`)

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Implement claim hook, Denied, Shell, admin layout, messages, hide AppHeader on `/admin`**

Use `useRouterState` or `useLocation` in `__root__` to conditionally render `AppHeader`.

- [ ] **Step 4: `pnpm run paraglide && pnpm run generate-routes && pnpm exec vitest run src/auth/useAdminClaim.test.tsx src/components/admin/AdminShell.test.tsx`**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/auth/useAdminClaim.ts tanstack-app/src/auth/useAdminClaim.test.tsx \
  tanstack-app/src/components/admin tanstack-app/src/routes/admin.tsx \
  tanstack-app/src/routes/admin tanstack-app/src/routes/__root.tsx \
  tanstack-app/src/routeTree.gen.ts tanstack-app/messages/vi.json
git commit -m "feat: add admin AppShell layout with claim gate and sidebar"
```

---

### Task 8: Org units read-only page

**Files:**
- Create: `tanstack-app/src/routes/admin/org-units.tsx`
- Create: `tanstack-app/src/components/admin/OrgUnitsPage.tsx`
- Create: `tanstack-app/src/components/admin/OrgUnitsPage.test.tsx`
- Modify: `tanstack-app/messages/vi.json`

- [ ] **Step 1: Failing test — renders table headers / mocked org units**

- [ ] **Step 2: Implement page with `useQuery(orgUnitsQuery(getIdToken))` and Mantine `Table`** (code, name, kind)

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit**

```bash
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
- Create: Modal with org unit + form type → `createInviteFn` → show `/f/{token}` and copy via `navigator.clipboard.writeText`
- Load more if `nextCursor`

Share URL: `${window.location.origin}/f/${token}` (filler route may not exist yet — still copy the planned URL).

- [ ] **Step 1: Failing Vitest — create button opens modal; list renders mocked rows**

- [ ] **Step 2: Implement**

- [ ] **Step 3: PASS + commit**

```bash
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

**List:** filters org unit + status; columns danhHieu, first manager phone, status, updatedAt; CTA to `/admin/temples/new`; row → `/admin/temples/$id`.

**Form (new + detail):** fields org unit (disabled on edit), danhHieu, truTri phone, optional `diaChiMoi` (or one address string field already on type). Draft: Save (`saveAdminTempleFn`) + Lock (`lockTempleFn`). Locked: read-only + Unlock (`unlockTempleFn`). Show inviteId or “Tạo bởi admin”.

- [ ] **Step 1: Failing list/form tests with mocked queries/mutations**

- [ ] **Step 2: Implement routes + components**

- [ ] **Step 3: PASS + commit**

```bash
git commit -m "feat: add admin temple list and lean create/detail with lock"
```

---

### Task 11: Members list + lean create/detail (Tăng / Ni)

**Files:**
- Create: `tanstack-app/src/routes/admin/members.tang.tsx` → `/admin/members/tang`
- Create: `tanstack-app/src/routes/admin/members.ni.tsx` → `/admin/members/ni`
- Create: `tanstack-app/src/routes/admin/members.new.tsx`
- Create: `tanstack-app/src/routes/admin/members.$id.tsx`
- Create: `tanstack-app/src/components/admin/MembersListPage.tsx` (prop `sanghaType`)
- Create: `tanstack-app/src/components/admin/MemberFormPage.tsx`
- Create: corresponding `*.test.tsx`
- Modify: `messages/vi.json`

**List:** same filters as temples; columns phapDanh/theDanh, cccd, status, updatedAt; new → `/admin/members/new?sanghaType=tang|ni`.

**Form:** org unit, sanghaType (from query on create; fixed on edit), CCCD (editable only on create), phapDanh, theDanh, dienThoai. Save / Lock / Unlock same as temples.

- [ ] **Step 1–4:** TDD + implement + commit

```bash
git commit -m "feat: add admin member list and lean create/detail with lock"
```

---

### Task 12: Login return URL for admin deep links

**Files:**
- Modify: `tanstack-app/src/components/LoginPage.tsx`
- Modify: `tanstack-app/src/components/LoginPage.test.tsx`
- Modify: `tanstack-app/src/routes/login.tsx` if search schema needed
- Modify: `tanstack-app/src/routes/admin.tsx` — redirect to `/login?redirect=...`

**Behavior:**
- Admin gate navigates to `/login?redirect=${encodeURIComponent(pathname + search)}`
- After successful sign-in, navigate to `redirect` if it is a same-origin path starting with `/`, else `/`
- Already-signed-in on `/login` with redirect: go to redirect (not only `/`)

- [ ] **Step 1: Failing test — after Google sign-in, navigates to redirect param**

- [ ] **Step 2: Implement**

- [ ] **Step 3: PASS + commit**

```bash
git commit -m "feat: preserve admin redirect path through login"
```

---

### Task 13: Cypress thin smoke

**Files:**
- Create: `tanstack-app/cypress/e2e/admin.cy.ts`

```ts
describe('Admin', () => {
  it('sends anonymous users from /admin to login', () => {
    cy.visit('/admin')
    cy.url().should('include', '/login')
    cy.contains('h1', 'Đăng nhập').should('be.visible')
  })
})
```

Do **not** require live admin claim in CI.

- [ ] **Step 1: Add spec**

- [ ] **Step 2: Run**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm test:e2e
```

Expected: PASS (or run `pnpm cy:run` if server already up).

- [ ] **Step 3: Commit**

```bash
git add tanstack-app/cypress/e2e/admin.cy.ts
git commit -m "test: add Cypress smoke for admin login redirect"
```

---

### Task 14: Final verification

**Files:** none

- [ ] **Step 1: Run unit tests**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm test
```

Expected: PASS.

- [ ] **Step 2: Manual checklist (document in commit message or skip if no emulator)**

- Claimed admin: sidebar, invites create/copy, temple/member CRUD lean, lock/unlock, org units list  
- Non-admin: denied message  
- Signed out: redirect to login with return URL  

- [ ] **Step 3: Commit any leftover copy/route fixes, or skip if clean**

```bash
git status
```

---

## Self-review notes (for plan author)

Spec coverage: shell/routes/access ✓ · nullable inviteId ✓ · unlock ✓ · lean forms ✓ · list/filter ✓ · org read-only ✓ · Query + server fns ✓ · Vitest + thin Cypress ✓ · filler `/f` out of scope ✓ · seed button out of scope ✓

Type consistency: `AdminListPage`, `inviteId: string | null`, unlock clears lock fields, admin saves pass `inviteId: null` on create.
