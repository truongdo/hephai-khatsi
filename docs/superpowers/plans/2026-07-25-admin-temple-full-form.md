# Admin Temple Full Form + Photo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin temple create/edit uses the full filler field set with **Lưu nháp** / **Hoàn thành**, remains editable when locked, and both filler and admin support optional temple photo upload via R2 (mirror member portraits).

**Architecture:** Extend `templeRepo` + Firestore rules so admin can update locked temples without unlocking. Extract `TempleFormFields` (shared sections + draft + portrait). Admin `TempleFormPage` dual-saves via `saveAdminTemple`; filler keeps single validated Lưu. New temple photo worker/client/`uploadTemplePhoto` path.

**Tech Stack:** React 19, Mantine, TanStack Query/Router, Firebase Firestore rules, Cloudflare Worker + R2, Paraglide, Vitest

**Spec:** `docs/superpowers/specs/2026-07-25-admin-temple-full-form-design.md`

## Global Constraints

- Work in the current workspace only — **never** `git worktree add`
- Create and use branch `feat/admin-temple-full-form` from latest `main` (Task 0)
- Scope: admin temple full form + temple photo (filler + admin). **Not** admin member form
- Lưu nháp: no required validation. Hoàn thành / filler Lưu: `validateTempleRequiredFields`. No auto-lock
- Admin fields + photo editable when `locked`; filler view/locked stays non-editable
- Temple photo optional (not in required validation)
- Prefer Vitest; **no new Cypress**
- After merge squash into `main`, delete the local feature branch unless asked otherwise

## File Structure

| File | Responsibility |
| --- | --- |
| `tanstack-app/src/domain/types.ts` | Add `Temple.photoPath` |
| `tanstack-app/src/repositories/templeRepo.ts` | `allowWhenLocked` on draft writes; `setPhotoPath`; `photoPath: null` on create |
| `tanstack-app/src/test/memoryStores.ts` | Mirror repo behavior |
| `firebase/firestore.rules` | Allow admin profile update when locked (lock fields unchanged) |
| `tanstack-app/src/use-cases/saveAdminTemple.ts` | Pass `allowWhenLocked: true` |
| `tanstack-app/src/worker/firestoreRest.ts` | `getTempleDocument`, `inviteExists` |
| `tanstack-app/src/worker/presignR2Put.ts` | `templePhotoKey` |
| `tanstack-app/src/worker/photosApi.ts` | Temple upload-url + delete |
| `tanstack-app/src/photos/photosApiClient.ts` | Client helpers for temple photos |
| `tanstack-app/src/use-cases/uploadTemplePhoto.ts` | Upload + `setPhotoPath` |
| `tanstack-app/src/use-cases/deleteTemples.ts` | Delete R2 objects (needs `idToken`) |
| `tanstack-app/src/components/temple/templePhotoUrl.ts` | Public download URL join |
| `tanstack-app/src/components/temple/TemplePortraitField.tsx` | Portrait UI (mirror member) |
| `tanstack-app/src/components/temple/TempleFormFields.tsx` | Shared draft + sections + portrait |
| `tanstack-app/src/components/filler/TempleEditorForm.tsx` | Thin filler wrapper over shared fields |
| `tanstack-app/src/components/admin/TempleFormPage.tsx` | Admin chrome + dual save + lock |
| `tanstack-app/messages/vi.json` | Lưu nháp / Hoàn thành / ảnh tịnh xá |

---

### Task 0: Branch from main + commit this plan

**Files:**
- Add: `docs/superpowers/plans/2026-07-25-admin-temple-full-form.md` (already on `main` as of plan review — do not re-commit unless the file changed)

**Interfaces:**
- Consumes: `main` with spec `docs/superpowers/specs/2026-07-25-admin-temple-full-form-design.md`
- Produces: branch `feat/admin-temple-full-form`

- [ ] **Step 1: Branch from main**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git status
git checkout main
git pull
git checkout -b feat/admin-temple-full-form
```

If currently on a non-`main` branch with WIP: stop and ask the user (plan-execution rule).

- [ ] **Step 2: Commit this plan only if it is modified and uncommitted**

```bash
git status
# If docs/superpowers/plans/2026-07-25-admin-temple-full-form.md is already committed and clean: skip.
# Otherwise:
git add docs/superpowers/plans/2026-07-25-admin-temple-full-form.md
git commit -m "$(cat <<'EOF'
docs: plan for admin temple full form and photo

