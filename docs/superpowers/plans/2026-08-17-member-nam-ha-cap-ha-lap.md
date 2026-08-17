# Member namHaCapHaLap (Năm hạ cấp hạ lạp) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional `Member.namHaCapHaLap` (Năm hạ cấp hạ lạp): admin-only editable number; on filler/admin save, fill from precept `ngayHePhai` / `ngayXuatGia` priority when empty; export in Excel.

**Architecture:** Pure domain helper `resolveNamHaCapHaLap` picks the first valid year. `buildMemberPatch(draft, { sanghaType })` applies fill-if-empty. `MemberFormFields` gains `showNamHaCapHaLap` (admin only). Excel catalog adds `namHaCapHaLap` beside `haLap`. Existing `haLap` unchanged.

**Tech Stack:** TypeScript, Mantine `NumberInput`, Paraglide (`messages/vi.json`), Vitest

**Spec:** `docs/superpowers/specs/2026-08-17-member-nam-ha-cap-ha-lap-design.md`

## Global Constraints

- Before implementing: checkout `main`, pull if needed, create branch `feat/member-nam-ha-cap-ha-lap` (workspace rule — **no** git worktrees)
- New field `namHaCapHaLap?: number`; do **not** change meaning/visibility of `haLap`
- Auto-fill **only when empty**; never overwrite an existing number
- Phương trượng = year from `ngayHePhai` (not `ngayGh`)
- Tang priority: `gioiTyKheo.ngayHePhai` → `gioiSaDi.ngayHePhai` → `ngayXuatGia`
- Ni priority: `gioiTyKheoNi.ngayHePhai` → `gioiThucXoaMaNa.ngayHePhai` → `gioiSaDiNi.ngayHePhai` → `ngayXuatGia`
- Prefer Vitest; no new Cypress
- No bulk Firestore backfill

## File Structure

| File | Responsibility |
| --- | --- |
| `tanstack-app/src/domain/resolveNamHaCapHaLap.ts` | Year parse + sangha priority resolve |
| `tanstack-app/src/domain/resolveNamHaCapHaLap.test.ts` | Priority / skip / undefined cases |
| `tanstack-app/src/domain/types.ts` | `Member.namHaCapHaLap?: number` |
| `tanstack-app/messages/vi.json` | Label key |
| `tanstack-app/src/components/filler/memberDraft.ts` | Draft field + fill-if-empty in `buildMemberPatch` |
| `tanstack-app/src/components/filler/memberDraft.test.ts` | Auto vs preserve |
| `tanstack-app/src/components/filler/MemberEditorForm.tsx` | Pass `sanghaType` into `buildMemberPatch` |
| `tanstack-app/src/components/admin/MemberFormPage.tsx` | Pass `sanghaType` + `showNamHaCapHaLap` |
| `tanstack-app/src/components/filler/MemberFormFields.tsx` | Admin-only `NumberInput` |
| `tanstack-app/src/domain/memberExcelColumns.ts` | Catalog column |
| `tanstack-app/src/domain/memberExcelColumns.test.ts` | Assert column id / cell |

---

### Task 1: Domain helper + `Member.namHaCapHaLap` + i18n

**Files:**
- Create: `tanstack-app/src/domain/resolveNamHaCapHaLap.ts`
- Create: `tanstack-app/src/domain/resolveNamHaCapHaLap.test.ts`
- Modify: `tanstack-app/src/domain/types.ts` (on `Member`, immediately after `haLap`)
- Modify: `tanstack-app/messages/vi.json` (after `filler_field_ha_lap`)

**Interfaces:**
- Produces:
```ts
import type { PreceptRecord, SanghaType } from './types'

export type ResolveNamHaCapHaLapInput = {
  sanghaType: SanghaType
  ngayXuatGia?: string
  gioiSaDi?: PreceptRecord
  gioiTyKheo?: PreceptRecord
  gioiSaDiNi?: PreceptRecord
  gioiThucXoaMaNa?: PreceptRecord
  gioiTyKheoNi?: PreceptRecord
}

/** First valid calendar year from Phương trượng (`ngayHePhai`) then xuất gia. */
export function resolveNamHaCapHaLap(
  input: ResolveNamHaCapHaLapInput,
): number | undefined
```
- Produces: `Member.namHaCapHaLap?: number`
- Produces: message key `filler_field_nam_ha_cap_ha_lap` → `"Năm hạ cấp hạ lạp"`

