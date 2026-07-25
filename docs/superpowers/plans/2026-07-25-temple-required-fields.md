# Temple Required Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block filler temple **Lưu** until danh hiệu, người khai sơn, năm thành lập, địa chỉ cũ/mới, trụ trì (hiện nay + ≥1 tiền nhiệm pháp danh), and all six tăng số / Phật tử counts are filled — with Mantine `required` and field errors.

**Architecture:** Add `validateTempleRequiredFields` (mirror member helper) returning machine-readable codes. Wire `TempleEditorForm` + section components for `required`/`error`, replace the address-only save gate. Reuse `isBasicEmail` from `memberRequiredValidation.ts`. Existing i18n keys cover required / email / address messages.

**Tech Stack:** React 19, Mantine 9, Paraglide, Vitest + Testing Library, existing `validateAddressDraft`

**Spec:** `docs/superpowers/specs/2026-07-25-temple-required-fields-design.md`

## Global Constraints

- Work in the current workspace only — **never** `git worktree add`
- Create and use branch `feat/temple-required-fields` from latest `main` (see Task 0)
- Scope: filler `TempleEditorForm` only — not admin, not other temple sections
- Addresses cũ/mới: `{ required: true }` (city+ward); line optional
- Trụ trì hiện nay: pháp danh + phone + email (email basic format); tiền nhiệm: ≥1 row with pháp danh; `thoiGian`/`ghiChu` optional
- Six counts: `0` valid; `''` invalid
- Prefer Vitest; **no new Cypress**
- After merge squash into `main`, delete the local feature branch unless asked otherwise

## File Structure

| File | Responsibility |
| --- | --- |
| `tanstack-app/src/components/filler/templeRequiredValidation.ts` | Codes + `validateTempleRequiredFields` |
| `tanstack-app/src/components/filler/templeRequiredValidation.test.ts` | Unit tests for helper |
| `tanstack-app/src/components/filler/TempleEditorForm.tsx` | Field-error state, save gate, pass errors into sections |
| `tanstack-app/src/components/filler/TempleEditorFormSections.tsx` | `required` + `error` props on identity / address / trụ trì / tăng số |
| `tanstack-app/src/components/filler/TempleEditorForm.test.tsx` | Block-empty-save + happy-path seeds |
| `docs/superpowers/plans/2026-07-25-temple-required-fields.md` | This plan |

No new `vi.json` keys unless a reviewer insists on a dedicated tiền-nhiệm-empty message — prefer error on first row’s pháp danh (`filler_error_field_required`). Draft already seeds ≥1 tiền nhiệm row via `withAtLeastOne`.

---

### Task 0: Branch from main

**Files:**
- Add: `docs/superpowers/plans/2026-07-25-temple-required-fields.md` (if not already committed)

**Interfaces:**
- Consumes: `main` with spec commit `docs: temple form required fields design`
- Produces: branch `feat/temple-required-fields`

- [ ] **Step 1: Confirm clean enough state and branch from main**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git status
git checkout main
git pull
git checkout -b feat/temple-required-fields
```

If currently on a non-`main` branch with WIP: stop and ask the user (per plan-execution rule). Leave unrelated untracked files (`main.py`, `.serena/project.yml`) unstaged.

- [ ] **Step 2: Commit this plan on the feature branch (if not already on main)**

```bash
git add docs/superpowers/plans/2026-07-25-temple-required-fields.md
git commit -m "$(cat <<'EOF'
docs: plan for temple required fields

EOF
)"
```

Skip if the plan is already committed.

---

### Task 1: Validation helper + unit tests

**Files:**
- Create: `tanstack-app/src/components/filler/templeRequiredValidation.ts`
- Create: `tanstack-app/src/components/filler/templeRequiredValidation.test.ts`

**Interfaces:**
- Consumes: `AddressDraft`, `EMPTY_ADDRESS_DRAFT`, `validateAddressDraft` from `#/domain/address`; `isBasicEmail` from `./memberRequiredValidation`; `NumericValue` from `./templeDraft`
- Produces:

