# Quản lý Khóa tu — Roadmap Design

Date: 2026-07-25
App: `tanstack-app` (TanStack Start + React + Mantine)
Database: Firebase Firestore + Firebase Storage
Source: `quy_trinh_quan_ly_khoa_tu.docx` (quy trình 2 loại khóa tu: Hệ phái tổ chức và Giáo đoàn tổ chức) + existing `members` / `temples` / `orgUnits` domain (see `2026-07-19-he-phai-khatsi-database-design.md`)

## Goal

Design and phase the rollout of a **Khóa tu (retreat/cultivation course) management** feature on top of the existing Hệ phái Khất sĩ system: creating courses, registration (self-service and proxy), multi-level approval, list aggregation, attendance, completion (history + certificates), and the role-based access these steps require.

This doc is a **roadmap of sub-projects**, not a single implementation spec. Each phase below gets its own detailed plan (via `writing-plans`) when it starts.

## Key decisions (confirmed with user)

| Topic | Decision |
| --- | --- |
| Member self-registration | No new login system. Reuse the existing invite-link + phone-lookup pattern (`resumeMemberByPhone`) already used for the filler flow — members find themselves by phone under an invite-gated link, not via a personal account. |
| Access control | Extend the current flat `admin: true` claim into `role: 'he_phai_admin' \| 'giao_doan_admin' \| 'kiem_soat'` + `orgUnitId` (scope for `giao_doan_admin` / `kiem_soat`). Not a full generic RBAC system — just enough for khóa tu's four roles. Existing `admin: true` claim maps to `he_phai_admin` for backward compatibility. |
| QR / thẻ tham dự / chứng nhận điện tử | Deferred to the last phase. Early attendance tracking is manual (admin/kiểm soát checks off attendees). |
| First course type | Giáo đoàn-organized (4 bước, single org unit scope) before Hệ phái-organized (7 bước, cross-org aggregation) — smaller vertical slice first, Hệ phái flow reuses the same building blocks. |

## Out of scope (all phases, unless a later phase explicitly adds it)

- Generic/reusable RBAC system beyond the 3 roles needed for khóa tu.
- Room assignment (`danh sách theo phòng`) beyond a flat text/number field — no room inventory management.
- Ban Lãnh đạo as a system actor/approver — "trình Ban Lãnh đạo" is represented as an export/notification step, not a workflow gate.
- Realtime listeners as the default read path (matches existing convention).
- Push notifications / SMS / email delivery of thẻ điện tử or chứng nhận (file generation + download only, initially).

## Data model additions

### `retreats/{retreatId}`

| Field | Type | Notes |
| --- | --- | --- |
| `type` | `'he_phai' \| 'giao_doan'` | Phase 1 only creates `giao_doan`; `he_phai` added in Phase 5 |
| `orgUnitId` | string \| null | Required for `giao_doan`; `null` for `he_phai` (cross-org) |
| `name`, `diaDiem`, `noiDung` | string | |
| `doiTuongThamDu` | string | Free text eligibility description |
| `thoiGianBatDau` / `thoiGianKetThuc` | timestamp | |
| `dangKyMoTu` / `dangKyDongLuc` | timestamp | Registration window |
| `extraFields` | `{ key, label, required }[]` | Admin-defined additional questions, filled at registration |
| `quyenDangKy` | `'tu_dang_ky' \| 'proxy_only' \| 'both'` | Mirrors docx "thiết lập quyền đăng ký" |
| `status` | `'draft' \| 'open' \| 'closed' \| 'finalized'` | `open`/`closed` gate registration; `finalized` = kết thúc khóa tu |
| `createdBy` / `createdAt` / `updatedAt` | | |

### `retreatRegistrations/{registrationId}`

| Field | Type | Notes |
| --- | --- | --- |
| `retreatId`, `memberId`, `orgUnitId` | string | `orgUnitId` denormalized from member for scoped queries |
| `registeredVia` | `'self' \| 'proxy'` | |
| `registeredBy` | string \| null | Admin uid when proxy |
| `extraAnswers` | `Record<string, string>` | Keyed by `retreats.extraFields[].key` |
| `status` | `'pending' \| 'approved' \| 'rejected'` | Set by Giáo đoàn (and Hệ phái, phase 5) approval step |
| `approvedBy` / `approvedAt` | | |
| `createdAt` / `updatedAt` | | |

