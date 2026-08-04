# Form Local Draft, Lock & Edit Request Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add browser localStorage draft resume for member/temple forms; filler Lưu confirms then save-and-locks; filler can request edit; admin unlocks from list + detail.

**Architecture:** Keep `status: 'draft' | 'locked'`; add `editRequestedAt` / `editRequestedBy` on Member & Temple. Filler persist path becomes `saveAndLock*` (single write ending locked). Shared pure `formLocalDraft` helpers + `useFormLocalDraft` hydrate/debounce/clear. Firestore rules: filler create/update profile must end locked; filler may set edit-request fields or media metadata (`photoPath` / `documents`) on locked docs; admin unlock/lock clears edit-request flags.

**Tech Stack:** TypeScript, Firestore + rules, Vitest (+ rules integration tests), TanStack Query/Router, Mantine Modal, Paraglide (`messages/vi.json`), `localStorage`.

## Global Constraints

- Spec: [docs/superpowers/specs/2026-08-04-form-local-draft-lock-edit-request-design.md](../specs/2026-08-04-form-local-draft-lock-edit-request-design.md)
- Lock / confirm / request-edit: **filler only**. Admin Lưu nháp / Hoàn thành unchanged (no auto-lock).
- localStorage: **filler + admin**; text/select fields only — never File/blob/base64 photos.
- `lockedBy` on filler save-and-lock: literal `'filler'`.
- `editRequestedBy`: filler entry phone string.
- No email/SMS; no `edit_requested` status; no `editRequests` collection.
- Post-save media upload still runs after lock → rules **must** allow filler locked updates that only change `photoPath` and/or `documents` (+ `updatedAt`).
- Import alias: `#/domain/...`, `#/repositories/...`, `#/use-cases/...`, `#/components/...`, `#/hooks/...` (or colocated under `components/filler` if hooks folder absent — prefer `tanstack-app/src/lib/formLocalDraft.ts` + `tanstack-app/src/hooks/useFormLocalDraft.ts`).
- No comments unless non-obvious WHY.
- Workspace: implement on **new branch from `main`** (`feat/form-local-draft-lock-edit-request`); **do not** use git worktrees.
- TDD: failing test → implement → pass → commit per task.
- Run unit tests from `tanstack-app`: `pnpm test -- <path>`. Rules: `pnpm test:integration` with emulator when touching rules.

---

## File Structure

- Modify: `tanstack-app/src/domain/types.ts` — `editRequestedAt`, `editRequestedBy` on Member & Temple
- Modify: `tanstack-app/src/test/memoryStores.ts` — defaults + lock/unlock/requestEdit/createOrUpdateAndLock
- Modify: `tanstack-app/src/repositories/memberRepo.ts` — `createOrUpdateAndLock`, `requestEdit`, lock/unlock clear flags; preserve `editRequested*` on unrelated updates
- Modify: `tanstack-app/src/repositories/templeRepo.ts` — same
- Create: `tanstack-app/src/use-cases/saveAndLockMember.ts` (+ test)
- Create: `tanstack-app/src/use-cases/saveAndLockTemple.ts` (+ test)
- Create: `tanstack-app/src/use-cases/requestMemberEdit.ts` (+ test)
- Create: `tanstack-app/src/use-cases/requestTempleEdit.ts` (+ test)
- Modify: `tanstack-app/src/use-cases/unlockMember.ts` / `unlockTemple.ts` / `lockMember.ts` / `lockTemple.ts` behavior via repo
- Modify: `tanstack-app/src/use-cases/unlock.test.ts` — assert edit-request cleared
- Modify: `firebase/firestore.rules` — filler save-and-lock, edit-request, media-on-locked
- Modify: `tanstack-app/src/firebase/firestoreRules.integration.test.ts`
- Create: `tanstack-app/src/lib/formLocalDraft.ts` (+ test)
- Create: `tanstack-app/src/hooks/useFormLocalDraft.ts` (+ test)
- Modify: filler `MemberEditorForm.tsx`, `TempleEditorForm.tsx` — confirm modal, saveAndLock, request edit, local draft
- Modify: admin `MemberFormPage.tsx`, `TempleFormPage.tsx` — local draft only
- Modify: `MembersListPage.tsx`, `TemplesListPage.tsx` — badge, filter, row unlock
- Create: `tanstack-app/src/components/filler/FillerSaveConfirmModal.tsx` (+ test)
- Modify: `tanstack-app/messages/vi.json` — new + updated copy
- Optionally deprecate filler use of `saveMemberDraft` / `saveTempleDraft` (keep for retreat route only if still used — check `r.$token.member.new`; if shared, either keep draft save for retreat or align retreat with lock — **default: retreat member create keeps current draft save unless it uses the same editor; if same `MemberEditorForm`, retreat also save-and-locks**)

