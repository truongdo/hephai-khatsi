# Admin Bulk Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins multi-select and hard-delete temples/members from admin list views, with a simple confirm modal; block temple deletes when members still reference them and show those members (new-tab links).

**Architecture:** Client SDK deletes via repo `deleteMany` + use-cases; admin-only Firestore/Storage rule updates for deletes and phone-index shrink/delete. List pages gain checkbox selection and a toolbar Delete; temple flow pre-checks `currentTempleId` and returns structured blockers (all-or-nothing).

**Tech Stack:** React 19, Mantine 9, TanStack Query, Firebase client SDK, Paraglide, Vitest + Testing Library, Firestore rules unit tests

**Spec:** `docs/superpowers/specs/2026-07-25-admin-bulk-delete-design.md`

## Global Constraints

- Work in the current workspace only — **never** `git worktree add`
- Create and use branch `feat/admin-bulk-delete` from latest `main` (Task 0)
- Hard delete only; list views only; selection + toolbar (no per-row delete, no detail delete)
- Temple delete blocked while any member has `currentTempleId` in the selection; all-or-nothing; member links open in new tab to `/admin/members/$id`
- Simple confirm modal (no type-to-confirm)
- Prefer Vitest; **no new Cypress**
- Leave unrelated dirty files (e.g. `.serena/project.yml`) unstaged
- After merge squash into `main`, delete the local feature branch unless asked otherwise

## File Structure

| File | Responsibility |
| --- | --- |
| `firebase/firestore.rules` | Admin delete temples/members; admin shrink/delete phone indexes |
| `firebase/storage.rules` | Admin delete member photo |
| `tanstack-app/src/firebase/firestoreRules.integration.test.ts` | Rules tests for delete + index shrink |
| `tanstack-app/src/repositories/memberRepo.ts` | `listByCurrentTempleIds`, `deleteMany` |
| `tanstack-app/src/repositories/templeRepo.ts` | `deleteMany` |
| `tanstack-app/src/test/memoryStores.ts` | Memory parity for new store methods |
| `tanstack-app/src/use-cases/deleteTemples.ts` | Pre-check + delete |
| `tanstack-app/src/use-cases/deleteMembers.ts` | Bulk member delete |
| `tanstack-app/src/use-cases/deleteTemples.test.ts` | Unit tests |
| `tanstack-app/src/use-cases/deleteMembers.test.ts` | Unit tests |
| `tanstack-app/src/components/admin/useAdminListSelection.ts` | Selection set helpers |
| `tanstack-app/src/components/admin/AdminConfirmDeleteModal.tsx` | Confirm dialog |
| `tanstack-app/src/components/admin/TempleDeleteBlockedModal.tsx` | Blocker list + new-tab links |
| `tanstack-app/src/components/admin/TemplesListPage.tsx` | Wire selection + delete |
| `tanstack-app/src/components/admin/MembersListPage.tsx` | Wire selection + delete |
| `tanstack-app/messages/vi.json` | Copy |
| List page `*.test.tsx` | Selection / confirm / blocker UI |

---

### Task 0: Branch from main + commit design

**Files:**
- Add: `docs/superpowers/specs/2026-07-25-admin-bulk-delete-design.md`
- Add: `docs/superpowers/plans/2026-07-25-admin-bulk-delete.md` (this plan)

**Interfaces:**
- Consumes: `main`
- Produces: branch `feat/admin-bulk-delete` with docs commits

- [ ] **Step 1: Branch**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git checkout main
git pull
git checkout -b feat/admin-bulk-delete
```

If not on `main` with conflicting WIP: stop and ask. Do not stage `.serena/project.yml`.

- [ ] **Step 2: Commit design + plan**

```bash
git add docs/superpowers/specs/2026-07-25-admin-bulk-delete-design.md \
  docs/superpowers/plans/2026-07-25-admin-bulk-delete.md
git commit -m "$(cat <<'EOF'
docs: admin bulk delete design and plan

EOF
)"
```

---

### Task 1: Firestore + Storage rules for admin delete

**Files:**
- Modify: `firebase/firestore.rules`
- Modify: `firebase/storage.rules`
- Modify: `tanstack-app/src/firebase/firestoreRules.integration.test.ts`

**Interfaces:**
- Consumes: existing `isAdmin()`
- Produces: admin can delete temples/members; admin can shrink/delete phone index docs; admin can delete Storage photos; anon/non-admin still cannot

- [ ] **Step 1: Write failing rules tests**

Extend `firestoreRules.integration.test.ts`:

1. Admin `deleteDoc` on `temples/{id}` and `members/{id}` succeeds; unauthenticated fails.
2. Admin can `updateDoc` phone index to a **smaller** array; anon still fails shrink.
3. Admin can `deleteDoc` on phone index docs; anon cannot.

(If no storage rules test harness exists, skip automated storage test; still update `storage.rules`.)

- [ ] **Step 2: Run tests — expect fail**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/firebase/firestoreRules.integration.test.ts
```

Expected: new admin-delete / shrink assertions fail.

