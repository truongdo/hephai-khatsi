# Member form: DateInput + Giáo đoàn gốc select

Date: 2026-07-20  
Status: approved for planning  
Depends on: `2026-07-20-member-form-sublabels-placeholders-design.md`  
Branch: continue on `feat/member-form-sublabels-placeholders`

## Goal

1. Use Mantine date pickers for calendar date fields on the member editor.
2. Make **Giáo đoàn gốc** a select of existing giáo đoàn org units (not free text).

## Non-goals

- Month/year fields (từ/đến tháng năm) and year-only fields (năm tiến phong, năm sinh gia đình)
- Temple form date fields
- Migrating historical `giaoDoanGoc` free-text values that are not org unit ids
- Enforcing required dates

## Dates

- Add `@mantine/dates` (and dayjs if required by the package peer).
- Import dates CSS once next to existing Mantine CSS at the app root.
- Replace these `TextInput`s with `DateInput`:
  - `ngaySinh`
  - `cccdMeta.ngayCap`
  - `cntn.ngayCap`
  - `ngayXuatGia`
  - Precept `ngayGh`, `ngayHePhai` (`PreceptFields`)
- Storage remains **string** `yyyy-mm-dd` (empty string when cleared).
- `valueFormat="YYYY-MM-DD"`; clearable; keep existing labels/descriptions; drop `filler_ph_date` placeholders on these controls (picker UI replaces them).

## Giáo đoàn gốc

- `Select` backed by `fillerOrgUnitsQuery()` (same list as filler entry).
- Options: units with `kind === 'giao_doan'` only (exclude `ni_gioi`).
- Persist org unit **id** (`gd-i`, …); option label = `name` (e.g. `Giáo đoàn I`).
- Keep paper `description` (“I, II…”).
- Placeholder: reuse org select pattern (`Chọn…` / existing filler org placeholder).
- If loaded draft `giaoDoanGoc` is not a known id, show unselected (value `null`); do not invent migration options.

## Files (expected)

| File | Change |
|------|--------|
| `package.json` / lockfile | Add `@mantine/dates` (+ dayjs if needed) |
| App CSS entry (e.g. `__root` / main styles) | Import `@mantine/dates/styles.css` |
| `MemberEditorForm.tsx` | `DateInput`s + giáo đoàn `Select` + org query |
| `PreceptFields.tsx` | `DateInput` for the two ngày fields |
| Vitest | Assert date controls / giáo đoàn options render |

## Success criteria

- Calendar date fields open a date picker and save `yyyy-mm-dd`.
- Giáo đoàn gốc lists Firestore/seed giáo đoàn units by name and stores ids.
- Month/year and year-only fields unchanged.
- Existing member form tests still pass (update assertions as needed).
