# Admin members list columns

**Date:** 2026-08-06  
**Routes:** `/admin/members/tang`, `/admin/members/ni`  
**Component:** `tanstack-app/src/components/admin/MembersListPage.tsx`

## Goal

Show the Tang/Ni admin members table with columns in a fixed order that matches directory review needs: phẩm vị hệ phái, names, giáo đoàn, identity, status, and actions.

## Non-goals

- Changing Excel export column layout
- Changing filters, pagination, bulk delete, or unlock behavior
- Extracting a separate `MembersTable` component
- Sorting or filtering by the new columns

## Column order

Leading checkbox column for bulk selection stays first (unchanged). Then:

| # | Header | Source | Display rules |
|---|--------|--------|---------------|
| 1 | Phẩm vị (Hệ phái) | `member.giaoPhamHePhai?.rank` | Localized label via existing `TANG_RANKS` / `NI_RANKS` (same as filler form). Empty cell if missing or unknown. |
| 2 | Pháp danh | `member.phapDanh` | Link to `/admin/members/$id`. Show only `phapDanh` (no fallback to thế danh). Empty cell if missing. |
| 3 | Thế danh | `member.theDanh` | Plain text; empty cell if missing. |
| 4 | Giáo đoàn | `member.orgUnitId` | Resolve name from `orgUnitsQuery` map (same pattern as `RetreatsListPage`). If name missing, show `orgUnitId`. |
| 5 | CCCD | `member.cccd` | Unchanged. |
| 6 | Trạng thái | `member.status` + `editRequestedAt` | Existing `RecordStatusBadge` + edit-requested badge. |
| 7 | Cập nhật | `member.updatedAt` | Existing `toLocaleString('vi-VN')`. |
| 8 | (actions) | — | Existing unlock button when `status === 'locked'`. |

## Implementation approach

Edit `MembersListPage` in place:

1. Build `orgUnitNameById` from `orgUnits.data` (query already enabled when `manageDirectory`).
2. Add a small helper to map `rank` + `sanghaType` → localized label (reuse `TANG_RANKS` / `NI_RANKS` from `fillerFormOptions`).
3. Reorder/add `<Table.Th>` / `<Table.Td>` cells as above.
4. Change Pháp danh cell to `emptyCell(member.phapDanh)` wrapped in the existing detail `Link` styling when present; keep link usable when empty only if needed — prefer linking the pháp danh text when non-empty, otherwise show empty cell without link (detail still reachable via other means only if empty — accept empty non-link for missing pháp danh).
5. Add i18n keys in `messages/vi.json`:
   - `admin_members_col_pham_vi_he_phai`: `"Phẩm vị (Hệ phái)"`
   - `admin_members_col_giao_doan`: `"Giáo đoàn"`
6. Update `MembersListPage.test.tsx` fixtures with `giaoPhamHePhai` / org unit name assertions for the new columns; fix Pháp danh link assertion to use `phapDanh` only.

## Testing

- Vitest: column headers present in order; row shows rank label, pháp danh link, thế danh, giáo đoàn name, CCCD.
- No new Cypress spec (UI column layout only).

## Out of scope follow-ups

- Align Excel export columns with this table (optional later).
