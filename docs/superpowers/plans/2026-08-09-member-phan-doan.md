# Member Phân đoàn (Ni giới) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require a **Phân đoàn** select (`Phân đoàn 1`–`4`) on member forms whenever the chosen org unit is `kind === 'ni_gioi'`, and persist it on the member document.

**Architecture:** Add optional `Member.phanDoan` (exact Vietnamese labels). Shared `MemberFormFields` takes `orgUnitId`, resolves kind via existing org-units query, shows a Mantine `Select` when `ni_gioi`, and clears the draft value when the org leaves `ni_gioi`. Extend `validateMemberRequiredFields` with `orgUnitKind` + `phanDoan`; call sites (filler save, admin complete) pass both. No new repo APIs — field rides `MemberProfilePatch`.

**Tech Stack:** TypeScript, Mantine Select, TanStack Query, Paraglide (`messages/vi.json`), Vitest

**Spec:** `docs/superpowers/specs/2026-08-09-member-phan-doan-design.md`

## Global Constraints

- Before implementing: checkout `main`, pull if needed, create branch `feat/member-phan-doan` (workspace rule — **no** git worktrees)
- Stored values must be exactly `"Phân đoàn 1"` | `"Phân đoàn 2"` | `"Phân đoàn 3"` | `"Phân đoàn 4"`
- Show when `OrgUnit.kind === 'ni_gioi'` (includes `ni-gioi` Hệ phái)
- Required whenever visible; block filler **Lưu** and admin **Hoàn thành** (there is no separate admin Lưu nháp button — both write paths go through `validateMemberRequiredFields`)
- Prefer Vitest; no new Cypress
- Do not change temple `phanDoan` behavior

## File Structure

| File | Responsibility |
| --- | --- |
| `tanstack-app/src/domain/phanDoan.ts` | `PHAN_DOAN_VALUES`, type guard / option helpers |
| `tanstack-app/src/domain/phanDoan.test.ts` | Cover four labels + guard |
| `tanstack-app/src/domain/types.ts` | `Member.phanDoan?: string` |
| `tanstack-app/messages/vi.json` | `filler_field_phan_doan` |
| `tanstack-app/src/components/filler/memberDraft.ts` | Draft field + `buildMemberPatch` |
| `tanstack-app/src/components/filler/memberDraft.test.ts` | Round-trip / omit empty |
| `tanstack-app/src/components/filler/memberRequiredValidation.ts` | Require when `orgUnitKind === 'ni_gioi'` |
| `tanstack-app/src/components/filler/memberRequiredValidation.test.ts` | Validation cases |
| `tanstack-app/src/components/filler/MemberFormFields.tsx` | `orgUnitId` prop, conditional Select, clear on kind change |
| `tanstack-app/src/components/filler/MemberFormFields.test.tsx` | Visible / hidden / clear |
| `tanstack-app/src/components/filler/MemberEditorForm.tsx` | Pass `orgUnitId` + validation fields |
| `tanstack-app/src/components/admin/MemberFormPage.tsx` | Pass `orgUnitId` + validation fields |
| `tanstack-app/src/components/admin/MemberFormPage.test.tsx` / `MemberEditorForm.test.tsx` | Smoke: field shown for ni org + complete wiring |

---

### Task 1: Domain constants + `Member.phanDoan` + i18n

**Files:**
- Create: `tanstack-app/src/domain/phanDoan.ts`
- Create: `tanstack-app/src/domain/phanDoan.test.ts`
- Modify: `tanstack-app/src/domain/types.ts` (on `Member`, after `phapDanh` or near other optional profile strings)
- Modify: `tanstack-app/messages/vi.json`

**Interfaces:**
- Produces: `export const PHAN_DOAN_VALUES`, `export type PhanDoanValue`, `export function isPhanDoanValue(value: string): value is PhanDoanValue`, `export function phanDoanSelectData(): { value: string; label: string }[]`
- Produces: `Member.phanDoan?: string` (Temple.phanDoan unchanged)
- Produces: message key `filler_field_phan_doan` → `"Phân đoàn"`

- [ ] **Step 1: Write the failing test**

