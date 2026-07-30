# Retreat Form Date-Only GMT+7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin retreat create/edit forms use date-only inputs; stored times are fixed GMT+7 start/end-of-day ISO strings; labels prefixed with “Ngày”.

**Architecture:** Extract pure GMT+7 date helpers (`isoToGmt7Date`, `gmt7DateToIso`) into a small domain module. Wire `RetreatFormPage` four schedule fields to `type="date"` using those helpers. Update Paraglide Vietnamese labels. Vitest covers helpers and form date display/save.

**Tech Stack:** React, Mantine `TextInput`, Paraglide (`vi.json`), Vitest, existing Firebase ISO string fields (no schema change)

**Spec:** `docs/superpowers/specs/2026-07-30-retreat-date-only-gmt7-design.md`

## Global Constraints

- Work in the current workspace only — **never** `git worktree add`
- Branch: `feat/retreat-date-only-gmt7` from latest `main`
- Timezone is always **GMT+7** (`+07:00`), never the browser local offset
- Start bound → `00:00:00+07:00`; end bound → `23:59:59+07:00`
- Prefer Vitest; **no new Cypress**
- Leave unrelated dirty files (`.serena/project.yml`, `firestore-debug.log`, `quy_trinh_quan_ly_khoa_tu.docx`, `tanstack-app/public/mylogo.svg`) unstaged
- After merge squash into `main`, delete local feature branch unless asked otherwise

## File Structure

| File | Responsibility |
| --- | --- |
| `tanstack-app/src/domain/gmt7Date.ts` | `isoToGmt7Date` / `gmt7DateToIso` pure helpers |
| `tanstack-app/src/domain/gmt7Date.test.ts` | Unit tests for helpers |
| `tanstack-app/src/components/admin/RetreatFormPage.tsx` | Date inputs + wire helpers; remove datetime-local converters |
| `tanstack-app/messages/vi.json` | Prefix four labels with “Ngày” |
| `tanstack-app/src/components/admin/RetreatFormPage.test.tsx` | Assert date values / save normalization |

---

### Task 0: Branch + commit this plan

**Files:**
- Add: `docs/superpowers/plans/2026-07-30-retreat-date-only-gmt7.md`

**Interfaces:**
- Consumes: approved design at `docs/superpowers/specs/2026-07-30-retreat-date-only-gmt7-design.md`
- Produces: plan committed on `feat/retreat-date-only-gmt7`

- [ ] **Step 1: Branch from main**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git checkout main
git pull
git checkout -b feat/retreat-date-only-gmt7
```

If currently not on `main` with unrelated WIP that would block branching, stop and ask (stash/commit vs continue). Do not use worktrees.

- [ ] **Step 2: Commit plan**

```bash
git add docs/superpowers/plans/2026-07-30-retreat-date-only-gmt7.md
git commit -m "$(cat <<'EOF'
docs: plan retreat date-only GMT+7 fields

EOF
)"
```

---

### Task 1: GMT+7 date helpers (TDD)

**Files:**
- Create: `tanstack-app/src/domain/gmt7Date.ts`
- Create: `tanstack-app/src/domain/gmt7Date.test.ts`

**Interfaces:**
- Produces:

```ts
export type Gmt7DayBound = 'start' | 'end'

export function isoToGmt7Date(iso: string): string
export function gmt7DateToIso(date: string, bound: Gmt7DayBound): string
```

- Consumes: none

- [ ] **Step 1: Write the failing test**

Create `tanstack-app/src/domain/gmt7Date.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { gmt7DateToIso, isoToGmt7Date } from './gmt7Date'

describe('gmt7DateToIso', () => {
  it('maps start bound to 00:00:00+07:00 as UTC ISO', () => {
    expect(gmt7DateToIso('2026-08-01', 'start')).toBe(
      '2026-07-31T17:00:00.000Z',
    )
  })

  it('maps end bound to 23:59:59+07:00 as UTC ISO', () => {
    expect(gmt7DateToIso('2026-08-10', 'end')).toBe(
      '2026-08-10T16:59:59.000Z',
    )
  })

  it('returns empty for blank or invalid date', () => {
    expect(gmt7DateToIso('', 'start')).toBe('')
    expect(gmt7DateToIso('not-a-date', 'end')).toBe('')
  })
})

