# Typesense Admin Command-Palette Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin ⌘K / Ctrl+K command palette that searches members and temples via Typesense (`typesense.giasuai.io`), scoped like directory lists, with write-path index sync and a `he_phai_admin` rebuild on `/admin/org-units`.

**Architecture:** Browser never holds the Typesense key. Cloudflare Worker proxies search/upsert/delete/reindex. Lean search docs are mapped in domain helpers. After Firestore saves/deletes, the client fire-and-forgets upsert/delete to the worker (admin Bearer or invite token). Rebuild is client-orchestrated (existing Firestore repos + converters) posting batches to the worker after schema ensure — avoids fragile nested Admin REST parsing.

**Tech Stack:** Typesense REST (`fetch` + `X-TYPESENSE-API-KEY`), Cloudflare Worker, Firebase ID token verification (`verifyFirebaseAdmin`), `@mantine/spotlight`, TanStack Query debounce in Spotlight, Paraglide, Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-17-typesense-admin-search-design.md`
- Workspace: create branch `feat/typesense-admin-search` from `main` before coding; do **not** use git worktrees (`git checkout -b` only).
- Typesense host: `https://typesense.giasuai.io` (env override allowed).
- Collection names: `khatsi_members` and `khatsi_temples` (prefixed on shared Typesense to avoid collisions; same schemas as spec’s `members` / `temples`).
- Admin API key only in worker secrets (`TYPESENSE_API_KEY`); never `VITE_`.
- Search auth: `canManageDirectory` (hệ phái or giáo đoàn). Giáo đoàn must send/apply `orgUnitId` filter. Rebuild: `he_phai_admin` only.
- Index draft + locked. Upsert failures must not fail user saves.
- No accent folding, no retreats, no Cypress for this feature.
- Tests: from `tanstack-app`, `pnpm exec vitest run <file>`. After `messages/vi.json` edits: `pnpm paraglide`.
- Every task’s requirements include this section.

## File map

| File | Responsibility |
|------|----------------|
| Create `tanstack-app/src/domain/searchDocs.ts` | `MemberSearchDoc` / `TempleSearchDoc`, mappers, phone helper, epoch helper |
| Create `tanstack-app/src/domain/searchDocs.test.ts` | Mapper tests |
| Modify `tanstack-app/src/worker/env.ts` | `TYPESENSE_HOST?`, `TYPESENSE_API_KEY` |
| Modify `tanstack-app/src/worker/verifyFirebaseAdmin.ts` | Return `orgUnitId` from JWT |
| Modify `tanstack-app/src/worker/verifyFirebaseAdmin.test.ts` | Cover `orgUnitId` |
| Create `tanstack-app/src/worker/typesenseClient.ts` | REST helpers: ensure collections, multi-search, upsert, delete, import |
| Create `tanstack-app/src/worker/typesenseClient.test.ts` | Mocked fetch tests |
| Create `tanstack-app/src/worker/searchApi.ts` | Route handlers for `/api/search*` |
| Create `tanstack-app/src/worker/searchApi.test.ts` | Auth, scope filter, upsert/delete/reindex gates |
| Modify `tanstack-app/src/worker.ts` | Mount search routes |
| Create `tanstack-app/src/search/searchApiClient.ts` | Browser client: search, upsert, delete, reindex phases |
| Create `tanstack-app/src/search/searchApiClient.test.ts` | Client tests |
| Create `tanstack-app/src/search/notifySearchIndex.ts` | Best-effort upsert/delete wrappers (never throw to caller) |
| Create `tanstack-app/src/search/notifySearchIndex.test.ts` | Swallow errors |
| Modify admin/filler save & delete call sites | Fire-and-forget index notify |
| Modify `tanstack-app/src/repositories/templeRepo.ts` | `listAllForExport` (paginate all temples) |
| Create `tanstack-app/src/components/admin/AdminDirectorySearch.tsx` | Spotlight + remote search |
| Create `tanstack-app/src/components/admin/AdminDirectorySearch.test.tsx` | Open, navigate, scoped client call |
| Modify `tanstack-app/src/components/admin/AdminShell.tsx` | Mount search + header button |
| Modify `tanstack-app/src/components/admin/AdminShell.test.tsx` | Search control when directory |
| Modify `tanstack-app/src/components/admin/OrgUnitsPage.tsx` | Rebuild button + confirm |
| Modify `tanstack-app/src/components/admin/OrgUnitsPage.test.tsx` | Rebuild gated to `he_phai_admin` |
| Create `tanstack-app/src/search/reindexDirectory.ts` | Orchestrate ensure + import batches |
| Create `tanstack-app/src/search/reindexDirectory.test.ts` | Orchestration tests |
| Modify `tanstack-app/messages/vi.json` | Search / rebuild copy |
| Modify `tanstack-app/src/routes/__root.tsx` | Import `@mantine/spotlight/styles.css` |
| Modify `tanstack-app/package.json` | Add `@mantine/spotlight@^9.4.1` |