EOF
)"
```

---

### Task 1: Domain `photoPath` + repo `allowWhenLocked` + `setPhotoPath`

**Files:**
- Modify: `tanstack-app/src/domain/types.ts` (`Temple` type)
- Modify: `tanstack-app/src/repositories/templeRepo.ts`
- Modify: `tanstack-app/src/test/memoryStores.ts`
- Modify: `tanstack-app/src/use-cases/saveAdminTemple.ts`
- Modify: `tanstack-app/src/use-cases/saveAdminDraft.test.ts` (add locked-update case)
- Modify: any temple fixtures missing `photoPath` that TypeScript flags

**Interfaces:**
- Consumes: existing `CreateOrUpdateTempleDraftInput`, `TempleStore`
- Produces:

```ts
// CreateOrUpdateTempleDraftInput
allowWhenLocked?: boolean

// TempleStore
setPhotoPath(templeId: string, photoPath: string): Promise<Temple>

// Temple
photoPath: string | null
```

- [ ] **Step 1: Write failing tests for locked admin update + setPhotoPath**

In `saveAdminDraft.test.ts` under `describe('saveAdminTemple')`, add:

```ts
it('updates a locked temple and preserves locked status', async () => {
  const store = createMemoryTempleStore([
    {
      id: 't1',
      orgUnitId: 'gd-i',
      status: 'locked',
      managerPhones: ['0901234567'],
      inviteId: 'inv-1',
      photoPath: null,
      danhHieu: 'Old',
      createdAt: '2026-07-19T00:00:00.000Z',
      updatedAt: '2026-07-19T00:00:00.000Z',
      lockedAt: '2026-07-19T01:00:00.000Z',
      lockedBy: 'admin-1',
    },
  ])
  const { temple, mode } = await saveAdminTemple(
    {
      orgUnitId: 'gd-i',
      templeId: 't1',
      patch: { danhHieu: 'New' },
    },
    store,
  )
  expect(mode).toBe('updated')
  expect(temple.danhHieu).toBe('New')
  expect(temple.status).toBe('locked')
  expect(temple.lockedBy).toBe('admin-1')
  expect(temple.inviteId).toBe('inv-1')
})
```

Add `tanstack-app/src/repositories/templeRepo.setPhotoPath` coverage via memory store test in `saveAdminDraft.test.ts` or a small new unit file:

```ts
it('setPhotoPath works on locked temples', async () => {
  const store = createMemoryTempleStore([
    {
      id: 't1',
      orgUnitId: 'gd-i',
      status: 'locked',
      managerPhones: ['0901234567'],
      inviteId: null,
      photoPath: null,
      createdAt: '2026-07-19T00:00:00.000Z',
      updatedAt: '2026-07-19T00:00:00.000Z',
      lockedAt: '2026-07-19T01:00:00.000Z',
      lockedBy: 'admin-1',
    },
  ])
  const updated = await store.setPhotoPath('t1', 'temples/t1/photo.jpg')
  expect(updated.photoPath).toBe('temples/t1/photo.jpg')
  expect(updated.status).toBe('locked')
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd tanstack-app && pnpm exec vitest run src/use-cases/saveAdminDraft.test.ts
```

Expected: FAIL (no `photoPath` / `setPhotoPath` / locked update still throws).

- [ ] **Step 3: Implement**

1. Add `photoPath: string | null` to `Temple` in `types.ts`.

2. Extend `CreateOrUpdateTempleDraftInput` with `allowWhenLocked?: boolean`.

3. In `createOrUpdateDraft` (repo + memory):
   - On create: set `photoPath: input.patch.photoPath ?? null` (default null).
   - On update when `existing.status === 'locked'`:
     - If `!input.allowWhenLocked` → throw `RECORD_LOCKED` (unchanged for filler).
     - If `allowWhenLocked` → allow write; **preserve** `status`, `lockedAt`, `lockedBy` (do **not** force `status: 'draft'`).
   - On update when draft: keep current behavior (`status: 'draft'`).
   - On update: preserve existing `photoPath` unless `input.patch` includes `photoPath` (spread order: `...existing, ...patch`, then re-assert identity/lock fields).

4. Normalize reads in `templeFromSnap` (and memory `getById` if needed):

```ts
photoPath: (snap.data() as { photoPath?: string | null }).photoPath ?? null
```

Legacy docs without the field must surface as `null`, not `undefined`.

5. Add `setPhotoPath` to `TempleStore` / repo / memory — updates `photoPath` + `updatedAt`; **does not** reject locked; throws `NOT_FOUND` if missing.

6. `saveAdminTemple`: pass `allowWhenLocked: true` into `createOrUpdateDraft`.

7. Fix TypeScript fixtures across the app that construct `Temple` without `photoPath` (set `null`), including `templeRepo.integration.test.ts` helpers if they build full `Temple` objects.

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd tanstack-app && pnpm exec vitest run src/use-cases/saveAdminDraft.test.ts src/use-cases/templeDraft.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/domain/types.ts \
  tanstack-app/src/repositories/templeRepo.ts \
  tanstack-app/src/test/memoryStores.ts \
  tanstack-app/src/use-cases/saveAdminTemple.ts \
  tanstack-app/src/use-cases/saveAdminDraft.test.ts
# plus any fixture files touched for photoPath
git commit -m "$(cat <<'EOF'
feat: allow admin temple updates when locked and add photoPath

EOF
)"
```

---

### Task 2: Firestore rules — admin may update locked temples

**Files:**
- Modify: `firebase/firestore.rules` (temples `allow update`)
- Modify: `tanstack-app/src/firebase/firestoreRules.integration.test.ts`
- Modify: `templeDraft()` helper to include `photoPath: null`

**Interfaces:**
- Consumes: existing `lockFieldsUnchanged()`, `isLockTransition()`, `isAdmin()`
- Produces: admin can change profile fields while locked if lock identity fields unchanged

- [ ] **Step 1: Write failing rules test**

In the temples describe, add (or extend the locked test):

```ts
it('allows admin to update profile fields on a locked temple without unlocking', async () => {
  const env = await getTestEnv()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(
      doc(ctx.firestore(), 'temples', 'temple-1'),
      templeDraft({
        status: 'locked',
        lockedAt: '2026-01-02T00:00:00.000Z',
        lockedBy: 'admin-uid',
        photoPath: null,
      }),
    )
  })
  const admin = env.authenticatedContext('admin-uid', { admin: true }).firestore()
  await assertSucceeds(
    updateDoc(doc(admin, 'temples', 'temple-1'), {
      danhHieu: 'Updated',
      photoPath: 'temples/temple-1/photo.jpg',
      updatedAt: '2026-01-03T00:00:00.000Z',
    }),
  )
  // still cannot change org unit
  await assertFails(updateDoc(doc(admin, 'temples', 'temple-1'), { orgUnitId: 'gd-ii' }))
  // anon still blocked
  const anon = env.unauthenticatedContext().firestore()
  await assertFails(updateDoc(doc(anon, 'temples', 'temple-1'), { danhHieu: 'x' }))
})
```

- [ ] **Step 2: Run rules test — expect FAIL** (or only the new admin profile assertion fails)

Integration tests are **excluded** from default `vitest.config.ts`. Use the integration config:

```bash
cd tanstack-app && pnpm exec vitest run --config vitest.integration.config.ts \
  src/firebase/firestoreRules.integration.test.ts -t "allows admin to update profile"
```

(Requires Firestore emulator available the same way other rules tests do — `pnpm test:integration` / project docs.)

- [ ] **Step 3: Update rules**

In `match /temples/{templeId}` `allow update`, replace the admin draft-only branch so admin may update while locked when lock fields stay put:

```
allow update: if coreIdentityUnchanged() && (
  (isAdmin() && isLockTransition())
  || (isAdmin() && !isLockTransition() && lockFieldsUnchanged())
  || (!isAdmin() && resource.data.status != 'locked' && lockFieldsUnchanged() && validInviteScope(request.resource.data))
);
```

Note: the second branch no longer requires `resource.data.status != 'locked'`. Admin may update draft **or** locked temples if `status` / `lockedAt` / `lockedBy` are unchanged. Non-admin still blocked when locked.

Also update the existing test title/body currently named roughly `blocks updates once locked…`: keep anon-blocked + orgUnitId-blocked assertions; do **not** assert that admin profile updates fail when locked (that would contradict the new test).

Add `photoPath: null` to `templeDraft()` helper.

- [ ] **Step 4: Run rules tests — expect PASS**

```bash
cd tanstack-app && pnpm exec vitest run --config vitest.integration.config.ts \
  src/firebase/firestoreRules.integration.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add firebase/firestore.rules \
  tanstack-app/src/firebase/firestoreRules.integration.test.ts
git commit -m "$(cat <<'EOF'
fix: allow admin to update locked temple profiles

EOF
)"
```

---

### Task 3: Temple photo API (worker + client + use-case + delete)

**Files:**
- Modify: `tanstack-app/src/worker/firestoreRest.ts` (+ tests)
- Modify: `tanstack-app/src/worker/presignR2Put.ts` (+ tests if present)
- Modify: `tanstack-app/src/worker/photosApi.ts` (+ `photosApi.test.ts`)
- Modify: `tanstack-app/src/photos/photosApiClient.ts` (+ test)
- Create: `tanstack-app/src/use-cases/uploadTemplePhoto.ts` (+ test)
- Modify: `tanstack-app/src/use-cases/deleteTemples.ts` (+ test)
- Modify: `tanstack-app/src/components/admin/TemplesListPage.tsx` (pass `idToken` into delete)

**Interfaces:**
- Produces:

```ts
export type WorkerTemple = {
  id: string
  orgUnitId: string
  status: 'draft' | 'locked'
}

export function templePhotoKey(templeId: string): string // temples/{id}/photo.jpg

export async function inviteExists(projectId: string, inviteId: string): Promise<boolean>

export async function getTempleDocument(
  projectId: string,
  templeId: string,
): Promise<WorkerTemple | null>

export async function requestTemplePhotoUploadUrl(input: {
  templeId: string
  contentType: string
  inviteToken?: string
  idToken?: string
}): Promise<{ uploadUrl: string; photoPath: string }>

export async function deleteTemplePhotoObject(input: {
  templeId: string
  idToken: string
}): Promise<void>

export async function uploadTemplePhoto(
  input: {
    templeId: string
    bytes: Uint8Array
    contentType: string
    inviteToken?: string
    /** Admin Firebase ID token — required for locked-temple uploads; sent as Bearer to the worker. */
    idToken?: string
  },
  templeStore?: TempleStore,
): Promise<{ photoPath: string }>

// deleteTemples — breaking signature change (call sites: TemplesListPage + tests)
deleteTemples(input: { ids: string[]; idToken: string }, ...)
```

Auth rules for `POST /api/photos/temple-upload-url`:
- Admin Bearer → allow even if locked
- Else require `inviteToken` where `inviteExists` is true (no orgUnit match)
- Filler path: 403 if temple locked
- No CCCD field

Important: unlike current `uploadMemberPhoto` (which accepts `idToken` on the client helper but never threads it from the use-case), **temple must pass `idToken` through** `uploadTemplePhoto` → `requestTemplePhotoUploadUrl({ idToken })` → `Authorization: Bearer …`.

- [ ] **Step 1: Write failing worker + use-case tests**

Update `photosApi.test.ts` mocks:

```ts
vi.mock('./firestoreRest', () => ({
  getMemberDocument,
  getInviteOrgUnitId,
  getTempleDocument,
  inviteExists,
}))
```

Mirror member cases for temple routes:
- 401 without auth
- 400 bad content type
- 200 admin Bearer on locked temple
- 403 filler invite on locked temple
- 200 filler invite on draft when `inviteExists` true
- 403 when invite missing (`inviteExists` false)

`uploadTemplePhoto.test.ts`:
- happy path sets photoPath via store
- filler (invite only, no idToken) rejects locked
- admin (`idToken` present) allows locked and passes idToken into storage/client

`deleteTemples.test.ts`:
- Update all call sites to pass `idToken: 'token'`
- After successful delete, photo delete helper called per id (inject dependency like `deleteMembers`)

- [ ] **Step 2: Run — expect FAIL**

```bash
cd tanstack-app && pnpm exec vitest run \
  src/worker/photosApi.test.ts \
  src/use-cases/uploadTemplePhoto.test.ts \
  src/use-cases/deleteTemples.test.ts
```

- [ ] **Step 3: Implement worker + client + use-cases**

1. `inviteExists` — fetch `invites/{id}`, return `doc != null` (do not require `orgUnitId`).
2. `getTempleDocument` — parse `orgUnitId` + `status`.
3. `templePhotoKey` + handle `POST /api/photos/temple-upload-url` and `DELETE /api/photos/temple` in `photosApi.ts`.
4. Client `requestTemplePhotoUploadUrl` / `deleteTemplePhotoObject` (Bearer when `idToken` set).
5. `uploadTemplePhoto`:
   - load temple; if missing → `NOT_FOUND`
   - if `status === 'locked' && !input.idToken` → `RECORD_LOCKED`
   - request upload URL with `inviteToken` and/or `idToken`; PUT bytes; `setPhotoPath`
6. `deleteTemples`: require `idToken`; after `deleteMany`, `Promise.allSettled` photo deletes (mirror `deleteMembers`).
7. `TemplesListPage`: `const { user } = useAuth()`, `idToken = await user!.getIdToken()`, pass into `deleteTemples`. Update list page tests to mock `useAuth` + expect `idToken` (same pattern as `MembersListPage.test.tsx`).

- [ ] **Step 4: Run — expect PASS**

```bash
cd tanstack-app && pnpm exec vitest run \
  src/worker/firestoreRest.test.ts \
  src/worker/photosApi.test.ts \
  src/photos/photosApiClient.test.ts \
  src/use-cases/uploadTemplePhoto.test.ts \
  src/use-cases/deleteTemples.test.ts \
  src/components/admin/TemplesListPage.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/worker tanstack-app/src/photos \
  tanstack-app/src/use-cases/uploadTemplePhoto.ts \
  tanstack-app/src/use-cases/uploadTemplePhoto.test.ts \
  tanstack-app/src/use-cases/deleteTemples.ts \
  tanstack-app/src/use-cases/deleteTemples.test.ts \
  tanstack-app/src/components/admin/TemplesListPage.tsx \
  tanstack-app/src/components/admin/TemplesListPage.test.tsx
git commit -m "$(cat <<'EOF'
feat: temple photo upload API and delete cleanup

EOF
)"
```

---

### Task 4: `TemplePortraitField` + i18n

**Files:**
- Create: `tanstack-app/src/components/temple/templePhotoUrl.ts` (+ test)
- Create: `tanstack-app/src/components/temple/TemplePortraitField.tsx` (+ test)
- Modify: `tanstack-app/messages/vi.json`

**Interfaces:**
- Produces:

```ts
export function getTemplePhotoDownloadUrl(photoPath: string): string

export type TemplePortraitFieldProps = {
  templeId?: string
  inviteToken?: string
  /** Async admin token provider — prefer this over a stale string prop. */
  getIdToken?: () => Promise<string | undefined>
  photoPath: string | null
  disabled?: boolean
  pendingFile: File | null
  onPendingFileChange: (file: File | null) => void
  onPhotoPathChange: (photoPath: string) => void
  onUploadError?: (message: string) => void
}
```

i18n keys (vi):

```json
"admin_temples_save_draft": "Lưu nháp",
"admin_temples_complete": "Hoàn thành",
"filler_field_anh_tinh_xa": "Ảnh tịnh xá"
```

Reuse `filler_photo_choose`, `filler_photo_change`, `filler_photo_invalid_type`, `filler_photo_upload_error`.

`getTemplePhotoDownloadUrl` must use `import.meta.env.VITE_PHOTOS_PUBLIC_BASE` exactly like `getMemberPhotoDownloadUrl`.

- [ ] **Step 1: Write failing `TemplePortraitField` tests** (copy structure from `MemberPortraitField.test.tsx`)
  - no templeId → sets pending file, does not call upload
  - with templeId + inviteToken → calls `uploadTemplePhoto` with inviteToken
  - with templeId + getIdToken → awaits token and passes `idToken`
  - reject non-image type

- [ ] **Step 2: Run — expect FAIL**

```bash
cd tanstack-app && pnpm exec vitest run src/components/temple/TemplePortraitField.test.tsx
```

- [ ] **Step 3: Implement URL helper + field + messages; run `pnpm paraglide`**

Copy UI from `MemberPortraitField` (keep 3:4 preview for parity). Label: `m.filler_field_anh_tinh_xa()`.

```ts
const idToken = (await getIdToken?.()) ?? undefined
await uploadTemplePhoto({
  templeId,
  bytes,
  contentType: file.type,
  inviteToken,
  idToken,
})
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd tanstack-app && pnpm paraglide && pnpm exec vitest run \
  src/components/temple/templePhotoUrl.test.ts \
  src/components/temple/TemplePortraitField.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/temple tanstack-app/messages/vi.json tanstack-app/src/paraglide
git commit -m "$(cat <<'EOF'
feat: temple portrait field and photo i18n

EOF
)"
```

---

### Task 5: Extract `TempleFormFields` + wire filler

**Files:**
- Create: `tanstack-app/src/components/temple/TempleFormFields.tsx`
- Modify: `tanstack-app/src/components/filler/TempleEditorForm.tsx`
- Modify: `tanstack-app/src/components/filler/TempleEditorForm.test.tsx`

**Interfaces:**
- Produces:

```ts
export type TempleFormFieldsApi = {
  getDraft: () => TempleDraft
  getExtraManagerPhone: () => string
  getPhotoPath: () => string | null
  getPendingPhoto: () => File | null
  setPhotoPath: (path: string | null) => void
  clearPendingPhoto: () => void
  setFieldErrors: (errors: TempleRequiredFieldErrors) => void
  clearFieldErrors: () => void
}

export type TempleFormFieldsProps = {
  initial: Partial<Temple> & { seedPhone?: string }
  disabled?: boolean
  templeId?: string
  inviteToken?: string
  getIdToken?: () => Promise<string | undefined>
  /** Parent assigns `apiRef.current = api` each render / in an effect — no forwardRef (unused in this codebase). */
  apiRef: React.MutableRefObject<TempleFormFieldsApi | null>
}
```

Own state: draft, extraManagerPhone, photoPath, pendingPhoto, fieldErrors. Render all existing sections from `TempleEditorFormSections` + phones + `TemplePortraitField` (portrait near identity / top of stack).

Map error codes → messages exactly as current `TempleEditorForm` helpers (`mapRequiredError`, etc.) — move those helpers into `TempleFormFields` or a tiny `templeFormErrors.ts` beside it.

- [ ] **Step 1: Update filler tests for photo-after-create**

In `TempleEditorForm.test.tsx`, mock `uploadTemplePhoto`. Add test: create save with pending file calls upload after create (same pattern as member editor tests). Keep existing required-validation tests green.

- [ ] **Step 2: Run — expect FAIL** on new photo test

```bash
cd tanstack-app && pnpm exec vitest run src/components/filler/TempleEditorForm.test.tsx
```

- [ ] **Step 3: Extract + refactor `TempleEditorForm`**

```tsx
const fieldsApiRef = useRef<TempleFormFieldsApi | null>(null)

const handleSave = () => {
  const api = fieldsApiRef.current
  if (!api) return
  const draft = api.getDraft()
  const result = validateTempleRequiredFields({
    danhHieu: draft.danhHieu,
    nguoiKhaiSon: draft.nguoiKhaiSon,
    namThanhLap: draft.namThanhLap,
    diaChiCu: draft.diaChiCu,
    diaChiMoi: draft.diaChiMoi,
    truTriHienNay: draft.truTriHienNay,
    truTriTienNhiem: draft.truTriTienNhiem,
    tangSoHienTru: draft.tangSoHienTru,
    soPhatTuQuyY: draft.soPhatTuQuyY,
    soPhatTuThuongXuyen: draft.soPhatTuThuongXuyen,
  })
  if (!result.valid) {
    api.setFieldErrors(result.errors)
    return
  }
  api.clearFieldErrors()
  const patch = buildTemplePatch(draft)
  const explicitPhones = api.getExtraManagerPhone().trim()
    ? [api.getExtraManagerPhone().trim()]
    : []
  void (async () => {
    try {
      const saveResult = await saveMutation.mutateAsync({ patch, explicitPhones })
      // if created + pending photo → uploadTemplePhoto({ templeId, inviteToken: token, ... })
      // then onCreated / success toast as today
    } catch {
      // onError handles
    }
  })()
}

return (
  <FillerEditorShell ... onSave={status === 'draft' ? handleSave : undefined}>
    <TempleFormFields
      apiRef={fieldsApiRef}
      initial={initial}
      disabled={disabled}
      templeId={templeId}
      inviteToken={token}
    />
  </FillerEditorShell>
)
```

Wire `saveMutation` as `mutationFn: ({ patch, explicitPhones }) => saveTempleDraft({ token, orgUnitId, templeId, patch, explicitPhones })`.

- [ ] **Step 4: Run filler tests — expect PASS**

```bash
cd tanstack-app && pnpm exec vitest run src/components/filler/TempleEditorForm.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/temple/TempleFormFields.tsx \
  tanstack-app/src/components/filler/TempleEditorForm.tsx \
  tanstack-app/src/components/filler/TempleEditorForm.test.tsx
git commit -m "$(cat <<'EOF'
refactor: extract TempleFormFields and add filler temple photo

EOF
)"
```

---

### Task 6: Rewrite `TempleFormPage` (full form + dual save)

**Files:**
- Modify: `tanstack-app/src/components/admin/TempleFormPage.tsx`
- Modify: `tanstack-app/src/components/admin/TempleFormPage.test.tsx`

**Interfaces:**
- Consumes: `TempleFormFields`, `saveAdminTemple`, `uploadTemplePhoto`, `validateTempleRequiredFields`, `useAuth` (`getIdToken`)
- Behavior:
  - Load temple → pass as `initial` including `photoPath: temple.photoPath ?? null` (remount via `key={templeId}` / data identity if hydration races)
  - Org unit Select above fields (required on create; disabled on edit)
  - Invite meta text retained
  - Buttons always available for admin (including when locked): **Lưu nháp**, **Hoàn thành**, Lock/Unlock
  - Fields never `disabled` for admin (even when locked) — remove old `isReadOnly` / structured-address-readonly UX
  - Pass `getIdToken={() => user!.getIdToken()}` into `TempleFormFields` for immediate photo upload
  - Lưu nháp: skip `validateTempleRequiredFields` only — **still** subject to domain `PHONE_REQUIRED` / Firestore `managerPhones.size() > 0` on create
  - Hoàn thành: validate then save; never call `lockTemple`
  - After create (either button): navigate to detail; upload pending photo with `idToken`
  - Show save success/error; photo upload error uses `m.filler_photo_upload_error()`

- [ ] **Step 1: Rewrite tests first**

**Delete** obsolete short-form tests that no longer apply:
- `displays formatted structured address as read-only`
- `omits structured diaChiMoi from admin save patch`
- any click on `m.admin_temples_save()` (button removed)

Add fixtures with `photoPath: null`. Mock `uploadTemplePhoto` and `useAuth` (`getIdToken`).

```ts
it('renders full temple sections', async () => {
  templeFixture = draftTemple
  renderForm({ mode: 'edit' })
  expect(await screen.findByText(m.filler_section_temple_identity())).toBeTruthy()
  expect(screen.getByText(m.filler_section_temple_address())).toBeTruthy()
  expect(screen.getByText(m.filler_field_anh_tinh_xa())).toBeTruthy()
})

it('Lưu nháp saves without temple required-field validation when a manager phone is present', async () => {
  // create mode: select org unit, fill trụ trì phone (or manager phone) only,
  // leave danh hiệu / addresses empty, click Lưu nháp
  // Domain still requires ≥1 phone via buildManagerPhones — do NOT expect a save with zero phones.
  expect(saveAdminTempleMock).toHaveBeenCalled()
})

it('Hoàn thành does not save when required fields missing', async () => {
  // create: org unit + phone filled (so PHONE_REQUIRED is not the blocker),
  // other required fields empty → click Hoàn thành
  expect(saveAdminTempleMock).not.toHaveBeenCalled()
  expect(screen.getAllByText(m.filler_error_field_required()).length).toBeGreaterThan(0)
})

it('keeps fields editable when locked', async () => {
  templeFixture = lockedTemple
  renderForm({ mode: 'edit' })
  const input = await screen.findByLabelText(m.filler_field_danh_hieu())
  expect(input).not.toBeDisabled()
  expect(
    screen.getByRole('button', { name: m.admin_temples_save_draft() }),
  ).toBeTruthy()
})
```

Keep Lock/Unlock coverage (`shows unlock when locked`, etc.).

- [ ] **Step 2: Run — expect FAIL**

```bash
cd tanstack-app && pnpm exec vitest run src/components/admin/TempleFormPage.test.tsx
```

- [ ] **Step 3: Implement `TempleFormPage`**

Remove the old four-field stack and `admin_temples_save` single button. Structure:

```tsx
const { user } = useAuth()
const fieldsApiRef = useRef<TempleFormFieldsApi | null>(null)

<Stack>
  <Group> title + back </Group>
  {loading / errors}
  {(create || temple.data) && (
    <Stack maw={760}>
      meta + org unit Select
      <TempleFormFields
        apiRef={fieldsApiRef}
        initial={...}
        disabled={false}
        templeId={templeId}
        getIdToken={async () => (user ? user.getIdToken() : undefined)}
      />
      mutation errors / success
      <Group>
        <Button onClick={() => void saveDraft()}>{m.admin_temples_save_draft()}</Button>
        <Button onClick={() => void complete()}>{m.admin_temples_complete()}</Button>
        {/* lock / unlock as today — still show when locked/draft respectively */}
      </Group>
    </Stack>
  )}
</Stack>
```

Shared save helper:

```ts
async function persist() {
  const api = fieldsApiRef.current!
  const draft = api.getDraft()
  const result = await saveAdminTemple({
    orgUnitId: orgUnitId!,
    templeId: mode === 'edit' ? templeId : undefined,
    patch: buildTemplePatch(draft),
    explicitPhones: api.getExtraManagerPhone().trim()
      ? [api.getExtraManagerPhone().trim()]
      : [],
  })
  const pending = api.getPendingPhoto()
  if (pending && result.temple.id) {
    const idToken = await user!.getIdToken()
    const bytes = new Uint8Array(await pending.arrayBuffer())
    try {
      const uploaded = await uploadTemplePhoto({
        templeId: result.temple.id,
        bytes,
        contentType: pending.type,
        idToken,
      })
      api.setPhotoPath(uploaded.photoPath)
      api.clearPendingPhoto()
    } catch {
      setPhotoError(m.filler_photo_upload_error())
    }
  }
  return result
}

async function saveDraft() {
  // no validateTempleRequiredFields
  await persist()
}

async function complete() {
  const api = fieldsApiRef.current!
  const draft = api.getDraft()
  const result = validateTempleRequiredFields({ /* same field pick as Task 5 */ })
  if (!result.valid) {
    api.setFieldErrors(result.errors)
    return
  }
  api.clearFieldErrors()
  await persist()
}
```

- [ ] **Step 4: Run admin + filler temple tests — expect PASS**

```bash
cd tanstack-app && pnpm exec vitest run \
  src/components/admin/TempleFormPage.test.tsx \
  src/components/filler/TempleEditorForm.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/admin/TempleFormPage.tsx \
  tanstack-app/src/components/admin/TempleFormPage.test.tsx
git commit -m "$(cat <<'EOF'
feat: admin temple full form with draft and complete save

EOF
)"
```

---

### Task 7: Verification sweep

**Files:** none new — fix any fallout

- [ ] **Step 1: Run unit suites**

```bash
cd tanstack-app && pnpm exec vitest run \
  src/use-cases/saveAdminDraft.test.ts \
  src/use-cases/templeDraft.test.ts \
  src/use-cases/uploadTemplePhoto.test.ts \
  src/use-cases/deleteTemples.test.ts \
  src/worker/photosApi.test.ts \
  src/components/temple \
  src/components/filler/TempleEditorForm.test.tsx \
  src/components/admin/TempleFormPage.test.tsx \
  src/components/admin/TemplesListPage.test.tsx
```

- [ ] **Step 2: Run Firestore rules integration suite** (emulator required)

```bash
cd tanstack-app && pnpm exec vitest run --config vitest.integration.config.ts \
  src/firebase/firestoreRules.integration.test.ts
```

- [ ] **Step 3: Fix any TypeScript / fixture fallout from `photoPath`**

```bash
cd tanstack-app && pnpm exec tsc --noEmit
```

- [ ] **Step 4: Commit fixes if any**

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix: temple photoPath fixture and test fallout

EOF
)"
```

Skip empty commit if clean.

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Admin full form create + edit | 5, 6 |
| Lưu nháp without validation | 6 |
| Hoàn thành with validation, no auto-lock | 6 |
| Editable when locked (fields + photo) | 1, 2, 3, 6 |
| Lock/Unlock retained | 6 |
| Optional temple photo filler + admin | 3, 4, 5, 6 |
| R2 upload auth (admin / invite exists) | 3 |
| Delete temple cleans R2 | 3 |
| Filler single Lưu unchanged (validated) | 5 |
| Member admin out of scope | — |
| Vitest only | all |

## Notes for implementers

- Filler `saveTempleDraft` must **not** pass `allowWhenLocked` (default false) so locked filler writes still fail.
- When hydrating admin edit, include `photoPath: temple.photoPath ?? null` in `initial`.
- Do not reuse `getInviteOrgUnitId` for temple filler photo auth — use `inviteExists`.
- **Lưu nháp ≠ zero constraints:** it skips `validateTempleRequiredFields` only. Create/update still needs ≥1 manager phone (`buildManagerPhones` / Firestore `managerPhones.size() > 0` on create).
- Full form replaces the old admin structured-address read-only workaround — `buildTemplePatch` writes `diaChiMoi` / `diaChiCu` from address drafts like filler.
- Default Vitest config **excludes** `*.integration.test.ts`; rules tests must use `vitest.integration.config.ts`.
- Deploy reminder (human): publish updated `firestore.rules` with the app release.
)
