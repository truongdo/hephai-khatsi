# Hệ phái Khất sĩ Admin UI — Design

Date: 2026-07-19  
App: `tanstack-app` (TanStack Start + React 19 + Mantine + Paraglide + TanStack Query)  
Depends on: `docs/superpowers/specs/2026-07-19-he-phai-khatsi-database-design.md`, Firebase Auth login, existing admin/filler server functions

## Goal

Ship an **admin ops console** with a flat sidebar so claimed admins can manage invitation links, browse and lean-edit temples and sangha members (Tăng / Ni), lock and unlock records, and view org units — without opening client Firestore access to PII.

## Decisions

| Topic | Choice |
| --- | --- |
| Scope | Full ops shell: invites + temples + members + org units |
| Layout | Nested `/admin` routes + Mantine `AppShell` sidebar |
| Sidebar IA | Flat: Lời mời · Tịnh xá/thất · Tăng · Ni · Tổ chức |
| Access | Signed-in + Firebase custom claim `admin === true`; non-admins see an explicit denied page |
| Record actions | List / filter / detail; lean create & edit drafts; lock + unlock |
| Admin create vs invites | Admin may create drafts without an invite; `inviteId` becomes `string \| null` |
| Org units UI | Read-only list; no seed button in UI |
| Form depth (this phase) | Lean identity/required fields only; full paper-form editors deferred |
| Data access | All PII via `createServerFn` + Admin SDK; keep Firestore rules deny-public on PII |
| Unlock | Supported (new use-cases + server fns + UI) |
| Invite lifecycle | Create + list + copy `/f/{token}`; no revoke/expiry |
| Session | Client Firebase Auth ID token passed to admin server fns (no session cookies yet) |
| i18n | Paraglide, Vietnamese default |
| Public site chrome | Unchanged `AppHeader` on non-admin routes; admin uses AppShell header |

## Out of scope

- Filler public forms at `/f/$token` (separate plan)
- Full paper-form field parity (precepts, ranks, land rights, etc.)
- Invite revoke / expiry
- Org-unit seed button in UI (scripts / existing `seedOrgUnitsFn` remain for ops)
- Member photo upload UI
- HttpOnly session cookies / SSR-verified admin gates
- Client Firestore reads of PII (`allow read: if isAdmin()` deferred)
- Multi-admin roles / per–org-unit permissions
- Cypress coverage of every screen (one thin journey only)

## Architecture

```
AuthProvider (user + loading)
  → /admin layout gate (login redirect | denied page | AppShell)
    → TanStack Query (queryOptions / mutations)
      → admin createServerFn (idToken → assertAdmin)
        → use-cases → repositories (Firebase Admin SDK)
```

1. **`/admin` route tree** — layout route owns AppShell + claim gate; child routes are sidebar targets and detail/new pages.
2. **Claim gate** — after auth `loading === false`: no user → `/login` with return URL; user without `admin` claim → full-page “Không có quyền quản trị” **in place of** the AppShell (same `/admin/*` URL, no separate denied route); admin → shell. Client claim check is UX-only; every server fn still runs `assertAdmin`.
3. **Admin Query layer** — key factories + `queryOptions` for lists/details; intentional `staleTime`; cursor pagination with `limit` (never `offset`); targeted invalidation after mutations; seed detail cache from list rows when safe.
4. **Domain extensions** — nullable `inviteId`; unlock temple/member; admin save create/update without invite token (org unit chosen explicitly; CCCD / `managerPhones` rules and CCCD index still enforced).
5. **Repositories** — add list/get helpers needed for admin lists; keep converters/types aligned with the DB design.

## Routes

| Path | Purpose |
| --- | --- |
| `/admin` | Redirect to `/admin/invites` |
| `/admin/invites` | Invite list + create + copy link |
| `/admin/temples` | Temple list + filters |
| `/admin/temples/new` | Lean temple create |
| `/admin/temples/$id` | Temple detail / lean edit / lock / unlock |
| `/admin/members/tang` | Tăng member list |
| `/admin/members/ni` | Ni member list |
| `/admin/members/new?sanghaType=tang\|ni` | Lean member create |
| `/admin/members/$id` | Member detail / lean edit / lock / unlock |
| `/admin/org-units` | Read-only org unit list |

## Sidebar

Flat `NavLink`s (active state from route):

