# Admin temple detail — editable Giáo đoàn

**Date:** 2026-08-08  
**Route:** `/admin/temples/$id`  
**Component:** `tanstack-app/src/components/admin/TempleFormPage.tsx`

## Goal

Allow hệ phái admins to change a temple’s **Giáo đoàn** (`orgUnitId`) on the temple detail form when the record is still a draft, then persist that change with the existing save action.

## Decisions

| Topic | Choice |
|-------|--------|
| Who can change | `he_phai_admin` and legacy `admin: true` only |
| Who cannot | `giao_doan_admin`, `he_phai_secretary`, filler, anon |
| When | Only while temple `status === 'draft'` (unlock first if locked) |
| How to save | Change Select, then **Hoàn tất** with the rest of the form (no separate modal / auto-save) |
| Approach | Extend `saveAdminTemple` + `createOrUpdateDraft` + Firestore rules; migrate phone indexes in the same transaction |

## Non-goals

- Editable Giáo đoàn on member forms (still immutable)
- Confirm modal or dedicated “reassign” flow
- Changing `inviteId` when org moves
- Letting `he_phai_secretary` reassign org units
- New phone-index cap policy when the destination index is full (keep existing repo semantics)

## UI

On edit mode (`TempleFormPage`):

- Keep the existing Giáo đoàn `Select` above `TempleFormFields`.
- **Enabled** only when claims are he-phái admin (legacy included) **and** loaded temple `status === 'draft'`.
- Otherwise **disabled** (same visual as today for locked / non–he-phái admin).
- Create mode unchanged: org required on create; `giao_doan_admin` still fixed to own org.

## Save path

1. `saveAdminTemple` receives `orgUnitId` (selected value) as today.
2. On update, if `input.orgUnitId !== existing.orgUnitId`:
   - Allow only for he-phái admin claims (`he_phai_admin` / legacy).
   - Reject if existing status is `locked` (`FORBIDDEN` or equivalent domain error).
   - Reject for other roles even if they can edit other profile fields.
3. Profile-only updates on locked temples remain allowed when `orgUnitId` is unchanged (`allowWhenLocked: true` as today).
4. Audit continues via existing before/after diff (includes `orgUnitId` when it changes).

## Repository

In `createOrUpdateDraft` / `createOrUpdateTemple` transaction:

- Add an explicit input flag (e.g. `allowOrgUnitChange`) set **only** by `saveAdminTemple` when claims are he-phái admin and the temple is draft.
- If `existing.orgUnitId !== input.orgUnitId` and the flag is false/absent → keep today’s `FORBIDDEN` (filler/invite cannot reassign).
- If the flag is true → persist `orgUnitId: input.orgUnitId` (not frozen to `existing.orgUnitId`) and migrate phone indexes in the same transaction:
  - Remove `templeId` from `{oldOrgUnitId}_{phone}` (delete index doc if `templeIds` becomes empty when an existing cleanup pattern exists; otherwise write the filtered list).
  - Add `templeId` to `{newOrgUnitId}_{phone}` using the same cap / duplicate rules as create/update today.

## Firestore rules

Today temples require `coreIdentityUnchanged()` (`orgUnitId` + `createdAt` immutable).

Change to:

- `createdAt` remains immutable always.
- `orgUnitId` may change **only** when:
  - `isHePhaiAdmin()` (legacy or `he_phai_admin`), and
  - `resource.data.status == 'draft'`, and
  - `request.resource.data.status == 'draft'`.
- All other writers (including `giao_doan_admin`, secretary, filler) still cannot change `orgUnitId`.
- Admin update branch continues to require directory write + org access for **both** old and new org (`directoryOrgOk(resource.data.orgUnitId)` and `directoryOrgOk(request.resource.data.orgUnitId)`). He-phái scope already satisfies both.

Phone index collection rules already allow directory writers to create/update/delete index docs; no separate product change beyond what the repo writes.

## Testing

- **Vitest UI (`TempleFormPage`):** Select enabled for `he_phai_admin` + draft; disabled when locked; disabled for `giao_doan_admin`.
- **Use-case / repo:** draft reassignment succeeds and migrates phone indexes; locked reassignment fails; non–he-phái admin fails.
- **Rules integration:** update existing “still cannot change org unit” assertions — allow he-phái admin on draft; fail for locked, `giao_doan_admin`, and unauthenticated.

No new Cypress spec (form control + persistence covered by Vitest / rules tests).

## Implementation notes

- Prefer a small claims helper (e.g. `isHePhaiAdmin`) over reusing `isHePhaiScope`, so secretaries stay excluded.
- Branch constraint for this work: implement on the **current branch**; do not create a new branch or git worktree.
