# Member form: required giáo phẩm ranks

Date: 2026-08-05  
Status: implemented on current branch  
Depends on: `2026-07-23-member-required-core-fields-design.md`, `2026-08-05-member-giao-pham-ranks-design.md`, `2026-08-05-member-form-required-fields-date-format-design.md`  
Surfaces: filler `MemberEditorForm` **Lưu** and admin `MemberFormPage` **Hoàn thành** (shared `validateMemberRequiredFields` + `MemberFormFields`)

## Goal

Make **Giáo phẩm Giáo hội** and **Giáo phẩm Hệ phái** rank selects required on validated save for both filler and admin member forms.

## Decisions

| Topic | Choice |
|-------|--------|
| Approach | Extend `validateMemberRequiredFields` + UI `required` / field errors on both rank `Select`s |
| What is required | Only `rank` on `giaoPhamGiaoHoi` and `giaoPhamHePhai` (non-empty after trim) |
| Năm tiến phong | Still optional when shown (unchanged from ranks design) |
| Clearable | Remove `clearable` on both rank selects so required state is clear |
| Admin Lưu nháp | Still skips required validation (unchanged) |
| Server / rules | Out of scope — client validation only |

## Non-goals

- Requiring `namTienPhong`
- Changing rank option lists or Năm tiến phong visibility
- Firestore rules / server-side enforcement
- Cypress; Vitest only

## Validation design

Extend `MemberRequiredDraft` / `MemberRequiredFieldErrors` and `validateMemberRequiredFields`:

```ts
// additions (conceptual)
type MemberRequiredDraft = {
  // …existing…
  giaoPhamGiaoHoi: { rank: string }
  giaoPhamHePhai: { rank: string }
}

type MemberRequiredFieldErrors = {
  // …existing…
  giaoPhamGiaoHoi?: { rank?: 'REQUIRED' }
  giaoPhamHePhai?: { rank?: 'REQUIRED' }
}

// in validateMemberRequiredFields:
if (!draft.giaoPhamGiaoHoi.rank.trim()) {
  errors.giaoPhamGiaoHoi = { rank: 'REQUIRED' }
}
if (!draft.giaoPhamHePhai.rank.trim()) {
  errors.giaoPhamHePhai = { rank: 'REQUIRED' }
}
```

Call sites (`MemberEditorForm`, `MemberFormPage`) pass the existing draft ranks into the validator payload.

Reuse `m.filler_error_field_required()` for error text (no new i18n keys).

## UI

- Both rank `Select`s: `required`, map `error` from `fieldErrors.giaoPhamGiaoHoi?.rank` / `fieldErrors.giaoPhamHePhai?.rank`.
- Drop `clearable` on those selects.
- Fieldset legends stay as today (`filler_field_gp_giao_hoi` / `filler_field_gp_he_phai`).

## Testing

| Layer | Coverage |
|-------|----------|
| Unit | `validateMemberRequiredFields` — missing either/both ranks → corresponding `rank: 'REQUIRED'`; both ranks set → no giáo phẩm errors |
| Component | Prefer extending unit tests; form-level only if existing member form tests already assert required blocks |

## Out of scope follow-ups

- Server-side invariants that member docs must have both giáo phẩm ranks after lock
