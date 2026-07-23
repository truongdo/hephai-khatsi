# Member Required Core Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block filler member **Lưu** until core Tăng/Ni fields are filled (text/dates non-empty; email format; three addresses required city+ward), with Mantine `required` and field errors.

**Architecture:** Add `validateMemberRequiredFields` returning machine-readable error codes. Wire `MemberEditorForm` to map codes → Paraglide messages, set `required`/`error` on controls, and replace the address-only save gate. Continue on existing branch `feat/member-noi-sinh-xuat-gia-address`.

**Tech Stack:** React 19, Mantine 9, Paraglide, Vitest + Testing Library, existing `validateAddressDraft`

**Spec:** `docs/superpowers/specs/2026-07-23-member-required-core-fields-design.md`

## Global Constraints

- Work in the current workspace only — **never** `git worktree add`
- Continue on branch `feat/member-noi-sinh-xuat-gia-address` (do **not** branch from `main` again)
- Preserve any unrelated local WIP in `vi.json` / form (nguyên quán / CNTN placeholders) — do not revert those edits
- Scope: filler `MemberEditorForm` only — not admin, not other member fields
- `diaChiThuongTru` becomes required (city+ward); phone = non-empty only; email = non-empty + basic format
- Prefer Vitest; **no new Cypress**
- After merge squash into `main`, delete the local feature branch unless asked otherwise

## File Structure

| File | Responsibility |
| --- | --- |
| `tanstack-app/messages/vi.json` | Required + email-invalid copy |
| `tanstack-app/src/paraglide/*` | Regenerated via `pnpm paraglide` (gitignored — do not hand-edit) |
| `tanstack-app/src/components/filler/memberRequiredValidation.ts` | Codes + `validateMemberRequiredFields` |
| `tanstack-app/src/components/filler/memberRequiredValidation.test.ts` | Unit tests for helper |
| `tanstack-app/src/components/filler/MemberEditorForm.tsx` | UI required/error + save gate |
| `tanstack-app/src/components/filler/MemberEditorForm.test.tsx` | Form save / email / happy-path seeds |

---

### Task 0: Commit spec on current branch

**Files:**
- Add: `docs/superpowers/specs/2026-07-23-member-required-core-fields-design.md`
- Add: `docs/superpowers/plans/2026-07-23-member-required-core-fields.md`

**Interfaces:**
- Consumes: branch `feat/member-noi-sinh-xuat-gia-address`
- Produces: docs committed (or staged with WIP left unstaged)

- [ ] **Step 1: Confirm branch**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git branch --show-current
# expect: feat/member-noi-sinh-xuat-gia-address
```

If wrong branch: stop and ask.

- [ ] **Step 2: Commit docs only (leave UI WIP unstaged)**

```bash
git add docs/superpowers/specs/2026-07-23-member-required-core-fields-design.md \
  docs/superpowers/plans/2026-07-23-member-required-core-fields.md
git commit -m "$(cat <<'EOF'
docs: spec and plan for member required core fields

EOF
)"
```

---

### Task 1: i18n + validation helper

**Files:**
- Modify: `tanstack-app/messages/vi.json`
- Create: `tanstack-app/src/components/filler/memberRequiredValidation.ts`
- Create: `tanstack-app/src/components/filler/memberRequiredValidation.test.ts`

**Interfaces:**
- Consumes: `AddressDraft`, `EMPTY_ADDRESS_DRAFT`, `validateAddressDraft` from `#/domain/address`
- Produces:

```ts
export type MemberRequiredDraft = {
  theDanh: string
  phapDanh: string
  ngaySinh: string
  noiSinh: AddressDraft
  dienThoai: string
  email: string
  diaChiThuongTru: AddressDraft
  ngayXuatGia: string
  noiXuatGia: AddressDraft
  hienTuHoc: string
  bonSu: string
}

export type MemberRequiredFieldErrors = {
  theDanh?: 'REQUIRED'
  phapDanh?: 'REQUIRED'
  ngaySinh?: 'REQUIRED'
  noiSinh?: { city?: 'REQUIRED'; ward?: 'REQUIRED' }
  dienThoai?: 'REQUIRED'
  email?: 'REQUIRED' | 'INVALID'
  diaChiThuongTru?: { city?: 'REQUIRED'; ward?: 'REQUIRED' }
  ngayXuatGia?: 'REQUIRED'
  noiXuatGia?: { city?: 'REQUIRED'; ward?: 'REQUIRED' }
  hienTuHoc?: 'REQUIRED'
  bonSu?: 'REQUIRED'
}

export function isBasicEmail(value: string): boolean
export function validateMemberRequiredFields(draft: MemberRequiredDraft): {
  valid: boolean
  errors: MemberRequiredFieldErrors
}
```

