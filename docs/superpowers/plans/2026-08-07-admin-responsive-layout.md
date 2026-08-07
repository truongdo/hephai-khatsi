# Admin Responsive Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all admin screens usable on narrow viewports: mobile nav toggle, horizontally scrollable tables, wrapping headers/filters, and responsive form detail chrome.

**Architecture:** Fix shared primitives first (`AdminShell` burger + collapsed navbar; `AdminDataTable` + `Table.ScrollContainer`), then apply the same wrap/padding pattern on list and form pages. Keep table columns unchanged (horizontal scroll only).

**Tech Stack:** React, Mantine 9 (`AppShell`, `Burger`, `Table.ScrollContainer`), `@mantine/hooks` `useDisclosure`, Vitest + Testing Library, Paraglide i18n

**Spec:** `docs/superpowers/specs/2026-08-07-admin-responsive-layout-design.md`

## Global Constraints

- Work in the current workspace only — **never** `git worktree add`
- Create and use a feature branch from `main` (e.g. `feat/admin-responsive-layout`); if already on another branch with WIP, stop and ask
- Tables: keep columns; horizontal scroll only — no card layouts, no column hiding
- Prefer Vitest; **no new Cypress**
- After merge squash into `main`, delete the local feature branch unless asked otherwise

## File Structure

| File | Responsibility |
| --- | --- |
| `docs/superpowers/specs/2026-08-07-admin-responsive-layout-design.md` | Spec (already on `main`) |
| `docs/superpowers/plans/2026-08-07-admin-responsive-layout.md` | This plan |
| `tanstack-app/messages/vi.json` | Burger aria label |
| `tanstack-app/src/components/admin/AdminShell.tsx` | Burger + `navbar.collapsed.mobile` |
| `tanstack-app/src/components/admin/AdminShell.test.tsx` | Mobile nav tests |
| `tanstack-app/src/components/admin/AdminDataTable.tsx` | `Table.ScrollContainer` |
| `tanstack-app/src/components/admin/AdminDataTable.test.tsx` | Scroll wrapper assertion |
| `tanstack-app/src/components/admin/TemplesListPage.tsx` | Header/filter wrap |
| `tanstack-app/src/components/admin/MembersListPage.tsx` | Header/filter wrap |
| `tanstack-app/src/components/admin/RetreatsListPage.tsx` | Header/filter wrap |
| `tanstack-app/src/components/admin/OrgUnitsPage.tsx` | Header wrap + scroll on raw tables |
| `tanstack-app/src/components/admin/RetreatRegistrationsPage.tsx` | Header/filter wrap if needed |
| `tanstack-app/src/components/admin/TempleFormPage.tsx` | Header wrap + Paper padding |
| `tanstack-app/src/components/admin/MemberFormPage.tsx` | Header wrap + Paper padding |
| `tanstack-app/src/components/admin/RetreatFormPage.tsx` | Header wrap + Paper padding |
| `tanstack-app/src/components/admin/OrgUnitSecretariesModal.tsx` | ScrollContainer + footer wrap |
| `tanstack-app/src/components/admin/AdminConfirmDeleteModal.tsx` | Footer wrap |

---

### Task 0: Branch from main + commit plan

**Files:**
- Add: `docs/superpowers/plans/2026-08-07-admin-responsive-layout.md`

- [ ] **Step 1: Create feature branch from main**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git checkout main
git pull
git checkout -b feat/admin-responsive-layout
```

- [ ] **Step 2: Ensure this plan file is present, then commit**

```bash
git add docs/superpowers/plans/2026-08-07-admin-responsive-layout.md
git commit -m "$(cat <<'EOF'
docs: plan admin responsive layout for shell, lists, and forms