---

### Task 1: Search document mappers

**Files:**
- Create: `tanstack-app/src/domain/searchDocs.ts`
- Test: `tanstack-app/src/domain/searchDocs.test.ts`

**Interfaces:**
- Consumes: `Member`, `Temple` from `#/domain/types`; `normalizeVnPhone` from `#/domain/normalize`
- Produces:
  - `export type MemberSearchDoc = { id: string; orgUnitId: string; sanghaType: string; status: string; phapDanh: string; theDanh: string; cccd: string; dienThoai: string; updatedAt: number }`
  - `export type TempleSearchDoc = { id: string; orgUnitId: string; status: string; danhHieu: string; truTriPhapDanh: string; phones: string[]; updatedAt: number }`
  - `export function searchPhoneDigits(raw: string | undefined): string`
  - `export function toUpdatedAtMs(iso: string): number`
  - `export function toMemberSearchDoc(member: Member): MemberSearchDoc`
  - `export function toTempleSearchDoc(temple: Temple): TempleSearchDoc`
  - `export const TYPESENSE_MEMBERS_COLLECTION = 'khatsi_members'`
  - `export const TYPESENSE_TEMPLES_COLLECTION = 'khatsi_temples'`

- [ ] **Step 1: Write the failing test**

Create `tanstack-app/src/domain/searchDocs.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import type { Member, Temple } from '#/domain/types'
import {
  toMemberSearchDoc,
  toTempleSearchDoc,
  searchPhoneDigits,
} from '#/domain/searchDocs'

function member(overrides: Partial<Member> = {}): Member {
  return {
    id: 'm1',
    orgUnitId: 'gd-i',
    sanghaType: 'tang',
    status: 'draft',
    cccd: '012345678901',
    inviteId: null,
    currentTempleId: null,
    photoPath: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    editRequestedAt: null,
    editRequestedBy: null,
    ...overrides,
  }
}

function temple(overrides: Partial<Temple> = {}): Temple {
  return {
    id: 't1',
    orgUnitId: 'gd-i',
    status: 'locked',
    managerPhones: ['0901234567'],
    inviteId: null,
    photoPath: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    editRequestedAt: null,
    editRequestedBy: null,
    ...overrides,
  }
}

describe('toMemberSearchDoc', () => {
  it('maps searchable fields and normalizes phone', () => {
    const doc = toMemberSearchDoc(
      member({
        phapDanh: 'Thích A',
        theDanh: 'Nguyễn A',
        dienThoai: '090-123-4567',
      }),
    )
    expect(doc).toMatchObject({
      id: 'm1',
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      status: 'draft',
      phapDanh: 'Thích A',
      theDanh: 'Nguyễn A',
      cccd: '012345678901',
      dienThoai: '0901234567',
    })
    expect(doc.updatedAt).toBe(Date.parse('2026-08-02T00:00:00.000Z'))
  })

  it('uses empty strings for missing optionals', () => {
    const doc = toMemberSearchDoc(member())
    expect(doc.phapDanh).toBe('')
    expect(doc.dienThoai).toBe('')
  })
})

describe('toTempleSearchDoc', () => {
  it('merges managerPhones and tru tri phone uniquely', () => {
    const doc = toTempleSearchDoc(
      temple({
        danhHieu: 'TX A',
        managerPhones: ['0901234567'],
        truTriHienNay: { phapDanh: 'HT B', dienThoai: '0912345678' },
      }),
    )
    expect(doc.danhHieu).toBe('TX A')
    expect(doc.truTriPhapDanh).toBe('HT B')
    expect(doc.phones.sort()).toEqual(['0901234567', '0912345678'].sort())
  })
})

describe('searchPhoneDigits', () => {
  it('returns empty for blank; digits for garbage that is not a valid VN phone', () => {
    expect(searchPhoneDigits(undefined)).toBe('')
    expect(searchPhoneDigits('abc')).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tanstack-app && pnpm exec vitest run src/domain/searchDocs.test.ts`

Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