Attendance (phase 6) and certificate/QR (phase 7) fields are added to `retreatRegistrations` when those phases start — not designed in detail here to avoid speculative schema.

### Auth claims

`{ admin?: boolean, role?: 'he_phai_admin' | 'giao_doan_admin' | 'kiem_soat', orgUnitId?: string }`. `he_phai_admin` has no `orgUnitId` restriction; `giao_doan_admin` / `kiem_soat` are scoped to their `orgUnitId`.

**Operational note:** Since Phase 1, `firebase/firestore.rules` enforce `role` and `orgUnitId` for retreat and directory access; `admin: true` still maps to `he_phai_admin` for backward compatibility. Provision accounts with `role` (+ `orgUnitId` where scoped). Including `admin: true` alongside role claims remains optional and harmless for existing tooling.

## Phases

### Trạng thái các phase

| Phase | Nội dung | Trạng thái | Plan |
| --- | --- | --- | --- |
| 0 | RBAC nhẹ (nền tảng) | Hoàn thành | [2026-07-25-khoa-tu-rbac-phase0.md](../plans/2026-07-25-khoa-tu-rbac-phase0.md) |
| 1 | CRUD khóa tu (Giáo đoàn only) | Hoàn thành | [2026-07-25-khoa-tu-retreats-crud-phase1.md](../plans/2026-07-25-khoa-tu-retreats-crud-phase1.md) |
| 2 | Đăng ký (tự đăng ký + đăng ký thay) | Chưa bắt đầu | — |
| 3 | Xét duyệt cấp Giáo đoàn | Chưa bắt đầu | — |
| 4 | Xuất danh sách & báo cáo (Giáo đoàn) | Chưa bắt đầu | — |
| 5 | Khóa tu Hệ phái (7 bước, tổng hợp) | Chưa bắt đầu | — |
| 6 | Điểm danh (thủ công) | Chưa bắt đầu | — |
| 7 | Kết thúc khóa tu (lịch sử, chứng nhận, QR) | Chưa bắt đầu | — |

Cập nhật bảng này mỗi khi một phase có plan mới hoặc đổi trạng thái (Chưa bắt đầu → Đã lập kế hoạch → Đang thực hiện → Hoàn thành).

### Phase 0 — RBAC nhẹ (nền tảng)

- Extend custom claims with `role` + `orgUnitId`; keep `admin: true` working (mapped to `he_phai_admin`).
- Update `useAdminClaim` to expose `{ role, orgUnitId }`; add a scope-check helper (`canAccessOrgUnit(claim, orgUnitId)`).
- Update `RequireAuth` / admin route guards to use role instead of raw `admin` boolean where scoping matters.
- No new UI for assigning roles yet (admin script or manual Firebase console claim-set is acceptable — a role-assignment UI is a later, non-blocking addition).
- **Acceptance**: existing admin users still work unchanged; a test `giao_doan_admin` claim can read/write only its own `orgUnitId` scope in use-case-level checks.

### Phase 1 — CRUD khóa tu (Giáo đoàn only)

Detailed design: [2026-07-25-khoa-tu-retreats-crud-phase1-design.md](./2026-07-25-khoa-tu-retreats-crud-phase1-design.md).

- `retreats` collection, repository, use-cases: `createRetreat`, `updateRetreat`, `openRetreat`, `closeRetreat`, `deleteRetreat`, `listRetreats` (scoped: `giao_doan_admin` sees own `orgUnitId`; `he_phai_admin` sees all / may create for any unit).
- Admin UI: `/admin/retreats` (list), `/admin/retreats/new`, `/admin/retreats/$id` — full schema form including registration settings + `extraFields`; status via open/close actions; hard-delete only in `draft`.
- Firestore/Storage rules learn `role`; directory + retreat writes exclude `kiem_soat`; retreat reads/writes scoped by `orgUnitId` for `giao_doan_admin`.
- Capability split: `canManageDirectory` / `canManageRetreats` — `kiem_soat` may enter `/admin` shell only.
- **Acceptance**: a `giao_doan_admin` can create/edit a khóa tu for their own org unit only; cannot see/edit other units' courses; `kiem_soat` cannot CRUD directory or retreats.

### Phase 2 — Đăng ký