---

### Task 1: Domain fields + memory store defaults

**Files:**
- Modify: `tanstack-app/src/domain/types.ts`
- Modify: `tanstack-app/src/test/memoryStores.ts`
- Modify: `tanstack-app/src/use-cases/unlock.test.ts` (and any Member/Temple fixtures that fail typecheck)

**Interfaces:**
- Produces on `Member` and `Temple`:
  - `editRequestedAt: string | null`
  - `editRequestedBy: string | null`

- [ ] **Step 1: Add fields to types**

```ts
// On Member and Temple, after lockedBy:
editRequestedAt: string | null
editRequestedBy: string | null
```

- [ ] **Step 2: Fix all TypeScript fixture compile errors**

In `memoryStores.ts` create paths, set `editRequestedAt: null`, `editRequestedBy: null`.  
In `unlock.test.ts` and other fixtures, add the two null fields.  
Preserve fields on `createOrUpdateDraft` / `updateDraftById` spreads (do not wipe unless locking/unlocking — lock/unlock clearing comes in Task 2).

- [ ] **Step 3: Run typecheck / unlock tests**

Run: `cd tanstack-app && pnpm test -- src/use-cases/unlock.test.ts`

Expected: PASS (behavior unchanged until Task 2 clears flags)

- [ ] **Step 4: Commit**

```bash
git add tanstack-app/src/domain/types.ts tanstack-app/src/test/memoryStores.ts tanstack-app/src/use-cases/unlock.test.ts
# add any other fixture files the compiler forced you to touch
git commit -m "$(cat <<'EOF'
feat: add editRequested fields on member and temple.

EOF
)"
```

---

### Task 2: Repo — save-and-lock, requestEdit, clear flags on lock/unlock

**Files:**
- Modify: `tanstack-app/src/repositories/memberRepo.ts`
- Modify: `tanstack-app/src/repositories/templeRepo.ts`
- Modify: `tanstack-app/src/test/memoryStores.ts`
- Create: `tanstack-app/src/repositories/memberLockEdit.memory.test.ts`
- Create: `tanstack-app/src/repositories/templeLockEdit.memory.test.ts` (or one shared file covering both memory stores)

**Interfaces:**
- Produces on `MemberStore` / `TempleStore`:
  - `createOrUpdateAndLock(input): Promise<{ member|temple; mode: 'created' | 'updated' }>` — same identity inputs as draft create, but result `status: 'locked'`, `lockedAt: now`, `lockedBy: 'filler'`, `editRequestedAt/By: null`
  - `requestEdit(id, phone: string): Promise<Member|Temple>` — if already has `editRequestedAt`, return unchanged; if not locked, throw `DomainError('INVALID_STATUS', ...)`; else set `editRequestedAt`/`editRequestedBy`
- Modify `lock` / `unlock` to set `editRequestedAt: null`, `editRequestedBy: null`

- [ ] **Step 1: Write failing memory-store tests**

