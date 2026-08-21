# Admin Temple & Member Table Sorting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-side sortable columns on temple and member admin tables (correct across load-more), backed by denormalized Firestore sort keys.

**Architecture:** Compute lean list-sort fields on every temple/member write and via a one-shot backfill. Extend admin list queries with `sortBy`/`sortDir` + composite indexes. Shared `AdminSortableTh` + `nextAdminTableSort` drive header click cycles; list pages pass sort into existing TanStack Query options.

**Tech Stack:** TypeScript, Firestore `orderBy`/`where`, Mantine `Table`, TanStack Query, Paraglide, Vitest + Testing Library

**Spec:** `docs/superpowers/specs/2026-08-21-admin-table-sorting-design.md`

## Global Constraints

- Before implementing: checkout `main`, pull if needed, create branch `feat/admin-table-sorting` (workspace rule — **no** git worktrees)
- Server-side sort only; do **not** client-sort loaded rows as the source of truth
- Temples sortable: `listCityName`, `orgUnitName`, `updatedAt`
- Members sortable: `giaoPhamHePhaiRankOrder`, `orgUnitName`, `status`, `updatedAt`
- Giáo đoàn: A→Z by display name; phẩm vị: Tang/Ni hierarchy; default: `updatedAt` desc
- Prefer Vitest; no new Cypress
- No Typesense list sorting; no URL-persisted sort; no Excel sort picker
- Org-unit rename fan-out out of scope (re-run backfill if seed names change)

## File Structure

| File | Responsibility |
| --- | --- |
| `tanstack-app/src/domain/types.ts` | Optional list-sort fields on `Temple` / `Member` |
| `tanstack-app/src/domain/giaoPhamHePhaiRankOrder.ts` | Hierarchy index + missing-rank sentinel |
| `tanstack-app/src/domain/giaoPhamHePhaiRankOrder.test.ts` | Rank order unit tests |
| `tanstack-app/src/domain/listSortKeys.ts` | Build temple/member sort keys |
| `tanstack-app/src/domain/listSortKeys.test.ts` | City / org / rank key builders |
| `tanstack-app/src/domain/adminTableSort.ts` | Click-cycle pure helper |
| `tanstack-app/src/domain/adminTableSort.test.ts` | Cycle unit tests |
| `tanstack-app/src/repositories/adminListTypes.ts` | `sortBy` / `sortDir` on list inputs |
| `tanstack-app/src/repositories/templeRepo.ts` | Persist keys; `orderBy` from input |
| `tanstack-app/src/repositories/memberRepo.ts` | Persist keys; `orderBy` from input |
| `tanstack-app/src/test/memoryStores.ts` | Sorted `listInMemory` + write keys |
| `tanstack-app/src/repositories/adminList.memory.test.ts` | Sort + cursor memory tests |
| `firebase/firestore.indexes.json` | Composite indexes for filter×sort |
| `tanstack-app/src/components/admin/AdminSortableTh.tsx` | Sortable header cell |
| `tanstack-app/src/components/admin/AdminSortableTh.test.tsx` | Header a11y / click |
| `tanstack-app/src/components/admin/TemplesListPage.tsx` | Wire sort state + headers |
| `tanstack-app/src/components/admin/MembersListPage.tsx` | Wire sort state + headers |
| `tanstack-app/src/components/admin/TemplesListPage.test.tsx` | Sort resets load-more |
| `tanstack-app/src/components/admin/MembersListPage.test.tsx` | Sort resets load-more |
| `tanstack-app/messages/vi.json` | Sort aria labels |
| `tanstack-app/scripts/backfill-list-sort-keys.ts` | One-shot backfill |
| `tanstack-app/package.json` | `backfill:list-sort-keys` script |

---

### Task 0: Create feature branch

**Files:** none (git only)

**Interfaces:**
- Consumes: none
- Produces: branch `feat/admin-table-sorting`

- [ ] **Step 1: Confirm on `main` and create branch**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git checkout main
git pull
git checkout -b feat/admin-table-sorting
```

Expected: on `feat/admin-table-sorting`, clean working tree (or only unrelated WIP the user already accepted).

- [ ] **Step 2: Commit is N/A** (branch only)

---

### Task 1: Rank order helper + list sort key builders + domain types

**Files:**
- Create: `tanstack-app/src/domain/giaoPhamHePhaiRankOrder.ts`
- Create: `tanstack-app/src/domain/giaoPhamHePhaiRankOrder.test.ts`
- Create: `tanstack-app/src/domain/listSortKeys.ts`
- Create: `tanstack-app/src/domain/listSortKeys.test.ts`
- Modify: `tanstack-app/src/domain/types.ts` (`Member` after `giaoPhamHePhai` / near timestamps; `Temple` near `orgUnitId` or timestamps)

**Interfaces:**
- Produces:
```ts
// giaoPhamHePhaiRankOrder.ts
import type { SanghaType } from './types'