describe('isoToGmt7Date', () => {
  it('formats stored start instant as GMT+7 calendar date', () => {
    expect(isoToGmt7Date('2026-07-31T17:00:00.000Z')).toBe('2026-08-01')
  })

  it('formats stored end instant as GMT+7 calendar date', () => {
    expect(isoToGmt7Date('2026-08-10T16:59:59.000Z')).toBe('2026-08-10')
  })

  it('returns empty for blank or invalid iso', () => {
    expect(isoToGmt7Date('')).toBe('')
    expect(isoToGmt7Date('nope')).toBe('')
  })

  it('round-trips date part for start and end', () => {
    const day = '2026-09-15'
    expect(isoToGmt7Date(gmt7DateToIso(day, 'start'))).toBe(day)
    expect(isoToGmt7Date(gmt7DateToIso(day, 'end'))).toBe(day)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/domain/gmt7Date.test.ts
```

Expected: FAIL (module `./gmt7Date` missing or exports missing)

- [ ] **Step 3: Write minimal implementation**

Create `tanstack-app/src/domain/gmt7Date.ts`:

```ts
export type Gmt7DayBound = 'start' | 'end'

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function isoToGmt7Date(iso: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  // Shift UTC instant into GMT+7 wall clock, then read Y-M-D from UTC getters
  const shifted = new Date(date.getTime() + 7 * 60 * 60 * 1000)
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`
}

export function gmt7DateToIso(date: string, bound: Gmt7DayBound): string {
  if (!DATE_RE.test(date)) return ''
  const time = bound === 'start' ? '00:00:00' : '23:59:59'
  const parsed = new Date(`${date}T${time}+07:00`)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString()
}
```

Do **not** use `getFullYear` / `getMonth` / `getDate` (browser local) when building or reading these walls.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/domain/gmt7Date.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/domain/gmt7Date.ts tanstack-app/src/domain/gmt7Date.test.ts
git commit -m "$(cat <<'EOF'
Add GMT+7 start/end-of-day date helpers.

EOF
)"
```

---

### Task 2: Labels + wire RetreatFormPage

**Files:**
- Modify: `tanstack-app/messages/vi.json` (four label strings)
- Modify: `tanstack-app/src/components/admin/RetreatFormPage.tsx`
- Modify: `tanstack-app/src/components/admin/RetreatFormPage.test.tsx`

**Interfaces:**
- Consumes: `isoToGmt7Date`, `gmt7DateToIso` from `#/domain/gmt7Date`
- Produces: date-only form fields that persist start/end ISO; updated Paraglide messages after `pnpm run paraglide` (via `pnpm test` or explicit paraglide)

- [ ] **Step 1: Update Vietnamese labels**

In `tanstack-app/messages/vi.json`, set:

```json
"admin_retreats_form_thoi_gian_bat_dau": "Ngày bắt đầu khóa tu",
"admin_retreats_form_thoi_gian_ket_thuc": "Ngày kết thúc khóa tu",
"admin_retreats_form_dang_ky_mo_tu": "Ngày mở đăng ký từ",
"admin_retreats_form_dang_ky_dong_luc": "Ngày đóng đăng ký lúc"
```

- [ ] **Step 2: Write failing form assertion for date display + save**

In `tanstack-app/src/components/admin/RetreatFormPage.test.tsx`, update `baseRetreat` times to known GMT+7 examples and add:

```ts
it('shows schedule fields as GMT+7 dates and normalizes on save', async () => {
  const user = userEvent.setup()
  retreatFixture = {
    ...baseRetreat,
    thoiGianBatDau: '2026-07-31T17:00:00.000Z', // 2026-08-01 00:00 +07
    thoiGianKetThuc: '2026-08-10T16:59:59.000Z', // 2026-08-10 23:59:59 +07
    dangKyMoTu: '2026-06-30T17:00:00.000Z', // 2026-07-01 00:00 +07
    dangKyDongLuc: '2026-07-31T16:59:59.000Z', // 2026-07-31 23:59:59 +07
  }
  renderForm({ mode: 'edit' })
  expect(await screen.findByLabelText(m.admin_retreats_form_thoi_gian_bat_dau())).toHaveProperty(
    'value',
    '2026-08-01',
  )
  expect(screen.getByLabelText(m.admin_retreats_form_thoi_gian_ket_thuc())).toHaveProperty(
    'value',
    '2026-08-10',
  )
  expect(screen.getByLabelText(m.admin_retreats_form_dang_ky_mo_tu())).toHaveProperty(
    'value',
    '2026-07-01',
  )
  expect(screen.getByLabelText(m.admin_retreats_form_dang_ky_dong_luc())).toHaveProperty(
    'value',
    '2026-07-31',
  )

  await user.click(screen.getByRole('button', { name: m.admin_retreats_save() }))
  await vi.waitFor(() => expect(updateRetreatMock).toHaveBeenCalled())
  expect(updateRetreatMock).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      fields: expect.objectContaining({
        thoiGianBatDau: '2026-07-31T17:00:00.000Z',
        thoiGianKetThuc: '2026-08-10T16:59:59.000Z',
        dangKyMoTu: '2026-06-30T17:00:00.000Z',
        dangKyDongLuc: '2026-07-31T16:59:59.000Z',
      }),
    }),
  )
})
```

Use `toHaveProperty('value', ...)` or Testing Library’s `expect(...).toHaveValue(...)` if `@testing-library/jest-dom` matchers are available in this project — match existing test style.

- [ ] **Step 3: Run form test to verify new case fails (or labels wrong until paraglide)**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm run paraglide && pnpm exec vitest run src/components/admin/RetreatFormPage.test.tsx
```

Expected: FAIL until form uses date helpers / `type="date"` (e.g. wrong display values from datetime-local converters).

- [ ] **Step 4: Wire RetreatFormPage**

In `tanstack-app/src/components/admin/RetreatFormPage.tsx`:

1. Remove `isoToLocalInput` and `localInputToIso`.
2. Import:

```ts
import { gmt7DateToIso, isoToGmt7Date } from '#/domain/gmt7Date'
```

3. Replace the four schedule `TextInput`s with:

```tsx
<TextInput
  label={m.admin_retreats_form_thoi_gian_bat_dau()}
  type="date"
  value={isoToGmt7Date(fields.thoiGianBatDau)}
  onChange={(event) =>
    updateField(
      'thoiGianBatDau',
      gmt7DateToIso(event.currentTarget.value, 'start'),
    )
  }
  required
/>

<TextInput
  label={m.admin_retreats_form_thoi_gian_ket_thuc()}
  type="date"
  value={isoToGmt7Date(fields.thoiGianKetThuc)}
  onChange={(event) =>
    updateField(
      'thoiGianKetThuc',
      gmt7DateToIso(event.currentTarget.value, 'end'),
    )
  }
  required
/>

<TextInput
  label={m.admin_retreats_form_dang_ky_mo_tu()}
  type="date"
  value={isoToGmt7Date(fields.dangKyMoTu)}
  onChange={(event) =>
    updateField(
      'dangKyMoTu',
      gmt7DateToIso(event.currentTarget.value, 'start'),
    )
  }
  required
/>

<TextInput
  label={m.admin_retreats_form_dang_ky_dong_luc()}
  type="date"
  value={isoToGmt7Date(fields.dangKyDongLuc)}
  onChange={(event) =>
    updateField(
      'dangKyDongLuc',
      gmt7DateToIso(event.currentTarget.value, 'end'),
    )
  }
  required
/>
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm run paraglide && pnpm exec vitest run src/domain/gmt7Date.test.ts src/components/admin/RetreatFormPage.test.tsx
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add \
  tanstack-app/messages/vi.json \
  tanstack-app/src/components/admin/RetreatFormPage.tsx \
  tanstack-app/src/components/admin/RetreatFormPage.test.tsx
git commit -m "$(cat <<'EOF'
Use date-only GMT+7 fields on retreat form.

EOF
)"
```

If paraglide regenerates tracked files under `tanstack-app/src/paraglide/`, include those in the commit only if the repo normally commits them (check `git status`).

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| `type="date"` only | Task 2 |
| start = `00:00:00+07:00` | Task 1 + Task 2 wiring |
| end = `23:59:59+07:00` | Task 1 + Task 2 wiring |
| Create + edit | Task 2 (shared page) |
| Labels “Ngày …” | Task 2 |
| Helpers independent of browser TZ | Task 1 implementation notes |
| Legacy edit shows GMT+7 date; save normalizes | Task 2 test + wiring |
| Unit tests for helpers | Task 1 |
| No bulk migration / no Cypress / no DatePicker | Out of scope — no tasks |

No placeholders remain. Signatures consistent: `Gmt7DayBound`, `isoToGmt7Date`, `gmt7DateToIso`.