```ts
// tanstack-app/src/domain/phanDoan.test.ts
import { describe, expect, it } from 'vitest'
import { isPhanDoanValue, PHAN_DOAN_VALUES, phanDoanSelectData } from './phanDoan'

describe('PHAN_DOAN_VALUES', () => {
  it('has exactly four Vietnamese labels', () => {
    expect([...PHAN_DOAN_VALUES]).toEqual([
      'Phân đoàn 1',
      'Phân đoàn 2',
      'Phân đoàn 3',
      'Phân đoàn 4',
    ])
  })

  it('guards allowed values only', () => {
    expect(isPhanDoanValue('Phân đoàn 2')).toBe(true)
    expect(isPhanDoanValue('2')).toBe(false)
    expect(isPhanDoanValue('')).toBe(false)
  })

  it('select data uses label as value', () => {
    expect(phanDoanSelectData()).toEqual([
      { value: 'Phân đoàn 1', label: 'Phân đoàn 1' },
      { value: 'Phân đoàn 2', label: 'Phân đoàn 2' },
      { value: 'Phân đoàn 3', label: 'Phân đoàn 3' },
      { value: 'Phân đoàn 4', label: 'Phân đoàn 4' },
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/domain/phanDoan.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Minimal implementation**

```ts
// tanstack-app/src/domain/phanDoan.ts
export const PHAN_DOAN_VALUES = [
  'Phân đoàn 1',
  'Phân đoàn 2',
  'Phân đoàn 3',
  'Phân đoàn 4',
] as const

export type PhanDoanValue = (typeof PHAN_DOAN_VALUES)[number]

export function isPhanDoanValue(value: string): value is PhanDoanValue {
  return (PHAN_DOAN_VALUES as readonly string[]).includes(value)
}

export function phanDoanSelectData(): Array<{ value: string; label: string }> {
  return PHAN_DOAN_VALUES.map((value) => ({ value, label: value }))
}
```

On `Member` in `types.ts`, add:

```ts
phanDoan?: string
```

In `messages/vi.json`, next to other `filler_field_*` keys (e.g. after `filler_field_danh_hieu`):

```json
"filler_field_phan_doan": "Phân đoàn",
```

Run Paraglide compile so `m.filler_field_phan_doan` exists:

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm run paraglide
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/domain/phanDoan.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/domain/phanDoan.ts tanstack-app/src/domain/phanDoan.test.ts tanstack-app/src/domain/types.ts tanstack-app/messages/vi.json
git commit -m "$(cat <<'EOF'
feat: add member Phân đoàn domain values and i18n

EOF
)"
```

---

### Task 2: `MemberDraft` + `buildMemberPatch`

**Files:**
- Modify: `tanstack-app/src/components/filler/memberDraft.ts`
- Create: `tanstack-app/src/components/filler/memberDraft.test.ts`

**Interfaces:**
- Consumes: `Member.phanDoan?: string`
- Produces: `MemberDraft.phanDoan: string`; `emptyMemberDraft` hydrates; `buildMemberPatch` includes `phanDoan: textOrUndefined(draft.phanDoan)`

- [ ] **Step 1: Write the failing test**

```ts
// tanstack-app/src/components/filler/memberDraft.test.ts
import { describe, expect, it } from 'vitest'
import { buildMemberPatch, emptyMemberDraft } from './memberDraft'

describe('memberDraft phanDoan', () => {
  it('hydrates from member and patches non-empty value', () => {
    const draft = emptyMemberDraft({ phanDoan: 'Phân đoàn 3' })
    expect(draft.phanDoan).toBe('Phân đoàn 3')
    expect(buildMemberPatch(draft).phanDoan).toBe('Phân đoàn 3')
  })

  it('omits empty phanDoan from patch', () => {
    const draft = emptyMemberDraft()
    expect(draft.phanDoan).toBe('')
    expect(buildMemberPatch(draft).phanDoan).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/components/filler/memberDraft.test.ts
```

Expected: FAIL — `phanDoan` missing on draft / patch.

- [ ] **Step 3: Minimal implementation**

In `MemberDraft` type, add `phanDoan: string`.

In `emptyMemberDraft`:

```ts
phanDoan: initial.phanDoan ?? '',
```

