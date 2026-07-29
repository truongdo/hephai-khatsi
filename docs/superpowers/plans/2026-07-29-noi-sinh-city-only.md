# Nơi sinh City-Only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make member **Nơi sinh** city-only (Tỉnh / Thành phố); strip ward/line on every save.

**Architecture:** Extend `validateAddressDraft` / `addressDraftToValue` with `{ cityOnly?: boolean }`. Add `cityOnly` prop on `VietnamAddressFields` to hide ward + line. Wire `noiSinh` only through validation, patch build, and form UI; leave other addresses on full city→ward→line.

**Tech Stack:** React 19, Mantine, Vitest + Testing Library, existing `AddressValue` / `VietnamAddressFields`

**Spec:** `docs/superpowers/specs/2026-07-29-noi-sinh-city-only-design.md`

## Global Constraints

- Work in the current workspace only — **never** `git worktree add`
- Before coding: create branch `feat/noi-sinh-city-only` from `main` (Task 0)
- Scope: `noiSinh` only — do **not** change `noiXuatGia`, `diaChiThuongTru`, or temple addresses
- Do **not** change `AddressValue` / `AddressDraft` field shapes
- Prefer Vitest; **no new Cypress**
- After merge squash into `main`, delete the local feature branch unless asked otherwise

## File Structure

| File | Responsibility |
| --- | --- |
| `tanstack-app/src/domain/address.ts` | `cityOnly` on validate + convert; strip ward/line when converting |
| `tanstack-app/src/domain/address.test.ts` | City-only validate/convert tests |
| `tanstack-app/src/components/address/VietnamAddressFields.tsx` | `cityOnly` prop hides ward + line |
| `tanstack-app/src/components/address/VietnamAddressFields.test.tsx` | Assert city-only UI |
| `tanstack-app/src/components/filler/memberRequiredValidation.ts` | `noiSinh` validates with `cityOnly: true` |
| `tanstack-app/src/components/filler/memberRequiredValidation.test.ts` | Expect city-only errors for blank `noiSinh` |
| `tanstack-app/src/components/filler/memberDraft.ts` | `addressDraftToValue(draft.noiSinh, { cityOnly: true })` |
| `tanstack-app/src/components/filler/MemberFormFields.tsx` | Pass `cityOnly` to Nơi sinh picker |

---

### Task 0: Create feature branch

**Files:** none

**Interfaces:**
- Consumes: none
- Produces: branch `feat/noi-sinh-city-only`

- [ ] **Step 1: Branch from main**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git checkout main
git pull
git checkout -b feat/noi-sinh-city-only
```

If not on `main` or working tree has unrelated dirty files you should not carry: stop and ask (stash/commit vs continue).

- [ ] **Step 2: Ensure spec + plan are committed**

If this plan or the spec are uncommitted on the branch:

```bash
git add docs/superpowers/specs/2026-07-29-noi-sinh-city-only-design.md \
  docs/superpowers/plans/2026-07-29-noi-sinh-city-only.md
git commit -m "$(cat <<'EOF'
docs: plan Nơi sinh city-only on member form

EOF
)"
```

---

### Task 1: Domain — city-only validate + convert

**Files:**
- Modify: `tanstack-app/src/domain/address.ts`
- Modify: `tanstack-app/src/domain/address.test.ts`

**Interfaces:**
- Consumes: existing `AddressDraft`, `AddressValue`, `validateAddressDraft`, `addressDraftToValue`
- Produces:
  - `validateAddressDraft(draft, options?: { required?: boolean; cityOnly?: boolean }): AddressValidationResult`
  - `addressDraftToValue(draft, options?: { cityOnly?: boolean }): AddressValue | undefined`

- [ ] **Step 1: Write the failing tests**

Add to `tanstack-app/src/domain/address.test.ts`:

```typescript
describe('validateAddressDraft cityOnly', () => {
  it('rejects blank when required with city error only', () => {
    expect(
      validateAddressDraft(EMPTY_ADDRESS_DRAFT, {
        required: true,
        cityOnly: true,
      }),
    ).toEqual({
      valid: false,
      errors: { city: 'REQUIRED' },
    })
  })

  it('accepts city without ward when cityOnly', () => {
    expect(
      validateAddressDraft(
        {
          ...EMPTY_ADDRESS_DRAFT,
          cityCode: '01',
          cityName: 'Hà Nội',
        },
        { required: true, cityOnly: true },
      ),
    ).toEqual({ valid: true, errors: {} })
  })

  it('ignores ward requirement when cityOnly even if line set', () => {
    expect(
      validateAddressDraft(
        {
          ...EMPTY_ADDRESS_DRAFT,
          cityCode: '01',
          cityName: 'Hà Nội',
          line: '15 Ngõ 4',
        },
        { cityOnly: true },
      ),
    ).toEqual({ valid: true, errors: {} })
  })
})

