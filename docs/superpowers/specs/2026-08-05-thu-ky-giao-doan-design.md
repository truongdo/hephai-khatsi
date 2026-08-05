# Thư ký giáo đoàn — Design

Date: 2026-08-05  
App: `tanstack-app` (TanStack Start + React + Mantine)  
Auth: Firebase Auth custom claims + Cloudflare Worker (Identity Toolkit)  
Database: Firebase Firestore  

Related: [2026-07-25-khoa-tu-roadmap-design.md](./2026-07-25-khoa-tu-roadmap-design.md) (roles `he_phai_admin` / `giao_doan_admin` / `kiem_soat`), RBAC phase 0 plan.

## Goal

Cho phép **Hệ phái admin** chọn một member có email **`@gmail.com`**, cấp quyền **Thư ký giáo đoàn** (map 1:1 sang claim `giao_doan_admin` + `orgUnitId` của member). Thành viên đăng nhập Google bằng đúng Gmail đó thì vào `/admin` và quản lý **member, chùa, khóa tu** trong giáo đoàn của mình với quyền CRUD đầy đủ (giống Hệ phái admin nhưng scoped).

Bổ sung UI trên `/admin/org-units`: cột danh sách Thư ký; click mở modal chi tiết và **xoá** (thu hồi) quyền.

## Decisions (confirmed)

| Topic | Decision |
| --- | --- |
| Role | Reuse `giao_doan_admin` — không tạo role mới; UI label = “Thư ký giáo đoàn” |
| Ai cấp / thu hồi | Chỉ `he_phai_admin` |
| Quyền trong giáo đoàn | Full CRUD member / temple / khóa tu + xét duyệt đăng ký (giống he_phai trong scope) |
| Số lượng | Nhiều Thư ký / giáo đoàn |
| Email | Bắt buộc `@gmail.com` (consumer Gmail only) |
| Provisioning | Cách 1 — Worker set Auth custom claims ngay khi cấp; ghi cờ trên member |
| Org-units UI | Cột Thư ký + modal xoá; quản lý chỉ `he_phai_admin` |

## Out of scope

- Role mới hoặc đổi claim string khỏi `giao_doan_admin`
- Thư ký cấp quyền cho người khác
- Giới hạn cứng 1 Thư ký / giáo đoàn
- Google Workspace / non-`@gmail.com` emails
- Đổi Storage rules / worker photo-doc org-scope (trừ credential cần cho grant/revoke APIs)
- Cypress E2E riêng cho journey này
- Generic RBAC UI cho `kiem_soat` / `he_phai_admin` assignment

## Data model

### `members/{id}` — fields mới

| Field | Type | Notes |
| --- | --- | --- |
| `directoryRole` | `'giao_doan_admin' \| null` (omit when unset) | Cờ UI + query danh sách Thư ký |
| `directoryAuthUid` | `string \| null` | Firebase Auth uid đã gắn claim |
| `directoryRoleGrantedAt` | ISO string \| null | Thời điểm cấp |
| `directoryRoleGrantedBy` | string \| null | uid `he_phai_admin` đã cấp |

`email` giữ nguyên (optional trên profile). Khi cấp quyền: bắt buộc có, normalize lowercase, kết thúc bằng `@gmail.com`.

Không tạo collection roles riêng. Danh sách Thư ký theo giáo đoàn:

```
members where directoryRole == 'giao_doan_admin' [and orgUnitId == X]
```

Composite index: `directoryRole` + `orgUnitId` (nếu query theo org); hoặc một query toàn bộ `directoryRole == 'giao_doan_admin'` rồi group trên client (số Thư ký nhỏ).

### Auth claims (không đổi schema)

```
{ role: 'giao_doan_admin', orgUnitId: '<member.orgUnitId>' }
```

`he_phai_admin` / legacy `admin: true` không đổi. Thư ký **không** nhận `admin: true`.

## Architecture & flows

```
he_phai_admin (member detail / org-units modal)
  → Worker POST grant | revoke (Bearer ID token)
    → verify he_phai_admin
    → Identity Toolkit: get-or-create Auth user by email + setCustomUserClaims
    → Firestore update members.directoryRole*
giao_doan_admin (Google login @gmail.com)
  → existing /admin gate (parseAuthClaims / useAdminClaim)
  → members / temples / retreats scoped by token.orgUnitId
```

### Grant (`POST /api/admin/directory-role/grant`)

Body: `{ memberId: string }`