In `buildMemberPatch` return object (near other simple strings):

```ts
phanDoan: textOrUndefined(draft.phanDoan),
```

- [ ] **Step 4: Run test to verify it passes**

Same command as Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/filler/memberDraft.ts tanstack-app/src/components/filler/memberDraft.test.ts
git commit -m "$(cat <<'EOF'
feat: include phanDoan in member draft and patch

EOF
)"
```

---

### Task 3: Required validation when org is `ni_gioi`

**Files:**
- Modify: `tanstack-app/src/components/filler/memberRequiredValidation.ts`
- Modify: `tanstack-app/src/components/filler/memberRequiredValidation.test.ts`

**Interfaces:**
- Consumes: `isPhanDoanValue` from `#/domain/phanDoan`; `OrgUnitKind` from `#/domain/types`
- Produces: `MemberRequiredDraft` gains `orgUnitKind: OrgUnitKind | null` and `phanDoan: string`; `MemberRequiredFieldErrors` gains `phanDoan?: 'REQUIRED'`; when `orgUnitKind === 'ni_gioi'`, require `isPhanDoanValue(phanDoan)` else no `phanDoan` error

- [ ] **Step 1: Write the failing tests**

Extend `filledDraft` helper to include defaults:

```ts
orgUnitKind: 'giao_doan' as const,
phanDoan: '',
```

Add cases:

```ts
it('requires phanDoan when orgUnitKind is ni_gioi', () => {
  const result = validateMemberRequiredFields(
    filledDraft({ orgUnitKind: 'ni_gioi', phanDoan: '' }),
  )
  expect(result.valid).toBe(false)
  expect(result.errors.phanDoan).toBe('REQUIRED')
})

it('accepts allowed phanDoan for ni_gioi', () => {
  const result = validateMemberRequiredFields(
    filledDraft({ orgUnitKind: 'ni_gioi', phanDoan: 'Phân đoàn 1' }),
  )
  expect(result.errors.phanDoan).toBeUndefined()
  expect(result.valid).toBe(true)
})

it('rejects unknown phanDoan for ni_gioi', () => {
  const result = validateMemberRequiredFields(
    filledDraft({ orgUnitKind: 'ni_gioi', phanDoan: '2' }),
  )
  expect(result.errors.phanDoan).toBe('REQUIRED')
})

it('does not require phanDoan for giao_doan', () => {
  const result = validateMemberRequiredFields(
    filledDraft({ orgUnitKind: 'giao_doan', phanDoan: '' }),
  )
  expect(result.errors.phanDoan).toBeUndefined()
})
```

Update any existing `validateMemberRequiredFields({...})` object literals in this file that construct a full draft without the helper so they include `orgUnitKind` + `phanDoan` (use `'giao_doan'` and `''`).

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/components/filler/memberRequiredValidation.test.ts
```

Expected: FAIL — types / missing `phanDoan` error logic.

- [ ] **Step 3: Minimal implementation**

```ts
import type { OrgUnitKind } from '#/domain/types'
import { isPhanDoanValue } from '#/domain/phanDoan'

// on MemberRequiredDraft:
orgUnitKind: OrgUnitKind | null
phanDoan: string

// on MemberRequiredFieldErrors:
phanDoan?: 'REQUIRED'

// inside validateMemberRequiredFields, before return:
if (draft.orgUnitKind === 'ni_gioi' && !isPhanDoanValue(draft.phanDoan.trim())) {
  errors.phanDoan = 'REQUIRED'
}
```

- [ ] **Step 4: Run test to verify it passes**

Same command as Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/filler/memberRequiredValidation.ts tanstack-app/src/components/filler/memberRequiredValidation.test.ts
git commit -m "$(cat <<'EOF'
feat: require Phân đoàn for ni giới member saves

EOF
)"
```

---

### Task 4: Conditional Select in `MemberFormFields`

**Files:**
- Modify: `tanstack-app/src/components/filler/MemberFormFields.tsx`
- Create: `tanstack-app/src/components/filler/MemberFormFields.test.tsx`