- [ ] **Step 1: Write the failing test**

```ts
// tanstack-app/src/domain/resolveNamHaCapHaLap.test.ts
import { describe, expect, it } from 'vitest'
import { resolveNamHaCapHaLap } from './resolveNamHaCapHaLap'

describe('resolveNamHaCapHaLap', () => {
  it('tang: prefers ty-kheo ngayHePhai over sa-di and xuat gia', () => {
    expect(
      resolveNamHaCapHaLap({
        sanghaType: 'tang',
        gioiTyKheo: { ngayHePhai: '2018-06-15' },
        gioiSaDi: { ngayHePhai: '2010-01-01' },
        ngayXuatGia: '2005-03-01',
      }),
    ).toBe(2018)
  })

  it('tang: falls back to sa-di then xuat gia', () => {
    expect(
      resolveNamHaCapHaLap({
        sanghaType: 'tang',
        gioiSaDi: { ngayHePhai: '2010-01-01' },
        ngayXuatGia: '2005-03-01',
      }),
    ).toBe(2010)
    expect(
      resolveNamHaCapHaLap({
        sanghaType: 'tang',
        ngayXuatGia: '2005-03-01',
      }),
    ).toBe(2005)
  })

  it('tang: ignores ngayGh (GH), only uses ngayHePhai', () => {
    expect(
      resolveNamHaCapHaLap({
        sanghaType: 'tang',
        gioiTyKheo: { ngayGh: '2019-01-01' },
        ngayXuatGia: '2005-03-01',
      }),
    ).toBe(2005)
  })

  it('ni: prefers ty-kheo-ni → thuc-xoa → sa-di-ni → xuat gia', () => {
    expect(
      resolveNamHaCapHaLap({
        sanghaType: 'ni',
        gioiTyKheoNi: { ngayHePhai: '2020-08-20' },
        gioiThucXoaMaNa: { ngayHePhai: '2015-01-01' },
        gioiSaDiNi: { ngayHePhai: '2012-01-01' },
        ngayXuatGia: '2008-01-01',
      }),
    ).toBe(2020)
    expect(
      resolveNamHaCapHaLap({
        sanghaType: 'ni',
        gioiThucXoaMaNa: { ngayHePhai: '2015-01-01' },
        gioiSaDiNi: { ngayHePhai: '2012-01-01' },
        ngayXuatGia: '2008-01-01',
      }),
    ).toBe(2015)
    expect(
      resolveNamHaCapHaLap({
        sanghaType: 'ni',
        gioiSaDiNi: { ngayHePhai: '2012-01-01' },
        ngayXuatGia: '2008-01-01',
      }),
    ).toBe(2012)
  })

  it('skips empty or invalid dates and returns undefined when none', () => {
    expect(
      resolveNamHaCapHaLap({
        sanghaType: 'tang',
        gioiTyKheo: { ngayHePhai: '' },
        gioiSaDi: { ngayHePhai: 'not-a-date' },
      }),
    ).toBeUndefined()
    expect(resolveNamHaCapHaLap({ sanghaType: 'ni' })).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/domain/resolveNamHaCapHaLap.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Minimal implementation**

```ts
// tanstack-app/src/domain/resolveNamHaCapHaLap.ts
import type { PreceptRecord, SanghaType } from './types'

export type ResolveNamHaCapHaLapInput = {
  sanghaType: SanghaType
  ngayXuatGia?: string
  gioiSaDi?: PreceptRecord
  gioiTyKheo?: PreceptRecord
  gioiSaDiNi?: PreceptRecord
  gioiThucXoaMaNa?: PreceptRecord
  gioiTyKheoNi?: PreceptRecord
}

/** Extract YYYY from form date strings like `2018-06-15`. */
export function yearFromDateString(value?: string): number | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  const match = /^(\d{4})/.exec(trimmed)
  if (!match) return undefined
  const year = Number(match[1])
  if (!Number.isFinite(year) || year < 1000 || year > 9999) return undefined
  return year
}

function yearFromHePhai(precept?: PreceptRecord): number | undefined {
  return yearFromDateString(precept?.ngayHePhai)
}

