# Admin Data Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a shared calm editorial `AdminDataTable` (paper panel + themed Mantine Table) and use it on Members, Temples, and Org Units list pages.

**Architecture:** Expand `theme.ts` Table tokens for header wash / hover / borders. Add `emptyCell` helper and `AdminDataTable` wrapper (Paper + loading skeleton / empty state / Table). Migrate the three list pages to use it; leave Invites unchanged.

**Tech Stack:** React 19, Mantine 9 (`Paper`, `Table`, `Skeleton`, `Text`, `Stack`), Paraglide, Vitest + Testing Library

**Spec:** `docs/superpowers/specs/2026-07-19-admin-data-table-design.md`

## Global Constraints

- Work in the current workspace only — **never** `git worktree add`
- Before coding: create branch `feat/admin-data-table` from `main` (Task 0)
- Brand tokens only: `--paper`, `--line`, `--jade-pale`, `--saffron-pale`, `--ink-soft`, `--ink` — no new palette
- Empty display character is hyphen `-`, never em-dash `—` or en-dash `–`
- Vitest only — do **not** add Cypress for this polish
- Do **not** change InvitesPage
- Do **not** add sorting, sticky header, stripes, TanStack Table, or row selection
- Errors stay page-level (outside `AdminDataTable`)

## File Structure

| File | Responsibility |
| --- | --- |
| `tanstack-app/messages/vi.json` | `admin_table_empty` string |
| `tanstack-app/src/paraglide/**` | Regenerated via `pnpm run paraglide` |
| `tanstack-app/src/components/admin/emptyCell.ts` | Null/empty → `-` |
| `tanstack-app/src/components/admin/emptyCell.test.ts` | Unit tests for helper |
| `tanstack-app/src/theme.ts` | Global Table visual tokens |
| `tanstack-app/src/components/admin/AdminDataTable.tsx` | Shared table chrome |
| `tanstack-app/src/components/admin/AdminDataTable.test.tsx` | Wrapper behavior tests |
| `tanstack-app/src/components/admin/OrgUnitsPage.tsx` | Migrate to `AdminDataTable` |
| `tanstack-app/src/components/admin/MembersListPage.tsx` | Migrate + `emptyCell` |
| `tanstack-app/src/components/admin/TemplesListPage.tsx` | Migrate + `emptyCell` |

---

### Task 0: Create feature branch

**Files:** none (git only)

**Interfaces:**
- Consumes: none
- Produces: branch `feat/admin-data-table`