**Interfaces:**
- Consumes: `orgUnitId: string` prop; `fillerOrgUnitsQuery`; `phanDoanSelectData`; `m.filler_field_phan_doan()`
- Produces: Select visible iff resolved unit `.kind === 'ni_gioi'`; binds `draft.phanDoan`; shows `fieldErrors.phanDoan`; `useEffect` clears `phanDoan` when kind is not `ni_gioi`

- [ ] **Step 1: Write the failing test**

```tsx
// tanstack-app/src/components/filler/MemberFormFields.test.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { m } from '#/paraglide/messages'
import { MemberFormFields } from './MemberFormFields'

vi.mock('#/query/fillerQueries', () => ({
  fillerOrgUnitsQuery: () => ({
    queryKey: ['filler', 'orgUnits'],
    queryFn: async () => [
      {
        id: 'gd-i',
        code: 'gd-i',
        name: 'Giáo đoàn I',
        kind: 'giao_doan',
        order: 1,
        allowsTang: true,
        allowsNi: false,
      },
      {
        id: 'ni-gd-i',
        code: 'ni-gd-i',
        name: 'Ni giới Giáo đoàn I',
        kind: 'ni_gioi',
        order: 7,
        allowsTang: false,
        allowsNi: true,
      },
      {
        id: 'ni-gioi',
        code: 'ni-gioi',
        name: 'Ni giới Hệ phái Khất sĩ',
        kind: 'ni_gioi',
        order: 11,
        allowsTang: false,
        allowsNi: true,
      },
    ],
  }),
}))

function renderFields(orgUnitId: string) {
  const apiRef = { current: null }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MantineProvider>
        <MemberFormFields
          apiRef={apiRef}
          initial={{}}
          cccd="012345678901"
          sanghaType="ni"
          orgUnitId={orgUnitId}
        />
      </MantineProvider>
    </QueryClientProvider>,
  )
}

describe('MemberFormFields phanDoan', () => {
  it('shows Phân đoàn for ni_gioi org units', async () => {
    renderFields('ni-gd-i')
    expect(
      await screen.findByLabelText(m.filler_field_phan_doan()),
    ).toBeTruthy()
  })

  it('shows Phân đoàn for Ni giới Hệ phái', async () => {
    renderFields('ni-gioi')
    expect(
      await screen.findByLabelText(m.filler_field_phan_doan()),
    ).toBeTruthy()
  })

  it('hides Phân đoàn for giao_doan org units', async () => {
    renderFields('gd-i')
    // wait for org query / identity fields
    await screen.findByLabelText(m.filler_field_the_danh())
    expect(screen.queryByLabelText(m.filler_field_phan_doan())).toBeNull()
  })
})
```

Mirror providers/mocks from `MemberEditorForm.test.tsx` if Mantine/Query setup needs extra stubs (portrait upload, etc.). Keep the test focused on label visibility.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/components/filler/MemberFormFields.test.tsx
```

Expected: FAIL — `orgUnitId` prop / field missing.

- [ ] **Step 3: Minimal implementation**

1. Add required prop `orgUnitId: string` to `MemberFormFieldsProps` / destructuring.
2. Resolve:

```ts
const selectedOrgUnit = useMemo(
  () => (orgUnitsQuery.data ?? []).find((unit) => unit.id === orgUnitId),
  [orgUnitsQuery.data, orgUnitId],
)
const showPhanDoan = selectedOrgUnit?.kind === 'ni_gioi'
```

3. Clear when hidden:

```ts
useEffect(() => {
  if (!showPhanDoan) {
    setDraft((current) =>
      current.phanDoan ? { ...current, phanDoan: '' } : current,
    )
  }
}, [showPhanDoan])
```

4. In `identitySection` `SimpleGrid`, **first** controls (or immediately after thế/pháp danh), conditionally render:

```tsx
{showPhanDoan ? (
  <Select
    label={m.filler_field_phan_doan()}
    data={phanDoanSelectData()}
    value={draft.phanDoan || null}
    onChange={(value) => updateDraft('phanDoan', value ?? '')}
    disabled={disabled}
    required
    clearable
    error={mapRequiredError(fieldErrors.phanDoan)}
  />
) : null}
```

Include `showPhanDoan`, `draft.phanDoan`, `fieldErrors.phanDoan` in the `useMemo` dependency list for `identitySection`.

- [ ] **Step 4: Run test to verify it passes**

Same command as Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/filler/MemberFormFields.tsx tanstack-app/src/components/filler/MemberFormFields.test.tsx
git commit -m "$(cat <<'EOF'
feat: show Phân đoàn select for ni giới members

EOF
)"
```

