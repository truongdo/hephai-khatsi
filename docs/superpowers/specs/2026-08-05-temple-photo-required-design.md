# Temple form: required photo

Date: 2026-08-05  
Status: approved for planning  
Depends on: `2026-07-25-temple-required-fields-design.md`, `2026-07-25-admin-temple-full-form-design.md`  
Surfaces: filler `TempleEditorForm` **Lưu** and admin `TempleFormPage` **Hoàn thành** (shared `validateTempleRequiredFields` + `TempleFormFields` / `TemplePortraitField`)

## Goal

Make **ảnh** (temple portrait) required on validated save for both filler and admin temple forms.

## Decisions

| Topic | Choice |
|-------|--------|
| Approach | Extend `validateTempleRequiredFields` with `hasPhoto`; UI `required` + field error on portrait |
| Scope | Both filler and admin (same validator) |
| Satisfied when | `photoPath` non-null **or** pending portrait `File` present |
| Create flow | Pending file is enough before save; upload after create stays as today |
| Admin Lưu nháp | Still skips required validation (unchanged) |
| Server / rules | Out of scope — client validation only |

## Non-goals

- Changing upload/delete photo APIs or R2 paths
- Requiring other temple fields beyond photo
- Firestore rules / server-side enforcement
- Cypress; Vitest only

## Validation design

Extend `TempleRequiredDraft` / `TempleRequiredFieldErrors` and `validateTempleRequiredFields`:

```ts
// additions (conceptual)
type TempleRequiredDraft = {
  // …existing…
  hasPhoto: boolean
}

type TempleRequiredFieldErrors = {
  // …existing…
  photo?: 'REQUIRED'
}

// in validateTempleRequiredFields:
if (!draft.hasPhoto) errors.photo = 'REQUIRED'
```

Call sites (`TempleEditorForm`, `TempleFormPage`) pass:

```ts
hasPhoto: !!(api.getPhotoPath() || api.getPendingPhoto())
```

Reuse existing i18n `filler_error_field_required` for the error message (same as other required fields).

## UI

- Mark portrait control as `required` (Mantine / label affordance consistent with other required fields).
- On failed validation, show field-level error under the portrait control via existing `setFieldErrors` / `TempleFormFields` error mapping.
- Clearing the pending file and deleting an uploaded photo must leave `hasPhoto` false so the next save blocks again.

## Testing

| Layer | Coverage |
|-------|----------|
| Unit | `validateTempleRequiredFields` — missing photo → `photo: 'REQUIRED'`; `hasPhoto: true` → no photo error |
| Component | Filler and/or admin form: save/complete blocked when no photo; succeeds when pending file or `photoPath` present (extend existing form tests) |

## Out of scope follow-ups

- Server-side “must have photoPath after lock” invariants
- Making photo required in list/export UX
