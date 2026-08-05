# Member & Temple Audit Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Append-only audit logs for member/temple mutations (content, lock/unlock, create, edit-request, photo/document) with full before→after diffs, viewable by admin via a “Xem lịch sử” modal on detail forms.

**Architecture:** Pure `buildAuditChanges` + `auditLogRepo` helpers write into `members|temples/{id}/auditLogs` inside the same Firestore `runTransaction` as the parent mutation. Use-cases pass `AuditActor`. Admin reads via TanStack Query + shared `AuditHistoryModal`.

**Tech Stack:** Firestore, Firebase security rules, TanStack Query, Mantine Modal, Vitest, existing use-case/repo layering

**Spec:** `docs/superpowers/specs/2026-08-05-member-temple-audit-log-design.md`

## Global Constraints

- Work in the current workspace only — **never** `git worktree add`
- Create and use a feature branch from `main` (e.g. `feat/member-temple-audit-log`); if already on another branch with WIP, stop and ask
- Full before/after values (no PII masking)
- Same transaction as parent write; skip audit when `changes` is empty for content `updated`
- Admin-only read of audit logs; filler may create logs but never read
- Prefer Vitest; **no new Cypress**
- No Cloud Functions; no global audit screen; no backfill; no cascade delete of logs on parent delete
- After merge squash into `main`, delete the local feature branch unless asked otherwise

## File Structure

| File | Responsibility |
| --- | --- |
| `docs/superpowers/specs/2026-08-05-member-temple-audit-log-design.md` | Spec (already on `main`) |
| `docs/superpowers/plans/2026-08-05-member-temple-audit-log.md` | This plan |
| `tanstack-app/src/domain/auditLog.ts` | `AuditAction`, `AuditActor`, `AuditChange`, `AuditLogEntry` |
| `tanstack-app/src/domain/buildAuditChanges.ts` | Pure deep diff (ignore `updatedAt`) |
| `tanstack-app/src/domain/buildAuditChanges.test.ts` | Unit tests for diff |
| `tanstack-app/src/repositories/auditLogRepo.ts` | Transaction append + list by parent |
| `tanstack-app/src/repositories/memberRepo.ts` | Append audit inside mutating transactions |
| `tanstack-app/src/repositories/templeRepo.ts` | Same for temples |
| `tanstack-app/src/test/memoryStores.ts` | In-memory audit maps + store methods |
| `tanstack-app/src/use-cases/*.ts` | Pass `AuditActor` into store mutations |
| `firebase/firestore.rules` | `auditLogs` subcollection rules |
| `tanstack-app/src/firebase/firestoreRules.integration.test.ts` | Rules coverage for audit |
| `tanstack-app/src/query/adminKeys.ts` | `memberAuditLogs` / `templeAuditLogs` keys |
| `tanstack-app/src/query/auditLogQueries.ts` | `queryOptions` for paginated list |
| `tanstack-app/src/components/admin/AuditHistoryModal.tsx` | Shared history modal UI |
| `tanstack-app/src/components/admin/AuditHistoryModal.test.tsx` | Modal component tests |
| `tanstack-app/src/components/admin/MemberFormPage.tsx` | History button + actor on unlock/lock/save |
| `tanstack-app/src/components/admin/TempleFormPage.tsx` | Same for temple |
| `tanstack-app/messages/vi.json` | i18n for history UI + action labels |

---

### Task 0: Branch from main + commit plan

**Files:**
- Add: `docs/superpowers/plans/2026-08-05-member-temple-audit-log.md`

**Interfaces:**
- Consumes: clean-enough `main` (spec commit already present)
- Produces: branch `feat/member-temple-audit-log` with this plan committed

- [ ] **Step 1: Confirm branch situation**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git branch --show-current
git status -sb
```

If not on `main` / `master`: **stop and ask** whether to stash/commit WIP and branch from `main`, or continue on current branch.

- [ ] **Step 2: Create feature branch from main**

```bash
git checkout main
git pull
git checkout -b feat/member-temple-audit-log
```

- [ ] **Step 3: Commit this plan**

```bash
git add docs/superpowers/plans/2026-08-05-member-temple-audit-log.md
git commit -m "$(cat <<'EOF'
docs: plan member and temple audit log