EOF
)"
```

---

### Task 1: AdminShell mobile navbar (burger)

**Files:**
- Modify: `tanstack-app/messages/vi.json` (add `admin_nav_menu_aria`)
- Modify: `tanstack-app/src/components/admin/AdminShell.tsx`
- Modify: `tanstack-app/src/components/admin/AdminShell.test.tsx`

**Interfaces:**
- Consumes: Mantine `AppShell` `navbar.collapsed.mobile`, `Burger`, `useDisclosure`
- Produces: Mobile-openable navbar; closes on nav link click

- [ ] **Step 1: Add i18n key**

In `tanstack-app/messages/vi.json` add:

```json
"admin_nav_menu_aria": "Mở menu điều hướng"
```

(Place near other `admin_*` aria keys such as `admin_notifications_aria`.)

Run Paraglide compile if the project does not auto-compile on next `pnpm` script (follow existing i18n workflow in `tanstack-app` — typically `pnpm` test/dev regenerates, or run the same compile script other commits used).

- [ ] **Step 2: Write failing AdminShell tests**

Append to `AdminShell.test.tsx` (existing `matchMedia` mock returns `matches: false`, so viewport is treated as below `sm` — burger is visible):

```tsx
it('shows burger that toggles mobile navbar', async () => {
  const user = userEvent.setup()
  renderShell()
  const burger = await screen.findByRole('button', {
    name: m.admin_nav_menu_aria(),
  })
  expect(burger).toBeTruthy()
  // closed initially: burger not pressed
  expect(burger.getAttribute('aria-expanded')).toBe('false')
  await user.click(burger)
  expect(burger.getAttribute('aria-expanded')).toBe('true')
  const nav = screen.getByRole('navigation')
  expect(nav).toBeTruthy()
})

it('closes mobile navbar when a nav link is clicked', async () => {
  const user = userEvent.setup()
  renderShell()
  const burger = await screen.findByRole('button', {
    name: m.admin_nav_menu_aria(),
  })
  await user.click(burger)
  expect(burger.getAttribute('aria-expanded')).toBe('true')
  const nav = screen.getByRole('navigation')
  await user.click(within(nav).getByText(m.admin_nav_temples()))
  expect(burger.getAttribute('aria-expanded')).toBe('false')
})
```

If Mantine `Burger` does not set `aria-expanded`, assert via `opened` class / `data-expanded` instead — prefer whatever the rendered DOM exposes; keep the aria-label assertion either way.

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd tanstack-app && pnpm exec vitest run src/components/admin/AdminShell.test.tsx
```

Expected: FAIL — missing `admin_nav_menu_aria` and/or no burger button.

- [ ] **Step 4: Implement AdminShell**

Update `AdminShell.tsx`:

```tsx
import { Burger, /* existing imports */ } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'

export function AdminShell({ children }: { children: ReactNode }) {
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] =
    useDisclosure()
  // ... existing hooks ...

  return (
    <AppShell
      navbar={{
        width: 260,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened },
      }}
      header={{ height: 56 }}
      layout="alt"
      padding="md"
    >
      {/* Navbar unchanged except NavLink onClick={closeMobile} */}
      <AppShell.Header
        px="md"
        style={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid var(--mantine-color-gray-2)',
        }}
      >
        <Group justify="space-between" w="100%" wrap="wrap" gap="sm">
          <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <Burger
              opened={mobileOpened}
              onClick={toggleMobile}
              hiddenFrom="sm"
              size="sm"
              aria-label={m.admin_nav_menu_aria()}
            />
            <Breadcrumbs
              separator="›"
              style={{ minWidth: 0, overflow: 'hidden' }}
            >
              {/* existing crumb rendering */}
            </Breadcrumbs>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <AdminCopyFormLinkButton />
            <AdminNotificationsButton />
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  )
}
```

On each nav `NavLink`, add `onClick={closeMobile}`.

Do **not** collapse the desktop navbar.

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd tanstack-app && pnpm exec vitest run src/components/admin/AdminShell.test.tsx
```

Expected: PASS (including prior nav/breadcrumb tests).

- [ ] **Step 6: Commit**

```bash
git add tanstack-app/messages/vi.json tanstack-app/src/components/admin/AdminShell.tsx tanstack-app/src/components/admin/AdminShell.test.tsx
# include any paraglide generated files if present in git
git commit -m "$(cat <<'EOF'
feat: add mobile burger nav to admin shell

