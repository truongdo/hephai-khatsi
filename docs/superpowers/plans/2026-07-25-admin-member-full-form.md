# Admin Member Full Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin member create/edit uses the full filler field set with **Lưu nháp** / **Hoàn thành**, remains editable when locked (including portrait), wrapped in `Paper` like admin temple.

**Architecture:** Unlock locked admin writes in `memberRepo` + Firestore rules + photo upload path. Extract `memberDraft` + `MemberFormFields` from the large `MemberEditorForm`. Admin `MemberFormPage` dual-saves via `saveAdminMember`; filler keeps single validated Lưu.

**Tech Stack:** React 19, Mantine, TanStack Query/Router, Firebase rules, Worker R2 photos, Paraglide, Vitest

**Spec:** `docs/superpowers/specs/2026-07-25-admin-member-full-form-design.md`

**Reference implementation:** `feat` already shipped for temples — mirror patterns in `TempleFormFields`, `TempleFormPage`, `uploadTemplePhoto`, temple rules / `allowWhenLocked`.

## Global Constraints

- Work in the current workspace only — **never** `git worktree add`
- Branch: `feat/admin-member-full-form` (already created from `main` with design commit — Task 0 verifies)
- Scope: admin member full form + unlock locked photo/profile for admin. **Not** temple changes
- Lưu nháp: skip `validateMemberRequiredFields` only; create still needs org + sangha + valid CCCD
- Hoàn thành / filler Lưu: `validateMemberRequiredFields`. No auto-lock
- Admin fields + photo editable when `locked`; filler view/locked stays non-editable
- Prefer Vitest; **no new Cypress**
- After merge squash into `main`, delete the local feature branch unless asked otherwise

## File Structure

| File | Responsibility |
| --- | --- |
| `tanstack-app/src/repositories/memberRepo.ts` | `allowWhenLocked` on `updateDraftById`; unlock `setPhotoPath` for locked (like temple) |
| `tanstack-app/src/test/memoryStores.ts` | Mirror repo |
| `tanstack-app/src/use-cases/saveAdminMember.ts` | Pass `allowWhenLocked: true` on update |
| `firebase/firestore.rules` | Admin may update locked members when lock fields unchanged |
| `tanstack-app/src/use-cases/uploadMemberPhoto.ts` | `idToken`; allow locked when admin token present |
| `tanstack-app/src/worker/photosApi.ts` | Member upload: locked + non-admin → 403; admin Bearer OK |
| `tanstack-app/src/components/filler/MemberPortraitField.tsx` | Optional `inviteToken`; `getIdToken?` |
| `tanstack-app/src/components/filler/memberDraft.ts` | Extract `MemberDraft`, `emptyMemberDraft`, `buildMemberPatch` from editor |
| `tanstack-app/src/components/filler/MemberFormFields.tsx` | Shared sections + draft + portrait + `apiRef` |
| `tanstack-app/src/components/filler/MemberEditorForm.tsx` | Thin filler wrapper |
| `tanstack-app/src/components/admin/MemberFormPage.tsx` | Paper + chrome + dual save + lock |
| `tanstack-app/messages/vi.json` | `admin_members_save_draft`, `admin_members_complete` |

---

### Task 0: Verify branch + commit this plan

**Files:**
- Add: `docs/superpowers/plans/2026-07-25-admin-member-full-form.md`

**Interfaces:**
- Consumes: branch `feat/admin-member-full-form` with spec commit
- Produces: plan committed on that branch

- [ ] **Step 1: Verify branch**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git status
git branch --show-current   # expect feat/admin-member-full-form
```

If on another branch with WIP: stop and ask the user (plan-execution rule). Never `git worktree add`.

- [ ] **Step 2: Commit this plan if uncommitted**

```bash
git add docs/superpowers/plans/2026-07-25-admin-member-full-form.md
git commit -m "$(cat <<'EOF'
docs: plan for admin member full form

EOF
)"
```

Skip if already committed and clean.

---

### Task 1: Repo `allowWhenLocked` + `setPhotoPath` + `saveAdminMember`

**Files:**
- Modify: `tanstack-app/src/repositories/memberRepo.ts`
- Modify: `tanstack-app/src/test/memoryStores.ts`
- Modify: `tanstack-app/src/use-cases/saveAdminMember.ts`
- Modify: `tanstack-app/src/use-cases/saveAdminDraft.test.ts`

**Interfaces:**
- Produces:

```ts
// MemberStore.updateDraftById
updateDraftById(
  memberId: string,
  patch: MemberProfilePatch,
  options?: { allowWhenLocked?: boolean },
): Promise<Member>

