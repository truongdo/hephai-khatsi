# Admin responsive layout

**Date:** 2026-08-07  
**Scope:** All admin screens under `AdminShell` — list pages, detail/create/edit forms, org-units, retreat registrations, and related modals  
**Primary components:** `AdminShell`, `AdminDataTable`, list pages, form pages, `FormStickyActions`

## Goal

Make the admin UI usable on narrow viewports (phones/tablets) without redesigning data density: mobile nav must open, tables must not blow past the viewport, and page headers / filters / form action bars must wrap cleanly.

## Non-goals

- Card/stack alternate layouts for tables on mobile
- Hiding or reordering table columns by breakpoint
- Redesigning form field sections or sticky-bar semantics
- Public filler flows, landing pages, or non-admin routes
- Cypress coverage for every breakpoint (Vitest for shell/table behavior; manual smoke for layout)

## Approach

Shared primitives first (Approach 1): fix shell + table once, then light wrap/padding polish on each admin page that shares the patterns.

Tables: keep the same columns; add horizontal scroll (option A).

## Shell & chrome

**File:** `tanstack-app/src/components/admin/AdminShell.tsx`

1. Keep `navbar={{ width: 260, breakpoint: 'sm' }}`.
2. Add `Burger` + `useDisclosure` wired to `navbar.collapsed` / `toggle` for viewports below `sm`.
3. Place the burger in `AppShell.Header` (left of breadcrumbs).
4. Close the mobile navbar when a nav `NavLink` is clicked.
5. Header layout: breadcrumbs may truncate (`minWidth: 0`, overflow hidden / ellipsis as needed); copy-link and notifications stay reachable; allow wrap if the row is too tight.
6. Verify `FormStickyActions` still spans correctly when the navbar is collapsed (it already uses `--app-shell-navbar-offset`).

## List pages & tables

**Shared table:** `tanstack-app/src/components/admin/AdminDataTable.tsx`

- Wrap the rendered `Table` in Mantine `Table.ScrollContainer` with `minWidth={800}` so every consumer gets horizontal scroll on overflow.
- Loading and empty states stay as today (no scroll wrapper required beyond current `Paper`).

**Consumers (inherit scroll automatically):**

- `TemplesListPage`, `MembersListPage` (tang/ni), `RetreatsListPage`, `OrgUnitsPage`, `RetreatRegistrationsPage`

**Per-list page chrome (same pattern on each):**

- Title + primary actions: `Group` with `wrap="wrap"`.
- Filter `Select`s: wrap and grow toward full width under `sm` (e.g. `w={{ base: '100%', sm: 'auto' }}` or equivalent).
- Bulk selection / unlock / load-more / export behavior unchanged.

**Modals with tables** (e.g. org-unit secretaries): if they use a raw `Table` outside `AdminDataTable`, apply the same scroll-container pattern or route them through `AdminDataTable` when practical.

## Detail / form screens

**Files:** `TempleFormPage`, `MemberFormPage`, `RetreatFormPage` (create + edit)

1. Page header `Group`s use `wrap="wrap"` so title, badges, grant/revoke, registrations link, and back buttons stack instead of overflowing (member edit is the densest case).
2. Form `Paper`: keep `maw={760} w="100%"`; use responsive padding (`p={{ base: 'md', sm: 'xl' }}` or equivalent).
3. Leave `FormStickyActions` children wrapping as today; confirm full-bleed footer when navbar is collapsed on mobile.
4. Modal footers (`Group justify="flex-end"`): allow wrap so confirm/cancel stay visible.

## Testing

- **Vitest:** `AdminShell` — burger toggles mobile nav; nav link closes overlay (matchMedia / viewport as needed in test setup). `AdminDataTable` — scroll container present when not empty/loading.
- **Vitest:** update existing list/form tests only if queries break from markup changes; no new Cypress specs (layout polish, not a new journey).
- **Manual:** temples / members / retreats lists + one detail form on a narrow viewport.

## Out of scope follow-ups

- Optional column priority / hide-on-mobile (option C) if horizontal scroll proves insufficient for members.
- Extract a shared `AdminPageHeader` / `AdminFilterBar` only if duplication becomes painful during implementation.
