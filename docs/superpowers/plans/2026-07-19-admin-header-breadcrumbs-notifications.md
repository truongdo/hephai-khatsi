# Admin Header (Breadcrumbs + Notifications) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin `AppShell.Header` with pathname-based breadcrumbs and a UI-only notifications popover (empty state).

**Architecture:** Extend `AdminShell` with a light header. Derive crumbs from a pure `buildAdminBreadcrumbs(pathname)` helper. Render a small `AdminNotificationsButton` (bell + Mantine `Popover` empty state). Rename temple copy to “Tịnh xá” via Paraglide strings.

**Tech Stack:** React 19, Mantine 9 (`AppShell`, `Breadcrumbs`, `Anchor`, `ActionIcon`, `Popover`), TanStack Router `Link`, Paraglide, Vitest + Testing Library, lucide-react `Bell`

**Spec:** `docs/superpowers/specs/2026-07-19-admin-header-breadcrumbs-notifications-design.md`

## Global Constraints

- Work in the current workspace only — **never** `git worktree add`
- Before coding: create branch `feat/admin-header-breadcrumbs` from `main` (Task 0)
- UI only for notifications — no Firestore, Query keys, badge, or mark-as-read
- Temple wording: **Tịnh xá** / **tịnh xá**, never “Chùa” / “chùa” in user-facing temple strings listed in the spec
- Vitest only — do **not** add Cypress for this polish
- Keep existing page-level `Title` components; they pick up new Paraglide values automatically
- Reuse Paraglide keys where they already exist; add keys only for notifications copy

## File Structure

| File | Responsibility |
| --- | --- |
| `tanstack-app/messages/vi.json` | Temple rename + notification strings |
| `tanstack-app/src/components/admin/adminBreadcrumbs.ts` | Pure pathname → crumb list |
| `tanstack-app/src/components/admin/adminBreadcrumbs.test.ts` | Unit tests for crumb builder |
| `tanstack-app/src/components/admin/AdminNotificationsButton.tsx` | Bell + empty popover |
| `tanstack-app/src/components/admin/AdminShell.tsx` | Header wiring |
| `tanstack-app/src/components/admin/AdminShell.test.tsx` | Shell integration tests |

---

### Task 0: Create feature branch

**Files:** none (git only)

**Interfaces:**
- Consumes: none
- Produces: branch `feat/admin-header-breadcrumbs`