- Self-service: extend invite/filler pattern with a retreat-registration route gated by invite token + phone lookup (reusing `normalizeVnPhone`, similar shape to `resumeMemberByPhone`); member confirms identity, fills `extraAnswers`, submits → `status: pending`.
- Proxy: Giáo đoàn admin searches existing members (reuse admin member search/list) and registers on their behalf.
- Guard registration window (`dangKyMoTu`/`dangKyDongLuc`) and `quyenDangKy`.
- **Acceptance**: duplicate registration for the same member+retreat is rejected; registration outside the open window is rejected.

### Phase 3 — Xét duyệt cấp Giáo đoàn

- Giáo đoàn admin views registrations for a retreat scoped to their org unit; approve/reject individually or bulk (reuse existing bulk-select pattern from members/temples list pages).
- "Trình Ban Lãnh đạo" represented as an export action, not a gated approval step (per out-of-scope).
- **Acceptance**: only `pending` registrations are actionable; approved/rejected are terminal in phase 3 (no re-open yet).

### Phase 4 — Xuất danh sách & báo cáo (Giáo đoàn)

- Export approved registrants sorted by `giaoPhamGiaoHoi`/`giaoPhamHePhai` rank then `haLap` descending (reusing existing member fields — no new sort data needed).
- Exports: danh sách tham dự, danh sách lưu trú (includes CCCD), danh sách theo phòng (flat field, no room inventory).
- **Acceptance**: CSV export matches docx-specified columns; sort order verified against sample data.

### Phase 5 — Khóa tu Hệ phái (7 bước, tổng hợp toàn hệ phái)

- Add `type: 'he_phai'` support: `orgUnitId: null` at creation; each Giáo đoàn runs its own phase 2-3 flow scoped to the retreat; Hệ phái admin gets a cross-org aggregation view sorted by Giáo đoàn → giới phẩm → hạ lạp.
- `finalizeRetreat` use-case: Hệ phái admin "chốts" the combined list (locks further edits to the aggregated list).
- Reuses phases 1-4 building blocks; the delta is cross-org query/aggregation and the finalize step.
- **Acceptance**: a `he_phai_admin` can see registrations across all org units for a `he_phai` retreat; a `giao_doan_admin` still only sees/approves their own slice.

### Phase 6 — Điểm danh (thủ công)

- Ban Tổ chức / `kiem_soat` role marks attendance per buổi (session) via an admin UI table; records ngày/giờ/buổi.
- Attendance rate stats per buổi.
- **Acceptance**: `kiem_soat` claim can mark attendance but cannot edit retreat/registration data outside attendance.

### Phase 7 — Kết thúc khóa tu (lịch sử, chứng nhận, QR)

- On finalize: append an entry to `members.khoaTu[]` (existing field) for each attended member.
- Tổng kết báo cáo: số lượng tham dự theo Giáo đoàn, export summary.
- Chứng nhận điện tử: PDF generation from attendance criteria; downloadable, not auto-sent.
- QR mã tham dự + thẻ: generated after finalize; scanning flow reuses phone-camera web scan (mobile-first UI), feeds into Phase 6's attendance recording retroactively if this phase ships before Phase 6 is battle-tested — otherwise builds directly on Phase 6.
- This is the largest, most speculative phase; detailed design happens when phases 0-6 are stable and there's real usage feedback on the manual attendance flow.

## Testing strategy (all phases)

- Unit: use-case scope checks (role/orgUnitId), registration window/eligibility validation, sort/export formatting.
- Emulator integration: retreat create → register (self + proxy) → approve → export; rules deny cross-org reads for `giao_doan_admin`.
- UI: list/detail pages via existing component test patterns (`*.test.tsx` alongside admin pages).

## Success criteria

- Phase 1-4 fully cover the Giáo đoàn khóa tu quy trình (docx section II) end to end.
- Phase 5 extends it to the Hệ phái quy trình (docx section I) without duplicating phase 1-4 logic.
- Role/scope boundaries from the docx's "Phân quyền hệ thống" table are enforced at the use-case layer, not just hidden in the UI.
- No phase blocks on QR/chứng nhận until phase 7.

## Next step

Phase 1 code is on branch `feat/khoa-tu-retreats-phase1`: human smoke test, merge to `main`, deploy rules/indexes, then start Phase 2 design/plan (`writing-plans` for đăng ký).
