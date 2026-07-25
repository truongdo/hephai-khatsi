# Admin member full form

Date: 2026-07-25  
Status: approved for planning  
Depends on: filler `MemberEditorForm`, `validateMemberRequiredFields`, member photo R2 flow, admin temple full-form pattern (`2026-07-25-admin-temple-full-form-design.md`)

## Goal

1. Admin member create (`/admin/members/new`) and edit (`/admin/members/$id`) show and edit the **same full field set** as the filler member form.
2. Admin can save with **Lưu nháp** (no required-field validation) and **Hoàn thành** (same `validateMemberRequiredFields` as filler, then save). Neither action auto-locks.
3. Admin can edit fields and upload portrait even when the member is `locked`. Lock/Unlock remain separate.
4. Reuse existing member photo plumbing; thread admin `idToken` and allow locked uploads for admin (today `uploadMemberPhoto` / `setPhotoPath` reject locked for everyone).

## Decisions

| Topic | Choice |
|-------|--------|
| Shared UI | Extract `MemberFormFields` from `MemberEditorForm`; thin filler + admin wrappers |
| Admin when locked | Fields stay editable; Lock/Unlock unchanged |
| Create route | Full form + org unit + sangha type + CCCD (create); org/sangha/CCCD immutable on edit |
| Lưu nháp | `saveAdminMember` without `validateMemberRequiredFields` |
| Hoàn thành | Validate like filler → `saveAdminMember`; status stays `draft` unless already locked |
| Filler save UX | Unchanged: single **Lưu** with required validation |
| Photo | Optional; existing `MemberPortraitField` + R2; admin may upload when locked |
| UI chrome | Wrap admin form body in `Paper` on parchment (same as admin temple) |
| i18n | Reuse `admin_temples_save_draft` / `admin_temples_complete` **or** add `admin_members_save_draft` / `admin_members_complete` with same Vietnamese copy — prefer member-specific keys for clarity |

## Architecture

```
Admin create/edit
  → MemberFormPage (Paper; org unit; sangha; CCCD on create; invite meta; dual save; Lock/Unlock)
      → MemberFormFields (draft + sections + MemberPortraitField)
      → saveAdminMember / uploadMemberPhoto

Filler
  → MemberEditorForm → FillerEditorShell + MemberFormFields
      → Lưu (validate) → saveMemberDraft / uploadMemberPhoto
```

## Backend changes (required)

Admin updates currently go through `memberRepo.updateDraftById`, which throws `RECORD_LOCKED`. Photo path:

1. Add `allowWhenLocked?: boolean` to `updateDraftById` (and memory store). When true and locked: allow write; **preserve** `status` / `lockedAt` / `lockedBy`.
2. `saveAdminMember` update path passes `allowWhenLocked: true`.
3. `setPhotoPath`: do not reject locked when caller is admin path — either always allow (worker still gates filler) or accept `allowWhenLocked` / skip lock check like temple `setPhotoPath`.
4. `uploadMemberPhoto`: if locked and no `idToken` → `RECORD_LOCKED`; if `idToken` present → allow (mirror temple). Thread `idToken` through client storage → `requestMemberPhotoUploadUrl` Bearer.
5. Worker `handleMemberUploadUrl`: admin Bearer may upload when member is locked (today rejects locked for everyone before auth completes usefully — align with temple: after load, if locked and not admin → 403).
6. Firestore `members` `allow update`: admin non-lock-transition branch must allow locked records when `lockFieldsUnchanged()` (same change already done for temples). Keep `inviteId` equality checks that members rules already require for admin.

## Components & files

| Unit | Responsibility |
|------|----------------|
| `MemberFormFields` | Draft state, all member sections from editor, portrait, `fieldErrors`; `apiRef` pattern (not forwardRef) |
| `MemberEditorForm` | Thin filler wrapper: shell, validated Lưu, pending photo after create |
| `MemberFormPage` | Admin chrome + dual save + Lock/Unlock; `disabled={false}`; Paper wrapper |
| `memberDraft` helpers | Prefer extracting `emptyMemberDraft` / `buildPatch` from `MemberEditorForm.tsx` into `memberDraft.ts` if that keeps the extract readable (same spirit as `templeDraft.ts`) |

## Data flow

### Load (admin edit)

`memberQuery(id)` → hydrate `MemberFormFields` via draft helper + `photoPath`. Org unit / sangha / CCCD shown read-only (or disabled selects) on edit.

### Lưu nháp (admin)

1. Create: require org unit, sangha type, valid CCCD (existing `normalizeCccd` / create rules — **not** waived).
2. Build patch → `saveAdminMember` (no `validateMemberRequiredFields`).
3. Create: navigate to `/$id`; upload pending photo with `idToken` if any.
4. Invalidate admin member list/detail keys.

### Hoàn thành (admin)

1. `validateMemberRequiredFields` (same fields as filler).
2. On invalid: field errors; no write.
3. On valid: same persist path as Lưu nháp; **do not** call `lockMember`.

### Photo

- Has `memberId`: immediate upload via `uploadMemberPhoto` (+ `getIdToken` for admin, `inviteToken` for filler).
- No id yet: pending file; upload after create.
- Admin locked: upload allowed; filler view/locked: disabled.

### Lock / Unlock

Existing mutations. Locking does not disable admin fields or admin photo upload.

## Error handling

| Case | Behavior |
|------|----------|
| Hoàn thành / filler Lưu validation fail | Field errors; no DB write |
| Save mutation fail | Alert / error text |
| Invalid image / upload fail | Existing filler photo messages; wire `onUploadError` |
| Create without CCCD / invalid CCCD | Domain / form error (Lưu nháp still blocked) |

## Testing

Vitest + Testing Library; **no new Cypress**.

- `MemberFormPage`: full sections; Lưu nháp skips required validation (with CCCD); Hoàn thành blocks when required missing; editable when locked; both save buttons when locked; Lock/Unlock; photo pending + `idToken` after create; `lockMember` not called on Hoàn thành.
- `MemberEditorForm`: existing required + photo tests stay green after extract.
- Repo / rules / `uploadMemberPhoto` locked-admin cases.

## Non-goals

- Changing filler to dual-button Lưu nháp / Hoàn thành
- Auto-lock on Hoàn thành
- Required portrait
- Admin temple changes (already shipped)
- Server-side required-field enforcement beyond existing draft rules

## Success criteria

- Admin create/edit show the same member sections as filler (plus admin chrome in Paper).
- Lưu nháp persists incomplete profile data (given CCCD/org/sangha on create); Hoàn thành enforces filler required rules without locking.
- Admin can edit a locked member’s fields and photo; fillers still cannot.
- Filler single validated Lưu remains intact.

## Spec self-review notes

- No TBD placeholders.
- CCCD remains a create identity key — explicitly **not** part of “skip required validation” for Lưu nháp.
- Photo already exists; scope is unlock-for-admin + wiring, not a new R2 product.
)