- [ ] **Step 1: Add message keys**

In `tanstack-app/messages/vi.json` add:

```json
  "filler_error_field_required": "Vui lòng điền mục này",
  "filler_error_email_invalid": "Email không hợp lệ"
```

Do **not** remove or overwrite existing unrelated WIP keys (`filler_ph_nguyen_quan`, `filler_ph_noi_cap_cntn`, etc.).

- [ ] **Step 2: Compile Paraglide**

```bash
cd tanstack-app && pnpm paraglide
```

Expected: succeeds; `m.filler_error_field_required` / `m.filler_error_email_invalid` available.

- [ ] **Step 3: Write failing unit tests**

Create `tanstack-app/src/components/filler/memberRequiredValidation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { EMPTY_ADDRESS_DRAFT } from '#/domain/address'
import {
  isBasicEmail,
  validateMemberRequiredFields,
  type MemberRequiredDraft,
} from './memberRequiredValidation'

const completeAddress = {
  cityCode: '01',
  cityName: 'Hà Nội',
  wardCode: '00013',
  wardName: 'Hà Đông',
  line: '',
}

function filledDraft(
  overrides: Partial<MemberRequiredDraft> = {},
): MemberRequiredDraft {
  return {
    theDanh: 'Nguyễn Văn A',
    phapDanh: 'Minh Tâm',
    ngaySinh: '1990-01-01',
    noiSinh: completeAddress,
    dienThoai: '0901234567',
    email: 'a@b.co',
    diaChiThuongTru: completeAddress,
    ngayXuatGia: '2010-01-01',
    noiXuatGia: completeAddress,
    hienTuHoc: 'Tịnh xá X',
    bonSu: 'TT. Minh',
    ...overrides,
  }
}

describe('isBasicEmail', () => {
  it('accepts simple emails', () => {
    expect(isBasicEmail('a@b.co')).toBe(true)
  })

  it('rejects missing at or domain', () => {
    expect(isBasicEmail('not-an-email')).toBe(false)
    expect(isBasicEmail('a@b')).toBe(false)
    expect(isBasicEmail('')).toBe(false)
  })
})

describe('validateMemberRequiredFields', () => {
  it('fails all text/date/address when blank', () => {
    const result = validateMemberRequiredFields({
      theDanh: '',
      phapDanh: '  ',
      ngaySinh: '',
      noiSinh: { ...EMPTY_ADDRESS_DRAFT },
      dienThoai: '',
      email: '',
      diaChiThuongTru: { ...EMPTY_ADDRESS_DRAFT },
      ngayXuatGia: '',
      noiXuatGia: { ...EMPTY_ADDRESS_DRAFT },
      hienTuHoc: '',
      bonSu: '',
    })
    expect(result.valid).toBe(false)
    expect(result.errors.theDanh).toBe('REQUIRED')
    expect(result.errors.phapDanh).toBe('REQUIRED')
    expect(result.errors.email).toBe('REQUIRED')
    expect(result.errors.noiSinh).toEqual({
      city: 'REQUIRED',
      ward: 'REQUIRED',
    })
    expect(result.errors.diaChiThuongTru).toEqual({
      city: 'REQUIRED',
      ward: 'REQUIRED',
    })
  })

  it('marks invalid email format', () => {
    const result = validateMemberRequiredFields(
      filledDraft({ email: 'not-an-email' }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.email).toBe('INVALID')
  })

  it('accepts a fully filled draft', () => {
    expect(validateMemberRequiredFields(filledDraft())).toEqual({
      valid: true,
      errors: {},
    })
  })
})
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
cd tanstack-app && pnpm vitest run src/components/filler/memberRequiredValidation.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 5: Implement helper**

Create `tanstack-app/src/components/filler/memberRequiredValidation.ts`:

```ts
import type { AddressDraft } from '#/domain/address'
import { validateAddressDraft } from '#/domain/address'

