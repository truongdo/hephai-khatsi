# Khóa tu — Phase 2: Đăng ký (tự đăng ký + đăng ký thay)

Date: 2026-07-30  
Status: approved for planning  
Parent roadmap: [2026-07-25-khoa-tu-roadmap-design.md](./2026-07-25-khoa-tu-roadmap-design.md)  
Depends on: Phase 0 RBAC + Phase 1 Giáo đoàn retreat CRUD (on `main`)

## Goal

Ship **self-service** and **proxy** registration for Giáo đoàn retreats: per-retreat registration invites, phone identity (existing member confirm or full new-member filler form), `extraAnswers`, shared eligibility guards, and an admin **read-only** registration list. Approval/reject stays Phase 3.

## Decisions (confirmed)

| Topic | Choice |
| --- | --- |
| Channels | Self + proxy in the same phase |
| Missing member (self) | Create full member profile (reuse filler `MemberEditor`), then register |
| Existing member (self) | Identity summary only → `extraAnswers` → submit (no profile edit in this flow) |
| Registration link | Dedicated invite/token **per retreat** (separate from filler `invites/public`) |
| Org scope | Only members of the retreat’s `orgUnitId`; new members lock to that org |
| Proxy picker | Phone lookup within the retreat’s Giáo đoàn |
| Proxy missing member | Do **not** create member in proxy flow — direct admin to directory first |
| Window / status | Both channels require `status === 'open'` **and** now ∈ `[dangKyMoTu, dangKyDongLuc]` |
| `quyenDangKy` | Self needs `tu_dang_ky` \| `both`; proxy needs `proxy_only` \| `both` |
| Admin list | Read-only list per retreat in Phase 2; no approve/reject/delete |
| Architecture | Per-retreat invite docs + top-level `retreatRegistrations`; guards in use-cases; rules for public get/create vs staff list |

## Out of scope

- Approve / reject / bulk review (Phase 3)
- CSV export / reports (Phase 4)
- `type: 'he_phai'`, cross-org registration (Phase 5)
- Attendance, certificates, QR (Phases 6–7)
- Cloud Functions as the write path (deferred unless Phase 2 proves insufficient)
- Bulk proxy multi-select from member list
- Changing filler `/f/{token}` behavior beyond invite schema backward compatibility
- Cypress journey (Vitest + rules emulator unless a later smoke is justified)

## Architecture

```
Self:  /r/$token
  → getInviteByToken (kind: retreat_registration)
  → load retreat
  → phone lookup (orgUnitId locked)
  → create member (full form) OR confirm existing
  → extraAnswers → createRetreatRegistration (self)

Proxy: /admin/retreats/$id/registrations
  → canManageRetreats + org scope
  → ensureRetreatRegistrationInvite (copy link)
  → list registrations (read-only)
  → phone lookup → extraAnswers → createRetreatRegistration (proxy)

Shared: domain guards + retreatRegistrationRepo + queryOptions
        invites extended (filler unchanged in behavior)
```

| Unit | Responsibility | Depends on |
| --- | --- | --- |
| Invite domain | Discriminate `filler` vs `retreat_registration`; parse legacy filler docs without `kind` as `filler` | pure |
| Registration domain | Types; validate `extraAnswers` against `extraFields`; window / `quyenDangKy` / open helpers | pure |
| `inviteRepo` | `ensureRetreatRegistrationInvite`, get-by-token; idempotent id `retreat_{retreatId}` | Firebase |
| `retreatRegistrationRepo` | `create`, `getByRetreatAndMember`, `listByRetreat` (limit + cursor) | Firebase |
| `createRetreatRegistration` | Shared create path for self/proxy; all guards; duplicate reject | repos + claims |
| Self UI routes | `/r/$token` wizard | invite + member + registration use-cases |
| Admin UI | Registrations tab/page under retreat; copy link; proxy form | admin queries |
| Rules | Public invite get; public retreat get by id; constrained self create; staff list; no status updates in Phase 2 | — |

## Data model

### `invites/{inviteId}` (extended)

| Field | Type | Notes |
| --- | --- | --- |
| `token`, `createdAt`, `createdBy` | existing | |
| `kind` | `'filler' \| 'retreat_registration'` | Legacy docs without `kind` read as `filler` |
| `retreatId` | string \| null | Required for `retreat_registration` |
| `orgUnitId` | string \| null | Copied from retreat at ensure-time |
| `disabled` | boolean | Default `false`; revoke without deleting |

- Filler: keep doc id `public`, `kind: 'filler'`.
- Retreat: doc id `retreat_{retreatId}` (one invite per retreat, idempotent ensure).
- Public URL: `/r/{token}` (not under `/f/`, so filler and registration stay separate).

### `retreatRegistrations/{registrationId}`

