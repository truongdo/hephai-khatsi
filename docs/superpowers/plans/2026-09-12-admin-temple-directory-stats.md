# Admin Temple Directory Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/admin/temples/stats` showing scoped temple totals, by-giáo-đoàn counts (hệ phái only), and by-tỉnh/thành counts via on-demand Firestore `getCountFromServer`.

**Architecture:** Domain helper assembles city rows (including computed “unknown”); `templeStatsRepo` runs parallel count queries with injectable `countTemples` for unit tests; TanStack `queryOptions` + `TemplesStatsPage` + AdminShell nav. Mirror member directory stats. No denormalized counters, no Cypress.

**Tech Stack:** Firestore `getCountFromServer`, TanStack Query `queryOptions`, Mantine Table/Stack/Text, Paraglide i18n, Vitest, `#/data/vietnam-locations` city catalog

**Spec:** `docs/superpowers/specs/2026-09-12-admin-temple-directory-stats-design.md`

## Global Constraints

- Create and work on a **new feature branch from `main`** (e.g. `feat/admin-temple-directory-stats`); do **not** use git worktrees
- Audience: `he_phai_admin` / `he_phai_secretary` (global) and `giao_doan_admin` (scoped to `claim.orgUnitId`)
- Approach: on-demand `getCountFromServer` only — no summary docs / worker rollups
- Metrics v1 only: totals + by giáo đoàn + by `listCityName` (full city catalog + unknown); no draft/locked / công nhận / completeness
- Prefer Vitest; no new Cypress
- Prefer no Firestore rules changes; do not broaden temple reads
- Fail the whole stats load if any count fails (no silent zeros)
- `staleTime`: 10 minutes
- City buckets use `cities[].name` from `#/data/vietnam-locations` (short names matching `listCityName`)

## File Structure

| File | Responsibility |
| --- | --- |
| `docs/superpowers/specs/2026-09-12-admin-temple-directory-stats-design.md` | Approved design (commit on branch if not already) |
| `tanstack-app/src/domain/templeDirectoryStats.ts` | DTO types + city-row assembly / unknown math |
| `tanstack-app/src/domain/templeDirectoryStats.test.ts` | Unit tests for assembly helpers |
| `tanstack-app/src/repositories/templeStatsRepo.ts` | Parallel counts → `TempleDirectoryStats` |
| `tanstack-app/src/repositories/templeStatsRepo.test.ts` | Repo tests via injectable `countTemples` |
| `tanstack-app/src/query/adminKeys.ts` | `templeDirectoryStats` key |
| `tanstack-app/src/query/adminKeys.test.ts` | Key shape assertion |
| `tanstack-app/src/query/adminQueries.ts` | `templeDirectoryStatsQuery` |
| `tanstack-app/messages/vi.json` | Vietnamese copy |
| `tanstack-app/src/components/admin/TemplesStatsPage.tsx` | Page UI |
| `tanstack-app/src/components/admin/TemplesStatsPage.test.tsx` | Render / scope visibility |
| `tanstack-app/src/routes/admin/temples.stats.tsx` | Route `/admin/temples/stats` |
| `tanstack-app/src/components/admin/AdminShell.tsx` | Nav item |
| `tanstack-app/src/components/admin/AdminShell.test.tsx` | Nav visible for directory roles |
| `tanstack-app/src/components/admin/adminBreadcrumbs.ts` | Breadcrumb for stats |
| `tanstack-app/src/components/admin/adminBreadcrumbs.test.ts` | Breadcrumb assertion |

**Indexes:** Existing `temples` composites already include `orgUnitId` + `listCityName`. Do **not** add new indexes unless a runtime count fails; if it fails, add the minimal composite and document it in the commit message.

---

### Task 0: Feature branch + design commit

**Files:**
- Ensure present: `docs/superpowers/specs/2026-09-12-admin-temple-directory-stats-design.md`
- Create: `docs/superpowers/plans/2026-09-12-admin-temple-directory-stats.md` (this plan)