```ts
export type TempleRequiredDraft = {
  danhHieu: string
  nguoiKhaiSon: string
  namThanhLap: string
  diaChiCu: AddressDraft
  diaChiMoi: AddressDraft
  truTriHienNay: { phapDanh: string; dienThoai: string; email: string }
  truTriTienNhiem: Array<{ phapDanh: string; thoiGian: string; ghiChu: string }>
  tangSoHienTru: {
    tyKheo: NumericValue
    tyKheoNi: NumericValue
    saDi: NumericValue
    tapSu: NumericValue
  }
  soPhatTuQuyY: NumericValue
  soPhatTuThuongXuyen: NumericValue
}

export type TempleRequiredFieldErrors = {
  danhHieu?: 'REQUIRED'
  nguoiKhaiSon?: 'REQUIRED'
  namThanhLap?: 'REQUIRED'
  diaChiCu?: { city?: 'REQUIRED'; ward?: 'REQUIRED' }
  diaChiMoi?: { city?: 'REQUIRED'; ward?: 'REQUIRED' }
  truTriHienNay?: {
    phapDanh?: 'REQUIRED'
    dienThoai?: 'REQUIRED'
    email?: 'REQUIRED' | 'INVALID'
  }
  truTriTienNhiem?: 'REQUIRED' | Array<{ phapDanh?: 'REQUIRED' } | undefined>
  tangSoHienTru?: {
    tyKheo?: 'REQUIRED'
    tyKheoNi?: 'REQUIRED'
    saDi?: 'REQUIRED'
    tapSu?: 'REQUIRED'
  }
  soPhatTuQuyY?: 'REQUIRED'
  soPhatTuThuongXuyen?: 'REQUIRED'
}

export function validateTempleRequiredFields(draft: TempleRequiredDraft): {
  valid: boolean
  errors: TempleRequiredFieldErrors
}
```

- [ ] **Step 1: Write the failing unit tests**

Create `tanstack-app/src/components/filler/templeRequiredValidation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { EMPTY_ADDRESS_DRAFT } from '#/domain/address'
import {
  validateTempleRequiredFields,
  type TempleRequiredDraft,
} from './templeRequiredValidation'

const completeAddress = {
  cityCode: '01',
  cityName: 'Hà Nội',
  wardCode: '00013',
  wardName: 'Hà Đông',
  line: '',
}

function filledDraft(
  overrides: Partial<TempleRequiredDraft> = {},
): TempleRequiredDraft {
  return {
    danhHieu: 'Tịnh xá Ngọc Viên',
    nguoiKhaiSon: 'HT. Minh',
    namThanhLap: '1954',
    diaChiCu: completeAddress,
    diaChiMoi: completeAddress,
    truTriHienNay: {
      phapDanh: 'Thích A',
      dienThoai: '0901234567',
      email: 'a@b.co',
    },
    truTriTienNhiem: [{ phapDanh: 'Thích B', thoiGian: '', ghiChu: '' }],
    tangSoHienTru: { tyKheo: 0, tyKheoNi: 0, saDi: 0, tapSu: 0 },
    soPhatTuQuyY: 0,
    soPhatTuThuongXuyen: 0,
    ...overrides,
  }
}

describe('validateTempleRequiredFields', () => {
  it('fails blank identity, addresses, tru tri, and empty counts', () => {
    const result = validateTempleRequiredFields({
      danhHieu: '',
      nguoiKhaiSon: '  ',
      namThanhLap: '',
      diaChiCu: { ...EMPTY_ADDRESS_DRAFT },
      diaChiMoi: { ...EMPTY_ADDRESS_DRAFT },
      truTriHienNay: { phapDanh: '', dienThoai: '', email: '' },
      truTriTienNhiem: [],
      tangSoHienTru: { tyKheo: '', tyKheoNi: '', saDi: '', tapSu: '' },
      soPhatTuQuyY: '',
      soPhatTuThuongXuyen: '',
    })
    expect(result.valid).toBe(false)
    expect(result.errors.danhHieu).toBe('REQUIRED')
    expect(result.errors.nguoiKhaiSon).toBe('REQUIRED')
    expect(result.errors.namThanhLap).toBe('REQUIRED')
    expect(result.errors.diaChiCu).toEqual({
      city: 'REQUIRED',
      ward: 'REQUIRED',
    })
    expect(result.errors.diaChiMoi).toEqual({
      city: 'REQUIRED',
      ward: 'REQUIRED',
    })
    expect(result.errors.truTriHienNay).toEqual({
      phapDanh: 'REQUIRED',
      dienThoai: 'REQUIRED',
      email: 'REQUIRED',
    })
    expect(result.errors.truTriTienNhiem).toBe('REQUIRED')
    expect(result.errors.tangSoHienTru).toEqual({
      tyKheo: 'REQUIRED',
      tyKheoNi: 'REQUIRED',
      saDi: 'REQUIRED',
      tapSu: 'REQUIRED',
    })
    expect(result.errors.soPhatTuQuyY).toBe('REQUIRED')
    expect(result.errors.soPhatTuThuongXuyen).toBe('REQUIRED')
  })

  it('marks invalid tru tri email format', () => {
    const result = validateTempleRequiredFields(
      filledDraft({
        truTriHienNay: {
          phapDanh: 'Thích A',
          dienThoai: '0901234567',
          email: 'not-an-email',
        },
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.truTriHienNay?.email).toBe('INVALID')
  })

  it('fails empty phap danh on tien nhiem row', () => {
    const result = validateTempleRequiredFields(
      filledDraft({
        truTriTienNhiem: [{ phapDanh: '  ', thoiGian: '', ghiChu: '' }],
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.truTriTienNhiem).toEqual([{ phapDanh: 'REQUIRED' }])
  })

  it('accepts zero counts and a filled draft', () => {
    expect(validateTempleRequiredFields(filledDraft())).toEqual({
      valid: true,
      errors: {},
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/components/filler/templeRequiredValidation.test.ts
```