- [ ] **Step 1: Confirm on `main` and create branch**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git checkout main
git pull
git checkout -b feat/admin-data-table
```

Expected: current branch is `feat/admin-data-table`.

If not on `main` / pull fails / dirty tree: stop and ask the user before continuing.

---

### Task 1: i18n empty copy + `emptyCell` helper

**Files:**
- Modify: `tanstack-app/messages/vi.json`
- Create: `tanstack-app/src/components/admin/emptyCell.ts`
- Create: `tanstack-app/src/components/admin/emptyCell.test.ts`
- Regenerates: `tanstack-app/src/paraglide/**`

**Interfaces:**
- Consumes: none
- Produces: `m.admin_table_empty()`; `emptyCell(value: string | null | undefined): string`

- [ ] **Step 1: Write the failing `emptyCell` tests**

Create `tanstack-app/src/components/admin/emptyCell.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { emptyCell } from './emptyCell'

describe('emptyCell', () => {
  it('returns hyphen for null, undefined, and blank strings', () => {
    expect(emptyCell(null)).toBe('-')
    expect(emptyCell(undefined)).toBe('-')
    expect(emptyCell('')).toBe('-')
    expect(emptyCell('   ')).toBe('-')
  })

  it('returns trimmed value when present', () => {
    expect(emptyCell('  HT A  ')).toBe('HT A')
    expect(emptyCell('001')).toBe('001')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/components/admin/emptyCell.test.ts
```

Expected: FAIL — cannot resolve `./emptyCell`.

- [ ] **Step 3: Implement `emptyCell`**

Create `tanstack-app/src/components/admin/emptyCell.ts`:

```ts
export function emptyCell(value: string | null | undefined): string {
  if (value == null) return '-'
  const trimmed = value.trim()
  return trimmed.length === 0 ? '-' : trimmed
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/components/admin/emptyCell.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Add Paraglide key and compile**

In `tanstack-app/messages/vi.json`, add near other `admin_*` keys (e.g. after `admin_notifications_empty`):

```json
"admin_table_empty": "Chưa có dữ liệu"
```

Keep valid JSON commas.

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm run paraglide
```

Expected: exit 0; `m.admin_table_empty` importable from `#/paraglide/messages`.

- [ ] **Step 6: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/messages/vi.json tanstack-app/src/paraglide \
  tanstack-app/src/components/admin/emptyCell.ts \
  tanstack-app/src/components/admin/emptyCell.test.ts
git commit -m "$(cat <<'EOF'
feat: add emptyCell helper and admin table empty copy

EOF
)"
```

---

### Task 2: Theme Table tokens

**Files:**
- Modify: `tanstack-app/src/theme.ts`

**Interfaces:**
- Consumes: CSS vars from `styles.css` (`--paper`, `--line`, `--jade-pale`, `--saffron-pale`, `--ink-soft`)
- Produces: themed Mantine `Table` defaultProps + styles (header wash, hover tint, hairlines)

- [ ] **Step 1: Expand `Table` in `theme.ts`**

Replace the existing `Table` entry under `components` with:

```ts
    Table: {
      defaultProps: {
        highlightOnHover: true,
        highlightOnHoverColor: 'var(--saffron-pale)',
        horizontalSpacing: 'md',
        verticalSpacing: 'sm',
        borderColor: 'var(--line)',
        withRowBorders: true,
      },
      styles: {
        table: { backgroundColor: 'var(--paper)' },
        thead: { backgroundColor: 'var(--jade-pale)' },
        th: {
          color: 'var(--ink-soft)',
          fontWeight: 600,
          fontSize: '0.8125rem',
          borderBottomColor: 'var(--line)',
        },
        td: {
          borderBottomColor: 'var(--line)',
        },
      },
    },
```

Do not change other theme entries (`AppShell`, `Paper`, `Modal`, colors).

- [ ] **Step 2: Smoke-check TypeScript on theme**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec tsc --noEmit -p tsconfig.json 2>&1 | head -40
```

Expected: no errors in `theme.ts`. (Other pre-existing project errors are OK to ignore only if unrelated; if `theme.ts` errors, fix them.)

- [ ] **Step 3: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/src/theme.ts
git commit -m "$(cat <<'EOF'
style: theme admin tables with jade header and saffron hover

EOF
)"
```

---

### Task 3: `AdminDataTable` component

**Files:**
- Create: `tanstack-app/src/components/admin/AdminDataTable.tsx`
- Create: `tanstack-app/src/components/admin/AdminDataTable.test.tsx`

**Interfaces:**
- Consumes: `m.admin_table_empty()`; Mantine `Paper`, `Table`, `Skeleton`, `Text`, `Stack`
- Produces:

```tsx
type AdminDataTableProps = {
  children: React.ReactNode
  empty?: boolean
  emptyMessage?: string
  loading?: boolean
  'aria-label'?: string
}

export function AdminDataTable(props: AdminDataTableProps): React.JSX.Element
```

Behavior contract:
- Always render bordered `Paper` (theme already sets `withBorder` + paper colors).
- If `loading`: inside Paper, `Stack` of 4 `Skeleton` rows (`height={36}`), `aria-busy="true"`, `aria-label` from prop or default `"loading"`. Do **not** render `children`.
- Else if `empty`: centered `Text` with `emptyMessage ?? m.admin_table_empty()`, role that tests can find via text. Do **not** render `children`.
- Else: `Table` with `aria-label` if provided, render `children` (expected `Table.Thead` + `Table.Tbody`).

- [ ] **Step 1: Write the failing tests**

Create `tanstack-app/src/components/admin/AdminDataTable.test.tsx`:

```tsx
import { MantineProvider, Table } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { theme } from '../../theme'
import { AdminDataTable } from './AdminDataTable'

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver =
    ResizeObserverMock as unknown as typeof ResizeObserver

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
})

function renderTable(ui: React.ReactElement) {
  return render(
    <MantineProvider theme={theme} defaultColorScheme="light">
      {ui}
    </MantineProvider>,
  )
}

const sampleChildren = (
  <>
    <Table.Thead>
      <Table.Tr>
        <Table.Th>Name</Table.Th>
      </Table.Tr>
    </Table.Thead>
    <Table.Tbody>
      <Table.Tr>
        <Table.Td>Row A</Table.Td>
      </Table.Tr>
    </Table.Tbody>
  </>
)

describe('AdminDataTable', () => {
  it('renders row children when not loading or empty', () => {
    renderTable(
      <AdminDataTable aria-label="demo">{sampleChildren}</AdminDataTable>,
    )
    expect(screen.getByText('Row A')).toBeTruthy()
    expect(screen.getByRole('table', { name: 'demo' })).toBeTruthy()
  })

  it('shows default empty message and hides children when empty', () => {
    renderTable(
      <AdminDataTable empty>{sampleChildren}</AdminDataTable>,
    )
    expect(screen.getByText('Chưa có dữ liệu')).toBeTruthy()
    expect(screen.queryByText('Row A')).toBeNull()
  })

  it('shows custom empty message when provided', () => {
    renderTable(
      <AdminDataTable empty emptyMessage="Không có dòng">
        {sampleChildren}
      </AdminDataTable>,
    )
    expect(screen.getByText('Không có dòng')).toBeTruthy()
  })

  it('shows loading skeleton and hides children when loading', () => {
    renderTable(
      <AdminDataTable loading aria-label="loading">
        {sampleChildren}
      </AdminDataTable>,
    )
    expect(screen.getByLabelText('loading')).toBeTruthy()
    expect(screen.queryByText('Row A')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/components/admin/AdminDataTable.test.tsx
```

Expected: FAIL — cannot resolve `./AdminDataTable`.

- [ ] **Step 3: Implement `AdminDataTable`**

Create `tanstack-app/src/components/admin/AdminDataTable.tsx`:

```tsx
import { Paper, Skeleton, Stack, Table, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import { m } from '#/paraglide/messages'

export type AdminDataTableProps = {
  children: ReactNode
  empty?: boolean
  emptyMessage?: string
  loading?: boolean
  'aria-label'?: string
}

export function AdminDataTable({
  children,
  empty = false,
  emptyMessage,
  loading = false,
  'aria-label': ariaLabel,
}: AdminDataTableProps) {
  return (
    <Paper>
      {loading ? (
        <Stack gap="sm" p="md" aria-busy="true" aria-label={ariaLabel ?? 'loading'}>
          <Skeleton height={36} />
          <Skeleton height={36} />
          <Skeleton height={36} />
          <Skeleton height={36} />
        </Stack>
      ) : empty ? (
        <Text ta="center" c="dimmed" py="xl" px="md">
          {emptyMessage ?? m.admin_table_empty()}
        </Text>
      ) : (
        <Table aria-label={ariaLabel}>{children}</Table>
      )}
    </Paper>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/components/admin/AdminDataTable.test.tsx
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/src/components/admin/AdminDataTable.tsx \
  tanstack-app/src/components/admin/AdminDataTable.test.tsx
git commit -m "$(cat <<'EOF'
feat: add AdminDataTable with empty and loading states

EOF
)"
```

---

### Task 4: Migrate `OrgUnitsPage`

**Files:**
- Modify: `tanstack-app/src/components/admin/OrgUnitsPage.tsx`
- Test: `tanstack-app/src/components/admin/OrgUnitsPage.test.tsx` (run; update only if broken)

**Interfaces:**
- Consumes: `AdminDataTable`
- Produces: org units list using shared table chrome; loading/empty wired

- [ ] **Step 1: Replace raw `Table` / `Loader` with `AdminDataTable`**

Update `OrgUnitsPage.tsx`:

1. Change imports — remove `Loader`; add `AdminDataTable`; keep `Table` for `Table.Thead` / etc.; keep `Stack`, `Text`, `Title`.
2. Replace the pending/data table section so errors stay outside, and the table region is:

```tsx
      {isError && (
        <Text c="red" role="alert">
          {m.auth_error_unknown()}
        </Text>
      )}
      {!isError && (
        <AdminDataTable
          loading={isPending}
          empty={!isPending && (data?.length ?? 0) === 0}
          aria-label={m.admin_nav_org_units()}
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{m.admin_org_units_col_code()}</Table.Th>
              <Table.Th>{m.admin_org_units_col_name()}</Table.Th>
              <Table.Th>{m.admin_org_units_col_kind()}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(data ?? []).map((unit) => (
              <Table.Tr key={unit.id}>
                <Table.Td>{unit.code}</Table.Td>
                <Table.Td>{unit.name}</Table.Td>
                <Table.Td>{orgUnitKindLabel(unit.kind)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </AdminDataTable>
      )}
```

Remove the standalone `{isPending && <Loader .../>}` and the `{data && ( <Table>...</Table> )}` block.

- [ ] **Step 2: Run page test**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/components/admin/OrgUnitsPage.test.tsx
```

Expected: PASS. If it fails looking for a loader, remove that assertion or keep only row text assertions.

- [ ] **Step 3: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/src/components/admin/OrgUnitsPage.tsx \
  tanstack-app/src/components/admin/OrgUnitsPage.test.tsx
git commit -m "$(cat <<'EOF'
feat: use AdminDataTable on org units list

EOF
)"
```

---

### Task 5: Migrate `MembersListPage`

**Files:**
- Modify: `tanstack-app/src/components/admin/MembersListPage.tsx`
- Test: `tanstack-app/src/components/admin/MembersListPage.test.tsx` (run; update only if broken)

**Interfaces:**
- Consumes: `AdminDataTable`, `emptyCell`
- Produces: members list using shared table; empty cells use `-`

- [ ] **Step 1: Wire `AdminDataTable` and `emptyCell`**

In `MembersListPage.tsx`:

1. Imports: remove `Loader`; add `AdminDataTable` and `emptyCell`; keep `Table` compound parts.
2. Replace the loading/error/table block:

```tsx
      {members.isError && (
        <Text c="red" role="alert">
          {m.auth_error_unknown()}
        </Text>
      )}
      {!members.isError && (
        <>
          <AdminDataTable
            loading={isLoading}
            empty={!isLoading && allItems.length === 0}
            aria-label={listTitle(sanghaType)}
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{m.admin_members_col_phap_danh()}</Table.Th>
                <Table.Th>{m.admin_members_col_the_danh()}</Table.Th>
                <Table.Th>{m.admin_members_col_cccd()}</Table.Th>
                <Table.Th>{m.admin_members_col_status()}</Table.Th>
                <Table.Th>{m.admin_members_col_updated_at()}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {allItems.map((member) => (
                <Table.Tr key={member.id}>
                  <Table.Td>
                    <Text
                      component={Link}
                      to="/admin/members/$id"
                      params={{ id: member.id }}
                      c="teal.7"
                      fw={600}
                    >
                      {memberDisplayName(member)}
                    </Text>
                  </Table.Td>
                  <Table.Td>{emptyCell(member.theDanh)}</Table.Td>
                  <Table.Td>{member.cccd}</Table.Td>
                  <Table.Td>
                    <RecordStatusBadge
                      status={member.status}
                      label={statusLabel(member.status)}
                    />
                  </Table.Td>
                  <Table.Td>
                    {new Date(member.updatedAt).toLocaleString('vi-VN')}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </AdminDataTable>
          {nextCursor && (
            <Button
              variant="light"
              loading={members.isFetching}
              onClick={() => setCursor(nextCursor)}
            >
              {m.admin_members_load_more()}
            </Button>
          )}
        </>
      )}
```

Remove `{isLoading && <Loader .../>}` and the old `{!isLoading && !members.isError && ( <> <Table>...</Table> ...)}` wrapper.

Keep filters, title, create button, and `isLoading` definition unchanged.

- [ ] **Step 2: Run page test**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/components/admin/MembersListPage.test.tsx
```

Expected: PASS (`HT A` link still found).

- [ ] **Step 3: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/src/components/admin/MembersListPage.tsx \
  tanstack-app/src/components/admin/MembersListPage.test.tsx
git commit -m "$(cat <<'EOF'
feat: use AdminDataTable on members list

EOF
)"
```

---

### Task 6: Migrate `TemplesListPage`

**Files:**
- Modify: `tanstack-app/src/components/admin/TemplesListPage.tsx`
- Test: `tanstack-app/src/components/admin/TemplesListPage.test.tsx` (run; update only if broken)

**Interfaces:**
- Consumes: `AdminDataTable`, `emptyCell`
- Produces: temples list using shared table; phone empty cells use `-`

- [ ] **Step 1: Wire `AdminDataTable` and `emptyCell`**

Same pattern as Members:

1. Remove `Loader`; import `AdminDataTable`, `emptyCell`.
2. Replace loading/table region with:

```tsx
      {temples.isError && (
        <Text c="red" role="alert">
          {m.auth_error_unknown()}
        </Text>
      )}
      {!temples.isError && (
        <>
          <AdminDataTable
            loading={isLoading}
            empty={!isLoading && allItems.length === 0}
            aria-label={m.admin_nav_temples()}
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{m.admin_temples_col_danh_hieu()}</Table.Th>
                <Table.Th>{m.admin_temples_col_phone()}</Table.Th>
                <Table.Th>{m.admin_temples_col_status()}</Table.Th>
                <Table.Th>{m.admin_temples_col_updated_at()}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {allItems.map((temple) => (
                <Table.Tr key={temple.id}>
                  <Table.Td>
                    <Text
                      component={Link}
                      to="/admin/temples/$id"
                      params={{ id: temple.id }}
                      c="teal.7"
                      fw={600}
                    >
                      {temple.danhHieu ?? temple.id}
                    </Text>
                  </Table.Td>
                  <Table.Td>{emptyCell(temple.managerPhones[0])}</Table.Td>
                  <Table.Td>
                    <RecordStatusBadge
                      status={temple.status}
                      label={statusLabel(temple.status)}
                    />
                  </Table.Td>
                  <Table.Td>
                    {new Date(temple.updatedAt).toLocaleString('vi-VN')}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </AdminDataTable>
          {nextCursor && (
            <Button
              variant="light"
              loading={temples.isFetching}
              onClick={() => setCursor(nextCursor)}
            >
              {m.admin_temples_load_more()}
            </Button>
          )}
        </>
      )}
```

- [ ] **Step 2: Run page test**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/components/admin/TemplesListPage.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/src/components/admin/TemplesListPage.tsx \
  tanstack-app/src/components/admin/TemplesListPage.test.tsx
git commit -m "$(cat <<'EOF'
feat: use AdminDataTable on temples list

EOF
)"
```

---

### Task 7: Final verification

**Files:** none (verify only)

**Interfaces:**
- Consumes: all prior tasks
- Produces: confidence that suite still passes

- [ ] **Step 1: Run focused admin unit tests**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run \
  src/components/admin/emptyCell.test.ts \
  src/components/admin/AdminDataTable.test.tsx \
  src/components/admin/OrgUnitsPage.test.tsx \
  src/components/admin/MembersListPage.test.tsx \
  src/components/admin/TemplesListPage.test.tsx
```

Expected: all PASS.

- [ ] **Step 2: Grep for leftover em-dashes in migrated pages**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
rg -n '—' src/components/admin/MembersListPage.tsx \
  src/components/admin/TemplesListPage.tsx \
  src/components/admin/OrgUnitsPage.tsx \
  src/components/admin/emptyCell.ts \
  src/components/admin/AdminDataTable.tsx
```

Expected: no matches.

- [ ] **Step 3: Manual UI check (optional if `pnpm dev` already running)**

Open `/admin/org-units`, `/admin/members/tang`, `/admin/temples` — confirm paper panel, jade header wash, saffron-pale row hover, empty state if filters yield no rows.

No commit required unless Step 1 forced test fixes — then commit those fixes with message `test: fix admin list tests after AdminDataTable migration`.

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| Shared `AdminDataTable` + theme styles | 2, 3 |
| Calm editorial visuals (panel, jade header, saffron hover, hairlines) | 2, 3 |
| `emptyCell` → `-` | 1, 5, 6 |
| Migrate Members / Temples / Org Units | 4, 5, 6 |
| Invites unchanged | Global constraint + no task |
| Loading skeleton + empty inside panel | 3–6 |
| Errors outside table | 4–6 |
| Paraglide `admin_table_empty` | 1 |
| Vitest, no Cypress | 1, 3, 7 |
| No sorting / sticky / TanStack Table | Global constraint |