export function resolveNamHaCapHaLap(
  input: ResolveNamHaCapHaLapInput,
): number | undefined {
  const sources =
    input.sanghaType === 'tang'
      ? [
          yearFromHePhai(input.gioiTyKheo),
          yearFromHePhai(input.gioiSaDi),
          yearFromDateString(input.ngayXuatGia),
        ]
      : [
          yearFromHePhai(input.gioiTyKheoNi),
          yearFromHePhai(input.gioiThucXoaMaNa),
          yearFromHePhai(input.gioiSaDiNi),
          yearFromDateString(input.ngayXuatGia),
        ]

  for (const year of sources) {
    if (year != null) return year
  }
  return undefined
}
```

In `types.ts`, after `haLap?: number`:

```ts
  namHaCapHaLap?: number
```

In `messages/vi.json`, after `"filler_field_ha_lap": "Hạ lạp",`:

```json
  "filler_field_nam_ha_cap_ha_lap": "Năm hạ cấp hạ lạp",
```

Then compile messages:

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm run paraglide
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/domain/resolveNamHaCapHaLap.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/domain/resolveNamHaCapHaLap.ts \
  tanstack-app/src/domain/resolveNamHaCapHaLap.test.ts \
  tanstack-app/src/domain/types.ts \
  tanstack-app/messages/vi.json \
  tanstack-app/src/paraglide
git commit -m "$(cat <<'EOF'
Add namHaCapHaLap field type and year resolve helper.

EOF
)"
```

---

### Task 2: Draft + `buildMemberPatch` fill-if-empty + call sites

**Files:**
- Modify: `tanstack-app/src/components/filler/memberDraft.ts`
- Modify: `tanstack-app/src/components/filler/memberDraft.test.ts`
- Modify: `tanstack-app/src/components/filler/MemberEditorForm.tsx` (line that calls `buildMemberPatch(draft)`)
- Modify: `tanstack-app/src/components/admin/MemberFormPage.tsx` (both `buildMemberPatch(draft)` calls in `performSave`)

**Interfaces:**
- Consumes: `resolveNamHaCapHaLap`, `SanghaType`
- Produces:
```ts
export type BuildMemberPatchOptions = {
  sanghaType: SanghaType
}

export function buildMemberPatch(
  draft: MemberDraft,
  options: BuildMemberPatchOptions,
): MemberProfilePatch
```
- `MemberDraft.namHaCapHaLap: NumericValue` (same as `haLap`)

- [ ] **Step 1: Write the failing tests**

Replace/extend `memberDraft.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildMemberPatch, emptyMemberDraft } from './memberDraft'

describe('memberDraft phanDoan', () => {
  it('hydrates from member and patches non-empty value', () => {
    const draft = emptyMemberDraft({ phanDoan: 'Phân đoàn 3' })
    expect(draft.phanDoan).toBe('Phân đoàn 3')
    expect(buildMemberPatch(draft, { sanghaType: 'tang' }).phanDoan).toBe(
      'Phân đoàn 3',
    )
  })

  it('omits empty phanDoan from patch', () => {
    const draft = emptyMemberDraft()
    expect(draft.phanDoan).toBe('')
    expect(
      buildMemberPatch(draft, { sanghaType: 'tang' }).phanDoan,
    ).toBeUndefined()
  })
})

describe('memberDraft namHaCapHaLap', () => {
  it('auto-fills from ty-kheo ngayHePhai when empty (tang)', () => {
    const draft = emptyMemberDraft({
      gioiTyKheo: { ngayHePhai: '2018-06-15' },
      ngayXuatGia: '2005-03-01',
    })
    expect(draft.namHaCapHaLap).toBe('')
    expect(
      buildMemberPatch(draft, { sanghaType: 'tang' }).namHaCapHaLap,
    ).toBe(2018)
  })

  it('preserves existing namHaCapHaLap and does not overwrite', () => {
    const draft = emptyMemberDraft({
      namHaCapHaLap: 1999,
      gioiTyKheo: { ngayHePhai: '2018-06-15' },
    })
    expect(
      buildMemberPatch(draft, { sanghaType: 'tang' }).namHaCapHaLap,
    ).toBe(1999)
  })

  it('omits when empty and no source years', () => {
    const draft = emptyMemberDraft()
    expect(
      buildMemberPatch(draft, { sanghaType: 'ni' }).namHaCapHaLap,
    ).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/components/filler/memberDraft.test.ts
```

