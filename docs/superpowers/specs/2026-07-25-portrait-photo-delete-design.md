# Portrait photo delete (trash control)

Date: 2026-07-25  
Status: approved for planning  
Depends on: `2026-07-25-r2-member-photos-design.md` (and temple photo upload already in app)

## Goal

Let fillers (invite) and admins remove a portrait from the member/temple form: trash control on the preview, confirm dialog, then delete the R2 object and clear Firestore `photoPath`.

## Decisions

| Topic | Choice |
|-------|--------|
| Who can delete | Same as upload: invite filler **or** admin bearer; locked records → admin only |
| Confirm | Required (“Xóa ảnh?”) before delete |
| Storage | Hard-delete R2 object; set `photoPath` to `null` in Firestore |
| Pending-only file | Trash clears local `pendingFile` only (no API) |
| UI | Trash `ActionIcon` overlay on portrait when a photo is shown and field is not disabled |
| Scope | Member **and** temple portraits (same pattern on both portrait fields) |

## Non-goals

- Soft-delete / orphan R2 objects on purpose
- Separate filler-only delete route
- Changing upload or public URL base behavior
- Cypress e2e for this control (Vitest + Worker unit tests)
- Making portrait required/optional validation changes

## Behavior

### When a photo is shown and the field is editable

1. User sees a trash icon on the portrait (top-right overlay).
2. Tap trash → Mantine confirm (`modals.openConfirmModal` or equivalent already used in admin) with copy: confirm remove photo.
3. On confirm:
   - **Pending file only** (no saved `memberId`/`templeId` upload yet): clear `pendingFile` / local object URL; done.
   - **Uploaded photo** (`photoPath` set and id present): call delete use-case → Worker deletes R2 key → clear `photoPath` in Firestore → UI clears preview (`onPhotoPathChange(null)` / clear pending).
4. On failure: show error via existing `onUploadError` (or a dedicated delete error message); keep current photo.

### Locked records

Same as upload: filler cannot delete; admin can (Bearer with `admin: true`). Trash hidden when `disabled` (locked filler view).

## API changes

Extend existing:

- `DELETE /api/photos/member`
- `DELETE /api/photos/temple`

**Auth (one of), mirroring upload:**

1. **Filler:** `inviteToken` in JSON body; Worker validates invite (member: orgUnit match; temple: invite exists) and rejects if record `status === 'locked'`.
2. **Admin:** `Authorization: Bearer <Firebase ID token>` with `admin: true`.

**Body:**

- Member: `{ memberId, inviteToken? }` (plus optional `cccd` if we want parity with upload ownership checks — **include `cccd` for member filler deletes**, same mismatch guard as upload).
- Temple: `{ templeId, inviteToken? }`

**Success:** `{ ok: true }` after R2 delete (idempotent if object already missing).

Client `deleteMemberPhotoObject` / `deleteTemplePhotoObject` gain optional `inviteToken` (admin still passes `idToken`).

## Domain / Firestore

- Extend `setPhotoPath` (or add `clearPhotoPath`) so stores can persist `photoPath: null` and bump `updatedAt`.
- Use-case `deleteMemberPhoto` / `deleteTemplePhoto`: auth via photos API client → clear path in repo.
- Reuse from portrait fields; admin bulk-delete of members/temples keeps calling object delete as today (admin token).

## UI

- `MemberPortraitField` / `TemplePortraitField`: overlay trash when `hasPhoto && !disabled`.
- i18n (Paraglide / `messages/vi.json`): confirm title/body, trash aria-label, delete error string.
- Confirm before any destructive action.

## Testing

- Worker: filler invite delete allowed; locked + invite → 403; admin allowed on locked; missing auth → 401.
- Client use-case / portrait field: confirm → delete → `photoPath` null; pending-only clears without fetch; error path keeps photo.
- No new Cypress spec.

## Out of scope follow-ups

- CDN purge for public URL (cache-bust query already handles display after re-upload; after delete, empty preview is enough).
