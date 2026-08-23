# Admin members list — hạ-lạp tabs

**Date:** 2026-08-23  
**Routes:** `/admin/members/tang`, `/admin/members/ni`  
**Primary files:** `MembersListPage.tsx`, new `MembersHaLapTabs.tsx`, new `membersHaLapGroups.ts`, `exportMembersExcel.ts`, `adminQueries.ts`

## Goal

Replace the flat, server-sortable member admin table with a **tabbed layout** that mirrors the Excel export: members grouped by normalized **phẩm vị hệ phái** (one tab per rank group), sorted **`sapXepHaLap` ascending** within each tab, empty-rank group last.

## Non-goals

- Changing `/admin/temples` sorting (temple list keeps server-side column sort)
- Server-side Firestore pagination per tab
- User-configurable column picker on the list (Excel export column picker unchanged)
- Showing `sapXepHaLap` as a list column (sort key only; hidden like Excel’s internal ordering)
- Cypress E2E for the new layout
- Typesense / command-palette changes

## Decisions (brainstorming)

| Topic | Choice |
| --- | --- |
| Layout | **Tabs** — one tab per phẩm vị group (like Excel sheets) |
| Data loading | **Load all** for current filters via `listAllForExport`; **cache** grouped result in TanStack Query (`staleTime` 5 min); **refetch** when filters change |
| Columns | **Rút gọn:** STT, pháp danh (link), thế danh, giáo đoàn, CCCD, trạng thái, unlock — **no phẩm vị column** (tab title replaces it) |
| Admin actions | **Keep all:** filters, bulk delete, export, create, unlock; selection works **across tabs** |
| Empty rank tabs | **Hidden** (only tabs with ≥1 member), except whole-page empty when no members match filters |
| Default tab | First tab with data in canonical rank order |
| Active tab URL | Optional `?tab=<rankKey>` search param for refresh/deep-link |
| Shared logic | Extract grouping from `exportMembersExcel.ts` into domain module used by **both** list UI and export |

## Rank groups & order

Reuse existing domain rules (`normalizeHaLapHePhaiRank`, `memberHaLapHePhaiRank`, `sortMembersByHaLapSortKey`).

**Tăng tab order:** `ty_kheo` → `sa_di` → other ranks (alpha) → `__empty__` (label: “Chưa có phẩm vị”)

**Ni tab order:** `ty_kheo_ni` → `thuc_xoa_ma_na` → `sa_di_ni` → `sa_di` → other ranks (alpha) → `__empty__`

Tab labels: localized rank label via `excelSheetNameForHaLapHePhaiRank()` + count badge, e.g. `Tỳ-kheo (42)`.

## Architecture

```
Filters (org unit, status)
    ↓
membersAllQuery → memberRepo.listAllForExport (TanStack Query, staleTime 5m)
    ↓
Client filter: edit_requested (if selected — same as today)
    ↓
orderedMembersHaLapGroups(members, sanghaType)   ← shared with Excel export
    ↓
MembersHaLapTabs (Mantine Tabs)
    ↓
Per-tab table: fixed sapXepHaLap asc, STT 1..n
```

### Domain module: `membersHaLapGroups.ts`

Move from `exportMembersExcel.ts`:

- `EMPTY_HA_LAP_HE_PHAI_RANK`
- `TANG_*` / `NI_*` sheet rank order constants
- `groupMembersByHaLapHePhaiRank`
- `orderedMembersHaLapGroups` (rename from `orderedMembersExcelSheetGroups`)
- `excelSheetNameForHaLapHePhaiRank`
- `sanitizeExcelSheetName` (keep for Excel; list tabs use rank labels only)

`exportMembersExcel.ts` imports from `membersHaLapGroups.ts` — **no behavior change** to export.

## UI

### Toolbar (unchanged scope)

- Title (Tăng / Ni)
- Export Excel (+ column modal)
- Thêm mới
- Filters: giáo đoàn (he-phai scoped admins), trạng thái (draft / locked / yêu cầu sửa)

