# Member form required fields (Tăng / Ni core)

Date: 2026-07-23  
Status: approved for planning  
Depends on: `2026-07-23-member-noi-sinh-xuat-gia-address-design.md`  
Branch: continue on `feat/member-noi-sinh-xuat-gia-address`

## Goal

On the filler member editor (`MemberEditorForm`), block **Lưu** until a defined set of core fields is filled, with Mantine `required` affordances and field-level error messages.

## Required fields

| Field | Rule |
|-------|------|
| Thế danh (`theDanh`) | trim ≠ empty |
| Pháp danh (`phapDanh`) | trim ≠ empty |
| Ngày sinh (`ngaySinh`) | non-empty date string |
| Nơi sinh (`noiSinh`) | `validateAddressDraft(..., { required: true })` |
| Điện thoại (`dienThoai`) | trim ≠ empty |
| Email (`email`) | trim ≠ empty **and** basic format (`local@domain.tld`) |
| Địa chỉ thường trú (`diaChiThuongTru`) | `validateAddressDraft(..., { required: true })` — **change from optional-when-blank** |
| Ngày xuất gia (`ngayXuatGia`) | non-empty date string |
| Nơi xuất gia (`noiXuatGia`) | `validateAddressDraft(..., { required: true })` (already) |
| Hiện tu học (`hienTuHoc`) | trim ≠ empty |
| Bổn sư (`bonSu`) | trim ≠ empty |

## Decisions

1. **Approach:** `validateMemberRequiredFields(draft)` helper + `required` on UI controls; save blocked when invalid.
2. **Email:** option B — non-empty + basic format (not RFC-exhaustive).
3. **Addresses:** all three use `{ required: true }` (city + ward; line optional).
4. **Phone:** non-empty only (no digit-format validation in this change).

## Non-goals

- Admin member form
- Making other member fields required (CCCD already create-only; CNTN stays optional; nguyên quán, phẩm vị, học vấn, chức vụ, khóa tu, gia đình, etc.)
- Strict phone / CCCD format rules beyond existing behavior
- Cypress; Vitest only
- Broader docx feedback items not listed above

## Validation design

```ts
type MemberFieldErrors = {
  theDanh?: string
  phapDanh?: string
  ngaySinh?: string
  noiSinh?: { city?: string; ward?: string }
  dienThoai?: string
  email?: string // required vs invalid format may share one message key or two
  diaChiThuongTru?: { city?: string; ward?: string }
  ngayXuatGia?: string
  noiXuatGia?: { city?: string; ward?: string }
  hienTuHoc?: string
  bonSu?: string
}

function validateMemberRequiredFields(draft: MemberDraft): {
  valid: boolean
  errors: MemberFieldErrors
}
```

- Place helper in a focused module next to the form (e.g. `memberRequiredValidation.ts`) or colocate if small — keep `MemberEditorForm` from growing more validation logic inline.
- Basic email check: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` (or equivalent simple pattern already used in repo if one exists — prefer reuse).
- i18n: generic required message (or per-field) + email invalid message; reuse `filler_address_city_required` / `filler_address_ward_required` for address slots.

## UI

- Set Mantine `required` on: Thế danh, Pháp danh, Ngày sinh, Điện thoại, Email, Ngày xuất gia, Hiện tu học, Bổn sư.
- Pass `required` to `VietnamAddressFields` for Nơi sinh, Nơi xuất gia, **and** Địa chỉ thường trú.
- Wire `error={...}` from validation state on each control.
- Clear field error when the user edits that field (optional polish; minimum: recompute all errors on next save attempt).

## Save flow

On Lưu (`status === 'draft'`):

1. Run `validateMemberRequiredFields(draft)`.
2. If invalid → set errors, return (do not call `saveMemberDraft`).
3. If valid → clear errors, mutate as today.

## Testing

- Vitest unit: helper — blank fails; email empty fails; email `not-an-email` fails; valid email + filled text/dates + complete addresses pass.
- Vitest + Testing Library: save with empty required fields does not call mock; shows at least one required error; invalid email shows format error.
- Update existing tests that previously saved without filling these fields (seed required values in happy-path tests).
- **No Cypress.**

## Implementation sketch

1. i18n messages for required / email invalid.
2. `validateMemberRequiredFields` + unit tests.
3. Wire UI `required` + errors + save gate in `MemberEditorForm`.
4. Update `MemberEditorForm.test.tsx` (including prior address-only required tests).
