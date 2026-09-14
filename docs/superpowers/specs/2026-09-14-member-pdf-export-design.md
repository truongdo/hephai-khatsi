# Member profile PDF export

**Date:** 2026-09-14  
**Routes:** `/admin/members/$id`, `/admin/members/tang`, `/admin/members/ni`  
**Primary files:** `tanstack-app/src/domain/exportMemberPdf.ts` (new), `tanstack-app/src/use-cases/exportMembersPdf.ts` (new), `tanstack-app/src/components/admin/MemberFormPage.tsx`, `tanstack-app/src/components/admin/MembersListPage.tsx`

## Goal

Let an **admin** download a printable **full member profile PDF** (all form fields + portrait) from the detail page, and from the members list export **selected rows** (default) or **all members matching the current list filters**, as either **one merged PDF** or a **ZIP of per-member PDFs plus original attached documents**.

## Non-goals

- Filler / invite-token export
- Column or section picker (unlike Excel)
- Embedding document scans inside the PDF (images or attached PDFs)
- Server-side PDF generation (Worker Browser Rendering, paid HTML→PDF APIs)
- `window.print` / browser “Save as PDF” as the primary path
- Changing Excel export, list pagination, or bulk delete
- Cypress E2E for this flow
- Exporting temples or other collections

## Decisions

| Topic | Choice |
|-------|--------|
| Who | Admin only |
| Content | Full admin form field set + portrait; empty fields show “—” |
| Detail page | One PDF immediately (no format modal) |
| List source | Selected ids by default; modal also offers **Xuất tất cả theo bộ lọc hiện tại** |
| List format | User chooses **one PDF** or **ZIP** |
| ZIP extras | Original R2 files from `member.documents` (not inlined in PDF) |
| Merged PDF extras | Form + portrait only — no document files |
| PDF library | `@react-pdf/renderer` in the browser |
| ZIP | `jszip` in the browser |
| Ha-lạp | “All by filter” uses the **active ha-lạp tab** plus org unit / status / sangha type (unlike Excel, which ignores the tab) |

## Architecture

```
Admin UI (detail | list modal)
  → use-case: load Member[] + fetch portrait/document blobs
  → domain: Member → PDF view-model (labels, dates, addresses)
  → @react-pdf/renderer Document → Blob
  → download .pdf  |  JSZip → .zip
```

Units:

1. **View-model + filename helpers** (`domain/`): pure mapping, no SDK, no React-PDF.
2. **PDF document components** (`components/admin/pdf/` or `domain/pdf/` UI): `@react-pdf/renderer` `Document` / `Page` / `View` / `Text` / `Image`. One member = one or more A4 pages; merged export concatenates members with a page break between them.
3. **Use-case** (`exportMembersPdf`): resolve members, fetch binaries, call `pdf().toBlob()`, optional zip, trigger download. Inject stores/fetch for tests.
4. **UI:** detail button; list button + Mantine modal (source + format).

Firestore stays behind `memberRepo`. Do not call `getDoc` from components.

## Entry points

### Detail (`MemberFormPage`, edit mode only)

Add **Xuất PDF** next to existing header/sticky actions (subtle/default variant, not competing with Lưu / Hoàn thành).

- Disabled on create (`mode !== 'edit'`) — no saved id / incomplete record.
- Uses the loaded `memberQuery` document (no extra list scan).
- Loading while generating; errors as existing `role="alert"` text.
- Filename: `HoSo_<slug>_<id>.pdf` where `slug` is sanitized pháp danh, else thế danh, else `member`.

### List (`MembersListPage`)

Add **Xuất PDF** beside **Xuất Excel**.

Opening the modal:

- Always opens a small Mantine modal (does not start generation until confirm).
- **Nguồn:** radio/segmented
  - **Các dòng đang chọn** — default when `selectedCount > 0`; disabled with helper text when none selected.
  - **Tất cả theo bộ lọc hiện tại** — default when nothing is selected.
- **Định dạng:**
  - **Một file PDF**
  - **ZIP (mỗi hồ sơ một PDF + giấy tờ đính kèm)**

Confirm runs the mutation. Progress text while running: `Đang tạo {done}/{total}…` (member index, not byte progress). Cancel is **out of v1** (close modal only after finish or error).

Empty result after “all by filter” (zero members on that tab/filters): no download; alert “Không có hồ sơ để xuất”.

## Current-filter definition (list “all”)

Same sangha route (`tang` / `ni`) and the list page’s current:

- `orgUnitId` (if selected)
- `status` (if selected)
- **active ha-lạp tab** (`haLapTabRank`)

