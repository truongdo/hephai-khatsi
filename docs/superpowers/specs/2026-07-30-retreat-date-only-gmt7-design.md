# Retreat form — date-only fields (GMT+7)

## Goal

On admin retreat create and edit (`RetreatFormPage`), the four schedule fields accept **calendar dates only**. Stored ISO timestamps use fixed times in **GMT+7** (`+07:00`). Labels are prefixed with “Ngày”.

## Decisions

| Topic | Choice |
|-------|--------|
| Scope | Create and edit (shared `RetreatFormPage`) |
| UI control | Native `TextInput` with `type="date"` (keep Mantine; no DatePickerInput) |
| Timezone | Always GMT+7, independent of browser local timezone |
| Start-of-day fields | `thoiGianBatDau`, `dangKyMoTu` → `00:00:00+07:00` |
| End-of-day fields | `thoiGianKetThuc`, `dangKyDongLuc` → `23:59:59+07:00` |
| Persist shape | Unchanged: ISO-8601 UTC strings in Firestore / domain |
| Labels | Prefix existing Vietnamese copy with “Ngày” |

## Labels (`messages/vi.json`)

| Key | New value |
|-----|-----------|
| `admin_retreats_form_thoi_gian_bat_dau` | Ngày bắt đầu khóa tu |
| `admin_retreats_form_thoi_gian_ket_thuc` | Ngày kết thúc khóa tu |
| `admin_retreats_form_dang_ky_mo_tu` | Ngày mở đăng ký từ |
| `admin_retreats_form_dang_ky_dong_luc` | Ngày đóng đăng ký lúc |

## Conversion helpers

Replace `isoToLocalInput` / `localInputToIso` (datetime-local, browser TZ) with GMT+7 date helpers colocated with the form (or a tiny shared util if preferred for tests):

- `isoToGmt7Date(iso: string): string`  
  Empty/invalid → `''`. Otherwise return `YYYY-MM-DD` for that instant in GMT+7.

- `gmt7DateToIso(date: string, bound: 'start' | 'end'): string`  
  Empty/invalid → `''`.  
  - `start`: parse as `YYYY-MM-DDT00:00:00+07:00` → `Date.toISOString()`  
  - `end`: parse as `YYYY-MM-DDT23:59:59+07:00` → `Date.toISOString()`

Implementation must not use the browser’s local offset for constructing these walls (e.g. build via explicit `+07:00` offset string or fixed `+7` hour math).

### Examples

| UI date | Bound | Stored ISO (UTC) |
|---------|-------|------------------|
| `2026-08-01` | start | `2026-07-31T17:00:00.000Z` |
| `2026-08-10` | end | `2026-08-10T16:59:59.000Z` |

## UI wiring

| Field | Bound |
|-------|-------|
| `thoiGianBatDau` | start |
| `thoiGianKetThuc` | end |
| `dangKyMoTu` | start |
| `dangKyDongLuc` | end |

- Display: `value={isoToGmt7Date(fields.*)}`
- Change: `updateField(..., gmt7DateToIso(event.currentTarget.value, bound))`
- Keep `required` and existing validation (`validateRetreatFields` non-empty ISO strings).

## Edit / legacy data

Existing docs may have arbitrary times. On load, the date picker shows the **calendar date in GMT+7** of the stored instant. On save, times are normalized to start/end of that chosen GMT+7 day (intentional overwrite of prior clock time).

## Tests

- Unit tests for `isoToGmt7Date` / `gmt7DateToIso` (round-trip date part; fixed UTC examples above; empty/invalid).
- Update `RetreatFormPage` tests if they assert datetime-local values or old labels.

## Out of scope

- Migrating historical Firestore timestamps in bulk
- Changing domain validation beyond non-empty ISO
- Public/filler retreat UIs (if any) outside admin form
- Switching to Mantine DatePicker
