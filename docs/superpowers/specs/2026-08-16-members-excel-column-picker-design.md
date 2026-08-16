# Members Excel column picker

**Date:** 2026-08-16  
**Routes:** `/admin/members/tang`, `/admin/members/ni`  
**Primary files:** `tanstack-app/src/domain/exportMembersExcel.ts`, `tanstack-app/src/use-cases/exportMembersExcel.ts`, `tanstack-app/src/components/admin/MembersListPage.tsx`

## Goal

Let an admin choose which **flat member fields** appear in the Excel export, remember that choice in the browser, and keep a stable column order from a catalog (not drag-and-drop).

## Non-goals

- Excel export for temples or other collections
- Nested arrays: `chucVuHePhai`, `chucVuGhpgvn`, `khoaTu`, `giaDinh.anhChiEm`, document files, portrait photos
- Reordering columns
- Changing `listAllForExport` (still fetch full member documents; column choice only affects the spreadsheet)
- Changing list filters, pagination, or bulk actions
- Server-side field projection / billed-read optimization for unused fields
- Cypress E2E for this flow

## Architecture

Keep the existing pipeline: list page → `exportMembersExcel` (same `sanghaType` / `orgUnitId` / `status` filters) → `downloadMembersExcel`.

Add three units:

1. **Catalog** (domain): ordered list of exportable columns `{ id, headerKey, group, sangha?: 'tang' | 'ni' }` plus a cell getter per `id`.
2. **Persisted selection** (browser): `localStorage` keys `members-excel-columns:tang` and `members-excel-columns:ni`, value JSON array of column `id`s.
3. **Modal UI** (Mantine): opened by the existing “Xuất Excel” button; confirm writes storage then runs the mutation.

`STT` is not in the catalog. It is always column 1 (1-based row index of the exported list).

`membersToExcelRows(members, sanghaType, columnIds, ctx)` writes: `[STT, ...selected headers in catalog order]`, then one data row per member. Unknown `id`s in `columnIds` are ignored. Selected ids are emitted in **catalog order**, not checkbox-click order.

`ctx` supplies `orgUnitNameById` from the list page’s existing `orgUnitsQuery` (no extra fetch at export time). Missing name → fall back to `orgUnitId`.

## Catalog

Header text uses existing Paraglide/message keys (`filler_field_*`, list labels). Empty source → empty cell. Addresses (`noiSinh`, `diaChiThuongTru`, `noiXuatGia`) use `formatAddressDisplay`. Rank cells use the same `TANG_RANKS` / `NI_RANKS` labels as the members table. Status uses the existing admin status labels (`draft` / `locked` only; do not add edit-requested as a separate column).

Groups and ids (order within the file / Excel when selected):

### Hệ thống

| id | Source |
|----|--------|
| `orgUnitName` | `orgUnitNameById[member.orgUnitId]` |
| `phanDoan` | `member.phanDoan` |
| `status` | `member.status` |

### Định danh

| id | Source |
|----|--------|
| `theDanh` | `member.theDanh` |
| `phapDanh` | `member.phapDanh` |
| `ngaySinh` | `member.ngaySinh` |
| `noiSinh` | formatted address |
| `nguyenQuan` | `member.nguyenQuan` |
| `danToc` | `member.danToc` |

### Giấy tờ

| id | Source |
|----|--------|
| `cccd` | `member.cccd` |
| `cccdNgayCap` | `member.cccdMeta?.ngayCap` |
| `cccdNoiCap` | `member.cccdMeta?.noiCap` |
| `cntnSo` | `member.cntn?.so` |
| `cntnNgayCap` | `member.cntn?.ngayCap` |
| `cntnNoiCap` | `member.cntn?.noiCap` |

### Liên hệ

| id | Source |
|----|--------|
| `dienThoai` | `member.dienThoai` |
| `email` | `member.email` |
| `diaChiThuongTru` | formatted address |

### Xuất gia

| id | Source |
|----|--------|
| `ngayXuatGia` | `member.ngayXuatGia` |
| `noiXuatGia` | formatted address |
| `hienTuHoc` | `member.hienTuHoc` |
| `bonSu` | `member.bonSu` |
| `hePhaiGoc` | `member.hePhaiGoc` |
| `giaoDoanGoc` | `member.giaoDoanGoc` |
| `haLap` | `member.haLap` (number → string) |

### Thọ giới