Implementation: paginate `memberRepo.listByHaLapTab` (or extend `listAllForExport` with optional `haLapTabRank`) until `nextCursor` is null. Do **not** reuse Excel’s unfiltered `listAllForExport` unless it is extended to honor the tab — Excel behavior stays unchanged.

**Selected rows:** use selected ids. Prefer full `Member` objects already in the loaded list pages; `getById` only for ids not in memory (should be rare with current full-document list rows).

## PDF content

Page: A4, portrait. Vietnamese labels via existing Paraglide keys (`filler_field_*`, `filler_section_*`, rank labels). Dates: same `DD-MM-YYYY` as table/Excel. Addresses: `formatAddressDisplay`.

**Header (every member, first page):** pháp danh, thế danh, Tăng/Ni, org unit name, status (`draft` / `locked`). Portrait top-right if fetch succeeds (~3cm). Missing photo: omit image, keep layout.

**Sections (same order as `MemberFormFields`):** identity (including CCCD/CNTN fields in that section), contact, xuất gia, giới (precepts by sangha type), phẩm vị / giáo phẩm, học vấn, chức vụ (hệ phái, GHPGVN, đoàn thể), khóa tu, gia đình, nguyện vọng.

**Giấy tờ section on PDF:** list each document type that has at least one stored path as “Đã đính kèm” (or side labels mặt trước/sau). Do not rasterize files into the PDF. Types with no files: “—”.

**Repeatable rows** (`chucVu*`, `khoaTu`, `anhChiEm`): one block per row; empty arrays → “—”.

**Omit from PDF (internal / not form fields):** `id` as a labeled field (id may appear only in filename), `inviteId`, `photoPath`, raw document paths, `directoryAuthUid`, `directoryRoleGrantedAt` / `GrantedBy`, `lockedBy`, `editRequestedBy`, `giaoPhamHePhaiRankOrder`, `haLapTabRank`, `sapXepHaLap`. Do not print directory-role grant controls.

Field empty / missing: label + “—”. Do not drop entire sections except sangha-specific precept/rank fields that the form already hides.

**Fonts:** embed subsets of the app UI fonts already in the project (`@fontsource/be-vietnam-pro` and/or Noto) registered with `@react-pdf/renderer`. Do not rely on Helvetica for body Vietnamese text.

## ZIP layout

```
HoSoMembers_<yyyy-mm-dd>.zip
  <slug>_<id>/HoSo.pdf
  <slug>_<id>/documents/<typeId>_<side>.<ext>
```

`<ext>` taken from the object key or `Content-Type`. Skip missing fetches; continue the zip.

Merged single-PDF download name: `HoSoMembers_<yyyy-mm-dd>.pdf` (list) or the per-member name (detail).

## Data flow & errors

1. Resolve `Member[]` in stable order (list sort / selection iteration order).
2. For each member, fetch portrait via `getMemberPhotoDownloadUrl` → blob → data URL or `Uint8Array` for `<Image>`.
3. Render PDF blob(s). Concurrency: sequential or a small pool (max 3) so large batches do not freeze the tab.
4. ZIP mode: additionally `getMemberDocumentDownloadUrl` for each stored path; `pathsFromTypeFiles`.
5. `URL.createObjectURL` + `<a download>`; revoke URL after click.

| Situation | Behavior |
|-----------|----------|
| Photo fetch fails | PDF without image; continue |
| Document fetch fails | ZIP without that file; after finish, warning listing count of failed files |
| `@react-pdf` throw | Mutation error; no partial download |
| `VITE_PHOTOS_PUBLIC_BASE` missing | Same as rest of app (throw / surfaced error) |
| CORS on public photo/doc URLs | Must work from the admin origin (same public CDN as the form). If a file cannot be read as blob, treat as fetch fail above |

## Testing

**Vitest (domain):** view-model empty → “—”; date/address formatting; filename slug (unsafe characters stripped); merged vs zip **does not** attach documents to the merged PDF path; ZIP folder names.

**Vitest (use-case):** mock `memberRepo` + `fetch`; one member PDF download; two members ZIP contains two `HoSo.pdf` and mocked doc bytes; photo failure still produces PDF.

**Vitest + Testing Library:** detail page shows **Xuất PDF** in edit mode; list modal defaults to selected vs all-by-filter; confirm disabled when selected source chosen with zero selection.

**No Cypress** for this feature.

## Dependencies

Add `tanstack-app` dependencies: `@react-pdf/renderer`, `jszip`. No new Firebase collections or security-rule changes (reads already allowed for admin; files are public CDN paths the UI already uses).
