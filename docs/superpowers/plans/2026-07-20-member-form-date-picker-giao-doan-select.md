# Member DateInput + Giáo đoàn Select Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace member calendar date `TextInput`s with Mantine `DateInput`, and make Giáo đoàn gốc a select of existing giáo đoàn org units.

**Architecture:** Add `@mantine/dates` + `dayjs` (customParseFormat once at root). Wire `DateInput` with string `YYYY-MM-DD` values. Load org units via `fillerOrgUnitsQuery`, filter `kind === 'giao_doan'`, persist unit id on `giaoDoanGoc`.

**Tech Stack:** React 19, Mantine 9 `@mantine/dates`, dayjs, TanStack Query, Vitest

**Spec:** `docs/superpowers/specs/2026-07-20-member-form-date-picker-giao-doan-select-design.md`

## Global Constraints

- Continue on branch `feat/member-form-sublabels-placeholders` (no new worktree)
- Calendar dates only — not month/year or year-only fields; not temple dates
- Store dates as `yyyy-mm-dd` strings; store `giaoDoanGoc` as org unit **id**
- Prefer Vitest; no new Cypress

## File Structure

| File | Responsibility |
| --- | --- |
| `tanstack-app/package.json` | Add `@mantine/dates`, `dayjs` |
| `tanstack-app/src/routes/__root.tsx` | Dates CSS + dayjs `customParseFormat` |
| `tanstack-app/src/components/filler/MemberEditorForm.tsx` | `DateInput`s + giáo đoàn `Select` + query |
| `tanstack-app/src/components/filler/PreceptFields.tsx` | `DateInput` for `ngayGh` / `ngayHePhai` |
| `tanstack-app/src/components/filler/MemberEditorForm.test.tsx` | Assert date labels + giáo đoàn options |

---

### Task 1: Install dates stack + root setup

**Files:**
- Modify: `tanstack-app/package.json`, lockfile
- Modify: `tanstack-app/src/routes/__root.tsx`

- [ ] **Step 1: Install**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm add @mantine/dates@^9.4.1 dayjs
```

- [ ] **Step 2: Root CSS + dayjs plugin**

In `__root.tsx`, after `@mantine/core/styles.css`:

```tsx
import '@mantine/dates/styles.css'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(customParseFormat)
```

- [ ] **Step 3: Commit**

```bash
git add tanstack-app/package.json tanstack-app/pnpm-lock.yaml tanstack-app/src/routes/__root.tsx
git commit -m "chore: add @mantine/dates and dayjs for DateInput"
```

---

### Task 2: Wire DateInput + giáo đoàn Select (TDD)

**Files:**
- Modify: `MemberEditorForm.test.tsx`, `MemberEditorForm.tsx`, `PreceptFields.tsx`

**Interfaces:**
- Consumes: `fillerOrgUnitsQuery()`, `DateInput` (`value: string | null`, `onChange: (v: string | null) => void`)
- Produces: draft still uses `string` for dates; `giaoDoanGoc` holds org unit id

- [ ] **Step 1: Failing tests**

Mock org units in `MemberEditorForm.test.tsx`:

```tsx
vi.mock('#/query/fillerQueries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#/query/fillerQueries')>()
  return {
    ...actual,
    fillerOrgUnitsQuery: () => ({
      queryKey: ['filler', 'orgUnits'],
      queryFn: async () => [
        {
          id: 'gd-i',
          code: 'gd-i',
          name: 'Giáo đoàn I',
          kind: 'giao_doan' as const,
          order: 1,
          allowsTang: true,
          allowsNi: true,
        },
        {
          id: 'ni-gioi',
          code: 'ni-gioi',
          name: 'Ni giới Hệ phái Khất sĩ',
          kind: 'ni_gioi' as const,
          order: 7,
          allowsTang: false,
          allowsNi: true,
        },
      ],
      staleTime: 0,
    }),
  }
})
```

Add:

```tsx
  it('uses date inputs for calendar dates and giáo đoàn select', async () => {
    renderForm({ sanghaType: 'tang', cccd: '012345678901', memberId: 'm1' })

    expect(screen.getByLabelText(m.filler_field_ngay_sinh())).toBeTruthy()
    expect(screen.getByLabelText(m.filler_field_ngay_xuat_gia())).toBeTruthy()

    const giaoDoan = await screen.findByLabelText(m.filler_field_giao_doan_goc())
    expect(giaoDoan).toBeTruthy()
    // open select — Giáo đoàn I present, Ni giới absent from options list after open
  })
```

- [ ] **Step 2: Run — expect FAIL** (or fail on missing select options)

```bash
pnpm exec vitest run src/components/filler/MemberEditorForm.test.tsx
```

- [ ] **Step 3: Implement `PreceptFields`**

```tsx
import { DateInput } from '@mantine/dates'
// ngayGh / ngayHePhai as DateInput; value={value.ngayGh || null}; onChange={(v) => onChange({...value, ngayGh: v ?? ''})}
// tai* stay TextInput
```

- [ ] **Step 4: Implement `MemberEditorForm`**

- `useQuery(fillerOrgUnitsQuery())`
- `giaoDoanOptions = units.filter(u => u.kind === 'giao_doan').map(u => ({ value: u.id, label: u.name }))`
- Replace date TextInputs with DateInput (`valueFormat="YYYY-MM-DD"`, `clearable`)
- `giaoDoanGoc` → Select with `data={giaoDoanOptions}`, `value={draft.giaoDoanGoc || null}`, `placeholder={m.filler_org_placeholder()}`, keep description
- Helper: `const toDateValue = (s: string) => s || null` / `const fromDateValue = (v: string | null) => v ?? ''`

- [ ] **Step 5: Tests PASS**

```bash
pnpm exec vitest run src/components/filler/MemberEditorForm.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: member DateInput fields and giáo đoàn gốc select"
```

---

## Self-review

| Spec item | Task |
| --- | --- |
| @mantine/dates + CSS + dayjs | 1 |
| Calendar DateInputs listed | 2 |
| Giáo đoàn select by id | 2 |
| Month/year / temple out of scope | not in plan |
| Vitest | 2 |