```ts
import { describe, expect, it } from 'vitest'
import { createMemoryMemberStore } from '#/test/memoryStores'

describe('member createOrUpdateAndLock', () => {
  it('creates locked with lockedBy filler and clears edit request', async () => {
    const store = createMemoryMemberStore([])
    const { member, mode } = await store.createOrUpdateAndLock({
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      inviteId: 'inv-1',
      cccd: '001099012345',
      patch: { theDanh: 'A', dienThoai: '0901111111' },
    })
    expect(mode).toBe('created')
    expect(member.status).toBe('locked')
    expect(member.lockedBy).toBe('filler')
    expect(member.lockedAt).toBeTruthy()
    expect(member.editRequestedAt).toBeNull()
    expect(member.theDanh).toBe('A')
  })

  it('updates draft into locked', async () => {
    const store = createMemoryMemberStore([
      {
        id: 'gd-i_tang_001099012345',
        orgUnitId: 'gd-i',
        sanghaType: 'tang',
        status: 'draft',
        cccd: '001099012345',
        inviteId: 'inv-1',
        currentTempleId: null,
        photoPath: null,
        createdAt: '2026-07-19T00:00:00.000Z',
        updatedAt: '2026-07-19T00:00:00.000Z',
        lockedAt: null,
        lockedBy: null,
        editRequestedAt: null,
        editRequestedBy: null,
      },
    ])
    const { member, mode } = await store.createOrUpdateAndLock({
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      inviteId: 'inv-1',
      cccd: '001099012345',
      patch: { theDanh: 'B' },
    })
    expect(mode).toBe('updated')
    expect(member.status).toBe('locked')
    expect(member.theDanh).toBe('B')
  })

  it('rejects when already locked', async () => {
    const store = createMemoryMemberStore([
      {
        id: 'gd-i_tang_001099012345',
        orgUnitId: 'gd-i',
        sanghaType: 'tang',
        status: 'locked',
        cccd: '001099012345',
        inviteId: 'inv-1',
        currentTempleId: null,
        photoPath: null,
        createdAt: '2026-07-19T00:00:00.000Z',
        updatedAt: '2026-07-19T01:00:00.000Z',
        lockedAt: '2026-07-19T01:00:00.000Z',
        lockedBy: 'filler',
        editRequestedAt: null,
        editRequestedBy: null,
      },
    ])
    await expect(
      store.createOrUpdateAndLock({
        orgUnitId: 'gd-i',
        sanghaType: 'tang',
        inviteId: 'inv-1',
        cccd: '001099012345',
        patch: { theDanh: 'X' },
      }),
    ).rejects.toMatchObject({ code: 'RECORD_LOCKED' })
  })
})

describe('member requestEdit', () => {
  it('sets flag once', async () => {
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
        createdAt: '2026-07-19T00:00:00.000Z',
        updatedAt: '2026-07-19T01:00:00.000Z',
        lockedAt: '2026-07-19T01:00:00.000Z',
        lockedBy: 'filler',
        editRequestedAt: null,
        editRequestedBy: null,
      },
    ])
    const first = await store.requestEdit('m1', '0901234567')
    expect(first.editRequestedBy).toBe('0901234567')
    expect(first.editRequestedAt).toBeTruthy()
    const second = await store.requestEdit('m1', '0909999999')
    expect(second.editRequestedBy).toBe('0901234567')
    expect(second.editRequestedAt).toBe(first.editRequestedAt)
  })
})

describe('unlock clears edit request', () => {
  it('clears editRequested*', async () => {
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
        createdAt: '2026-07-19T00:00:00.000Z',
        updatedAt: '2026-07-19T01:00:00.000Z',
        lockedAt: '2026-07-19T01:00:00.000Z',
        lockedBy: 'filler',
        editRequestedAt: '2026-08-04T00:00:00.000Z',
        editRequestedBy: '0901234567',
      },
    ])
    const result = await store.unlock('m1')
    expect(result.status).toBe('draft')
    expect(result.editRequestedAt).toBeNull()
    expect(result.editRequestedBy).toBeNull()
  })
})
```

Mirror temple cases in the same or sibling file (`createOrUpdateAndLock` / `requestEdit` / unlock).

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd tanstack-app && pnpm test -- src/repositories/memberLockEdit.memory.test.ts`

Expected: FAIL — methods missing

- [ ] **Step 3: Implement on memory stores + Firestore repos**

`createOrUpdateAndLock`: clone `createOrUpdateDraft` transaction logic but set `status: 'locked'`, `lockedAt: now`, `lockedBy: 'filler'`, `editRequestedAt: null`, `editRequestedBy: null`. Still throw `RECORD_LOCKED` if existing is locked.

`requestEdit(id, phone)`: load; if `status !== 'locked'` throw `INVALID_STATUS`; if `editRequestedAt` set return existing; else set timestamps/phone.

`lock` / `unlock`: always null out `editRequestedAt` / `editRequestedBy`.

Export new methods on `MemberStore` / `TempleStore` and `memberRepo` / `templeRepo`.

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd tanstack-app && pnpm test -- src/repositories/memberLockEdit.memory.test.ts src/use-cases/unlock.test.ts`