- [ ] **Step 1: Create branch from main**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git checkout main
git pull
git checkout -b feat/admin-temple-directory-stats
```

If the working tree has unrelated dirty files, stop and ask the user before branching.

- [ ] **Step 2: Confirm branch**

```bash
git branch --show-current
```

Expected: `feat/admin-temple-directory-stats`

- [ ] **Step 3: Commit design + plan if uncommitted**

```bash
git add docs/superpowers/specs/2026-09-12-admin-temple-directory-stats-design.md \
  docs/superpowers/plans/2026-09-12-admin-temple-directory-stats.md
git commit -m "$(cat <<'EOF'
docs: add temple directory stats design and plan

EOF
)"
```

Skip if already committed on this branch.

---

### Task 1: Domain DTO + city assembly helpers

**Files:**
- Create: `tanstack-app/src/domain/templeDirectoryStats.ts`
- Create: `tanstack-app/src/domain/templeDirectoryStats.test.ts`

**Interfaces:**
- Produces:

```ts
export type TempleCityStatRow = {
  cityName: string | 'unknown'
  count: number
}

export type TempleDirectoryStats = {
  totals: { all: number }
  byOrgUnit: { orgUnitId: string; count: number }[]
  byCity: TempleCityStatRow[]
}

/** knownCounts in same order as `cityNames`; appends unknown = max(0, total - sum). */
export function buildCityStatRows(
  cityNames: readonly string[],
  knownCounts: readonly number[],
  total: number,
): TempleCityStatRow[]
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { buildCityStatRows } from './templeDirectoryStats'

