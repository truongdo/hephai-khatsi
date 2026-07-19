# Admin Copy Form Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the admin Lời mời page with a header **Sao chép link form** button that ensures the global `public` invite exists and copies `{origin}/f/public`.

**Architecture:** Add `ensurePublicInvite` (get-or-create on fixed `PUBLIC_INVITE_ID`). New `AdminCopyFormLinkButton` in the AppShell header left of notifications. Delete invites route/page/nav; redirect `/admin` → `/admin/temples`.

**Tech Stack:** React 19, Mantine 9, TanStack Router, Paraglide, Vitest + Testing Library, Cypress (smoke path only)

**Spec:** `docs/superpowers/specs/2026-07-19-admin-copy-form-link-design.md`

## Global Constraints

- Work in the current workspace only — **never** `git worktree add`
- Before coding: create branch `feat/admin-copy-form-link` from `main` (Task 0)
- One fixed invite: `id`/`token` = `public` (`PUBLIC_INVITE_ID`)
- Do **not** build `/f/$token` UI or filler forms in this plan
- Do **not** add `@mantine/notifications` — use inline status text for copy success/failure
- Prefer Vitest; Cypress only updates the existing admin smoke path
- After merge squash into `main`, delete the local feature branch unless asked otherwise

## File Structure

| File | Responsibility |
| --- | --- |
| `tanstack-app/src/use-cases/ensurePublicInvite.ts` | Get-or-create public invite |
| `tanstack-app/src/use-cases/invite.test.ts` | Ensure + create invite tests |
| `tanstack-app/messages/vi.json` | Copy-link strings; remove dead invites keys |
| `tanstack-app/src/components/admin/AdminCopyFormLinkButton.tsx` | Header ensure + clipboard |
| `tanstack-app/src/components/admin/AdminCopyFormLinkButton.test.tsx` | Button behavior |
| `tanstack-app/src/components/admin/AdminShell.tsx` | Mount button; drop Lời mời nav |
| `tanstack-app/src/components/admin/AdminShell.test.tsx` | Nav/header expectations |
| `tanstack-app/src/components/admin/adminBreadcrumbs.ts` | Remove invites branch |
| `tanstack-app/src/components/admin/adminBreadcrumbs.test.ts` | Drop invites trail test |
| `tanstack-app/src/routes/admin/index.tsx` | Redirect to temples |
| `tanstack-app/src/routes/admin/invites.tsx` | **Delete** |
| `tanstack-app/src/components/admin/InvitesPage.tsx` | **Delete** |
| `tanstack-app/src/components/admin/InvitesPage.test.tsx` | **Delete** |
| `tanstack-app/src/query/adminQueries.ts` | Remove `inviteQuery` if unused |
| `tanstack-app/src/query/adminKeys.ts` | Remove `invite` key if unused |
| `tanstack-app/cypress/e2e/admin.cy.ts` | Visit `/admin/temples` |
| `tanstack-app/src/components/LoginPage.test.tsx` | Redirect example → temples |
| `docs/superpowers/specs/2026-07-19-he-phai-khatsi-database-design.md` | Correct invite scoping note |
| `docs/superpowers/specs/2026-07-19-he-phai-admin-ui-design.md` | Copy-link / no invites page |

---

### Task 0: Create feature branch

**Files:** none (git only)

**Interfaces:**
- Consumes: none
- Produces: branch `feat/admin-copy-form-link`

