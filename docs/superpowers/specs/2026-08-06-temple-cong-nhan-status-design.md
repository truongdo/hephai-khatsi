# Temple recognition status (Quyết định)

Date: 2026-08-06  
Status: approved for planning  
Depends on: `2026-07-20-filler-full-editors-design.md`, `2026-07-25-temple-required-fields-design.md`

## Goal

In the temple form **Quyết định** section, add a required radio asking whether the tự viện / tịnh xá has been officially recognized.

## Field

| UI | Storage |
|----|---------|
| Label: `Tự viện / Tịnh xá đã được công nhận chưa?` | `qdCongNhan.trangThai` |
| Options: `Chính thức` / `Chưa công nhận` | `'chinh_thuc'` / `'chua_cong_nhan'` |
| Required | empty (`''` in draft / missing on existing docs) fails validation |

## Decisions

1. **Shape:** Nest under existing `qdCongNhan` as `trangThai` (not a top-level field, not a boolean).
2. **QD số / ngày:** Remain optional regardless of radio value (user chose option A).
3. **Surfaces:** Same field on filler and admin temple forms (shared `TempleQuyetDinhSection` / draft / validation).
4. **Legacy records:** Missing `trangThai` → draft empty → user must choose before save/lock succeeds.
5. **Tests:** Vitest only (validation + section/form coverage). No Cypress.

## Data model

```ts
// Temple / TempleProfilePatch
qdCongNhan?: {
  trangThai?: 'chinh_thuc' | 'chua_cong_nhan'
  so?: string
  ngay?: string
}

// TempleDraft
qdCongNhan: {
  trangThai: 'chinh_thuc' | 'chua_cong_nhan' | ''
  so: string
  ngay: string
}
```

- `emptyTempleDraft`: hydrate `trangThai` from temple or `''`.
- `buildTemplePatch`: omit / leave undefined when draft `trangThai` is `''`; otherwise pass the enum value.

## Validation

Extend `TempleRequiredDraft` / `TempleRequiredFieldErrors` / `validateTempleRequiredFields`:

- `qdCongNhanTrangThai?: 'REQUIRED'` when `trangThai` is not one of the two allowed values.
- Block save (filler + admin) the same way other required temple fields do.
- Do **not** require `qdCongNhan.so` / `qdCongNhan.ngay` when status is `chinh_thuc`.

## UI

In `TempleQuyetDinhSection`:

1. Place `Radio.Group` **above** the existing QĐ công nhận / bổ nhiệm text inputs.
2. Mantine `Radio.Group` + two `Radio` options; `withAsterisk`; wire `error` from required validation.
3. Paraglide messages (VI) for label and both option labels; reuse existing `filler_error_field_required` for the error string.

## Non-goals

- Conditional required rules for QĐ số/ngày
- Hiding or clearing số/ngày when status is `chua_cong_nhan`
- List/filter/export columns for this field
- Firestore security-rule changes (client validation only, consistent with other temple required fields)
- Cypress E2E

## Files (expected touch list)

- `tanstack-app/src/domain/types.ts` — `Temple.qdCongNhan`
- `tanstack-app/src/components/filler/templeDraft.ts` (+ tests)
- `tanstack-app/src/components/filler/templeRequiredValidation.ts` (+ tests)
- `tanstack-app/src/components/filler/TempleEditorFormSections.tsx` — `TempleQuyetDinhSection`
- `tanstack-app/src/components/temple/TempleFormFields.tsx` — pass errors/props if needed
- `tanstack-app/messages/vi.json` — new message keys
- Related Vitest files for draft / validation / editor form