| Field | Type | Notes |
| --- | --- | --- |
| `retreatId`, `memberId`, `orgUnitId` | string | `orgUnitId` = retreat’s Giáo đoàn |
| `registeredVia` | `'self' \| 'proxy'` | |
| `registeredBy` | string \| null | Admin uid when proxy; `null` when self |
| `extraAnswers` | `Record<string, string>` | Keys from `retreat.extraFields` |
| `status` | `'pending' \| 'approved' \| 'rejected'` | Always `pending` on create in Phase 2 |
| `approvedBy` / `approvedAt` | string \| null | Always `null` in Phase 2 |
| `createdAt` / `updatedAt` | string | ISO |

**Uniqueness:** at most one registration per `(retreatId, memberId)` — enforced in `createRetreatRegistration` via lookup before write. Indexes: `retreatId + memberId`; `retreatId + createdAt` for list.

### `retreats`

No registration-token field on the retreat doc. Copy-link uses `ensureRetreatRegistrationInvite`.

## Flows

### Self-service

1. Open `/r/$token` → load invite; reject if missing, wrong `kind`, or `disabled`.
2. Load retreat by `invite.retreatId`. Gate: `open` + inside registration window + `quyenDangKy` allows self.
3. Collect phone (+ sangha type as required by existing phone index lookup) scoped to `invite.orgUnitId`.
4. **0 matches:** full member editor (`orgUnitId` locked, `inviteId` = retreat invite) → then step 5.
5. **Has member:** confirmation summary (read-only) → `extraAnswers` form (required fields enforced) → `createRetreatRegistration` with `registeredVia: 'self'`.
6. Success screen: submitted, awaiting approval.

### Proxy (admin)

1. `/admin/retreats/$id/registrations` — requires `canManageRetreats` + org access to the retreat.
2. “Copy registration link” → ensure invite → clipboard `${origin}/r/${token}`.
3. Read-only table of registrations for this retreat (member display fields via existing member reads / denormalized display as needed for the list).
4. “Đăng ký thay”: phone lookup in retreat `orgUnitId` → confirm → `extraAnswers` → create with `registeredVia: 'proxy'`, `registeredBy: uid`. Same open/window gates; `quyenDangKy` must allow proxy.
5. If phone has no member: message to create the member in the directory first (no create-member UI in proxy flow).

## Firestore rules (Phase 2 intent)

- **`invites`:** public `get` unchanged; staff may create/ensure retreat invites; no public list. Filler create path unchanged.
- **`retreats`:** allow **public `get` by id** (token URL implies id via invite). **No** public `list`. Staff read/write remain Phase 1 scoped rules.
- **`retreatRegistrations`:**
  - Unauthenticated **create** only for self-shaped docs (`registeredVia == 'self'`, `status == 'pending'`, `approvedBy == null`); full window/`quyenDangKy` enforcement lives in the use-case (rules cannot cheaply express time window against another doc).
  - Staff **list/get/create** when `canManageRetreats` equivalent + `orgUnitId` in scope (`retreatOrgOk`).
  - **No update/delete** for anyone in Phase 2 (approval opens updates in Phase 3).
- **Members:** retreat invite participates in existing invite-scoped draft create/update (`validInviteScope`), same as filler.

Honest limit: Phase 2 trusts client use-cases for window/`quyenDangKy` on self-create, backed by rules shape checks + emulator tests; revisit Cloud Functions only if abuse appears.

## Error handling

Use-case failures with clear user-facing messages:

- Invite invalid / disabled
- Retreat not open or outside registration window
- `quyenDangKy` disallows channel
- Member `orgUnitId` ≠ retreat `orgUnitId`
- Duplicate `(retreatId, memberId)`
- Missing required `extraAnswers`
- Proxy: member not found

## Testing

- **Unit:** window / `quyenDangKy` / org / duplicate guards; invite parse backward compatibility; create self vs proxy.
- **Component:** self gate + confirm + extraAnswers; admin list + proxy phone form + copy link.
- **Rules emulator:** self create allowed under invite-shaped constraints; staff scoped list; cross-org deny for `giao_doan_admin`; unauth cannot list; staff cannot update status in Phase 2.

## Acceptance criteria

1. Self via per-retreat invite can register an existing same-org member or create a full new member then register → `status: pending`.
2. Proxy via phone lookup registers with `registeredVia: 'proxy'` and `registeredBy` set.
3. Outside window, not `open`, or wrong `quyenDangKy` → both channels rejected.
4. Duplicate member+retreat → rejected.
5. Admin sees read-only registration list; cannot approve/reject in this phase.
6. Filler public invite flow remains behaviorally unchanged.

## Next step

Invoke `writing-plans` → `docs/superpowers/plans/2026-07-30-khoa-tu-registration-phase2.md`, then implement on a feature branch from `main`.
