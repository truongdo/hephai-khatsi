# Admin Members Hạ-Lạp Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/admin/members/tang` and `/admin/members/ni` flat sortable tables with Mantine tabs grouped by phẩm vị hệ phái, members sorted `sapXepHaLap` ascending within each tab — matching Excel export layout.

**Architecture:** Extract shared grouping from `exportMembersExcel.ts` into `membersHaLapGroups.ts`. List page loads all members via `listAllForExport` (TanStack Query, 5m stale), groups client-side, renders `MembersHaLapTabs`. Bulk actions, filters, export unchanged in scope.

**Tech Stack:** TypeScript, React 19, Mantine Tabs/Table, TanStack Query v5, TanStack Router search params, Vitest + Testing Library, Paraglide i18n.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-23-admin-members-ha-lap-tabs-design.md`
- Workspace: create branch `feat/admin-members-ha-lap-tabs` from `main` before coding; do not use git worktrees.
- Do not change `/admin/temples` list sorting.
- Do not add Cypress specs.
- Excel export behavior must remain unchanged after refactor.
- Tests: `cd tanstack-app && pnpm exec vitest run <file>`. Run `pnpm paraglide` after editing `messages/vi.json`.
- Firebase/TanStack: use existing `memberRepo.listAllForExport`; no new Firestore indexes.
- Every task’s requirements include this section.

## File map

| File | Responsibility |
|------|----------------|
| Create `tanstack-app/src/domain/membersHaLapGroups.ts` | Shared rank grouping + tab/sheet labels |
| Create `tanstack-app/src/domain/membersHaLapGroups.test.ts` | Grouping/sort tests (moved from export tests) |
| Modify `tanstack-app/src/domain/exportMembersExcel.ts` | Import grouping; keep download API |
| Modify `tanstack-app/src/domain/exportMembersExcel.test.ts` | Import from new module; keep row/filename tests |
| Modify `tanstack-app/src/query/adminKeys.ts` | `membersAll` key factory |
| Modify `tanstack-app/src/query/adminQueries.ts` | `membersAllQuery` |
| Create `tanstack-app/src/components/admin/MembersHaLapTabs.tsx` | Tabs + per-tab table UI |
| Create `tanstack-app/src/components/admin/MembersHaLapTabs.test.tsx` | Tab/STT/selection tests |
| Modify `tanstack-app/src/components/admin/MembersListPage.tsx` | Orchestrator: fetch all, tabs, no pagination/sort |
| Modify `tanstack-app/src/components/admin/MembersListPage.test.tsx` | Update/remove sort & load-more tests |
| Modify `tanstack-app/src/routes/admin/members.tang.tsx` | Optional `validateSearch` for `tab` |
| Modify `tanstack-app/src/routes/admin/members.ni.tsx` | Same |
| Modify `tanstack-app/messages/vi.json` | Tab label with count (if needed) |

---

### Task 1: Extract `membersHaLapGroups` domain module

**Files:**
- Create: `tanstack-app/src/domain/membersHaLapGroups.ts`
- Create: `tanstack-app/src/domain/membersHaLapGroups.test.ts`
- Modify: `tanstack-app/src/domain/exportMembersExcel.test.ts` (move grouping tests out)

**Interfaces:**
- Consumes: `memberHaLapHePhaiRank`, `sortMembersByHaLapSortKey` from `#/domain/haLapSortKey`; `rankLabel` from `#/components/filler/fillerFormOptions`; `Member`, `SanghaType` from `#/domain/types`; `m` from `#/paraglide/messages`
- Produces:
  - `export const EMPTY_HA_LAP_HE_PHAI_RANK = '__empty__'`
  - `export function groupMembersByHaLapHePhaiRank(members: Member[]): Map<string, Member[]>`
  - `export function orderedMembersHaLapGroups(members: Member[], sanghaType: SanghaType): Array<{ rankKey: string; members: Member[] }>`
  - `export function excelSheetNameForHaLapHePhaiRank(rankKey: string, sanghaType: SanghaType): string`
  - `export function sanitizeExcelSheetName(name: string): string`
  - `export function haLapTabLabel(rankKey: string, sanghaType: SanghaType, count: number): string` — `"Tỳ-kheo (42)"`

