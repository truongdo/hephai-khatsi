# Khóa tu — Phase 1: CRUD khóa tu (Giáo đoàn)

Date: 2026-07-25  
Status: approved for planning  
Parent roadmap: [2026-07-25-khoa-tu-roadmap-design.md](./2026-07-25-khoa-tu-roadmap-design.md)  
Depends on: Phase 0 RBAC (`domain/authClaims`, `useAdminClaim` role/orgUnitId) — complete

## Goal

Ship admin CRUD for **Giáo đoàn-organized** retreats (`type: 'giao_doan'`): create, edit, list (scoped), open/close registration via controlled status actions, and delete drafts — with Firestore rules and client capability checks that understand `role` + `orgUnitId`, including a hard split so `kiem_soat` cannot manage retreats or the existing directory.

## Decisions (confirmed)

| Topic | Choice |
| --- | --- |
| Form fields | Full roadmap schema in Phase 1, including registration window, `quyenDangKy`, and `extraFields` editor (registration UX itself is Phase 2) |
| Who can create | `giao_doan_admin` for own `orgUnitId`; `he_phai_admin` may create for any Giáo đoàn (select org unit) |
| Status | Controlled workflow: create as `draft` → action “Mở đăng ký” (`open`) ↔ “Đóng đăng ký” (`closed`). No free-form status dropdown. `finalized` deferred |
| Delete | Hard-delete only when `status === 'draft'` |
| Edit when open/closed | Metadata editable (name, place, content, eligibility, course dates, registration window, `extraFields`, `quyenDangKy`). `type` and `orgUnitId` immutable |
| `kiem_soat` | Capability split now: may enter `/admin` shell but cannot see/write retreats, members, temples, or org-units (nav hidden; routes denied; rules deny writes) |
| Architecture | Mirror temples/members: domain + repo + use-cases + `adminQueries` + admin UI; enforce scope in use-cases **and** Firestore rules |

## Out of scope

- `retreatRegistrations`, self/proxy registration, invite registration routes (Phase 2+)
- `type: 'he_phai'`, cross-org aggregation, `finalized` (Phase 5 / 7)
- Attendance, certificates, QR (Phases 6–7)
- Role-assignment UI (manual claims remain OK)
- Soft-delete / archive
- Cypress journey (Vitest + rules emulator only unless a later smoke is justified)
- Storage rules changes beyond extending `isAdmin()` / write capability for existing photo paths if they still gate solely on `admin == true` (same role-awareness as Firestore)

## Architecture

```
authClaims (capabilities)
  → use-cases (create / update / open / close / delete / list scope)
      → retreatRepo → Firestore `retreats`
  → adminQueries / adminKeys → Admin UI
firestore.rules + storage.rules (role-aware admin + retreat scope)
```

| Unit | Responsibility | Depends on |
| --- | --- | --- |
| `domain/authClaims` helpers | `canManageDirectory(claims)`, `canManageRetreats(claims)` — true for `he_phai_admin` / `giao_doan_admin`; false for `kiem_soat`. Keep `canAccessOrgUnit` | pure |
| Retreat domain type + transitions | `Retreat` type; pure helpers for allowed status transitions; forbid writing `finalized` in Phase 1 use-cases | pure |
| `retreatRepo` | `create`, `update`, `getById`, `list` (optional `orgUnitId` + status filters, `limit` + cursor), `delete` | Firebase |
| Use-cases | Accept `AuthClaims` + input; enforce capability, org scope, immutables, status rules | repo + domain |
| `adminQueries` / `adminKeys` | `retreatsQuery`, `retreatQuery` with intentional `staleTime` | repo |
| Admin UI | List / new / detail routes; nav item; capability-gated shell | queries + use-cases |
| Rules | Role-aware admin; directory writes exclude `kiem_soat`; `retreats` scoped by `orgUnitId` | — |

## Data model

### `retreats/{retreatId}`

| Field | Type | Notes |
| --- | --- | --- |
| `type` | `'giao_doan'` | Phase 1 create always sets this; immutable |
| `orgUnitId` | string | Required; set at create; immutable |
| `name`, `diaDiem`, `noiDung`, `doiTuongThamDu` | string | |
| `thoiGianBatDau` / `thoiGianKetThuc` | timestamp | Course schedule |
| `dangKyMoTu` / `dangKyDongLuc` | timestamp | Registration window (enforced in Phase 2) |
| `extraFields` | `{ key: string, label: string, required: boolean }[]` | Admin-defined; keys unique within a retreat |
| `quyenDangKy` | `'tu_dang_ky' \| 'proxy_only' \| 'both'` | |
| `status` | `'draft' \| 'open' \| 'closed'` | Phase 1 only these three |
| `createdBy` | string | Auth uid |
| `createdAt` / `updatedAt` | timestamp | |

Id generation: Firestore auto-id (same as typical admin creates), unless an existing repo pattern prefers deterministic ids — follow `templeRepo` / `memberRepo` convention of auto-id for non-deterministic entities.

### Status transitions

| From | Action | To |
| --- | --- | --- |
| (create) | `createRetreat` | `draft` |
| `draft` or `closed` | `openRetreat` | `open` |
| `open` | `closeRetreat` | `closed` |
| `draft` | `deleteRetreat` | (removed) |

`updateRetreat` must not change `status`, `type`, or `orgUnitId`.

## Auth & rules

### Client capabilities

- `parseAuthClaims` / `canAccessOrgUnit` unchanged in semantics.
- Add:
  - `canManageDirectory(claims)` — members, temples, org-units admin CRUD
  - `canManageRetreats(claims)` — retreat admin CRUD