/** Missing rank sorts last when ascending. */
export const MISSING_GIAO_PHAM_HE_PHAI_RANK_ORDER = 999

export function giaoPhamHePhaiRankOrder(
  rank: string | undefined,
  sanghaType: SanghaType,
): number
```
```ts
// listSortKeys.ts
import type { AddressValue } from './address'
import type { SanghaType } from './types'

export function listCityNameFromDiaChiMoi(
  diaChiMoi: AddressValue | string | undefined,
): string

export function buildTempleListSortKeys(input: {
  diaChiMoi?: AddressValue | string
  orgUnitName: string
}): { listCityName: string; orgUnitName: string }

export function buildMemberListSortKeys(input: {
  sanghaType: SanghaType
  orgUnitName: string
  giaoPhamHePhaiRank?: string
}): {
  orgUnitName: string
  giaoPhamHePhaiRankOrder: number
}
```
- Produces on types:
```ts
// Member
orgUnitName?: string
giaoPhamHePhaiRankOrder?: number

// Temple
listCityName?: string
orgUnitName?: string
```

- [ ] **Step 1: Write the failing rank-order tests**

```ts
// tanstack-app/src/domain/giaoPhamHePhaiRankOrder.test.ts
import { describe, expect, it } from 'vitest'
import {
  MISSING_GIAO_PHAM_HE_PHAI_RANK_ORDER,
  giaoPhamHePhaiRankOrder,
} from './giaoPhamHePhaiRankOrder'

