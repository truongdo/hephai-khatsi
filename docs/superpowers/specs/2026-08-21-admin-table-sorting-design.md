# Admin temple & member table sorting

**Date:** 2026-08-21  
**Routes:** `/admin/temples`, `/admin/members/tang`, `/admin/members/ni`  
**Surfaces:** `TemplesListPage`, `MembersListPage`, `AdminDataTable` header cells, Firestore list queries

## Goal

Add true **server-side** column sorting on the temple and member admin tables so order is correct across “load more” pagination (not only the currently loaded rows).

## Non-goals

- Client-only sort of loaded rows
- Typesense-backed list sorting (command palette stays search-only)
- Sorting on retreats, org-units, or registration tables
- Multi-column sort
- Persisting sort state in the URL
- Excel export sort picker (export keeps current list/export order behavior)

## Decisions

| Topic | Choice |
| --- | --- |
| Approach | Firestore `orderBy` + denormalized list-sort keys on docs |
| Default | `updatedAt` descending (unchanged) |
| Temples sortable | Tỉnh/TP, Giáo đoàn, `updatedAt` |
| Members sortable | Phẩm vị hệ phái, Giáo đoàn, Status, `updatedAt` |
| Giáo đoàn order | A→Z by **display name** (`orgUnitName`) |
| Phẩm vị order | Tang/Ni **rank hierarchy** (numeric order), not label/code alphabet |
| Org unit rename sync | Not in v1 (names are seeded / not editable in admin); re-backfill if seed names change |
| Backfill | One-shot script under `tanstack-app/scripts/` (no admin UI button) |
| UI cycle | Active column: asc → desc → default; default shows `updatedAt` desc |
| Tests | Vitest only; no new Cypress |

## UX

- Clickable headers on sortable columns only; others stay plain labels.
- Active column shows asc/desc indicator and `aria-sort`.
- Changing `sortBy` / `sortDir` or filters resets the load-more cursor and accumulated rows (same pattern as today’s filter reset).
- Status ascending: `draft` before `locked` (string order of stored values).

### Click cycle

Default state is `updatedAt` desc and may show that column as active (`aria-sort="descending"`).

1. Click a **different** sortable column → that column **asc**  
2. Click the **same** active column again → **desc**  
3. Click it again → back to default (`updatedAt` desc)

From default, clicking **`updatedAt`** → **asc**, then desc, then default again.

## Data model

Add the list-sort keys as **optional** fields on `Temple` / `Member` so converters and list queries stay typed. Forms ignore them; only write paths, backfill, and list `orderBy` use them.

| Entity | Field | Type | Source |
| --- | --- | --- | --- |
| Temple | `listCityName` | `string` | `diaChiMoi.cityName` when structured address; `""` if legacy string / missing |
| Temple | `orgUnitName` | `string` | Org unit display name resolved at write time |
| Member | `orgUnitName` | `string` | Same |
| Member | `giaoPhamHePhaiRankOrder` | `number` | Index in Tang/Ni hierarchy (`0`…n); missing rank → large sentinel (sorts last when ascending) |

Existing fields used as-is: `status`, `updatedAt`.

### Rank order

Single helper next to `TANG_RANKS` / `NI_RANKS`:

- Tang: `hoa_thuong` → `thuong_toa` → `dai_duc` → `ty_kheo` → `sa_di` → `tap_su`
- Ni: `ni_truong` → `ni_su` → `ty_kheo_ni` → `thuc_xoa_ma_na` → `sa_di_ni` → `tap_su`

### Write path

On every member/temple create/update (admin + filler), compute and persist sort keys with the existing payload.

### Backfill

One-shot operator script under `tanstack-app/scripts/` (same class of tool as org-unit seed) that walks temples/members and writes missing/stale sort keys. Required once before relying on non-`updatedAt` sorts in production. No new admin UI button in v1.

## Queries & indexes

Extend `ListTemplesAdminInput` / `ListMembersAdminInput` and matching TanStack Query keys:

```ts
// temples
sortBy?: 'listCityName' | 'orgUnitName' | 'updatedAt'
sortDir?: 'asc' | 'desc'

// members
sortBy?: 'giaoPhamHePhaiRankOrder' | 'orgUnitName' | 'status' | 'updatedAt'
sortDir?: 'asc' | 'desc'
```

Repos: existing `where` filters → `orderBy(sortBy, sortDir)` → cursor `startAfter` → `limit`. Default when omitted: `updatedAt` + `desc`.

### Composite indexes

Extend `firebase/firestore.indexes.json` for each filter × sort combination the UI can request (mirror existing `updatedAt` index patterns). Because headers toggle **asc and desc**, each composite needs both sort-field directions (or an equivalent pair of indexes).

**Temples** (optional `orgUnitId`, optional `status`) × (`listCityName` | `orgUnitName` | `updatedAt`) × (`asc` | `desc`).

**Members** (always `sanghaType`; optional `orgUnitId`, optional `status`) × (`giaoPhamHePhaiRankOrder` | `orgUnitName` | `status` | `updatedAt`) × (`asc` | `desc`).

Skip combinations that already exist for `updatedAt` desc. Deploy indexes before relying on non-default sorts in production. Index-not-ready failures surface via existing `QueryErrorAlert`.

## UI wiring

- Shared `AdminSortableTh`: label, current sort state, click handler, accessible sort announcement.
- `TemplesListPage` / `MembersListPage` own `sortBy` / `sortDir` state and pass them into `templesQuery` / `membersQuery`.
- Include sort fields in the “server filter key” that resets cursor (treat sort like a server query dimension).

## Edge cases

- Docs without sort keys before backfill may cluster incorrectly until backfill runs.
- With giáo đoàn filter already set to one org, sorting by `orgUnitName` is allowed but mostly a no-op within that scope.
- Empty `listCityName` / missing rank sentinel: stable Firestore order; empty/missing cluster at the end when ascending.

## Testing

Vitest only:

- Rank-order helper + missing-rank sentinel
- Sort-key builders (structured vs legacy address; org unit name; rank order)
- Repo/memory list respects `sortBy`/`sortDir` with filters and cursor
- `AdminSortableTh` click cycle and `aria-sort`
- List pages: changing sort resets accumulated load-more items

## Success criteria

- Default list matches today’s `updatedAt` desc behavior
- Each allowed header reorders the full filtered set across load-more pages
- New writes keep sort keys correct without a manual step after backfill