// setPhotoPath — do NOT throw RECORD_LOCKED (mirror templeRepo.setPhotoPath)
setPhotoPath(memberId: string, photoPath: string): Promise<Member>

// saveAdminMember update path
await memberStore.updateDraftById(id, patch, { allowWhenLocked: true })
```

- [ ] **Step 1: Write failing tests**

In `saveAdminDraft.test.ts`, change/replace the existing “rejects update when member is locked” expectation for **admin** path:

```ts
it('updates a locked member via saveAdminMember and preserves locked status', async () => {
  const store = createMemoryMemberStore([
    {
      id: 'm1',
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      status: 'locked',
      cccd: '001099012345',
      inviteId: 'inv-1',
      currentTempleId: null,
      photoPath: null,
      phapDanh: 'Old',
      createdAt: '2026-07-19T00:00:00.000Z',
      updatedAt: '2026-07-19T00:00:00.000Z',
      lockedAt: '2026-07-19T01:00:00.000Z',
      lockedBy: 'admin-1',
    },
  ])
  const { member, mode } = await saveAdminMember(
    {
      memberId: 'm1',
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      patch: { phapDanh: 'New' },
    },
    store,
  )
  expect(mode).toBe('updated')
  expect(member.phapDanh).toBe('New')
  expect(member.status).toBe('locked')
  expect(member.lockedBy).toBe('admin-1')
  expect(member.inviteId).toBe('inv-1')
})

it('setPhotoPath works on locked members', async () => {
  const store = createMemoryMemberStore([/* locked member fixture */])
  const updated = await store.setPhotoPath('m1', 'members/m1/photo.jpg')
  expect(updated.photoPath).toBe('members/m1/photo.jpg')
  expect(updated.status).toBe('locked')
})
```

Keep a separate test that `updateDraftById` **without** `allowWhenLocked` still throws `RECORD_LOCKED` (filler path).

- [ ] **Step 2: Run — expect FAIL**

```bash
cd tanstack-app && pnpm exec vitest run src/use-cases/saveAdminDraft.test.ts
```

- [ ] **Step 3: Implement**

1. `updateDraftById(memberId, patch, options?)`: if locked && !options?.allowWhenLocked → throw; if allow → preserve lock fields (already mostly preserves `status: existing.status` — ensure locked stays locked).
2. Remove lock rejection from `setPhotoPath` (temple pattern).
3. Memory store parity.
4. `saveAdminMember` update: `updateDraftById(..., { allowWhenLocked: true })`.

- [ ] **Step 4: Run — expect PASS** (also `memberDraft.test.ts` / filler locked still rejects)

```bash
cd tanstack-app && pnpm exec vitest run \
  src/use-cases/saveAdminDraft.test.ts \
  src/use-cases/memberDraft.test.ts
```

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: allow admin member updates when locked

EOF
)"
```

---

### Task 2: Firestore rules — admin may update locked members

**Files:**
- Modify: `firebase/firestore.rules` (members `allow update`)
- Modify: `tanstack-app/src/firebase/firestoreRules.integration.test.ts`

**Interfaces:**
- Produces: admin profile update when locked if `lockFieldsUnchanged()` + existing `inviteId` equality

- [ ] **Step 1: Write failing rules test** (admin updates `phapDanh` + `photoPath` on locked member; anon still fails; orgUnitId still blocked)

- [ ] **Step 2: Run with integration config**

```bash
cd tanstack-app && pnpm exec vitest run --config vitest.integration.config.ts \
  src/firebase/firestoreRules.integration.test.ts -t "allows admin to update profile"
```

Default vitest **excludes** `*.integration.test.ts`.

- [ ] **Step 3: Update members rules**

Replace admin draft-only branch with (keep inviteId checks):

```
|| (isAdmin() && !isLockTransition()
    && lockFieldsUnchanged()
    && request.resource.data.inviteId == resource.data.inviteId)
```

(i.e. drop `resource.data.status != 'locked' &&` for admin non-lock updates — same as temples.)

- [ ] **Step 4: Full rules suite PASS**