1. Verify Bearer token → must be `he_phai_admin` (or legacy admin mapped as such).
2. Load member; fail if missing.
3. Validate `email` ends with `@gmail.com` (case-insensitive).
4. Fail if member already has `directoryRole == 'giao_doan_admin'`.
5. Fail if another member already holds Thư ký with the same email (active `directoryRole`).
6. Identity Toolkit: get user by email or create; `setCustomUserClaims({ role: 'giao_doan_admin', orgUnitId: member.orgUnitId })`.
7. Update member: `directoryRole`, `directoryAuthUid`, `directoryRoleGrantedAt`, `directoryRoleGrantedBy`.
8. Return updated summary for UI.

Caller must refresh ID token after first login; grant on an already-signed-in user may require `getIdToken(true)` once claims change (document in UI toast if needed).

### Revoke (`POST /api/admin/directory-role/revoke`)

Body: `{ memberId: string }`

1. Verify `he_phai_admin`.
2. Load member; if no `directoryRole`, idempotent success.
3. Clear custom claims on `directoryAuthUid` (empty claims object / remove role + orgUnitId).
4. Clear `directoryRole*` fields on member.
5. Invalidate client queries (secretaries list + member detail).

### Guard when editing member

While `directoryRole` is set: **block** client/use-case changes to `email` or `orgUnitId` (and Worker/rules should reject such updates if feasible). Admin must revoke first, then edit, then re-grant if needed.

## UI

### Member detail (admin)

- Visible only to `he_phai_admin`.
- Actions: **Cấp Thư ký giáo đoàn** / **Thu hồi Thư ký** according to `directoryRole`.
- Grant disabled + tooltip when email missing or not `@gmail.com`.
- Badge “Thư ký giáo đoàn” when active.

### `/admin/org-units`

| Existing columns | New column |
| --- | --- |
| Code, Name, Kind | **Thư ký giáo đoàn** — comma-separated display names (pháp danh / thế danh fallback email); “—” if none |

- Click the secretaries cell → **Modal**: list (pháp danh/thế danh, email, granted at) + **Xoá** per row with confirm → revoke API.
- Data load: prefer one query of all members with `directoryRole == 'giao_doan_admin'`, group by `orgUnitId` on client.
- Column + modal management: **`he_phai_admin` only**. `giao_doan_admin` may still see the org-units list read-only **without** the management column/modal (same page visibility as today for directory managers, minus grant/revoke).

### Scoped admin UX for `giao_doan_admin`

Mirror retreats:

- Member and temple list/create/edit: org filter / org picker **locked** to `claim.orgUnitId`.
- Use-cases (`saveAdminMember`, deletes, temple save/delete, etc.): call `canAccessOrgUnit` before writes.
- Retreats: already scoped — keep as-is.

## Security

### Firestore rules

Extend directory access for `giao_doan_admin` analogous to `retreatOrgOk(orgUnitId)`:

- `list` / `create` / `update` / `delete` on `members` and `temples`: require `he_phai` **or** (`giao_doan_admin` and document `orgUnitId == token.orgUnitId`).
- For `list`, `giao_doan_admin` clients **must** query with `where('orgUnitId', '==', token.orgUnitId)` (same constraint pattern as retreats); rules reject unconstrained lists.
- Public `get` by id (filler bearer model) unchanged.
- **`orgUnits` writes = `he_phai_admin` only** (narrow from current `canWriteDirectory()`). Thư ký does not edit org unit docs; page stays read-only for them.

### Worker

- New routes under existing worker; require Firebase service account secret (env) for Identity Toolkit Admin operations.
- Grant/revoke: `he_phai_admin` only.
- Existing photo/doc admin APIs: no org-scope change in this feature (out of scope).

## Error handling

| Case | Behavior |
| --- | --- |
| Not `@gmail.com` | 400 + i18n message; button disabled client-side |
| Email already Thư ký on another member | 400 |
| Not he_phai | 403 |
| Member not found | 404 |
| Identity Toolkit failure | 502/500 + log; no partial member flag without successful claims (transactional order: claims first, then member fields; on member write failure after claims, retry/compensate revoke claims) |

## Testing

- Domain: `@gmail.com` validation; grant/revoke request shape.
- Worker unit: grant/revoke happy path; reject non-he_phai, bad email, duplicate email.
- Firestore rules integration: `giao_doan_admin` list/write only own org members/temples; he_phai unrestricted; `orgUnits` write he_phai-only.
- Vitest UI: OrgUnits secretaries column + modal revoke; member detail grant/revoke disabled without Gmail.
- No new Cypress spec.

## Success criteria

1. He_phai can grant Thư ký on a member with `@gmail.com` and see them on `/admin/org-units`.
2. That person signs in with Google (same Gmail) and reaches `/admin` with full directory + retreat management for their `orgUnitId` only.
3. He_phai can revoke from org-units modal or member detail; access stops after token refresh.
4. Rules prevent `giao_doan_admin` from reading/writing other orgs’ members/temples via list/write.
)