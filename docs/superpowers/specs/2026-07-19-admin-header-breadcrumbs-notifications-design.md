# Admin header: breadcrumbs + notifications (UI)

Date: 2026-07-19  
Status: approved for planning  
Scope: `tanstack-app` admin shell only

## Goal

Add a top header to the admin area with:

1. A full breadcrumb trail for the current page (clickable parents)
2. A notifications control on the far right that opens an empty-state panel

UI only — no notification fetch, unread badge, or mark-as-read logic.

## Decisions

| Topic | Choice |
|-------|--------|
| Placement | `AppShell.Header` inside existing `AdminShell` |
| Breadcrumb source | Pathname → label map (not per-route `staticData`) |
| Trail style | Full trail, e.g. `Quản trị › Tịnh xá › Chi tiết tịnh xá` |
| Temple wording | Use **Tịnh xá** (not “Chùa”) in nav, breadcrumbs, and related temple titles |
| Notifications UI | Bell `ActionIcon` + popover/menu with empty state |
| Page titles | Keep page `Title` components; update temple copy via Paraglide strings |

## Layout

```
┌─────────────┬──────────────────────────────────────────────┐
│  Navbar     │  Header: [Breadcrumbs ……] [🔔]               │
│  (existing) ├──────────────────────────────────────────────┤
│             │  Main: page content (unchanged)              │
└─────────────┴──────────────────────────────────────────────┘
```

- Header: light surface, subtle bottom border; content padded to align with main.
- Left: Mantine `Breadcrumbs`.
- Right: notification bell, right-aligned.
- No unread badge in this pass.

## Breadcrumbs

### Behavior

- Root crumb **Quản trị** (`m.admin_title`) links to `/admin` (which already redirects to `/admin/invites`).
- Intermediate crumbs are `Link`s; the last crumb is plain text (current page).
- Labels reuse existing Paraglide keys where possible; add keys only for missing crumbs / notifications copy.
- Dynamic IDs (`$id`) use the form detail titles (e.g. “Chi tiết tịnh xá”), not the entity name.
- Unknown path segments fall back to the raw segment string.
- Rename temple copy in `messages/vi.json`: `admin_nav_temples`, `admin_invites_form_type_temple`, `admin_temples_form_title_create`, `admin_temples_form_title_edit` — replace “Chùa”/“chùa” with “Tịnh xá”/“tịnh xá”.

### Mapping

| Path | Trail |
|------|--------|
| `/admin/invites` | Quản trị › Lời mời |
| `/admin/temples` | Quản trị › Tịnh xá |
| `/admin/temples/new` | Quản trị › Tịnh xá › Thêm tịnh xá |
| `/admin/temples/$id` | Quản trị › Tịnh xá › Chi tiết tịnh xá |
| `/admin/members/tang` | Quản trị › Tăng ni |
| `/admin/members/ni` | Quản trị › Ni |
| `/admin/members/new` | Quản trị › Thêm thành viên |
| `/admin/members/$id` | Quản trị › Chi tiết thành viên |
| `/admin/org-units` | Quản trị › Giáo đoàn |

Note: member create/detail trails are two levels after root (no parent list in the path). That matches the actual URLs (`/admin/members/new`, `/admin/members/$id`).

### Implementation sketch

- `buildAdminBreadcrumbs(pathname): { title: string; href?: string }[]`
- Segment/label map keyed by known admin path prefixes
- Render with Mantine `Breadcrumbs` + TanStack `Link` for items that have `href`

## Notifications (UI-only)

- Bell icon (`lucide-react` `Bell`) in an `ActionIcon` with accessible label.
- Click opens a Mantine `Popover` or `Menu` anchored to the icon.
- Panel contents:
  - Short heading (e.g. “Thông báo”)
  - Empty-state body (e.g. “Chưa có thông báo”)
- No list items, timestamps, filters, or API calls.
- Extract as a small `AdminNotificationsButton` component for clarity.

## Components & files

| Piece | Location |
|-------|----------|
| Header wiring | `AdminShell.tsx` |
| Breadcrumb builder | colocated helper (same file or `adminBreadcrumbs.ts`) |
| Notifications button | `AdminNotificationsButton.tsx` (or colocated) |
| Copy | `messages/vi.json` (+ Paraglide compile as usual) |
| Tests | extend `AdminShell.test.tsx` |

## Testing

Vitest only (no new Cypress for this UI polish):

- Header renders breadcrumbs for a known admin path (e.g. invites).
- Notification control is present; opening it shows the empty-state message.

## Out of scope

- Real notification data / Firestore / Query keys
- Unread count badge
- Entity-specific crumb titles (temple name, Pháp danh, etc.)
- Removing or changing page-level `Title` components
- Mobile navbar hamburger (existing AppShell breakpoint behavior unchanged unless header forces a minimal tweak)

## Success criteria

- Every admin page under `AdminShell` shows the header with a sensible breadcrumb trail.
- Bell opens an empty notifications panel.
- Existing page content and nav behavior remain intact.
- Admin shell unit tests cover breadcrumb + empty notifications UI.