```bash
cd tanstack-app && pnpm exec vitest run --config vitest.integration.config.ts \
  src/firebase/firestoreRules.integration.test.ts
```

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
fix: allow admin to update locked member profiles

EOF
)"
```

---

### Task 3: Member photo — admin locked upload + `idToken` threading

**Files:**
- Modify: `tanstack-app/src/use-cases/uploadMemberPhoto.ts` (+ test)
- Modify: `tanstack-app/src/worker/photosApi.ts` (+ test)
- Modify: `tanstack-app/src/components/filler/MemberPortraitField.tsx` (+ test)
- Modify: `tanstack-app/src/photos/photosApiClient.ts` only if StoragePort needs idToken wiring (client already accepts `idToken`)

**Interfaces:**
- Produces:

```ts
export type UploadMemberPhotoInput = {
  memberId: string
  cccd: string
  bytes: Uint8Array
  contentType: string
  inviteToken?: string
  idToken?: string
}

// StoragePort.put(..., inviteToken?, idToken?)
// MemberPortraitFieldProps:
inviteToken?: string
getIdToken?: () => Promise<string | undefined>
```

Worker member upload (mirror temple):

```ts
const isAdmin = /* bearer verified admin */
if (member.status === 'locked' && !isAdmin) return 403
// then authorizeMemberUpload / proceed
```

Do **not** 403 locked before checking admin (current bug).

- [ ] **Step 1: Failing tests**
  - `uploadMemberPhoto`: locked + no idToken → RECORD_LOCKED; locked + idToken → success; idToken passed to storage/client
  - Worker: admin Bearer on locked member → 200; invite-only on locked → 403
  - Portrait: with `getIdToken` passes `idToken` into upload

- [ ] **Step 2: Run FAIL**

```bash
cd tanstack-app && pnpm exec vitest run \
  src/use-cases/uploadMemberPhoto.test.ts \
  src/worker/photosApi.test.ts \
  src/components/filler/MemberPortraitField.test.tsx
```

- [ ] **Step 3: Implement** (thread idToken end-to-end; make `inviteToken` optional on portrait for admin)

- [ ] **Step 4: PASS + commit**

```bash
git commit -m "$(cat <<'EOF'
feat: allow admin member photo upload when locked

EOF
)"
```

---

### Task 4: i18n keys

**Files:**
- Modify: `tanstack-app/messages/vi.json`
- Run: `pnpm paraglide` (generated output may be gitignored)

```json
"admin_members_save_draft": "Lưu nháp",
"admin_members_complete": "Hoàn thành"
```

- [ ] **Step 1: Add keys + paraglide**
- [ ] **Step 2: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: admin member draft and complete i18n labels

EOF
)"
```

(Can fold into Task 6 if preferred; keep separate for clean review.)

---

### Task 5: Extract `memberDraft` + `MemberFormFields` + wire filler

**Files:**
- Create: `tanstack-app/src/components/filler/memberDraft.ts` (move `MemberDraft`, `emptyMemberDraft`, `buildPatch` → export as `buildMemberPatch`)
- Create: `tanstack-app/src/components/filler/MemberFormFields.tsx`
- Modify: `tanstack-app/src/components/filler/MemberEditorForm.tsx` (thin wrapper)
- Modify: `tanstack-app/src/components/filler/MemberEditorForm.test.tsx`

**Interfaces:**
- Produces:

```ts
export type MemberFormFieldsApi = {
  getDraft: () => MemberDraft
  getPhotoPath: () => string | null
  getPendingPhoto: () => File | null
  setPhotoPath: (path: string | null) => void
  clearPendingPhoto: () => void
  setFieldErrors: (errors: MemberRequiredFieldErrors) => void
  clearFieldErrors: () => void
}

export type MemberFormFieldsProps = {
  initial: Partial<Member>
  disabled?: boolean
  memberId?: string
  cccd: string
  sanghaType: SanghaType
  inviteToken?: string
  getIdToken?: () => Promise<string | undefined>
  apiRef: React.MutableRefObject<MemberFormFieldsApi | null>
  onUploadError?: (message: string) => void
}
```

Own: draft, photoPath, pendingPhoto, fieldErrors. Render portrait + all existing section JSX currently inside `MemberEditorForm` (identity/contact/rest/tail — move as-is; do not redesign).