Expected: FAIL (module / export missing).

- [ ] **Step 3: Implement `templeRequiredValidation.ts`**

```ts
import type { AddressDraft } from '#/domain/address'
import { validateAddressDraft } from '#/domain/address'
import { isBasicEmail } from './memberRequiredValidation'
import type { NumericValue } from './templeDraft'

export type TempleRequiredDraft = {
  danhHieu: string
  nguoiKhaiSon: string
  namThanhLap: string
  diaChiCu: AddressDraft
  diaChiMoi: AddressDraft
  truTriHienNay: { phapDanh: string; dienThoai: string; email: string }
  truTriTienNhiem: Array<{ phapDanh: string; thoiGian: string; ghiChu: string }>
  tangSoHienTru: {
    tyKheo: NumericValue
    tyKheoNi: NumericValue
    saDi: NumericValue
    tapSu: NumericValue
  }
  soPhatTuQuyY: NumericValue
  soPhatTuThuongXuyen: NumericValue
}

export type TempleRequiredFieldErrors = {
  danhHieu?: 'REQUIRED'
  nguoiKhaiSon?: 'REQUIRED'
  namThanhLap?: 'REQUIRED'
  diaChiCu?: { city?: 'REQUIRED'; ward?: 'REQUIRED' }
  diaChiMoi?: { city?: 'REQUIRED'; ward?: 'REQUIRED' }
  truTriHienNay?: {
    phapDanh?: 'REQUIRED'
    dienThoai?: 'REQUIRED'
    email?: 'REQUIRED' | 'INVALID'
  }
  truTriTienNhiem?: 'REQUIRED' | Array<{ phapDanh?: 'REQUIRED' } | undefined>
  tangSoHienTru?: {
    tyKheo?: 'REQUIRED'
    tyKheoNi?: 'REQUIRED'
    saDi?: 'REQUIRED'
    tapSu?: 'REQUIRED'
  }
  soPhatTuQuyY?: 'REQUIRED'
  soPhatTuThuongXuyen?: 'REQUIRED'
}

function requireText(value: string): 'REQUIRED' | undefined {
  return value.trim() ? undefined : 'REQUIRED'
}

function requireNumber(value: NumericValue): 'REQUIRED' | undefined {
  return typeof value === 'number' ? undefined : 'REQUIRED'
}

function mapAddress(
  draft: AddressDraft,
): { city?: 'REQUIRED'; ward?: 'REQUIRED' } | undefined {
  const result = validateAddressDraft(draft, { required: true })
  if (result.valid) return undefined
  return result.errors
}

export function validateTempleRequiredFields(draft: TempleRequiredDraft): {
  valid: boolean
  errors: TempleRequiredFieldErrors
} {
  const errors: TempleRequiredFieldErrors = {}

  const danhHieu = requireText(draft.danhHieu)
  if (danhHieu) errors.danhHieu = danhHieu
  const nguoiKhaiSon = requireText(draft.nguoiKhaiSon)
  if (nguoiKhaiSon) errors.nguoiKhaiSon = nguoiKhaiSon
  const namThanhLap = requireText(draft.namThanhLap)
  if (namThanhLap) errors.namThanhLap = namThanhLap

  const diaChiCu = mapAddress(draft.diaChiCu)
  if (diaChiCu) errors.diaChiCu = diaChiCu
  const diaChiMoi = mapAddress(draft.diaChiMoi)
  if (diaChiMoi) errors.diaChiMoi = diaChiMoi

  const truTri: NonNullable<TempleRequiredFieldErrors['truTriHienNay']> = {}
  const phapDanh = requireText(draft.truTriHienNay.phapDanh)
  if (phapDanh) truTri.phapDanh = phapDanh
  const dienThoai = requireText(draft.truTriHienNay.dienThoai)
  if (dienThoai) truTri.dienThoai = dienThoai
  const emailTrimmed = draft.truTriHienNay.email.trim()
  if (!emailTrimmed) truTri.email = 'REQUIRED'
  else if (!isBasicEmail(emailTrimmed)) truTri.email = 'INVALID'
  if (Object.keys(truTri).length > 0) errors.truTriHienNay = truTri

  if (draft.truTriTienNhiem.length === 0) {
    errors.truTriTienNhiem = 'REQUIRED'
  } else {
    const rowErrors = draft.truTriTienNhiem.map((row) => {
      const rowPhapDanh = requireText(row.phapDanh)
      return rowPhapDanh ? { phapDanh: rowPhapDanh } : undefined
    })
    if (rowErrors.some(Boolean)) errors.truTriTienNhiem = rowErrors
  }

  const tangSo: NonNullable<TempleRequiredFieldErrors['tangSoHienTru']> = {}
  const tyKheo = requireNumber(draft.tangSoHienTru.tyKheo)
  if (tyKheo) tangSo.tyKheo = tyKheo
  const tyKheoNi = requireNumber(draft.tangSoHienTru.tyKheoNi)
  if (tyKheoNi) tangSo.tyKheoNi = tyKheoNi
  const saDi = requireNumber(draft.tangSoHienTru.saDi)
  if (saDi) tangSo.saDi = saDi
  const tapSu = requireNumber(draft.tangSoHienTru.tapSu)
  if (tapSu) tangSo.tapSu = tapSu
  if (Object.keys(tangSo).length > 0) errors.tangSoHienTru = tangSo

  const soPhatTuQuyY = requireNumber(draft.soPhatTuQuyY)
  if (soPhatTuQuyY) errors.soPhatTuQuyY = soPhatTuQuyY
  const soPhatTuThuongXuyen = requireNumber(draft.soPhatTuThuongXuyen)
  if (soPhatTuThuongXuyen) errors.soPhatTuThuongXuyen = soPhatTuThuongXuyen

  return { valid: Object.keys(errors).length === 0, errors }
}
```