- [ ] **Step 1: Write the failing test**

Create `tanstack-app/src/domain/membersHaLapGroups.test.ts` — move the `orderedMembersExcelSheetGroups`, `excel sheet naming` describe blocks from `exportMembersExcel.test.ts`, renaming to `orderedMembersHaLapGroups`:

```typescript
import { describe, expect, it } from 'vitest'
import type { Member } from '#/domain/types'
import { m } from '#/paraglide/messages'
import {
  EMPTY_HA_LAP_HE_PHAI_RANK,
  excelSheetNameForHaLapHePhaiRank,
  haLapTabLabel,
  orderedMembersHaLapGroups,
  sanitizeExcelSheetName,
} from '#/domain/membersHaLapGroups'

function member(overrides: Partial<Member> & Pick<Member, 'id' | 'sanghaType'>): Member {
  return {
    orgUnitId: 'gd-i',
    status: 'draft',
    cccd: '012345678901',
    inviteId: null,
    currentTempleId: null,
    photoPath: null,
    createdAt: '2026-07-19T00:00:00.000Z',
    updatedAt: '2026-07-19T00:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    editRequestedAt: null,
    editRequestedBy: null,
    ...overrides,
  }
}

describe('orderedMembersHaLapGroups', () => {
  it('splits tang members by normalized he-phai rank with empty last', () => {
    const groups = orderedMembersHaLapGroups(
      [
        member({ id: 'm1', sanghaType: 'tang', giaoPhamHePhai: { rank: 'sa_di' } }),
        member({ id: 'm2', sanghaType: 'tang', giaoPhamHePhai: { rank: 'hoa_thuong' } }),
        member({ id: 'm3', sanghaType: 'tang' }),
      ],
      'tang',
    )
    expect(groups.map((g) => g.rankKey)).toEqual(['ty_kheo', 'sa_di', EMPTY_HA_LAP_HE_PHAI_RANK])
  })

  it('sorts members within each group by haLap sort key ascending', () => {
    const groups = orderedMembersHaLapGroups(
      [
        member({
          id: 'm1',
          sanghaType: 'tang',
          giaoPhamHePhai: { rank: 'ty_kheo' },
          sapXepHaLap: 'ty_kheo:2012-01-01:2010-01-01:2008-01-01',
        }),
        member({
          id: 'm2',
          sanghaType: 'tang',
          giaoPhamHePhai: { rank: 'ty_kheo' },
          sapXepHaLap: 'ty_kheo:2010-01-01:2009-01-01:2008-01-01',
        }),
      ],
      'tang',
    )
    expect(groups[0]?.members.map((m) => m.id)).toEqual(['m2', 'm1'])
  })
})

describe('haLapTabLabel', () => {
  it('includes localized rank and count', () => {
    expect(haLapTabLabel('ty_kheo', 'tang', 42)).toBe(
      `${m.filler_rank_ty_kheo()} (42)`,
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tanstack-app && pnpm exec vitest run src/domain/membersHaLapGroups.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Implement `membersHaLapGroups.ts`**

Move grouping logic from `exportMembersExcel.ts` (lines 13–106). Rename `orderedMembersExcelSheetGroups` → `orderedMembersHaLapGroups`. Add:

```typescript
export function haLapTabLabel(
  rankKey: string,
  sanghaType: SanghaType,
  count: number,
): string {
  return `${excelSheetNameForHaLapHePhaiRank(rankKey, sanghaType)} (${count})`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tanstack-app && pnpm exec vitest run src/domain/membersHaLapGroups.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/domain/membersHaLapGroups.ts tanstack-app/src/domain/membersHaLapGroups.test.ts
git commit -m "refactor: extract membersHaLapGroups domain module for list and export"
```

---

### Task 2: Refactor Excel export to use shared module

**Files:**
- Modify: `tanstack-app/src/domain/exportMembersExcel.ts`
- Modify: `tanstack-app/src/domain/exportMembersExcel.test.ts`

**Interfaces:**
- Consumes: `orderedMembersHaLapGroups`, `excelSheetNameForHaLapHePhaiRank`, `sanitizeExcelSheetName`, `EMPTY_HA_LAP_HE_PHAI_RANK` from `#/domain/membersHaLapGroups`
- Produces: unchanged public export API (`membersToExcelRows`, `downloadMembersExcel`, `buildMembersExcelFilename`)

- [ ] **Step 1: Update `exportMembersExcel.ts`**

Remove inlined grouping functions. Import from `#/domain/membersHaLapGroups`. In `downloadMembersExcel`, call `orderedMembersHaLapGroups` instead of `orderedMembersExcelSheetGroups`.

Re-export for backward compatibility (optional, avoids breaking external imports):

```typescript
export { orderedMembersHaLapGroups as orderedMembersExcelSheetGroups } from '#/domain/membersHaLapGroups'
```

- [ ] **Step 2: Trim `exportMembersExcel.test.ts`**

Remove grouping describe blocks (now in `membersHaLapGroups.test.ts`). Keep `membersToExcelRows` and `buildMembersExcelFilename` tests.

- [ ] **Step 3: Run all export + grouping tests**

Run: `cd tanstack-app && pnpm exec vitest run src/domain/exportMembersExcel.test.ts src/domain/membersHaLapGroups.test.ts`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add tanstack-app/src/domain/exportMembersExcel.ts tanstack-app/src/domain/exportMembersExcel.test.ts
git commit -m "refactor: wire Excel export to shared membersHaLapGroups module"
```

---

### Task 3: Add `membersAllQuery`

**Files:**
- Modify: `tanstack-app/src/query/adminKeys.ts`
- Modify: `tanstack-app/src/query/adminQueries.ts`

**Interfaces:**
- Consumes: `ListMembersExportInput` from `#/repositories/adminListTypes`; `memberRepo.listAllForExport`
- Produces:
  - `adminKeys.membersAll(filters: ListMembersExportInput)` → `['admin', 'membersAll', filters]`
  - `membersAllQuery(filters: ListMembersExportInput)` → `queryOptions` with `staleTime: 5 * 60_000`

- [ ] **Step 1: Add key factory**

In `adminKeys.ts`:

```typescript
import type { ListMembersExportInput } from '#/repositories/adminListTypes'

// inside adminKeys object:
membersAll: (filters: ListMembersExportInput) =>
  [...adminKeys.all, 'membersAll', filters] as const,
```

- [ ] **Step 2: Add query**

In `adminQueries.ts`:

```typescript
export function membersAllQuery(filters: ListMembersExportInput) {
  return queryOptions({
    queryKey: adminKeys.membersAll(filters),
    queryFn: () => memberRepo.listAllForExport(filters),
    staleTime: 5 * 60_000,
    retry: 3,
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add tanstack-app/src/query/adminKeys.ts tanstack-app/src/query/adminQueries.ts
git commit -m "feat: add membersAllQuery for full member list fetch"
```

---

### Task 4: `MembersHaLapTabs` component

**Files:**
- Create: `tanstack-app/src/components/admin/MembersHaLapTabs.tsx`
- Create: `tanstack-app/src/components/admin/MembersHaLapTabs.test.tsx`

**Interfaces:**
- Consumes:
  - `orderedMembersHaLapGroups`, `haLapTabLabel`, `EMPTY_HA_LAP_HE_PHAI_RANK` from `#/domain/membersHaLapGroups`
  - `useAdminListSelection` from `#/components/admin/useAdminListSelection`
  - Props:

```typescript
export type MembersHaLapTabsProps = {
  sanghaType: SanghaType
  groups: Array<{ rankKey: string; members: Member[] }>
  orgUnitNameById: Map<string, string>
  activeTab: string
  onActiveTabChange: (rankKey: string) => void
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onToggleAllInTab: (ids: string[], select: boolean) => void
  onUnlock: (memberId: string) => void
  unlockingMemberId?: string
}
```

- Produces: rendered Mantine `Tabs` + `AdminDataTable` per active panel

- [ ] **Step 1: Write failing component test**

```typescript
import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { theme } from '../../theme'
import { MembersHaLapTabs } from './MembersHaLapTabs'

const groups = [
  {
    rankKey: 'ty_kheo',
    members: [
      { id: 'm2', phapDanh: 'B', theDanh: 'B', orgUnitId: 'gd-i', cccd: '2', status: 'draft' as const },
      { id: 'm1', phapDanh: 'A', theDanh: 'A', orgUnitId: 'gd-i', cccd: '1', status: 'draft' as const },
    ],
  },
  {
    rankKey: 'sa_di',
    members: [
      { id: 'm3', phapDanh: 'C', theDanh: 'C', orgUnitId: 'gd-i', cccd: '3', status: 'draft' as const },
    ],
  },
]

// ... wrap with MantineProvider, pass minimal Member fields + sanghaType='tang'

describe('MembersHaLapTabs', () => {
  it('renders tabs with count labels and STT within active tab', async () => {
    render(/* ... */)
    expect(screen.getByRole('tab', { name: /Tỳ-kheo \(2\)/ })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Sa-di \(1\)/ })).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy() // STT for first row in ty_kheo tab
    expect(screen.getByRole('link', { name: 'A' })).toBeTruthy()
  })

  it('select-all checkbox selects only active tab rows', async () => {
    const onToggleAllInTab = vi.fn()
    const user = userEvent.setup()
    // active tab ty_kheo, click header checkbox
    // expect onToggleAllInTab(['m2','m1'], true)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd tanstack-app && pnpm exec vitest run src/components/admin/MembersHaLapTabs.test.tsx`

- [ ] **Step 3: Implement component**

- Mantine `Tabs` / `Tabs.List` / `Tabs.Tab` / `Tabs.Panel`
- `value={activeTab}` / `onChange={(v) => v && onActiveTabChange(v)}`
- Tab `value={group.rankKey}`; label from `haLapTabLabel(group.rankKey, sanghaType, group.members.length)`
- Table columns: checkbox, STT (`index + 1`), pháp danh (Link), thế danh, giáo đoàn, CCCD, status badges, unlock
- Header checkbox: all ids in **active tab** selected → checked; indeterminate if partial
- `keepMounted={false}` on Tabs

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/admin/MembersHaLapTabs.tsx tanstack-app/src/components/admin/MembersHaLapTabs.test.tsx
git commit -m "feat: add MembersHaLapTabs for hạ-lạp grouped member tables"
```

---

### Task 5: Refactor `MembersListPage`

**Files:**
- Modify: `tanstack-app/src/components/admin/MembersListPage.tsx`
- Modify: `tanstack-app/src/components/admin/MembersListPage.test.tsx`
- Modify: `tanstack-app/src/routes/admin/members.tang.tsx`
- Modify: `tanstack-app/src/routes/admin/members.ni.tsx`

**Interfaces:**
- Consumes: `membersAllQuery`, `orderedMembersHaLapGroups`, `MembersHaLapTabs`, route `search.tab`
- Produces: updated list page without pagination/sort state

- [ ] **Step 1: Route search param**

`members.tang.tsx`:

```typescript
export const Route = createFileRoute('/admin/members/tang')({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === 'string' ? search.tab : undefined,
  }),
  component: MembersTangListPage,
})