Create `tanstack-app/src/domain/searchDocs.ts`:

```typescript
import type { Member, Temple } from '#/domain/types'
import { normalizeVnPhone } from '#/domain/normalize'

export const TYPESENSE_MEMBERS_COLLECTION = 'khatsi_members'
export const TYPESENSE_TEMPLES_COLLECTION = 'khatsi_temples'

export type MemberSearchDoc = {
  id: string
  orgUnitId: string
  sanghaType: string
  status: string
  phapDanh: string
  theDanh: string
  cccd: string
  dienThoai: string
  updatedAt: number
}

export type TempleSearchDoc = {
  id: string
  orgUnitId: string
  status: string
  danhHieu: string
  truTriPhapDanh: string
  phones: string[]
  updatedAt: number
}

export function searchPhoneDigits(raw: string | undefined): string {
  if (!raw?.trim()) return ''
  try {
    return normalizeVnPhone(raw)
  } catch {
    return ''
  }
}

export function toUpdatedAtMs(iso: string): number {
  const n = Date.parse(iso)
  return Number.isFinite(n) ? n : 0
}

export function toMemberSearchDoc(member: Member): MemberSearchDoc {
  return {
    id: member.id,
    orgUnitId: member.orgUnitId,
    sanghaType: member.sanghaType,
    status: member.status,
    phapDanh: member.phapDanh ?? '',
    theDanh: member.theDanh ?? '',
    cccd: member.cccd ?? '',
    dienThoai: searchPhoneDigits(member.dienThoai),
    updatedAt: toUpdatedAtMs(member.updatedAt),
  }
}

export function toTempleSearchDoc(temple: Temple): TempleSearchDoc {
  const phones = new Set<string>()
  for (const p of temple.managerPhones ?? []) {
    const d = searchPhoneDigits(p)
    if (d) phones.add(d)
  }
  const truTriPhone = searchPhoneDigits(temple.truTriHienNay?.dienThoai)
  if (truTriPhone) phones.add(truTriPhone)
  return {
    id: temple.id,
    orgUnitId: temple.orgUnitId,
    status: temple.status,
    danhHieu: temple.danhHieu ?? '',
    truTriPhapDanh: temple.truTriHienNay?.phapDanh ?? '',
    phones: [...phones],
    updatedAt: toUpdatedAtMs(temple.updatedAt),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tanstack-app && pnpm exec vitest run src/domain/searchDocs.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/domain/searchDocs.ts tanstack-app/src/domain/searchDocs.test.ts
git commit -m "feat: add Typesense search document mappers"
```

---

### Task 2: Worker Typesense client + claims orgUnitId + env

**Files:**
- Modify: `tanstack-app/src/worker/env.ts`
- Modify: `tanstack-app/src/worker/verifyFirebaseAdmin.ts`
- Modify: `tanstack-app/src/worker/verifyFirebaseAdmin.test.ts`
- Create: `tanstack-app/src/worker/typesenseClient.ts`
- Test: `tanstack-app/src/worker/typesenseClient.test.ts`

**Interfaces:**
- Consumes: collection name constants + search doc types from `#/domain/searchDocs`
- Produces:
  - `verifyFirebaseAdminToken` → `{ uid; role; orgUnitId: string | null }`
  - `Env.TYPESENSE_API_KEY: string`, `Env.TYPESENSE_HOST?: string` (default `https://typesense.giasuai.io`)
  - `createTypesenseClient(env)` with:
    - `ensureCollections(): Promise<void>`
    - `multiSearch(input: { q: string; filterBy?: string; perPage: number }): Promise<{ members: MemberSearchDoc[]; temples: TempleSearchDoc[] }>`
    - `upsert(collection: string, doc: object): Promise<void>`
    - `deleteDocument(collection: string, id: string): Promise<void>`
    - `importDocuments(collection: string, docs: object[]): Promise<void>`

