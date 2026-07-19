# Filler Public Form Path (Shell + Entry) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the public invite-gated entry flow at `/f/$token`: validate invite, choose Tăng / Ni / Tịnh xá, pick Giáo đoàn, run identity gate (CCCD / phone), then land on a **placeholder editor shell** (full paper fields come in later slices).

**Architecture:** TanStack file routes under `f.$token`. Layout validates the invite via existing `getInviteByToken` + client Firestore (rules already allow `invites` get + `orgUnits` list). Entry steps use search params for `formType` / `orgUnitId`. Resume uses existing `resumeMemberByCccd` / `resumeTemplesByPhone` against client repos. No `createServerFn` in this slice. Hide `AppHeader` on `/f/*` like admin.

**Tech Stack:** React 19, Mantine 9, TanStack Router + Query, Paraglide, Vitest + Testing Library, Cypress smoke only

**Spec:** `docs/superpowers/specs/2026-07-19-filler-forms-ui-design.md` (shell + entry sections only)

## Global Constraints

- Work in the current workspace only — **never** `git worktree add`
- Before coding: create branch `feat/filler-public-path` from `main` (Task 0)
- One global invite token (`public`); visitor chooses `formType` + `orgUnitId`
- Do **not** build full paper form field sections (temple/member editors stay placeholders)
- Do **not** add `createServerFn` / `src/server` in this plan
- Do **not** add `@mantine/notifications`
- Brand: parchment / ink-teal / saffron; single column ~760px; type choices stacked on mobile, up to 3-up from `sm`
- Prefer Vitest; one thin Cypress visit for `/f/public` invalid-or-loading UI only if easy
- After merge squash into `main`, delete the local feature branch unless asked otherwise

## File Structure

| File | Responsibility |
| --- | --- |
| `tanstack-app/src/routes/f.$token.tsx` | Layout: validate invite, parchment chrome, `<Outlet />` |
| `tanstack-app/src/routes/f.$token.index.tsx` | Step A: type chooser |
| `tanstack-app/src/routes/f.$token.org.tsx` | Step B: Giáo đoàn select |
| `tanstack-app/src/routes/f.$token.identity.tsx` | Step C: CCCD / phone + resume / create |
| `tanstack-app/src/routes/f.$token.edit.member.tsx` | New-member editor placeholder (search: org, sangha, cccd) |
| `tanstack-app/src/routes/f.$token.edit.member.$memberId.tsx` | Resume member placeholder |
| `tanstack-app/src/routes/f.$token.edit.temple.tsx` | New-temple placeholder (search: org, phone) |
| `tanstack-app/src/routes/f.$token.edit.temple.$templeId.tsx` | Resume temple placeholder |
| `tanstack-app/src/components/filler/FillerPageFrame.tsx` | Centered max-w ~760 parchment stack |
| `tanstack-app/src/components/filler/FillerTypeChooser.tsx` | Three type buttons |
| `tanstack-app/src/components/filler/FillerOrgPicker.tsx` | Filtered org `Select` |
| `tanstack-app/src/components/filler/FillerIdentityGate.tsx` | CCCD / phone UI + temple pick list |
| `tanstack-app/src/components/filler/FillerEditorShell.tsx` | Sticky title/status bar; placeholder body |
| `tanstack-app/src/query/fillerQueries.ts` | Invite + orgUnits `queryOptions` |
| `tanstack-app/src/query/fillerKeys.ts` | Query key factory |
| `tanstack-app/src/components/filler/*.test.tsx` | Component tests |
| `tanstack-app/messages/vi.json` | Public filler copy |
| `tanstack-app/src/routes/__root.tsx` | Hide `AppHeader` on `/f` |
| `tanstack-app/cypress/e2e/filler.cy.ts` | Thin smoke visit |

## URL map

| Path | Purpose |
| --- | --- |
| `/f/$token` | Type chooser |
| `/f/$token/org?formType=` | Org picker (`formType`: `member_tang` \| `member_ni` \| `temple`) |
| `/f/$token/identity?formType=&orgUnitId=` | Identity gate |
| `/f/$token/edit/member?orgUnitId=&sanghaType=&cccd=` | New member shell (no save yet) |
| `/f/$token/edit/member/$memberId` | Existing member shell |
| `/f/$token/edit/temple?orgUnitId=&phone=` | New temple shell |
| `/f/$token/edit/temple/$templeId` | Existing temple shell |