EOF
)"
```

---

### Task 1: Domain types + `buildAuditChanges`

**Files:**
- Create: `tanstack-app/src/domain/auditLog.ts`
- Create: `tanstack-app/src/domain/buildAuditChanges.ts`
- Create: `tanstack-app/src/domain/buildAuditChanges.test.ts`

**Interfaces:**
- Consumes: none
- Produces:
  - `AuditAction`, `AuditActor`, `AuditChange`, `AuditLogEntry` (without requiring Firestore id on write payload — use `Omit<AuditLogEntry, 'id'>` for creates)
  - `buildAuditChanges(before: unknown, after: unknown): AuditChange[]`

- [ ] **Step 1: Write the failing tests**

Create `buildAuditChanges.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildAuditChanges } from './buildAuditChanges'

describe('buildAuditChanges', () => {
  it('returns empty when equal', () => {
    expect(buildAuditChanges({ a: 1 }, { a: 1 })).toEqual([])
  })

  it('ignores updatedAt', () => {
    expect(
      buildAuditChanges(
        { name: 'A', updatedAt: 't1' },
        { name: 'A', updatedAt: 't2' },
      ),
    ).toEqual([])
  })

  it('records top-level change', () => {
    expect(buildAuditChanges({ name: 'A' }, { name: 'B' })).toEqual([
      { path: 'name', before: 'A', after: 'B' },
    ])
  })

  it('records nested path with dot notation', () => {
    expect(
      buildAuditChanges(
        { truTri: { dienThoai: '01' } },
        { truTri: { dienThoai: '02' } },
      ),
    ).toEqual([{ path: 'truTri.dienThoai', before: '01', after: '02' }])
  })

  it('treats null before as empty object for created-style diffs', () => {
    expect(buildAuditChanges(null, { name: 'A', updatedAt: 't' })).toEqual([
      { path: 'name', before: undefined, after: 'A' },
    ])
  })

  it('records null ↔ value', () => {
    expect(buildAuditChanges({ photoPath: null }, { photoPath: 'p.jpg' })).toEqual([
      { path: 'photoPath', before: null, after: 'p.jpg' },
    ])
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd tanstack-app && pnpm exec vitest run src/domain/buildAuditChanges.test.ts
```

Expected: FAIL (module missing)

- [ ] **Step 3: Implement types + diff**

`auditLog.ts`:

```ts
export type AuditAction =
  | 'created'
  | 'updated'
  | 'locked'
  | 'unlocked'
  | 'edit_requested'
  | 'photo_uploaded'
  | 'photo_deleted'
  | 'document_uploaded'
  | 'document_deleted'

export type AuditActor = {
  actorType: 'admin' | 'filler'
  actorId: string
}

export type AuditChange = {
  path: string
  before: unknown
  after: unknown
}

export type AuditLogEntry = {
  id: string
  action: AuditAction
  at: string
  actorType: AuditActor['actorType']
  actorId: string
  changes: AuditChange[]
  summary: string | null
}

export type AuditLogWrite = Omit<AuditLogEntry, 'id'>
```

`buildAuditChanges.ts`: deep-compare plain objects/arrays; emit leaf `path`s; skip key `updatedAt` at every level; `before == null` → treat as `{}`; use `Object.is` / JSON-stable equality for primitives; for arrays, if unequal replace whole array at that path (do not expand indices unless both are plain objects — keep simple: arrays compared by `JSON.stringify`).

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd tanstack-app && pnpm exec vitest run src/domain/buildAuditChanges.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/domain/auditLog.ts \
  tanstack-app/src/domain/buildAuditChanges.ts \
  tanstack-app/src/domain/buildAuditChanges.test.ts
git commit -m "$(cat <<'EOF'
feat(audit): add audit types and buildAuditChanges

EOF
)"
```

---

### Task 2: `auditLogRepo` — append in transaction + list

**Files:**
- Create: `tanstack-app/src/repositories/auditLogRepo.ts`
- Create: `tanstack-app/src/repositories/auditLogRepo.test.ts` (unit with mocked transaction / or pure helpers)
- Modify: `tanstack-app/src/test/memoryStores.ts` — in-memory audit storage for later tasks

**Interfaces:**
- Consumes: `AuditLogWrite`, `AuditLogEntry`, `buildAuditChanges`
- Produces:
  - `AuditParent = { collection: 'members' | 'temples'; id: string }`
  - `appendAuditLogInTransaction(transaction, parent, write: AuditLogWrite): void` — always writes (caller decides skip)
  - `maybeAppendAuditFromDiff(transaction, parent, args: { action, actor, at, before, after }): void` — builds changes; **skips write if `action === 'updated' && changes.length === 0`**; for other actions still writes even if changes empty
  - `listAuditLogs(parent, opts: { limit: number; startAfterAt?: string }): Promise<{ entries: AuditLogEntry[]; nextStartAfterAt: string | null }>`
  - Memory: `createMemoryAuditStore()` or maps on existing memory factory: `append` + `list` used by memory member/temple stores

- [ ] **Step 1: Write failing unit tests for `maybeAppendAuditFromDiff` skip behavior**

Test the pure decision by exporting a helper:

```ts
export function shouldWriteAudit(
  action: AuditAction,
  changes: AuditChange[],
): boolean {
  if (action === 'updated' && changes.length === 0) return false
  return true
}
```

```ts
it('skips empty updated', () => {
  expect(shouldWriteAudit('updated', [])).toBe(false)
})
it('writes empty locked', () => {
  expect(shouldWriteAudit('locked', [])).toBe(true)
})
it('writes non-empty updated', () => {
  expect(shouldWriteAudit('updated', [{ path: 'a', before: 1, after: 2 }])).toBe(true)
})
```

- [ ] **Step 2: Run — expect FAIL, then implement `auditLogRepo.ts`**

Implementation notes:

- Subcollection path: `doc(db, parent.collection, parent.id, 'auditLogs', autoId)` via `doc(collection(db, ...))` inside transaction: `const ref = doc(collection(db, parent.collection, parent.id, 'auditLogs')); transaction.set(ref, { ...write without id })`
- `summary`: `changes.length === 0 ? null : String(changes.length)` (field count)
- `listAuditLogs`: `query(collection(...), orderBy('at', 'desc'), limit(n))` + optional `startAfter(startAfterAt)` using a document snapshot or `where('at', '<', …)` if simpler — prefer `startAfter` on last doc snap stored by caller; for v1 API accept `startAfterAt: string` and use `where('at', '<', startAfterAt)` with `orderBy('at','desc')` to avoid holding snaps in UI
- Persist Firestore fields without `id` on the document; set `id` from snap id when reading

- [ ] **Step 3: Add memory audit helpers in `memoryStores.ts`**

```ts
// on the shared store bag:
auditLogs: Map<string, AuditLogEntry[]>  // key = `${collection}:${parentId}`

function memoryAppendAudit(parentKey: string, write: AuditLogWrite): AuditLogEntry
function memoryListAudit(parentKey: string, limit: number, startAfterAt?: string)
```

Wire later tasks to call these from memory member/temple mutators.

- [ ] **Step 4: Tests PASS + commit**

```bash
cd tanstack-app && pnpm exec vitest run src/repositories/auditLogRepo.test.ts
git add tanstack-app/src/repositories/auditLogRepo.ts \
  tanstack-app/src/repositories/auditLogRepo.test.ts \
  tanstack-app/src/test/memoryStores.ts
git commit -m "$(cat <<'EOF'
feat(audit): add auditLogRepo append and list helpers

EOF
)"
```

---

### Task 3: Wire member mutations + use-cases + memory store

**Files:**
- Modify: `tanstack-app/src/repositories/memberRepo.ts` — `MemberStore` mutating methods accept `audit: AuditActor`
- Modify: `tanstack-app/src/test/memoryStores.ts` — mirror signatures + append audits
- Modify use-cases (pass actor):
  - `saveAndLockMember.ts` — add `actorId` (phone) on input; `actorType: 'filler'`
  - `saveAdminMember.ts` — add `audit: AuditActor`
  - `lockMember.ts` / `unlockMember.ts` — unlock gains `audit: AuditActor`
  - `requestMemberEdit.ts` — filler actor from `phone`
  - `uploadMemberPhoto.ts` / `deleteMemberPhoto.ts` — add `audit: AuditActor`
  - `uploadMemberDocument.ts` / `deleteMemberDocument.ts` — add `audit: AuditActor`
- Modify call sites: admin `MemberFormPage`, filler `MemberEditorForm` (and list unlock if any)
- Update existing use-case / repo tests to pass `audit`

**Interfaces:**
- Consumes: `maybeAppendAuditFromDiff`, `AuditActor`
- Produces: every member mutation that the spec lists writes one audit log when `shouldWriteAudit`

**MemberStore signature changes (conceptual):**

```ts
createOrUpdateAndLock(input: CreateOrUpdateMemberDraftInput & { audit: AuditActor })
updateDraftById(id, patch, options?: { allowWhenLocked?: boolean; audit?: AuditActor })
// Prefer required audit on admin update path via saveAdminMember always passing audit
lock(memberId, lockedBy, audit: AuditActor)
unlock(memberId, audit: AuditActor)
requestEdit(memberId, phone) // actor from phone
setPhotoPath(memberId, photoPath, audit: AuditActor)
mergeDocumentSide(..., audit: AuditActor)
removeDocumentPaths(..., audit: AuditActor)
```

Inside each `runTransaction`, after computing `existing` and `member`:

```ts
maybeAppendAuditFromDiff(transaction, { collection: 'members', id: memberId }, {
  action: /* created|updated|locked|… */,
  actor: audit,
  at: now,
  before: existing ?? null,
  after: member,
})
```

Action mapping:

| Method | action |
| --- | --- |
| createOrUpdateAndLock mode created/updated | `created` / `updated` |
| updateDraftById | `updated` |
| lock | `locked` |
| unlock | `unlocked` |
| requestEdit | `edit_requested` |
| setPhotoPath non-null / null | `photo_uploaded` / `photo_deleted` |
| mergeDocumentSide | `document_uploaded` |
| removeDocumentPaths | `document_deleted` |

- [ ] **Step 1: Extend one use-case test first (TDD)** — e.g. `saveAndLockMember.test.ts` or `memberDraft.integration` memory path: after save, `memoryListAudit('members:…')` has one `created`/`updated` with actor filler

- [ ] **Step 2: Implement repo + memory + use-case actor plumbing until that test passes**

- [ ] **Step 3: Fix remaining member tests that break on new required `audit` params**

```bash
cd tanstack-app && pnpm exec vitest run src/use-cases/saveAndLockMember.test.ts \
  src/use-cases/lockMember.ts \
  src/use-cases/saveAdminDraft.test.ts \
  src/repositories/memberRepo.integration.test.ts
```

(Adjust globs to actual test files; run broader `src/use-cases/*Member*` if needed.)

Filler phone for actor: `normalizeVnPhone` from entry phone when available; else `'filler'`. Admin: `claim.uid`.

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(audit): write member audit logs on mutations

EOF
)"
```

---

### Task 4: Wire temple mutations + use-cases

**Files:**
- Modify: `tanstack-app/src/repositories/templeRepo.ts` + memory temple store
- Modify: `saveAndLockTemple.ts`, `saveAdminTemple.ts`, `lockTemple.ts`, `unlockTemple.ts`, `requestTempleEdit.ts`, `uploadTemplePhoto.ts`, `deleteTemplePhoto.ts`
- Modify: `TempleFormPage.tsx`, `TempleEditorForm.tsx`, temples list unlock call sites
- Update temple tests similarly

**Interfaces:**
- Same pattern as Task 3 with `collection: 'temples'`
- No document_* actions for temples

- [ ] **Step 1: Failing memory test** — lock temple writes `action: 'locked'` audit

- [ ] **Step 2: Implement temple repo + use-cases + call sites**

- [ ] **Step 3: Run temple-focused tests**

```bash
cd tanstack-app && pnpm exec vitest run src/use-cases/templeDraft.test.ts \
  src/use-cases/saveAndLockTemple.test.ts
```

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(audit): write temple audit logs on mutations

EOF
)"
```

---

### Task 5: Firestore rules for `auditLogs`

**Files:**
- Modify: `firebase/firestore.rules`
- Modify: `tanstack-app/src/firebase/firestoreRules.integration.test.ts`

**Interfaces:**
- Consumes: existing `canWriteDirectory`, `validInviteScope`, `isKiemSoat`
- Produces: nested match under members and temples

- [ ] **Step 1: Write failing rules tests**

Add describe `member auditLogs` / `temple auditLogs`:

1. Admin (`canWriteDirectory`) can `get`/`list` audit docs
2. Unauthenticated / filler token **cannot** `get` or `list`
3. Admin can `create` valid-shaped audit doc
4. Filler with valid invite on parent can `create` valid-shaped audit doc
5. Nobody can `update` or `delete` audit doc
6. Create rejected if missing `action` / `actorId` / `changes`

Valid shape helper in rules (shared function at file top or duplicated lightly):

```
function isValidAuditCreate() {
  return request.resource.data.keys().hasAll(['action', 'at', 'actorType', 'actorId', 'changes'])
    && request.resource.data.action in ['created','updated','locked','unlocked','edit_requested','photo_uploaded','photo_deleted','document_uploaded','document_deleted']
    && request.resource.data.at is string
    && request.resource.data.actorType in ['admin', 'filler']
    && request.resource.data.actorId is string
    && request.resource.data.actorId.size() > 0
    && request.resource.data.changes is list;
}
```

Nested match (inside `match /members/{memberId}` after parent allows):

```
match /auditLogs/{logId} {
  allow read: if canWriteDirectory();
  allow create: if isValidAuditCreate() && (
    canWriteDirectory()
    || (resource == null
        && get(/databases/$(database)/documents/members/$(memberId)).data.inviteId is string
        && validInviteScope(get(/databases/$(database)/documents/members/$(memberId)).data)
        && !isKiemSoat())
  );
  allow update, delete: if false;
}
```

Mirror for temples (use temples invite scope helpers). Note: on `create`, `resource` is null — use `get(...parent...)` for invite check.

- [ ] **Step 2: Run integration tests — expect FAIL**

```bash
cd tanstack-app && pnpm test:integration -- src/firebase/firestoreRules.integration.test.ts
```

(Start emulators if required by project convention.)

- [ ] **Step 3: Update `firestore.rules` until PASS**

- [ ] **Step 4: Commit**

```bash
git add firebase/firestore.rules \
  tanstack-app/src/firebase/firestoreRules.integration.test.ts
git commit -m "$(cat <<'EOF'
feat(audit): firestore rules for append-only auditLogs

EOF
)"
```

---

### Task 6: Query keys + `auditLogQueries`

**Files:**
- Modify: `tanstack-app/src/query/adminKeys.ts`
- Modify: `tanstack-app/src/query/adminKeys.test.ts`
- Create: `tanstack-app/src/query/auditLogQueries.ts`
- Create: `tanstack-app/src/query/auditLogQueries.test.ts` (key shape / options smoke)

**Interfaces:**
- Produces:

```ts
// adminKeys
memberAuditLogs: (memberId: string) => [...adminKeys.member(memberId), 'auditLogs'] as const
templeAuditLogs: (templeId: string) => [...adminKeys.temple(templeId), 'auditLogs'] as const

export function memberAuditLogsQuery(memberId: string, pageSize = 20) {
  return queryOptions({
    queryKey: adminKeys.memberAuditLogs(memberId),
    queryFn: () => listAuditLogs({ collection: 'members', id: memberId }, { limit: pageSize }),
    staleTime: 60_000,
    enabled: !!memberId,
  })
}
```

For “Tải thêm”, either:

- Use `useInfiniteQuery` with `pageParam: startAfterAt`, or
- Keep local state of loaded entries + `nextStartAfterAt` in the modal (simpler, preferred for v1)

Prefer modal-local pagination calling `listAuditLogs` directly via a small hook `useAuditLogPages(parent)` to avoid infinite-query complexity — still use `queryKey` for first page `useQuery` + imperative fetch for more.

- [ ] **Step 1: Failing adminKeys test for new keys**

- [ ] **Step 2: Implement keys + queryOptions**

- [ ] **Step 3: PASS + commit**

```bash
git commit -m "$(cat <<'EOF'
feat(audit): add admin query keys and audit list options

EOF
)"
```

---

### Task 7: `AuditHistoryModal` + i18n

**Files:**
- Create: `tanstack-app/src/components/admin/AuditHistoryModal.tsx`
- Create: `tanstack-app/src/components/admin/AuditHistoryModal.test.tsx`
- Modify: `tanstack-app/messages/vi.json` (+ run paraglide via test script)

**Interfaces:**
- Props:

```ts
type AuditHistoryModalProps = {
  opened: boolean
  onClose: () => void
  title: string // e.g. member name / temple danhHieu
  parent: { collection: 'members' | 'temples'; id: string }
}
```

- i18n keys (add to `vi.json`):

```json
"admin_audit_history": "Xem lịch sử",
"admin_audit_modal_title": "Lịch sử thay đổi",
"admin_audit_empty": "Chưa có lịch sử.",
"admin_audit_load_more": "Tải thêm",
"admin_audit_load_error": "Không tải được lịch sử.",
"admin_audit_actor_admin": "Admin",
"admin_audit_actor_filler": "Filler",
"admin_audit_action_created": "Tạo mới",
"admin_audit_action_updated": "Cập nhật",
"admin_audit_action_locked": "Khoá",
"admin_audit_action_unlocked": "Mở khoá",
"admin_audit_action_edit_requested": "Yêu cầu chỉnh sửa",
"admin_audit_action_photo_uploaded": "Tải ảnh lên",
"admin_audit_action_photo_deleted": "Xoá ảnh",
"admin_audit_action_document_uploaded": "Tải tài liệu lên",
"admin_audit_action_document_deleted": "Xoá tài liệu"
```

- [ ] **Step 1: Write component tests**

```ts
it('shows empty state', async () => {
  // mock listAuditLogs → []
  render(<AuditHistoryModal opened onClose={() => {}} title="A" parent={{ collection: 'members', id: 'm1' }} />)
  expect(await screen.findByText(/Chưa có lịch sử/)).toBeTruthy()
})

it('renders an entry with before → after', async () => {
  // mock one updated entry with changes
  expect(await screen.findByText(/phapDanh/)).toBeTruthy()
})

it('load more appends', async () => { /* mock next page */ })
```

- [ ] **Step 2: Implement modal** — Mantine `Modal`, `Stack` of `Paper`/`Box` entries; format `at` with existing date helpers if any; stringify non-strings via `JSON.stringify`; `Button` load more when `nextStartAfterAt` set

- [ ] **Step 3: PASS + commit**

```bash
git commit -m "$(cat <<'EOF'
feat(audit): add AuditHistoryModal and Vietnamese labels

EOF
)"
```

---

### Task 8: Wire admin form pages

**Files:**
- Modify: `tanstack-app/src/components/admin/MemberFormPage.tsx`
- Modify: `tanstack-app/src/components/admin/MemberFormPage.test.tsx`
- Modify: `tanstack-app/src/components/admin/TempleFormPage.tsx`
- Modify: `tanstack-app/src/components/admin/TempleFormPage.test.tsx`

**Interfaces:**
- Consumes: `AuditHistoryModal`, `m.admin_audit_history()`
- Show history button only when `mode === 'edit' && memberId/templeId`
- Ensure lock/unlock/save mutations pass `audit: { actorType: 'admin', actorId: claim.uid }`

- [ ] **Step 1: Failing test** — MemberFormPage edit mode has button “Xem lịch sử”; click opens dialog with title “Lịch sử thay đổi”

- [ ] **Step 2: Implement button + modal state on both form pages** (place near lock/unlock in sticky actions or header actions group)

- [ ] **Step 3: Run form tests**

```bash
cd tanstack-app && pnpm exec vitest run \
  src/components/admin/MemberFormPage.test.tsx \
  src/components/admin/TempleFormPage.test.tsx \
  src/components/admin/AuditHistoryModal.test.tsx
```

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(audit): show history modal on admin member and temple forms

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Full before/after diffs | 1 |
| Actions enum (incl. media/docs) | 1, 3, 4 |
| Subcollection storage + same transaction | 2, 3, 4 |
| Skip empty `updated` | 2 |
| Actor admin/filler | 3, 4 |
| Admin modal on detail forms | 7, 8 |
| No filler UI | 8 (no filler changes for viewer) |
| Rules admin read, append-only, filler create | 5 |
| Pagination / load more | 6, 7 |
| Vitest only | all |
| No backfill / no global audit / no CF | — constrained |

## Self-review notes

- Types (`AuditActor`, `AuditAction`, `maybeAppendAuditFromDiff`) stay consistent across tasks 1–4.
- Unlock actor plumbing explicitly required (spec) — Task 3/4 + form pages.
- Document actions only on member paths — Task 3; temples Task 4 omits them.
- Rules tests cover read deny for filler even though filler can create.