Expected: FAIL — `sanghaType` / `namHaCapHaLap` not wired yet (type or assertion errors).

- [ ] **Step 3: Minimal implementation**

In `MemberDraft`, after `haLap`:

```ts
  namHaCapHaLap: NumericValue
```

In `emptyMemberDraft`, after `haLap: numberOrBlank(initial.haLap),`:

```ts
    namHaCapHaLap: numberOrBlank(initial.namHaCapHaLap),
```

Change signature and end of `buildMemberPatch`:

```ts
import type { Member, MemberProfilePatch, SanghaType } from '#/domain/types'
import { resolveNamHaCapHaLap } from '#/domain/resolveNamHaCapHaLap'

export type BuildMemberPatchOptions = {
  sanghaType: SanghaType
}

export function buildMemberPatch(
  draft: MemberDraft,
  options: BuildMemberPatchOptions,
): MemberProfilePatch {
  const fromDraft = numberOrUndefined(draft.namHaCapHaLap)
  const namHaCapHaLap =
    fromDraft ??
    resolveNamHaCapHaLap({
      sanghaType: options.sanghaType,
      ngayXuatGia: draft.ngayXuatGia,
      gioiSaDi: draft.gioiSaDi,
      gioiTyKheo: draft.gioiTyKheo,
      gioiSaDiNi: draft.gioiSaDiNi,
      gioiThucXoaMaNa: draft.gioiThucXoaMaNa,
      gioiTyKheoNi: draft.gioiTyKheoNi,
    })

  return {
    // ...existing fields...
    haLap: numberOrUndefined(draft.haLap),
    namHaCapHaLap,
    // ...rest unchanged...
  }
}
```

Update call sites:

```ts
// MemberEditorForm.tsx — sanghaType is already in scope on the component
const patch = buildMemberPatch(draft, { sanghaType })

// MemberFormPage.tsx — both branches
patch: buildMemberPatch(draft, { sanghaType: effectiveSanghaType }),
```

Fix any other compile errors from the new required second argument (search `buildMemberPatch(`).

- [ ] **Step 4: Run tests**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/components/filler/memberDraft.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/filler/memberDraft.ts \
  tanstack-app/src/components/filler/memberDraft.test.ts \
  tanstack-app/src/components/filler/MemberEditorForm.tsx \
  tanstack-app/src/components/admin/MemberFormPage.tsx
git commit -m "$(cat <<'EOF'
Fill namHaCapHaLap on member patch when empty.

EOF
)"
```

---

### Task 3: Admin-only form field

**Files:**
- Modify: `tanstack-app/src/components/filler/MemberFormFields.tsx`
- Modify: `tanstack-app/src/components/admin/MemberFormPage.tsx`
- Modify: `tanstack-app/src/components/filler/MemberFormFields.test.tsx` (add visibility cases if the file already mounts the form cheaply; otherwise skip and rely on draft tests)

**Interfaces:**
- Consumes: `m.filler_field_nam_ha_cap_ha_lap()`, draft `namHaCapHaLap`
- Produces: prop `showNamHaCapHaLap?: boolean` (default `false`)

- [ ] **Step 1: Add prop + NumberInput (TDD optional if no cheap mount harness)**

If `MemberFormFields.test.tsx` already has a mount helper, add:

```ts
it('shows Năm hạ cấp hạ lạp only when showNamHaCapHaLap', () => {
  // render with showNamHaCapHaLap={false} → queryByLabelText absent
  // render with showNamHaCapHaLap → getByLabelText(m.filler_field_nam_ha_cap_ha_lap())
})
```

Otherwise proceed to implementation without a new component test.

- [ ] **Step 2: Implementation**

On `MemberFormFieldsProps`:

```ts
  showNamHaCapHaLap?: boolean