- [ ] **Step 4: Run unit tests — expect PASS**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/components/filler/templeRequiredValidation.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/filler/templeRequiredValidation.ts \
  tanstack-app/src/components/filler/templeRequiredValidation.test.ts
git commit -m "$(cat <<'EOF'
feat: add temple required-fields validation helper

EOF
)"
```

---

### Task 2: Wire UI required + errors + save gate

**Files:**
- Modify: `tanstack-app/src/components/filler/TempleEditorForm.tsx`
- Modify: `tanstack-app/src/components/filler/TempleEditorFormSections.tsx`
- Modify: `tanstack-app/src/components/filler/TempleEditorForm.test.tsx`

**Interfaces:**
- Consumes: `validateTempleRequiredFields`, `TempleRequiredFieldErrors` from Task 1
- Produces: Save blocked when invalid; sections accept optional `fieldErrors` / mapped address errors; Mantine `required` on listed controls

- [ ] **Step 1: Extend section props with errors + `required`**

In `TempleEditorFormSections.tsx`:

**TempleIdentitySection** — add optional `errors?: { danhHieu?: string; nguoiKhaiSon?: string; namThanhLap?: string }` and on the three TextInputs:

```tsx
required
error={errors?.danhHieu}
// same for nguoiKhaiSon, namThanhLap
```

**TempleAddressSection** — pass `required` into both `VietnamAddressFields`:

```tsx
required
errors={errors.diaChiCu}
// and diaChiMoi
```

**TempleTruTriSection** — add:

```ts
errors?: {
  truTriHienNay?: {
    phapDanh?: string
    dienThoai?: string
    email?: string
  }
  truTriTienNhiem?: string | Array<{ phapDanh?: string } | undefined>
}
```

Mark current abbot three fields `required` with matching `error`. For each tiền nhiệm row pháp danh:

```tsx
required
error={
  Array.isArray(errors?.truTriTienNhiem)
    ? errors.truTriTienNhiem[index]?.phapDanh
    : index === 0 && errors?.truTriTienNhiem
      ? errors.truTriTienNhiem
      : undefined
}
```

(When `truTriTienNhiem === 'REQUIRED'`, show the string on row 0 pháp danh.)

**TempleTangSoSection** — add:

```ts
errors?: {
  tangSoHienTru?: {
    tyKheo?: string
    tyKheoNi?: string
    saDi?: string
    tapSu?: string
  }
  soPhatTuQuyY?: string
  soPhatTuThuongXuyen?: string
}
```

Set `required` + `error` on all six `NumberInput`s.

- [ ] **Step 2: Replace save gate in `TempleEditorForm.tsx`**

1. Import validation types/helper and keep message mappers (reuse patterns from member form):

```ts
import {
  validateTempleRequiredFields,
  type TempleRequiredFieldErrors,
} from './templeRequiredValidation'

