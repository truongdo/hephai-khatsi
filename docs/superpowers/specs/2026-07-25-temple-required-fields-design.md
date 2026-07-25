# Temple form required fields

Date: 2026-07-25  
Status: approved for planning  
Depends on: `2026-07-20-filler-full-editors-design.md`, member required-fields pattern (`2026-07-23-member-required-core-fields-design.md`)

## Goal

On the filler temple editor (`TempleEditorForm`), block **Lưu** until a defined set of fields is filled, with Mantine `required` affordances and field-level error messages — same approach as the member form.

## Required fields

| Field / group | Rule |
|---------------|------|
| Danh hiệu (`danhHieu`) | trim ≠ empty |
| Người khai sơn (`nguoiKhaiSon`) | trim ≠ empty |
| Năm thành lập (`namThanhLap`) | trim ≠ empty |
| Địa chỉ cũ (`diaChiCu`) | `validateAddressDraft(..., { required: true })` — city + ward; line optional |
| Địa chỉ mới (`diaChiMoi`) | same as địa chỉ cũ |
| Trụ trì hiện nay — pháp danh | trim ≠ empty |
| Trụ trì hiện nay — điện thoại | trim ≠ empty (no digit-format rule) |
| Trụ trì hiện nay — email | trim ≠ empty **and** basic format (`local@domain.tld`) via shared `isBasicEmail` |
| Trụ trì tiền nhiệm | ≥ 1 row; each required row must have **pháp danh** trim ≠ empty; `thoiGian` / `ghiChu` optional |
| Tăng số — Tỳ kheo, Tỳ kheo ni, Sa di, Tập sự | each number field must be set; **`0` is valid**; empty (`''`) fails |
| Phật tử quy y / thường xuyên | same numeric rule as tăng số |

## Decisions

1. **Approach:** `validateTempleRequiredFields(draft)` helper + `required` on UI controls; save blocked when invalid. Mirror `memberRequiredValidation.ts`.
2. **Trụ trì:** option C — all three current-abbot fields **and** at least one tiền nhiệm row with pháp danh.
3. **Tăng số & Phật tử:** option A — all six counts required; zero allowed.
4. **Addresses:** change from optional-when-blank to `{ required: true }` for both cũ and mới.
5. **Email:** reuse `isBasicEmail` from member validation module (or extract shared helper if needed to avoid coupling — prefer import from existing module if already exported).
6. **Tiền nhiệm empty list:** if `truTriTienNhiem.length === 0`, treat as invalid (section-level or first-row error). Implementation may auto-ensure one empty row in draft UI later; validation must still fail until pháp danh is filled.

## Non-goals

- Admin temple form
- Making other temple sections required (ban quản trị, hoạt động, quyết định, xây dựng, đất, manager phone)
- Strict phone format for trụ trì
- Requiring `thoiGian` / `ghiChu` on tiền nhiệm rows
- Firestore rules / server-side required checks
- Cypress; Vitest only

## Validation design

```ts
type TempleRequiredFieldErrors = {
  danhHieu?: 'REQUIRED'
  nguoiKhaiSon?: 'REQUIRED'
  namThanhLap?: 'REQUIRED'
  diaChiCu?: { city?: 'REQUIRED'; ward?: 'REQUIRED' }
  diaChiMoi?: { city?: 'REQUIRED'; ward?: 'REQUIRED' }
  truTriHienNay?: {
    phapDanh?: 'REQUIRED'
    dienThoai?: 'REQUIRED'
    email?: 'REQUIRED' | 'INVALID'
  }
  truTriTienNhiem?: 'REQUIRED' | Array<{ phapDanh?: 'REQUIRED' } | undefined>
  tangSoHienTru?: {
    tyKheo?: 'REQUIRED'
    tyKheoNi?: 'REQUIRED'
    saDi?: 'REQUIRED'
    tapSu?: 'REQUIRED'
  }
  soPhatTuQuyY?: 'REQUIRED'
  soPhatTuThuongXuyen?: 'REQUIRED'
}

function validateTempleRequiredFields(draft: TempleRequiredDraft): {
  valid: boolean
  errors: TempleRequiredFieldErrors
}
```

- Module: `tanstack-app/src/components/filler/templeRequiredValidation.ts` (+ colocated unit test).
- Numeric required: value is `number` (including `0`) → ok; `''` → `REQUIRED`.
- Map codes to existing i18n: `filler_error_field_required`, `filler_error_email_invalid`, `filler_address_city_required`, `filler_address_ward_required`. Add a short message for missing tiền nhiệm list only if section-level UX needs it (e.g. `filler_error_tru_tri_tien_nhiem_required`); otherwise show required on the first row’s pháp danh after ensuring one row exists in the UI.

## UI

- Set Mantine `required` on: danh hiệu, người khai sơn, năm thành lập; trụ trì hiện nay (pháp danh, phone, email); all six tăng số / Phật tử number inputs; pháp danh on tiền nhiệm rows.
- Pass `required` to `VietnamAddressFields` for địa chỉ cũ and địa chỉ mới.
- Wire `error={...}` from validation state.
- Minimum error UX: recompute all errors on each save attempt (same as member).

## Save flow

On Lưu (`status === 'draft'`):

1. Run `validateTempleRequiredFields(draft)`.
2. If invalid → set field errors (including address errors), return (do not call `saveTempleDraft`).
3. If valid → clear errors, mutate as today.

Replace today’s address-only gate in `TempleEditorForm.handleSave` with the full helper (addresses stay inside the helper with `{ required: true }`).

## Testing

- Vitest unit: blank fails; email empty/invalid fails; empty tăng số fails; `0` counts pass; zero tiền nhiệm rows fail; one row with pháp danh + filled required fields pass.
- Vitest + Testing Library: save with empty required fields does not call mock; shows required errors; happy-path tests seed required values.
- **No Cypress.**

## Implementation sketch

1. `templeRequiredValidation.ts` + unit tests.
2. Wire UI `required` + errors + save gate in `TempleEditorForm` / `TempleEditorFormSections`.
3. Update `TempleEditorForm.test.tsx` happy paths to seed required fields.
4. i18n only if a new tiền-nhiệm-empty message is needed.
