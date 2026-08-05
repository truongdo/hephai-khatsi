# Member Form Required Fields + Date Format Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require portrait, cha/mẹ fields, and nơi xuất gia line on validated member save; show member `DateInput` as `dd-mm-yyyy`; update portrait / hệ phái gốc / giáo đoàn gốc descriptions and nơi xuất gia line label.

**Architecture:** Extend shared `validateMemberRequiredFields` (filler **Lưu** + admin **Hoàn thành**). Add optional `lineRequired` on address validation and `lineLabel`/`lineRequired` on `VietnamAddressFields`. Wire UI required/errors/copy in `MemberFormFields` / `MemberPortraitField` / `PreceptFields`. Storage stays `YYYY-MM-DD`.

**Tech Stack:** React 19, Mantine 9 (`DateInput`), Paraglide (`pnpm paraglide`), Vitest + Testing Library, existing `validateAddressDraft`

**Spec:** `docs/superpowers/specs/2026-08-05-member-form-required-fields-date-format-design.md`

## Global Constraints

- Work in the current workspace only — **never** `git worktree add`
- Create and use a feature branch from `main` (e.g. `feat/member-form-required-fields-date-format`); if already on another branch with WIP, stop and ask
- Địa chỉ thường trú: **no** label or validation change (line stays optional)
- Nơi xuất gia line: label **Tự viện/Tịnh xá, tổ/thôn** + required
- Portrait required = `photoPath` **or** pending `File`
- Cha/mẹ: all four fields each (`hoTen`, `namSinh`, `ngheNghiep`, `noiO`); anh chị em optional
- Date display: member `DateInput` only → `DD-MM-YYYY`; `MonthPickerInput` stays `MM/YYYY`; temple/entry forms out of scope
- Do **not** change shared `filler_ph_date` (temple uses it); add `filler_ph_date_dmy`
- Admin **Lưu nháp** still skips required validation
- Prefer Vitest; **no new Cypress**
- After merge squash into `main`, delete the local feature branch unless asked otherwise

## File Structure

| File | Responsibility |
| --- | --- |
| `docs/superpowers/specs/2026-08-05-member-form-required-fields-date-format-design.md` | Spec (commit on branch) |
| `docs/superpowers/plans/2026-08-05-member-form-required-fields-date-format.md` | This plan |
| `tanstack-app/messages/vi.json` | New/updated copy keys |
| `tanstack-app/src/paraglide/*` | Regenerated via `pnpm paraglide` (do not hand-edit) |
| `tanstack-app/src/domain/address.ts` | Optional `lineRequired` / `errors.line` |
| `tanstack-app/src/domain/address.test.ts` | Address line-required tests |
| `tanstack-app/src/components/address/VietnamAddressFields.tsx` | `lineLabel`, `lineRequired`, line error |
| `tanstack-app/src/components/address/VietnamAddressFields.test.tsx` | Address UI tests |
| `tanstack-app/src/components/filler/memberRequiredValidation.ts` | Extended required rules |
| `tanstack-app/src/components/filler/memberRequiredValidation.test.ts` | Validation unit tests |
| `tanstack-app/src/components/filler/MemberPortraitField.tsx` | Description + required/error |
| `tanstack-app/src/components/filler/MemberFormFields.tsx` | Wire UI, dates, nơi xuất gia line, family errors |
| `tanstack-app/src/components/filler/PreceptFields.tsx` | Precept `DateInput` format |
| `tanstack-app/src/components/filler/MemberEditorForm.tsx` | Pass photo into validator |
| `tanstack-app/src/components/admin/MemberFormPage.tsx` | Pass photo into validator on Hoàn thành |
| `tanstack-app/src/components/filler/MemberEditorForm.test.tsx` | Seeds + assertions |
| `tanstack-app/src/components/admin/MemberFormPage.test.tsx` | Seeds for Hoàn thành |
| `tanstack-app/src/components/filler/MemberPortraitField.test.tsx` | Description render (light) |

---

### Task 0: Branch from main + commit docs

**Files:**
- Add: `docs/superpowers/specs/2026-08-05-member-form-required-fields-date-format-design.md`
- Add: `docs/superpowers/plans/2026-08-05-member-form-required-fields-date-format.md`

**Interfaces:**
- Consumes: clean-enough `main` (or user decision if not on `main`)
- Produces: branch `feat/member-form-required-fields-date-format` with docs committed