```

Destructure with default `showNamHaCapHaLap = false`.

Immediately after the Hạ lạp `NumberInput` (same `SimpleGrid`), when `showNamHaCapHaLap`:

```tsx
{showNamHaCapHaLap ? (
  <NumberInput
    label={m.filler_field_nam_ha_cap_ha_lap()}
    placeholder={m.filler_ph_number()}
    value={draft.namHaCapHaLap}
    onChange={(value) =>
      updateDraft('namHaCapHaLap', numberInputValue(value))
    }
    disabled={disabled}
    min={0}
  />
) : null}
```

Add `draft.namHaCapHaLap` and `showNamHaCapHaLap` to the memo dependency array that already lists `draft.haLap`.

In `MemberFormPage.tsx` on `<MemberFormFields ...>`:

```tsx
showNamHaCapHaLap
```

Do **not** pass the prop from `MemberEditorForm` (filler stays hidden).

- [ ] **Step 3: Run relevant tests**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm run paraglide && pnpm exec vitest run src/components/filler/MemberFormFields.test.tsx src/components/filler/memberDraft.test.ts
```

Expected: PASS (or FormFields suite unchanged if no new test).

- [ ] **Step 4: Commit**

```bash
git add tanstack-app/src/components/filler/MemberFormFields.tsx \
  tanstack-app/src/components/admin/MemberFormPage.tsx \
  tanstack-app/src/components/filler/MemberFormFields.test.tsx
git commit -m "$(cat <<'EOF'
Show namHaCapHaLap number input on admin member form.

EOF
)"
```

---

### Task 4: Excel column

**Files:**
- Modify: `tanstack-app/src/domain/memberExcelColumns.ts` (after `haLap` column ~line 235)
- Modify: `tanstack-app/src/domain/memberExcelColumns.test.ts`

**Interfaces:**
- Produces: column `id: 'namHaCapHaLap'`, `group: 'ordination'`

- [ ] **Step 1: Write the failing test**

In `memberExcelColumns.test.ts`, inside an existing describe (e.g. `catalogMembersExcelColumns` or `MEMBER_EXCEL_COLUMNS cells`):

```ts
it('includes namHaCapHaLap in catalog for tang and ni', () => {
  expect(catalogMembersExcelColumns('tang').map((c) => c.id)).toContain(
    'namHaCapHaLap',
  )
  expect(catalogMembersExcelColumns('ni').map((c) => c.id)).toContain(
    'namHaCapHaLap',
  )
})

it('renders namHaCapHaLap cell', () => {
  const col = MEMBER_EXCEL_COLUMNS.find((c) => c.id === 'namHaCapHaLap')
  expect(col).toBeTruthy()
  expect(col!.cell(member({ id: 'm1', sanghaType: 'tang', namHaCapHaLap: 2018 }), ctx)).toBe(
    '2018',
  )
  expect(col!.cell(member({ id: 'm2', sanghaType: 'tang' }), ctx)).toBe('')
})
```

(Reuse the file’s existing `member` / `ctx` helpers; adjust if names differ.)

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/domain/memberExcelColumns.test.ts
```

Expected: FAIL — id not in catalog.

- [ ] **Step 3: Minimal implementation**

After the `haLap` column object in `MEMBER_EXCEL_COLUMNS`:

```ts
  {
    id: 'namHaCapHaLap',
    group: 'ordination',
    header: () => m.filler_field_nam_ha_cap_ha_lap(),
    cell: (member) =>
      member.namHaCapHaLap != null ? String(member.namHaCapHaLap) : '',
  },
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/domain/memberExcelColumns.test.ts
```

Expected: PASS

- [ ] **Step 5: Full related suite + commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run \
  src/domain/resolveNamHaCapHaLap.test.ts \
  src/components/filler/memberDraft.test.ts \
  src/domain/memberExcelColumns.test.ts
```

```bash
git add tanstack-app/src/domain/memberExcelColumns.ts \
  tanstack-app/src/domain/memberExcelColumns.test.ts
git commit -m "$(cat <<'EOF'
Export namHaCapHaLap in members Excel catalog.

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| `Member.namHaCapHaLap?: number` | 1 |
| `resolveNamHaCapHaLap` tang/ni priority, `ngayHePhai` only | 1 |
| Fill-if-empty in patch; pass `sanghaType` | 2 |
| Admin NumberInput; filler hidden | 3 |
| Excel ordination column | 4 |
| No `haLap` change / no backfill / no Cypress | Global constraints |

## Self-review notes

- `buildMemberPatch` second arg is **required** so TypeScript forces every call site to pass `sanghaType`.
- Clearing the admin field then saving re-auto-fills (empty → resolve), matching the approved design.
- Paraglide must be recompiled after editing `messages/vi.json` before UI/tests that call `m.filler_field_nam_ha_cap_ha_lap()`.
