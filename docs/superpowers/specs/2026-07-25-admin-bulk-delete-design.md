# Admin bulk delete (temples & members)

Date: 2026-07-25  
Status: approved for planning  
Depends on: `2026-07-19-he-phai-admin-ui-design.md`, `2026-07-19-admin-data-table-design.md`, `2026-07-19-he-phai-khatsi-database-design.md`

## Goal

Allow admins to **hard-delete** temples and members from the admin list views, with checkbox multi-select and a toolbar bulk delete action.

## Decisions

| Topic | Choice |
|-------|--------|
| Delete semantics | Hard delete (permanent) |
| Confirm UX | Simple modal (“Delete N …?” → Cancel / Delete) |
| Entry points | List views only; selection + toolbar Delete (no per-row delete, no detail-page delete) |
| Temple ↔ members | Block delete while any member has `currentTempleId` pointing at a selected temple; show those members; click opens admin member edit in a **new tab** |
| Bulk temples with blockers | All-or-nothing — if any selected temple is blocked, delete none |
| Execution | Client SDK + Firestore/Storage rule updates (no Cloud Functions) |
| Who | Admin claim only (`request.auth.token.admin == true`) |
| Draft vs locked | Both deletable |

## Non-goals

- Soft delete / recycle bin
- Delete from detail forms
- Cascade-delete members when deleting a temple
- Partial bulk success for temples
- Cloud Functions / Admin SDK path
- Org-unit delete
- Cypress (Vitest + Testing Library only)

## Scope — surfaces

| Surface | Behavior |
|---------|----------|
| `/admin/temples/` | Checkboxes + toolbar Delete |
| `/admin/members/tang` | Same |
| `/admin/members/ni` | Same |

## List UX

1. Leading checkbox column on each data row; header checkbox selects/clears **all currently loaded rows** (including rows already appended via “Load more”).
2. Toolbar appears when `selectedIds.size >= 1`: selected count + destructive **Delete** button (near existing filters/actions).
3. Changing org-unit or status filter **clears** selection.
4. Clicking the row’s name/link navigates to detail as today; checkbox interaction does not navigate.
5. After successful delete: clear selection and invalidate/refetch the list query so rows disappear.

## Confirm modal

- Title/body: delete N temples or N members (Vietnamese via Paraglide).
- Actions: Cancel / Delete (Delete is `color="red"`, loading while mutation runs).
- Closing or Cancel aborts; no type-to-confirm.

## Temple delete — member blocker

Before any temple write:

1. Query members where `currentTempleId` is in the selected temple id set (chunk `in` queries to ≤30 ids).
2. If any members found → **do not delete**; return structured blockers grouped by temple.
3. UI shows a modal/panel listing, per blocked temple: temple label + member rows (display name: pháp danh or thế danh or id).
4. Each member link: `target="_blank"` / `rel="noopener noreferrer"` to `/admin/members/$id` (or tang/ni detail route used today).
5. Admin reassigns/clears `currentTempleId` on those members, returns, retries delete.
6. If zero blockers → proceed with hard delete of all selected temples (all-or-nothing for this batch).

Member delete has no equivalent FK block (temples do not reference members).

## Data layer

### Repository

Extend `TempleStore` / `MemberStore`:

- `deleteMany(ids: string[]): Promise<void>` — hard-delete docs and clean secondary indexes.
- `listMembersByCurrentTempleIds(templeIds: string[]): Promise<Member[]>` on `MemberStore` (or a small admin helper) for the pre-check.

Temple delete per id (transaction or batch, respecting Firestore 500-op limit by chunking):

1. Load temple; if missing, skip (idempotent).
2. For each `managerPhones` entry (normalized): remove temple id from `templeManagerPhoneIndex/{orgUnitId}_{phone}`; if `templeIds` becomes empty, **delete** the index doc; else update with shrunk array.
3. Delete `temples/{id}`.

Member delete per id:

1. Load member; if missing, skip.
2. If `dienThoai` present: remove member id from `memberPhoneIndex/{orgUnitId}_{sanghaType}_{phone}`; delete index doc if empty.
3. Delete `members/{id}`.
4. If `photoPath` set: best-effort `deleteObject` on Storage (`members/{memberId}/photo.jpg`). Photo failure must not roll back an already-committed Firestore delete; surface a non-blocking warning only if easy, otherwise log and continue (YAGNI: silent best-effort is acceptable).

### Use-cases

- `deleteTemples({ ids })` — run member pre-check; on blockers return `{ ok: false, blockers }`; else call temple store and return `{ ok: true }`.
- `deleteMembers({ ids })` — call member store; return `{ ok: true }`.

Add domain error code only if needed; prefer a typed result for temple blockers rather than throwing for the happy “blocked” path.

### Query / UI wiring

- Mutations from list pages via `useMutation`; on success invalidate `templesQuery` / `membersQuery` keys (same factories as today).
- Do not call Firestore SDK from components.

## Security rules

### Firestore (`firebase/firestore.rules`)

- `temples` / `members`: `allow delete: if isAdmin();`
- `templeManagerPhoneIndex` / `memberPhoneIndex`:
  - Keep create/append behavior for non-admin (size non-decreasing) as today.
  - Allow **admin** to update with a shrunk `templeIds` / `memberIds` list (still typed list, size ≤ 20).
  - Allow **admin** to delete index docs (`allow delete: if isAdmin();`).

### Storage (`firebase/storage.rules`)

- On `members/{memberId}/photo.jpg`: `allow delete: if isAdmin();` (do not require the member doc to still exist).

Update `firestoreRules.integration.test.ts` (and storage tests if present) accordingly.

## Error handling

| Case | UX |
|------|-----|
| Confirm cancel | No-op |
| Temple blockers | Blocker modal; no deletes |
| Permission / rules failure | Alert with existing admin error tone |
| Partial network failure mid-batch | Show error; invalidate list so UI matches remaining server state; admin can retry |

## Testing

- **Vitest unit:** use-cases with memory stores — delete temples ok; blocked when members reference; delete members cleans phone index; missing ids skipped.
- **Vitest + Testing Library:** list pages — select rows, open confirm, call mock delete; temple blocker UI shows members with `target="_blank"`.
- **Rules integration:** admin can delete; non-admin cannot; admin can shrink/delete phone indexes.
- **No Cypress.**

## i18n

Add Vietnamese keys under `admin_*` for: delete action, selected count, confirm title/body, confirm delete button, temple-blocked title/body, empty selection N/A.

## Implementation sketch

1. Rules + integration tests.
2. Repo `deleteMany` + member-by-temple query + memory store parity.
3. Use-cases + unit tests.
4. Shared list selection + confirm + blocker UI.
5. Wire temples / tang / ni list pages + i18n.
6. Vitest list tests.
