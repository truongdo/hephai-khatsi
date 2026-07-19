# Admin: copy form link in header (remove Lời mời)

Date: 2026-07-19  
Status: approved for planning  
Scope: `tanstack-app` — **this slice is admin invite UX only**

## Goal

Replace the dedicated **Lời mời** admin page with a single header action that ensures the global public invite exists and copies its share URL. Product direction: **one** invite link for all fillers; form type and giáo đoàn are chosen on the public form (later slices).

## Product decisions (locked)

| Topic | Choice |
|-------|--------|
| Invite count | One fixed invite (`id`/`token` = `public`) |
| Link shape | `{origin}/f/public` |
| Form type | Visitor picks Tăng / Ni / Tịnh xá on the public form first page (not encoded in the invite) |
| Giáo đoàn | Visitor picks on the form (not encoded in the invite) |
| Admin entry | Header **Copy link form** next to notifications; no sidebar **Lời mời** |
| Missing invite | Header action creates the invite, then copies the URL |
| Create semantics | Idempotent: if invite already exists, return it; do not overwrite `createdBy` / `createdAt` |

## Roadmap (out of scope for this slice)

Full paper-form filler UI is intentional product work, but too large for one plan. Build order:

1. **This slice** — admin copy-link + remove invites nav/page  
2. **Filler shell + entry** — `/f/$token`, validate invite, type chooser, giáo đoàn picker, shared layout  
3. **Filler server wiring** — `createServerFn` for draft save / resume / photo (domain use-cases already exist)  
4. **Full temple form** — every temple field from DB design + phone resume + draft/locked  
5. **Full member forms** — every member field for Tăng and Ni (precept diffs) + CCCD resume + photo  

Each later slice gets its own design amendment or dedicated spec before planning.

## Non-goals (this slice)

- Building `/f/$token` UI or any filler form fields  
- Revoke / rotate / expire invites  
- Per–giáo đoàn or per–form-type invite tokens  
- Changing admin lean temple/member editors  

## Current state

- Single invite model already in code: `PUBLIC_INVITE_ID = 'public'`; `Invite` has no `orgUnitId` / `formType`.  
- Admin **Lời mời** page lists/creates that invite and copies the URL.  
- `/admin` redirects to `/admin/invites`.  
- Header already has breadcrumbs + `AdminNotificationsButton`.

## Design

### Layout

```
Header: [Breadcrumbs ……………………] [Copy link form] [🔔]
```

- Place a compact Mantine `Button` (size `sm`) immediately left of the notifications control in `AdminShell` header `Group`.  
- Label via Paraglide: **Sao chép link form** (aria-label same). Optional `Link2` icon.  
- Loading state while ensure+copy runs; disable the button while pending.

### Ensure + copy flow

1. Require claimed admin (button only meaningful inside admin shell; reuse `useAdminClaim` / uid).  
2. `getByToken('public')` (or shared ensure use-case).  
3. If missing → `createInvite({ createdBy: uid })` writing fixed `public` doc.  
4. Build URL: `${window.location.origin}/f/${token}`.  
5. `navigator.clipboard.writeText(url)`.  
6. Feedback: temporary success text or Mantine notification (“Đã sao chép”); on clipboard failure, show warning using adapted `admin_invites_copy_failed` copy.

Add `ensurePublicInvite(createdBy)` that returns the existing invite or creates it. Make `createInvite` idempotent the same way (or have ensure own the get-or-create path exclusively).

### Navigation & routes

- Remove **Lời mời** from `AdminShell` `navItems`.  
- Delete `InvitesPage`, `/admin/invites` route, and invite breadcrumb branch.  
- Change `/admin` redirect from `/admin/invites` → `/admin/temples`.  
- Update root breadcrumb target behavior: **Quản trị** still links to `/admin` (now temples).  
- Update Cypress admin smoke and Vitest shell/breadcrumb tests that assume invites as default/home.  
- Login redirect defaults that point at `/admin/invites` should use `/admin/temples` (or `/admin`).

### i18n

- Add header copy-link label / aria / success strings as needed.  
- Remove or leave unused `admin_nav_invites` / invites-page strings only if nothing references them after deletion (prefer delete dead keys with the page).

### Docs touch-up (same slice if cheap)

- Note in admin UI design / DB design that phase-1 public gate is **one global invite**; `orgUnitId` / `formType` are visitor-chosen on the filler form (not invite fields). Full filler field parity remains later slices — do not rewrite the entire DB spec here beyond correcting invite scoping contradictions that this product decision supersedes.

## Testing

| Layer | Cases |
|-------|--------|
| Vitest use-case | Ensure creates when missing; second ensure returns same invite without changing `createdBy`/`createdAt` |
| Vitest `AdminShell` | No Lời mời nav item; copy control present next to notifications; click ensures + copies (mock clipboard / ensure) |
| Vitest breadcrumbs | `/admin/temples` trail; no invites trail required |
| Cypress | Smoke visits `/admin` (or temples); assert copy control visible; do not require invites page |

## Success criteria

- Claimed admin can copy `/f/public` from the header without opening a dedicated invites page.  
- First click creates the invite if needed; later clicks only copy.  
- Sidebar has no Lời mời; `/admin/invites` is gone; `/admin` lands on temples.  
- Public form and full paper fields are **not** required for this slice to be done.