Each precept is five columns. Show **tang** precepts only on `/admin/members/tang`, **ni** only on `/admin/members/ni`.

Subfields: `ngayGh`, `taiGh`, `tonHieuGioiDan`, `ngayHePhai`, `taiHePhai` (ids: `{precept}_{subfield}`, e.g. `gioiTyKheo_ngayGh`).

| precept id prefix | Member field | `sangha` |
|-------------------|--------------|----------|
| `gioiSaDi` | `gioiSaDi` | tang |
| `gioiTyKheo` | `gioiTyKheo` | tang |
| `gioiSaDiNi` | `gioiSaDiNi` | ni |
| `gioiThucXoaMaNa` | `gioiThucXoaMaNa` | ni |
| `gioiTyKheoNi` | `gioiTyKheoNi` | ni |

Header = precept label + subfield label (e.g. “Giới Tỳ-kheo — Ngày thọ giới Giáo hội”).

### Phẩm vị

| id | Source |
|----|--------|
| `giaoPhamGiaoHoiRank` | `member.giaoPhamGiaoHoi?.rank` (localized) |
| `giaoPhamGiaoHoiNam` | `member.giaoPhamGiaoHoi?.namTienPhong` |
| `giaoPhamHePhaiRank` | `member.giaoPhamHePhai?.rank` (localized) |
| `giaoPhamHePhaiNam` | `member.giaoPhamHePhai?.namTienPhong` |

### Học vấn

| id | Source |
|----|--------|
| `trinhDoTheHoc` | `member.trinhDoTheHoc` |
| `ngoaiNgu` | `member.ngoaiNgu` |
| `trinhDoChuyenMon` | `member.trinhDoChuyenMon` |
| `capBac` | `member.capBac` |
| `trinhDoPhatHoc` | `member.trinhDoPhatHoc` |
| `coNgu` | `member.coNgu` |
| `hocViHocHam` | `member.hocViHocHam` |

### Khác (phẳng)

| id | Source |
|----|--------|
| `chucVuDoanThe` | `member.chucVuDoanThe` (string only) |
| `nguyenVong` | `member.nguyenVong` |

**Not in catalog:** `id`, `inviteId`, `photoPath`, `currentTempleId`, `documents`, audit timestamps, nested position/family/retreat arrays.

## Default selection

First visit (no valid storage): the eight content columns that match today’s sheet, for that sangha:

- tang: `theDanh`, `phapDanh`, `ngaySinh`, `cccd`, `cccdNgayCap`, `cccdNoiCap`, `gioiTyKheo_ngayGh`, `hienTuHoc`
- ni: same, but `gioiTyKheoNi_ngayGh` instead of `gioiTyKheo_ngayGh`

Columns added to the catalog later are **not** auto-selected.

## Persistence

- Read on modal open; write on confirm (not on every checkbox toggle).
- Invalid JSON, non-array, or after dropping unknown ids the list is empty → use default selection.
- Tang and Ni selections are independent.

## UI

1. “Xuất Excel” opens a Mantine `Modal` (does not start the download).
2. Checkboxes grouped as above; only columns for the current `sanghaType`.
3. “Chọn tất cả” / “Bỏ chọn” apply to the visible catalog.
4. Confirm (“Xuất”) is disabled when zero catalog columns are checked.
5. On confirm: persist ids, close modal, run existing `exportMutation` with `columnIds` and `orgUnitNameById`.
6. Filename and sheet name stay as today (`tang-members-YYYY-MM-DD.xlsx` / `Members`).
7. Loading and error presentation stay on the toolbar button / mutation as today.

New `vi.json` keys for modal title, select-all, deselect, confirm, and “chọn ít nhất một cột” (if needed for a11y; button disabled is the primary guard).

## Testing

Vitest only:

- `membersToExcelRows`: STT first; headers follow catalog order of selected ids; omitted ids absent; tang vs ni precept fields; formatted address; rank labels.
- Catalog filter by `sanghaType`; defaults are a subset of that catalog.
- Persistence helper with mocked `localStorage`: round-trip; strip unknown ids; empty → defaults.
- `MembersListPage` (or modal component): open modal on export click; confirm disabled when none selected; confirm calls export with selected ids.

No new Cypress spec.

## Out of scope follow-ups

- Nested-array sheets or flattened repeating rows
- Per-user cloud-saved column presets
- Matching Excel headers to the admin table column set one-for-one