export type MemberRequiredDraft = {
  theDanh: string
  phapDanh: string
  ngaySinh: string
  noiSinh: AddressDraft
  dienThoai: string
  email: string
  diaChiThuongTru: AddressDraft
  ngayXuatGia: string
  noiXuatGia: AddressDraft
  hienTuHoc: string
  bonSu: string
}

export type MemberRequiredFieldErrors = {
  theDanh?: 'REQUIRED'
  phapDanh?: 'REQUIRED'
  ngaySinh?: 'REQUIRED'
  noiSinh?: { city?: 'REQUIRED'; ward?: 'REQUIRED' }
  dienThoai?: 'REQUIRED'
  email?: 'REQUIRED' | 'INVALID'
  diaChiThuongTru?: { city?: 'REQUIRED'; ward?: 'REQUIRED' }
  ngayXuatGia?: 'REQUIRED'
  noiXuatGia?: { city?: 'REQUIRED'; ward?: 'REQUIRED' }
  hienTuHoc?: 'REQUIRED'
  bonSu?: 'REQUIRED'
}

const BASIC_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isBasicEmail(value: string): boolean {
  return BASIC_EMAIL.test(value.trim())
}

function requireText(value: string): 'REQUIRED' | undefined {
  return value.trim() ? undefined : 'REQUIRED'
}

function mapAddress(
  draft: AddressDraft,
): { city?: 'REQUIRED'; ward?: 'REQUIRED' } | undefined {
  const result = validateAddressDraft(draft, { required: true })
  if (result.valid) return undefined
  return result.errors
}

