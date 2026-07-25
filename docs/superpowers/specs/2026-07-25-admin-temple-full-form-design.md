# Admin temple full form + temple photo

Date: 2026-07-25  
Status: approved for planning  
Depends on: filler `TempleEditorForm` / sections, `templeDraft`, `validateTempleRequiredFields`, member photo R2 flow (`MemberPortraitField`, `/api/photos/member-upload-url`)

## Goal

1. Admin temple create (`/admin/temples/new`) and edit (`/admin/temples/$id`) show and edit the **same full field set** as the filler temple form (all sections).
2. Admin can save with two actions: **Lưu nháp** (no required validation) and **Hoàn thành** (same required validation as filler, then save). Neither action auto-locks the record.
3. Admin can edit fields (and upload photo) even when the temple is `locked`. Lock/Unlock remain separate controls (Unlock lets fillers edit again).
4. Add optional **temple photo** upload for both filler and admin, mirroring the member portrait flow (R2 presigned URL).

## Follow-up (out of this spec)

Admin member create/edit with the same dual-save + full-form pattern is a **separate** design/plan after this work ships. Do not implement member admin changes here.

## Decisions

| Topic | Choice |
|-------|--------|
| Shared UI | Extract shared field stack into `TempleFormFields`; thin wrappers for filler vs admin |
| Admin when locked | Fields stay editable; Lock/Unlock unchanged |
| Create route | Full form (same as edit), plus org-unit select |
| Lưu nháp | Persist via `saveAdminTemple` without `validateTempleRequiredFields` |
| Hoàn thành | Validate like filler → then `saveAdminTemple`; status stays `draft` unless already locked |
| Filler save UX | Unchanged: single **Lưu** with required validation |
| Temple photo | Optional; not part of required validation |
| Photo when locked | Admin may upload; filler view/locked stays non-editable (no upload) |
| Member admin | Out of scope |

## Architecture

```
Admin create/edit routes
  → TempleFormPage
      · org unit Select, invite meta, back link
      · Lưu nháp | Hoàn thành
      · Lock / Unlock (edit mode)
      → TempleFormFields (sections + draft + TemplePortraitField)
      → saveAdminTemple / uploadTemplePhoto

Filler routes
  → TempleEditorForm → FillerEditorShell + TempleFormFields
      → Lưu (validate) → saveTempleDraft / uploadTemplePhoto
```

- Shared: section components, `templeDraft` / `buildTemplePatch`, `validateTempleRequiredFields`, portrait field + upload use-case.
- Admin-only chrome stays in `TempleFormPage`.
- Backend save for admin continues to use `saveAdminTemple` + `TempleProfilePatch` (already accepts full profile patches).

## Components & files

| Unit | Responsibility |
|------|----------------|
| `TempleFormFields` | Draft state, all `Temple*Section`s, portrait wiring, `fieldErrors`; props for `initial`, `disabled`, photo callbacks, optional `inviteToken` |
| `TempleEditorForm` | Filler wrapper: shell, single validated Lưu, `saveTempleDraft`, pending photo after create |
| `TempleFormPage` | Admin chrome + dual save + Lock/Unlock; fields always enabled for admin (`disabled=false`) including when locked |
| `TemplePortraitField` | Mirror `MemberPortraitField` (JPEG/PNG, preview, pending file before id exists) |
| `uploadTemplePhoto` + photos client/worker | Presign `temples/{id}/photo.jpg`; admin Bearer or filler `inviteToken`; `templeRepo.setPhotoPath` |
| Domain | `Temple.photoPath: string \| null` (existing docs without field treat as `null`) |
| i18n | Labels for Lưu nháp / Hoàn thành; temple photo labels as needed; reuse member photo error copy where appropriate |

Suggested locations (adjust to match repo conventions during implementation):

- Shared fields: e.g. `tanstack-app/src/components/temple/TempleFormFields.tsx` or extract under `filler/` and import from admin
- Portrait: alongside member photo helpers (`TemplePortraitField`, `templePhotoUrl`, worker routes)

## Data flow

### Load (admin edit)