- Both true for `he_phai_admin` and `giao_doan_admin`; both false for `kiem_soat`.
- `/admin` entry: any recognized role (including `kiem_soat`) may reach the shell (Phase 0 behavior).
- Nav items and route loaders for directory + retreats require the matching capability; otherwise `AdminDenied` (or redirect to `/admin`).

### Firestore

- Extend `isAdmin()` (or split helpers) so legacy `admin == true` **or** `role` in `he_phai_admin` | `giao_doan_admin` | `kiem_soat` counts as authenticated admin for **read** paths that today use `isAdmin()` where `kiem_soat` should still read nothing sensitive they shouldn't — prefer:

  - `isSignedInAdmin()` — any of the three roles or legacy admin (shell / broad “is staff”)
  - `canWriteDirectory()` — `he_phai_admin` | `giao_doan_admin` | legacy `admin`
  - `canAccessRetreat(orgUnitId)` — `he_phai_admin` / legacy admin: all; `giao_doan_admin`: `token.orgUnitId == orgUnitId`

- Replace directory **write** gates (members, temples, orgUnits, related indexes as applicable) with `canWriteDirectory()`, not bare `isAdmin()` that would include `kiem_soat`.
- New `match /retreats/{id}`:
  - get/list: `he_phai_admin` (or legacy admin) any; `giao_doan_admin` only docs with matching `orgUnitId` (list queries must include equality filter on `orgUnitId` for scoped admins — document this for the repo `list` implementation)
  - create: `canWriteDirectory()` + `type == 'giao_doan'` + `status == 'draft'` + org scope on `request.resource.data.orgUnitId`
  - update: same writers + cannot change `type`/`orgUnitId`; status changes only along allowed transitions (express as field-diff checks where practical; use-case remains source of truth for nuanced validation)
  - delete: writers + `resource.data.status == 'draft'` + org scope

### Storage

- Mirror the directory write split: photo/admin storage writes that today require `isAdmin()` must not allow `kiem_soat` if they would grant directory-adjacent writes. Exact helper naming can match Firestore.

### Operational note

Until rules ship, continue provisioning `{ admin: true, role, orgUnitId? }` for non–he-phai roles if needed for legacy paths; after Phase 1, `giao_doan_admin` / `kiem_soat` can rely on `role` without `admin: true` for allowed operations.

## Use-cases

| Use-case | Behavior |
| --- | --- |
| `createRetreat` | Require `canManageRetreats`; resolve `orgUnitId` (forced from claim for `giao_doan_admin`; from input for `he_phai_admin`); set `type: 'giao_doan'`, `status: 'draft'`; validate required strings/timestamps/`extraFields` keys |
| `updateRetreat` | Require access to existing doc's org; strip `type`/`orgUnitId`/`status`; validate patch |
| `openRetreat` / `closeRetreat` | Transition only; require org access |
| `deleteRetreat` | Only `draft`; require org access |
| List | Repo query: `giao_doan_admin` always passes claim `orgUnitId`; `he_phai_admin` optional filter |

All throw `DomainError` with codes such as `FORBIDDEN`, `NOT_FOUND`, `INVALID_STATUS`, `VALIDATION`.

## UI

Routes (TanStack Router), reuse `AdminShell`, breadcrumbs, `AdminDataTable`, sticky form actions:

- `/admin/retreats` — list
- `/admin/retreats/new` — create
- `/admin/retreats/$id` — edit/detail + status actions

Nav: “Khóa tu” → `/admin/retreats` when `canManageRetreats`.

**List:** name, org unit, course dates, status badge, registration window; status filter; org filter for `he_phai_admin`; create button; delete affordance only for `draft` rows.

**Form:** full field set; simple `extraFields` editor (add/remove rows: key, label, required). Create: org select only for `he_phai_admin`. Edit: org + type disabled.

**Actions:** Save · Open registration · Close registration · Delete (draft only).

**`kiem_soat`:** no directory/retreats nav; deep links → denied.

## Error handling

- Mutations: surface `DomainError` via existing notification / `QueryErrorAlert` patterns.
- Cross-org `getById`: treat as not found or forbidden — do not leak existence in UI copy beyond existing admin norms.
- List is query-scoped so empty list means “none in scope”, not a silent mask of forbidden docs.

## Testing

- Unit: capability helpers; status transitions; create/update/delete/open/close scope matrix (`he_phai` / `giao_doan` / `kiem_soat`).
- Emulator rules: cross-org deny for `giao_doan_admin`; `kiem_soat` deny directory + retreat writes; legacy `admin: true` still full directory + retreats.
- UI Vitest: list/form smoke aligned with temples/members admin tests.

## Acceptance

1. `giao_doan_admin` can create/edit/list/open/close/delete-draft retreats only for their `orgUnitId`; cannot read/write another unit’s retreats (rules + use-case).
2. `he_phai_admin` (and legacy `admin: true`) can manage retreats for any Giáo đoàn.
3. Form persists full schema including `extraFields` and `quyenDangKy`.
4. Status only changes via open/close actions; create starts `draft`; delete only in `draft`.
5. `kiem_soat` reaches `/admin` but cannot use members/temples/org-units/retreats UI or succeed at those writes under rules.
6. Existing admin directory flows keep working for `he_phai_admin` / `giao_doan_admin` / legacy admin after rules change.

## Next step

Invoke `writing-plans` for this Phase 1 design → `docs/superpowers/plans/2026-07-25-khoa-tu-retreats-crud-phase1.md`.
