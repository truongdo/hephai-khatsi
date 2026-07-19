# Admin data table (shared UI)

Date: 2026-07-19  
Status: approved for planning  
Scope: `tanstack-app` admin list pages

## Goal

Ship one calm, brand-aligned table look and use it on every admin list that already renders a Mantine `Table`.

## Design read

Redesign of admin list tables for temple staff, preserving parchment / ink / saffron / jade tokens, leaning toward a shared Mantine `Table` wrapper (not a marketing landing, not TanStack Table).

**Dials:** variance 4 / motion 3 / density 5 (redesign-preserve, calm admin).

## Decisions

| Topic | Choice |
|-------|--------|
| Approach | Shared `AdminDataTable` + expanded `theme.ts` `Table` styles |
| Visual | Calm editorial: paper panel, jade-pale header wash, hairline rows, soft saffron-pale hover |
| Not chosen | Dense zebra/sticky admin (B); heavy panel-only without shared chrome consistency (C alone) |
| Columns | Stay page-owned (`Table.Thead` / `Table.Tbody` children) |
| Empty cells | Display `-` (hyphen), never em-dash |
| Invites page | Out of scope — not a list table |
| Sorting / selection / sticky header | Out of scope for v1 |

## Visual language

- **Panel:** `var(--paper)` surface, 1px `var(--line)` border, theme `md` radius (same as `Paper`).
- **Header:** `--jade-pale` wash, weight 600, slightly smaller label text, ink-soft color, hairline bottom border only. No zebra stripes.
- **Rows:** paper background; hairline `var(--line)` between rows; hover = light `--saffron-pale` tint.
- **Primary cell** (name / danh hiệu): existing teal semibold link — only strong accent.
- **Secondary cells** (dates, codes, phones): ink-soft; empty → `-`.
- **Motion:** hover / active only; no entry animations.

## Component API

### `AdminDataTable`

Location: `tanstack-app/src/components/admin/AdminDataTable.tsx`

```tsx
type AdminDataTableProps = {
  children: React.ReactNode // Table.Thead + Table.Tbody
  empty?: boolean
  emptyMessage?: string
  loading?: boolean
  'aria-label'?: string
}
```

Behavior:

- Wraps Mantine `Paper` (bordered) + `Table` with `highlightOnHover`, `horizontalSpacing="md"`, `verticalSpacing="sm"`.
- `loading`: show skeleton rows inside the panel (about 4 rows); do not rely on a page-level spinner for the table region.
- `empty` (and not loading): centered empty message inside the panel; do not render column body.
- Errors stay outside the wrapper (existing page-level red alert).

### Theme

Expand `theme.components.Table` in `theme.ts` so thead wash, borders, and hover tint apply even if a raw `Table` is used later. Prefer CSS variables already in `styles.css` (`--paper`, `--line`, `--jade-pale`, `--saffron-pale`, `--ink-soft`).

### Helper

`emptyCell(value: string | null | undefined): string` — returns trimmed value or `-`.

## Page migration

| Page | Change |
|------|--------|
| `MembersListPage` | Replace raw `Table` with `AdminDataTable`; `loading` / `empty` from query + `allItems` |
| `TemplesListPage` | Same |
| `OrgUnitsPage` | Same |
| `InvitesPage` | No change |

Filters, “load more”, `RecordStatusBadge`, and detail links remain on the page.

## i18n

Add a Paraglide key for the default empty state (Vietnamese), e.g. `admin_table_empty` → “Chưa có dữ liệu”. Pages may pass a more specific `emptyMessage` later; v1 can use the shared default everywhere.

## Testing

- Vitest: `AdminDataTable` renders children; shows empty message when `empty`; shows skeleton when `loading`.
- Update list-page tests only if assertions break (prefer roles / accessible names).
- No new Cypress spec (not a critical journey change).

## Out of scope

- TanStack Table, column resize, sorting, row selection, sticky header.
- Invite history as a table.
- Dark mode (brand is fixed parchment).
- Changing filter UI or pagination model.

## Success criteria

1. Members, Temples, and Org Units lists share the same panel + header + hover look.
2. Empty and loading states for those lists are consistent and live inside the table panel.
3. Empty values render as `-`, not `—`.
4. No new visual language outside existing brand tokens.