- [ ] **Step 1: Confirm on `main` and create branch**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git checkout main
git pull
git checkout -b feat/admin-copy-form-link
```

Expected: current branch is `feat/admin-copy-form-link`.

If not on `main` / pull fails / dirty tree: stop and ask the user before continuing.

---

### Task 1: `ensurePublicInvite` use-case

**Files:**
- Create: `tanstack-app/src/use-cases/ensurePublicInvite.ts`
- Modify: `tanstack-app/src/use-cases/invite.test.ts`

**Interfaces:**
- Consumes: `InviteStore` (`create`, `getByToken`), `PUBLIC_INVITE_ID`, existing `createInvite`
- Produces: `ensurePublicInvite(input: { createdBy: string }, store?: InviteStore): Promise<Invite>`

- [ ] **Step 1: Write the failing ensure tests**

Replace/extend `tanstack-app/src/use-cases/invite.test.ts` so it includes:

```ts
import { describe, expect, it } from 'vitest'
import { createInvite } from './createInvite'
import { ensurePublicInvite } from './ensurePublicInvite'
import { getInviteByToken } from './getInviteByToken'
import type { Invite } from '#/domain/types'

function memoryInviteStore() {
  const map = new Map<string, Invite>()
  return {
    async create(invite: Invite) {
      map.set(invite.token, invite)
    },
    async getByToken(token: string) {
      return map.get(token) ?? null
    },
  }
}

describe('invites', () => {
  it('creates the one invite and loads it by token', async () => {
    const store = memoryInviteStore()
    const invite = await createInvite({ createdBy: 'admin-1' }, store)
    expect(invite.token).toBe('public')
    expect(invite.createdBy).toBe('admin-1')
    const loaded = await getInviteByToken(invite.token, store)
    expect(loaded.id).toBe('public')
  })

  it('throws INVITE_NOT_FOUND', async () => {
    const store = memoryInviteStore()
    await expect(getInviteByToken('missing', store)).rejects.toMatchObject({
      code: 'INVITE_NOT_FOUND',
    })
  })

  it('ensurePublicInvite creates when missing', async () => {
    const store = memoryInviteStore()
    const invite = await ensurePublicInvite({ createdBy: 'admin-1' }, store)
    expect(invite).toMatchObject({
      id: 'public',
      token: 'public',
      createdBy: 'admin-1',
    })
  })

  it('ensurePublicInvite returns existing without overwrite', async () => {
    const store = memoryInviteStore()
    const first = await ensurePublicInvite({ createdBy: 'admin-1' }, store)
    const second = await ensurePublicInvite({ createdBy: 'admin-2' }, store)
    expect(second.createdBy).toBe('admin-1')
    expect(second.createdAt).toBe(first.createdAt)
    expect(second.token).toBe('public')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/use-cases/invite.test.ts
```

Expected: FAIL — `ensurePublicInvite` not found / cannot resolve module.

- [ ] **Step 3: Implement `ensurePublicInvite`**

Create `tanstack-app/src/use-cases/ensurePublicInvite.ts`:

```ts
import type { Invite } from '#/domain/types'
import { PUBLIC_INVITE_ID, inviteRepo, type InviteStore } from '#/repositories/inviteRepo'
import { createInvite } from './createInvite'

export type EnsurePublicInviteInput = {
  createdBy: string
}

export async function ensurePublicInvite(
  input: EnsurePublicInviteInput,
  store: InviteStore = inviteRepo,
): Promise<Invite> {
  const existing = await store.getByToken(PUBLIC_INVITE_ID)
  if (existing) return existing
  return createInvite({ createdBy: input.createdBy }, store)
}
```

Leave `createInvite.ts` as the write path for a missing invite (ensure owns get-or-create exclusively).

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/use-cases/invite.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/src/use-cases/ensurePublicInvite.ts tanstack-app/src/use-cases/invite.test.ts
git commit -m "$(cat <<'EOF'
feat: add ensurePublicInvite get-or-create for fixed public token

EOF
)"
```

---

### Task 2: Paraglide strings for copy-link

**Files:**
- Modify: `tanstack-app/messages/vi.json`
- Regenerates: `tanstack-app/src/paraglide/**` (via `pnpm run paraglide`)

**Interfaces:**
- Consumes: none
- Produces: `m.admin_copy_form_link()`, `m.admin_copy_form_link_copied()`, `m.admin_copy_form_link_failed()`

- [ ] **Step 1: Add message keys**

In `tanstack-app/messages/vi.json`, add (near other admin header keys):

```json
  "admin_copy_form_link": "Sao chép link form",
  "admin_copy_form_link_copied": "Đã sao chép",
  "admin_copy_form_link_failed": "Không sao chép được liên kết. Vui lòng sao chép thủ công.",
```

Do **not** delete old `admin_invites_*` / `admin_nav_invites` keys yet (still referenced until Task 5).

- [ ] **Step 2: Compile Paraglide**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm run paraglide
```

Expected: exit 0; `m.admin_copy_form_link` available from `#/paraglide/messages`.

- [ ] **Step 3: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/messages/vi.json tanstack-app/src/paraglide
git commit -m "$(cat <<'EOF'
feat: add Paraglide strings for admin copy form link

EOF
)"
```

---

### Task 3: `AdminCopyFormLinkButton`

**Files:**
- Create: `tanstack-app/src/components/admin/AdminCopyFormLinkButton.tsx`
- Create: `tanstack-app/src/components/admin/AdminCopyFormLinkButton.test.tsx`

**Interfaces:**
- Consumes: `useAdminClaim`, `ensurePublicInvite`, Paraglide keys from Task 2
- Produces: `AdminCopyFormLinkButton` React component

- [ ] **Step 1: Write the failing component tests**

Create `tanstack-app/src/components/admin/AdminCopyFormLinkButton.test.tsx`:

```tsx
import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { m } from '#/paraglide/messages'
import { theme } from '../../theme'
import { AdminCopyFormLinkButton } from './AdminCopyFormLinkButton'

const ensureMock = vi.fn(async () => ({
  id: 'public',
  token: 'public',
  createdBy: 'admin-uid',
  createdAt: '2026-07-19T00:00:00.000Z',
}))

vi.mock('#/use-cases/ensurePublicInvite', () => ({
  ensurePublicInvite: (...args: unknown[]) => ensureMock(...args),
}))

vi.mock('#/auth/useAdminClaim', () => ({
  useAdminClaim: () => ({ status: 'admin', uid: 'admin-uid' }),
}))

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver =
    ResizeObserverMock as unknown as typeof ResizeObserver
})

beforeEach(() => {
  ensureMock.mockClear()
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn(async () => undefined) },
  })
})