export function validateMemberRequiredFields(draft: MemberRequiredDraft): {
  valid: boolean
  errors: MemberRequiredFieldErrors
} {
  const errors: MemberRequiredFieldErrors = {}

  const theDanh = requireText(draft.theDanh)
  if (theDanh) errors.theDanh = theDanh
  const phapDanh = requireText(draft.phapDanh)
  if (phapDanh) errors.phapDanh = phapDanh
  const ngaySinh = requireText(draft.ngaySinh)
  if (ngaySinh) errors.ngaySinh = ngaySinh
  const dienThoai = requireText(draft.dienThoai)
  if (dienThoai) errors.dienThoai = dienThoai
  const ngayXuatGia = requireText(draft.ngayXuatGia)
  if (ngayXuatGia) errors.ngayXuatGia = ngayXuatGia
  const hienTuHoc = requireText(draft.hienTuHoc)
  if (hienTuHoc) errors.hienTuHoc = hienTuHoc
  const bonSu = requireText(draft.bonSu)
  if (bonSu) errors.bonSu = bonSu

  const emailTrimmed = draft.email.trim()
  if (!emailTrimmed) errors.email = 'REQUIRED'
  else if (!isBasicEmail(emailTrimmed)) errors.email = 'INVALID'

  const noiSinh = mapAddress(draft.noiSinh)
  if (noiSinh) errors.noiSinh = noiSinh
  const diaChiThuongTru = mapAddress(draft.diaChiThuongTru)
  if (diaChiThuongTru) errors.diaChiThuongTru = diaChiThuongTru
  const noiXuatGia = mapAddress(draft.noiXuatGia)
  if (noiXuatGia) errors.noiXuatGia = noiXuatGia

  return { valid: Object.keys(errors).length === 0, errors }
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd tanstack-app && pnpm vitest run src/components/filler/memberRequiredValidation.test.ts
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add tanstack-app/messages/vi.json \
  tanstack-app/src/components/filler/memberRequiredValidation.ts \
  tanstack-app/src/components/filler/memberRequiredValidation.test.ts
git commit -m "$(cat <<'EOF'
feat: add member required-fields validation helper

EOF
)"
```

If unrelated WIP in `vi.json` is mixed in the same hunks, stage carefully (`git add -p`) so only the two new keys (plus any keys this task must touch) land in the commit — or commit WIP placeholders in a separate earlier commit if cleaner.

---

### Task 2: Wire MemberEditorForm UI + save

**Files:**
- Modify: `tanstack-app/src/components/filler/MemberEditorForm.tsx`
- Modify: `tanstack-app/src/components/filler/MemberEditorForm.test.tsx`

**Interfaces:**
- Consumes: `validateMemberRequiredFields`, `MemberRequiredFieldErrors`
- Produces: form blocks save when invalid; `required` + `error` on listed fields; `diaChiThuongTru` uses `required` on `VietnamAddressFields`

- [ ] **Step 1: Write / update failing form tests**

In `MemberEditorForm.test.tsx`:

1. Add helper to fill all required non-address text/dates before happy-path save (or seed via `initial`):

```ts
async function fillRequiredTextFields(
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.type(
    screen.getByRole('textbox', { name: m.filler_field_the_danh() }),
    'Nguyễn Văn A',
  )
  await user.type(
    screen.getByRole('textbox', { name: m.filler_field_phap_danh() }),
    'Minh Tâm',
  )
  // Dates: use Mantine DateInput — type YYYY-MM-DD if the control accepts it,
  // or set via initial: { ngaySinh: '1990-01-01', ngayXuatGia: '2010-01-01' }
  await user.type(
    screen.getByRole('textbox', { name: m.filler_field_dien_thoai() }),
    '0901234567',
  )
  await user.type(
    screen.getByRole('textbox', { name: m.filler_field_email() }),
    'a@b.co',
  )
  await user.type(
    screen.getByRole('textbox', { name: m.filler_field_hien_tu_hoc() }),
    'Tịnh xá X',
  )
  await user.type(
    screen.getByRole('textbox', { name: m.filler_field_bon_su() }),
    'TT. Minh',
  )
}
```

Prefer seeding dates through `initial` / `renderForm` when DateInput typing is flaky:

```ts
renderForm({
  initial: {
    ngaySinh: '1990-01-01',
    ngayXuatGia: '2010-01-01',
  },
  cccd: '012345678901',
})
```

2. Replace / extend the test that only checked address required on blank save:

```ts
  it('blocks save when required core fields are empty', async () => {
    const user = userEvent.setup()
    renderForm({ cccd: '012345678901' })
    await user.click(screen.getByRole('button', { name: m.filler_save() }))
    expect(saveMemberDraftMock).not.toHaveBeenCalled()
    expect(screen.getAllByText(m.filler_error_field_required()).length).toBeGreaterThanOrEqual(1)
  })

  it('blocks save when email format is invalid', async () => {
    const user = userEvent.setup()
    renderForm({
      cccd: '012345678901',
      initial: {
        theDanh: 'Nguyễn Văn A',
        phapDanh: 'Minh Tâm',
        ngaySinh: '1990-01-01',
        ngayXuatGia: '2010-01-01',
        dienThoai: '0901234567',
        email: 'not-an-email',
        hienTuHoc: 'Tịnh xá X',
        bonSu: 'TT. Minh',
        noiSinh: {
          cityCode: '01',
          cityName: 'Hà Nội',
          wardCode: '00013',
          wardName: 'Hà Đông',
        },
        diaChiThuongTru: {
          cityCode: '01',
          cityName: 'Hà Nội',
          wardCode: '00013',
          wardName: 'Hà Đông',
        },
        noiXuatGia: {
          cityCode: '01',
          cityName: 'Hà Nội',
          wardCode: '00013',
          wardName: 'Hà Đông',
        },
      },
    })
    await user.click(screen.getByRole('button', { name: m.filler_save() }))
    expect(saveMemberDraftMock).not.toHaveBeenCalled()
    expect(screen.getByText(m.filler_error_email_invalid())).toBeTruthy()
  })
```

3. Update any happy-path save test to seed **all** required fields (text + three addresses) before clicking Lưu.

4. Update the permanent-address partial-line test: after typing only a line on `diaChiThuongTru`, save must still fail (now required even when blank elsewhere — either fill other required fields first then leave địa chỉ blank, or assert city required among errors). Preferred:

```ts
  it('blocks save when permanent address lacks city and ward', async () => {
    const user = userEvent.setup()
    renderForm({
      cccd: '012345678901',
      initial: {
        theDanh: 'A',
        phapDanh: 'B',
        ngaySinh: '1990-01-01',
        ngayXuatGia: '2010-01-01',
        dienThoai: '0901234567',
        email: 'a@b.co',
        hienTuHoc: 'TX',
        bonSu: 'TT',
        noiSinh: {
          cityCode: '01',
          cityName: 'Hà Nội',
          wardCode: '00013',
          wardName: 'Hà Đông',
        },
        noiXuatGia: {
          cityCode: '01',
          cityName: 'Hà Nội',
          wardCode: '00013',
          wardName: 'Hà Đông',
        },
      },
    })
    const permanent = screen.getByLabelText(m.filler_field_dia_chi_thuong_tru())
    await user.type(
      within(permanent).getByRole('textbox', {
        name: m.filler_field_address_line(),
      }),
      '15 Ngõ 4',
    )
    await user.click(screen.getByRole('button', { name: m.filler_save() }))
    expect(saveMemberDraftMock).not.toHaveBeenCalled()
    expect(
      within(permanent).getByText(m.filler_address_city_required()),
    ).toBeTruthy()
  })
