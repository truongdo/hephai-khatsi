# Locked field edit proposals (filler → admin accept/reject)

Date: 2026-08-06  
Status: approved for planning  
Surfaces: filler member & temple editors (locked/view); admin member & temple detail + lists

## Goal

When a member or temple form is **locked**, allow the filler to propose per-field corrections (with a reason). Admins and thư ký giáo đoàn (`he_phai_admin` / `giao_doan_admin`) review those proposals on the detail page, **accept** (apply) or **reject** (with a rejection reason the filler can see).

## Decisions

| Topic | Choice |
|-------|--------|
| Relation to “Yêu cầu chỉnh sửa” (full unlock) | **Keep both** in backend; **hide** request-edit button on filler UI for now (UI-only) |
| Scope | **Member + temple** (same pattern) |
| Editable fields | **All** form fields including nested arrays/objects |
| CCCD | **No** field-edit proposal (`cccd` / `cccdMeta` have no Edit icon; doc id depends on CCCD) |
| Admin actions | **Accept** or **Reject** (reject requires reason filler can see) |
| Filler reason | **Required** on every proposal |
| Pending cardinality | Many fields at once; **at most one pending proposal per field path**; resubmit **overwrites** |
| Storage | Map `pendingFieldEdits` **on** the member/temple doc (+ denormalized flag) |
| Who reviews | Same directory writers: `he_phai_admin` and `giao_doan_admin` (org-scoped) |
| Accept vs unlock | Accept applies value while record stays **locked** |

## Data model

On `Member` and `Temple`:

```ts
pendingFieldEdits?: {
  [fieldPath: string]: {
    proposedValue: unknown
    previousValue: unknown
    reason: string
    requestedAt: string // ISO
    requestedBy: string // filler entry phone
  }
}
hasPendingFieldEdits?: boolean
fieldEditFeedback?: {
  [fieldPath: string]: {
    status: 'accepted' | 'rejected'
    message?: string // rejection reason when rejected
    at: string // ISO
  }
}
```

**Field paths:** stable top-level keys matching the draft/domain model (e.g. `theDanh`, `diaChiThuongTru`, `chucVuHePhai`, `truTriTienNhiem`). Nested/array values are stored whole under that path (replace entire array/object on accept).

**Allowlist:** all editable profile paths on the form (including `photoPath`, `documents`, and nested arrays) **except** member `cccd` / `cccdMeta`. System fields (`status`, `lockedAt`, `lockedBy`, `editRequested*`, `pendingFieldEdits`, `hasPendingFieldEdits`, `fieldEditFeedback`, indexes, audit, org/sangha identity, etc.) are never proposable.

**Transitions**

| Event | Effect |
|-------|--------|
| Filler propose (locked) | Upsert `pendingFieldEdits[path]`; set `hasPendingFieldEdits: true`; clear `fieldEditFeedback[path]`; audit `field_edit_proposed` |
| Filler propose same path again | Overwrite that pending entry |
| Admin accept | Write `proposedValue` onto the field; delete pending key; recompute flag; set optional accepted feedback; audit `field_edit_accepted` |
| Admin reject | Delete pending key; recompute flag; set `fieldEditFeedback[path]` rejected + message; audit `field_edit_rejected` |
| Admin unlock / filler save-and-lock / admin lock | Clear `pendingFieldEdits`, `hasPendingFieldEdits`, `fieldEditFeedback` (avoid stale proposals) |

`editRequestedAt` / `editRequestedBy` and unlock/request-edit use-cases remain unchanged for when the filler UI button is re-enabled.

**Existing data:** no migration; missing maps mean no pending edits.

## Architecture

```
filler UI (Edit icon → modal)
  → proposeFieldEdit(member|temple) use-case
  → memberRepo / templeRepo patch pending maps
  → invalidate detail query

admin detail UI (diff + accept/reject)
  → acceptFieldEdit / rejectFieldEdit use-cases
  → apply field or feedback + audit
  → invalidate detail (+ list if badge depends on flag)
```

Layering stays: repository SDK writes → use-cases → query invalidation → UI. No new top-level collection.

## Filler UX

When status maps to **view / locked**:

1. Hide **Yêu cầu chỉnh sửa** (UI only).
2. Show **Edit** icon on each proposable field label (not on CCCD).
3. Click → modal: field editor (same control type as the form, including array/section editors) + required **Lý do sửa** → **Gửi đề xuất**.
4. Pending field: badge “Đang chờ duyệt”; show proposed value and reason; Edit again to overwrite.
5. After reject: show rejection reason from `fieldEditFeedback`; new propose or an explicit dismiss clears that feedback key on the doc (filler-allowed write).
6. After accept: form shows updated server value (record still locked).

Draft / editable mode: unchanged (no per-field propose; normal save-and-lock).

## Admin UX

On `/admin/members/$id` and `/admin/temples/$id`:

1. If `hasPendingFieldEdits`, show a summary banner with pending count.
2. Each pending field: highlight + compare current vs proposed + filler reason.
3. **Chấp nhận** applies immediately; **Từ chối** opens modal requiring rejection reason.
4. Lists: badge and/or filter on `hasPendingFieldEdits` (alongside existing unlock-request badge).

Admin may still edit fields directly while locked and use Khóa / Mở khóa as today.

## Security (Firestore rules)

- Filler invite writes on a **locked** doc may update only:
  - `editRequestedAt` / `editRequestedBy` (existing), and/or
  - `pendingFieldEdits` / `hasPendingFieldEdits` / related `fieldEditFeedback` keys (propose clears feedback for that path; dismiss clears a feedback entry)  
  — **not** other profile fields.
- Propose must only touch allowlisted paths; values are still validated in use-cases.
- Accept/reject: authenticated directory writers only (existing `canWriteDirectory` / org scope).
- Filler must be able to **read** `pendingFieldEdits` and `fieldEditFeedback` on the locked doc they can already read (no reliance on audit subcollection for filler-facing rejection text).

## Errors

- Not locked / forbidden path / missing reason / proposed equals current → clear validation messages; no write.
- Race (admin already resolved): refresh detail; toast that the proposal is gone.
- Oversized nested `proposedValue`: fail with a clear message (avoid blowing the 1MB doc limit).

## Testing

**Vitest**

- Use-cases: propose, overwrite, accept, reject, clear on unlock/save-and-lock; block CCCD and non-locked.
- Light UI: Edit icon only when locked; reason required; admin accept/reject panels.

**Cypress:** no new E2E for this feature (per repo thin-E2E policy).

## Out of scope

- CCCD change / document-id migration
- Global inbox of all proposals across records
- Re-showing filler “Yêu cầu chỉnh sửa” (backend kept; UI stays hidden until a later change)
- Email/SMS notifications