Update `unlock.test.ts` to assert `editRequested*` cleared when unlocking a flagged record.

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/repositories tanstack-app/src/test/memoryStores.ts tanstack-app/src/use-cases/unlock.test.ts
git commit -m "$(cat <<'EOF'
feat: add save-and-lock and edit-request repo methods.

EOF
)"
```

---

### Task 3: Use-cases — `saveAndLock*` + `request*Edit`

**Files:**
- Create: `tanstack-app/src/use-cases/saveAndLockMember.ts`
- Create: `tanstack-app/src/use-cases/saveAndLockMember.test.ts`
- Create: `tanstack-app/src/use-cases/saveAndLockTemple.ts`
- Create: `tanstack-app/src/use-cases/saveAndLockTemple.test.ts`
- Create: `tanstack-app/src/use-cases/requestMemberEdit.ts`
- Create: `tanstack-app/src/use-cases/requestMemberEdit.test.ts`
- Create: `tanstack-app/src/use-cases/requestTempleEdit.ts`
- Create: `tanstack-app/src/use-cases/requestTempleEdit.test.ts`

**Interfaces:**
- `saveAndLockMember(input: SaveMemberDraftInput, ...): Promise<{ member; mode }>` — same input shape as `saveMemberDraft`, sanitize protected keys (add `editRequestedAt`/`editRequestedBy` to protected list), call `createOrUpdateAndLock`
- `saveAndLockTemple(...)` — mirror `saveTempleDraft` phone merge, then `createOrUpdateAndLock`
- `requestMemberEdit({ memberId, phone }, store?)`
- `requestTempleEdit({ templeId, phone }, store?)`

- [ ] **Step 1: Write failing use-case tests** (memory stores + fake invite store like `saveMemberDraft` tests)

```ts
it('saveAndLockMember returns locked member', async () => {
  // arrange invite + empty member store
  const result = await saveAndLockMember(
    { token: 't', orgUnitId: 'gd-i', sanghaType: 'tang', cccd: '001099012345', patch: { theDanh: 'A', dienThoai: '0901' } },
    memberStore,
    inviteStore,
  )
  expect(result.member.status).toBe('locked')
  expect(result.member.lockedBy).toBe('filler')
})

it('requestMemberEdit sets phone', async () => {
  const result = await requestMemberEdit({ memberId: 'm1', phone: '0901234567' }, store)
  expect(result.editRequestedBy).toBe('0901234567')
})
```

- [ ] **Step 2: Run — FAIL**

Run: `cd tanstack-app && pnpm test -- src/use-cases/saveAndLockMember.test.ts src/use-cases/requestMemberEdit.test.ts`

- [ ] **Step 3: Implement use-cases** (copy sanitize/invite pattern from `saveMemberDraft.ts` / `saveTempleDraft.ts`)

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add saveAndLock and requestEdit use-cases.

EOF
)"
```

---

### Task 4: Firestore rules + integration tests

**Files:**
- Modify: `firebase/firestore.rules`
- Modify: `tanstack-app/src/firebase/firestoreRules.integration.test.ts`

**Rule intent (members; temples analogous):**

1. **Admin create** still `status == 'draft'` + null locks.
2. **Filler create** allowed when `status == 'locked' && lockedBy == 'filler' && lockedAt is string && editRequestedAt == null && editRequestedBy == null` + valid invite.
3. **Filler update draft → locked** with profile changes: `resource.status == 'draft' && request.status == 'locked' && lockedBy == 'filler' && editRequested* null` + invite + core identity unchanged.
4. **Remove** (or stop relying on) filler updates that leave `status == 'draft'` for profile saves.
5. **Filler edit-request:** `resource.status == 'locked' && request.status == 'locked' && lockFieldsUnchanged() && affectedKeys only editRequestedAt, editRequestedBy, updatedAt` + invite.
6. **Filler media on locked:** `resource.status == 'locked' && lockFieldsUnchanged() && editRequested fields unchanged && affectedKeys only photoPath and/or documents and updatedAt` + invite.
7. **Admin lock transition** `affectedKeys` may include `editRequestedAt`, `editRequestedBy` (clearing on lock/unlock).

