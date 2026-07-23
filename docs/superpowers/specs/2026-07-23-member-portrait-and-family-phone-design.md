# Member portrait photo + remove family phones

Date: 2026-07-23  
Status: approved for planning  
Branch: continue on `feat/member-noi-sinh-xuat-gia-address`  
Depends on: existing `uploadMemberPhoto`, `Member.photoPath`, filler `MemberEditorForm`

## Goal

1. Add optional **ảnh chân dung** (3×4) UI on the filler member editor, wired to Storage via `uploadMemberPhoto`.
2. Remove **Điện thoại** from Cha / Mẹ family blocks.

## Decisions

| Topic | Choice |
|-------|--------|
| Photo required on save? | **No** (optional) |
| Create without `memberId` | Allow file pick first; **auto-upload after successful create** |
| Approach | Reuse `uploadMemberPhoto` + local pending `File` |

## Non-goals

- Admin member photo UI
- Making photo required
- Cropping / compression tooling beyond accepting jpeg/png
- Migrating or deleting existing `giaDinh.cha.dienThoai` / `me.dienThoai` in Firestore
- Cypress

## 1. Portrait photo

### UI

- Place a ~3×4 portrait slot near the top of the member editor (above or beside the identity section header), labeled **Ảnh chân dung**.
- Empty state: dashed/box button to choose image.
- After pick: show local object-URL preview.
- After upload / when `initial.photoPath` exists: show Storage image (download URL from `photoPath`).
- `status === 'view'`: preview only, no file picker.
- Accept `image/jpeg`, `image/png` (and `image/jpg` if needed). Reject other types with i18n error.

### Upload flow

| State | Behavior |
|-------|----------|
| Has `memberId` + user picks file | Call `uploadMemberPhoto({ memberId, cccd, bytes, contentType, inviteToken: token })` immediately; update local `photoPath` on success |
| No `memberId` + user picks file | Keep `File` in component state; show preview; do not upload yet |
| Create save succeeds (`onCreated` / mutation `mode: 'created'`) | If pending `File` exists, upload with new `memberId`, then clear pending file; navigate/create callback only after upload attempt finishes (success or reported failure) |
| Upload fails | Show error message; **do not** roll back already-saved draft text fields |

### Display of existing photo

- Resolve `photoPath` → downloadable URL via Firebase Storage `getDownloadURL` (small helper or inline in the photo component).
- Cache URL in component state keyed by `photoPath`.

### Component shape

Prefer a focused `MemberPortraitField` (or similar) under `components/filler/` so `MemberEditorForm` stays thinner:

Props sketch: `memberId?`, `cccd`, `inviteToken`, `photoPath`, `disabled`, `onPhotoPathChange`, plus internal pending-file handling exposed via `takePendingFile()` / `clearPendingFile()` **or** parent holds pending file and passes `pendingFile` / `onPendingFileChange`.

Parent owns: pass pending file into create success handler for upload.

## 2. Remove family phones

- Remove `dienThoai` from Cha / Mẹ UI in `MemberEditorForm`.
- Remove from `FamilyPersonDraft` and `emptyFamilyPerson`.
- `buildFamilyPerson`: stop reading/writing `dienThoai` (omit on save).
- Domain type may keep optional `dienThoai` on family person for legacy reads; do not surface in filler UI.
- Update tests that assert family phone inputs if any.

## Testing

- Vitest: portrait component — pick file stores pending when no id; with id mocks `uploadMemberPhoto`.
- Vitest: `MemberEditorForm` — create with pending file calls upload after create (mock); family sections have no phone fields for cha/me.
- Prefer mocking `uploadMemberPhoto` at the use-case boundary.
- **No Cypress.**

## Implementation sketch

1. i18n labels/errors for portrait.
2. `MemberPortraitField` (+ download URL helper) + tests.
3. Wire into `MemberEditorForm` create success path.
4. Remove family phone fields + adjust build/draft + tests.
