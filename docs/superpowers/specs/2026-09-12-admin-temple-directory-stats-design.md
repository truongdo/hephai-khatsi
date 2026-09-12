# Admin temple directory stats

Date: 2026-09-12  
App: `tanstack-app` (TanStack Start + React + Mantine + TanStack Query)  
Auth: Firebase Auth custom claims (`he_phai_admin` / `he_phai_secretary` / `giao_doan_admin`)  
Database: Firebase Firestore (`getCountFromServer`)

Related: [2026-08-09-admin-member-directory-stats-design.md](./2026-08-09-admin-member-directory-stats-design.md), [2026-08-05-thu-ky-giao-doan-design.md](./2026-08-05-thu-ky-giao-doan-design.md), [2026-08-06-thu-ky-he-phai-design.md](./2026-08-06-thu-ky-he-phai-design.md)

## Goal

Add an admin **temple directory stats** page that shows live counts for temples (tự viện / tịnh xá) in the viewer’s scope, using on-demand Firestore aggregation queries (`getCountFromServer`) — not denormalized counters or a worker rollup. Mirror the member directory stats pattern.

## Decisions

| Topic | Choice |
| --- | --- |
| Approach | On-demand `getCountFromServer` with fixed dimension buckets |
| Audience | Directory managers: `he_phai_admin`, `he_phai_secretary` (global), `giao_doan_admin` (scoped to `claim.orgUnitId`) |
| Route | `/admin/temples/stats` |
| Nav | New `AdminShell` item under directory capability |
| Totals | Tất cả (single total) |
| By giáo đoàn | Table of counts per org unit for hệ phái roles; thư ký giáo đoàn sees scoped totals + by-city only (no multi-org table) |
| By tỉnh / thành | Counts for each known city `name` from `cities` catalog on denormalized `listCityName`; last row **Chưa có / không rõ** = total − sum of known city counts |
| City field | `listCityName` (from `diaChiMoi.cityName` via `buildTempleListSortKeys`) |
| Completeness / status splits | **Out of v1** (no draft/locked, no `qdCongNhan`, no missing-photo) |
| Caching | TanStack Query `staleTime` 5–15 minutes; one-shot reads, no `onSnapshot` |
| Failure mode | If any count in the batch fails, fail the whole stats query (no silent zeros) |

## Non-goals

- Denormalized summary/counter documents
- Cloudflare Worker / scheduled rollups
- Member, khoa tu, or product/usage analytics
- Draft / locked or công nhận breakdowns
- Completeness / data-quality stats
- Charts, date ranges, export of stats
- Free-form group-by on arbitrary fields
- Hiding zero-count provinces in v1 (show full catalog + unknown row)
- Cypress E2E for this page

## Metrics (v1)

All counts apply the same **scope filter** as the temples list:

- `giao_doan_admin` → always `where('orgUnitId', '==', claim.orgUnitId)`
- `he_phai_admin` / `he_phai_secretary` → no org filter (global)

| Block | Queries |
| --- | --- |
| Totals | count(scope) |
| By giáo đoàn | For each org unit id from `orgUnitsQuery`: count(`orgUnitId == id`) — **he_phai roles only** |
| By tỉnh / thành | For each `cities[].name`: count(scope + `listCityName == name`); unknown = total − sum of known city counts |

Unknown city is **computed**, not a separate Firestore query (missing/empty/`""` / non-catalog values cannot be counted reliably with a single `==`).

City buckets use short `name` values from `#/data/vietnam-locations` (`cities.json`, currently ~34 entries after admin-unit consolidation), matching what `VietnamAddressFields` stores in `cityName` / `listCityName`.

## Architecture

```
templeStatsRepo (getCountFromServer)
  → templeStatsQueryOptions / templeStatsKeys
  → TemplesStatsPage (+ AdminShell nav)
```

### Repository

- New `templeStatsRepo` (preferred over bloating `templeRepo`) exposing `loadDashboardStats(scope)`.
- Build `query(collection(db, temples), ...constraints)` then `getCountFromServer`.
- Run independent counts with `Promise.all`.
- Reuse the same org filter conventions as temple list queries so security rules stay aligned.
- Inject `countTemples` for unit tests (same pattern as `createMemberStatsRepo`).

Scope input shape:

```ts
type TempleDirectoryStatsScope = {
  orgUnitId: string | null
  orgUnitIdsForBreakdown: string[] // empty → skip byOrgUnit queries
  cityNamesForBreakdown: string[] // from cities[].name
}
```

### Domain helper

- Small helper (e.g. `buildCityStatRows`) that appends `{ cityName: 'unknown', count: total - sum }` — mirror `buildRankStatRows` in member stats.
- Clamp unknown at `>= 0` if floating mismatch ever appears (prefer exact math; do not silently invent positives).