Helper sketch:

```javascript
function editRequestFieldsUnchanged() {
  return request.resource.data.editRequestedAt == resource.data.editRequestedAt
    && request.resource.data.editRequestedBy == resource.data.editRequestedBy;
}

function isFillerEditRequest() {
  return resource.data.status == 'locked'
    && request.resource.data.status == 'locked'
    && lockFieldsUnchanged()
    && request.resource.data.diff(resource.data).affectedKeys()
         .hasOnly(['editRequestedAt', 'editRequestedBy', 'updatedAt']);
}

function isFillerMediaUpdate() {
  return resource.data.status == 'locked'
    && lockFieldsUnchanged()
    && editRequestFieldsUnchanged()
    && request.resource.data.diff(resource.data).affectedKeys()
         .hasOnly(['photoPath', 'documents', 'updatedAt']);
}
```

(Temples: media keys `photoPath` only if no documents field.)

- [ ] **Step 1: Write failing integration cases** for: filler create locked OK; filler create draft DENIED; filler edit-request OK; filler profile update while locked DENIED; filler photoPath update while locked OK; admin unlock clears edit request OK.

- [ ] **Step 2: Run integration — FAIL where new behavior required**

Run: `cd tanstack-app && pnpm test:integration -- src/firebase/firestoreRules.integration.test.ts`

- [ ] **Step 3: Update rules**

- [ ] **Step 4: Run integration — PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: allow filler save-and-lock and edit-request in rules.

EOF
)"
```

---

### Task 5: `formLocalDraft` pure helpers

**Files:**
- Create: `tanstack-app/src/lib/formLocalDraft.ts`
- Create: `tanstack-app/src/lib/formLocalDraft.test.ts`

**Interfaces:**

```ts
export const FORM_LOCAL_DRAFT_VERSION = 1

export type FormLocalDraftEnvelope<TFields> = {
  version: number
  updatedAt: string
  fields: TFields
}

export function memberDraftStorageKey(args:
  | { kind: 'new'; orgUnitId: string; sanghaType: string; actorId: string }
  | { kind: 'existing'; memberId: string }
): string

export function templeDraftStorageKey(args:
  | { kind: 'new'; orgUnitId: string; actorId: string }
  | { kind: 'existing'; templeId: string }
): string

export function readFormLocalDraft<T>(key: string): FormLocalDraftEnvelope<T> | null
export function writeFormLocalDraft<T>(key: string, fields: T, now?: string): void
export function clearFormLocalDraft(key: string): void
/** Strip non-JSON-safe values; drop keys whose values are File / Blob / undefined. */
export function serializeDraftFields<T extends Record<string, unknown>>(fields: T): T
```

Keys:
- `formDraft:member:new:{orgUnitId}:{sanghaType}:{actorId}`
- `formDraft:member:{memberId}`
- `formDraft:temple:new:{orgUnitId}:{actorId}`
- `formDraft:temple:{templeId}`

- [ ] **Step 1: Failing tests** — round-trip write/read; bad JSON → null; `File` stripped; clear removes key; quota error swallowed (mock `setItem` throw).

- [ ] **Step 2: Run — FAIL**

Run: `cd tanstack-app && pnpm test -- src/lib/formLocalDraft.test.ts`

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add form localStorage draft helpers.

EOF
)"
```

---

### Task 6: `useFormLocalDraft` hook

**Files:**
- Create: `tanstack-app/src/hooks/useFormLocalDraft.ts`
- Create: `tanstack-app/src/hooks/useFormLocalDraft.test.ts`

**Interfaces:**

```ts
export function useFormLocalDraft<TFields extends Record<string, unknown>>(options: {
  storageKey: string
  enabled: boolean
  /** Called once on mount when a draft exists and enabled */
  onRestore?: (fields: TFields) => void
  debounceMs?: number // default 400
}): {
  persist: (fields: TFields) => void
  clear: () => void
  restored: boolean
}
```

Behavior:
- If `!enabled`, no read/write.
- On mount (enabled): `readFormLocalDraft`; if present call `onRestore` once; set `restored`.
- `persist`: debounce `writeFormLocalDraft(serializeDraftFields(fields))`.
- `clear`: cancel debounce + `clearFormLocalDraft`.