describe('addressDraftToValue cityOnly', () => {
  it('emits city with empty ward and omits line', () => {
    expect(
      addressDraftToValue(
        {
          cityCode: '01',
          cityName: 'Hà Nội',
          wardCode: '00013',
          wardName: 'Hà Đông',
          line: '15 Ngõ 4',
        },
        { cityOnly: true },
      ),
    ).toEqual({
      cityCode: '01',
      cityName: 'Hà Nội',
      wardCode: '',
      wardName: '',
    })
  })

  it('returns undefined when city missing in cityOnly mode', () => {
    expect(
      addressDraftToValue(
        { ...EMPTY_ADDRESS_DRAFT, wardCode: '00013', wardName: 'Hà Đông' },
        { cityOnly: true },
      ),
    ).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/domain/address.test.ts
```

Expected: FAIL — `cityOnly` option not implemented / unexpected ward errors / convert still requires ward.

- [ ] **Step 3: Implement**

In `tanstack-app/src/domain/address.ts`, update signatures and logic:

```typescript
export function validateAddressDraft(
  draft: AddressDraft,
  options?: { required?: boolean; cityOnly?: boolean },
): AddressValidationResult {
  const cityOnly = options?.cityOnly === true

  if (isAddressBlank(draft)) {
    if (options?.required) {
      return {
        valid: false,
        errors: cityOnly
          ? { city: 'REQUIRED' }
          : { city: 'REQUIRED', ward: 'REQUIRED' },
      }
    }
    return { valid: true, errors: {} }
  }

  const errors: AddressValidationResult['errors'] = {}
  if (!draft.cityCode) errors.city = 'REQUIRED'
  if (!cityOnly && !draft.wardCode) errors.ward = 'REQUIRED'
  return { valid: Object.keys(errors).length === 0, errors }
}

export function addressDraftToValue(
  draft: AddressDraft,
  options?: { cityOnly?: boolean },
): AddressValue | undefined {
  if (options?.cityOnly) {
    if (!draft.cityCode) return undefined
    return {
      cityCode: draft.cityCode,
      cityName: draft.cityName,
      wardCode: '',
      wardName: '',
    }
  }
  if (!validateAddressDraft(draft).valid) return undefined
  if (isAddressBlank(draft)) return undefined
  const line = draft.line.trim()
  return {
    cityCode: draft.cityCode,
    cityName: draft.cityName,
    wardCode: draft.wardCode,
    wardName: draft.wardName,
    ...(line ? { line } : {}),
  }
}
```

Keep default (non–`cityOnly`) behavior identical to today.

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm exec vitest run src/domain/address.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/address.ts src/domain/address.test.ts
git commit -m "$(cat <<'EOF'
feat: support city-only address validate and convert

EOF
)"
```

(Run `git add` from `tanstack-app/` or use full paths from repo root.)

---

### Task 2: Member required validation — `noiSinh` city-only

**Files:**
- Modify: `tanstack-app/src/components/filler/memberRequiredValidation.ts`
- Modify: `tanstack-app/src/components/filler/memberRequiredValidation.test.ts`

**Interfaces:**
- Consumes: `validateAddressDraft(draft, { required: true, cityOnly: true })`
- Produces: `errors.noiSinh` may be `{ city: 'REQUIRED' }` only (type may still allow optional `ward?`)

- [ ] **Step 1: Write the failing test updates**

In `memberRequiredValidation.test.ts`, change the blank-`noiSinh` expectation:

```typescript
expect(result.errors.noiSinh).toEqual({
  city: 'REQUIRED',
})
```

Keep `diaChiThuongTru` expecting `{ city: 'REQUIRED', ward: 'REQUIRED' }`.

Add:

```typescript
it('accepts noiSinh with city only', () => {
  expect(
    validateMemberRequiredFields(
      filledDraft({
        noiSinh: {
          ...EMPTY_ADDRESS_DRAFT,
          cityCode: '01',
          cityName: 'Hà Nội',
        },
      }),
    ),
  ).toEqual({ valid: true, errors: {} })
})
```

- [ ] **Step 2: Run test to verify failure**

```bash
pnpm exec vitest run src/components/filler/memberRequiredValidation.test.ts
```

Expected: FAIL on blank `noiSinh` still including `ward`, and/or city-only draft rejected.

- [ ] **Step 3: Implement**

In `memberRequiredValidation.ts`:

```typescript
function mapAddress(
  draft: AddressDraft,
  options?: { cityOnly?: boolean },
): { city?: 'REQUIRED'; ward?: 'REQUIRED' } | undefined {
  const result = validateAddressDraft(draft, {
    required: true,
    cityOnly: options?.cityOnly,
  })
  if (result.valid) return undefined
  return result.errors
}

// in validateMemberRequiredFields:
const noiSinh = mapAddress(draft.noiSinh, { cityOnly: true })
if (noiSinh) errors.noiSinh = noiSinh
const diaChiThuongTru = mapAddress(draft.diaChiThuongTru)
if (diaChiThuongTru) errors.diaChiThuongTru = diaChiThuongTru
const noiXuatGia = mapAddress(draft.noiXuatGia)
if (noiXuatGia) errors.noiXuatGia = noiXuatGia
```

- [ ] **Step 4: Run tests**

```bash
pnpm exec vitest run src/components/filler/memberRequiredValidation.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/filler/memberRequiredValidation.ts \
  src/components/filler/memberRequiredValidation.test.ts
git commit -m "$(cat <<'EOF'
feat: require only city for member noiSinh

EOF
)"
```

---

### Task 3: Strip ward/line when building member patch

**Files:**
- Modify: `tanstack-app/src/components/filler/memberDraft.ts`
- Test: reuse `tanstack-app/src/domain/address.test.ts` (already covers convert); optionally add a focused assertion in an existing member draft test if one covers `buildMemberPatch` — if none exists, skip new file and rely on Task 1 + wiring here

**Interfaces:**
- Consumes: `addressDraftToValue(draft, { cityOnly: true })`
- Produces: `buildMemberPatch` writes city-only `noiSinh`

- [ ] **Step 1: Change patch build**

In `buildMemberPatch`:

```typescript
noiSinh: addressDraftToValue(draft.noiSinh, { cityOnly: true }),
```

Leave:

```typescript
diaChiThuongTru: addressDraftToValue(draft.diaChiThuongTru),
noiXuatGia: addressDraftToValue(draft.noiXuatGia),
```

- [ ] **Step 2: Smoke-check related tests**

```bash
pnpm exec vitest run src/components/filler/MemberEditorForm.test.tsx src/components/admin/MemberFormPage.test.tsx
```

Expected: PASS (fixtures already use complete addresses; city-only convert still emits city).

- [ ] **Step 3: Commit**

```bash
git add src/components/filler/memberDraft.ts
git commit -m "$(cat <<'EOF'
feat: persist noiSinh as city-only on member save

EOF
)"
```

---

### Task 4: UI — `VietnamAddressFields` city-only + wire Nơi sinh

**Files:**
- Modify: `tanstack-app/src/components/address/VietnamAddressFields.tsx`
- Modify: `tanstack-app/src/components/address/VietnamAddressFields.test.tsx`
- Modify: `tanstack-app/src/components/filler/MemberFormFields.tsx`

**Interfaces:**
- Consumes: `cityOnly?: boolean` prop
- Produces: when `cityOnly`, only city `Select` is rendered; ward + line hidden

- [ ] **Step 1: Write failing UI test**

In `VietnamAddressFields.test.tsx`:

```typescript
it('hides ward and line when cityOnly', () => {
  renderFields({ cityOnly: true })
  expect(
    screen.getByLabelText(m.filler_field_city()),
  ).toBeTruthy()
  expect(
    screen.queryByLabelText(m.filler_field_ward()),
  ).toBeNull()
  expect(
    screen.queryByLabelText(m.filler_field_address_line()),
  ).toBeNull()
})
```

(Use the same label matchers as existing tests in that file if they differ.)

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm exec vitest run src/components/address/VietnamAddressFields.test.tsx
```

Expected: FAIL — `cityOnly` unknown / ward still present.

- [ ] **Step 3: Implement UI prop**

In `VietnamAddressFields.tsx`:

```typescript
export type VietnamAddressFieldsProps = {
  label?: string
  value: AddressDraft
  onChange: (value: AddressDraft) => void
  disabled?: boolean
  errors?: { city?: string; ward?: string }
  linePlaceholder?: string
  required?: boolean
  cityOnly?: boolean
}
```

When `cityOnly`:

- Render only the city `Select` (reuse the same city options / `handleCityChange` behavior; clearing city still clears ward fields in draft via existing `onLocationChange`).
- Do **not** render ward `Select` or line `TextInput`.
- Simplest structure: if `cityOnly`, return a `Stack` with a single city `Select`; else keep current layout.

Minimal city-only branch (keep existing full layout in the `else`):

```typescript
if (cityOnly) {
  return (
    <Stack gap="sm" aria-label={label}>
      <Select
        label={m.filler_field_city()}
        placeholder={m.filler_ph_city()}
        data={/* same cityOptions as LocationSelects */}
        value={value.cityCode || null}
        onChange={(nextCityCode) => {
          const city = cities.find((item) => item.code === nextCityCode)
          onChange({
            cityCode: nextCityCode ?? '',
            cityName: city?.name ?? '',
            wardCode: '',
            wardName: '',
            line: '',
          })
        }}
        searchable
        disabled={disabled}
        required={required}
        error={errors?.city}
      />
    </Stack>
  )
}
```

Prefer extracting shared city options rather than duplicating large logic if easy; avoid refactors beyond what’s needed.

- [ ] **Step 4: Wire MemberFormFields**

In `MemberFormFields.tsx` Nơi sinh block:

```tsx
<VietnamAddressFields
  label={m.filler_field_noi_sinh()}
  value={draft.noiSinh}
  onChange={onNoiSinhChange}
  disabled={disabled}
  required
  cityOnly
  errors={mapAddressErrors(fieldErrors.noiSinh)}
/>
```

Do **not** pass `cityOnly` on `diaChiThuongTru` or `noiXuatGia`.

- [ ] **Step 5: Run tests**

```bash
pnpm exec vitest run \
  src/components/address/VietnamAddressFields.test.tsx \
  src/components/filler/MemberEditorForm.test.tsx \
  src/components/admin/MemberFormPage.test.tsx \
  src/domain/address.test.ts \
  src/components/filler/memberRequiredValidation.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add \
  src/components/address/VietnamAddressFields.tsx \
  src/components/address/VietnamAddressFields.test.tsx \
  src/components/filler/MemberFormFields.tsx
git commit -m "$(cat <<'EOF'
feat: show only province for member nơi sinh

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| UI city-only for Nơi sinh | Task 4 |
| Required city only | Tasks 1–2 |
| Persist strip ward/line on save | Tasks 1, 3 |
| Other addresses unchanged | Tasks 2–4 (explicit non-wiring) |
| No `AddressValue` shape change | Task 1 |
| No Cypress | Global constraints |

## Self-review notes

- No placeholders left in steps.
- `cityOnly` naming is consistent across domain, validation, UI, and patch.
- Default `addressDraftToValue` / `validateAddressDraft` paths remain ward-required for non–city-only callers.