- [ ] **Step 1: Extend verifyFirebaseAdmin tests**

In `verifyFirebaseAdmin.test.ts`, add a case where JWT payload includes `orgUnitId: 'gd-i'` and `role: 'giao_doan_admin'`; expect `orgUnitId === 'gd-i'`. When missing, expect `orgUnitId === null`.

- [ ] **Step 2: Run tests — expect fail on orgUnitId**

Run: `cd tanstack-app && pnpm exec vitest run src/worker/verifyFirebaseAdmin.test.ts`

- [ ] **Step 3: Implement orgUnitId on verify**

Update return type and parsing:

```typescript
orgUnitId:
  typeof payload.orgUnitId === 'string' && payload.orgUnitId.length > 0
    ? payload.orgUnitId
    : null,
```

Update all call sites / mocks that construct the return value if TypeScript breaks (photos tests mock only `{ uid }` — widen mock as needed).

- [ ] **Step 4: Write typesenseClient failing tests**

Create `typesenseClient.test.ts` that mocks `fetch`:

1. `ensureCollections` — GET collection 404 → POST create with schema for `khatsi_members` / `khatsi_temples` (fields matching Task 1; `default_sorting_field: updatedAt`).
2. `multiSearch` — POST `{host}/multi_search` with header `X-TYPESENSE-API-KEY`, body two searches, parse hits into docs.
3. `upsert` — POST `.../collections/{name}/documents?action=upsert`.
4. `deleteDocument` — DELETE `.../documents/{id}`.

Use `TYPESENSE_HOST: 'https://typesense.test'` and a fake API key.

- [ ] **Step 5: Implement `typesenseClient.ts`**

Use raw `fetch`. Strip trailing slash from host. On ensure: if GET `/collections/{name}` returns 200, skip create; if 404, POST schema. Members schema fields: `id` string, `orgUnitId` string facet, `sanghaType` string facet, `status` string facet, `phapDanh` string, `theDanh` string, `cccd` string, `dienThoai` string, `updatedAt` int64. Temples: `id`, `orgUnitId` facet, `status` facet, `danhHieu`, `truTriPhapDanh`, `phones` string[], `updatedAt` int64. Query-by as in spec.

`multiSearch`: both collections, `q`, `query_by`, optional shared `filter_by` (`orgUnitId:=gd-i`), `per_page`, `prefix: true`.

`importDocuments`: POST `/collections/{name}/documents/import?action=upsert` with NDJSON body.

- [ ] **Step 6: Update `env.ts`**

```typescript
TYPESENSE_API_KEY: string
TYPESENSE_HOST?: string
```

- [ ] **Step 7: Run tests**

Run: `cd tanstack-app && pnpm exec vitest run src/worker/typesenseClient.test.ts src/worker/verifyFirebaseAdmin.test.ts`

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add tanstack-app/src/worker/env.ts tanstack-app/src/worker/verifyFirebaseAdmin.ts tanstack-app/src/worker/verifyFirebaseAdmin.test.ts tanstack-app/src/worker/typesenseClient.ts tanstack-app/src/worker/typesenseClient.test.ts
git commit -m "feat: add Typesense worker client and orgUnitId claims"
```

---

### Task 3: Worker `/api/search*` handlers

**Files:**
- Create: `tanstack-app/src/worker/searchApi.ts`
- Test: `tanstack-app/src/worker/searchApi.test.ts`
- Modify: `tanstack-app/src/worker.ts`

**Interfaces:**
- Consumes: `verifyFirebaseAdminToken`, `verifyHePhaiAdminToken`, `inviteExists` from `#/worker/firestoreRest` (same as photos), `createTypesenseClient`, domain collection constants + doc types
- Produces: `handleSearchApi(request, env): Promise<Response | null>` — returns `null` if path not under `/api/search`

Routes:

| Method + path | Auth | Body / behavior |
| --- | --- | --- |
| `POST /api/search` | directory admin | `{ q: string }` → multi-search; if role `giao_doan_admin`, require `orgUnitId` and `filter_by=orgUnitId:={id}`; per_page 8 |
| `POST /api/search/upsert` | admin **or** `inviteToken` via `inviteExists` | `{ collection: 'members' \| 'temples', document: MemberSearchDoc \| TempleSearchDoc }` map collection → `khatsi_*` |
| `POST /api/search/delete` | directory admin | `{ collection, id }` |
| `POST /api/search/reindex` | `he_phai_admin` | `{ phase: 'ensure' }` → ensureCollections; `{ phase: 'import', collection, documents: object[] }` → importDocuments; return `{ ok: true, imported?: number }` |

- [ ] **Step 1: Write failing handler tests**

Mirror `directoryRoleApi.test.ts` / `photosApi.test.ts` style: mock verify + typesense client module.

Cover:
- 401 without token on `/api/search`
- 403 when verify returns null / non-directory role (if you only allow the three admin roles from verify — `kiem_soat` already excluded)
- giáo đoàn search includes `filter_by` with claim orgUnitId; 403 if giao_doan missing orgUnitId
- hệ phái search has no filter_by
- upsert with inviteToken when `inviteExists` true
- upsert 401 when neither admin nor valid invite
- delete requires admin
- reindex ensure/import requires `he_phai_admin`; secretary → 403

- [ ] **Step 2: Run — expect fail**

Run: `cd tanstack-app && pnpm exec vitest run src/worker/searchApi.test.ts`

- [ ] **Step 3: Implement `searchApi.ts` and mount in `worker.ts`**

```typescript
// worker.ts excerpt
if (url.pathname.startsWith('/api/search')) {
  return handleSearchApi(request, env)
}
```

Parse Bearer like photos. Directory admin = any successful `verifyFirebaseAdminToken`. For search filter use `role === 'giao_doan_admin'`.

Empty/whitespace `q` on search → `{ members: [], temples: [] }` without calling Typesense.

- [ ] **Step 4: Run tests — PASS**

Run: `cd tanstack-app && pnpm exec vitest run src/worker/searchApi.test.ts`

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/worker/searchApi.ts tanstack-app/src/worker/searchApi.test.ts tanstack-app/src/worker.ts
git commit -m "feat: add worker Typesense search API routes"
```

---

### Task 4: Browser search API client + notify helpers

**Files:**
- Create: `tanstack-app/src/search/searchApiClient.ts`
- Test: `tanstack-app/src/search/searchApiClient.test.ts`
- Create: `tanstack-app/src/search/notifySearchIndex.ts`
- Test: `tanstack-app/src/search/notifySearchIndex.test.ts`

**Interfaces:**
- Produces:
  - `searchDirectory({ q, idToken }): Promise<{ members: MemberSearchDoc[]; temples: TempleSearchDoc[] }>`
  - `upsertSearchDocument({ collection: 'members' \| 'temples'; document; idToken?; inviteToken? }): Promise<void>`
  - `deleteSearchDocument({ collection; id; idToken }): Promise<void>`
  - `reindexEnsure({ idToken }): Promise<void>`
  - `reindexImport({ idToken; collection; documents }): Promise<{ imported: number }>`
  - `notifyMemberUpsert(member, auth: { idToken?: string; inviteToken?: string }): Promise<void>` — maps + upsert; catches/logs errors
  - `notifyTempleUpsert(temple, auth): Promise<void>`
  - `notifyMemberDelete(id, idToken): Promise<void>`
  - `notifyTempleDelete(id, idToken): Promise<void>`

- [ ] **Step 1: Write client tests with mocked `fetch`**

Assert paths `/api/search`, `/api/search/upsert`, Authorization header, inviteToken in body, reindex phases.

- [ ] **Step 2: Write notify tests**

Mock `searchApiClient.upsertSearchDocument` to reject; `notifyMemberUpsert` resolves without throwing.

- [ ] **Step 3: Implement clients**

Follow `photosApiClient.ts` error reading pattern.

- [ ] **Step 4: Run tests — PASS**

Run: `cd tanstack-app && pnpm exec vitest run src/search/searchApiClient.test.ts src/search/notifySearchIndex.test.ts`

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/search/
git commit -m "feat: add search API client and best-effort index notify"
```