### Tabs

- Mantine `Tabs` with `keepMounted={false}` (only active tab DOM rendered)
- Tab list scrolls horizontally on narrow screens
- Selecting tab updates optional URL `?tab=ty_kheo`

### Table per tab

| Column | Notes |
| --- | --- |
| Checkbox | Row select; header selects **all rows in active tab only** |
| STT | 1-based index within tab (matches Excel) |
| Pháp danh | Link to `/admin/members/$id` |
| Thế danh | Plain text |
| Giáo đoàn | Resolved name from `orgUnitsQuery` |
| CCCD | |
| Trạng thái | `RecordStatusBadge` + edit-requested badge |
| Actions | Unlock button when locked (same as today) |

**Remove:** `AdminSortableTh`, cursor pagination, “Load more”, column sort state.

### Bulk selection

- `useAdminListSelection` keyed by member id across **all tabs**
- Bulk bar: “Đã chọn N” where N is global selection count
- Bulk delete flow unchanged

### Loading & empty states

- Full-page loader while initial `listAllForExport` pending and no cached data
- If grouped result is empty: single empty message (no tabs)
- Refetch indicator optional (background `isFetching` on tab panel)

## Data & queries

### New query: `membersAllQuery`

```typescript
membersAllQuery({
  sanghaType,
  orgUnitId?,
  status?,  // server-side only; edit_requested omitted
})
```

- `queryFn`: `memberRepo.listAllForExport`
- `queryKey`: extend `adminKeys.membersAll(...)` distinct from paginated `membersQuery`
- `staleTime`: 5 minutes (match current list)
- Mutations (delete, unlock) invalidate `adminKeys.members` prefix (covers all + paginated if any remain)

### Firestore reads

`listAllForExport` pages internally (100 per page). Acceptable for v1 per product choice; same cost profile as Excel export for the same filter scope.

## Permissions

Unchanged:

- `canManageDirectory` gate
- `giao_doan_admin` org scope
- `he_phai_secretary` org-unit filter

## Testing

| Layer | Coverage |
| --- | --- |
| Domain | Move/update tests for `orderedMembersHaLapGroups`; export tests import new module |
| Component | `MembersHaLapTabs`: renders tabs in order, hides empty groups, STT per tab, tab-local “select all” |
| `MembersListPage` | Update existing tests: no sort headers, uses tabs, cross-tab selection count |

No new Cypress specs.

## Migration notes

- **Removes** member list server-side sort UX added in 2026-08-21 spec for `/admin/members/*` only; `sapXepHaLap` sort replaces user-chosen column sort on this screen.
- **`memberRepo.list`** paginated API remains for other callers (if any); list page stops using it.
- Denormalized `giaoPhamHePhaiRankOrder` / `orgUnitName` still maintained on write; still useful elsewhere (stats, future features).

## File checklist

| File | Action |
| --- | --- |
| `src/domain/membersHaLapGroups.ts` | **Create** — shared grouping + tab labels |
| `src/domain/membersHaLapGroups.test.ts` | **Create** — move/adapt from export tests |
| `src/domain/exportMembersExcel.ts` | **Refactor** — import grouping helpers |
| `src/domain/exportMembersExcel.test.ts` | **Update** imports |
| `src/components/admin/MembersHaLapTabs.tsx` | **Create** — tabs + per-tab table |
| `src/components/admin/MembersHaLapTabs.test.tsx` | **Create** |
| `src/components/admin/MembersListPage.tsx` | **Refactor** — fetch all, render tabs, drop pagination/sort |
| `src/components/admin/MembersListPage.test.tsx` | **Update** |
| `src/query/adminKeys.ts` | **Add** `membersAll` key factory |
| `src/query/adminQueries.ts` | **Add** `membersAllQuery` |
| `messages/vi.json` | **Add** if needed (e.g. tab count pattern) |

## Out of scope follow-ups

- Firestore composite index + per-tab server pagination if member counts grow very large
- Print-friendly single-page section layout (user chose tabs over scroll sections)