1. `templeQuery(id)` when claim is admin.
2. Hydrate draft via `emptyTempleDraft(temple)` and `photoPath`.
3. Org unit Select from loaded temple; disabled on edit (org unit immutable after create — same as today).

### Lưu nháp (admin)

1. Require org unit selected (create).
2. `buildTemplePatch(draft)` → `saveAdminTemple` (no required validation).
3. On create: navigate to `/admin/temples/$id`; if `pendingFile`, `uploadTemplePhoto` then clear pending.
4. Invalidate admin temple list/detail query keys.
5. Show success or mutation error.

### Hoàn thành (admin)

1. Run `validateTempleRequiredFields` (same rules as filler).
2. On invalid: set `fieldErrors`, do not write.
3. On valid: same persist path as Lưu nháp (including pending photo after create).
4. Do **not** call `lockTemple`.

### Filler Lưu

Unchanged: validate → `saveTempleDraft` → pending photo upload after create when applicable. Wire `TemplePortraitField` into the shared fields.

### Photo

- **Has temple id:** selecting a file uploads immediately and sets `photoPath` on the document.
- **No id yet:** keep `pendingFile` + object URL preview; upload after successful create (both Lưu nháp and Hoàn thành / filler Lưu).
- Accepted types: JPEG/PNG (same as member).
- Download URL: public CDN/base join helper analogous to `getMemberPhotoDownloadUrl`.

### Lock / Unlock

Existing mutations on `TempleFormPage`. Locking does not disable admin fields or admin photo upload. Filler `status === 'view'` remains disabled with no save.

## Photo API & auth

New endpoints (mirror member):

- `POST /api/photos/temple-upload-url` → `{ uploadUrl, photoPath }`
- `DELETE /api/photos/temple` (admin-only) for R2 cleanup parity with member portraits; wire into admin temple delete when that path already deletes member photos (or add a thin call if temples are deleted without object cleanup today).

Auth:

- **Admin:** Firebase Bearer admin token (same as member). Admin may upload when temple is locked.
- **Filler:** `inviteToken` required (no CCCD). Worker verifies the invite **document exists** for that token (global invite — do **not** require invite `orgUnitId` to match temple `orgUnitId`). Load temple by id; 404 if missing; 403 if temple `status === 'locked'`.
- R2 object key: `temples/{templeId}/photo.jpg` (same single-key convention as member).

Worker needs `getTempleDocument` and an invite-existence helper (or reuse/adapt invite fetch without org-unit matching) in Firestore REST helpers.

## Error handling

| Case | Behavior |
|------|----------|
| Hoàn thành / filler Lưu validation fail | Field errors; no DB write |
| Save mutation fail | Alert / error text; draft kept in UI |
| Invalid image type | Inline type error; no upload |
| Upload fail after successful create | Doc remains; show photo upload error; user can retry |
| Photo API 401/403/404 | Generic upload error message |

## Testing

Prefer Vitest + Testing Library; **no new Cypress**.

- `TempleFormPage`: renders full sections; Lưu nháp skips validation; Hoàn thành blocks when required missing; fields editable when locked; Lock/Unlock still work; photo pending/upload mocked.
- `TempleEditorForm`: validated Lưu still works; portrait pending → upload after create (mocked).
- `TemplePortraitField`, `uploadTemplePhoto`, worker temple upload-url: mirror member test coverage.
- Update existing admin form tests that assume the short field list.

## Non-goals

- Admin member full form / dual-save
- Changing filler to Lưu nháp / Hoàn thành
- Auto-lock on Hoàn thành
- Required temple photo
- Server-side required-field enforcement beyond existing draft write rules
- Broad unrelated refactors outside extracting `TempleFormFields` and adding temple photo plumbing

## Success criteria

- Admin create and edit show the same temple sections as filler (plus admin chrome).
- Lưu nháp persists incomplete data; Hoàn thành enforces filler required rules without locking.
- Admin can edit a locked temple’s fields and photo; fillers still cannot edit locked temples.
- Filler and admin can optionally upload a temple photo with the same UX pattern as member portraits.
- Existing filler required-field behavior remains intact.
)
