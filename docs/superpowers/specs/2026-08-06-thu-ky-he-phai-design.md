# Thư ký hệ phái — Design

Date: 2026-08-06  
App: `tanstack-app` (TanStack Start + React + Mantine)  
Auth: Firebase Auth custom claims + Cloudflare Worker (Identity Toolkit)  
Database: Firebase Firestore  

Related: [2026-08-05-thu-ky-giao-doan-design.md](./2026-08-05-thu-ky-giao-doan-design.md), [2026-07-25-khoa-tu-roadmap-design.md](./2026-07-25-khoa-tu-roadmap-design.md)

## Goal

Cho phép **Hệ phái admin gốc** (`he_phai_admin` / legacy `admin: true`) chọn một member có email **`@gmail.com`**, cấp quyền **Thư ký hệ phái** (claim `he_phai_secretary`, không `orgUnitId`). Người đó đăng nhập Google bằng đúng Gmail → vào `/admin` và quản lý **member, chùa, khóa tu, đăng ký** trên **mọi** giáo đoàn với quyền vận hành giống `he_phai_admin`, **trừ**:

- Không cấp / thu hồi thư ký (giáo đoàn hoặc hệ phái)
- Không ghi `orgUnits` (trang org-units read-only)

UI: nút cấp/thu hồi trên member detail; section danh sách Thư ký hệ phái trên `/admin/org-units` (cùng trang với thư ký giáo đoàn).

## Decisions (confirmed)

| Topic | Decision |
| --- | --- |
| Claim | Role mới `he_phai_secretary` (`orgUnitId: null`) — không reuse `he_phai_admin` |
| Quyền vận hành | Full CRUD directory + retreats + duyệt đăng ký, mọi org (như `he_phai_admin`) |
| Không được | Grant/revoke mọi loại thư ký; write `orgUnits` |
| Ai cấp / thu hồi | Chỉ `he_phai_admin` gốc |
| Email | Bắt buộc `@gmail.com` (giống thư ký giáo đoàn) |
| Số lượng | Nhiều Thư ký hệ phái |
| Provisioning | Worker set Auth custom claims + cờ `directoryRole` trên member (mở rộng pipeline hiện có) |
| UI list | Section trên `/admin/org-units` + member detail grant/revoke |

## Out of scope

- Cho phép thư ký hệ phái cấp/thu hồi thư ký
- Cho phép thư ký hệ phái ghi org-units
- Role `kiem_soat` / generic RBAC UI
- Google Workspace / non-`@gmail.com`
- Cypress E2E riêng
- Đổi Storage rules (trừ nếu grant/revoke đã dùng chung worker secrets)

## Data model

### Auth claims

```
{ role: 'he_phai_secretary' }
```

Không set `orgUnitId`. Không set `admin: true`.

`he_phai_admin` / legacy `admin: true` không đổi.

### `members/{id}` — mở rộng `directoryRole`

| Field | Type | Notes |
| --- | --- | --- |
| `directoryRole` | `'giao_doan_admin' \| 'he_phai_secretary' \| null` | Cờ UI + query; omit when unset |
| `directoryAuthUid` | string \| null | Firebase Auth uid đã gắn claim |
| `directoryRoleGrantedAt` | ISO string \| null | Thời điểm cấp |
| `directoryRoleGrantedBy` | string \| null | uid `he_phai_admin` đã cấp |

Một member chỉ giữ **một** `directoryRole` tại một thời điểm. Cấp loại kia yêu cầu thu hồi trước.

Query Thư ký hệ phái:

```
members where directoryRole == 'he_phai_secretary'
```

(limit hợp lý, ví dụ 200 — số lượng nhỏ).

## Domain helpers (`authClaims`)

| Helper | Behavior |
| --- | --- |
| `parseAuthClaims` | Accept `he_phai_secretary` |
| `canAccessOrgUnit` | `true` for `he_phai_admin` **and** `he_phai_secretary` (mọi org) |
| `canManageDirectory` / `canManageRetreats` | Include `he_phai_secretary` |
| `canGrantDirectoryRole` | **Only** `he_phai_admin` (unchanged) |
| `blocksSecretaryGrantOnAuthClaims` | Also block when existing Auth user has `he_phai_secretary` |

UI / use-cases that today branch on `role === 'he_phai_admin'` for **unscoped** org filters (members/temples/retreats lists, org picker on create) must treat `he_phai_secretary` the same way for those operational paths — **not** for grant UI or org-unit writes.

Introduce a small helper if useful, e.g. `isHePhaiScope(claims)` → `he_phai_admin \| he_phai_secretary`, vs `canGrantDirectoryRole` / `canWriteOrgUnits` → he_phai only.

## Architecture & flows

```
he_phai_admin (member detail / org-units section)
  → Worker POST grant | revoke (Bearer ID token)
    → verify he_phai_admin
    → Identity Toolkit: get-or-create Auth user by email + setCustomUserClaims
    → Firestore update members.directoryRole*
he_phai_secretary (Google login @gmail.com)
  → /admin gate (parseAuthClaims)
  → directory + retreats unscoped (all orgs)
  → cannot call grant/revoke; cannot write orgUnits
```