- [ ] **Step 1: Confirm branch situation**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git branch --show-current
git status -sb
```

If not on `main` / `master`: **stop and ask** whether to stash/commit WIP and branch from `main`, or continue on current branch.

- [ ] **Step 2: Create feature branch from main**

```bash
git checkout main
git pull
git checkout -b feat/member-form-required-fields-date-format
```

- [ ] **Step 3: Commit docs only**

```bash
git add docs/superpowers/specs/2026-08-05-member-form-required-fields-date-format-design.md \
  docs/superpowers/plans/2026-08-05-member-form-required-fields-date-format.md
git commit -m "$(cat <<'EOF'
docs: spec and plan for member form required fields and date format

EOF
)"
```

---

### Task 1: i18n message keys

**Files:**
- Modify: `tanstack-app/messages/vi.json`
- Generate: `tanstack-app/src/paraglide/*` via `pnpm paraglide`

**Interfaces:**
- Consumes: existing keys `filler_desc_he_phai_goc`, `filler_desc_giao_doan_goc`
- Produces Paraglide accessors:
  - `m.filler_desc_anh_chan_dung()`
  - `m.filler_desc_he_phai_goc()` (updated)
  - `m.filler_desc_giao_doan_goc()` (updated)
  - `m.filler_field_noi_xuat_gia_line()`
  - `m.filler_ph_date_dmy()`

- [ ] **Step 1: Update / add keys in `vi.json`**

Add or replace these entries (keep JSON valid; place near related `filler_desc_*` / `filler_field_*` keys):

```json
"filler_desc_anh_chan_dung": "Ảnh chụp chính diện khuôn mặt (có thể chụp bằng điện thoại). Ảnh cần rõ nét, đủ sáng và nhìn rõ khuôn mặt",
"filler_desc_he_phai_goc": "Để trống nếu không chuyển Hệ phái. Trường hợp xuất gia ban đầu thuộc tông phái khác rồi chuyển sang Hệ phái Khất sĩ, vui lòng ghi tông phái trước khi chuyển \"ví dụ: Bắc tông\"",
"filler_desc_giao_doan_goc": "Để trống nếu không chuyển Giáo đoàn. Nếu đã chuyển từ Giáo đoàn khác sang Giáo đoàn hiện tại, ghi Giáo đoàn trước khi chuyển \"ví dụ: từ GĐ I sang GĐ IV thì ghi \"GĐ I\"",
"filler_field_noi_xuat_gia_line": "Tự viện/Tịnh xá, tổ/thôn",
"filler_ph_date_dmy": "vd: 15-01-2020"
```

Do **not** change `filler_ph_date` or `filler_field_address_line`.

- [ ] **Step 2: Regenerate Paraglide**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm paraglide
```

Expected: exit 0; new/updated message modules without TypeScript errors for the new keys.

- [ ] **Step 3: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/messages/vi.json
git commit -m "$(cat <<'EOF'
i18n: member portrait/sect/org descriptions and date placeholder

EOF
)"
```

---

### Task 2: `validateAddressDraft` lineRequired

**Files:**
- Modify: `tanstack-app/src/domain/address.ts`
- Modify: `tanstack-app/src/domain/address.test.ts`

**Interfaces:**
- Consumes: existing `validateAddressDraft(draft, options?)`
- Produces:

```ts
export type AddressValidationResult = {
  valid: boolean
  errors: { city?: 'REQUIRED'; ward?: 'REQUIRED'; line?: 'REQUIRED' }
}

export function validateAddressDraft(
  draft: AddressDraft,
  options?: { required?: boolean; cityOnly?: boolean; lineRequired?: boolean },
): AddressValidationResult
```

When `lineRequired: true` and `draft.line.trim()` is empty, set `errors.line = 'REQUIRED'` (in addition to city/ward rules). When `cityOnly`, do not require line.

- [ ] **Step 1: Write failing tests**

Append to `address.test.ts` inside `describe('validateAddressDraft')`:

```ts
it('requires line when lineRequired', () => {
  expect(
    validateAddressDraft(
      {
        cityCode: '01',
        cityName: 'Hà Nội',
        wardCode: '00013',
        wardName: 'Hà Đông',
        line: '  ',
      },
      { required: true, lineRequired: true },
    ),
  ).toEqual({
    valid: false,
    errors: { line: 'REQUIRED' },
  })
})

it('accepts line when lineRequired', () => {
  expect(
    validateAddressDraft(
      {
        cityCode: '01',
        cityName: 'Hà Nội',
        wardCode: '00013',
        wardName: 'Hà Đông',
        line: 'Tịnh xá A',
      },
      { required: true, lineRequired: true },
    ),
  ).toEqual({ valid: true, errors: {} })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/domain/address.test.ts
```

Expected: FAIL (line not validated / type mismatch).

- [ ] **Step 3: Implement**

In `address.ts`:

1. Extend `AddressValidationResult['errors']` with `line?: 'REQUIRED'`.
2. Add `lineRequired?: boolean` to options.
3. After existing city/ward checks (and when not `cityOnly`), if `options?.lineRequired` and `!draft.line.trim()`, set `errors.line = 'REQUIRED'`.
4. When `required` and blank draft: if `lineRequired`, also include `line: 'REQUIRED'` in the blank-required errors object (with city/ward as today).

Do not change `addressDraftToValue` behavior.

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/domain/address.test.ts
```

- [ ] **Step 5: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/src/domain/address.ts tanstack-app/src/domain/address.test.ts
git commit -m "$(cat <<'EOF'
feat(address): optional lineRequired validation

EOF
)"
```

---

### Task 3: `VietnamAddressFields` lineLabel / lineRequired

**Files:**
- Modify: `tanstack-app/src/components/address/VietnamAddressFields.tsx`
- Modify: `tanstack-app/src/components/address/VietnamAddressFields.test.tsx`

**Interfaces:**
- Consumes: Task 1 keys; Task 2 error shape
- Produces props:

```ts
lineLabel?: string
lineRequired?: boolean
errors?: { city?: string; ward?: string; line?: string }
```

- [ ] **Step 1: Write failing tests**

```ts
it('uses custom lineLabel when provided', () => {
  renderFields({ lineLabel: 'Tự viện/Tịnh xá, tổ/thôn' })
  expect(
    screen.getByRole('textbox', { name: 'Tự viện/Tịnh xá, tổ/thôn' }),
  ).toBeTruthy()
})

it('marks line required when lineRequired is set', () => {
  renderFields({ lineRequired: true })
  expect(
    screen.getByRole('textbox', { name: m.filler_field_address_line() }),
  ).toBeRequired()
})

it('shows line error when provided', () => {
  renderFields({
    errors: { line: m.filler_error_field_required() },
  })
  expect(screen.getByText(m.filler_error_field_required())).toBeTruthy()
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/components/address/VietnamAddressFields.test.tsx
```

- [ ] **Step 3: Implement**

On the line `TextInput` in `VietnamAddressFields`:

```tsx
<TextInput
  label={lineLabel ?? m.filler_field_address_line()}
  placeholder={linePlaceholder ?? m.filler_ph_address_line()}
  value={value.line}
  onChange={(event) =>
    onChange({ ...value, line: event.currentTarget.value })
  }
  disabled={disabled}
  required={lineRequired}
  error={errors?.line}
/>
```

Wire `lineLabel` / `lineRequired` through props (default `lineRequired` false).

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/components/address/VietnamAddressFields.test.tsx
```

- [ ] **Step 5: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/src/components/address/VietnamAddressFields.tsx \
  tanstack-app/src/components/address/VietnamAddressFields.test.tsx
git commit -m "$(cat <<'EOF'
feat(address): lineLabel and lineRequired on VietnamAddressFields

EOF
)"
```

---

### Task 4: Extend `validateMemberRequiredFields`

**Files:**
- Modify: `tanstack-app/src/components/filler/memberRequiredValidation.ts`
- Modify: `tanstack-app/src/components/filler/memberRequiredValidation.test.ts`

**Interfaces:**
- Consumes: `FamilyPersonDraft` from `./memberDraft`; `validateAddressDraft` with `lineRequired`
- Produces extended types:

```ts
import type { FamilyPersonDraft } from './memberDraft'

export type MemberRequiredDraft = {
  // …existing fields…
  photoPath: string | null
  pendingPhoto: File | null
  giaDinh: { cha: FamilyPersonDraft; me: FamilyPersonDraft }
}

export type MemberRequiredFieldErrors = {
  // …existing…
  photo?: 'REQUIRED'
  giaDinh?: {
    cha?: Partial<Record<keyof FamilyPersonDraft, 'REQUIRED'>>
    me?: Partial<Record<keyof FamilyPersonDraft, 'REQUIRED'>>
  }
  noiXuatGia?: { city?: 'REQUIRED'; ward?: 'REQUIRED'; line?: 'REQUIRED' }
  // diaChiThuongTru / noiSinh unchanged (no line)
}
```

- [ ] **Step 1: Update `filledDraft` helper and write failing tests**

```ts
const emptyFamilyPerson = {
  hoTen: '',
  namSinh: '',
  ngheNghiep: '',
  noiO: '',
}

const filledFamilyPerson = {
  hoTen: 'Nguyễn Văn B',
  namSinh: '1960',
  ngheNghiep: 'Nông',
  noiO: 'Hà Nội',
}

function filledDraft(overrides: Partial<MemberRequiredDraft> = {}): MemberRequiredDraft {
  return {
    // …existing core fields…
    noiXuatGia: { ...completeAddress, line: 'Tịnh xá A' },
    photoPath: 'members/m1/photo.jpg',
    pendingPhoto: null,
    giaDinh: { cha: filledFamilyPerson, me: filledFamilyPerson },
    ...overrides,
  }
}

it('requires portrait when no photoPath or pendingPhoto', () => {
  const result = validateMemberRequiredFields(
    filledDraft({ photoPath: null, pendingPhoto: null }),
  )
  expect(result.valid).toBe(false)
  expect(result.errors.photo).toBe('REQUIRED')
})

it('accepts pending portrait file without photoPath', () => {
  const file = new File(['x'], 'p.jpg', { type: 'image/jpeg' })
  expect(
    validateMemberRequiredFields(
      filledDraft({ photoPath: null, pendingPhoto: file }),
    ),
  ).toEqual({ valid: true, errors: {} })
})

it('requires all cha and me fields', () => {
  const result = validateMemberRequiredFields(
    filledDraft({
      giaDinh: { cha: emptyFamilyPerson, me: emptyFamilyPerson },
    }),
  )
  expect(result.valid).toBe(false)
  expect(result.errors.giaDinh?.cha).toEqual({
    hoTen: 'REQUIRED',
    namSinh: 'REQUIRED',
    ngheNghiep: 'REQUIRED',
    noiO: 'REQUIRED',
  })
  expect(result.errors.giaDinh?.me).toEqual({
    hoTen: 'REQUIRED',
    namSinh: 'REQUIRED',
    ngheNghiep: 'REQUIRED',
    noiO: 'REQUIRED',
  })
})

it('requires noiXuatGia line', () => {
  const result = validateMemberRequiredFields(
    filledDraft({
      noiXuatGia: { ...completeAddress, line: '' },
    }),
  )
  expect(result.valid).toBe(false)
  expect(result.errors.noiXuatGia?.line).toBe('REQUIRED')
})
```

Update the existing blank-draft test object to include `photoPath: null`, `pendingPhoto: null`, and empty `giaDinh` so TypeScript compiles; assert `photo` and `giaDinh` errors as appropriate.

Update `completeAddress` used for `noiXuatGia` in happy path to include a non-empty `line`. Keep `diaChiThuongTru` able to pass with empty line.

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/components/filler/memberRequiredValidation.test.ts
```

- [ ] **Step 3: Implement validation**

```ts
function requireFamilyPerson(
  person: FamilyPersonDraft,
): Partial<Record<keyof FamilyPersonDraft, 'REQUIRED'>> | undefined {
  const errors: Partial<Record<keyof FamilyPersonDraft, 'REQUIRED'>> = {}
  for (const key of ['hoTen', 'namSinh', 'ngheNghiep', 'noiO'] as const) {
    if (!person[key].trim()) errors[key] = 'REQUIRED'
  }
  return Object.keys(errors).length ? errors : undefined
}

// in validateMemberRequiredFields:
if (!draft.photoPath && !draft.pendingPhoto) errors.photo = 'REQUIRED'

const cha = requireFamilyPerson(draft.giaDinh.cha)
const me = requireFamilyPerson(draft.giaDinh.me)
if (cha || me) errors.giaDinh = { ...(cha ? { cha } : {}), ...(me ? { me } : {}) }

const noiXuatGia = mapAddress(draft.noiXuatGia) // change mapAddress to pass lineRequired for this call only
```

Update `mapAddress` (or call `validateAddressDraft` directly for nơi xuất gia):

```ts
validateAddressDraft(draft.noiXuatGia, { required: true, lineRequired: true })
```

Leave `diaChiThuongTru` as `{ required: true }` without `lineRequired`.

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/components/filler/memberRequiredValidation.test.ts
```

- [ ] **Step 5: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/src/components/filler/memberRequiredValidation.ts \
  tanstack-app/src/components/filler/memberRequiredValidation.test.ts
git commit -m "$(cat <<'EOF'
feat(member): require portrait, parents, and ordination address line

EOF
)"
```

---

### Task 5: Wire form UI (fields, portrait, dates, copy)

**Files:**
- Modify: `tanstack-app/src/components/filler/MemberPortraitField.tsx`
- Modify: `tanstack-app/src/components/filler/MemberFormFields.tsx`
- Modify: `tanstack-app/src/components/filler/PreceptFields.tsx`
- Modify: `tanstack-app/src/components/filler/MemberPortraitField.test.tsx` (optional light assertion)

**Interfaces:**
- Consumes: Task 1 messages; Task 3 address props; Task 4 error shapes
- Produces: UI showing required/errors/descriptions/date format; no change to draft ISO storage

- [ ] **Step 1: Extend `MemberPortraitField` props**

```ts
required?: boolean
error?: string
```

Render label row with required indicator (e.g. Mantine `Input.Label` with `required`, or append visually consistent asterisk), description `m.filler_desc_anh_chan_dung()`, and `error` as red `Text` when set.

- [ ] **Step 2: Wire `MemberFormFields`**

1. `mapAddressErrors` — include line:

```ts
function mapAddressErrors(errors?: {
  city?: 'REQUIRED'
  ward?: 'REQUIRED'
  line?: 'REQUIRED'
}) {
  return {
    city: errors?.city === 'REQUIRED' ? m.filler_address_city_required() : undefined,
    ward: errors?.ward === 'REQUIRED' ? m.filler_address_ward_required() : undefined,
    line: errors?.line === 'REQUIRED' ? m.filler_error_field_required() : undefined,
  }
}
```

2. Nơi xuất gia `VietnamAddressFields`:

```tsx
lineLabel={m.filler_field_noi_xuat_gia_line()}
lineRequired
linePlaceholder={m.filler_ph_noi_xuat_gia_line()}
errors={mapAddressErrors(fieldErrors.noiXuatGia)}
```

3. Pass to portrait:

```tsx
required
error={mapRequiredError(fieldErrors.photo)}
description via MemberPortraitField internal key
```

4. Cha/mẹ inputs: `required` + `error={mapRequiredError(fieldErrors.giaDinh?.cha?.hoTen)}` (and same for other keys / `me`).

5. Every member `DateInput` in this file: `valueFormat="DD-MM-YYYY"` and `placeholder={m.filler_ph_date_dmy()}` where a generic date placeholder is appropriate. **Do not** change `MonthPickerInput` `MM/YYYY`.

6. Descriptions for hệ phái gốc / giáo đoàn gốc already use `m.filler_desc_*` — they pick up Task 1 copy automatically; no logic change beyond ensuring they still render.

- [ ] **Step 3: `PreceptFields`**

Change both `DateInput` `valueFormat` to `"DD-MM-YYYY"`. Keep the special `filler_field_precept_ngay_hp_placeholder` on hệ phái date; optionally add `placeholder={m.filler_ph_date_dmy()}` only on the GH date input.

- [ ] **Step 4: Light portrait test (optional but preferred)**

In `MemberPortraitField.test.tsx`, assert description text appears when rendered with default props.

- [ ] **Step 5: Run targeted tests**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run \
  src/components/filler/MemberPortraitField.test.tsx \
  src/components/address/VietnamAddressFields.test.tsx
```

Expected: PASS (fix any assertion mismatches).

- [ ] **Step 6: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/src/components/filler/MemberPortraitField.tsx \
  tanstack-app/src/components/filler/MemberPortraitField.test.tsx \
  tanstack-app/src/components/filler/MemberFormFields.tsx \
  tanstack-app/src/components/filler/PreceptFields.tsx
git commit -m "$(cat <<'EOF'
feat(member): wire required UI, DMY dates, and field descriptions

EOF
)"
```

---

### Task 6: Pass photo into validators at save call sites

**Files:**
- Modify: `tanstack-app/src/components/filler/MemberEditorForm.tsx`
- Modify: `tanstack-app/src/components/admin/MemberFormPage.tsx`

**Interfaces:**
- Consumes: `MemberFormFieldsApi.getPhotoPath` / `getPendingPhoto`; Task 4 `MemberRequiredDraft`
- Produces: validated save blocked when photo missing

- [ ] **Step 1: Update filler `handleSave`**

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
  photoPath: api.getPhotoPath(),
  pendingPhoto: api.getPendingPhoto(),
  giaDinh: {
    cha: draft.giaDinh.cha,
    me: draft.giaDinh.me,
  },
})
```

- [ ] **Step 2: Update admin `complete` the same way**

Do **not** change admin draft-save path (still no `validateMemberRequiredFields`).

- [ ] **Step 3: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/src/components/filler/MemberEditorForm.tsx \
  tanstack-app/src/components/admin/MemberFormPage.tsx
git commit -m "$(cat <<'EOF'
feat(member): validate portrait and family on filler/admin complete

EOF
)"
```

---

### Task 7: Update form integration tests + verify

**Files:**
- Modify: `tanstack-app/src/components/filler/MemberEditorForm.test.tsx`
- Modify: `tanstack-app/src/components/admin/MemberFormPage.test.tsx`

**Interfaces:**
- Consumes: Task 4/5/6 behavior
- Produces: green Vitest for member save happy paths and new required assertions

- [ ] **Step 1: Expand seeds**

In both test files, ensure save-happy-path seeds include:

```ts
noiXuatGia: { ...completeAddress, line: 'Tịnh xá A' },
photoPath: 'members/m1/photo.jpg', // or upload pending file in create flows that already do
giaDinh: {
  cha: { hoTen: 'A', namSinh: '1960', ngheNghiep: 'X', noiO: 'Y' },
  me: { hoTen: 'B', namSinh: '1962', ngheNghiep: 'Z', noiO: 'Y' },
},
```

For create flows that only set `pendingPhoto` via file upload before save, that still satisfies portrait validation — keep existing upload tests; ensure family + nơi xuất gia line are filled when asserting successful save.

- [ ] **Step 2: Add assertion for new copy / label**

In `MemberEditorForm.test.tsx` (description test or dedicated):

```ts
expect(screen.getByText(m.filler_desc_anh_chan_dung())).toBeTruthy()
expect(screen.getByText(m.filler_desc_he_phai_goc())).toBeTruthy()
expect(
  screen.getByRole('textbox', { name: m.filler_field_noi_xuat_gia_line() }),
).toBeTruthy()
```

- [ ] **Step 3: Add block-save coverage (filler)**

With empty family / no photo / empty nơi xuất gia line (one focused case or combined), click Lưu and expect `filler_error_field_required` (or photo error text) without successful save mock call.

- [ ] **Step 4: Run tests**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run \
  src/components/filler/memberRequiredValidation.test.ts \
  src/components/filler/MemberEditorForm.test.tsx \
  src/components/admin/MemberFormPage.test.tsx \
  src/domain/address.test.ts \
  src/components/address/VietnamAddressFields.test.tsx \
  src/components/filler/MemberPortraitField.test.tsx
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/src/components/filler/MemberEditorForm.test.tsx \
  tanstack-app/src/components/admin/MemberFormPage.test.tsx
git commit -m "$(cat <<'EOF'
test(member): cover new required fields and copy on member forms

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Portrait required (path or pending) | 4, 5, 6, 7 |
| Cha/mẹ all fields required | 4, 5, 7 |
| Nơi xuất gia line required + new label | 2, 3, 4, 5, 7 |
| Thường trú unchanged | Global + Task 4 (no lineRequired) |
| DateInput `dd-mm-yyyy` member only | 5 |
| `filler_ph_date_dmy` not shared temple key | 1, 5 |
| Descriptions portrait / hệ phái / giáo đoàn | 1, 5, 7 |
| Admin Lưu nháp skips validation | 6 |
| Vitest only | Global |

## Self-review notes

- No TBD placeholders; types for `MemberRequiredDraft` / address errors stay consistent across Tasks 2–6.
- `completeAddress` without `line` remains valid for thường trú; nơi xuất gia seeds must set `line`.
- Paraglide regenerated in Task 1 before UI imports new keys.
