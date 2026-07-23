# Member Nơi sinh / Nơi xuất gia Address Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace free-text `noiSinh` and `noiXuatGia` on the filler member form with required `VietnamAddressFields` pickers (city → ward → optional line), persisting `AddressValue`.

**Architecture:** Extend `validateAddressDraft` with `{ required?: boolean }`. Add optional `linePlaceholder` and `required` props on `VietnamAddressFields`. Wire both member fields like temple `diaChiCu`, with save blocked until city+ward are set. Legacy Firestore strings hydrate via existing `hydrateAddress`.

**Tech Stack:** React 19, Mantine 9, Paraglide, Vitest + Testing Library, existing `AddressValue` / `VietnamAddressFields`

**Spec:** `docs/superpowers/specs/2026-07-23-member-noi-sinh-xuat-gia-address-design.md`

## Global Constraints

- Work in the current workspace only — **never** `git worktree add`
- Before coding: create branch `feat/member-noi-sinh-xuat-gia-address` from `main` (Task 0)
- Scope: filler `MemberEditorForm` fields `noiSinh` + `noiXuatGia` only
- Do **not** change optional-when-blank behavior of `diaChiThuongTru` / temple addresses
- Do **not** touch `nguyenQuan`, history-row `diaChi`, precept places, or admin forms
- Prefer Vitest; **no new Cypress**
- After merge squash into `main`, delete the local feature branch unless asked otherwise

## File Structure

| File | Responsibility |
| --- | --- |
| `tanstack-app/src/domain/address.ts` | `validateAddressDraft(draft, { required? })` |
| `tanstack-app/src/domain/address.test.ts` | Required-mode validation tests |
| `tanstack-app/src/domain/types.ts` | `noiSinh` / `noiXuatGia` → `AddressValue \| string \| undefined` |
| `tanstack-app/src/components/address/VietnamAddressFields.tsx` | Optional `linePlaceholder`, `required` |
| `tanstack-app/src/components/address/VietnamAddressFields.test.tsx` | Prop behavior tests |
| `tanstack-app/messages/vi.json` | `filler_ph_noi_xuat_gia_line`; remove unused free-text keys |
| `tanstack-app/src/paraglide/*` | Regenerated via `pnpm paraglide` (do not hand-edit) |
| `tanstack-app/src/components/filler/MemberEditorForm.tsx` | Draft, UI, save validation for both fields |
| `tanstack-app/src/components/filler/MemberEditorForm.test.tsx` | Hydrate + required-save tests |

---

### Task 0: Create feature branch

**Files:** none

**Interfaces:**
- Consumes: none
- Produces: branch `feat/member-noi-sinh-xuat-gia-address`

- [ ] **Step 1: Branch from main**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git checkout main
git pull
git checkout -b feat/member-noi-sinh-xuat-gia-address
```

If not on `main` / dirty: stop and ask.

- [ ] **Step 2: Commit spec + plan if untracked**

If `docs/superpowers/specs/2026-07-23-member-noi-sinh-xuat-gia-address-design.md` and this plan are untracked:

```bash
git add docs/superpowers/specs/2026-07-23-member-noi-sinh-xuat-gia-address-design.md \
  docs/superpowers/plans/2026-07-23-member-noi-sinh-xuat-gia-address.md
git commit -m "$(cat <<'EOF'
docs: spec and plan for member noiSinh/noiXuatGia address pickers

EOF
)"
```

---

### Task 1: Required address validation

**Files:**
- Modify: `tanstack-app/src/domain/address.ts`
- Modify: `tanstack-app/src/domain/address.test.ts`
- Modify: `tanstack-app/src/domain/types.ts`

**Interfaces:**
- Consumes: existing `AddressDraft`, `isAddressBlank`
- Produces: `validateAddressDraft(draft: AddressDraft, options?: { required?: boolean }): AddressValidationResult`; `Member.noiSinh` / `Member.noiXuatGia` typed as `AddressValue | string | undefined`

- [ ] **Step 1: Write the failing tests**

Append to `tanstack-app/src/domain/address.test.ts` inside `describe('validateAddressDraft')`:

```ts
  it('rejects blank when required', () => {
    expect(validateAddressDraft(EMPTY_ADDRESS_DRAFT, { required: true })).toEqual({
      valid: false,
      errors: { city: 'REQUIRED', ward: 'REQUIRED' },
    })
  })

  it('rejects line-only when required', () => {
    expect(
      validateAddressDraft(
        { ...EMPTY_ADDRESS_DRAFT, line: '15 Ngõ 4' },
        { required: true },
      ),
    ).toEqual({
      valid: false,
      errors: { city: 'REQUIRED', ward: 'REQUIRED' },
    })
  })

  it('accepts complete address when required', () => {
    expect(
      validateAddressDraft(
        {
          cityCode: '01',
          cityName: 'Hà Nội',
          wardCode: '00013',
          wardName: 'Hà Đông',
          line: '',
        },
        { required: true },
      ),
    ).toEqual({ valid: true, errors: {} })
  })