---

### Task 5: Wire write-path index sync

**Files:**
- Modify: `tanstack-app/src/components/admin/MemberFormPage.tsx` (saveMutation / lock paths that return member — after success call `notifyMemberUpsert` with `idToken`)
- Modify: `tanstack-app/src/components/admin/TempleFormPage.tsx` (same for temples)
- Modify: `tanstack-app/src/components/filler/MemberEditorForm.tsx` (`inviteToken: token` + member from save)
- Modify: `tanstack-app/src/components/filler/TempleEditorForm.tsx`
- Modify: `tanstack-app/src/use-cases/deleteMembers.ts` (after successful deletes, notify deletes — or call notify from list page mutation `onSuccess` with ids; prefer use-case end if idToken already available)
- Modify: `tanstack-app/src/use-cases/deleteTemples.ts`
- Update related unit tests to mock `#/search/notifySearchIndex` so existing tests stay green

**Interfaces:**
- Consumes: `notifyMemberUpsert`, `notifyTempleUpsert`, `notifyMemberDelete`, `notifyTempleDelete`
- Pattern: `void notifyMemberUpsert(member, { idToken }).catch(() => {})` is unnecessary if notify already swallows — just `void notifyMemberUpsert(...)`.

- [ ] **Step 1: Identify every success path that creates/updates/deletes member or temple**

At minimum: admin save + lock (if lock returns/updates entity), filler save/lock, bulk delete members/temples. If unlock does not change searchable fields, skip. Org reassignment on save already returns updated entity — upsert covers it.

- [ ] **Step 2: Add notify calls; mock in tests**

Example admin save `onSuccess`:

```typescript
onSuccess: async (result) => {
  const idToken = await user!.getIdToken()
  void notifyMemberUpsert(result.member, { idToken })
  // ...existing invalidate/navigate
}
```

Filler:

```typescript
void notifyMemberUpsert(result.member, { inviteToken: token })
```

Deletes: for each id, `void notifyMemberDelete(id, idToken)`.

- [ ] **Step 3: Run affected tests**

Run: `cd tanstack-app && pnpm exec vitest run src/components/admin/MemberFormPage.test.tsx src/components/admin/TempleFormPage.test.tsx src/components/filler/MemberEditorForm.test.tsx src/use-cases/deleteMembers.test.ts src/use-cases/deleteTemples.test.ts`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add tanstack-app/src/components/admin/MemberFormPage.tsx tanstack-app/src/components/admin/TempleFormPage.tsx tanstack-app/src/components/filler/MemberEditorForm.tsx tanstack-app/src/components/filler/TempleEditorForm.tsx tanstack-app/src/use-cases/deleteMembers.ts tanstack-app/src/use-cases/deleteTemples.ts tanstack-app/src/use-cases/deleteMembers.test.ts tanstack-app/src/use-cases/deleteTemples.test.ts
# plus any other touched test mocks
git commit -m "feat: sync Typesense index on member and temple writes"
```

---

### Task 6: Admin directory Spotlight UI

**Files:**
- Run: `cd tanstack-app && pnpm add @mantine/spotlight@^9.4.1`
- Modify: `tanstack-app/src/routes/__root.tsx` — `import '@mantine/spotlight/styles.css'`
- Modify: `tanstack-app/messages/vi.json` — keys below
- Run: `pnpm paraglide`
- Create: `tanstack-app/src/components/admin/AdminDirectorySearch.tsx`
- Test: `tanstack-app/src/components/admin/AdminDirectorySearch.test.tsx`
- Modify: `tanstack-app/src/components/admin/AdminShell.tsx`
- Modify: `tanstack-app/src/components/admin/AdminShell.test.tsx`

**i18n keys (vi):**
- `admin_search_placeholder`: `Tìm thành viên hoặc tịnh xá…`
- `admin_search_hint`: `Gõ pháp danh, thế danh, CCCD, SĐT hoặc danh hiệu`
- `admin_search_empty`: `Không tìm thấy`
- `admin_search_error`: `Không tìm kiếm được. Thử lại sau.`
- `admin_search_group_members`: `Thành viên`
- `admin_search_group_temples`: `Tịnh xá`
- `admin_search_open_aria`: `Tìm kiếm`
- `admin_search_shortcut_hint`: `⌘K`

**Interfaces:**
- `AdminDirectorySearch` rendered inside `AdminShell` when `canManageDirectory`
- Uses `Spotlight.Root` with `query` / `onQueryChange`, `shortcut="mod + K"`
- Debounce 250ms then `searchDirectory` with `user.getIdToken()`
- AbortController cancel previous request
- Groups via `Spotlight.ActionsGroup` / labeled sections; actions navigate with TanStack Router `navigate({ to: '/admin/members/$id', params: { id } })` then `spotlight.close()`
- Header: IconButton / ActionIcon with Search icon calling `spotlight.open()`

- [ ] **Step 1: Install package + CSS + messages + paraglide**

- [ ] **Step 2: Write AdminDirectorySearch test**

Mock `searchDirectory` to return one member + one temple. Render with auth mocks (reuse AdminShell test patterns). Type into search (or set query), wait for results, click member action, assert `navigate` called with member id.

Also assert empty query does not call `searchDirectory`.

- [ ] **Step 3: Implement `AdminDirectorySearch` + mount in shell**

Use compound Spotlight API:

```tsx
<Spotlight.Root
  shortcut="mod + K"
  query={query}
  onQueryChange={setQuery}