- [ ] **Step 1: Confirm on `main` and create branch**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git checkout main
git pull
git checkout -b feat/admin-header-breadcrumbs
```

Expected: current branch is `feat/admin-header-breadcrumbs`.

If not on `main` / pull fails / dirty tree: stop and ask the user before continuing.

---

### Task 1: Update Paraglide copy (Tịnh xá + notifications)

**Files:**
- Modify: `tanstack-app/messages/vi.json`
- Regenerates: `tanstack-app/src/paraglide/**` via compile

**Interfaces:**
- Consumes: none
- Produces: updated `m.admin_nav_temples`, `m.admin_invites_form_type_temple`, `m.admin_temples_form_title_create`, `m.admin_temples_form_title_edit`; new `m.admin_notifications_aria`, `m.admin_notifications_title`, `m.admin_notifications_empty`

- [ ] **Step 1: Update existing temple strings and add notification keys**

In `tanstack-app/messages/vi.json`, set:

```json
"admin_nav_temples": "Tịnh xá",
"admin_invites_form_type_temple": "Tịnh xá",
"admin_temples_form_title_create": "Thêm tịnh xá",
"admin_temples_form_title_edit": "Chi tiết tịnh xá",
"admin_notifications_aria": "Thông báo",
"admin_notifications_title": "Thông báo",
"admin_notifications_empty": "Chưa có thông báo"
```

Place the three new keys near the other `admin_*` keys (after `admin_sign_out` is fine). Keep valid JSON (commas).

- [ ] **Step 2: Compile Paraglide**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm run paraglide
```

Expected: exit 0; `m.admin_notifications_empty` (and siblings) importable from `#/paraglide/messages`.

- [ ] **Step 3: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/messages/vi.json tanstack-app/src/paraglide
git commit -m "$(cat <<'EOF'
i18n: rename Chùa to Tịnh xá and add notification copy

EOF
)"
```

---

### Task 2: `buildAdminBreadcrumbs` (TDD)

**Files:**
- Create: `tanstack-app/src/components/admin/adminBreadcrumbs.ts`
- Create: `tanstack-app/src/components/admin/adminBreadcrumbs.test.ts`

**Interfaces:**
- Consumes: Paraglide `m.*` message functions from Task 1
- Produces:

```ts
export type AdminBreadcrumb = {
  title: string
  href?: string
}

export function buildAdminBreadcrumbs(pathname: string): AdminBreadcrumb[]
```

- [ ] **Step 1: Write the failing tests**

Create `tanstack-app/src/components/admin/adminBreadcrumbs.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { m } from '#/paraglide/messages'
import { buildAdminBreadcrumbs } from './adminBreadcrumbs'

describe('buildAdminBreadcrumbs', () => {
  it('builds invites trail', () => {
    expect(buildAdminBreadcrumbs('/admin/invites')).toEqual([
      { title: m.admin_title(), href: '/admin' },
      { title: m.admin_nav_invites() },
    ])
  })

  it('builds temples list trail', () => {
    expect(buildAdminBreadcrumbs('/admin/temples')).toEqual([
      { title: m.admin_title(), href: '/admin' },
      { title: m.admin_nav_temples() },
    ])
  })

  it('builds temple create trail', () => {
    expect(buildAdminBreadcrumbs('/admin/temples/new')).toEqual([
      { title: m.admin_title(), href: '/admin' },
      { title: m.admin_nav_temples(), href: '/admin/temples' },
      { title: m.admin_temples_form_title_create() },
    ])
  })

  it('builds temple detail trail', () => {
    expect(buildAdminBreadcrumbs('/admin/temples/abc123')).toEqual([
      { title: m.admin_title(), href: '/admin' },
      { title: m.admin_nav_temples(), href: '/admin/temples' },
      { title: m.admin_temples_form_title_edit() },
    ])
  })

  it('builds members tang trail', () => {
    expect(buildAdminBreadcrumbs('/admin/members/tang')).toEqual([
      { title: m.admin_title(), href: '/admin' },
      { title: m.admin_nav_tang() },
    ])
  })

  it('builds members ni trail', () => {
    expect(buildAdminBreadcrumbs('/admin/members/ni')).toEqual([
      { title: m.admin_title(), href: '/admin' },
      { title: m.admin_nav_ni() },
    ])
  })

  it('builds member create trail', () => {
    expect(buildAdminBreadcrumbs('/admin/members/new')).toEqual([
      { title: m.admin_title(), href: '/admin' },
      { title: m.admin_members_form_title_create() },
    ])
  })

  it('builds member detail trail', () => {
    expect(buildAdminBreadcrumbs('/admin/members/xyz')).toEqual([
      { title: m.admin_title(), href: '/admin' },
      { title: m.admin_members_form_title_edit() },
    ])
  })

  it('builds org-units trail', () => {
    expect(buildAdminBreadcrumbs('/admin/org-units')).toEqual([
      { title: m.admin_title(), href: '/admin' },
      { title: m.admin_nav_org_units() },
    ])
  })

  it('falls back for unknown segment', () => {
    expect(buildAdminBreadcrumbs('/admin/unknown-thing')).toEqual([
      { title: m.admin_title(), href: '/admin' },
      { title: 'unknown-thing' },
    ])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/components/admin/adminBreadcrumbs.test.ts
```

Expected: FAIL (module not found / `buildAdminBreadcrumbs` undefined).

- [ ] **Step 3: Implement `buildAdminBreadcrumbs`**

Create `tanstack-app/src/components/admin/adminBreadcrumbs.ts`:

```ts
import { m } from '#/paraglide/messages'

export type AdminBreadcrumb = {
  title: string
  href?: string
}

function rootCrumb(): AdminBreadcrumb {
  return { title: m.admin_title(), href: '/admin' }
}

export function buildAdminBreadcrumbs(pathname: string): AdminBreadcrumb[] {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  const parts = normalized.split('/').filter(Boolean)
  // parts[0] === 'admin'

  if (parts.length <= 1) {
    return [{ title: m.admin_title() }]
  }

  const section = parts[1]
  const rest = parts.slice(2)

  if (section === 'invites') {
    return [rootCrumb(), { title: m.admin_nav_invites() }]
  }

  if (section === 'org-units') {
    return [rootCrumb(), { title: m.admin_nav_org_units() }]
  }

  if (section === 'temples') {
    if (rest.length === 0) {
      return [rootCrumb(), { title: m.admin_nav_temples() }]
    }
    const leaf =
      rest[0] === 'new'
        ? m.admin_temples_form_title_create()
        : m.admin_temples_form_title_edit()
    return [
      rootCrumb(),
      { title: m.admin_nav_temples(), href: '/admin/temples' },
      { title: leaf },
    ]
  }

  if (section === 'members') {
    if (rest[0] === 'tang') {
      return [rootCrumb(), { title: m.admin_nav_tang() }]
    }
    if (rest[0] === 'ni') {
      return [rootCrumb(), { title: m.admin_nav_ni() }]
    }
    if (rest[0] === 'new') {
      return [rootCrumb(), { title: m.admin_members_form_title_create() }]
    }
    if (rest[0]) {
      return [rootCrumb(), { title: m.admin_members_form_title_edit() }]
    }
  }

  return [rootCrumb(), { title: section }]
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/components/admin/adminBreadcrumbs.test.ts
```

Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/src/components/admin/adminBreadcrumbs.ts tanstack-app/src/components/admin/adminBreadcrumbs.test.ts
git commit -m "$(cat <<'EOF'
feat: add admin breadcrumb builder from pathname

EOF
)"
```

---

### Task 3: `AdminNotificationsButton` (UI-only)

**Files:**
- Create: `tanstack-app/src/components/admin/AdminNotificationsButton.tsx`
- Modify: `tanstack-app/src/components/admin/AdminShell.test.tsx` (add notification assertions in Task 4; this task can use a small colocated test **or** defer UI assertion to Task 4)

**Interfaces:**
- Consumes: `m.admin_notifications_aria`, `m.admin_notifications_title`, `m.admin_notifications_empty`
- Produces: `export function AdminNotificationsButton(): JSX.Element`

Prefer asserting via `AdminShell.test.tsx` in Task 4 to avoid a thin one-off file. This task implements the component only.

- [ ] **Step 1: Create the component**

Create `tanstack-app/src/components/admin/AdminNotificationsButton.tsx`:

```tsx
import { ActionIcon, Popover, Stack, Text } from '@mantine/core'
import { Bell } from 'lucide-react'
import { m } from '#/paraglide/messages'

export function AdminNotificationsButton() {
  return (
    <Popover width={280} position="bottom-end" shadow="md" withArrow>
      <Popover.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="lg"
          aria-label={m.admin_notifications_aria()}
        >
          <Bell size={20} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <Text fw={600} size="sm">
            {m.admin_notifications_title()}
          </Text>
          <Text size="sm" c="dimmed">
            {m.admin_notifications_empty()}
          </Text>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/src/components/admin/AdminNotificationsButton.tsx
git commit -m "$(cat <<'EOF'
feat: add admin notifications button empty popover

EOF
)"
```

---

### Task 4: Wire `AppShell.Header` into `AdminShell`

**Files:**
- Modify: `tanstack-app/src/components/admin/AdminShell.tsx`
- Modify: `tanstack-app/src/components/admin/AdminShell.test.tsx`

**Interfaces:**
- Consumes: `buildAdminBreadcrumbs`, `AdminNotificationsButton`
- Produces: header visible on all admin pages using `AdminShell`

- [ ] **Step 1: Write failing shell tests for header**

Update `renderShell` to accept an optional path, and add tests in `AdminShell.test.tsx`:

```tsx
import userEvent from '@testing-library/user-event'

function renderShell(initialPath = '/admin/invites') {
  const rootRoute = createRootRoute({
    component: () => (
      <MantineProvider theme={theme} defaultColorScheme="light">
        <AdminShell>
          <div>child</div>
        </AdminShell>
      </MantineProvider>
    ),
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })
  return render(<RouterProvider router={router} />)
}

// keep existing nav test

it('renders breadcrumbs for the current path', async () => {
  renderShell('/admin/invites')
  expect(await screen.findByText(m.admin_title())).toBeTruthy()
  // last crumb
  const crumbs = screen.getAllByText(m.admin_nav_invites())
  expect(crumbs.length).toBeGreaterThanOrEqual(1)
})

it('opens empty notifications popover', async () => {
  const user = userEvent.setup()
  renderShell()
  await user.click(
    await screen.findByRole('button', { name: m.admin_notifications_aria() }),
  )
  expect(await screen.findByText(m.admin_notifications_empty())).toBeTruthy()
})
```

Also import `m.admin_notifications_aria` / `m.admin_notifications_empty` (already via `m`).

- [ ] **Step 2: Run shell tests to verify new ones fail**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/components/admin/AdminShell.test.tsx
```

Expected: FAIL on breadcrumbs / notifications button (not present yet). Existing nav test should still pass.

- [ ] **Step 3: Implement header in `AdminShell`**

Update `AdminShell.tsx`:

1. Import `Anchor`, `Breadcrumbs`, `Group` (Group already imported), `Text` (already), plus `buildAdminBreadcrumbs` and `AdminNotificationsButton`.
2. Change `AppShell` props to include header height:

```tsx
<AppShell
  navbar={{ width: 260, breakpoint: 'sm' }}
  header={{ height: 56 }}
  padding="md"
>
```

3. Insert header **before** `AppShell.Main`:

```tsx
<AppShell.Header
  px="md"
  style={{
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid var(--mantine-color-gray-2)',
  }}
>
  <Group justify="space-between" w="100%" wrap="nowrap">
    <Breadcrumbs separator="›">
      {buildAdminBreadcrumbs(pathname).map((crumb, index, all) => {
        const isLast = index === all.length - 1
        if (!isLast && crumb.href) {
          return (
            <Anchor
              key={`${crumb.href}-${crumb.title}`}
              component={Link}
              to={crumb.href}
              size="sm"
              c="dimmed"
              underline="hover"
            >
              {crumb.title}
            </Anchor>
          )
        }
        return (
          <Text key={`${crumb.title}-${index}`} size="sm" fw={isLast ? 600 : 400}>
            {crumb.title}
          </Text>
        )
      })}
    </Breadcrumbs>
    <AdminNotificationsButton />
  </Group>
</AppShell.Header>
```

Keep the existing navbar and main unchanged otherwise.

- [ ] **Step 4: Run shell tests to verify they pass**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/components/admin/AdminShell.test.tsx
```

Expected: PASS (nav + breadcrumbs + notifications).

- [ ] **Step 5: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/src/components/admin/AdminShell.tsx tanstack-app/src/components/admin/AdminShell.test.tsx
git commit -m "$(cat <<'EOF'
feat: add admin header with breadcrumbs and notifications

EOF
)"
```

---

### Task 5: Final verification

**Files:** none (run only)

- [ ] **Step 1: Run focused unit tests**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/components/admin/adminBreadcrumbs.test.ts src/components/admin/AdminShell.test.tsx
```

Expected: all PASS.

- [ ] **Step 2: Spot-check temple copy**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
rg -n 'Chùa|chùa' messages/vi.json
```

Expected: no matches.

- [ ] **Step 3: Manual smoke (optional if `pnpm dev` running)**

Open `/admin/invites`, confirm header breadcrumbs + bell empty popover; open `/admin/temples` and confirm nav/header say **Tịnh xá**.

No commit required unless Step 1–2 revealed fixes (then fix and commit before finishing).

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| `AppShell.Header` in `AdminShell` | Task 4 |
| Full clickable breadcrumb trail | Tasks 2 + 4 |
| Pathname map (not route meta) | Task 2 |
| Notifications bell + empty popover | Tasks 3 + 4 |
| Tịnh xá rename | Task 1 |
| Vitest coverage | Tasks 2 + 4 + 5 |
| No notification logic / no Cypress | Global constraints |

## Self-review notes

- No placeholders; signatures match across tasks (`AdminBreadcrumb`, `buildAdminBreadcrumbs`, `AdminNotificationsButton`).
- Member create/detail trails intentionally omit a list parent (matches URLs).
- `admin_title` appears in both navbar subtitle and breadcrumb root — tests should use roles/structure carefully; breadcrumb root is an `Anchor`/`Text` in the header, nav subtitle is separate `Text` in the navbar.
