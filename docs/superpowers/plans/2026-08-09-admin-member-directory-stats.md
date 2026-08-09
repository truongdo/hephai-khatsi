# Admin Member Directory Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/admin/members/stats` showing scoped member totals, by-giáo-đoàn counts (hệ phái only), and phẩm vị hệ phái breakdowns via on-demand Firestore `getCountFromServer`.

**Architecture:** Pure domain helpers assemble rank rows (including computed “unknown”); `memberStatsRepo` runs parallel count queries with injectable `countMembers` for unit tests; TanStack `queryOptions` + `AdminMembersStatsPage` + AdminShell nav. No denormalized counters, no completeness metrics, no Cypress.

**Tech Stack:** Firestore `getCountFromServer`, TanStack Query `queryOptions`, Mantine Table/Stack/Text, Paraglide i18n, Vitest

**Spec:** `docs/superpowers/specs/2026-08-09-admin-member-directory-stats-design.md`

## Global Constraints

- Create and work on a **new feature branch from `main`** (e.g. `feat/admin-member-directory-stats`); do **not** use git worktrees
- Audience: `he_phai_admin` / `he_phai_secretary` (global) and `giao_doan_admin` (scoped to `claim.orgUnitId`)
- Approach: on-demand `getCountFromServer` only — no summary docs / worker rollups
- No completeness / missing-photo stats in v1
- Prefer Vitest; no new Cypress
- Prefer no Firestore rules changes; do not broaden member reads
- Fail the whole stats load if any count fails (no silent zeros)
- `staleTime`: 10 minutes

## File Structure

| File | Responsibility |
| --- | --- |
| `tanstack-app/src/domain/memberDirectoryStats.ts` | DTO types + rank-row assembly / unknown math |
| `tanstack-app/src/domain/memberDirectoryStats.test.ts` | Unit tests for assembly helpers |
| `tanstack-app/src/repositories/memberStatsRepo.ts` | Parallel counts → `MemberDirectoryStats` |
| `tanstack-app/src/repositories/memberStatsRepo.test.ts` | Repo tests via injectable `countMembers` |
| `tanstack-app/src/query/adminKeys.ts` | `memberDirectoryStats` key |
| `tanstack-app/src/query/adminKeys.test.ts` | Key shape assertion |
| `tanstack-app/src/query/adminQueries.ts` | `memberDirectoryStatsQuery` |
| `firebase/firestore.indexes.json` | Composites for rank counts |
| `tanstack-app/messages/vi.json` | Vietnamese copy |
| `tanstack-app/src/components/admin/MembersStatsPage.tsx` | Page UI |
| `tanstack-app/src/components/admin/MembersStatsPage.test.tsx` | Render / scope visibility |
| `tanstack-app/src/routes/admin/members.stats.tsx` | Route `/admin/members/stats` |
| `tanstack-app/src/components/admin/AdminShell.tsx` | Nav item |
| `tanstack-app/src/components/admin/AdminShell.test.tsx` | Nav visible for directory roles |
| `tanstack-app/src/components/admin/adminBreadcrumbs.ts` | Breadcrumb for stats |

---

### Task 0: Feature branch

**Files:** none (git only)

- [ ] **Step 1: Create branch from main**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git checkout main
git pull
git checkout -b feat/admin-member-directory-stats
```

If local `main` already has the design commit and is ahead of origin, `git pull` may be a no-op — that is fine. If the working tree has unrelated dirty files, stop and ask the user before branching.

- [ ] **Step 2: Confirm branch**

```bash
git branch --show-current
```

Expected: `feat/admin-member-directory-stats`

---

### Task 1: Domain DTO + rank assembly helpers

**Files:**
- Create: `tanstack-app/src/domain/memberDirectoryStats.ts`
- Create: `tanstack-app/src/domain/memberDirectoryStats.test.ts`

**Interfaces:**
- Produces:

```ts
export type MemberRankStatRow = {
  rank: string | 'unknown'
  count: number
}