`MemberEditorForm` keeps: CCCD create input if currently there, shell, validate + `saveMemberDraft`, pending photo after create.

**Note:** `MemberEditorForm.tsx` is very large (~1600 lines). Prefer moving section `useMemo` blocks into `MemberFormFields` without splitting into many new files unless a file exceeds ~400–500 lines of new code and the implementer reports DONE_WITH_CONCERNS.

- [ ] **Step 1: Ensure existing filler tests still define success criteria; add nothing yet that breaks**
- [ ] **Step 2: Extract + refactor; run**

```bash
cd tanstack-app && pnpm exec vitest run src/components/filler/MemberEditorForm.test.tsx
```

Expected: all existing tests PASS (required fields, photo-after-create, etc.).

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
refactor: extract MemberFormFields for shared filler and admin

EOF
)"
```

---

### Task 6: Rewrite `MemberFormPage` (full form + dual save + Paper)

**Files:**
- Modify: `tanstack-app/src/components/admin/MemberFormPage.tsx`
- Modify: `tanstack-app/src/components/admin/MemberFormPage.test.tsx`

**Behavior (mirror `TempleFormPage`):**
- Title + back outside; form body in `<Paper p="xl" maw={760} w="100%">`
- Org unit + sangha selects (disabled on edit); CCCD create-only editable
- `MemberFormFields` with `disabled={false}`, `getIdToken`, `cccd`, `sanghaType`
- **Lưu nháp** / **Hoàn thành** always shown (including when locked)
- Lưu nháp: no `validateMemberRequiredFields`; create requires org + sangha + CCCD
- Hoàn thành: validate then save; never `lockMember`
- Lock/Unlock retained
- Pending photo upload after create with `idToken`
- Wire `onUploadError` to photo error state

**Tests — delete obsolete short-form assertions; add:**
1. Renders full sections (use a stable filler section heading / field label from the form)
2. Lưu nháp with CCCD + org saves without filling all required fields
3. Hoàn thành blocks when required missing (with CCCD present so identity is not the blocker)
4. Locked: fields editable + both save buttons
5. Create + pending photo → `uploadMemberPhoto` with `idToken` + navigate
6. Hoàn thành happy path → `saveAdminMember`; `lockMember` not called

Mock `vietnam-locations`, `uploadMemberPhoto`, `useAuth` like temple admin tests.

- [ ] **Step 1: Rewrite tests (FAIL)**
- [ ] **Step 2: Implement page (PASS)**

```bash
cd tanstack-app && pnpm exec vitest run \
  src/components/admin/MemberFormPage.test.tsx \
  src/components/filler/MemberEditorForm.test.tsx
```

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: admin member full form with draft and complete save

EOF
)"
```

---

### Task 7: Verification sweep

- [ ] **Step 1: Unit suites**

```bash
cd tanstack-app && pnpm exec vitest run \
  src/use-cases/saveAdminDraft.test.ts \
  src/use-cases/memberDraft.test.ts \
  src/use-cases/uploadMemberPhoto.test.ts \
  src/worker/photosApi.test.ts \
  src/components/filler/MemberEditorForm.test.tsx \
  src/components/filler/MemberPortraitField.test.tsx \
  src/components/admin/MemberFormPage.test.tsx
```

- [ ] **Step 2: Rules integration**

```bash
cd tanstack-app && pnpm exec vitest run --config vitest.integration.config.ts \
  src/firebase/firestoreRules.integration.test.ts
```

- [ ] **Step 3: Fix fallout; commit only if needed**

```bash
git commit -m "$(cat <<'EOF'
fix: admin member full form verification fallout

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Full form create + edit | 5, 6 |
| Lưu nháp / Hoàn thành | 6 |
| Editable when locked | 1, 2, 3, 6 |
| Photo admin when locked | 3, 6 |
| Paper chrome | 6 |
| Filler Lưu unchanged | 5 |
| Vitest only | all |
| Deploy firestore.rules | human |

## Notes for implementers

- Filler `saveMemberDraft` / `updateDraftById` must **not** pass `allowWhenLocked`.
- Create Lưu nháp still needs valid CCCD (`normalizeCccd`) — domain identity key.
- Prefer member-specific i18n keys over reusing temple message keys.
- Deploy reminder: publish updated `firestore.rules` with the release.
- Portrait preview colors: prefer `--parchment` / `--line` if touching styles (temple already fixed).
)
