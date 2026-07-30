# Khóa tu — Phase 3: Xét duyệt cấp Giáo đoàn

Date: 2026-07-30  
Status: approved for planning  
Parent roadmap: [2026-07-25-khoa-tu-roadmap-design.md](./2026-07-25-khoa-tu-roadmap-design.md)  
Depends on: Phase 2 registration (on `main`, smoke verified 2026-07-30)

## Goal

Let Giáo đoàn (and Hệ phái) admins **approve or reject** retreat registrations — individually or in bulk — on the existing registrations page. Optional rejection reason. Self-service users can re-open the registration link and see their decision status. Export / “Trình Ban Lãnh đạo” stays Phase 4.

## Decisions (confirmed)

| Topic | Choice |
| --- | --- |
| Architecture | Extend existing `/admin/retreats/$id/registrations` (Approach 1) — no separate review route, no Cloud Functions |
| Rejection reason | Optional (`rejectionReason: string \| null`) |
| Bulk | Approve and reject; bulk reject shares one optional reason for the whole selection |
| When review is allowed | Any time while registration `status === 'pending'`, including when retreat is `closed` or outside the registration window |
| Terminal states | `approved` / `rejected` are terminal in Phase 3 (no undo / re-open) |
| Public status | Self: `/r/$token` + phone → if registration exists, show status screen (no re-register) |
| Export | Out of scope (Phase 4) |
| Fail-fast bulk | If any selected id is missing, wrong retreat, or not `pending`, abort the whole batch |

## Out of scope

- CSV export / “Trình Ban Lãnh đạo” (Phase 4)
- Undo approve/reject or re-apply after reject
- Status filter tabs on the admin list (keep Phase 2 list UX)
- `type: 'he_phai'` cross-org aggregation (Phase 5)
- Attendance, certificates, QR (Phases 6–7)
- Cloud Functions as the write path
- Cypress journey (Vitest + rules emulator unless a later smoke is justified)
- Notifying members by SMS/email

## Architecture

```
Admin: /admin/retreats/$id/registrations
  → list + proxy (Phase 2)
  → useAdminListSelection
  → approve / reject (row or bulk)
  → reviewRetreatRegistrations({ retreatId, ids, decision, rejectionReason? })

Self: /r/$token
  → phone lookup → pick/confirm member
  → getById(`${retreatId}_${memberId}`)
  → if exists → status screen (pending | approved | rejected + reason)
  → else → Phase 2 register flow
```

| Unit | Responsibility | Depends on |
| --- | --- | --- |
| Registration domain | `rejectionReason` on type; assert pending→approved/rejected helpers | pure |
| `retreatRegistrationRepo` | `updateReview` (single or batched writes) | Firebase |
| `reviewRetreatRegistrations` | Authz, org scope, fail-fast pending checks, apply decision | repos + claims |
| Admin UI | Selection toolbar, row actions, reject modal | useAdminListSelection |
| Self UI | Branch to status view after identity resolved | registration getById |
| Rules | Staff-scoped update with field + transition constraints | Phase 0/1 helpers |

## Data model

### `retreatRegistrations/{registrationId}` (delta)

| Field | Type | Notes |
| --- | --- | --- |
| `rejectionReason` | `string \| null` | `null` on create and on approve; optional non-empty trimmed string on reject |
| `status` | `'pending' \| 'approved' \| 'rejected'` | Only `pending` → `approved` \| `rejected` |
| `approvedBy` | `string \| null` | Reviewer uid set on both approve and reject |
| `approvedAt` | `string \| null` | ISO timestamp set on both approve and reject |
| `updatedAt` | `string` | ISO |

Phase 2 `create` must also write `rejectionReason: null` (backward-compatible readers treat missing as `null`).

No new collections. No new indexes required for review updates (get-by-id + existing list index).

## Flows

### Admin approve / reject

1. Open `/admin/retreats/$id/registrations` — `canManageRetreats` + org access (unchanged).
2. Select one or more rows (checkbox; header selects current page ids via `useAdminListSelection`).
3. **Approve:** confirm → `reviewRetreatRegistrations` with `decision: 'approved'`, `rejectionReason: null`.
4. **Reject:** modal with optional textarea → `decision: 'rejected'`, reason trimmed or `null`.
5. Row-level buttons for a single `pending` row use the same use-case with one id.
6. On success: clear selection, invalidate registrations list query.
7. Non-`pending` rows: no action controls (badge only; show truncated reason if rejected).

### Self status check

1. Open `/r/$token` — invite must be valid (`kind`, not disabled); load retreat by id.
2. **Status path vs register path:**
   - After member id is known, always `getById(retreatRegistrationId(retreatId, memberId))` first.
   - **Found:** show status card (pending / approved / rejected + optional reason). Do **not** require retreat `open` or registration window — members must see the decision after registration closes.
   - **Not found:** only then apply Phase 2 register gates (`open` + window + `quyenDangKy` self) and continue extraAnswers → create.
3. Phone lookup → resolve member (0 matches → new-member form only when register path is allowed; 1+ → pick/confirm then status-or-register branch above).

Honest limit: public `get` on registration docs remains open (same bearer model as Phase 2 duplicate check). Status is not secret beyond knowing member id + invite link.

## Firestore rules (Phase 3 intent)

- Keep Phase 2 create/list/get rules.
- **`update`:** allow when `canWriteDirectory()` (or equivalent manage-retreats) **and** `retreatOrgOk(resource.data.orgUnitId)` **and**:
  - `diff` affected keys ⊆ `{ status, approvedBy, approvedAt, rejectionReason, updatedAt }`
  - immutable: `retreatId`, `memberId`, `orgUnitId`, `registeredVia`, `registeredBy`, `extraAnswers`, `createdAt`, id shape
  - `resource.data.status == 'pending'`
  - `request.resource.data.status` in `['approved', 'rejected']`
  - `approvedBy == request.auth.uid`, `approvedAt` is string
  - if `approved`: `rejectionReason == null`
  - if `rejected`: `rejectionReason == null` **or** non-empty string
- **`delete`:** still false.
- Public callers: no update.

## Error handling

| Code | When |
| --- | --- |
| `UNAUTHORIZED` | Missing claims for review |
| `FORBIDDEN` | Cannot manage retreats / wrong org unit |
| `NOT_FOUND` | Retreat or any registration id missing |
| `INVALID_STATUS` | Any targeted registration not `pending` |
| `INVALID_INPUT` | Empty ids, registration `retreatId` ≠ input retreat, malformed reason |

Bulk is transactional best-effort via sequential/batched writes with **fail-fast** before any write after validating all ids (load all first; if any invalid, throw and write nothing).

## Testing

- **Unit:** pending→approved/rejected; optional/empty reason; approve clears reason; fail-fast on non-pending; org/role scope.
- **Component:** toolbar appears on selection; reject modal; row actions only for pending; self status screen for each status.
- **Rules emulator:** staff scoped update allowed for valid transition; cross-org deny; public cannot update; create still forces pending + null audit/reason fields.

## Acceptance criteria

1. Admin can approve or reject a single `pending` registration; result is terminal.
2. Bulk approve and bulk reject work; bulk reject applies one shared optional reason to all selected rows.
3. Review succeeds when the retreat is `closed` or outside the registration window.
4. Self returning via `/r` + phone sees pending / approved / rejected (and reason when present); cannot register again for the same member+retreat.
5. No export UI; no undo; filler `/f/public` unchanged.

## Next step

Invoke `writing-plans` → `docs/superpowers/plans/2026-07-30-khoa-tu-approval-phase3.md`, then implement on a feature branch from `main` (per plan-execution rule).
