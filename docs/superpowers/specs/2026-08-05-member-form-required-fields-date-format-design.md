# Member form: required fields + date display + field descriptions

Date: 2026-08-05  
Status: approved for planning  
Depends on: `2026-07-23-member-required-core-fields-design.md`, `2026-07-20-member-form-sublabels-placeholders-design.md`, `2026-07-25-admin-member-full-form-design.md`  
Surfaces: filler `MemberEditorForm` **Lưu** and admin `MemberFormPage` **Hoàn thành** (shared `validateMemberRequiredFields` + `MemberFormFields`)

## Goal

1. Make **ảnh chân dung**, **toàn bộ thông tin cha/mẹ**, and **dòng địa chỉ Nơi xuất gia** required on validated save.
2. Show member-form `DateInput` values as **`dd-mm-yyyy`** (storage unchanged).
3. Update descriptions for **Ảnh chân dung**, **Hệ phái gốc**, and **Giáo đoàn gốc**.
4. For **Nơi xuất gia**, rename the address line label to **Tự viện/Tịnh xá, tổ/thôn** and require it. **Địa chỉ thường trú** stays as today (city/ward required; line optional; label unchanged).

## Decisions

| Topic | Choice |
|-------|--------|
| Approach | Extend `validateMemberRequiredFields` + UI `required` / errors / copy (same pattern as core required fields) |
| Địa chỉ thường trú | No change to label or validation |
| Nơi xuất gia line | New label + required; city/ward already required |
| Portrait | Required if neither `photoPath` nor pending `File` is present |
| Cha / mẹ | All four fields required for each: `hoTen`, `namSinh`, `ngheNghiep`, `noiO` |
| Anh chị em | Still optional (not in scope) |
| Date display | Only `DateInput` on member form (`MemberFormFields`, `PreceptFields`); `MonthPickerInput` stays `MM/YYYY` |
| Date storage | Keep ISO `YYYY-MM-DD` strings in draft/Firestore |
| Admin Lưu nháp | Still skips required validation |
| Temple / entry forms | Out of scope for date format and these required rules |

## Non-goals

- Requiring địa chỉ thường trú line
- Making Hệ phái gốc / Giáo đoàn gốc required
- Changing month/year pickers or non-member date inputs
- Firestore rules / server-side required enforcement
- Cypress; Vitest only

## Required-field additions

| Field | Rule |
|-------|------|
| Ảnh chân dung | `photoPath` non-null **or** pending portrait `File` present |
| Cha | `hoTen`, `namSinh`, `ngheNghiep`, `noiO` — each trim ≠ empty |
| Mẹ | same four fields |
| Nơi xuất gia → line | trim ≠ empty (in addition to existing city/ward) |

## Validation design

Extend `MemberRequiredDraft` / `MemberRequiredFieldErrors` and `validateMemberRequiredFields`:

```ts
// additions (conceptual)
type MemberRequiredDraft = {
  // …existing…
  photoPath: string | null
  pendingPhoto: File | null
  giaDinh: {
    cha: FamilyPersonDraft
    me: FamilyPersonDraft
  }
  // noiXuatGia already present
}

type MemberRequiredFieldErrors = {
  // …existing…
  photo?: 'REQUIRED'
  giaDinh?: {
    cha?: { hoTen?: 'REQUIRED'; namSinh?: 'REQUIRED'; ngheNghiep?: 'REQUIRED'; noiO?: 'REQUIRED' }
    me?: { hoTen?: 'REQUIRED'; namSinh?: 'REQUIRED'; ngheNghiep?: 'REQUIRED'; noiO?: 'REQUIRED' }
  }
  noiXuatGia?: { city?: 'REQUIRED'; ward?: 'REQUIRED'; line?: 'REQUIRED' }
}
```

Call sites (`MemberEditorForm.handleSave`, `MemberFormPage.complete`) pass `photoPath` / `pendingPhoto` from `fieldsApiRef` alongside draft fields.

### Address line required

Prefer extending `validateAddressDraft` with `lineRequired?: boolean` and `errors.line?: 'REQUIRED'`, used only for `noiXuatGia` in member validation. Do **not** set `lineRequired` for `diaChiThuongTru` or temple addresses.