function mapRequiredError(code: 'REQUIRED' | undefined): string | undefined {
  return code === 'REQUIRED' ? m.filler_error_field_required() : undefined
}

function mapEmailError(
  code: 'REQUIRED' | 'INVALID' | undefined,
): string | undefined {
  if (code === 'REQUIRED') return m.filler_error_field_required()
  if (code === 'INVALID') return m.filler_error_email_invalid()
  return undefined
}

function mapAddressCodeErrors(
  errors?: { city?: 'REQUIRED'; ward?: 'REQUIRED' },
): AddressFieldErrors | undefined {
  if (!errors) return undefined
  return {
    city:
      errors.city === 'REQUIRED'
        ? m.filler_address_city_required()
        : undefined,
    ward:
      errors.ward === 'REQUIRED'
        ? m.filler_address_ward_required()
        : undefined,
  }
}
```

2. Replace `addressErrors` state with:

```ts
const [fieldErrors, setFieldErrors] = useState<TempleRequiredFieldErrors>({})
```

3. Replace `handleSave` body:

```ts
const handleSave = () => {
  const result = validateTempleRequiredFields({
    danhHieu: draft.danhHieu,
    nguoiKhaiSon: draft.nguoiKhaiSon,
    namThanhLap: draft.namThanhLap,
    diaChiCu: draft.diaChiCu,
    diaChiMoi: draft.diaChiMoi,
    truTriHienNay: draft.truTriHienNay,
    truTriTienNhiem: draft.truTriTienNhiem,
    tangSoHienTru: draft.tangSoHienTru,
    soPhatTuQuyY: draft.soPhatTuQuyY,
    soPhatTuThuongXuyen: draft.soPhatTuThuongXuyen,
  })
  if (!result.valid) {
    setFieldErrors(result.errors)
    return
  }
  setFieldErrors({})
  saveMutation.mutate()
}
```

4. Pass mapped string errors into sections, e.g.:

```tsx
<TempleIdentitySection
  ...
  errors={{
    danhHieu: mapRequiredError(fieldErrors.danhHieu),
    nguoiKhaiSon: mapRequiredError(fieldErrors.nguoiKhaiSon),
    namThanhLap: mapRequiredError(fieldErrors.namThanhLap),
  }}