`formType` search values match domain `FormType`.

---

### Task 0: Create feature branch

**Files:** none (git only)

**Interfaces:**
- Consumes: none
- Produces: branch `feat/filler-public-path`

- [ ] **Step 1: Branch from main**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git checkout main
git pull
git checkout -b feat/filler-public-path
```

Expected: on `feat/filler-public-path`. If not on `main` / dirty tree: stop and ask.

---

### Task 1: i18n keys for filler entry

**Files:**
- Modify: `tanstack-app/messages/vi.json`
- Regenerates: `tanstack-app/src/paraglide/**` via `pnpm run paraglide`

**Interfaces:**
- Produces: Paraglide messages listed below

- [ ] **Step 1: Add keys to `vi.json`**

```json
  "filler_invite_invalid_title": "Liên kết không hợp lệ",
  "filler_invite_invalid_body": "Không tìm thấy lời mời. Vui lòng kiểm tra lại đường dẫn.",
  "filler_type_title": "Chọn loại đăng ký",
  "filler_type_helper": "Chọn một trong các mẫu dưới đây để tiếp tục.",
  "filler_type_tang": "Tăng",
  "filler_type_ni": "Ni",
  "filler_type_temple": "Tịnh xá",
  "filler_org_title": "Chọn giáo đoàn",
  "filler_org_label": "Giáo đoàn / Ni giới",
  "filler_org_continue": "Tiếp tục",
  "filler_org_back": "Quay lại",
  "filler_identity_title_member": "Nhập số CCCD",
  "filler_identity_title_temple": "Nhập số điện thoại",
  "filler_identity_cccd_label": "CCCD",
  "filler_identity_phone_label": "Điện thoại",
  "filler_identity_continue": "Tiếp tục",
  "filler_identity_back": "Quay lại",
  "filler_identity_create_member": "Tạo hồ sơ mới",
  "filler_identity_create_temple": "Tạo tịnh xá mới",
  "filler_identity_pick_temple": "Chọn tịnh xá đã có",
  "filler_identity_not_found": "Chưa có hồ sơ. Bạn có thể tạo mới.",
  "filler_status_draft": "Bản nháp",
  "filler_status_view": "Chỉ xem",
  "filler_editor_placeholder": "Nội dung form đầy đủ sẽ có ở bước sau. Bạn đã vào đúng luồng đăng ký.",
  "filler_editor_title_member_new": "Hồ sơ thành viên (mới)",
  "filler_editor_title_member": "Hồ sơ thành viên",
  "filler_editor_title_temple_new": "Tịnh xá (mới)",
  "filler_editor_title_temple": "Tịnh xá",
  "filler_error_generic": "Có lỗi xảy ra. Vui lòng thử lại."
```

- [ ] **Step 2: Compile Paraglide**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm run paraglide
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add tanstack-app/messages/vi.json
git commit -m "$(cat <<'EOF'
feat: add Paraglide strings for filler public entry

EOF
)"
```

---

### Task 2: Query keys + invite/org queryOptions

**Files:**
- Create: `tanstack-app/src/query/fillerKeys.ts`
- Create: `tanstack-app/src/query/fillerQueries.ts`
- Create: `tanstack-app/src/query/fillerKeys.test.ts`

**Interfaces:**
- Produces:
  - `fillerKeys.invite(token)`, `fillerKeys.orgUnits()`
  - `inviteByTokenQuery(token)`, `fillerOrgUnitsQuery()`

- [ ] **Step 1: Failing key test**

```ts
import { describe, expect, it } from 'vitest'
import { fillerKeys } from './fillerKeys'

describe('fillerKeys', () => {
  it('nests invite under filler', () => {
    expect(fillerKeys.invite('public')[0]).toBe('filler')
    expect(fillerKeys.invite('public')).toEqual(['filler', 'invite', 'public'])
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm exec vitest run src/query/fillerKeys.test.ts
```

- [ ] **Step 3: Implement**

`fillerKeys.ts`:

```ts
export const fillerKeys = {
  all: ['filler'] as const,
  invite: (token: string) => [...fillerKeys.all, 'invite', token] as const,
  orgUnits: () => [...fillerKeys.all, 'orgUnits'] as const,
}
```

`fillerQueries.ts`:

```ts
import { queryOptions } from '@tanstack/react-query'
import { getInviteByToken } from '#/use-cases/getInviteByToken'
import { listOrgUnits } from '#/repositories/orgUnitRepo'
import { fillerKeys } from './fillerKeys'

export function inviteByTokenQuery(token: string) {
  return queryOptions({
    queryKey: fillerKeys.invite(token),
    queryFn: () => getInviteByToken(token),
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export function fillerOrgUnitsQuery() {
  return queryOptions({
    queryKey: fillerKeys.orgUnits(),
    queryFn: listOrgUnits,
    staleTime: 5 * 60_000,
  })
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/query/fillerKeys.ts tanstack-app/src/query/fillerKeys.test.ts tanstack-app/src/query/fillerQueries.ts
git commit -m "$(cat <<'EOF'
feat: add filler invite and orgUnits queryOptions

EOF
)"
```

---

### Task 3: `FillerPageFrame` + type chooser

**Files:**
- Create: `tanstack-app/src/components/filler/FillerPageFrame.tsx`
- Create: `tanstack-app/src/components/filler/FillerTypeChooser.tsx`
- Create: `tanstack-app/src/components/filler/FillerTypeChooser.test.tsx`

**Interfaces:**
- `FillerPageFrame({ children, title?, helper? })`
- `FillerTypeChooser({ onSelect: (formType: FormType) => void })`

- [ ] **Step 1: Failing test — three choices call onSelect**

```tsx
import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeAll } from 'vitest'
import { m } from '#/paraglide/messages'
import { theme } from '../../theme'
import { FillerTypeChooser } from './FillerTypeChooser'

beforeAll(() => {
  class RO { observe(){} unobserve(){} disconnect(){} }
  globalThis.ResizeObserver = RO as unknown as typeof ResizeObserver
})

describe('FillerTypeChooser', () => {
  it('offers tang, ni, temple and calls onSelect', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <MantineProvider theme={theme}>
        <FillerTypeChooser onSelect={onSelect} />
      </MantineProvider>,
    )
    expect(screen.getByRole('button', { name: m.filler_type_tang() })).toBeTruthy()
    expect(screen.getByRole('button', { name: m.filler_type_ni() })).toBeTruthy()
    expect(screen.getByRole('button', { name: m.filler_type_temple() })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: m.filler_type_tang() }))
    expect(onSelect).toHaveBeenCalledWith('member_tang')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement frame + chooser**

`FillerPageFrame`: `Container`/`Box` with `maw={760}`, `mx="auto"`, `px="md"`, `py="lg"`, background inherits parchment; optional `Title` (display font via theme) + dimmed helper `Text`.

`FillerTypeChooser`: `Stack` gap; title/helper from messages; `SimpleGrid` `cols={{ base: 1, sm: 3 }}`; each option is `UnstyledButton` or `Button` full width, minHeight 48, bordered (`var(--line)`), label from messages. Map:

- tang → `member_tang`
- ni → `member_ni`
- temple → `temple`

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/filler/
git commit -m "$(cat <<'EOF'
feat: add filler page frame and type chooser

EOF
)"
```

---

### Task 4: Org picker + identity gate components

**Files:**
- Create: `tanstack-app/src/components/filler/FillerOrgPicker.tsx`
- Create: `tanstack-app/src/components/filler/FillerOrgPicker.test.tsx`
- Create: `tanstack-app/src/components/filler/FillerIdentityGate.tsx`
- Create: `tanstack-app/src/components/filler/FillerIdentityGate.test.tsx`
- Create: `tanstack-app/src/components/filler/filterOrgUnitsForFormType.ts`
- Create: `tanstack-app/src/components/filler/filterOrgUnitsForFormType.test.ts`

**Interfaces:**
- `filterOrgUnitsForFormType(units: OrgUnit[], formType: FormType): OrgUnit[]`
  - `member_tang` → `allowsTang`
  - `member_ni` → `allowsNi`
  - `temple` → all units (no filter beyond seeded list)
- `FillerOrgPicker({ formType, orgUnits, value, onChange, onBack, onContinue })`
- `FillerIdentityGate` props:
  - member: `{ mode: 'member'; sanghaType, cccd, onCccdChange, onSubmit, onBack, error?, pending? }`
  - temple: `{ mode: 'temple'; phone, onPhoneChange, onSubmit, onBack, matches?, onPickTemple?, onCreateNew?, error?, pending? }`

- [ ] **Step 1: Failing filter + org picker tests**

```ts
import { describe, expect, it } from 'vitest'
import { filterOrgUnitsForFormType } from './filterOrgUnitsForFormType'
import type { OrgUnit } from '#/domain/types'

const units: OrgUnit[] = [
  { id: 'gd-i', code: 'gd-i', name: 'GD I', kind: 'giao_doan', order: 1, allowsTang: true, allowsNi: false },
  { id: 'ni', code: 'ni', name: 'Ni giới', kind: 'ni_gioi', order: 2, allowsTang: false, allowsNi: true },
]

describe('filterOrgUnitsForFormType', () => {
  it('filters tang and ni; temple keeps all', () => {
    expect(filterOrgUnitsForFormType(units, 'member_tang').map((u) => u.id)).toEqual(['gd-i'])
    expect(filterOrgUnitsForFormType(units, 'member_ni').map((u) => u.id)).toEqual(['ni'])
    expect(filterOrgUnitsForFormType(units, 'temple')).toHaveLength(2)
  })
})
```

Identity gate test: render member mode, type CCCD, click continue → `onSubmit` called; show `filler_identity_not_found` when `error` prop set.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement filter, org picker, identity gate**

Org picker: Mantine `Select` with filtered data; Continue disabled until value set; Back button.

Identity gate: `TextInput` + Continue; for temple with `matches.length > 0`, list buttons showing `danhHieu` or id + “Tạo tịnh xá mới”.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/filler/
git commit -m "$(cat <<'EOF'
feat: add filler org picker and identity gate UI

EOF
)"
```

---

### Task 5: Editor shell placeholder

**Files:**
- Create: `tanstack-app/src/components/filler/FillerEditorShell.tsx`
- Create: `tanstack-app/src/components/filler/FillerEditorShell.test.tsx`

**Interfaces:**
- `FillerEditorShell({ title: string; status: 'draft' | 'view'; children? })`
- Sticky top `Group`: title `Text` fw 600, status `Badge`/`Text` (`filler_status_draft` / `filler_status_view`); **no Save button** in this slice
- Body default: `m.filler_editor_placeholder()`

- [ ] **Step 1–4: TDD implement as above**

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add filler editor shell placeholder chrome

EOF
)"
```

---

### Task 6: Routes layout + entry flow wiring

**Files:**
- Create: `tanstack-app/src/routes/f.$token.tsx`
- Create: `tanstack-app/src/routes/f.$token.index.tsx`
- Create: `tanstack-app/src/routes/f.$token.org.tsx`
- Create: `tanstack-app/src/routes/f.$token.identity.tsx`
- Modify: `tanstack-app/src/routes/__root.tsx` (hide header on `/f`)
- Regenerates: `tanstack-app/src/routeTree.gen.ts` via `pnpm run generate-routes`

**Interfaces:**
- Layout uses `inviteByTokenQuery(token)`; loading → `Loader`; error `INVITE_NOT_FOUND` → invalid invite messages
- Index navigates to `/f/$token/org` with `search: { formType }`
- Org validates `formType` in search; loads `fillerOrgUnitsQuery`; navigates to identity with `formType` + `orgUnitId`
- Identity:
  - member: call `resumeMemberByCccd`; on success → `/f/$token/edit/member/$memberId`; on `NOT_FOUND` → offer create → `/f/$token/edit/member` with search `{ orgUnitId, sanghaType, cccd }`
  - temple: call `resumeTemplesByPhone`; if empty → create new route; if one → that temple; if many → pick list then navigate

Search validation: use route `validateSearch` returning typed objects; invalid `formType` → redirect to index.

Map `formType` → `sanghaType`: `member_tang`→`tang`, `member_ni`→`ni`.

- [ ] **Step 1: Add routes + `generate-routes`**

```bash
cd tanstack-app && pnpm run generate-routes
```

Layout sketch:

```tsx
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { Center, Loader, Stack, Text, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { m } from '#/paraglide/messages'
import { inviteByTokenQuery } from '#/query/fillerQueries'
import { FillerPageFrame } from '#/components/filler/FillerPageFrame'
import { isDomainError } from '#/domain/errors'

export const Route = createFileRoute('/f/$token')({
  component: FillerLayout,
})

function FillerLayout() {
  const { token } = Route.useParams()
  const invite = useQuery(inviteByTokenQuery(token))
  if (invite.isPending) {
    return (
      <Center p="xl">
        <Loader aria-label="loading" />
      </Center>
    )
  }
  if (invite.isError) {
    return (
      <FillerPageFrame>
        <Title order={2}>{m.filler_invite_invalid_title()}</Title>
        <Text>{m.filler_invite_invalid_body()}</Text>
      </FillerPageFrame>
    )
  }
  return (
    <FillerPageFrame>
      <Outlet />
    </FillerPageFrame>
  )
}
```

`__root.tsx`: treat filler like admin for header:

```ts
  const hideAppHeader = useRouterState({
    select: (s) =>
      s.location.pathname.startsWith('/admin') ||
      s.location.pathname.startsWith('/f/'),
  })
  // ...
  {!hideAppHeader ? <AppHeader /> : null}
```

- [ ] **Step 2: Wire index/org/identity pages** using components from Tasks 3–4 and `useNavigate` / `Link`.

Org route `validateSearch`:

```ts
function parseFormType(raw: unknown): FormType | undefined {
  if (raw === 'temple' || raw === 'member_tang' || raw === 'member_ni') return raw
  return undefined
}
```

If missing, `<Navigate to="/f/$token" />` (use params).

- [ ] **Step 3: Component tests for layout invalid invite** (mock `inviteByTokenQuery` / useQuery) optional but preferred: at least one route-level test file `f.$token.test.tsx` or test layout component extracted as `FillerInviteGate`.

Prefer extract `FillerInviteGate` if route testing is awkward — keep route files thin.

- [ ] **Step 4: Commit**

```bash
git add tanstack-app/src/routes tanstack-app/src/components/filler tanstack-app/src/routeTree.gen.ts
git commit -m "$(cat <<'EOF'
feat: add /f/$token layout and entry step routes

EOF
)"
```

---

### Task 7: Editor placeholder routes

**Files:**
- Create: `tanstack-app/src/routes/f.$token.edit.member.tsx`
- Create: `tanstack-app/src/routes/f.$token.edit.member.$memberId.tsx`
- Create: `tanstack-app/src/routes/f.$token.edit.temple.tsx`
- Create: `tanstack-app/src/routes/f.$token.edit.temple.$templeId.tsx`
- Regenerates: `routeTree.gen.ts`

**Interfaces:**
- Each renders `FillerEditorShell` with appropriate title + status `draft` (new) or load status from repo getById when id present (`draft`→draft, `locked`→view)
- For `$memberId` / `$templeId`: `useQuery` with `memberRepo.getById` / `templeRepo.getById` (add thin queryOptions in `fillerQueries.ts` if needed)
- New routes: require search params; if missing → redirect to `/f/$token`

- [ ] **Step 1–3: Implement + generate-routes + Vitest for shell titles**

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add filler editor placeholder routes for member and temple

EOF
)"
```

---

### Task 8: Cypress smoke + final verification

**Files:**
- Create: `tanstack-app/cypress/e2e/filler.cy.ts` (optional thin)

- [ ] **Step 1: Cypress**

```ts
describe('Filler public path', () => {
  it('shows invalid invite UI for unknown token', () => {
    cy.visit('/f/token-does-not-exist-xyz')
    cy.contains('Liên kết không hợp lệ').should('be.visible')
  })
})
```

Note: requires Firebase client configured in Cypress env; if visit hangs without Firebase, skip Cypress and rely on Vitest — document in report.

- [ ] **Step 2: Full unit suite**

```bash
cd tanstack-app && pnpm test
```

Expected: PASS

- [ ] **Step 3: Commit only if fixes needed**

---

## Spec coverage (self-review)

| Spec (slice 2) | Task |
| --- | --- |
| `/f/$token` validate invite | 6 |
| Type chooser Tăng/Ni/Tịnh xá | 3, 6 |
| Giáo đoàn filtered | 4, 6 |
| Identity CCCD / phone + resume/create navigation | 4, 6, 7 |
| Shell sticky bar + placeholder (no full fields) | 5, 7 |
| Mobile/desktop type layout | 3 |
| Hide marketing/admin chrome on filler | 6 (`AppHeader`) |
| No server fns / no full forms | Global constraint |

## Out of scope (later slices)

- Full paper field sections + Save
- `createServerFn` wiring
- Photo upload
- Invite ensure from public (admin header already creates)

## Type consistency

- `FormType` = `'temple' | 'member_tang' | 'member_ni'`
- Search `formType` always `FormType`
- Member routes use `SanghaType` `'tang' | 'ni'`
- Resume APIs: `resumeMemberByCccd`, `resumeTemplesByPhone` unchanged signatures
