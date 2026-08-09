# Admin member directory stats

Date: 2026-08-09  
App: `tanstack-app` (TanStack Start + React + Mantine + TanStack Query)  
Auth: Firebase Auth custom claims (`he_phai_admin` / `he_phai_secretary` / `giao_doan_admin`)  
Database: Firebase Firestore (`getCountFromServer`)

Related: [2026-08-05-thu-ky-giao-doan-design.md](./2026-08-05-thu-ky-giao-doan-design.md), [2026-08-06-thu-ky-he-phai-design.md](./2026-08-06-thu-ky-he-phai-design.md), [2026-08-06-admin-members-list-columns-design.md](./2026-08-06-admin-members-list-columns-design.md)

## Goal

Add an admin **member directory stats** page that shows live counts for members in the viewer’s scope, using on-demand Firestore aggregation queries (`getCountFromServer`) — not denormalized counters or a worker rollup.

## Decisions

| Topic | Choice |
| --- | --- |
| Approach | On-demand `getCountFromServer` with fixed dimension buckets |
| Audience | Directory managers: `he_phai_admin`, `he_phai_secretary` (global), `giao_doan_admin` (scoped to `claim.orgUnitId`) |
| Route | `/admin/members/stats` |
| Nav | New `AdminShell` item under directory capability |
| Totals | Tất cả / Tăng / Ni |
| By giáo đoàn | Table of counts per org unit for hệ phái roles; thư ký giáo đoàn sees scoped totals only (no multi-org table) |
| By phẩm vị | Counts for known `TANG_RANKS` / `NI_RANKS` on `giaoPhamHePhai.rank`; last row **Chưa có / không rõ** = sangha total − sum of known ranks |
| Completeness | **Out of v1** (no missing-photo or other quality stats) |
| Caching | TanStack Query `staleTime` 5–15 minutes; one-shot reads, no `onSnapshot` |
| Failure mode | If any count in the batch fails, fail the whole stats query (no silent zeros) |

## Non-goals

- Denormalized summary/counter documents
- Cloudflare Worker / scheduled rollups
- Temple, khoa tu, or product/usage analytics
- Completeness / data-quality stats (e.g. thiếu ảnh chân dung)
- Charts, date ranges, export of stats
- Free-form group-by on arbitrary fields
- Cypress E2E for this page

## Metrics (v1)

All counts apply the same **scope filter** as the members list:

- `giao_doan_admin` → always `where('orgUnitId', '==', claim.orgUnitId)`
- `he_phai_admin` / `he_phai_secretary` → no org filter (global)

| Block | Queries |
| --- | --- |
| Totals | count(scope); count(scope + `sanghaType == tang`); count(scope + `sanghaType == ni`) |
| By giáo đoàn | For each org unit id from `orgUnitsQuery`: count(`orgUnitId == id`) — **he_phai roles only** |
| Phẩm vị — Tăng | For each `TANG_RANKS` value: count(scope + `sanghaType == tang` + `giaoPhamHePhai.rank == value`); unknown = tang total − sum |
| Phẩm vị — Ni | Same with `NI_RANKS` and `sanghaType == ni` |

Unknown rank is **computed**, not a separate Firestore query (missing/empty nested rank is hard to count with `==`).

## Architecture

```
memberStatsRepo (getCountFromServer)
  → memberStatsQueryOptions / memberStatsKeys
  → AdminMembersStatsPage (+ AdminShell nav)
```

### Repository

- New `memberStatsRepo` (preferred over bloating `memberRepo`) exposing something like `loadDashboardStats(scope)`.
- Build `query(collection(db, members), ...constraints)` then `getCountFromServer`.
- Run independent counts with `Promise.all`.
- Reuse the same org/sangha filter conventions as member list queries so security rules stay aligned.

### Query layer

- Key factory includes effective scope (e.g. `orgUnitId: string | null` for global vs giáo đoàn).
- `queryFn` returns a typed DTO:

```ts
type MemberDirectoryStats = {
  totals: { all: number; tang: number; ni: number }
  byOrgUnit: { orgUnitId: string; count: number }[] // empty for giao_doan_admin
  byRankTang: { rank: string | 'unknown'; count: number }[]
  byRankNi: { rank: string | 'unknown'; count: number }[]
}
```

- `staleTime`: 10 minutes (within 5–15).
- Prefer `ensureQueryData` / shared `queryOptions` if the route loader is used; otherwise hook-only is acceptable for a single page.

### Indexes

- Add composite indexes in `firestore.indexes.json` only for combinations that fail at runtime (likely `sanghaType` + `giaoPhamHePhai.rank`, and scoped variants with `orgUnitId` when needed).
- Document required indexes in the implementation plan.

### Security rules

- Prefer **no rule changes**: count queries must succeed under existing member list/read rules for the same constraints.
- Do not broaden member read access to make stats work. If thư ký counts fail, constrain queries to match list queries exactly.

## UI

Single stacked page (Mantine), matching admin chrome:

1. Title **Thống kê thành viên** + short subtitle; for `giao_doan_admin`, show scoped giáo đoàn name when available.
2. Totals: three plain numbers — Tất cả / Tăng / Ni (not chart cards).
3. **Theo giáo đoàn** table — only for `he_phai_admin` / `he_phai_secretary` (columns: giáo đoàn name, count). Resolve names via existing `orgUnitsQuery`.
4. **Phẩm vị hệ phái — Tăng** table; last row “Chưa có / không rõ”.
5. **Phẩm vị hệ phái — Ni** table; same shape.

Loading and error use existing admin patterns. No refresh button required in v1 (Query cache + normal refetch).

### Text wireframe (hệ phái)

```
Thống kê thành viên
Số lượng thành viên theo phạm vi quyền của bạn.

Tất cả    Tăng    Ni
 1240      680     560

Theo giáo đoàn
| Giáo đoàn     | Số TV |
| Giáo đoàn I   |   210 |
| …             |    …  |

Phẩm vị hệ phái — Tăng
| Phẩm vị            | Số |
| Hòa thượng         | 12 |
| …                  |  … |
| Chưa có / không rõ | 28 |

Phẩm vị hệ phái — Ni
(same shape)
```

### Text wireframe (thư ký giáo đoàn)

```
Thống kê thành viên
Phạm vi: Giáo đoàn I

Tất cả    Tăng    Ni
  210      120      90

(no multi–giáo đoàn table)

Phẩm vị hệ phái — Tăng / Ni
(same tables, scoped counts)
```

## i18n

Add Vietnamese keys in `messages/vi.json` for:

- Nav label
- Page title / subtitle
- Section headers (totals, by org, rank Tang/Ni)
- “Chưa có / không rõ”
- Column headers as needed

## Testing

- Vitest: stats helper/repo builds correct constraints for scoped vs global; unknown rank math; page renders mocked DTO (hide by-org table for `giao_doan_admin`).
- Optional rules/emulator coverage only if list-read patterns do not already imply count success.
- No new Cypress spec.

## Cost notes

- Each `count()` bills **1 document read per up to 1,000 matching index entries** (minimum 1).
- v1 cost scales with dashboard opens × number of count queries × `ceil(matches/1000)`.
- `staleTime` reduces repeat billing on navigation.
- If fan-out becomes expensive later, consider denormalized org summary docs without changing the UI contract.