```

Keep existing default-mode tests unchanged (blank still valid without options).

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd tanstack-app && pnpm vitest run src/domain/address.test.ts
```

Expected: FAIL — `validateAddressDraft` does not accept a second argument / blank still valid.

- [ ] **Step 3: Implement**

In `tanstack-app/src/domain/address.ts`, replace `validateAddressDraft` with:

```ts
export function validateAddressDraft(
  draft: AddressDraft,
  options?: { required?: boolean },
): AddressValidationResult {
  if (isAddressBlank(draft)) {
    if (options?.required) {
      return {
        valid: false,
        errors: { city: 'REQUIRED', ward: 'REQUIRED' },
      }
    }
    return { valid: true, errors: {} }
  }
  const errors: AddressValidationResult['errors'] = {}
  if (!draft.cityCode) errors.city = 'REQUIRED'
  if (!draft.wardCode) errors.ward = 'REQUIRED'
  return { valid: Object.keys(errors).length === 0, errors }
}
```

In `tanstack-app/src/domain/types.ts`, change:

```ts
  noiSinh?: AddressValue | string
  // ...
  noiXuatGia?: AddressValue | string
```

(`AddressValue` is already imported in that file for `diaChiThuongTru`.)

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd tanstack-app && pnpm vitest run src/domain/address.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/domain/address.ts \
  tanstack-app/src/domain/address.test.ts \
  tanstack-app/src/domain/types.ts
git commit -m "$(cat <<'EOF'
feat: support required mode on address draft validation