### Query layer

- Key factory includes effective scope (`orgUnitId: string | null`) and a stable marker for city/org breakdown sizes if needed.
- `queryFn` returns a typed DTO:

```ts
type TempleDirectoryStats = {
  totals: { all: number }
  byOrgUnit: { orgUnitId: string; count: number }[] // empty for giao_doan_admin
  byCity: { cityName: string | 'unknown'; count: number }[]
}
```

- `staleTime`: 10 minutes (within 5–15).
- Prefer shared `queryOptions`; hook-only on the page is acceptable for a single screen.

### Indexes

- Add composite indexes in `firestore.indexes.json` only for combinations that fail at runtime (likely `orgUnitId` + `listCityName` for scoped thư ký giáo đoàn counts).
- Single-field `listCityName` equality may work without a composite when unscoped; verify at implementation time.
- Document required indexes in the implementation plan.

### Security rules

- Prefer **no rule changes**: count queries must succeed under existing temple list/read rules for the same constraints.
- Do not broaden temple read access to make stats work. If thư ký counts fail, constrain queries to match list queries exactly.

## UI

Single stacked page (Mantine), matching admin chrome and `MembersStatsPage`:

1. Title **Thống kê tự viện / tịnh xá** + short subtitle; for `giao_doan_admin`, show scoped giáo đoàn name when available.
2. Totals: one plain number — Tất cả (not a chart card).
3. **Theo giáo đoàn** table — only for `he_phai_admin` / `he_phai_secretary` (columns: giáo đoàn name, count). Resolve names via existing `orgUnitsQuery`.
4. **Theo tỉnh / thành** table — all directory roles in scope; columns: city name, count; last row “Chưa có / không rõ”. Display catalog `name` as labels.

Loading and error use existing admin patterns (`Loader`, load-error text, `AdminDenied`). No refresh button required in v1 (Query cache + normal refetch).

Nav: new item `admin_nav_temple_stats` → `/admin/temples/stats`, icon `BarChart3`, capability `directory`. Breadcrumb entry for the stats route.

### Text wireframe (hệ phái)

```
Thống kê tự viện / tịnh xá
Số lượng tự viện / tịnh xá theo phạm vi quyền của bạn.

Tất cả
  420

Theo giáo đoàn
| Giáo đoàn     | Số |
| Giáo đoàn I   |  80 |
| …             |  … |

Theo tỉnh / thành
| Tỉnh / thành       | Số |
| Hà Nội             | 45 |
| …                  |  … |
| Chưa có / không rõ | 12 |
```

### Text wireframe (thư ký giáo đoàn)

```
Thống kê tự viện / tịnh xá
Phạm vi: Giáo đoàn I

Tất cả
   80

(no multi–giáo đoàn table)

Theo tỉnh / thành
(same table shape, scoped counts)
```

## i18n

Add Vietnamese keys in `messages/vi.json` for:

- Nav label
- Page title / subtitle / scope prefix
- Section headers (totals, by org, by city)
- “Chưa có / không rõ”
- Column headers
- Load error

## Testing

- Vitest: stats helper/repo builds correct constraints for scoped vs global; unknown city math; empty `orgUnitIdsForBreakdown` skips by-org queries; page renders mocked DTO (hide by-org table for `giao_doan_admin`); load error path.
- Optional rules/emulator coverage only if list-read patterns do not already imply count success.
- No new Cypress spec.

## Cost notes

- Each `count()` bills **1 document read per up to 1,000 matching index entries** (minimum 1).
- v1 fan-out ≈ 1 (total) + N org units (hệ phái only) + ~34 cities ≈ ~45 queries for hệ phái; fewer for `giao_doan_admin` (no org breakdown).
- Cost scales with dashboard opens × number of count queries × `ceil(matches/1000)`.
- `staleTime` reduces repeat billing on navigation.
- If fan-out becomes expensive later, consider denormalized summary docs without changing the UI contract.

## Expected touch list

- `tanstack-app/src/domain/templeDirectoryStats.ts` (+ tests) — DTO + `buildCityStatRows`
- `tanstack-app/src/repositories/templeStatsRepo.ts` (+ tests)
- `tanstack-app/src/query/adminQueries.ts` (or equivalent) — keys / `queryOptions`
- `tanstack-app/src/components/admin/TemplesStatsPage.tsx` (+ tests)
- `tanstack-app/src/routes/admin/temples.stats.tsx`
- `tanstack-app/src/components/admin/AdminShell.tsx` — nav item
- `tanstack-app/src/components/admin/adminBreadcrumbs.ts`
- `tanstack-app/messages/vi.json` — Paraglide keys
- `firebase/firestore.indexes.json` — only if runtime requires
