# Portrait Photo Delete Implementation Plan

> **For agentic workers:** Inline execution on current branch (`feat/admin-member-full-form`). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trash control on member/temple portraits that confirms, deletes the R2 object (invite or admin), and clears Firestore `photoPath`.

**Architecture:** Extend Worker `DELETE /api/photos/member|temple` to accept invite auth (same rules as upload). Client use-cases call the API then `setPhotoPath(id, null)`. Portrait fields show a trash overlay + confirm Modal.

**Tech Stack:** Cloudflare Worker, R2, Firestore, Mantine Modal/ActionIcon, lucide-react `Trash2`, Paraglide i18n, Vitest.

## Global Constraints

- Auth parity with upload: invite or admin; locked → admin only
- Confirm required before delete
- Pending-only clears local file (no API)
- Vitest only (no Cypress)
- Work on current branch; frequent commits OK when user asked to continue all the way

## File map

| File | Role |
|------|------|
| `src/worker/photosApi.ts` | Invite-aware DELETE handlers |
| `src/photos/photosApiClient.ts` | Optional `inviteToken` / `idToken` |
| `src/repositories/memberRepo.ts`, `templeRepo.ts`, `memoryStores.ts` | `setPhotoPath(..., string \| null)` |
| `src/use-cases/deleteMemberPhoto.ts`, `deleteTemplePhoto.ts` | Orchestrate API + clear path |
| `src/components/filler/MemberPortraitField.tsx`, `temple/TemplePortraitField.tsx` | Trash UI + confirm |
| `messages/vi.json` | Confirm / aria / error strings |

### Task 1: Worker DELETE invite auth

- [x] Failing tests for invite delete / locked / admin
- [x] Implement auth mirror of upload
- [x] Commit

### Task 2: Client API + clearPhotoPath + use-cases

- [x] Client delete with inviteToken
- [x] `setPhotoPath` accepts `null`
- [x] `deleteMemberPhoto` / `deleteTemplePhoto` use-cases + tests
- [x] Commit

### Task 3: Portrait UI + i18n

- [x] Messages + paraglide
- [x] Trash overlay + Modal on both portrait fields + tests
- [x] Commit