```

- [ ] **Step 2: Run form tests to see failures**

```bash
cd tanstack-app && pnpm vitest run src/components/filler/MemberEditorForm.test.tsx
```

Expected: FAIL on new assertions / broken happy-path.

- [ ] **Step 3: Wire form state + mapping**

In `MemberEditorForm.tsx`:

1. Import `validateMemberRequiredFields` and types.
2. Replace the three separate address error states with one:

```ts
const [fieldErrors, setFieldErrors] = useState<MemberRequiredFieldErrors>({})
```

3. Map codes → messages when setting UI errors (inline helper):

```ts
function mapEmailError(
  code: 'REQUIRED' | 'INVALID' | undefined,
): string | undefined {
  if (code === 'REQUIRED') return m.filler_error_field_required()
  if (code === 'INVALID') return m.filler_error_email_invalid()
  return undefined
}

function mapRequiredError(code: 'REQUIRED' | undefined): string | undefined {
  return code === 'REQUIRED' ? m.filler_error_field_required() : undefined
}
```

For address UI errors, keep using `mapAddressErrors` on `{ valid: !errors.noiSinh, errors: errors.noiSinh ?? {} }` or adapt `mapAddressErrors` to accept `MemberRequiredFieldErrors['noiSinh']`.

4. Replace `onSave` body with:

```ts
const result = validateMemberRequiredFields({
  theDanh: draft.theDanh,
  phapDanh: draft.phapDanh,
  ngaySinh: draft.ngaySinh,
  noiSinh: draft.noiSinh,
  dienThoai: draft.dienThoai,
  email: draft.email,
  diaChiThuongTru: draft.diaChiThuongTru,
  ngayXuatGia: draft.ngayXuatGia,
  noiXuatGia: draft.noiXuatGia,
  hienTuHoc: draft.hienTuHoc,
  bonSu: draft.bonSu,
})
if (!result.valid) {
  setFieldErrors(result.errors)
  return
}
setFieldErrors({})
saveMutation.mutate()
```

5. Add `required` + `error={mapRequiredError(fieldErrors.theDanh)}` (etc.) on:
   - Thế danh, Pháp danh, Ngày sinh, Điện thoại, Email (`error={mapEmailError(fieldErrors.email)}`), Ngày xuất gia, Hiện tu học, Bổn sư

6. Pass `required` to all three `VietnamAddressFields`; pass mapped city/ward string errors from `fieldErrors.noiSinh` / `diaChiThuongTru` / `noiXuatGia`.

7. Remove obsolete `addressErrors` / `noiSinhAddressErrors` / `noiXuatGiaAddressErrors` state and the old triple-`validateAddressDraft` save block.

8. Update `useMemo` deps to include `fieldErrors` (or mapped error strings).

Minimum polish: recompute errors only on save (spec allows this).

- [ ] **Step 4: Run form tests**

```bash
cd tanstack-app && pnpm vitest run src/components/filler/MemberEditorForm.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/filler/MemberEditorForm.tsx \
  tanstack-app/src/components/filler/MemberEditorForm.test.tsx
git commit -m "$(cat <<'EOF'
feat: enforce required core fields on member editor save

EOF
)"
```

---

### Task 3: Verification

**Files:** none (run only)

- [ ] **Step 1: Run focused suites**

```bash
cd tanstack-app && pnpm vitest run \
  src/components/filler/memberRequiredValidation.test.ts \
  src/components/filler/MemberEditorForm.test.tsx \
  src/domain/address.test.ts \
  src/components/address/VietnamAddressFields.test.tsx
```

Expected: all PASS

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Required text/date fields | Tasks 1–2 |
| Email non-empty + basic format | Tasks 1–2 |
| Three addresses `{ required: true }` | Tasks 1–2 |
| `validateMemberRequiredFields` helper | Task 1 |
| UI `required` + errors + save gate | Task 2 |
| Vitest; no Cypress | Tasks 1–3 |
| Continue current feature branch | Task 0 |