EOF
)"
```

---

### Task 2: AdminDataTable horizontal scroll

**Files:**
- Modify: `tanstack-app/src/components/admin/AdminDataTable.tsx`
- Modify: `tanstack-app/src/components/admin/AdminDataTable.test.tsx`

**Interfaces:**
- Consumes: Mantine `Table.ScrollContainer` with `minWidth={800}`
- Produces: All `AdminDataTable` consumers scroll horizontally on overflow

- [ ] **Step 1: Write failing test**

Add to `AdminDataTable.test.tsx`:

```tsx
it('wraps the table in a scroll container when showing rows', () => {
  renderTable(
    <AdminDataTable aria-label="demo">{sampleChildren}</AdminDataTable>,
  )
  const table = screen.getByRole('table', { name: 'demo' })
  const scroll = table.closest('[class*="ScrollContainer"], [class*="scrollContainer"]')
  expect(scroll).toBeTruthy()
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd tanstack-app && pnpm exec vitest run src/components/admin/AdminDataTable.test.tsx
```

Expected: FAIL — no scroll container ancestor.

- [ ] **Step 3: Implement scroll wrapper**

Update `AdminDataTable.tsx` non-empty branch:

```tsx
) : (
  <Table.ScrollContainer minWidth={800}>
    <Table aria-label={ariaLabel}>{children}</Table>
  </Table.ScrollContainer>
)
```

Leave loading / empty branches unchanged.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd tanstack-app && pnpm exec vitest run src/components/admin/AdminDataTable.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/admin/AdminDataTable.tsx tanstack-app/src/components/admin/AdminDataTable.test.tsx
git commit -m "$(cat <<'EOF'
feat: scroll admin data tables horizontally on narrow screens

EOF
)"
```

---

### Task 3: List page headers and filters

**Files:**
- Modify: `tanstack-app/src/components/admin/TemplesListPage.tsx`
- Modify: `tanstack-app/src/components/admin/MembersListPage.tsx`
- Modify: `tanstack-app/src/components/admin/RetreatsListPage.tsx`
- Modify: `tanstack-app/src/components/admin/OrgUnitsPage.tsx`
- Modify: `tanstack-app/src/components/admin/RetreatRegistrationsPage.tsx` (only if title/actions still overflow)

**Interfaces:**
- Consumes: Task 2 `AdminDataTable` scroll (no API change)
- Produces: Wrapping title/actions and full-width filters under `sm`

- [ ] **Step 1: Apply the same chrome pattern on each list**

For each list page title row, change:

```tsx
<Group justify="space-between" align="center">
```

to:

```tsx
<Group justify="space-between" align="center" wrap="wrap" gap="sm">
```

For filter rows (`Select`s), change:

```tsx
<Group>
  <Select ... />
</Group>
```

to:

```tsx
<Group wrap="wrap" gap="sm" align="flex-end">
  <Select
    ...
    w={{ base: '100%', sm: 220 }}
  />
</Group>
```

Use `sm: 220` (or `sm: 'auto'` with a sensible `miw`) consistently across temples / members / retreats filters. Bulk-selection `Group`s also get `wrap="wrap"`.

On `MembersListPage`, ensure the nested Export + Create `Group` also has `wrap="wrap"`.

`RetreatRegistrationsPage` already uses `wrap="wrap"` on the main header — only adjust if a filter or action row still lacks wrap.

- [ ] **Step 2: Run existing list page tests**

```bash
cd tanstack-app && pnpm exec vitest run \
  src/components/admin/TemplesListPage.test.tsx \
  src/components/admin/MembersListPage.test.tsx \
  src/components/admin/RetreatsListPage.test.tsx \
  src/components/admin/OrgUnitsPage.test.tsx \
  src/components/admin/RetreatRegistrationsPage.test.tsx
```

Expected: PASS (markup-only wrap props). Fix any brittle selectors if they break.

- [ ] **Step 3: Commit**

```bash
git add tanstack-app/src/components/admin/TemplesListPage.tsx \
  tanstack-app/src/components/admin/MembersListPage.tsx \
  tanstack-app/src/components/admin/RetreatsListPage.tsx \
  tanstack-app/src/components/admin/OrgUnitsPage.tsx \
  tanstack-app/src/components/admin/RetreatRegistrationsPage.tsx
git commit -m "$(cat <<'EOF'
fix: wrap admin list headers and filters on narrow screens

EOF
)"
```

---

### Task 4: Detail forms, modals, and raw tables

**Files:**
- Modify: `tanstack-app/src/components/admin/TempleFormPage.tsx`
- Modify: `tanstack-app/src/components/admin/MemberFormPage.tsx`
- Modify: `tanstack-app/src/components/admin/RetreatFormPage.tsx`
- Modify: `tanstack-app/src/components/admin/OrgUnitSecretariesModal.tsx`
- Modify: `tanstack-app/src/components/admin/AdminConfirmDeleteModal.tsx`
- Modify: `tanstack-app/src/components/admin/OrgUnitsPage.tsx` (he-phai secretaries raw `Table`)

**Interfaces:**
- Consumes: unchanged form field components / `FormStickyActions`
- Produces: Wrapping form headers, responsive Paper padding, scrollable modal/raw tables, wrapping modal footers

- [ ] **Step 1: Form page headers + Paper padding**

On `TempleFormPage`, `MemberFormPage`, `RetreatFormPage`:

1. Outer title `Group`: add `wrap="wrap" gap="sm"`.
2. Nested action `Group`s (member grant/revoke/back; retreat registrations/back): add `wrap="wrap" gap="sm"`.
3. Form `Paper`:

```tsx
<Paper p={{ base: 'md', sm: 'xl' }} radius="md" maw={760} w="100%">
```

Do not change `FormStickyActions` implementation in this task (already uses `--app-shell-navbar-offset` and wraps buttons). Spot-check manually after Task 1 that the sticky bar is full-bleed when the navbar is collapsed.

- [ ] **Step 2: Modal footers + raw tables**

`AdminConfirmDeleteModal` and revoke confirm `Group`s:

```tsx
<Group justify="flex-end" mt="md" wrap="wrap" gap="sm">
```

`OrgUnitSecretariesModal` table branch:

```tsx
<Table.ScrollContainer minWidth={800}>
  <Table>...</Table>
</Table.ScrollContainer>
```

Same for the he-phai secretaries `Table` on `OrgUnitsPage` (not using `AdminDataTable`).

- [ ] **Step 3: Run related tests**

```bash
cd tanstack-app && pnpm exec vitest run \
  src/components/admin/TempleFormPage.test.tsx \
  src/components/admin/MemberFormPage.test.tsx \
  src/components/admin/RetreatFormPage.test.tsx \
  src/components/admin/OrgUnitSecretariesModal.test.tsx \
  src/components/admin/OrgUnitsPage.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tanstack-app/src/components/admin/TempleFormPage.tsx \
  tanstack-app/src/components/admin/MemberFormPage.tsx \
  tanstack-app/src/components/admin/RetreatFormPage.tsx \
  tanstack-app/src/components/admin/OrgUnitSecretariesModal.tsx \
  tanstack-app/src/components/admin/AdminConfirmDeleteModal.tsx \
  tanstack-app/src/components/admin/OrgUnitsPage.tsx
git commit -m "$(cat <<'EOF'
fix: make admin detail forms and modal tables responsive

EOF
)"
```

---

### Task 5: Final verification

- [ ] **Step 1: Run focused admin component suite**

```bash
cd tanstack-app && pnpm exec vitest run src/components/admin/
```

Expected: PASS.

- [ ] **Step 2: Manual smoke (narrow viewport)**

With `pnpm dev` running, in browser DevTools (~375px width):

1. `/admin/temples` — burger opens/closes nav; table scrolls horizontally; filters stack.
2. `/admin/members/tang` — same; Export/Create wrap.
3. `/admin/retreats` — same.
4. Open one temple or member edit form — header actions wrap; paper padding tighter; sticky footer full width.

- [ ] **Step 3: No extra commit unless Step 1/2 required fixes** — if fixes needed, commit them with a clear message before handoff.