- Lời mời → `/admin/invites`
- Tịnh xá / Tịnh thất → `/admin/temples`
- Tăng → `/admin/members/tang`
- Ni → `/admin/members/ni`
- Tổ chức → `/admin/org-units`

Desktop-first; collapse to burger drawer on small screens. AppShell header: product/admin title + signed-in identity + sign out.

## Screens

### Invites

- Table: org unit name, form type, createdAt, createdBy.
- Create modal/form: org unit + form type → `createInviteFn` → show and copy `/f/{token}`.
- Optional filters: org unit, form type.
- No revoke UI.

### Temples / Tăng / Ni lists

- Filters: org unit, status (`draft` \| `locked`).
- Paginated lean table (name / pháp danh, phone or CCCD, status, updatedAt).
- CTA: Thêm mới → create route.
- Row click → detail.

### Detail / create (lean)

**Temple fields:** org unit, danh hiệu, trụ trì phone (synced into `managerPhones` on save), optional short address fields as already modeled.

**Member fields:** org unit, sangha type, CCCD, pháp danh / thế danh, phone.

- Draft: Save + Lock.
- Locked: read-only + Unlock (returns to draft).
- Show invite linkage when `inviteId` is set; otherwise label as admin-created.

### Tổ chức

- Read-only table: code, name, kind, flags as useful.
- No seed / edit actions.

## Backend additions

| Area | Work |
| --- | --- |
| Types | `inviteId: string \| null` on `Temple` / `Member` |
| Use-cases | `unlockTemple`, `unlockMember`; admin create/update temple & member (no token) |
| Repos | List invites; list temples/members with filters + cursor; list org units (if missing) |
| Server fns | List/get/save admin fns; `unlockTempleFn` / `unlockMemberFn`; keep existing create invite + lock |
| Indexes | Add/confirm composite indexes for admin list filters (org unit + status + sanghaType as needed) |
| Rules | Remain deny-public for PII; Admin SDK bypasses rules |

Filler invite-token flows stay unchanged and continue to set `inviteId` from the invite.

## Data flow

1. Admin opens `/admin/...` → gate resolves claim → AppShell renders.
2. List route `ensureQueryData` / `useQuery` with shared `queryOptions` → server fn → use-case → repo.
3. Mutations pass `await user.getIdToken()` into server fn; on success invalidate list + detail keys (or patch cache from result).
4. Lock/unlock toggle `status` and lock metadata; UI switches editability.

## Error handling

- Map `DomainError` via existing `toErrorPayload` to Vietnamese alerts.
- `UNAUTHORIZED` → treat as signed-out / re-login.
- `FORBIDDEN` → denied page or inline alert if claim lost mid-session.
- `RECORD_LOCKED` on save attempts; `CCCD_*` / `PHONE_*` on forms; `NOT_FOUND` on missing detail.
- Clipboard copy failures surfaced locally without failing the create.

## Testing

| Layer | Coverage |
| --- | --- |
| Vitest (domain) | Unlock; admin create/update with null `inviteId`; CCCD/phone rules still hold |
| Vitest (UI) | Claim gate (login / denied / shell); sidebar links; one list + one detail with mocked server fns |
| Cypress | One thin journey: reach `/admin` as admin (or stub) → sidebar visible → Invites page |

Prefer Vitest for component behavior; do not add a Cypress spec per screen.

## Success criteria

- Claimed admin can create invites, copy filler links, list/filter temples and members, create/edit lean drafts, lock and unlock, and view org units.
- Non-admin signed-in users see an explicit denied state, not the ops sidebar.
- Unsigned users hitting `/admin` are sent to login with a return path.
- PII list/detail/mutations never go through the client Firestore SDK.
- Lean forms only; full field editors clearly left for a follow-up.

## Future extensions (non-blocking)

- Full paper-form editors on the same detail routes.
- Filler UI at `/f/$token`.
- Invite revoke/expiry; org-unit seed in UI; photo upload in admin.
- Session cookies + SSR-accurate admin protection.
- Optional client read rules for admins if product needs offline-friendly caching.
- Per–org-unit admin scopes.

## Related docs

- Database: `docs/superpowers/specs/2026-07-19-he-phai-khatsi-database-design.md`
- Database plan: `docs/superpowers/plans/2026-07-19-he-phai-database.md` (UI was deferred there)
- Auth: `docs/superpowers/specs/2026-07-19-firebase-auth-login-design.md`