/>
<TempleAddressSection
  ...
  errors={{
    diaChiCu: mapAddressCodeErrors(fieldErrors.diaChiCu),
    diaChiMoi: mapAddressCodeErrors(fieldErrors.diaChiMoi),
  }}
/>
```

For trụ trì / tăng số, map codes → message strings the same way before passing (do not pass raw `'REQUIRED'` into UI).

Remove unused `validateAddressDraft` import from `TempleEditorForm` if no longer referenced.

- [ ] **Step 3: Update form tests**

Add helper for a fully valid `initial` seed (addresses + identity + trụ trì + counts):

```ts
const completeAddress = {
  cityCode: '01',
  cityName: 'Hà Nội',
  wardCode: '00013',
  wardName: 'Hà Đông',
  line: '15 Ngõ 4',
}

function requiredTempleInitial(
  overrides: Partial<Temple> & { seedPhone?: string } = {},
): Partial<Temple> & { seedPhone?: string } {
  return {
    seedPhone: '0901234567',
    danhHieu: 'Tịnh xá Ngọc Viên',
    nguoiKhaiSon: 'HT. Minh',
    namThanhLap: '1954',
    diaChiCu: completeAddress,
    diaChiMoi: completeAddress,
    truTriHienNay: {
      phapDanh: 'Thích A',
      dienThoai: '0901234567',
      email: 'a@b.co',
    },
    truTriTienNhiem: [{ phapDanh: 'Thích B' }],
    tangSoHienTru: { tyKheo: 0, tyKheoNi: 0, saDi: 0, tapSu: 0 },
    soPhatTuQuyY: 0,
    soPhatTuThuongXuyen: 0,
    ...overrides,
  }
}
```

Update happy-path tests (`calls saveTempleDraft...`, `saves structured diaChiMoi...`) to use `initial: requiredTempleInitial(...)` (and remove redundant typing of danh hiệu if already seeded).

Replace / extend the address-only block test:

```ts
it('blocks save when required temple fields are empty', async () => {
  const user = userEvent.setup()
  renderForm()
  await user.click(screen.getByRole('button', { name: m.filler_save() }))
  expect(saveTempleDraftMock).not.toHaveBeenCalled()
  expect(screen.getAllByText(m.filler_error_field_required()).length).toBeGreaterThan(0)
})
```

Keep a test that incomplete address (line without city/ward) still blocks — seed other required fields via `requiredTempleInitial` then clear address or only set line on one address.

- [ ] **Step 4: Run form + validation tests**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/components/filler/templeRequiredValidation.test.ts \
  src/components/filler/TempleEditorForm.test.tsx
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/filler/TempleEditorForm.tsx \
  tanstack-app/src/components/filler/TempleEditorFormSections.tsx \
  tanstack-app/src/components/filler/TempleEditorForm.test.tsx
git commit -m "$(cat <<'EOF'
feat: enforce required fields on temple editor form

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| danhHieu / nguoiKhaiSon / namThanhLap required | 1, 2 |
| diaChiCu / diaChiMoi `{ required: true }` | 1, 2 |
| Trụ trì hiện nay phapDanh + phone + email (+ format) | 1, 2 |
| ≥1 tiền nhiệm with pháp danh | 1, 2 |
| Six counts; `0` ok | 1, 2 |
| Mirror member validation approach | 1 |
| UI `required` + errors; save gate | 2 |
| Vitest only; no Cypress | 1, 2 |
| Branch from main / no worktrees | 0 |

## Self-review notes

- No new i18n required if existing `filler_error_*` / address messages are reused.
- `emptyTempleDraft` already ensures ≥1 tiền nhiệm row — empty-array `'REQUIRED'` is defensive.
- Happy-path form tests **must** seed required fields or they will fail after Task 2.