- [ ] **Step 1: Failing hook tests** with `renderHook` + fake timers / mock storage helpers (vi.mock `#/lib/formLocalDraft`).

- [ ] **Step 2–4: Implement until PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add useFormLocalDraft hook.

EOF
)"
```

---

### Task 7: i18n strings

**Files:**
- Modify: `tanstack-app/messages/vi.json`

Add (exact Vietnamese OK to refine slightly for tone, keep meaning):

```json
"filler_save_confirm_title": "Xác nhận lưu hồ sơ",
"filler_save_confirm_body": "Sau khi lưu, hồ sơ sẽ bị khóa. Mọi chỉnh sửa sau đó cần sự xác nhận của giáo đoàn.",
"filler_save_confirm_cancel": "Hủy",
"filler_save_confirm_ok": "Xác nhận lưu",
"filler_request_edit": "Yêu cầu chỉnh sửa",
"filler_request_edit_done": "Đã gửi yêu cầu chỉnh sửa. Vui lòng chờ giáo đoàn mở khóa.",
"filler_request_edit_pending": "Đã yêu cầu chỉnh sửa",
"filler_request_edit_error": "Không gửi được yêu cầu. Vui lòng thử lại.",
"filler_local_draft_restored": "Đã khôi phục bản nháp trên thiết bị này. Ảnh/giấy tờ chưa lưu cần chọn lại.",
"filler_save_success": "Đã lưu và khóa hồ sơ.",
"filler_save_redirecting": "Đã lưu và khóa hồ sơ. Đang chuyển trang…",
"admin_filter_edit_requested": "Có yêu cầu chỉnh sửa",
"admin_edit_requested_badge": "Yêu cầu chỉnh sửa",
"admin_members_unlock_row": "Mở khóa",
"admin_temples_unlock_row": "Mở khóa"
```

Run Paraglide compile if the project requires it (`pnpm build` step or existing `paraglide` script — use whatever `package.json` already uses after message edits).

- [ ] **Step 1: Add keys**

- [ ] **Step 2: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add i18n for save confirm, edit request, local draft.

EOF
)"
```

---

### Task 8: Filler UI — confirm modal, saveAndLock, request edit, local draft

**Files:**
- Create: `tanstack-app/src/components/filler/FillerSaveConfirmModal.tsx`
- Create: `tanstack-app/src/components/filler/FillerSaveConfirmModal.test.tsx`
- Modify: `tanstack-app/src/components/filler/MemberEditorForm.tsx` (+ test if exists / create focused test)
- Modify: `tanstack-app/src/components/filler/TempleEditorForm.tsx` (+ test)
- Modify: routes if phone must be plumbed for `editRequestedBy` (entry phone from search params / props — pass `requestPhone` into editors)

**Behavior:**

1. `handleSave`: validate → if invalid return; else open confirm modal (do not call mutation yet).
2. Modal confirm → `saveAndLockMember` / `saveAndLockTemple` → existing media upload path → `clear()` local draft → set UI status to view (parent may remount via query invalidation with `status: locked`).
3. When `status === 'view'` / locked: show **Yêu cầu chỉnh sửa** in sticky actions (or beside badge). Call `requestMemberEdit` with phone. If `editRequestedAt` already set on loaded record, show pending label instead of button.
4. Wire `useFormLocalDraft`: `enabled = status === 'draft'`; `actorId` = phone (filler) ; restore into fields API / initial state; `persist` on draft change (subscribe via fields `onChange` or poll `getDraft` on each field update — match how form already notifies; if no change callback, persist inside existing state updaters / `onDraftChange` added to `MemberFormFields` minimally).
5. Show `Alert` when `restored` with `filler_local_draft_restored`.

- [ ] **Step 1: Modal component test** — title/body/buttons call onConfirm/onCancel

- [ ] **Step 2: Implement modal**

- [ ] **Step 3: Wire MemberEditorForm** — switch mutation to `saveAndLockMember`; confirm gate; request-edit mutation; local draft

- [ ] **Step 4: Wire TempleEditorForm** similarly

- [ ] **Step 5: Vitest for editor** — mock use-cases; assert modal before save; locked shows request button