Reuse `filler_error_field_required` (or a dedicated address-line key if mapping is clearer) for the line error message.

## UI

### `VietnamAddressFields`

- Add optional `lineLabel?: string` (default: `filler_field_address_line` = “Số nhà, tổ/thôn”).
- Add optional `lineRequired?: boolean` → Mantine `required` + `error` on the line `TextInput`.
- Extend `errors` with optional `line?: string`.
- **Nơi xuất gia:** `lineLabel={m.filler_field_noi_xuat_gia_line()}`, `lineRequired`, wire line error.
- **Địa chỉ thường trú:** unchanged props.

### Portrait

- Show required affordance (asterisk / `required` styling) and description under “Ảnh chân dung”.
- Surface `fieldErrors.photo` as red text near the control (same tone as other required errors).
- Description key `filler_desc_anh_chan_dung`:  
  `Ảnh chụp chính diện khuôn mặt (có thể chụp bằng điện thoại). Ảnh cần rõ nét, đủ sáng và nhìn rõ khuôn mặt`

### Cha / mẹ

- Mark all four inputs `required`; map nested errors to each control.

### Dates

- All member `DateInput` `valueFormat="DD-MM-YYYY"` in `MemberFormFields` and `PreceptFields`.
- `filler_ph_date` is shared with temple (`YYYY-MM-DD` examples) — **do not** change it. Add `filler_ph_date_dmy` = `vd: 15-01-2020` and use it on member `DateInput` placeholders only.
- Do not change draft parse/serialize (still `YYYY-MM-DD`).

### Copy updates (`messages/vi.json` + Paraglide)

| Key | New text |
|-----|----------|
| `filler_desc_anh_chan_dung` | (new) portrait guidance above |
| `filler_desc_he_phai_goc` | `Để trống nếu không chuyển Hệ phái. Trường hợp xuất gia ban đầu thuộc tông phái khác rồi chuyển sang Hệ phái Khất sĩ, vui lòng ghi tông phái trước khi chuyển "ví dụ: Bắc tông"` |
| `filler_desc_giao_doan_goc` | `Để trống nếu không chuyển Giáo đoàn. Nếu đã chuyển từ Giáo đoàn khác sang Giáo đoàn hiện tại, ghi Giáo đoàn trước khi chuyển "ví dụ: từ GĐ I sang GĐ IV thì ghi "GĐ I"` |
| `filler_field_noi_xuat_gia_line` | (new) `Tự viện/Tịnh xá, tổ/thôn` |
| `filler_ph_date_dmy` | (new) `vd: 15-01-2020` — member `DateInput` only |

## Files (expected)

| File | Change |
|------|--------|
| `memberRequiredValidation.ts` (+ test) | New required rules + address line |
| `domain/address.ts` (+ test if present) | Optional `lineRequired` / `line` error |
| `VietnamAddressFields.tsx` (+ test) | `lineLabel`, `lineRequired`, line error |
| `MemberFormFields.tsx` | Wire required UI, date format, descriptions, nơi xuất gia line label |
| `PreceptFields.tsx` | `DateInput` valueFormat |
| `MemberPortraitField.tsx` | Description + required/error props as needed |
| `MemberEditorForm.tsx` / `MemberFormPage.tsx` | Pass photo into validator |
| `messages/vi.json` | New/updated keys; regenerate Paraglide |
| Vitest | Validation + form assertions for new required / copy / date format |

## Success criteria

- Filler **Lưu** and admin **Hoàn thành** block save when portrait, any cha/mẹ field, or nơi xuất gia line is missing; show field errors.
- Admin **Lưu nháp** still saves without these checks.
- Nơi xuất gia line label reads “Tự viện/Tịnh xá, tổ/thôn”; thường trú line label unchanged and still optional.
- Member `DateInput`s display `dd-mm-yyyy`; stored values remain `YYYY-MM-DD`.
- Three description strings match the copy in this spec.
- Existing required core fields behavior unchanged aside from extensions above.