describe('giaoPhamHePhaiRankOrder', () => {
  it('orders tang ranks by hierarchy', () => {
    expect(giaoPhamHePhaiRankOrder('hoa_thuong', 'tang')).toBe(0)
    expect(giaoPhamHePhaiRankOrder('thuong_toa', 'tang')).toBe(1)
    expect(giaoPhamHePhaiRankOrder('dai_duc', 'tang')).toBe(2)
    expect(giaoPhamHePhaiRankOrder('ty_kheo', 'tang')).toBe(3)
    expect(giaoPhamHePhaiRankOrder('sa_di', 'tang')).toBe(4)
    expect(giaoPhamHePhaiRankOrder('tap_su', 'tang')).toBe(5)
  })

  it('orders ni ranks by hierarchy', () => {
    expect(giaoPhamHePhaiRankOrder('ni_truong', 'ni')).toBe(0)
    expect(giaoPhamHePhaiRankOrder('ni_su', 'ni')).toBe(1)
    expect(giaoPhamHePhaiRankOrder('ty_kheo_ni', 'ni')).toBe(2)
    expect(giaoPhamHePhaiRankOrder('thuc_xoa_ma_na', 'ni')).toBe(3)
    expect(giaoPhamHePhaiRankOrder('sa_di_ni', 'ni')).toBe(4)
    expect(giaoPhamHePhaiRankOrder('tap_su', 'ni')).toBe(5)
  })

  it('uses sentinel for missing or unknown rank', () => {
    expect(giaoPhamHePhaiRankOrder(undefined, 'tang')).toBe(
      MISSING_GIAO_PHAM_HE_PHAI_RANK_ORDER,
    )
    expect(giaoPhamHePhaiRankOrder('not_a_rank', 'tang')).toBe(
      MISSING_GIAO_PHAM_HE_PHAI_RANK_ORDER,
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tanstack-app && pnpm exec vitest run src/domain/giaoPhamHePhaiRankOrder.test.ts`

Expected: FAIL (module not found)

- [ ] **Step 3: Implement rank-order helper**

Keep domain free of UI: local ordered value arrays mirroring `TANG_RANKS` / `NI_RANKS` (do **not** import `fillerFormOptions`).

```ts
// tanstack-app/src/domain/giaoPhamHePhaiRankOrder.ts
import type { SanghaType } from './types'

export const MISSING_GIAO_PHAM_HE_PHAI_RANK_ORDER = 999

const TANG_RANK_ORDER = [
  'hoa_thuong',
  'thuong_toa',
  'dai_duc',
  'ty_kheo',
  'sa_di',
  'tap_su',
] as const

const NI_RANK_ORDER = [
  'ni_truong',
  'ni_su',
  'ty_kheo_ni',
  'thuc_xoa_ma_na',
  'sa_di_ni',
  'tap_su',
] as const

export function giaoPhamHePhaiRankOrder(
  rank: string | undefined,
  sanghaType: SanghaType,
): number {
  if (!rank) return MISSING_GIAO_PHAM_HE_PHAI_RANK_ORDER
  const order = sanghaType === 'tang' ? TANG_RANK_ORDER : NI_RANK_ORDER
  const index = order.indexOf(rank as (typeof order)[number])
  return index >= 0 ? index : MISSING_GIAO_PHAM_HE_PHAI_RANK_ORDER
}
```

- [ ] **Step 4: Re-run rank tests — expect PASS**

Run: `cd tanstack-app && pnpm exec vitest run src/domain/giaoPhamHePhaiRankOrder.test.ts`

- [ ] **Step 5: Write failing listSortKeys tests**

```ts
// tanstack-app/src/domain/listSortKeys.test.ts
import { describe, expect, it } from 'vitest'
import { MISSING_GIAO_PHAM_HE_PHAI_RANK_ORDER } from './giaoPhamHePhaiRankOrder'
import {
  buildMemberListSortKeys,
  buildTempleListSortKeys,
  listCityNameFromDiaChiMoi,
} from './listSortKeys'

describe('listCityNameFromDiaChiMoi', () => {
  it('reads cityName from structured address', () => {
    expect(
      listCityNameFromDiaChiMoi({
        cityCode: '01',
        cityName: 'Hà Nội',
        wardCode: '00001',
        wardName: 'Phường A',
      }),
    ).toBe('Hà Nội')
  })

  it('returns empty string for legacy string or missing', () => {
    expect(listCityNameFromDiaChiMoi('123 đường')).toBe('')
    expect(listCityNameFromDiaChiMoi(undefined)).toBe('')
  })
})

describe('buildTempleListSortKeys', () => {
  it('includes orgUnitName and city', () => {
    expect(
      buildTempleListSortKeys({
        orgUnitName: 'Giáo đoàn I',
        diaChiMoi: {
          cityCode: '01',
          cityName: 'Đà Nẵng',
          wardCode: 'x',
          wardName: 'y',
        },
      }),
    ).toEqual({ listCityName: 'Đà Nẵng', orgUnitName: 'Giáo đoàn I' })
  })
})

describe('buildMemberListSortKeys', () => {
  it('maps rank to hierarchy order', () => {
    expect(
      buildMemberListSortKeys({
        sanghaType: 'tang',
        orgUnitName: 'Giáo đoàn II',
        giaoPhamHePhaiRank: 'dai_duc',
      }),
    ).toEqual({
      orgUnitName: 'Giáo đoàn II',
      giaoPhamHePhaiRankOrder: 2,
    })
  })

  it('uses sentinel when rank missing', () => {
    expect(
      buildMemberListSortKeys({
        sanghaType: 'ni',
        orgUnitName: 'Ni giới Giáo đoàn I',
      }).giaoPhamHePhaiRankOrder,
    ).toBe(MISSING_GIAO_PHAM_HE_PHAI_RANK_ORDER)
  })
})
```

- [ ] **Step 6: Run listSortKeys tests — expect FAIL**

Run: `cd tanstack-app && pnpm exec vitest run src/domain/listSortKeys.test.ts`

- [ ] **Step 7: Implement listSortKeys + add optional fields on types**

Use `isStructuredAddress` from `#/domain/address`.

On `Member`, add optional `orgUnitName?: string` and `giaoPhamHePhaiRankOrder?: number` after `giaoPhamHePhai`.

On `Temple`, add optional `listCityName?: string` and `orgUnitName?: string` near address / `orgUnitId` fields.

- [ ] **Step 8: Run both domain test files — expect PASS**

Run: `cd tanstack-app && pnpm exec vitest run src/domain/giaoPhamHePhaiRankOrder.test.ts src/domain/listSortKeys.test.ts`

- [ ] **Step 9: Commit**

```bash
git add tanstack-app/src/domain/giaoPhamHePhaiRankOrder.ts \
  tanstack-app/src/domain/giaoPhamHePhaiRankOrder.test.ts \
  tanstack-app/src/domain/listSortKeys.ts \
  tanstack-app/src/domain/listSortKeys.test.ts \
  tanstack-app/src/domain/types.ts
git commit -m "$(cat <<'EOF'
Add list-sort key helpers for temple and member admin tables.

EOF
)"
```

---

### Task 2: List input types + memory/Firestore `orderBy` sort

**Files:**
- Modify: `tanstack-app/src/repositories/adminListTypes.ts`
- Modify: `tanstack-app/src/test/memoryStores.ts` (`listInMemory` + member/temple `list`)
- Modify: `tanstack-app/src/repositories/templeRepo.ts` (`list`)
- Modify: `tanstack-app/src/repositories/memberRepo.ts` (`list`)
- Modify: `tanstack-app/src/repositories/adminList.memory.test.ts`

**Interfaces:**
- Produces:
```ts
export type AdminSortDir = 'asc' | 'desc'

export type TempleAdminSortBy = 'listCityName' | 'orgUnitName' | 'updatedAt'
export type MemberAdminSortBy =
  | 'giaoPhamHePhaiRankOrder'
  | 'orgUnitName'
  | 'status'
  | 'updatedAt'

// on ListTemplesAdminInput:
sortBy?: TempleAdminSortBy
sortDir?: AdminSortDir

// on ListMembersAdminInput:
sortBy?: MemberAdminSortBy
sortDir?: AdminSortDir
```
- Default when omitted: `sortBy: 'updatedAt'`, `sortDir: 'desc'` (preserve today’s behavior)

- [ ] **Step 1: Write failing memory list sort tests**

Append to `adminList.memory.test.ts` (extend local `temple()` / `member()` helpers to accept the new optional fields):

```ts
it('lists temples by listCityName asc with cursor', async () => {
  const store = createMemoryTempleStore([
    temple({
      id: 't1',
      listCityName: 'Hà Nội',
      updatedAt: '2026-07-19T03:00:00.000Z',
    }),
    temple({
      id: 't2',
      listCityName: 'Đà Nẵng',
      updatedAt: '2026-07-19T02:00:00.000Z',
    }),
    temple({
      id: 't3',
      listCityName: 'Cần Thơ',
      updatedAt: '2026-07-19T01:00:00.000Z',
    }),
  ])
  const page1 = await store.list({
    sortBy: 'listCityName',
    sortDir: 'asc',
    limit: 2,
  })
  expect(page1.items.map((t) => t.id)).toEqual(['t3', 't2'])
  const page2 = await store.list({
    sortBy: 'listCityName',
    sortDir: 'asc',
    limit: 2,
    cursor: page1.nextCursor!,
  })
  expect(page2.items.map((t) => t.id)).toEqual(['t1'])
})

it('lists members by giaoPhamHePhaiRankOrder asc', async () => {
  const store = createMemoryMemberStore([
    member({
      id: 'm1',
      sanghaType: 'tang',
      giaoPhamHePhaiRankOrder: 5,
      updatedAt: '2026-07-19T03:00:00.000Z',
    }),
    member({
      id: 'm2',
      sanghaType: 'tang',
      giaoPhamHePhaiRankOrder: 0,
      updatedAt: '2026-07-19T02:00:00.000Z',
    }),
  ])
  const page = await store.list({
    sanghaType: 'tang',
    sortBy: 'giaoPhamHePhaiRankOrder',
    sortDir: 'asc',
    limit: 25,
  })
  expect(page.items.map((m) => m.id)).toEqual(['m2', 'm1'])
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd tanstack-app && pnpm exec vitest run src/repositories/adminList.memory.test.ts`

- [ ] **Step 3: Extend `adminListTypes` + `listInMemory`**

Replace `listInMemory` sort with:

```ts
function listInMemory<T extends { id: string }>(
  all: Iterable<T>,
  input: { limit?: number; cursor?: string },
  options: {
    filter: (item: T) => boolean
    /** Comparable value; numbers and strings supported. */
    sortValue: (item: T) => string | number
    sortDir: 'asc' | 'desc'
  },
): AdminListPage<T> {
  const limit = input.limit ?? 25
  let items = [...all].filter(options.filter)
  const dir = options.sortDir === 'asc' ? 1 : -1
  items.sort((a, b) => {
    const av = options.sortValue(a)
    const bv = options.sortValue(b)
    if (typeof av === 'number' && typeof bv === 'number') {
      return (av - bv) * dir
    }
    return String(av).localeCompare(String(bv)) * dir
  })
  // ... existing cursor slice logic unchanged
}
```

Wire temple/member `list` to resolve:

```ts
const sortBy = input.sortBy ?? 'updatedAt'
const sortDir = input.sortDir ?? 'desc'
```

and map `sortValue` from the chosen field (`?? ''` for missing strings, `?? MISSING_GIAO_PHAM_HE_PHAI_RANK_ORDER` for missing rank order).

- [ ] **Step 4: Update Firestore `templeRepo.list` / `memberRepo.list`**

```ts
const sortBy = input.sortBy ?? 'updatedAt'
const sortDir = input.sortDir ?? 'desc'
constraints.push(orderBy(sortBy, sortDir))
```

Keep existing `where` clauses before `orderBy`.

- [ ] **Step 5: Re-run memory tests — expect PASS**

Run: `cd tanstack-app && pnpm exec vitest run src/repositories/adminList.memory.test.ts`

- [ ] **Step 6: Commit**

```bash
git add tanstack-app/src/repositories/adminListTypes.ts \
  tanstack-app/src/test/memoryStores.ts \
  tanstack-app/src/repositories/templeRepo.ts \
  tanstack-app/src/repositories/memberRepo.ts \
  tanstack-app/src/repositories/adminList.memory.test.ts
git commit -m "$(cat <<'EOF'
Support sortBy/sortDir on temple and member admin list queries.

EOF
)"
```

---

### Task 3: Persist sort keys on create/update

**Files:**
- Modify: `tanstack-app/src/repositories/templeRepo.ts` (`TempleProfilePatch` Omit + `createOrUpdateTemple`)
- Modify: `tanstack-app/src/repositories/memberRepo.ts` (`MemberProfilePatch` Omit + `createOrUpdateMember`)
- Modify: `tanstack-app/src/test/memoryStores.ts` (create/update paths)
- Modify: `tanstack-app/src/use-cases/saveTempleDraft.ts` / `saveMemberDraft.ts` (add sort keys to `protectedPatchKeys` if those lists exist; otherwise rely on ProfilePatch Omit)
- Create: `tanstack-app/src/repositories/listSortKeysWrite.memory.test.ts`

**Interfaces:**
- Consumes: `buildTempleListSortKeys`, `buildMemberListSortKeys`, `getOrgUnitById` / `ORG_UNIT_SEED` fallback
- Produces: every create/update writes `listCityName`/`orgUnitName` (temple) or `orgUnitName`/`giaoPhamHePhaiRankOrder` (member)
- `TempleProfilePatch` / `MemberProfilePatch` must **Omit** the list-sort fields so clients cannot set them

- [ ] **Step 1: Write failing memory write test**

```ts
// tanstack-app/src/repositories/listSortKeysWrite.memory.test.ts
import { describe, expect, it } from 'vitest'
import { createMemoryTempleStore, createMemoryMemberStore } from '#/test/memoryStores'

describe('list sort keys on write', () => {
  it('temple draft write stores listCityName and orgUnitName', async () => {
    const store = createMemoryTempleStore([])
    const { temple } = await store.createOrUpdateDraft({
      orgUnitId: 'gd-i',
      inviteId: null,
      managerPhones: ['0901234567'],
      patch: {
        diaChiMoi: {
          cityCode: '01',
          cityName: 'Huế',
          wardCode: 'w',
          wardName: 'P',
        },
        danhHieu: 'TX Test',
      },
    })
    expect(temple.listCityName).toBe('Huế')
    expect(temple.orgUnitName).toBe('Giáo đoàn I')
  })

  it('member draft write stores rank order and orgUnitName', async () => {
    const store = createMemoryMemberStore([])
    const { member } = await store.createOrUpdateDraft({
      orgUnitId: 'gd-ii',
      sanghaType: 'tang',
      inviteId: null,
      cccd: '001234567890',
      patch: { giaoPhamHePhai: { rank: 'sa_di' }, phapDanh: 'A' },
    })
    expect(member.orgUnitName).toBe('Giáo đoàn II')
    expect(member.giaoPhamHePhaiRankOrder).toBe(4)
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (keys undefined)

Run: `cd tanstack-app && pnpm exec vitest run src/repositories/listSortKeysWrite.memory.test.ts`

- [ ] **Step 3: Implement write-path enrichment**

Firestore repos:

```ts
async function resolveOrgUnitName(orgUnitId: string): Promise<string> {
  const unit = await getOrgUnitById(orgUnitId)
  if (unit) return unit.name
  const seeded = ORG_UNIT_SEED.find((u) => u.id === orgUnitId)
  return seeded?.name ?? orgUnitId
}
```

Memory stores: resolve from `ORG_UNIT_SEED` only.

When building the temple/member object in create/update, after merging patch, assign:

```ts
const sortKeys = buildTempleListSortKeys({
  diaChiMoi: temple.diaChiMoi,
  orgUnitName: await resolveOrgUnitName(temple.orgUnitId),
})
Object.assign(temple, sortKeys)
```

Same for member with `giaoPhamHePhai?.rank`.

Omit sort fields from `TempleProfilePatch` / `MemberProfilePatch`.

- [ ] **Step 4: Re-run write tests — expect PASS**

Run: `cd tanstack-app && pnpm exec vitest run src/repositories/listSortKeysWrite.memory.test.ts src/use-cases/templeDraft.test.ts src/use-cases/memberDraft.test.ts`

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/repositories/templeRepo.ts \
  tanstack-app/src/repositories/memberRepo.ts \
  tanstack-app/src/test/memoryStores.ts \
  tanstack-app/src/repositories/listSortKeysWrite.memory.test.ts \
  tanstack-app/src/use-cases/saveTempleDraft.ts \
  tanstack-app/src/use-cases/saveMemberDraft.ts
git commit -m "$(cat <<'EOF'
Persist denormalized list-sort keys on temple and member writes.

EOF
)"
```

---

### Task 4: Firestore composite indexes

**Files:**
- Modify: `firebase/firestore.indexes.json`

**Interfaces:**
- Consumes: filter × sort combinations from the spec
- Produces: indexes covering both `asc` and `desc` for each new sort field (skip duplicates of existing `updatedAt` desc entries)

- [ ] **Step 1: Add temple indexes**

For each `sortField` in `listCityName`, `orgUnitName`, `updatedAt` and each `order` in `ASCENDING`, `DESCENDING`, ensure these composites exist (skip if already present for `updatedAt` DESC):

1. `[sortField]`
2. `[orgUnitId ASC, sortField]`
3. `[status ASC, sortField]`
4. `[orgUnitId ASC, status ASC, sortField]`

Example entry:

```json
{
  "collectionGroup": "temples",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "orgUnitId", "order": "ASCENDING" },
    { "fieldPath": "listCityName", "order": "ASCENDING" }
  ]
}
```

- [ ] **Step 2: Add member indexes**

For each `sortField` in `giaoPhamHePhaiRankOrder`, `orgUnitName`, `status`, `updatedAt` and each direction:

1. `[sanghaType ASC, sortField]`
2. `[orgUnitId ASC, sanghaType ASC, sortField]`
3. `[sanghaType ASC, status ASC, sortField]` — still add when sorting by `status` without a status equality filter
4. `[orgUnitId ASC, sanghaType ASC, status ASC, sortField]`

Skip exact duplicates of existing `updatedAt` DESC indexes already in the file.

- [ ] **Step 3: Validate JSON**

Run: `python3 -m json.tool firebase/firestore.indexes.json > /dev/null`

Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add firebase/firestore.indexes.json
git commit -m "$(cat <<'EOF'
Add Firestore composite indexes for admin table sorting.

EOF
)"
```

Note for implementer: deploy indexes (`firebase deploy --only firestore:indexes`) before exercising non-default sorts against production/staging.

---

### Task 5: `nextAdminTableSort` + `AdminSortableTh` + i18n

**Files:**
- Create: `tanstack-app/src/domain/adminTableSort.ts`
- Create: `tanstack-app/src/domain/adminTableSort.test.ts`
- Create: `tanstack-app/src/components/admin/AdminSortableTh.tsx`
- Create: `tanstack-app/src/components/admin/AdminSortableTh.test.tsx`
- Modify: `tanstack-app/messages/vi.json`
- Run: `pnpm run paraglide` (from `tanstack-app`)

**Interfaces:**
- Produces:
```ts
// adminTableSort.ts
export type AdminTableSortState<T extends string> = {
  sortBy: T
  sortDir: 'asc' | 'desc'
}

export const DEFAULT_ADMIN_TABLE_SORT = {
  sortBy: 'updatedAt',
  sortDir: 'desc',
} as const

/** Click cycle: other column → asc; same asc → desc; same desc → default. */
export function nextAdminTableSort<T extends string>(
  current: AdminTableSortState<T>,
  column: T,
  defaultSort: AdminTableSortState<T> = DEFAULT_ADMIN_TABLE_SORT as AdminTableSortState<T>,
): AdminTableSortState<T>
```
```tsx
// AdminSortableTh.tsx
export type AdminSortableThProps<T extends string> = {
  column: T
  label: string
  sortBy: T
  sortDir: 'asc' | 'desc'
  onSort: (column: T) => void
  w?: number | string
}
```

- [ ] **Step 1: Write failing cycle tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ADMIN_TABLE_SORT,
  nextAdminTableSort,
} from './adminTableSort'

describe('nextAdminTableSort', () => {
  it('from default, clicking another column goes asc', () => {
    expect(nextAdminTableSort(DEFAULT_ADMIN_TABLE_SORT, 'orgUnitName')).toEqual({
      sortBy: 'orgUnitName',
      sortDir: 'asc',
    })
  })

  it('toggles asc → desc → default on same column', () => {
    const asc = { sortBy: 'orgUnitName' as const, sortDir: 'asc' as const }
    const desc = nextAdminTableSort(asc, 'orgUnitName')
    expect(desc).toEqual({ sortBy: 'orgUnitName', sortDir: 'desc' })
    expect(nextAdminTableSort(desc, 'orgUnitName')).toEqual(DEFAULT_ADMIN_TABLE_SORT)
  })

  it('from default updatedAt desc, clicking updatedAt goes asc', () => {
    expect(nextAdminTableSort(DEFAULT_ADMIN_TABLE_SORT, 'updatedAt')).toEqual({
      sortBy: 'updatedAt',
      sortDir: 'asc',
    })
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd tanstack-app && pnpm exec vitest run src/domain/adminTableSort.test.ts`

- [ ] **Step 3: Implement `nextAdminTableSort`**

Logic:

1. If `column !== current.sortBy` → `{ sortBy: column, sortDir: 'asc' }`
2. Else if `current.sortDir === 'asc'` → `{ sortBy: column, sortDir: 'desc' }`
3. Else → `defaultSort`

Special case for default: when `current` equals default (`updatedAt`/`desc`) and user clicks `updatedAt`, treat as active on that column so step 2/3 apply (first click → asc). Implement by comparing to `defaultSort`: if current is default and column is `updatedAt`, return `{ sortBy: 'updatedAt', sortDir: 'asc' }`.

- [ ] **Step 4: Add i18n keys**

In `messages/vi.json`:

```json
"admin_table_sort_asc": "Sắp xếp tăng dần",
"admin_table_sort_desc": "Sắp xếp giảm dần",
"admin_table_sort_none": "Bỏ sắp xếp cột này"
```

Run: `cd tanstack-app && pnpm run paraglide`

- [ ] **Step 5: Write failing `AdminSortableTh` test**

```tsx
import { MantineProvider, Table } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { theme } from '../../theme'
import { AdminSortableTh } from './AdminSortableTh'

it('calls onSort and sets aria-sort when active', async () => {
  const onSort = vi.fn()
  render(
    <MantineProvider theme={theme}>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <AdminSortableTh
              column="orgUnitName"
              label="Giáo đoàn"
              sortBy="orgUnitName"
              sortDir="asc"
              onSort={onSort}
            />
          </Table.Tr>
        </Table.Thead>
      </Table>
    </MantineProvider>,
  )
  const th = screen.getByRole('columnheader', { name: /Giáo đoàn/i })
  expect(th).toHaveAttribute('aria-sort', 'ascending')
  await userEvent.click(th)
  expect(onSort).toHaveBeenCalledWith('orgUnitName')
})
```

(Reuse `ResizeObserver` / `matchMedia` stubs from `AdminDataTable.test.tsx` if needed.)

- [ ] **Step 6: Implement `AdminSortableTh`**

Use `Table.Th` as a button-like header: `style={{ cursor: 'pointer' }}`, show a small caret (unicode ▲/▼) when `sortBy === column`, set `aria-sort` to `ascending` | `descending` | `none`.

- [ ] **Step 7: Run component + cycle tests — expect PASS**

Run: `cd tanstack-app && pnpm exec vitest run src/domain/adminTableSort.test.ts src/components/admin/AdminSortableTh.test.tsx`

- [ ] **Step 8: Commit**

```bash
git add tanstack-app/src/domain/adminTableSort.ts \
  tanstack-app/src/domain/adminTableSort.test.ts \
  tanstack-app/src/components/admin/AdminSortableTh.tsx \
  tanstack-app/src/components/admin/AdminSortableTh.test.tsx \
  tanstack-app/messages/vi.json \
  tanstack-app/src/paraglide
git commit -m "$(cat <<'EOF'
Add sortable admin table header and sort-cycle helper.

EOF
)"
```

---

### Task 6: Wire `TemplesListPage`

**Files:**
- Modify: `tanstack-app/src/components/admin/TemplesListPage.tsx`
- Modify: `tanstack-app/src/components/admin/TemplesListPage.test.tsx`

**Interfaces:**
- Consumes: `DEFAULT_ADMIN_TABLE_SORT`, `nextAdminTableSort`, `AdminSortableTh`, `templesQuery({ ..., sortBy, sortDir })`
- Produces: sortable headers for Tỉnh/TP (`listCityName`), Giáo đoàn (`orgUnitName`), Cập nhật (`updatedAt`)

- [ ] **Step 1: Extend page test — sort resets accumulated rows**

In `TemplesListPage.test.tsx`, assert that when the user clicks the Giáo đoàn header, `templesQuery` is called with `sortBy: 'orgUnitName'` and `sortDir: 'asc'`. Update the mock so `queryKey` includes the filters object (including sort fields).

- [ ] **Step 2: Run — expect FAIL**

Run: `cd tanstack-app && pnpm exec vitest run src/components/admin/TemplesListPage.test.tsx`

- [ ] **Step 3: Implement page wiring**

```ts
const [sortBy, setSortBy] = useState<TempleAdminSortBy>(
  DEFAULT_ADMIN_TABLE_SORT.sortBy,
)
const [sortDir, setSortDir] = useState<AdminSortDir>(
  DEFAULT_ADMIN_TABLE_SORT.sortDir,
)

const serverFilterKey = `${scopedOrgUnitId ?? ''}:${serverStatusFilter ?? ''}:${sortBy}:${sortDir}`

// templesQuery({ orgUnitId, status, cursor, sortBy, sortDir })

function handleSort(column: TempleAdminSortBy) {
  const next = nextAdminTableSort({ sortBy, sortDir }, column)
  setSortBy(next.sortBy)
  setSortDir(next.sortDir)
}
```

Replace sortable `Table.Th` cells with `AdminSortableTh`. Leave checkbox, danh hiệu, phone, status, actions as plain `Table.Th`.

- [ ] **Step 4: Re-run page tests — expect PASS**

Run: `cd tanstack-app && pnpm exec vitest run src/components/admin/TemplesListPage.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/admin/TemplesListPage.tsx \
  tanstack-app/src/components/admin/TemplesListPage.test.tsx
git commit -m "$(cat <<'EOF'
Wire server-side sorting on the temples admin list.

EOF
)"
```

---

### Task 7: Wire `MembersListPage`

**Files:**
- Modify: `tanstack-app/src/components/admin/MembersListPage.tsx`
- Modify: `tanstack-app/src/components/admin/MembersListPage.test.tsx`

**Interfaces:**
- Consumes: same helpers as Task 6
- Produces: sortable headers for Phẩm vị (`giaoPhamHePhaiRankOrder`), Giáo đoàn (`orgUnitName`), Status (`status`), Cập nhật (`updatedAt`)

- [ ] **Step 1: Extend members list test for sort query args + cursor reset**

Mirror Task 6: click Phẩm vị header → `membersQuery` called with `sortBy: 'giaoPhamHePhaiRankOrder'`, `sortDir: 'asc'`.

- [ ] **Step 2: Run — expect FAIL**

Run: `cd tanstack-app && pnpm exec vitest run src/components/admin/MembersListPage.test.tsx`

- [ ] **Step 3: Implement page wiring**

Include `sortBy`/`sortDir` in `serverFilterKey` and `membersQuery({ sanghaType, orgUnitId, status, cursor, sortBy, sortDir })`.

Sortable columns only as listed; pháp danh, thế danh, CCCD, checkbox, actions stay plain.

- [ ] **Step 4: Re-run — expect PASS**

Run: `cd tanstack-app && pnpm exec vitest run src/components/admin/MembersListPage.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/admin/MembersListPage.tsx \
  tanstack-app/src/components/admin/MembersListPage.test.tsx
git commit -m "$(cat <<'EOF'
Wire server-side sorting on the members admin lists.

EOF
)"
```

---

### Task 8: Backfill script

**Files:**
- Create: `tanstack-app/scripts/backfill-list-sort-keys.ts`
- Modify: `tanstack-app/package.json` (add script)

**Interfaces:**
- Consumes: `buildTempleListSortKeys`, `buildMemberListSortKeys`, `listOrgUnits`, Firebase client auth like `seed-org-units.ts`
- Produces: updates every temple/member doc’s sort keys (batched writes)

- [ ] **Step 1: Implement script**

Follow `scripts/seed-org-units.ts` auth pattern (`SEED_ADMIN_*` + `VITE_FIREBASE_*`).

Algorithm:

1. Sign in as seed admin  
2. `listOrgUnits()` → `Map<id, name>`  
3. Page through all temples and members (both sangha types) via existing `listAllForExport` helpers  
4. For each doc, compute keys; if different from stored, batch `updateDoc` with **only** sort fields (do **not** touch `updatedAt`)  
5. Commit batches of ≤400 ops; log updated / skipped counts  

- [ ] **Step 2: Add package script**

```json
"backfill:list-sort-keys": "node --env-file=.env --import tsx scripts/backfill-list-sort-keys.ts"
```

- [ ] **Step 3: Fail-fast sanity without full credentials**

```bash
cd tanstack-app && pnpm run backfill:list-sort-keys
```

Expected without env: fails fast on `Missing env ...`

- [ ] **Step 4: Commit**

```bash
git add tanstack-app/scripts/backfill-list-sort-keys.ts tanstack-app/package.json
git commit -m "$(cat <<'EOF'
Add one-shot backfill script for admin list-sort keys.

EOF
)"
```

---

### Task 9: Verification

**Files:** none

- [ ] **Step 1: Run focused Vitest suite**

```bash
cd tanstack-app && pnpm exec vitest run \
  src/domain/giaoPhamHePhaiRankOrder.test.ts \
  src/domain/listSortKeys.test.ts \
  src/domain/adminTableSort.test.ts \
  src/repositories/adminList.memory.test.ts \
  src/repositories/listSortKeysWrite.memory.test.ts \
  src/components/admin/AdminSortableTh.test.tsx \
  src/components/admin/TemplesListPage.test.tsx \
  src/components/admin/MembersListPage.test.tsx
```

Expected: all PASS

- [ ] **Step 2: Manual checklist (operator)**

1. Deploy Firestore indexes  
2. Run `pnpm run backfill:list-sort-keys` against the target project  
3. In admin UI: temples — sort Tỉnh/TP, Giáo đoàn, Cập nhật; members — Phẩm vị, Giáo đoàn, Status, Cập nhật  
4. Confirm load-more keeps global order for the active sort  
5. Confirm default view still newest-first by `updatedAt`

- [ ] **Step 3: No commit required unless fixes landed**

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| Server-side sort across load-more | 2, 6, 7 |
| Temples columns: city, giáo đoàn, updatedAt | 6 |
| Members columns: rank, giáo đoàn, status, updatedAt | 7 |
| Giáo đoàn by display name | 1, 3 |
| Rank by hierarchy | 1, 3 |
| Denormalized fields + write path | 1, 3 |
| Backfill script (no admin button) | 8 |
| Composite indexes both directions | 4 |
| Header click cycle + aria-sort | 5 |
| Default updatedAt desc | 2, 5, 6, 7 |
| Vitest only | all test steps |
| Omit Typesense / URL / Excel / other tables | Global Constraints |

## Placeholder / consistency check

- Field names aligned: `listCityName`, `orgUnitName`, `giaoPhamHePhaiRankOrder`
- Sort API: `sortBy` / `sortDir` on list inputs and query keys (filters object already in `adminKeys`)
- Cycle helper name: `nextAdminTableSort` used in Tasks 5–7