- [ ] **Step 6: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: filler save confirm, auto-lock, and edit request.

EOF
)"
```

---

### Task 9: Admin forms — localStorage only

**Files:**
- Modify: `tanstack-app/src/components/admin/MemberFormPage.tsx`
- Modify: `tanstack-app/src/components/admin/TempleFormPage.tsx`

**Behavior:**
- `actorId` = Firebase `auth.currentUser?.uid ?? 'admin'`
- `enabled` when form mounted and (create or record `status === 'draft'` OR always while editing — prefer **enabled whenever admin can edit fields**, including locked, since admin edits locked records; clear draft on successful save)
- No confirm modal; no auto-lock
- Restore alert optional (reuse `filler_local_draft_restored` or add `admin_local_draft_restored` same text)

- [ ] **Step 1: Wire both pages**

- [ ] **Step 2: Smoke Vitest if pages already have tests; otherwise skip new Cypress**

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: persist admin member/temple form drafts locally.

EOF
)"
```

---

### Task 10: Admin lists — badge, filter, row unlock

**Files:**
- Modify: `tanstack-app/src/components/admin/MembersListPage.tsx` (+ test if present)
- Modify: `tanstack-app/src/components/admin/TemplesListPage.tsx`
- Modify: `tanstack-app/src/repositories/memberRepo.ts` `list` filter if needed
- Modify: `tanstack-app/src/repositories/templeRepo.ts` `list` filter if needed

**UI:**
- Extra filter option value `'edit_requested'` (client-side filter on loaded pages **or** Firestore `where('editRequestedAt', '!=', null)` if composite indexes allow — prefer **client filter on current result set** for MVP if list already paginated by status/org; if insufficient, add optional query param `editRequestedOnly` using `where('editRequestedAt', '!=', null)` + existing org/sangha filters and document index in `firestore.indexes.json`).
- Badge next to status when `editRequestedAt != null` using `admin_edit_requested_badge`.
- Row action button **Mở khóa** when `status === 'locked'`, calling existing `unlockMember` / `unlockTemple`, invalidate list query. Emphasize (filled button) when edit requested.

**Detail forms:** keep existing unlock buttons (repo already clears flags).

- [ ] **Step 1: Extend list UI + unlock mutation**

- [ ] **Step 2: Vitest** — render row with editRequested shows badge + unlock control (mock data)

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: admin list edit-request badge and unlock action.

EOF
)"
```

---

### Task 11: Final verification

- [ ] **Step 1: Run unit suite subset**

```bash
cd tanstack-app && pnpm test -- src/lib/formLocalDraft.test.ts src/hooks/useFormLocalDraft.test.ts src/use-cases/saveAndLockMember.test.ts src/use-cases/saveAndLockTemple.test.ts src/use-cases/requestMemberEdit.test.ts src/use-cases/requestTempleEdit.test.ts src/repositories/memberLockEdit.memory.test.ts src/components/filler/FillerSaveConfirmModal.test.tsx
```

Expected: PASS

- [ ] **Step 2: Run rules integration**

```bash
cd tanstack-app && pnpm test:integration -- src/firebase/firestoreRules.integration.test.ts
```

Expected: PASS

- [ ] **Step 3: Manual smoke** (dev): filler fill → refresh restores text → Lưu → modal → locked → request edit → admin list badge → unlock → filler editable again

- [ ] **Step 4: Commit any leftover fixes** (or empty skip)

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| localStorage filler + admin | 5, 6, 8, 9 |
| Text-only drafts; no photo in storage | 5, 8 |
| Filler confirm modal copy | 7, 8 |
| save → lock (`lockedBy: 'filler'`) | 2, 3, 8 |
| No filler Firestore draft save on Lưu | 3, 4, 8 |
| Request edit flag | 2, 3, 8 |
| Admin unlock list + detail | 2, 10 (detail already) |
| Rules filler locked create/update + edit request | 4 |
| Media upload after lock | 4 (`isFillerMediaUpdate`) |
| Vitest coverage | each task |
| No email/SMS / no new status enum | Global constraints |

**Placeholder scan:** none intentional.  
**Type consistency:** `createOrUpdateAndLock`, `requestEdit`, `editRequestedAt`/`editRequestedBy`, `lockedBy: 'filler'` used throughout.