### Grant — extend existing API

`POST /api/admin/directory-role/grant`

Body:

```json
{ "memberId": "<id>", "role": "he_phai_secretary" }
```

Require explicit `"role": "giao_doan_admin" | "he_phai_secretary"`. Update existing client callers that currently omit `role`.

Steps for `he_phai_secretary`:

1. Verify Bearer → `he_phai_admin` only.
2. Load member; validate `@gmail.com`.
3. Fail if member already has any `directoryRole`.
4. Fail if another active secretary (any `directoryRole`) shares the same email.
5. Fail if Auth user for that email is privileged (`blocksSecretaryGrantOnAuthClaims` — include `he_phai_secretary`).
6. `setCustomUserClaims({ role: 'he_phai_secretary' })` (no `orgUnitId`).
7. Patch member `directoryRole*` fields.
8. Return summary for UI.

### Revoke

`POST /api/admin/directory-role/revoke` — body `{ memberId }` unchanged.

Works for both `giao_doan_admin` and `he_phai_secretary`: clear claims + clear member fields. Idempotent if no `directoryRole`.

### Guard when editing member

While any `directoryRole` is set: block client/use-case changes to `email` (and `orgUnitId` when role is `giao_doan_admin`). For `he_phai_secretary`, `orgUnitId` on the member profile is unrelated to claim scope — still allow normal org edits on the member record **unless** product wants lock; **decision: only lock `email` (and for giáo đoàn secretary also `orgUnitId` as today)**. Do not invent new locks for hệ phái beyond email.

## UI

### Member detail (admin)

Visible grant/revoke **only** to `he_phai_admin`:

- If no `directoryRole`: actions **Cấp Thư ký giáo đoàn** and **Cấp Thư ký hệ phái** (both disabled + tooltip when email missing / not `@gmail.com`).
- If `directoryRole === 'giao_doan_admin'`: badge + **Thu hồi Thư ký giáo đoàn**.
- If `directoryRole === 'he_phai_secretary'`: badge + **Thu hồi Thư ký hệ phái**.
- `he_phai_secretary` viewers: no grant/revoke controls; badge still visible read-only when `directoryRole` is set.

### `/admin/org-units`

Keep existing per–giáo đoàn secretaries column (he_phai grant UI only).

Add a **section above or below** the org-units table (he_phai grant UI only):

- Title: Thư ký hệ phái
- Table/list: display name, email, granted at; empty state
- Row action or shared modal: **Xoá** → revoke API + confirm

`he_phai_secretary` and `giao_doan_admin`: page remains **read-only** — org table without management columns/sections; no org-unit writes.

### Unscoped admin UX

Anywhere `claim.role === 'he_phai_admin'` currently unlocks org filter / create-for-any-org:

- Treat `he_phai_secretary` the same for members, temples, retreats lists/forms and registration review.

## Security

### Firestore rules

- Add `isHePhaiSecretary()` → `role() == 'he_phai_secretary'`.
- `canWriteDirectory()`, `directoryOrgOk`, `retreatOrgOk`, `canListDirectory`, staff checks used for directory/retreats: treat secretary like he_phai (**unscoped**).
- `orgUnits` **write** stays `isHePhaiAdmin()` only — **do not** include secretary.
- Client must not forge `directoryRole*` via member updates (existing rules that block directoryRole / email changes when secretary — extend for `he_phai_secretary`).

### Worker

- Grant/revoke: `verifyHePhaiAdminToken` only (not secretary).
- Other admin APIs that already accept he_phai + giao_doan: include secretary where operational parity is required (photo/doc if gated the same as directory writers).

## Error handling

Same codes as thư ký giáo đoàn, plus:

| Case | Behavior |
| --- | --- |
| Invalid / missing `role` on grant | 400 |
| Member already has other `directoryRole` | 400 |
| Caller is `he_phai_secretary` | 403 on grant/revoke |

## Testing

- Domain: `parseAuthClaims` / `canAccessOrgUnit` / `canManageDirectory` / `canGrantDirectoryRole` / `blocksSecretaryGrantOnAuthClaims` for `he_phai_secretary`.
- Worker: grant `he_phai_secretary` happy path; reject non-he_phai; revoke clears both role types.
- Firestore rules integration: secretary can list/write members/temples/retreats across orgs; cannot write `orgUnits`; cannot change `directoryRole` via client.
- Vitest UI: member detail dual grant actions; org-units hệ phái section + revoke; unscoped filters for secretary role.
- No new Cypress spec.

## Success criteria

1. He_phai gốc cấp Thư ký hệ phái trên member `@gmail.com`; thấy trên section `/admin/org-units`.
2. Người đó đăng nhập Google → `/admin` với CRUD directory + retreats mọi giáo đoàn.
3. Thư ký hệ phái **không** thấy / không gọi được grant-revoke; **không** ghi được org-units (rules + UI).
4. Thu hồi từ member detail hoặc org-units section → mất quyền sau token refresh.
5. Thư ký giáo đoàn flow hiện có vẫn hoạt động (grant body có `role` explicit).
)