describe('buildCityStatRows', () => {
  it('appends unknown as total minus known sum', () => {
    expect(buildCityStatRows(['Hà Nội', 'Huế'], [3, 5], 12)).toEqual([
      { cityName: 'Hà Nội', count: 3 },
      { cityName: 'Huế', count: 5 },
      { cityName: 'unknown', count: 4 },
    ])
  })

  it('clamps unknown at 0 when known sum exceeds total', () => {
    expect(buildCityStatRows(['Hà Nội'], [5], 3)).toEqual([
      { cityName: 'Hà Nội', count: 5 },
      { cityName: 'unknown', count: 0 },
    ])
  })

  it('throws when cityNames and knownCounts length mismatch', () => {
    expect(() => buildCityStatRows(['Hà Nội'], [1, 2], 3)).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/domain/templeDirectoryStats.test.ts
```

Expected: FAIL — module / export missing.

- [ ] **Step 3: Minimal implementation**

```ts
export type TempleCityStatRow = {
  cityName: string | 'unknown'
  count: number
}

export type TempleDirectoryStats = {
  totals: { all: number }
  byOrgUnit: { orgUnitId: string; count: number }[]
  byCity: TempleCityStatRow[]
}

export function buildCityStatRows(
  cityNames: readonly string[],
  knownCounts: readonly number[],
  total: number,
): TempleCityStatRow[] {
  if (cityNames.length !== knownCounts.length) {
    throw new Error('cityNames and knownCounts length mismatch')
  }
  const sum = knownCounts.reduce((acc, n) => acc + n, 0)
  const rows: TempleCityStatRow[] = cityNames.map((cityName, i) => ({
    cityName,
    count: knownCounts[i]!,
  }))
  rows.push({ cityName: 'unknown', count: Math.max(0, total - sum) })
  return rows
}
```

- [ ] **Step 4: Run test to verify it passes**

Same command as Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/domain/templeDirectoryStats.ts \
  tanstack-app/src/domain/templeDirectoryStats.test.ts
git commit -m "$(cat <<'EOF'
feat: add temple directory stats city assembly helper

EOF
)"
```

---

### Task 2: `templeStatsRepo` with injectable counter

**Files:**
- Create: `tanstack-app/src/repositories/templeStatsRepo.ts`
- Create: `tanstack-app/src/repositories/templeStatsRepo.test.ts`

**Interfaces:**
- Consumes: `buildCityStatRows`, `COLLECTIONS.temples`, `getClientFirestore`
- Produces:

```ts
export type TempleDirectoryStatsScope = {
  /** null = hệ phái global; string = thư ký giáo đoàn scope */
  orgUnitId: string | null
  /** org unit ids to count for byOrgUnit; empty skips that block */
  orgUnitIdsForBreakdown: string[]
  /** city short names for listCityName buckets (from cities[].name) */
  cityNamesForBreakdown: string[]
}

export type CountTemplesFn = (
  constraints: import('firebase/firestore').QueryConstraint[],
) => Promise<number>

export function createTempleStatsRepo(countTemples: CountTemplesFn): {
  loadDashboardStats(
    scope: TempleDirectoryStatsScope,
  ): Promise<import('#/domain/templeDirectoryStats').TempleDirectoryStats>
}

export const templeStatsRepo: ReturnType<typeof createTempleStatsRepo>
```

Default counter:

```ts
async function defaultCountTemples(
  constraints: QueryConstraint[],
): Promise<number> {
  const db = getClientFirestore()
  if (!db) throw new Error('Firestore is not configured')
  const snap = await getCountFromServer(
    query(collection(db, COLLECTIONS.temples), ...constraints),
  )
  return snap.data().count
}
```

Constraint rules inside `loadDashboardStats`:

1. Build `scopeConstraints`: if `scope.orgUnitId` is a non-empty string, include `where('orgUnitId', '==', scope.orgUnitId)`; else none.
2. Totals: `count(scope)`.
3. `byOrgUnit`: for each id in `orgUnitIdsForBreakdown`, `count(where orgUnitId==id)` (no page-scope org on these; when caller is giao_doan, pass `[]`).
4. Cities: for each name in `cityNamesForBreakdown`, `count(scope + where('listCityName','==', name))`; assemble with `buildCityStatRows(cityNames, counts, allTotal)`.
5. Run all independent counts via `Promise.all`. If any rejects, the whole promise rejects.

- [ ] **Step 1: Write the failing test**

```ts
import { where, type QueryConstraint } from 'firebase/firestore'
import { describe, expect, it, vi } from 'vitest'
import { createTempleStatsRepo } from './templeStatsRepo'

function constraintKey(constraints: QueryConstraint[]): string {
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

describe('createTempleStatsRepo', () => {
  it('loads totals, org breakdown, and city rows with unknown', async () => {
    const countTemples = vi.fn(async (constraints: QueryConstraint[]) => {
      const key = constraintKey(constraints)
      const table: Record<string, number> = {
        [constraintKey([])]: 10,
        [constraintKey([where('orgUnitId', '==', 'gd-i')])]: 7,
        [constraintKey([where('orgUnitId', '==', 'gd-ii')])]: 3,
        [constraintKey([where('listCityName', '==', 'Hà Nội')])]: 4,
        [constraintKey([where('listCityName', '==', 'Huế')])]: 2,
      }
      if (key in table) return table[key]!
      throw new Error(`unexpected constraints: ${key}`)
    })

    const repo = createTempleStatsRepo(countTemples)
    const stats = await repo.loadDashboardStats({
      orgUnitId: null,
      orgUnitIdsForBreakdown: ['gd-i', 'gd-ii'],
      cityNamesForBreakdown: ['Hà Nội', 'Huế'],
    })

    expect(stats.totals).toEqual({ all: 10 })
    expect(stats.byOrgUnit).toEqual([
      { orgUnitId: 'gd-i', count: 7 },
      { orgUnitId: 'gd-ii', count: 3 },
    ])
    expect(stats.byCity).toEqual([
      { cityName: 'Hà Nội', count: 4 },
      { cityName: 'Huế', count: 2 },
      { cityName: 'unknown', count: 4 },
    ])
  })

  it('scopes city counts when orgUnitId set and skips org breakdown when empty', async () => {
    const countTemples = vi.fn(async (constraints: QueryConstraint[]) => {
      const parsed = JSON.parse(constraintKey(constraints)) as Array<{
        field: string | null
        value: unknown
      }>
      expect(
        parsed.some((p) => p.field === 'orgUnitId' && p.value === 'gd-i'),
      ).toBe(true)
      if (parsed.some((p) => p.field === 'listCityName' && p.value === 'Hà Nội'))
        return 3
      if (parsed.some((p) => p.field === 'listCityName')) return 0
      return 5
    })

    const repo = createTempleStatsRepo(countTemples)
    const stats = await repo.loadDashboardStats({
      orgUnitId: 'gd-i',
      orgUnitIdsForBreakdown: [],
      cityNamesForBreakdown: ['Hà Nội', 'Huế'],
    })

    expect(stats.totals).toEqual({ all: 5 })
    expect(stats.byOrgUnit).toEqual([])
    expect(stats.byCity.at(-1)).toEqual({ cityName: 'unknown', count: 2 })
  })
})
```

**Note for implementer:** Firestore `QueryConstraint` private fields may differ by SDK version. If `constraintKey` is brittle, switch the mock to inspect calls via `(constraint as any)._field` / `_value` as observed during the failing run. Keep DTO assertions stable.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/repositories/templeStatsRepo.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implement `templeStatsRepo.ts`**

Implement `createTempleStatsRepo` + `export const templeStatsRepo = createTempleStatsRepo(defaultCountTemples)` per Interfaces.

Skeleton:

```ts
import {
  collection,
  getCountFromServer,
  query,
  where,
  type QueryConstraint,
} from 'firebase/firestore'
import {
  buildCityStatRows,
  type TempleDirectoryStats,
} from '#/domain/templeDirectoryStats'
import { COLLECTIONS } from '#/firebase/collections'
import { getClientFirestore } from '#/firebase/firestore'

// ... types, defaultCountTemples, createTempleStatsRepo as above ...

export function createTempleStatsRepo(countTemples: CountTemplesFn) {
  return {
    async loadDashboardStats(
      scope: TempleDirectoryStatsScope,
    ): Promise<TempleDirectoryStats> {
      const scopeConstraints: QueryConstraint[] = []
      if (scope.orgUnitId) {
        scopeConstraints.push(where('orgUnitId', '==', scope.orgUnitId))
      }
      const orgUnitIds = scope.orgUnitIdsForBreakdown
      const cityNames = scope.cityNamesForBreakdown

      const counts = await Promise.all([
        countTemples([...scopeConstraints]),
        ...orgUnitIds.map((orgUnitId) =>
          countTemples([where('orgUnitId', '==', orgUnitId)]),
        ),
        ...cityNames.map((cityName) =>
          countTemples([
            ...scopeConstraints,
            where('listCityName', '==', cityName),
          ]),
        ),
      ])

      const allCount = counts[0]!
      const orgUnitCounts = counts.slice(1, 1 + orgUnitIds.length)
      const cityCounts = counts.slice(1 + orgUnitIds.length)

      return {
        totals: { all: allCount },
        byOrgUnit: orgUnitIds.map((orgUnitId, i) => ({
          orgUnitId,
          count: orgUnitCounts[i]!,
        })),
        byCity: buildCityStatRows(cityNames, cityCounts, allCount),
      }
    },
  }
}

export const templeStatsRepo = createTempleStatsRepo(defaultCountTemples)
```

- [ ] **Step 4: Run test to verify it passes**

Same command as Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/repositories/templeStatsRepo.ts \
  tanstack-app/src/repositories/templeStatsRepo.test.ts
git commit -m "$(cat <<'EOF'
feat: add templeStatsRepo for directory count aggregations

EOF
)"
```

---

### Task 3: Query keys + `templeDirectoryStatsQuery`

**Files:**
- Modify: `tanstack-app/src/query/adminKeys.ts`
- Modify: `tanstack-app/src/query/adminKeys.test.ts`
- Modify: `tanstack-app/src/query/adminQueries.ts`

**Interfaces:**
- Produces:

```ts
// adminKeys
templeDirectoryStats: (scope: {
  orgUnitId: string | null
  orgUnitIdsForBreakdown: string[]
  cityNamesForBreakdown: string[]
}) => readonly ['admin', 'templeDirectoryStats', typeof scope]

// adminQueries
export function templeDirectoryStatsQuery(scope: {
  orgUnitId: string | null
  orgUnitIdsForBreakdown: string[]
  cityNamesForBreakdown: string[]
}) {
  return queryOptions({
    queryKey: adminKeys.templeDirectoryStats(scope),
    queryFn: () => templeStatsRepo.loadDashboardStats(scope),
    staleTime: 10 * 60_000,
    retry: 3,
  })
}
```

- [ ] **Step 1: Write the failing key test**

In `adminKeys.test.ts` add:

```ts
it('templeDirectoryStats nests under admin with scope', () => {
  expect(
    adminKeys.templeDirectoryStats({
      orgUnitId: 'gd-i',
      orgUnitIdsForBreakdown: [],
      cityNamesForBreakdown: ['Hà Nội'],
    }),
  ).toEqual([
    'admin',
    'templeDirectoryStats',
    {
      orgUnitId: 'gd-i',
      orgUnitIdsForBreakdown: [],
      cityNamesForBreakdown: ['Hà Nội'],
    },
  ])
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/query/adminKeys.test.ts
```

Expected: FAIL — `templeDirectoryStats` missing.

- [ ] **Step 3: Add key + queryOptions**

Update `adminKeys.ts` and `adminQueries.ts` (import `templeStatsRepo`).

- [ ] **Step 4: Run key test to verify it passes**

Same command as Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/query/adminKeys.ts \
  tanstack-app/src/query/adminKeys.test.ts \
  tanstack-app/src/query/adminQueries.ts
git commit -m "$(cat <<'EOF'
feat: add templeDirectoryStats TanStack query options

EOF
)"
```

---

### Task 4: i18n strings

**Files:**
- Modify: `tanstack-app/messages/vi.json`

**Interfaces:**
- Produces keys (Vietnamese values):

| Key | Value |
| --- | --- |
| `admin_nav_temple_stats` | `Thống kê tự viện` |
| `admin_temple_stats_title` | `Thống kê tự viện / tịnh xá` |
| `admin_temple_stats_subtitle` | `Số lượng tự viện / tịnh xá theo phạm vi quyền của bạn.` |
| `admin_temple_stats_scope_prefix` | `Phạm vi:` |
| `admin_temple_stats_total_all` | `Tất cả` |
| `admin_temple_stats_by_org_title` | `Theo giáo đoàn` |
| `admin_temple_stats_col_org` | `Giáo đoàn` |
| `admin_temple_stats_col_count` | `Số lượng` |
| `admin_temple_stats_by_city_title` | `Theo tỉnh / thành` |
| `admin_temple_stats_col_city` | `Tỉnh / thành` |
| `admin_temple_stats_city_unknown` | `Chưa có / không rõ` |
| `admin_temple_stats_load_error` | `Không tải được thống kê.` |

- [ ] **Step 1: Add keys to `vi.json`**

Insert near other `admin_nav_*` / `admin_member_stats_*` keys. Keep JSON valid (trailing commas forbidden).

- [ ] **Step 2: Compile Paraglide**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm run paraglide
```

Expected: exit 0; `m.admin_nav_temple_stats` etc. available under `src/paraglide`.

- [ ] **Step 3: Commit**

```bash
git add tanstack-app/messages/vi.json tanstack-app/src/paraglide
git commit -m "$(cat <<'EOF'
feat: add i18n for admin temple directory stats

EOF
)"
```

---

### Task 5: `TemplesStatsPage` UI

**Files:**
- Create: `tanstack-app/src/components/admin/TemplesStatsPage.tsx`
- Create: `tanstack-app/src/components/admin/TemplesStatsPage.test.tsx`

**Interfaces:**
- Consumes: `useAdminClaim`, `canManageDirectory`, `isHePhaiScope`, `orgUnitsQuery`, `templeDirectoryStatsQuery`, `cities` from `#/data/vietnam-locations`, Paraglide keys from Task 4, `AdminDenied`
- Produces: `export function TemplesStatsPage()`

Behavior (mirror `MembersStatsPage.tsx`):

1. If claim loading → `Loader`. If not admin or `!canManageDirectory` → `AdminDenied`.
2. Derive scope:
   - `orgUnitId = claim.role === 'giao_doan_admin' ? claim.orgUnitId : null` (if giao_doan and orgUnitId null → load error, do not load global).
   - `orgUnitIdsForBreakdown = isHePhaiScope(claims) ? orgUnits.map(o => o.id) : []`
   - `cityNamesForBreakdown = cities.map((c) => c.name)`
3. `useQuery(orgUnitsQuery())` when directory manager (names + breakdown ids).
4. `useQuery({ ...templeDirectoryStatsQuery(scope), enabled })` when scope valid and (for he_phai) org units settled; for giao_doan when `orgUnitId` is a string.
5. Render: title, subtitle/scope prefix, total Tất cả, **Theo giáo đoàn** (he_phai only), **Theo tỉnh / thành** (all rows including unknown label via `m.admin_temple_stats_city_unknown()`).
6. Loading / error: same patterns as `MembersStatsPage`.

- [ ] **Step 1: Write the failing page test**

Copy harness from `MembersStatsPage.test.tsx` (MantineProvider, QueryClientProvider, ResizeObserver, mocked `useAdminClaim` + `adminQueries`):

```ts
const statsData = {
  totals: { all: 100 },
  byOrgUnit: [{ orgUnitId: 'gd-i', count: 40 }],
  byCity: [
    { cityName: 'Hà Nội', count: 30 },
    { cityName: 'unknown', count: 5 },
  ],
}

it('hides by-org table for giao_doan_admin', async () => {
  useAdminClaimMock.mockReturnValue({
    status: 'admin',
    uid: 'u',
    role: 'giao_doan_admin',
    orgUnitId: 'gd-i',
  })
  // render TemplesStatsPage with mocked templeDirectoryStatsQuery → statsData (byOrgUnit: [])
  expect(await screen.findByText(m.admin_temple_stats_title())).toBeTruthy()
  expect(screen.queryByText(m.admin_temple_stats_by_org_title())).toBeNull()
  expect(screen.getByText(m.admin_temple_stats_by_city_title())).toBeTruthy()
})

it('shows by-org table for he_phai_admin', async () => {
  // mock he_phai_admin + byOrgUnit row + orgUnits name
  expect(await screen.findByText(m.admin_temple_stats_by_org_title())).toBeTruthy()
  expect(screen.getByText('Giáo đoàn I')).toBeTruthy()
})

it('shows load error when stats query fails', async () => {
  // mock queryFn reject / isError path matching MembersStatsPage.test
  expect(
    await screen.findByText(m.admin_temple_stats_load_error()),
  ).toBeTruthy()
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/components/admin/TemplesStatsPage.test.tsx
```

Expected: FAIL — component missing.

- [ ] **Step 3: Implement `TemplesStatsPage.tsx`**

Use Mantine `Stack`, `Title`, `Text`, `Group`, `Table`, `Loader`. One total number. Tables for org + city. Structure closely after `MembersStatsPage.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Same command as Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/admin/TemplesStatsPage.tsx \
  tanstack-app/src/components/admin/TemplesStatsPage.test.tsx
git commit -m "$(cat <<'EOF'
feat: add TemplesStatsPage UI

EOF
)"
```

---

### Task 6: Route, nav, breadcrumbs

**Files:**
- Create: `tanstack-app/src/routes/admin/temples.stats.tsx`
- Modify: `tanstack-app/src/components/admin/AdminShell.tsx`
- Modify: `tanstack-app/src/components/admin/AdminShell.test.tsx`
- Modify: `tanstack-app/src/components/admin/adminBreadcrumbs.ts`
- Modify: `tanstack-app/src/components/admin/adminBreadcrumbs.test.ts`
- Note: route tree codegen may update `tanstack-app/src/routeTree.gen.ts` via Vite plugin on dev/build — commit generated changes if the project’s usual workflow includes them

**Interfaces:**
- Route: `createFileRoute('/admin/temples/stats')({ component: TemplesStatsPage })`
- Nav: insert after temples list item (before Tăng), or after member stats — prefer **after temples** so temple list + temple stats sit together:

```ts
{
  label: () => m.admin_nav_temple_stats(),
  to: '/admin/temples/stats',
  icon: BarChart3,
  capability: 'directory',
},
```

- Breadcrumbs: in `section === 'temples'`, if `rest[0] === 'stats'` return `[rootCrumb(), { title: m.admin_nav_temple_stats() }]` (do not treat as edit form).

- [ ] **Step 1: Write failing breadcrumb + nav tests**

In `adminBreadcrumbs.test.ts`:

```ts
it('temple stats', () => {
  expect(buildAdminBreadcrumbs('/admin/temples/stats')).toEqual([
    { title: m.admin_title(), href: '/admin' },
    { title: m.admin_nav_temple_stats() },
  ])
})
```

In `AdminShell.test.tsx` add assertion that directory managers see `m.admin_nav_temple_stats()` (mirror member stats nav test).

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/components/admin/adminBreadcrumbs.test.ts src/components/admin/AdminShell.test.tsx
```

Expected: FAIL on new assertions.

- [ ] **Step 3: Implement route, nav, breadcrumbs**

```ts
// temples.stats.tsx
import { createFileRoute } from '@tanstack/react-router'
import { TemplesStatsPage } from '#/components/admin/TemplesStatsPage'

export const Route = createFileRoute('/admin/temples/stats')({
  component: TemplesStatsPage,
})
```

Update `AdminShell` nav list and `adminBreadcrumbs` temples branch:

```ts
if (section === 'temples') {
  if (rest.length === 0) {
    return [rootCrumb(), { title: m.admin_nav_temples() }]
  }
  if (rest[0] === 'stats') {
    return [rootCrumb(), { title: m.admin_nav_temple_stats() }]
  }
  // existing new/edit leaf...
}
```

- [ ] **Step 4: Run tests to verify they pass**

Same command as Step 2, plus:

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/components/admin/TemplesStatsPage.test.tsx
```

Expected: PASS. If route tree generation is needed for typecheck, run `pnpm dev` briefly or the project’s route-gen script and commit `routeTree.gen.ts`.

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/routes/admin/temples.stats.tsx \
  tanstack-app/src/components/admin/AdminShell.tsx \
  tanstack-app/src/components/admin/AdminShell.test.tsx \
  tanstack-app/src/components/admin/adminBreadcrumbs.ts \
  tanstack-app/src/components/admin/adminBreadcrumbs.test.ts \
  tanstack-app/src/routeTree.gen.ts
git commit -m "$(cat <<'EOF'
feat: wire temple stats route, nav, and breadcrumbs

EOF
)"
```

Only add `routeTree.gen.ts` if it changed.

---

### Task 7: Smoke verification

**Files:** none (commands only)

- [ ] **Step 1: Run focused Vitest suite**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run \
  src/domain/templeDirectoryStats.test.ts \
  src/repositories/templeStatsRepo.test.ts \
  src/query/adminKeys.test.ts \
  src/components/admin/TemplesStatsPage.test.tsx \
  src/components/admin/AdminShell.test.tsx \
  src/components/admin/adminBreadcrumbs.test.ts
```

Expected: all PASS.

- [ ] **Step 2: Manual check (optional)**

With `pnpm dev`, open `/admin/temples/stats` as hệ phái and as thư ký giáo đoàn. Confirm totals, org table visibility, and city table. If Firestore returns a missing-index URL for `orgUnitId`+`listCityName` counts, add the composite to `firebase/firestore.indexes.json` and commit separately.

- [ ] **Step 3: Final commit only if index or gen files needed**

```bash
git status
# commit only if Step 2 produced required index/gen fixes
```