>
  <Spotlight.Search placeholder={m.admin_search_placeholder()} leftSection={<Search size={16} />} />
  <Spotlight.ActionsList>
    {/* groups + actions or Empty / hint */}
  </Spotlight.ActionsList>
</Spotlight.Root>
```

Show hint when `query.trim()` empty; error text when fetch fails; empty when no hits.

- [ ] **Step 4: Update AdminShell tests**

When directory-capable admin, search open control present (`getByRole('button', { name: ... })`).

- [ ] **Step 5: Run tests — PASS**

Run: `cd tanstack-app && pnpm exec vitest run src/components/admin/AdminDirectorySearch.test.tsx src/components/admin/AdminShell.test.tsx`

- [ ] **Step 6: Commit**

```bash
git add tanstack-app/package.json tanstack-app/pnpm-lock.yaml tanstack-app/src/routes/__root.tsx tanstack-app/messages/vi.json tanstack-app/src/paraglide tanstack-app/src/components/admin/AdminDirectorySearch.tsx tanstack-app/src/components/admin/AdminDirectorySearch.test.tsx tanstack-app/src/components/admin/AdminShell.tsx tanstack-app/src/components/admin/AdminShell.test.tsx
git commit -m "feat: add admin Typesense command-palette search"
```

---

### Task 7: Rebuild index (org-units + orchestration)

**Files:**
- Modify: `tanstack-app/src/repositories/templeRepo.ts` — add `listAllForExport` (paginate `list` with no filters until done); export on `templeRepo` / `TempleStore`
- Test: extend `tanstack-app/src/repositories/adminList.memory.test.ts` or temple memory test if present
- Create: `tanstack-app/src/search/reindexDirectory.ts`
- Test: `tanstack-app/src/search/reindexDirectory.test.ts`
- Modify: `tanstack-app/messages/vi.json` — rebuild copy
- Modify: `tanstack-app/src/components/admin/OrgUnitsPage.tsx`
- Modify: `tanstack-app/src/components/admin/OrgUnitsPage.test.tsx`

**i18n:**
- `admin_search_reindex`: `Tạo lại chỉ mục tìm kiếm`
- `admin_search_reindex_confirm`: `Tạo lại toàn bộ chỉ mục thành viên và tịnh xá từ dữ liệu hiện tại?`
- `admin_search_reindex_success`: `Đã lập chỉ mục {members} thành viên và {temples} tịnh xá`
- `admin_search_reindex_error`: `Không tạo lại chỉ mục được`

**Interfaces:**
- `reindexDirectorySearch(input: { idToken: string; listMembers; listTemples }): Promise<{ members: number; temples: number }>`
  1. `reindexEnsure({ idToken })`
  2. Load all tang + ni via `memberRepo.listAllForExport({ sanghaType })` (no orgUnitId)
  3. Load all temples via new `templeRepo.listAllForExport({})`
  4. Map docs; import in batches of ~40 via `reindexImport`
  5. Return counts

- [ ] **Step 1: Add `templeRepo.listAllForExport` + test**

Same loop pattern as members `listAllForExport`.

- [ ] **Step 2: Write `reindexDirectory` tests with mocked repos + API**

- [ ] **Step 3: Implement orchestration**

- [ ] **Step 4: OrgUnitsPage UI**

When `canGrantDirectoryRole` (same as `he_phai_admin` gate used on that page for secretary management), show rebuild button. Confirm Modal → mutation calling `reindexDirectorySearch` with `user.getIdToken()` → notifications/toast via existing patterns (Text alert or `window.alert` only if no notification system — prefer Mantine inline success/error Text like other admin pages).

Check how OrgUnitsPage shows errors today and match.

- [ ] **Step 5: Tests — button hidden for giao_doan; visible for he_phai_admin; confirm calls reindex**

- [ ] **Step 6: Run tests — PASS**

Run: `cd tanstack-app && pnpm exec vitest run src/search/reindexDirectory.test.ts src/components/admin/OrgUnitsPage.test.tsx src/repositories/adminList.memory.test.ts`

- [ ] **Step 7: Commit**

```bash
git add tanstack-app/src/repositories/templeRepo.ts tanstack-app/src/search/reindexDirectory.ts tanstack-app/src/search/reindexDirectory.test.ts tanstack-app/src/components/admin/OrgUnitsPage.tsx tanstack-app/src/components/admin/OrgUnitsPage.test.tsx tanstack-app/messages/vi.json tanstack-app/src/paraglide
git commit -m "feat: add Typesense reindex from org-units admin page"
```

---

### Task 8: Secrets checklist + smoke verification

**Files:** none required (ops note in commit message / optional README line only if repo already documents worker secrets — prefer not adding markdown unless an existing secrets doc exists)

- [ ] **Step 1: Document for the implementer (no new md file)**

Set Cloudflare Worker secrets / `.dev.vars` for local:

```
TYPESENSE_API_KEY=...
TYPESENSE_HOST=https://typesense.giasuai.io
```

(`TYPESENSE_HOST` optional if default baked in client.)

- [ ] **Step 2: Manual smoke (local or preview)**

1. Deploy/dev with secrets.
2. As `he_phai_admin`, open `/admin/org-units` → rebuild → success counts.
3. ⌘K → search a known pháp danh → open detail.
4. As `giao_doan_admin`, confirm other-unit records do not appear.
5. Save a filler draft → rebuild not required; search finds it after upsert (or note eventual consistency).

- [ ] **Step 3: Run full unit suite for touched areas**

Run: `cd tanstack-app && pnpm exec vitest run src/domain/searchDocs.test.ts src/worker/typesenseClient.test.ts src/worker/searchApi.test.ts src/search src/components/admin/AdminDirectorySearch.test.tsx src/components/admin/OrgUnitsPage.test.tsx`

Expected: PASS

- [ ] **Step 4: Commit** only if Step 1 produced a tracked file (e.g. example `.dev.vars.example` **only if** the repo already has that pattern). Otherwise skip commit.

```bash
# optional, only if matching existing secret-example convention
git status
```

---

## Spec coverage self-check

| Spec item | Task |
| --- | --- |
| Command palette ⌘K | Task 6 |
| Members + temples | Tasks 1, 3, 6 |
| Scoped like lists | Tasks 2–3, 6 |
| Names + CCCD + phones | Task 1 |
| Host typesense.giasuai.io | Tasks 2, 8 |
| Write-path + rebuild | Tasks 5, 7 |
| Draft + locked | Task 1 (status field; no filter excluding drafts) |
| Exact-ish matching | Task 2 (no accent fold) |
| Worker proxy | Task 3 |
| Two collections | Tasks 1–2 (`khatsi_*` prefix) |
| Rebuild on org-units, he_phai_admin | Task 7 |
| Filler invite upsert | Tasks 3–5 |
| Vitest, no Cypress | all tasks |

**Placeholder scan:** none intentional.  
**Type consistency:** `MemberSearchDoc` / `TempleSearchDoc` and collection union `'members' | 'temples'` (API) → mapped to `khatsi_*` inside worker only.
