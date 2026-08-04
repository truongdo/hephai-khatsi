# Form local draft, save confirmation, lock & edit request

Date: 2026-08-04  
Status: approved for planning / implementation  
Surfaces: filler member & temple editors; admin member & temple forms + list pages

## Goal

1. Let users resume in-progress member/temple form input via **browser localStorage**.
2. On filler **Lưu**, require explicit confirmation that after save the record locks and further edits need **giáo đoàn** (admin) approval.
3. After filler save, **lock** the record. Filler may **Yêu cầu chỉnh sửa**; admin **Mở khoá** from list and detail form.

## Decisions

| Topic | Choice |
|-------|--------|
| Lock / confirm / request-edit flow | **Filler only** |
| localStorage drafts | **Filler + admin** forms |
| Incomplete progress before first/official save | **localStorage only** — no filler “Lưu nháp” to Firestore |
| Photos / file attachments in local draft | **Text/select fields only**; re-pick media if not yet uploaded |
| Edit-request mechanism | Flag on document (`editRequestedAt` / `editRequestedBy`); **no** email/SMS |
| Status model | Keep `draft` \| `locked`; do **not** add `edit_requested` status or separate collection |
| Admin unlock placement | **List + detail form** (keep existing form unlock) |
| Admin save semantics | Unchanged: Lưu nháp / Hoàn thành do **not** auto-lock; admin may still edit when locked |

## Data model

On `Member` and `Temple` (existing `status`, `lockedAt`, `lockedBy` unchanged), add:

| Field | Type | Meaning |
|-------|------|---------|
| `editRequestedAt` | `string \| null` (ISO) | When filler requested unlock |
| `editRequestedBy` | `string \| null` | Filler entry phone |

**Transitions**

- Filler save confirm → persist profile + set `status: 'locked'`, `lockedAt`, `lockedBy: 'filler'`, clear `editRequested*`.
- Filler request edit (only when `locked`) → set `editRequestedAt` and `editRequestedBy` to the filler entry phone; no profile field changes.
- Admin unlock → `status: 'draft'`, clear `lockedAt` / `lockedBy` / `editRequested*`.
- Admin lock → set lock fields; clear `editRequested*` if present.

**Firestore rules**

- Filler **create/update** of profile fields is allowed only when the write ends with `status == 'locked'` (single write: profile + lock metadata). Filler must not persist profile changes as `draft` via Lưu.
- Filler may update an already-**locked** doc **only** to set `editRequestedAt` / `editRequestedBy` (no other field changes).
- Admin retains unlock (`locked` → `draft`) and lock (`draft` → `locked`), and may update profile while locked (existing behavior).
- Use-cases `saveAndLockMember` / `saveAndLockTemple` perform that single write so the UI never treats “saved unlocked” as success.

**Existing data:** records already `draft` in Firestore remain editable by filler until the next Lưu (then save-and-lock). No bulk migration required.

## LocalStorage draft

Shared helper/hook (e.g. `useFormLocalDraft`):

**Keys** (illustrative)

- New member: `formDraft:member:new:{orgUnitId}:{sanghaType}:{phone|adminUid}`
- Existing member: `formDraft:member:{memberId}`
- New temple: `formDraft:temple:new:{orgUnitId}:{phone|adminUid}`
- Existing temple: `formDraft:temple:{templeId}`

**Payload:** `{ version, updatedAt, fields }` — serializable draft fields only (no `File` / blob / pending upload objects).

**Behavior**

- Debounced write (~300–500ms) while the form is editable.
- On mount: hydrate from local draft when appropriate (new record, or server `draft` and local draft is usable).
- Server document remains source of truth for already-persisted fields; do not overwrite a **locked** server view with local draft.
- Clear key after successful server save (filler save-and-lock or admin save).
- Do not write localStorage in view-only / locked filler mode.
- Quota / parse failures: drop local draft, keep form usable.

**UX:** optional short notice that a device draft was restored; note that photos/documents must be chosen again if not yet saved to the server.

## Filler UX

### Editable (`draft` or not yet created)

1. User taps **Lưu** → run required-field validation.
2. If invalid → show field errors; no modal.
3. If valid → open **confirm modal** (do not save yet). Copy must state clearly:
   - After save, the record will be **locked**.
   - Further edits require **confirmation from giáo đoàn** (admin unlock).
   - Actions: Huỷ / Xác nhận lưu.
4. On confirm → `saveAndLock` → upload pending media as today → clear local draft → UI becomes view-only.

### Locked

- Fields disabled; no **Lưu**.
- **Yêu cầu chỉnh sửa**:
  - If `editRequestedAt` is null → set flag; show success feedback (“đã gửi yêu cầu, chờ giáo đoàn mở khoá”).
  - If already set → show already-requested state (idempotent; no duplicate side effects required).

### After admin unlock

Filler can edit again; next **Lưu** repeats confirm + lock.

## Admin UX

### Lists (`/admin/members/tang|ni`, `/admin/temples`)

- Badge/indicator when `editRequestedAt != null`.
- Optional filter: “Có yêu cầu chỉnh sửa”.
- Per-row **Mở khoá** when `status === 'locked'` (emphasize when edit requested).
- Unlock uses existing unlock use-case + clears `editRequested*`.

### Detail forms

- Keep **Khoá** / **Mở khoá** as today, with clear of edit-request flags on those transitions.
- Add localStorage draft behavior; no filler-style confirm modal on admin save.
- Admin may continue to edit profile fields while locked (existing behavior).

## Error & edge cases

| Case | Handling |
|------|----------|
| User cancels confirm modal | No server write |
| `saveAndLock` fails | Form stays editable; local draft retained; do not claim locked |
| Race: save while already locked | Clear error; switch to view-only + request-edit |
| Request edit when already requested | No-op / show existing request time |
| localStorage unavailable / full | Ignore persistence; form still works |
| Photos not in local draft | User re-selects before save if needed for validation |

## Non-goals

- Email / SMS / push when edit is requested
- Auto-lock on admin Lưu nháp / Hoàn thành
- Storing images as base64 in localStorage
- Separate `editRequests` collection or `edit_requested` status value
- Expanding Cypress for each UI control (Vitest-first)

## Testing

**Vitest**

- Local draft helper: serialize/omit binaries; hydrate; clear after save; safe failure on bad JSON.
- Use-cases: `saveAndLock*`, `requestEdit*`, unlock clears `editRequested*`.
- Filler UI: confirm modal copy/actions; locked UI hides save and shows request-edit.
- Admin list: badge and unlock affordance when locked / edit requested.

**Cypress:** only if a thin journey is later deemed critical; not required for this design’s default delivery.

## Implementation sketch

1. Extend domain types + converters + Firestore rules for `editRequested*`.
2. Add `saveAndLockMember` / `saveAndLockTemple` (or extend filler save path to lock atomically).
3. Add `requestMemberEdit` / `requestTempleEdit` use-cases + repo methods.
4. Extend `unlockMember` / `unlockTemple` (and lock) to clear edit-request fields.
5. Shared `useFormLocalDraft` + wire into filler and admin member/temple forms.
6. Filler confirm modal + post-save lock UI; request-edit button when locked.
7. Admin list badge, filter, row unlock; keep detail unlock.
8. Vitest coverage as above; update Paraglide strings for modal and request-edit copy.