function MembersTangListPage() {
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <MembersListPage
      sanghaType="tang"
      activeTab={tab}
      onActiveTabChange={(rankKey) =>
        navigate({ search: (prev) => ({ ...prev, tab: rankKey }), replace: true })
      }
    />
  )
}
```

Mirror for `members.ni.tsx`.

- [ ] **Step 2: Refactor `MembersListPage`**

Remove:
- `cursor`, `allItems`, `nextCursor`, `lastAppendedKeyRef`, `sortBy`, `sortDir`, `handleSort`
- `membersQuery` usage, load-more button, `AdminSortableTh`

Add:
- Props: `activeTab?: string`, `onActiveTabChange?: (rankKey: string) => void`
- `membersAllQuery({ sanghaType, orgUnitId: scopedOrgUnitId, status: serverStatusFilter })`
- `displayMembers` = client filter for `edit_requested`
- `groups = useMemo(() => orderedMembersHaLapGroups(displayMembers, sanghaType), [...])`
- Default tab: `groups[0]?.rankKey` when `activeTab` missing or invalid
- Extend `useAdminListSelection` usage: add `toggleAllInTab(ids, select)` helper wrapping existing selection API
- Render `<MembersHaLapTabs ... />` instead of flat table
- Keep toolbar, filters, bulk delete, export modal, mutations + invalidate `adminKeys.members` prefix

- [ ] **Step 3: Update `MembersListPage.test.tsx`**

- Mock `membersAllQuery` instead of paginated `membersQuery` (return full array, not `{ items, nextCursor }`)
- **Remove** tests: `sorts by pham vi`, `resets accumulated rows when sort changes`
- **Update** `renders columns` — no phẩm vị column; expect tab `Tỳ-kheo`; STT column
- **Update** `giao_doan_admin scopes list query` — expect `membersAll` key / `listAllForExport` filters
- Keep: bulk delete, export modal, edit-request filter, unlock, permissions tests

- [ ] **Step 4: Run tests**

Run: `cd tanstack-app && pnpm exec vitest run src/components/admin/MembersListPage.test.tsx src/components/admin/MembersHaLapTabs.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/admin/MembersListPage.tsx tanstack-app/src/components/admin/MembersListPage.test.tsx tanstack-app/src/routes/admin/members.tang.tsx tanstack-app/src/routes/admin/members.ni.tsx
git commit -m "feat: replace member admin list with hạ-lạp tabs layout"
```

---

### Task 6: Final verification

- [ ] **Step 1: Run targeted test suite**

```bash
cd tanstack-app && pnpm exec vitest run \
  src/domain/membersHaLapGroups.test.ts \
  src/domain/exportMembersExcel.test.ts \
  src/components/admin/MembersHaLapTabs.test.tsx \
  src/components/admin/MembersListPage.test.tsx
```

Expected: all PASS

- [ ] **Step 2: Manual smoke (optional)**

1. Open `/admin/members/tang` — tabs by phẩm vị, STT, no load-more
2. Select rows in two tabs — bulk count sums both
3. Export Excel — unchanged output
4. Change filter — tabs refresh
5. URL `?tab=sa_di` opens Sa-di tab

---

## Spec coverage checklist

| Spec requirement | Task |
|-----------------|------|
| Tabs per phẩm vị | 4, 5 |
| Load all + cache 5m | 3, 5 |
| Simplified columns + STT | 4 |
| Keep filters/bulk/export/unlock | 5 |
| Hide empty rank tabs | 1 (`orderedMembersHaLapGroups`) |
| Empty page when no members | 5 |
| Shared grouping with Excel | 1, 2 |
| Remove column sort / pagination | 5 |
| URL `?tab=` | 5 |
| Vitest only | all tasks |

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-23-admin-members-ha-lap-tabs.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — implement tasks in this session with checkpoints

Which approach do you prefer?