- [ ] **Step 3: Update rules**

In `firebase/firestore.rules`:

- `members` and `temples`: change `allow delete: if false;` → `allow delete: if isAdmin();`
- Phone indexes — allow admin to shrink lists and delete docs; keep non-admin size non-decreasing.

```
allow create, update: if request.resource.data.templeIds is list
  && request.resource.data.templeIds.size() <= 20
  && (
    isAdmin()
    || request.resource.data.templeIds.size() >= (resource == null ? 0 : resource.data.templeIds.size())
  );
allow delete: if isAdmin();
```

(Same for `memberPhoneIndex` with `memberIds`.)

In `firebase/storage.rules` under `members/{memberId}/photo.jpg` add:

```
allow delete: if isAdmin();
```

- [ ] **Step 4: Re-run rules tests — expect pass**

- [ ] **Step 5: Commit**

```bash
git add firebase/firestore.rules firebase/storage.rules \
  tanstack-app/src/firebase/firestoreRules.integration.test.ts
git commit -m "$(cat <<'EOF'
feat: allow admin delete of temples, members, and phone indexes

EOF
)"
```

---

### Task 2: MemberStore — listByCurrentTempleIds + deleteMany

**Files:**
- Modify: `tanstack-app/src/repositories/memberRepo.ts`
- Modify: `tanstack-app/src/test/memoryStores.ts`
- Create: `tanstack-app/src/repositories/memberDelete.memory.test.ts`

**Interfaces:**
- Consumes: `MemberStore`, phone index helpers, `normalizeVnPhone`
- Produces on `MemberStore`:

```ts
listByCurrentTempleIds(templeIds: string[]): Promise<Member[]>
deleteMany(ids: string[]): Promise<void>
```

`listByCurrentTempleIds`: chunk ids ≤30; `where('currentTempleId', 'in', chunk)`; empty → `[]`.

`deleteMany`: per id — load; skip missing; shrink/remove phone index; delete member doc; best-effort Storage `deleteObject` for `photoPath` (catch/ignore).

Memory store implements both.

- [ ] **Step 1: Write failing memory tests** for list-by-temple, delete+index cleanup, skip missing

- [ ] **Step 2: Run — expect fail**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/repositories/memberDelete.memory.test.ts
```

- [ ] **Step 3: Implement store methods + memory parity**

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/repositories/memberRepo.ts \
  tanstack-app/src/test/memoryStores.ts \
  tanstack-app/src/repositories/memberDelete.memory.test.ts
git commit -m "$(cat <<'EOF'
feat: memberRepo listByCurrentTempleIds and deleteMany

EOF
)"
```

---

### Task 3: TempleStore — deleteMany

**Files:**
- Modify: `tanstack-app/src/repositories/templeRepo.ts`
- Modify: `tanstack-app/src/test/memoryStores.ts`
- Create: `tanstack-app/src/repositories/templeDelete.memory.test.ts`

**Interfaces:**
- Produces on `TempleStore`:

```ts
deleteMany(ids: string[]): Promise<void>
```

Per id: load; skip missing; remove from each manager phone index (delete index if empty); delete temple doc.

- [ ] **Step 1: Failing memory tests**

- [ ] **Step 2: Run — expect fail**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/repositories/templeDelete.memory.test.ts
```

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/repositories/templeRepo.ts \
  tanstack-app/src/test/memoryStores.ts \
  tanstack-app/src/repositories/templeDelete.memory.test.ts
git commit -m "$(cat <<'EOF'
feat: templeRepo deleteMany with phone index cleanup

EOF
)"
```

---

### Task 4: Use-cases deleteTemples / deleteMembers

**Files:**
- Create: `tanstack-app/src/use-cases/deleteTemples.ts`
- Create: `tanstack-app/src/use-cases/deleteTemples.test.ts`
- Create: `tanstack-app/src/use-cases/deleteMembers.ts`
- Create: `tanstack-app/src/use-cases/deleteMembers.test.ts`

**Interfaces:**

```ts
export type TempleDeleteBlocker = {
  templeId: string
  templeLabel: string
  members: Array<{ id: string; label: string }>
}

export type DeleteTemplesResult =
  | { ok: true }
  | { ok: false; blockers: TempleDeleteBlocker[] }

export async function deleteTemples(
  input: { ids: string[] },
  deps?: { templeStore?: TempleStore; memberStore?: MemberStore },
): Promise<DeleteTemplesResult>

export async function deleteMembers(
  input: { ids: string[] },
  memberStore?: MemberStore,
): Promise<void>
```

`deleteTemples`: empty ids → `{ ok: true }`; list members by temple ids; if any, group blockers (label from `getById` / id fallback; member label `phapDanh || theDanh || id`) and **do not** delete; else `deleteMany` → `{ ok: true }`.

`deleteMembers`: `memberStore.deleteMany(ids)`.

- [ ] **Step 1: Failing unit tests**