function renderButton() {
  return render(
    <MantineProvider theme={theme} defaultColorScheme="light">
      <AdminCopyFormLinkButton />
    </MantineProvider>,
  )
}

describe('AdminCopyFormLinkButton', () => {
  it('ensures invite and copies /f/public URL', async () => {
    const user = userEvent.setup()
    renderButton()
    await user.click(
      screen.getByRole('button', { name: m.admin_copy_form_link() }),
    )
    expect(ensureMock).toHaveBeenCalledWith({ createdBy: 'admin-uid' })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      `${window.location.origin}/f/public`,
    )
    expect(await screen.findByText(m.admin_copy_form_link_copied())).toBeTruthy()
  })

  it('shows warning when clipboard fails', async () => {
    const user = userEvent.setup()
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('denied'))
    renderButton()
    await user.click(
      screen.getByRole('button', { name: m.admin_copy_form_link() }),
    )
    expect(await screen.findByText(m.admin_copy_form_link_failed())).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/components/admin/AdminCopyFormLinkButton.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the button**

Create `tanstack-app/src/components/admin/AdminCopyFormLinkButton.tsx`:

```tsx
import { Button, Group, Text } from '@mantine/core'
import { Link2 } from 'lucide-react'
import { useState } from 'react'
import { m } from '#/paraglide/messages'
import { useAdminClaim } from '#/auth/useAdminClaim'
import { ensurePublicInvite } from '#/use-cases/ensurePublicInvite'

function inviteShareUrl(token: string): string {
  return `${window.location.origin}/f/${token}`
}

export function AdminCopyFormLinkButton() {
  const claim = useAdminClaim()
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')

  const handleClick = async () => {
    if (claim.status !== 'admin' || pending) return
    setPending(true)
    setStatus('idle')
    try {
      const invite = await ensurePublicInvite({ createdBy: claim.uid })
      try {
        await navigator.clipboard.writeText(inviteShareUrl(invite.token))
        setStatus('copied')
      } catch {
        setStatus('failed')
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <Group gap="xs" wrap="nowrap">
      <Button
        size="sm"
        variant="default"
        leftSection={<Link2 size={16} />}
        loading={pending}
        disabled={claim.status !== 'admin'}
        onClick={() => void handleClick()}
        aria-label={m.admin_copy_form_link()}
      >
        {m.admin_copy_form_link()}
      </Button>
      {status === 'copied' && (
        <Text size="sm" c="teal.7" role="status">
          {m.admin_copy_form_link_copied()}
        </Text>
      )}
      {status === 'failed' && (
        <Text size="sm" c="yellow.8" role="status">
          {m.admin_copy_form_link_failed()}
        </Text>
      )}
    </Group>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/components/admin/AdminCopyFormLinkButton.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/src/components/admin/AdminCopyFormLinkButton.tsx tanstack-app/src/components/admin/AdminCopyFormLinkButton.test.tsx
git commit -m "$(cat <<'EOF'
feat: add AdminCopyFormLinkButton for ensure-and-copy

EOF
)"
```

---

### Task 4: Wire button into `AdminShell`; remove Lời mời nav

**Files:**
- Modify: `tanstack-app/src/components/admin/AdminShell.tsx`
- Modify: `tanstack-app/src/components/admin/AdminShell.test.tsx`

**Interfaces:**
- Consumes: `AdminCopyFormLinkButton`
- Produces: header with copy button left of notifications; nav without invites

- [ ] **Step 1: Update failing shell expectations**

In `AdminShell.test.tsx`:

1. Change default `renderShell` path to `'/admin/temples'`.
2. In nav test: **remove** `expect(...getByText(m.admin_nav_invites()))`; keep temples / tang / ni / org units.
3. Replace breadcrumbs test that used invites with temples:

```ts
  it('renders breadcrumbs for the current path', async () => {
    renderShell('/admin/temples')
    const header = await screen.findByRole('banner')
    expect(header.parentElement?.getAttribute('data-layout')).toBe('alt')
    expect(within(header).getByText(m.admin_title())).toBeTruthy()
    expect(within(header).getByText(m.admin_nav_temples())).toBeTruthy()
  })
```

4. Add test that copy button is present next to notifications:

```ts
  it('renders copy form link next to notifications', async () => {
    renderShell('/admin/temples')
    const header = await screen.findByRole('banner')
    expect(
      within(header).getByRole('button', { name: m.admin_copy_form_link() }),
    ).toBeTruthy()
    expect(
      within(header).getByRole('button', { name: m.admin_notifications_aria() }),
    ).toBeTruthy()
  })
```

Mock `useAdminClaim` as admin and `ensurePublicInvite` in this file if the button renders disabled otherwise — or leave disabled until claim resolves; the role name still appears. Prefer:

```ts
vi.mock('#/auth/useAdminClaim', () => ({
  useAdminClaim: () => ({ status: 'admin', uid: 'admin-uid' }),
}))
vi.mock('#/use-cases/ensurePublicInvite', () => ({
  ensurePublicInvite: vi.fn(async () => ({
    id: 'public',
    token: 'public',
    createdBy: 'admin-uid',
    createdAt: '2026-07-19T00:00:00.000Z',
  })),
}))
```

alongside the existing `useAuth` mock.

- [ ] **Step 2: Run shell tests to verify they fail**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/components/admin/AdminShell.test.tsx
```

Expected: FAIL on missing copy button and/or still finding invites nav.

- [ ] **Step 3: Update `AdminShell.tsx`**

1. Remove invites from `navItems` (and unused `Link2` import if no longer needed).
2. Import `AdminCopyFormLinkButton`.
3. In header right cluster, render:

```tsx
          <Group gap="sm" wrap="nowrap">
            <AdminCopyFormLinkButton />
            <AdminNotificationsButton />
          </Group>
```

Keep breadcrumbs on the left as today.

- [ ] **Step 4: Run shell tests to verify they pass**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/components/admin/AdminShell.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/src/components/admin/AdminShell.tsx tanstack-app/src/components/admin/AdminShell.test.tsx
git commit -m "$(cat <<'EOF'
feat: put copy form link in admin header and drop invites nav

EOF
)"
```

---

### Task 5: Remove invites page/route; redirect `/admin` to temples

**Files:**
- Delete: `tanstack-app/src/routes/admin/invites.tsx`
- Delete: `tanstack-app/src/components/admin/InvitesPage.tsx`
- Delete: `tanstack-app/src/components/admin/InvitesPage.test.tsx`
- Modify: `tanstack-app/src/routes/admin/index.tsx`
- Modify: `tanstack-app/src/components/admin/adminBreadcrumbs.ts`
- Modify: `tanstack-app/src/components/admin/adminBreadcrumbs.test.ts`
- Modify: `tanstack-app/src/query/adminQueries.ts` (remove `inviteQuery`)
- Modify: `tanstack-app/src/query/adminKeys.ts` (remove `invite`)
- Modify: `tanstack-app/cypress/e2e/admin.cy.ts`
- Modify: `tanstack-app/src/components/LoginPage.test.tsx`
- Modify: `tanstack-app/messages/vi.json` (remove dead invites keys)
- Regenerates: `tanstack-app/src/routeTree.gen.ts` (via Vite/router codegen or `pnpm` script if present), `tanstack-app/src/paraglide/**`

**Interfaces:**
- Consumes: none
- Produces: no `/admin/invites`; `/admin` → `/admin/temples`

- [ ] **Step 1: Update redirect + breadcrumbs tests first**

`admin/index.tsx` target expectation — update any test if present; breadcrumbs:

Remove the `builds invites trail` test from `adminBreadcrumbs.test.ts`.

Remove invites branch from `adminBreadcrumbs.ts`:

```ts
  // delete the `if (section === 'invites') { ... }` block entirely
```

Change `routes/admin/index.tsx` to:

```tsx
import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/')({
  component: () => <Navigate to="/admin/temples" />,
})
```

(Keep the same `createFileRoute` path string the file already uses.)

Cypress:

```ts
describe('Admin', () => {
  it('sends anonymous users from /admin to login with return path', () => {
    cy.visit('/admin/temples')
    cy.url().should('include', '/login')
    cy.url().should('include', 'redirect')
    cy.contains('h1', 'Đăng nhập').should('be.visible')
  })
})
```

LoginPage.test: change `'/admin/invites'` → `'/admin/temples'` in redirect mock expectations.

- [ ] **Step 2: Delete invites page artifacts**

```bash
rm tanstack-app/src/routes/admin/invites.tsx \
   tanstack-app/src/components/admin/InvitesPage.tsx \
   tanstack-app/src/components/admin/InvitesPage.test.tsx
```

Remove `inviteQuery` from `adminQueries.ts` and `invite` from `adminKeys.ts`. Grep for remaining references and fix.

From `vi.json`, delete unused keys: `admin_nav_invites`, `admin_invites_create`, `admin_invites_modal_title`, `admin_invites_create_submit`, `admin_invites_cancel`, `admin_invites_filter_org_unit`, `admin_invites_filter_form_type`, `admin_invites_col_org_unit`, `admin_invites_col_form_type`, `admin_invites_col_created_at`, `admin_invites_col_created_by`, `admin_invites_copy_link`, `admin_invites_copy_failed`, `admin_invites_load_more`, `admin_invites_form_type_temple`, `admin_invites_form_type_member_tang`, `admin_invites_form_type_member_ni`.

Keep form-type labels only if still referenced elsewhere (grep first). If temples/members still need those labels under other keys, leave those other keys alone.

- [ ] **Step 3: Regenerate route tree + Paraglide**

Start/rely on TanStack Router plugin regen, or run the project’s usual generate. Confirm `routeTree.gen.ts` no longer references `/admin/invites`.

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm run paraglide
# If routeTree is stale, run a brief `pnpm exec vite build` or the repo’s route-gen script so routeTree.gen.ts updates
```

- [ ] **Step 4: Run focused verification**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/components/admin/adminBreadcrumbs.test.ts src/components/admin/AdminShell.test.tsx src/components/admin/AdminCopyFormLinkButton.test.tsx src/use-cases/invite.test.ts src/components/LoginPage.test.tsx
rg -n "admin/invites|InvitesPage|admin_nav_invites|inviteQuery" src messages || true
```

Expected: Vitest PASS; ripgrep finds no leftover invites page references (docs outside `tanstack-app` may still mention historical invites).

- [ ] **Step 5: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add -A tanstack-app
git commit -m "$(cat <<'EOF'
feat: remove admin invites page; redirect /admin to temples

EOF
)"
```

---

### Task 6: Spec docs touch-up

**Files:**
- Modify: `docs/superpowers/specs/2026-07-19-he-phai-khatsi-database-design.md`
- Modify: `docs/superpowers/specs/2026-07-19-he-phai-admin-ui-design.md`

**Interfaces:**
- Consumes: product decisions from copy-form-link + filler UI specs
- Produces: docs aligned with one global invite + header copy

- [ ] **Step 1: Patch database design invite rows**

In the summary table and `invites/{inviteId}` section, change the phase-1 model to:

- One multi-use global invite (`token` / doc id `public`) gates public writes.
- `orgUnitId` and form type are **not** stored on the invite; the visitor chooses them on the filler form.
- Remove or rewrite sentences that say `orgUnitId` is copied from the invite as authoritative for fillers.

Keep other collections/fields intact. Point to `2026-07-19-filler-forms-ui-design.md` for UI.

- [ ] **Step 2: Patch admin UI design**

Replace invites list/create modal bullets with:

- Header **Sao chép link form** ensures public invite and copies `/f/public`.
- No sidebar Lời mời; `/admin` redirects to temples.
- Filler forms are a separate plan.

- [ ] **Step 3: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add docs/superpowers/specs/2026-07-19-he-phai-khatsi-database-design.md docs/superpowers/specs/2026-07-19-he-phai-admin-ui-design.md
git commit -m "$(cat <<'EOF'
docs: align he-phai specs with one global invite and header copy

EOF
)"
```

---

### Task 7: Final verification

**Files:** none

- [ ] **Step 1: Run unit suite**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm test
```

Expected: PASS

- [ ] **Step 2: Manual smoke (optional if emulators up)**

- Open `/admin` as claimed admin → lands on temples.
- Header shows **Sao chép link form** left of bell.
- Click → clipboard has `{origin}/f/public` (invite doc created if missing).
- Sidebar has no Lời mời; `/admin/invites` 404 or unmatched.

- [ ] **Step 3: Commit only if Step 1 forced fixes**

If green with no extra changes, skip. Otherwise commit verification fixes.

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| Header Copy link left of notifications | 3, 4 |
| Ensure create if missing, then copy URL | 1, 3 |
| Idempotent ensure (no overwrite) | 1 |
| Remove Lời mời nav | 4 |
| Delete invites page/route; `/admin` → temples | 5 |
| i18n label / success / fail | 2, 3 |
| Update Cypress + breadcrumbs + login test paths | 5 |
| Docs invite scoping correction | 6 |
| No filler `/f` UI in this slice | Explicit non-goal |

## Placeholder scan

No TBD / “similar to Task N” / hand-wavy validation steps.

## Type consistency

- `ensurePublicInvite({ createdBy: string }) → Promise<Invite>`
- URL: `` `${origin}/f/${token}` `` with `token === 'public'`
- Paraglide: `admin_copy_form_link`, `admin_copy_form_link_copied`, `admin_copy_form_link_failed`