---

### Task 5: Wire filler + admin parents (prop + validation)

**Files:**
- Modify: `tanstack-app/src/components/filler/MemberEditorForm.tsx`
- Modify: `tanstack-app/src/components/admin/MemberFormPage.tsx`
- Modify: `tanstack-app/src/components/filler/MemberEditorForm.test.tsx` (pass `orgUnitId` already present — ensure `MemberFormFields` gets it; fix compile)
- Modify: `tanstack-app/src/components/admin/MemberFormPage.test.tsx` (fix renders with org units including `ni_gioi`; optional assert label when create with `ni-gd-i`)

**Interfaces:**
- Consumes: Task 3 draft shape; Task 4 `orgUnitId` prop
- Produces: Both `validateMemberRequiredFields` call sites pass:

```ts
orgUnitKind:
  orgUnits.find((u) => u.id === orgUnitId)?.kind ?? null,
phanDoan: draft.phanDoan,
```

Filler: use org list already available via query or look up from the same source as entry. Prefer `useQuery(fillerOrgUnitsQuery())` in `MemberEditorForm` (or pass kind if already loaded). Admin: use existing `orgUnits` query data + `orgUnitId` state.

- [ ] **Step 1: Write / extend failing UI wiring test**

In `MemberFormPage.test.tsx`, add (adjust fixture helpers to match file):

```ts
it('shows Phân đoàn when creating under ni giới org unit', async () => {
  // ensure orgUnits mock includes ni-gd-i
  renderPage({ mode: 'create', /* he_phai_admin */ })
  // select org unit ni-gd-i via the Giáo đoàn Select
  // then:
  expect(
    await screen.findByLabelText(m.filler_field_phan_doan()),
  ).toBeTruthy()
})
```

If create-mode org selection in the test harness is awkward, assert on edit mode with `member.orgUnitId = 'ni-gd-i'` instead (org select disabled but `MemberFormFields` still receives `orgUnitId`).

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/components/admin/MemberFormPage.test.tsx src/components/filler/MemberEditorForm.test.tsx
```

Expected: FAIL on missing prop and/or missing validation args / missing label.

- [ ] **Step 3: Minimal implementation**

`MemberEditorForm`: pass `orgUnitId={orgUnitId}` into `MemberFormFields`. In `handleSave` validation object, add `orgUnitKind` (from filler org units query) and `phanDoan: draft.phanDoan`.

`MemberFormPage`: pass `orgUnitId={orgUnitId ?? ''}` (save already requires org). In `complete()` validation object, add:

```ts
orgUnitKind:
  (orgUnits.data ?? []).find((unit) => unit.id === orgUnitId)?.kind ?? null,
phanDoan: draft.phanDoan,
```

Fix TypeScript errors in any other `MemberFormFields` call sites / tests by passing `orgUnitId`.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/components/admin/MemberFormPage.test.tsx src/components/filler/MemberEditorForm.test.tsx src/components/filler/MemberFormFields.test.tsx src/components/filler/memberRequiredValidation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/filler/MemberEditorForm.tsx tanstack-app/src/components/admin/MemberFormPage.tsx tanstack-app/src/components/filler/MemberEditorForm.test.tsx tanstack-app/src/components/admin/MemberFormPage.test.tsx
git commit -m "$(cat <<'EOF'
feat: wire Phân đoàn into admin and filler member saves

EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| `Member.phanDoan` + exact labels | 1 |
| Show for all `ni_gioi` incl. Hệ phái | 4 |
| Hide for `giao_doan` | 4 |
| Required on save | 3, 5 |
| Filler + admin | 5 |
| Clear when leaving `ni_gioi` | 4 |
| Vitest only | all |
| Temple out of scope | — |

**Note:** Spec mentions admin Lưu nháp; current UI only has **Hoàn thành**, which already runs full validation — Task 5 covers that path.
`)