- [ ] **Step 2: Run — expect fail**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/use-cases/deleteTemples.test.ts src/use-cases/deleteMembers.test.ts
```

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/use-cases/deleteTemples.ts \
  tanstack-app/src/use-cases/deleteTemples.test.ts \
  tanstack-app/src/use-cases/deleteMembers.ts \
  tanstack-app/src/use-cases/deleteMembers.test.ts
git commit -m "$(cat <<'EOF'
feat: deleteTemples and deleteMembers use-cases

EOF
)"
```

---

### Task 5: Shared selection + modals + i18n

**Files:**
- Create: `tanstack-app/src/components/admin/useAdminListSelection.ts`
- Create: `tanstack-app/src/components/admin/useAdminListSelection.test.ts`
- Create: `tanstack-app/src/components/admin/AdminConfirmDeleteModal.tsx`
- Create: `tanstack-app/src/components/admin/TempleDeleteBlockedModal.tsx`
- Modify: `tanstack-app/messages/vi.json`

**Interfaces:**

```ts
function useAdminListSelection(itemIds: string[]): {
  selectedIds: Set<string>
  selectedCount: number
  allLoadedSelected: boolean
  someSelected: boolean
  toggle(id: string): void
  toggleAllLoaded(): void
  clear(): void
}
```

Clear selection when `itemIds.join(',')` changes.

`AdminConfirmDeleteModal`: `{ opened, count, loading, onCancel, onConfirm }`.

`TempleDeleteBlockedModal`: `{ opened, blockers, onClose }` — member links `to="/admin/members/$id"` with `target="_blank"` `rel="noopener noreferrer"`.

i18n keys:
- `admin_bulk_delete` = "Xóa"
- `admin_bulk_selected` = "Đã chọn {count}"
- `admin_bulk_confirm_title` = "Xóa {count} mục?"
- `admin_bulk_confirm_body` = "Thao tác này không thể hoàn tác."
- `admin_bulk_confirm_action` = "Xóa"
- `admin_bulk_temple_blocked_title` = "Không thể xóa tịnh xá"
- `admin_bulk_temple_blocked_body` = "Các thành viên sau vẫn gắn với tịnh xá. Hãy chỉnh tịnh xá hiện tại của họ trước."

Run paraglide compile per `tanstack-app/package.json` scripts after editing `vi.json`.

- [ ] **Step 1: Add messages + compile i18n**

- [ ] **Step 2: Implement hook + modals + selection unit test**

- [ ] **Step 3: Run selection test — expect pass**

- [ ] **Step 4: Commit**

```bash
git add tanstack-app/src/components/admin/useAdminListSelection.ts \
  tanstack-app/src/components/admin/useAdminListSelection.test.ts \
  tanstack-app/src/components/admin/AdminConfirmDeleteModal.tsx \
  tanstack-app/src/components/admin/TempleDeleteBlockedModal.tsx \
  tanstack-app/messages/vi.json \
  tanstack-app/src/paraglide
git commit -m "$(cat <<'EOF'
feat: admin bulk delete selection hook and modals

EOF
)"
```

---

### Task 6: Wire TemplesListPage

**Files:**
- Modify: `tanstack-app/src/components/admin/TemplesListPage.tsx`
- Modify: `tanstack-app/src/components/admin/TemplesListPage.test.tsx`

**Interfaces:**
- Consumes Task 4–5 APIs; invalidate via `queryClient.invalidateQueries({ queryKey: adminKeys.templesRoot or temples(...) })` matching existing key factory

UI: checkbox column; toolbar when selected; confirm → `deleteTemples`; blockers → `TempleDeleteBlockedModal`; success → clear + invalidate.

- [ ] **Step 1: Extend tests** (mock `deleteTemples`)

- [ ] **Step 2: Run — expect fail**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/components/admin/TemplesListPage.test.tsx
```

- [ ] **Step 3: Wire page**

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/admin/TemplesListPage.tsx \
  tanstack-app/src/components/admin/TemplesListPage.test.tsx
git commit -m "$(cat <<'EOF'
feat: bulk delete temples from admin list

EOF
)"
```

---

### Task 7: Wire MembersListPage

**Files:**
- Modify: `tanstack-app/src/components/admin/MembersListPage.tsx`
- Modify: `tanstack-app/src/components/admin/MembersListPage.test.tsx`

**Interfaces:**
- Same as temples but `deleteMembers` (no blocker modal)

- [ ] **Step 1: Extend tests**

- [ ] **Step 2: Run — expect fail**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/components/admin/MembersListPage.test.tsx
```

- [ ] **Step 3: Wire page**

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/admin/MembersListPage.tsx \
  tanstack-app/src/components/admin/MembersListPage.test.tsx
git commit -m "$(cat <<'EOF'
feat: bulk delete members from admin list

EOF
)"
```

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| Admin hard delete rules + index shrink | 1 |
| Member listByCurrentTempleIds + deleteMany + photo | 2 |
| Temple deleteMany + phone index | 3 |
| Blockers all-or-nothing use-case | 4 |
| Selection + confirm + blocker UI + i18n | 5 |
| Temples list wiring | 6 |
| Members list wiring | 7 |
| No Cypress / list-only / selection-only | 5–7 |