export type MemberDirectoryStats = {
  totals: { all: number; tang: number; ni: number }
  byOrgUnit: { orgUnitId: string; count: number }[]
  byRankTang: MemberRankStatRow[]
  byRankNi: MemberRankStatRow[]
}

/** knownCounts in same order as `rankValues`; appends unknown = max(0, sanghaTotal - sum). */
export function buildRankStatRows(
  rankValues: readonly string[],
  knownCounts: readonly number[],
  sanghaTotal: number,
): MemberRankStatRow[]
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { buildRankStatRows } from './memberDirectoryStats'

describe('buildRankStatRows', () => {
  it('appends unknown as total minus known sum', () => {
    expect(buildRankStatRows(['a', 'b'], [3, 5], 12)).toEqual([
      { rank: 'a', count: 3 },
      { rank: 'b', count: 5 },
      { rank: 'unknown', count: 4 },
    ])
  })

  it('clamps unknown at 0 when known sum exceeds total', () => {
    expect(buildRankStatRows(['a'], [5], 3)).toEqual([
      { rank: 'a', count: 5 },
      { rank: 'unknown', count: 0 },
    ])
  })

  it('throws when rankValues and knownCounts length mismatch', () => {
    expect(() => buildRankStatRows(['a'], [1, 2], 3)).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/domain/memberDirectoryStats.test.ts
```

Expected: FAIL — module / export missing.

- [ ] **Step 3: Minimal implementation**

```ts
export type MemberRankStatRow = {
  rank: string | 'unknown'
  count: number
}

export type MemberDirectoryStats = {
  totals: { all: number; tang: number; ni: number }
  byOrgUnit: { orgUnitId: string; count: number }[]
  byRankTang: MemberRankStatRow[]
  byRankNi: MemberRankStatRow[]
}

export function buildRankStatRows(
  rankValues: readonly string[],
  knownCounts: readonly number[],
  sanghaTotal: number,
): MemberRankStatRow[] {
  if (rankValues.length !== knownCounts.length) {
    throw new Error('rankValues and knownCounts length mismatch')
  }
  const sum = knownCounts.reduce((acc, n) => acc + n, 0)
  const rows: MemberRankStatRow[] = rankValues.map((rank, i) => ({
    rank,
    count: knownCounts[i]!,
  }))
  rows.push({ rank: 'unknown', count: Math.max(0, sanghaTotal - sum) })
  return rows
}
```

- [ ] **Step 4: Run test to verify it passes**

Same command as Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/domain/memberDirectoryStats.ts tanstack-app/src/domain/memberDirectoryStats.test.ts
git commit -m "$(cat <<'EOF'
feat: add member directory stats rank assembly helper

EOF
)"
```

---

### Task 2: `memberStatsRepo` with injectable counter

**Files:**
- Create: `tanstack-app/src/repositories/memberStatsRepo.ts`
- Create: `tanstack-app/src/repositories/memberStatsRepo.test.ts`

**Interfaces:**
- Consumes: `buildRankStatRows`, `TANG_RANKS` / `NI_RANKS` values from `#/components/filler/fillerFormOptions`, `COLLECTIONS.members`, `getClientFirestore`
- Produces:

```ts
export type MemberDirectoryStatsScope = {
  /** null = hệ phái global; string = thư ký giáo đoàn scope */
  orgUnitId: string | null
  /** org unit ids to count for byOrgUnit; empty skips that block */
  orgUnitIdsForBreakdown: string[]
}

export type CountMembersFn = (
  constraints: import('firebase/firestore').QueryConstraint[],
) => Promise<number>

export function createMemberStatsRepo(countMembers: CountMembersFn): {
  loadDashboardStats(
    scope: MemberDirectoryStatsScope,
  ): Promise<import('#/domain/memberDirectoryStats').MemberDirectoryStats>
}

export const memberStatsRepo: ReturnType<typeof createMemberStatsRepo>
```

Default `countMembers` implementation:

```ts
async function defaultCountMembers(
  constraints: QueryConstraint[],
): Promise<number> {
  const db = getClientFirestore()
  if (!db) throw new Error('Firestore is not configured')
  const snap = await getCountFromServer(
    query(collection(db, COLLECTIONS.members), ...constraints),
  )
  return snap.data().count
}
```

Constraint rules inside `loadDashboardStats`:

1. Build `scopeConstraints`: if `scope.orgUnitId` is a non-empty string, include `where('orgUnitId', '==', scope.orgUnitId)`; else none.
2. Totals: `count(scope)`; `count(scope + sanghaType==tang)`; `count(scope + sanghaType==ni)`.
3. `byOrgUnit`: for each id in `orgUnitIdsForBreakdown`, `count(where orgUnitId==id)` (ignore page scope org — breakdown is always per-id; when caller is giao_doan, pass `[]`).
4. Rank Tang: for each `TANG_RANKS[i].value`, `count(scope + sanghaType==tang + where('giaoPhamHePhai.rank','==', value))`; assemble with `buildRankStatRows`.
5. Rank Ni: same with `NI_RANKS` / `ni`.
6. Run all independent counts via `Promise.all`. If any rejects, the whole promise rejects.

- [ ] **Step 1: Write the failing test**

```ts
import { where, type QueryConstraint } from 'firebase/firestore'
import { describe, expect, it, vi } from 'vitest'
import { createMemberStatsRepo } from './memberStatsRepo'

function constraintKey(constraints: QueryConstraint[]): string {
  // Serialize for the mock map: use JSON of each constraint's type/_field/_value via a simple hand-built key
  // Prefer matching by inspecting calls in assertions below rather than fragile serialization if needed.
  return JSON.stringify(
    constraints.map((c) => {
      const anyC = c as unknown as {
        type: string
        _field?: { segments?: string[] }
        _value?: unknown
      }
      return {
        type: anyC.type,
        field: anyC._field?.segments?.join('.') ?? null,
        value: anyC._value ?? null,
      }
    }),
  )
}

describe('createMemberStatsRepo', () => {
  it('loads totals, org breakdown, and rank rows with unknown', async () => {
    const countMembers = vi.fn(async (constraints: QueryConstraint[]) => {
      const key = constraintKey(constraints)
      const table: Record<string, number> = {
        [constraintKey([])]: 10,
        [constraintKey([where('sanghaType', '==', 'tang')])]: 6,
        [constraintKey([where('sanghaType', '==', 'ni')])]: 4,
        [constraintKey([where('orgUnitId', '==', 'gd-i')])]: 7,
        [constraintKey([where('orgUnitId', '==', 'gd-ii')])]: 3,
      }
      // Rank counts: return 1 for hoa_thuong tang, 0 otherwise for known ranks — implement by checking field/value
      const parsed = JSON.parse(key) as Array<{
        field: string | null
        value: unknown
      }>
      if (
        parsed.some((p) => p.field === 'giaoPhamHePhai.rank' && p.value === 'hoa_thuong') &&
        parsed.some((p) => p.field === 'sanghaType' && p.value === 'tang')
      ) {
        return 2
      }
      if (parsed.some((p) => p.field === 'giaoPhamHePhai.rank')) return 0
      if (key in table) return table[key]!
      throw new Error(`unexpected constraints: ${key}`)
    })

    const repo = createMemberStatsRepo(countMembers)
    const stats = await repo.loadDashboardStats({
      orgUnitId: null,
      orgUnitIdsForBreakdown: ['gd-i', 'gd-ii'],
    })

    expect(stats.totals).toEqual({ all: 10, tang: 6, ni: 4 })
    expect(stats.byOrgUnit).toEqual([
      { orgUnitId: 'gd-i', count: 7 },
      { orgUnitId: 'gd-ii', count: 3 },
    ])
    expect(stats.byRankTang[0]).toEqual({ rank: 'hoa_thuong', count: 2 })
    expect(stats.byRankTang.at(-1)).toEqual({ rank: 'unknown', count: 4 }) // 6 - 2
    expect(stats.byRankNi.at(-1)?.rank).toBe('unknown')
  })

  it('scopes all counts when orgUnitId set and skips org breakdown when empty', async () => {
    const countMembers = vi.fn(async (constraints: QueryConstraint[]) => {
      const parsed = JSON.parse(
        JSON.stringify(
          constraints.map((c) => {
            const anyC = c as unknown as {
              type: string
              _field?: { segments?: string[] }
              _value?: unknown
            }
            return {
              type: anyC.type,
              field: anyC._field?.segments?.join('.') ?? null,
              value: anyC._value ?? null,
            }
          }),
        ),
      ) as Array<{ field: string | null; value: unknown }>
      expect(parsed.some((p) => p.field === 'orgUnitId' && p.value === 'gd-i')).toBe(
        true,
      )
      if (parsed.some((p) => p.field === 'giaoPhamHePhai.rank')) return 0
      if (parsed.some((p) => p.field === 'sanghaType' && p.value === 'tang'))
        return 5
      if (parsed.some((p) => p.field === 'sanghaType' && p.value === 'ni'))
        return 3
      return 8
    })

    const repo = createMemberStatsRepo(countMembers)
    const stats = await repo.loadDashboardStats({
      orgUnitId: 'gd-i',
      orgUnitIdsForBreakdown: [],
    })

    expect(stats.totals).toEqual({ all: 8, tang: 5, ni: 3 })
    expect(stats.byOrgUnit).toEqual([])
  })
})
```

**Note for implementer:** Firestore `QueryConstraint` private fields may differ by SDK version. If `constraintKey` is brittle, switch the mock to a call-order / argument matcher strategy: record each call’s constraints length + stringified `where` via a small test helper that only asserts `orgUnitId` / `sanghaType` / `giaoPhamHePhai.rank` presence using `(constraint as any)._field` / `_op` / `_value` as observed in a one-off `console.log` during the failing run. Keep the behavioral assertions (totals, byOrgUnit empty, unknown math) stable.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/repositories/memberStatsRepo.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implement `memberStatsRepo.ts`**

Implement `createMemberStatsRepo` + `export const memberStatsRepo = createMemberStatsRepo(defaultCountMembers)` per Interfaces. Import rank option arrays:

```ts
import { NI_RANKS, TANG_RANKS } from '#/components/filler/fillerFormOptions'
```

Use `.map((o) => o.value)` for rank values.

- [ ] **Step 4: Run test to verify it passes**

Same command as Step 2. Expected: PASS. Adjust mock keying if SDK private fields differ — do not weaken assertions on DTO shape.

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/repositories/memberStatsRepo.ts tanstack-app/src/repositories/memberStatsRepo.test.ts
git commit -m "$(cat <<'EOF'
feat: add memberStatsRepo for directory count aggregations

EOF
)"
```

---

### Task 3: Query keys + `memberDirectoryStatsQuery`

**Files:**
- Modify: `tanstack-app/src/query/adminKeys.ts`
- Modify: `tanstack-app/src/query/adminKeys.test.ts`
- Modify: `tanstack-app/src/query/adminQueries.ts`

**Interfaces:**
- Produces:

```ts
// adminKeys
memberDirectoryStats: (scope: {
  orgUnitId: string | null
  orgUnitIdsForBreakdown: string[]
}) => readonly ['admin', 'memberDirectoryStats', typeof scope]

// adminQueries
export function memberDirectoryStatsQuery(scope: {
  orgUnitId: string | null
  orgUnitIdsForBreakdown: string[]
}): ReturnType<typeof queryOptions>
```

```ts
export function memberDirectoryStatsQuery(scope: {
  orgUnitId: string | null
  orgUnitIdsForBreakdown: string[]
}) {
  return queryOptions({
    queryKey: adminKeys.memberDirectoryStats(scope),
    queryFn: () => memberStatsRepo.loadDashboardStats(scope),
    staleTime: 10 * 60_000,
    retry: 3,
  })
}
```

- [ ] **Step 1: Write the failing key test**

In `adminKeys.test.ts` add:

```ts
it('memberDirectoryStats nests under admin with scope', () => {
  expect(
    adminKeys.memberDirectoryStats({
      orgUnitId: 'gd-i',
      orgUnitIdsForBreakdown: [],
    }),
  ).toEqual([
    'admin',
    'memberDirectoryStats',
    { orgUnitId: 'gd-i', orgUnitIdsForBreakdown: [] },
  ])
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/query/adminKeys.test.ts
```

Expected: FAIL — `memberDirectoryStats` missing.

- [ ] **Step 3: Add key + queryOptions**

Update `adminKeys.ts` and `adminQueries.ts` (import `memberStatsRepo`).

- [ ] **Step 4: Run key test to verify it passes**

Same command as Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/query/adminKeys.ts tanstack-app/src/query/adminKeys.test.ts tanstack-app/src/query/adminQueries.ts
git commit -m "$(cat <<'EOF'
feat: add memberDirectoryStats TanStack query options

EOF
)"
```

---

### Task 4: Firestore composite indexes for rank counts

**Files:**
- Modify: `firebase/firestore.indexes.json`

**Interfaces:**
- Produces indexes used by rank queries:

1. `members`: `sanghaType` ASC + `giaoPhamHePhai.rank` ASC  
2. `members`: `orgUnitId` ASC + `sanghaType` ASC + `giaoPhamHePhai.rank` ASC  

(Single-field and existing `orgUnitId`+`sanghaType`+… indexes cover totals / by-org.)

- [ ] **Step 1: Add index entries**

Append to the `indexes` array (keep valid JSON):

```json
{
  "collectionGroup": "members",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "sanghaType", "order": "ASCENDING" },
    { "fieldPath": "giaoPhamHePhai.rank", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "members",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "orgUnitId", "order": "ASCENDING" },
    { "fieldPath": "sanghaType", "order": "ASCENDING" },
    { "fieldPath": "giaoPhamHePhai.rank", "order": "ASCENDING" }
  ]
}
```

- [ ] **Step 2: Validate JSON**

```bash
python3 -m json.tool firebase/firestore.indexes.json > /dev/null
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add firebase/firestore.indexes.json
git commit -m "$(cat <<'EOF'
chore: add Firestore indexes for member rank count queries

EOF
)"
```

Deploy indexes to the Firebase project is an ops step outside this plan (`firebase deploy --only firestore:indexes` when ready). Emulator uses the indexes file automatically when configured.

---

### Task 5: i18n strings

**Files:**
- Modify: `tanstack-app/messages/vi.json`

**Interfaces:**
- Produces keys (Vietnamese values):

| Key | Value |
| --- | --- |
| `admin_nav_member_stats` | `Thống kê thành viên` |
| `admin_member_stats_title` | `Thống kê thành viên` |
| `admin_member_stats_subtitle` | `Số lượng thành viên theo phạm vi quyền của bạn.` |
| `admin_member_stats_scope_prefix` | `Phạm vi:` |
| `admin_member_stats_total_all` | `Tất cả` |
| `admin_member_stats_total_tang` | `Tăng` |
| `admin_member_stats_total_ni` | `Ni` |
| `admin_member_stats_by_org_title` | `Theo giáo đoàn` |
| `admin_member_stats_col_org` | `Giáo đoàn` |
| `admin_member_stats_col_count` | `Số thành viên` |
| `admin_member_stats_rank_tang_title` | `Phẩm vị hệ phái — Tăng` |
| `admin_member_stats_rank_ni_title` | `Phẩm vị hệ phái — Ni` |
| `admin_member_stats_col_rank` | `Phẩm vị` |
| `admin_member_stats_rank_unknown` | `Chưa có / không rõ` |
| `admin_member_stats_load_error` | `Không tải được thống kê.` |

- [ ] **Step 1: Add keys to `vi.json`**

Insert near other `admin_nav_*` / `admin_members_*` keys. Keep JSON valid (trailing commas forbidden).

- [ ] **Step 2: Compile Paraglide**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm run paraglide
```

Expected: exit 0; `m.admin_nav_member_stats` etc. available under `src/paraglide`.

- [ ] **Step 3: Commit**

```bash
git add tanstack-app/messages/vi.json tanstack-app/src/paraglide
git commit -m "$(cat <<'EOF'
feat: add i18n for admin member directory stats

EOF
)"
```

---

### Task 6: `MembersStatsPage` UI

**Files:**
- Create: `tanstack-app/src/components/admin/MembersStatsPage.tsx`
- Create: `tanstack-app/src/components/admin/MembersStatsPage.test.tsx`

**Interfaces:**
- Consumes: `useAdminClaim`, `canManageDirectory`, `isHePhaiScope`, `orgUnitsQuery`, `memberDirectoryStatsQuery`, `rankLabel` from fillerFormOptions, Paraglide keys from Task 5
- Produces: `export function MembersStatsPage()`

Behavior:

1. If claim is not admin or `!canManageDirectory(claims)` → show a simple unauthorized/empty message (same spirit as other admin pages; reuse existing pattern if one exists, else `Text` with load error style).
2. Derive scope:
   - `orgUnitId = claim.role === 'giao_doan_admin' ? claim.orgUnitId : null` (if giao_doan and orgUnitId null, treat as error / empty stats — do not load global).
   - `orgUnitIdsForBreakdown = isHePhaiScope(claims) ? orgUnits.map(o => o.id) : []`
3. `useQuery(orgUnitsQuery())` when directory manager (needed for names + breakdown ids).
4. `useQuery({ ...memberDirectoryStatsQuery(scope), enabled: ... })` only when scope is valid and (for he_phai) org units query has settled (so breakdown ids are known). For giao_doan, enable as soon as `orgUnitId` is a string.
5. Render wireframe sections from the spec. Hide **Theo giáo đoàn** when `!isHePhaiScope(claims)`.
6. Rank labels: use `rankLabel(rank, 'tang'|'ni')` for known ranks; for `'unknown'` use `m.admin_member_stats_rank_unknown()`.
7. Loading: Mantine `Loader` or existing admin loading pattern. Error: show `m.admin_member_stats_load_error()`.

- [ ] **Step 1: Write the failing page test**

Mock `useAdminClaim`, `useQuery` paths similar to `MembersListPage.test.tsx` / `AdminShell.test.tsx`:

```ts
// Sketch — expand to match repo QueryClientProvider patterns used in MembersListPage.test.tsx
it('hides by-org table for giao_doan_admin', async () => {
  // mock claim giao_doan_admin + orgUnitId gd-i
  // mock stats query data with byOrgUnit: [] and totals
  // render MembersStatsPage
  expect(screen.queryByText(m.admin_member_stats_by_org_title())).toBeNull()
  expect(screen.getByText(m.admin_member_stats_title())).toBeTruthy()
})

it('shows by-org table for he_phai_admin', async () => {
  // mock he_phai_admin + stats.byOrgUnit with one row + orgUnits name map
  expect(screen.getByText(m.admin_member_stats_by_org_title())).toBeTruthy()
  expect(screen.getByText('Giáo đoàn I')).toBeTruthy()
})
```

Copy the concrete QueryClient / Mantine / mock setup from `MembersListPage.test.tsx` rather than inventing a new harness.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/components/admin/MembersStatsPage.test.tsx
```

Expected: FAIL — component missing.

- [ ] **Step 3: Implement `MembersStatsPage.tsx`**

Use Mantine `Stack`, `Title`, `Text`, `Group`, `Table`, `Loader`. Totals as three labeled numbers in a `Group` (not cards). Tables for org + ranks.

- [ ] **Step 4: Run test to verify it passes**

Same command as Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/admin/MembersStatsPage.tsx tanstack-app/src/components/admin/MembersStatsPage.test.tsx
git commit -m "$(cat <<'EOF'
feat: add AdminMembersStats page UI

EOF
)"
```

---

### Task 7: Route, nav, breadcrumbs

**Files:**
- Create: `tanstack-app/src/routes/admin/members.stats.tsx`
- Modify: `tanstack-app/src/components/admin/AdminShell.tsx`
- Modify: `tanstack-app/src/components/admin/AdminShell.test.tsx`
- Modify: `tanstack-app/src/components/admin/adminBreadcrumbs.ts`
- Note: route tree codegen may update `tanstack-app/src/routeTree.gen.ts` via Vite plugin on dev/build — commit generated changes if the project’s usual workflow includes them

**Interfaces:**
- Route:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { MembersStatsPage } from '#/components/admin/MembersStatsPage'

export const Route = createFileRoute('/admin/members/stats')({
  component: MembersStatsPage,
})
```

- Nav: add item after Ni (or after org-units — prefer after Ni) with `to: '/admin/members/stats'`, `capability: 'directory'`, `label: () => m.admin_nav_member_stats()`, icon `BarChart3` (or `ChartColumn`) from `lucide-react`.
- Breadcrumbs: under `section === 'members'`, if `rest[0] === 'stats'`, return `[rootCrumb(), { title: m.admin_nav_member_stats() }]`. Place **before** the generic `rest[0]` edit-member branch so `stats` is not treated as a member id.

- [ ] **Step 1: Extend AdminShell test**

```ts
it('shows member stats nav for directory managers', async () => {
  renderShell()
  const nav = await screen.findByRole('navigation')
  expect(within(nav).getByText(m.admin_nav_member_stats())).toBeTruthy()
})
```

Also assert `kiem_soat` still does not see it (add to existing hide-directory test).

- [ ] **Step 2: Run AdminShell test to verify fail/missing key handling**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/components/admin/AdminShell.test.tsx
```

Expected: FAIL until nav + i18n wired (i18n already from Task 5).

- [ ] **Step 3: Wire route, nav, breadcrumbs**

Create route file; update `AdminShell` + `adminBreadcrumbs`. Run app route generation if needed:

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vite build
```

Only if `routeTree.gen.ts` does not update via the test/dev tooling you already use — prefer the project’s lightest command that regenerates routes.

- [ ] **Step 4: Run related tests**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/components/admin/AdminShell.test.tsx src/components/admin/MembersStatsPage.test.tsx src/repositories/memberStatsRepo.test.ts src/domain/memberDirectoryStats.test.ts src/query/adminKeys.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/routes/admin/members.stats.tsx tanstack-app/src/components/admin/AdminShell.tsx tanstack-app/src/components/admin/AdminShell.test.tsx tanstack-app/src/components/admin/adminBreadcrumbs.ts tanstack-app/src/routeTree.gen.ts
git commit -m "$(cat <<'EOF'
feat: wire admin member stats route and navigation

EOF
)"
```

(Omit `routeTree.gen.ts` from `git add` if unchanged.)

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| On-demand `getCountFromServer` | Task 2 |
| Scoped giao_doan / global he_phai | Tasks 2, 6 |
| Route `/admin/members/stats` + nav | Task 7 |
| Totals Tất cả / Tăng / Ni | Tasks 2, 6 |
| By giáo đoàn (he_phai only) | Tasks 2, 6 |
| Rank Tang/Ni + unknown computed | Tasks 1, 2, 6 |
| No completeness stats | — intentionally omitted |
| `staleTime` 10 min | Task 3 |
| Fail whole query on error | Task 2 (`Promise.all`) |
| Indexes for rank queries | Task 4 |
| Prefer no rules changes | — no rules task |
| Vitest, no Cypress | Tasks 1–3, 6–7 |
| i18n Vietnamese | Task 5 |

## Placeholder scan

No TBD/TODO left in tasks. Repo test mock notes document SDK private-field fragility with a fallback strategy.