EOF
)"
```

---

### Task 2: VietnamAddressFields props + i18n

**Files:**
- Modify: `tanstack-app/src/components/address/VietnamAddressFields.tsx`
- Modify: `tanstack-app/src/components/address/VietnamAddressFields.test.tsx`
- Modify: `tanstack-app/messages/vi.json`
- Regenerate: `tanstack-app/src/paraglide/*` via `pnpm paraglide`

**Interfaces:**
- Consumes: `m.filler_ph_address_line()`, new `m.filler_ph_noi_xuat_gia_line()`
- Produces: `VietnamAddressFieldsProps` with optional `linePlaceholder?: string` and `required?: boolean`

- [ ] **Step 1: Add message keys**

In `tanstack-app/messages/vi.json`:

1. Add: `"filler_ph_noi_xuat_gia_line": "vd: Tịnh xá …"`
2. Delete unused keys if present and only used by the free-text fields being removed:
   - `filler_ph_noi_sinh`
   - `filler_ph_noi_xuat_gia`

Keep `filler_desc_noi_xuat_gia` (still shown above the picker).

- [ ] **Step 2: Compile Paraglide**

```bash
cd tanstack-app && pnpm paraglide
```

Expected: succeeds; `m.filler_ph_noi_xuat_gia_line` available.

- [ ] **Step 3: Write failing component tests**

Append to `tanstack-app/src/components/address/VietnamAddressFields.test.tsx`:

```ts
  it('uses custom linePlaceholder when provided', () => {
    renderFields({ linePlaceholder: 'vd: Tịnh xá …' })
    expect(screen.getByPlaceholderText('vd: Tịnh xá …')).toBeTruthy()
  })

  it('marks city and ward required when required prop is set', () => {
    renderFields({ required: true })
    expect(
      screen.getByRole('combobox', { name: m.filler_field_city() }),
    ).toBeRequired()
    expect(
      screen.getByRole('combobox', { name: m.filler_field_ward() }),
    ).toBeRequired()
    expect(
      screen.getByRole('textbox', { name: m.filler_field_address_line() }),
    ).not.toBeRequired()
  })
```

If `toBeRequired()` is awkward with Mantine Select, assert via accessible name containing `*` or `aria-required="true"` — prefer checking the label text includes `*` from Mantine `required` prop.

- [ ] **Step 4: Run tests to verify they fail**

```bash
cd tanstack-app && pnpm vitest run src/components/address/VietnamAddressFields.test.tsx
```

Expected: FAIL — unknown props / default placeholder only.

- [ ] **Step 5: Implement props**

Update `VietnamAddressFieldsProps`:

```ts
export type VietnamAddressFieldsProps = {
  label?: string
  value: AddressDraft
  onChange: (value: AddressDraft) => void
  disabled?: boolean
  errors?: { city?: string; ward?: string }
  linePlaceholder?: string
  required?: boolean
}
```

Pass `required` into `LocationSelects` and set `required={required}` on both city and ward `Select`s.

On the line `TextInput`:

```tsx
placeholder={linePlaceholder ?? m.filler_ph_address_line()}
```

Do **not** set `required` on the line input.

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd tanstack-app && pnpm vitest run src/components/address/VietnamAddressFields.test.tsx
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add tanstack-app/src/components/address/VietnamAddressFields.tsx \
  tanstack-app/src/components/address/VietnamAddressFields.test.tsx \
  tanstack-app/messages/vi.json \
  tanstack-app/src/paraglide
git commit -m "$(cat <<'EOF'
feat: add linePlaceholder and required props to address fields

EOF
)"
```

---

### Task 3: Wire MemberEditorForm

**Files:**
- Modify: `tanstack-app/src/components/filler/MemberEditorForm.tsx`
- Modify: `tanstack-app/src/components/filler/MemberEditorForm.test.tsx`

**Interfaces:**
- Consumes: `hydrateAddress`, `addressDraftToValue`, `validateAddressDraft(..., { required: true })`, `VietnamAddressFields` with `required` / `linePlaceholder`
- Produces: draft fields `noiSinh: AddressDraft`, `noiXuatGia: AddressDraft`; save blocked until both pass required validation; patch writes `AddressValue`

- [ ] **Step 1: Write failing member form tests**

Append to `tanstack-app/src/components/filler/MemberEditorForm.test.tsx`:

```ts
  it('hydrates legacy noiSinh string into line field', () => {
    renderForm({
      initial: {
        noiSinh: 'Cũ nơi sinh' as unknown as Member['noiSinh'],
      },
    })
    expect(screen.getByDisplayValue('Cũ nơi sinh')).toBeTruthy()
  })

  it('blocks save when noiSinh and noiXuatGia lack city and ward', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: m.filler_save() }))

    expect(saveMemberDraftMock).not.toHaveBeenCalled()
    expect(screen.getAllByText(m.filler_address_city_required()).length).toBeGreaterThanOrEqual(1)
  })
```

Note: after wiring, the form will have **three** address line textboxes (`diaChiThuongTru`, `noiSinh`, `noiXuatGia`). Existing test that uses `getByRole('textbox', { name: m.filler_field_address_line() })` will break — update it to target the permanent-address block, e.g.:

```ts
const permanent = screen.getByLabelText(m.filler_field_dia_chi_thuong_tru())
await user.type(
  within(permanent).getByRole('textbox', { name: m.filler_field_address_line() }),
  '15 Ngõ 4',
)
```

Import `within` from `@testing-library/react` if missing.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd tanstack-app && pnpm vitest run src/components/filler/MemberEditorForm.test.tsx
```

Expected: FAIL on new assertions / ambiguous address line queries.

- [ ] **Step 3: Update draft + patch**

In `MemberDraft`:

```ts
  noiSinh: AddressDraft
  // ...
  noiXuatGia: AddressDraft
```

In `emptyMemberDraft`:

```ts
  noiSinh: hydrateAddress(initial.noiSinh),
  // ...
  noiXuatGia: hydrateAddress(initial.noiXuatGia),
```

In `buildPatch`:

```ts
  noiSinh: addressDraftToValue(draft.noiSinh),
  // ...
  noiXuatGia: addressDraftToValue(draft.noiXuatGia),
```

- [ ] **Step 4: Replace UI fields**

**Nơi sinh** (identity section) — replace `TextInput` with:

```tsx
<Stack gap="xs">
  <Text fw={600}>
    {m.filler_field_noi_sinh()}
  </Text>
  <VietnamAddressFields
    label={m.filler_field_noi_sinh()}
    value={draft.noiSinh}
    onChange={(value) => updateDraft('noiSinh', value)}
    disabled={disabled}
    required
    errors={noiSinhAddressErrors}
  />
</Stack>
```

**Nơi xuất gia** (xuất gia section) — replace `TextInput` with a full-width block (move out of the 2-col grid or span full width):

```tsx
<Stack gap="xs">
  <Stack gap={2}>
    <Text fw={600}>{m.filler_field_noi_xuat_gia()}</Text>
    <Text size="xs" c="dimmed">
      {m.filler_desc_noi_xuat_gia()}
    </Text>
  </Stack>
  <VietnamAddressFields
    label={m.filler_field_noi_xuat_gia()}
    value={draft.noiXuatGia}
    onChange={(value) => updateDraft('noiXuatGia', value)}
    disabled={disabled}
    required
    linePlaceholder={m.filler_ph_noi_xuat_gia_line()}
    errors={noiXuatGiaAddressErrors}
  />
</Stack>
```

Use stable `useCallback` handlers if the file already does that for `diaChiThuongTru`; otherwise inline `updateDraft` is fine if draft uses `AddressDraft` values.

- [ ] **Step 5: Save validation**

Expand address error state:

```ts
const [noiSinhAddressErrors, setNoiSinhAddressErrors] = useState<{
  city?: string
  ward?: string
}>({})
const [noiXuatGiaAddressErrors, setNoiXuatGiaAddressErrors] = useState<{
  city?: string
  ward?: string
}>({})
```

Keep existing `addressErrors` for `diaChiThuongTru`.

Helper (module-level or inside component):

```ts
function mapAddressErrors(result: ReturnType<typeof validateAddressDraft>) {
  return {
    city:
      result.errors.city === 'REQUIRED'
        ? m.filler_address_city_required()
        : undefined,
    ward:
      result.errors.ward === 'REQUIRED'
        ? m.filler_address_ward_required()
        : undefined,
  }
}
```

In `onSave`:

```ts
const thuongTru = validateAddressDraft(draft.diaChiThuongTru)
const noiSinh = validateAddressDraft(draft.noiSinh, { required: true })
const noiXuatGia = validateAddressDraft(draft.noiXuatGia, { required: true })

if (!thuongTru.valid || !noiSinh.valid || !noiXuatGia.valid) {
  setAddressErrors(mapAddressErrors(thuongTru))
  setNoiSinhAddressErrors(mapAddressErrors(noiSinh))
  setNoiXuatGiaAddressErrors(mapAddressErrors(noiXuatGia))
  return
}
setAddressErrors({})
setNoiSinhAddressErrors({})
setNoiXuatGiaAddressErrors({})
saveMutation.mutate()
```

Update `useMemo` dependency arrays for identity / xuất gia sections to include the new drafts and error objects.

- [ ] **Step 6: Run member form tests**

```bash
cd tanstack-app && pnpm vitest run src/components/filler/MemberEditorForm.test.tsx
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add tanstack-app/src/components/filler/MemberEditorForm.tsx \
  tanstack-app/src/components/filler/MemberEditorForm.test.tsx
git commit -m "$(cat <<'EOF'
feat: use required address pickers for noiSinh and noiXuatGia

EOF
)"
```

---

### Task 4: Verification

**Files:** none (run only)

**Interfaces:**
- Consumes: Tasks 1–3
- Produces: green targeted test suite

- [ ] **Step 1: Run related tests**

```bash
cd tanstack-app && pnpm vitest run \
  src/domain/address.test.ts \
  src/components/address/VietnamAddressFields.test.tsx \
  src/components/filler/MemberEditorForm.test.tsx
```

Expected: all PASS

- [ ] **Step 2: Typecheck if project script exists**

```bash
cd tanstack-app && pnpm exec tsc --noEmit
```

Expected: no errors related to `noiSinh` / `noiXuatGia` types. If `tsc` is not configured, skip and rely on Vitest + Vite build.

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| `validateAddressDraft(..., { required: true })` | Task 1 |
| Domain types `AddressValue \| string` for both fields | Task 1 |
| `linePlaceholder` + `required` on `VietnamAddressFields` | Task 2 |
| i18n `filler_ph_noi_xuat_gia_line` | Task 2 |
| Member draft hydrate / patch / UI / save gate | Task 3 |
| Vitest coverage; no Cypress | Tasks 1–4 |
| Leave `diaChiThuongTru` optional-when-blank | Task 3 (default validate) |
