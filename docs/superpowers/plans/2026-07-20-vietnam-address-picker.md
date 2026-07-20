# Vietnam Address Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace filler temple/member free-text address fields with a shared city → ward → line picker backed by a split Vietnam location catalog, persisting structured `AddressValue` in Firestore.

**Architecture:** Add `AddressValue` domain type + hydrate/validate/format helpers. Generate `cities.json` + per-city `wards/{code}.json` from `city_wards.json`; runtime module eager-loads cities and lazy-loads wards via `import.meta.glob`. Shared `VietnamAddressFields` Mantine component wires into `TempleEditorForm` and `MemberEditorForm`. Admin temple form gets a minimal display shim only.

**Tech Stack:** React 19, Mantine 9 (`Select` searchable), Vite 8, Paraglide, Vitest + Testing Library, Firebase Firestore (existing repos)

**Spec:** `docs/superpowers/specs/2026-07-20-vietnam-address-picker-design.md`

## Global Constraints

- Work in the current workspace only — **never** `git worktree add`
- Before coding: create branch `feat/vietnam-address-picker` from `main` (Task 0)
- Scope: filler `diaChiCu`, `diaChiMoi`, `diaChiThuongTru` only — **not** admin picker, not `noiSinh` / `nguyenQuan` / history-row `diaChi`
- Persist `AddressValue` object (codes + names + optional `line`); omit field when blank
- Legacy Firestore string → hydrate as `{ line: oldString }` with empty city/ward
- Validation: blank address OK; if any part filled → city **and** ward required; line optional
- Do **not** eager-import full `city_wards.json` in UI — use split catalog + lazy ward loads
- Prefer Vitest; **no new Cypress**
- After merge squash into `main`, delete the local feature branch unless asked otherwise

## File Structure

| File | Responsibility |
| --- | --- |
| `tanstack-app/city_wards.json` | Source-of-truth catalog (regeneratable) |
| `tanstack-app/scripts/split-city-wards.ts` | Derive cities + per-city ward JSON |
| `tanstack-app/src/data/vietnam-locations/cities.json` | Slim city list (generated, committed) |
| `tanstack-app/src/data/vietnam-locations/wards/*.json` | Per-city ward arrays (generated, committed) |
| `tanstack-app/src/data/vietnam-locations/types.ts` | `City`, `Ward` catalog types |
| `tanstack-app/src/data/vietnam-locations/index.ts` | `cities` export + cached `getWards()` |
| `tanstack-app/src/domain/address.ts` | `AddressValue`, hydrate, validate, format helpers |
| `tanstack-app/src/domain/types.ts` | Change 3 address fields to `AddressValue?` |
| `tanstack-app/src/components/address/VietnamAddressFields.tsx` | Shared picker UI |
| `tanstack-app/src/components/filler/TempleEditorForm.tsx` | Wire 2 address pickers + save validation |
| `tanstack-app/src/components/filler/MemberEditorForm.tsx` | Wire 1 address picker + save validation |
| `tanstack-app/src/components/admin/TempleFormPage.tsx` | Display shim for `AddressValue \| string` |
| `tanstack-app/messages/vi.json` | City/ward/line labels + validation copy |

---

### Task 0: Create feature branch

**Files:** none

**Interfaces:**
- Consumes: none
- Produces: branch `feat/vietnam-address-picker`

- [ ] **Step 1: Branch from main**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git checkout main
git pull
git checkout -b feat/vietnam-address-picker
```

If not on `main` / dirty: stop and ask.

---

### Task 1: Domain address type + helpers

**Files:**
- Create: `tanstack-app/src/domain/address.ts`
- Create: `tanstack-app/src/domain/address.test.ts`
- Modify: `tanstack-app/src/domain/types.ts`

**Interfaces:**
- Consumes: none
- Produces: `AddressValue`, `AddressDraft`, `EMPTY_ADDRESS_DRAFT`, `hydrateAddress`, `addressDraftToValue`, `validateAddressDraft`, `formatAddressDisplay`, `isAddressBlank`

- [ ] **Step 1: Write the failing tests**

Create `tanstack-app/src/domain/address.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  EMPTY_ADDRESS_DRAFT,
  addressDraftToValue,
  formatAddressDisplay,
  hydrateAddress,
  isAddressBlank,
  validateAddressDraft,
} from './address'

describe('hydrateAddress', () => {
  it('returns empty draft for undefined', () => {
    expect(hydrateAddress(undefined)).toEqual(EMPTY_ADDRESS_DRAFT)
  })

  it('maps legacy string to line only', () => {
    expect(hydrateAddress('123 Đường Láng')).toEqual({
      ...EMPTY_ADDRESS_DRAFT,
      line: '123 Đường Láng',
    })
  })

  it('maps structured value', () => {
    expect(
      hydrateAddress({
        cityCode: '01',
        cityName: 'Hà Nội',
        wardCode: '00013',
        wardName: 'Hà Đông',
        line: '15 Ngõ 4',
      }),
    ).toEqual({
      cityCode: '01',
      cityName: 'Hà Nội',
      wardCode: '00013',
      wardName: 'Hà Đông',
      line: '15 Ngõ 4',
    })
  })
})

describe('addressDraftToValue', () => {
  it('returns undefined for blank draft', () => {
    expect(addressDraftToValue(EMPTY_ADDRESS_DRAFT)).toBeUndefined()
  })

  it('omits empty line', () => {
    expect(
      addressDraftToValue({
        cityCode: '01',
        cityName: 'Hà Nội',
        wardCode: '00013',
        wardName: 'Hà Đông',
        line: '   ',
      }),
    ).toEqual({
      cityCode: '01',
      cityName: 'Hà Nội',
      wardCode: '00013',
      wardName: 'Hà Đông',
    })
  })
})

describe('validateAddressDraft', () => {
  it('allows fully blank', () => {
    expect(validateAddressDraft(EMPTY_ADDRESS_DRAFT)).toEqual({
      valid: true,
      errors: {},
    })
  })

  it('requires city and ward when line is set', () => {
    expect(
      validateAddressDraft({ ...EMPTY_ADDRESS_DRAFT, line: '15 Ngõ 4' }),
    ).toEqual({
      valid: false,
      errors: { city: 'REQUIRED', ward: 'REQUIRED' },
    })
  })

  it('requires ward when only city is set', () => {
    expect(
      validateAddressDraft({
        ...EMPTY_ADDRESS_DRAFT,
        cityCode: '01',
        cityName: 'Hà Nội',
      }),
    ).toEqual({
      valid: false,
      errors: { ward: 'REQUIRED' },
    })
  })

  it('accepts complete address', () => {
    expect(
      validateAddressDraft({
        cityCode: '01',
        cityName: 'Hà Nội',
        wardCode: '00013',
        wardName: 'Hà Đông',
        line: '',
      }),
    ).toEqual({ valid: true, errors: {} })
  })
})

describe('formatAddressDisplay', () => {
  it('formats structured value', () => {
    expect(
      formatAddressDisplay({
        cityCode: '01',
        cityName: 'Hà Nội',
        wardCode: '00013',
        wardName: 'Hà Đông',
        line: '15 Ngõ 4',
      }),
    ).toBe('15 Ngõ 4, Hà Đông, Hà Nội')
  })

  it('passes through legacy string', () => {
    expect(formatAddressDisplay('123 Đường A')).toBe('123 Đường A')
  })
})

describe('isAddressBlank', () => {
  it('detects blank', () => {
    expect(isAddressBlank(EMPTY_ADDRESS_DRAFT)).toBe(true)
    expect(
      isAddressBlank({ ...EMPTY_ADDRESS_DRAFT, line: '  ' }),
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd tanstack-app
pnpm vitest run src/domain/address.test.ts
```

Expected: FAIL — cannot find module `./address`

- [ ] **Step 3: Implement address helpers + update domain types**

Create `tanstack-app/src/domain/address.ts`:

```ts
export type AddressValue = {
  cityCode: string
  cityName: string
  wardCode: string
  wardName: string
  line?: string
}

export type AddressDraft = {
  cityCode: string
  cityName: string
  wardCode: string
  wardName: string
  line: string
}

export const EMPTY_ADDRESS_DRAFT: AddressDraft = {
  cityCode: '',
  cityName: '',
  wardCode: '',
  wardName: '',
  line: '',
}

export function isAddressBlank(draft: AddressDraft): boolean {
  return !draft.cityCode && !draft.wardCode && !draft.line.trim()
}

export function hydrateAddress(
  value: string | AddressValue | undefined,
): AddressDraft {
  if (!value) return { ...EMPTY_ADDRESS_DRAFT }
  if (typeof value === 'string') {
    return { ...EMPTY_ADDRESS_DRAFT, line: value }
  }
  return {
    cityCode: value.cityCode,
    cityName: value.cityName,
    wardCode: value.wardCode,
    wardName: value.wardName,
    line: value.line ?? '',
  }
}

export function addressDraftToValue(
  draft: AddressDraft,
): AddressValue | undefined {
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

export type AddressValidationResult = {
  valid: boolean
  errors: { city?: 'REQUIRED'; ward?: 'REQUIRED' }
}

export function validateAddressDraft(
  draft: AddressDraft,
): AddressValidationResult {
  if (isAddressBlank(draft)) {
    return { valid: true, errors: {} }
  }
  const errors: AddressValidationResult['errors'] = {}
  if (!draft.cityCode) errors.city = 'REQUIRED'
  if (!draft.wardCode) errors.ward = 'REQUIRED'
  return { valid: Object.keys(errors).length === 0, errors }
}

export function formatAddressDisplay(
  value: string | AddressValue | undefined,
): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  return [value.line, value.wardName, value.cityName].filter(Boolean).join(', ')
}
```

In `tanstack-app/src/domain/types.ts`, add import and change three fields:

```ts
import type { AddressValue } from './address'

// Member:
diaChiThuongTru?: AddressValue

// Temple:
diaChiCu?: AddressValue
diaChiMoi?: AddressValue
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd tanstack-app
pnpm vitest run src/domain/address.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/domain/address.ts tanstack-app/src/domain/address.test.ts tanstack-app/src/domain/types.ts
git commit -m "$(cat <<'EOF'
feat: add AddressValue domain type and helpers

EOF
)"
```

---

### Task 2: Split location catalog from city_wards.json

**Files:**
- Create: `tanstack-app/scripts/split-city-wards.ts`
- Add: `tanstack-app/city_wards.json` (source, if not already tracked)
- Generate: `tanstack-app/src/data/vietnam-locations/cities.json`
- Generate: `tanstack-app/src/data/vietnam-locations/wards/*.json`
- Modify: `tanstack-app/package.json` (add script)

**Interfaces:**
- Consumes: `tanstack-app/city_wards.json`
- Produces: generated JSON under `src/data/vietnam-locations/`

- [ ] **Step 1: Add split script**

Create `tanstack-app/scripts/split-city-wards.ts`:

```ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(__dirname, '..')
const sourcePath = path.join(appRoot, 'city_wards.json')
const outDir = path.join(appRoot, 'src/data/vietnam-locations')
const wardsDir = path.join(outDir, 'wards')

type SourceCity = {
  code: string
  name: string
  slug: string
  type: string
  isCentral?: boolean
  fullName: string
  wards: unknown[]
}

const source = JSON.parse(readFileSync(sourcePath, 'utf8')) as SourceCity[]

const cities = source.map(
  ({ code, name, slug, type, isCentral, fullName }) => ({
    code,
    name,
    slug,
    type,
    ...(isCentral === undefined ? {} : { isCentral }),
    fullName,
  }),
)

mkdirSync(wardsDir, { recursive: true })
writeFileSync(
  path.join(outDir, 'cities.json'),
  `${JSON.stringify(cities, null, 2)}\n`,
)

for (const city of source) {
  writeFileSync(
    path.join(wardsDir, `${city.code}.json`),
    `${JSON.stringify(city.wards, null, 2)}\n`,
  )
}

console.log(
  `Wrote ${cities.length} cities and ${source.length} ward files to ${outDir}`,
)
```

Add to `tanstack-app/package.json` scripts:

```json
"split:city-wards": "tsx scripts/split-city-wards.ts"
```

- [ ] **Step 2: Run the split script**

```bash
cd tanstack-app
pnpm split:city-wards
```

Expected: `Wrote 34 cities and 34 ward files...`

- [ ] **Step 3: Commit source + generated catalog**

```bash
git add tanstack-app/city_wards.json tanstack-app/scripts/split-city-wards.ts tanstack-app/package.json tanstack-app/src/data/vietnam-locations/
git commit -m "$(cat <<'EOF'
feat: split city_wards.json into eager cities and lazy ward chunks

EOF
)"
```

---

### Task 3: Runtime location module (cities eager, wards lazy)

**Files:**
- Create: `tanstack-app/src/data/vietnam-locations/types.ts`
- Create: `tanstack-app/src/data/vietnam-locations/index.ts`
- Create: `tanstack-app/src/data/vietnam-locations/index.test.ts`

**Interfaces:**
- Consumes: generated `cities.json`, `wards/{code}.json`
- Produces: `cities: City[]`, `getWards(cityCode: string): Promise<Ward[]>`

- [ ] **Step 1: Write the failing test**

Create `tanstack-app/src/data/vietnam-locations/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { cities, getWards } from './index'

describe('vietnam-locations', () => {
  it('exports a non-empty city list', () => {
    expect(cities.length).toBeGreaterThan(0)
    expect(cities[0]).toMatchObject({
      code: expect.any(String),
      name: expect.any(String),
      fullName: expect.any(String),
    })
  })

  it('loads wards for Hanoi lazily', async () => {
    const wards = await getWards('01')
    expect(wards.length).toBeGreaterThan(0)
    expect(wards[0]).toMatchObject({
      code: expect.any(String),
      name: expect.any(String),
      type: 'ward',
    })
  })

  it('returns empty array for unknown city code', async () => {
    expect(await getWards('999')).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd tanstack-app
pnpm vitest run src/data/vietnam-locations/index.test.ts
```

Expected: FAIL — cannot find module `./index`

- [ ] **Step 3: Implement module**

Create `tanstack-app/src/data/vietnam-locations/types.ts`:

```ts
export type City = {
  code: string
  name: string
  slug: string
  type: string
  isCentral?: boolean
  fullName: string
}

export type Ward = {
  code: string
  name: string
  fullName: string
  slug: string
  type: string
}
```

Create `tanstack-app/src/data/vietnam-locations/index.ts`:

```ts
import citiesJson from './cities.json'
import type { City, Ward } from './types'

export type { City, Ward }

export const cities = citiesJson as City[]

const wardLoaders = import.meta.glob<Ward[]>('./wards/*.json')

const wardCache = new Map<string, Ward[]>()

export async function getWards(cityCode: string): Promise<Ward[]> {
  if (wardCache.has(cityCode)) {
    return wardCache.get(cityCode)!
  }
  const loader = wardLoaders[`./wards/${cityCode}.json`]
  if (!loader) return []
  const wards = await loader()
  wardCache.set(cityCode, wards)
  return wards
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd tanstack-app
pnpm vitest run src/data/vietnam-locations/index.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/data/vietnam-locations/types.ts tanstack-app/src/data/vietnam-locations/index.ts tanstack-app/src/data/vietnam-locations/index.test.ts
git commit -m "$(cat <<'EOF'
feat: add vietnam-locations module with lazy ward loading

EOF
)"
```

---

### Task 4: i18n keys for address picker

**Files:**
- Modify: `tanstack-app/messages/vi.json`

**Interfaces:**
- Produces: Paraglide messages used by `VietnamAddressFields` and form validation

- [ ] **Step 1: Add keys to vi.json**

```json
  "filler_field_city": "Tỉnh / Thành phố",
  "filler_field_ward": "Phường / Xã",
  "filler_field_address_line": "Số nhà, tổ/thôn",
  "filler_ph_city": "Chọn tỉnh / thành phố",
  "filler_ph_ward": "Chọn phường / xã",
  "filler_ph_address_line": "Ví dụ: 123 đường ABC, tổ 5, thôn X",
  "filler_address_city_required": "Vui lòng chọn tỉnh / thành phố",
  "filler_address_ward_required": "Vui lòng chọn phường / xã",
  "filler_address_wards_loading": "Đang tải…"
```

- [ ] **Step 2: Regenerate Paraglide messages**

```bash
cd tanstack-app
pnpm paraglide
```

Expected: compiles without error

- [ ] **Step 3: Commit**

```bash
git add tanstack-app/messages/vi.json tanstack-app/src/paraglide/
git commit -m "$(cat <<'EOF'
feat: add i18n keys for Vietnam address picker

EOF
)"
```

---

### Task 5: VietnamAddressFields component

**Files:**
- Create: `tanstack-app/src/components/address/VietnamAddressFields.tsx`
- Create: `tanstack-app/src/components/address/VietnamAddressFields.test.tsx`

**Interfaces:**
- Consumes: `AddressDraft`, `cities`, `getWards`, Paraglide messages
- Produces: `VietnamAddressFields` component

- [ ] **Step 1: Write the failing component test**

Create `tanstack-app/src/components/address/VietnamAddressFields.test.tsx`:

```tsx
import { MantineProvider } from '@mantine/core'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_ADDRESS_DRAFT } from '#/domain/address'
import { m } from '#/paraglide/messages'
import { theme } from '../../theme'
import { VietnamAddressFields } from './VietnamAddressFields'

vi.mock('#/data/vietnam-locations', () => ({
  cities: [
    {
      code: '01',
      name: 'Hà Nội',
      fullName: 'Thành phố Hà Nội',
      slug: 'ha-noi',
      type: 'city',
    },
  ],
  getWards: vi.fn(async () => [
    {
      code: '00013',
      name: 'Hà Đông',
      fullName: 'Phường Hà Đông, Thành phố Hà Nội',
      slug: 'ha-dong',
      type: 'ward',
    },
  ]),
}))

import { getWards } from '#/data/vietnam-locations'

const getWardsMock = vi.mocked(getWards)

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver =
    ResizeObserverMock as unknown as typeof ResizeObserver

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
})

beforeEach(() => {
  getWardsMock.mockClear()
})

function renderFields(
  props: Partial<React.ComponentProps<typeof VietnamAddressFields>> = {},
) {
  const onChange = vi.fn()
  render(
    <MantineProvider theme={theme} defaultColorScheme="light">
      <VietnamAddressFields
        label="Địa chỉ cũ"
        value={EMPTY_ADDRESS_DRAFT}
        onChange={onChange}
        {...props}
      />
    </MantineProvider>,
  )
  return { onChange }
}

describe('VietnamAddressFields', () => {
  it('renders city, ward, and line fields', () => {
    renderFields()
    expect(screen.getByLabelText(m.filler_field_city())).toBeTruthy()
    expect(screen.getByLabelText(m.filler_field_ward())).toBeTruthy()
    expect(screen.getByLabelText(m.filler_field_address_line())).toBeTruthy()
  })

  it('disables ward until city is selected', () => {
    renderFields()
    expect(screen.getByLabelText(m.filler_field_ward())).toBeDisabled()
  })

  it('loads wards after city selection and clears ward on city change', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(
      <MantineProvider theme={theme} defaultColorScheme="light">
        <VietnamAddressFields
          label="Địa chỉ cũ"
          value={EMPTY_ADDRESS_DRAFT}
          onChange={onChange}
        />
      </MantineProvider>,
    )

    await user.click(screen.getByLabelText(m.filler_field_city()))
    await user.click(await screen.findByText('Hà Nội'))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        cityCode: '01',
        cityName: 'Hà Nội',
        wardCode: '',
        wardName: '',
      }),
    )

    rerender(
      <MantineProvider theme={theme} defaultColorScheme="light">
        <VietnamAddressFields
          label="Địa chỉ cũ"
          value={{
            cityCode: '01',
            cityName: 'Hà Nội',
            wardCode: '00013',
            wardName: 'Hà Đông',
            line: '',
          }}
          onChange={onChange}
        />
      </MantineProvider>,
    )

    await waitFor(() => expect(getWardsMock).toHaveBeenCalledWith('01'))

    await user.click(screen.getByLabelText(m.filler_field_city()))
    await user.click(await screen.findByText('Hà Nội'))

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cityCode: '01',
        wardCode: '',
        wardName: '',
      }),
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd tanstack-app
pnpm vitest run src/components/address/VietnamAddressFields.test.tsx
```

Expected: FAIL — cannot find module `./VietnamAddressFields`

- [ ] **Step 3: Implement component**

Create `tanstack-app/src/components/address/VietnamAddressFields.tsx`:

```tsx
import { Select, Stack, TextInput } from '@mantine/core'
import { useEffect, useMemo, useState } from 'react'
import { cities, getWards } from '#/data/vietnam-locations'
import type { Ward } from '#/data/vietnam-locations'
import type { AddressDraft } from '#/domain/address'
import { m } from '#/paraglide/messages'

export type VietnamAddressFieldsProps = {
  label?: string
  value: AddressDraft
  onChange: (value: AddressDraft) => void
  disabled?: boolean
  errors?: { city?: string; ward?: string }
}

export function VietnamAddressFields({
  label,
  value,
  onChange,
  disabled = false,
  errors,
}: VietnamAddressFieldsProps) {
  const [wards, setWards] = useState<Ward[]>([])
  const [wardsLoading, setWardsLoading] = useState(false)

  const cityOptions = useMemo(
    () =>
      cities.map((city) => ({
        value: city.code,
        label: city.fullName,
      })),
    [],
  )

  const wardOptions = useMemo(
    () =>
      wards.map((ward) => ({
        value: ward.code,
        label: ward.fullName,
      })),
    [wards],
  )

  useEffect(() => {
    if (!value.cityCode) {
      setWards([])
      return
    }
    let cancelled = false
    setWardsLoading(true)
    getWards(value.cityCode)
      .then((loaded) => {
        if (!cancelled) setWards(loaded)
      })
      .finally(() => {
        if (!cancelled) setWardsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [value.cityCode])

  const handleCityChange = (cityCode: string | null) => {
    const city = cities.find((item) => item.code === cityCode)
    onChange({
      ...value,
      cityCode: cityCode ?? '',
      cityName: city?.name ?? '',
      wardCode: '',
      wardName: '',
    })
  }

  const handleWardChange = (wardCode: string | null) => {
    const ward = wards.find((item) => item.code === wardCode)
    onChange({
      ...value,
      wardCode: wardCode ?? '',
      wardName: ward?.name ?? '',
    })
  }

  return (
    <Stack gap="sm" aria-label={label}>
      <Select
        label={m.filler_field_city()}
        placeholder={m.filler_ph_city()}
        data={cityOptions}
        value={value.cityCode || null}
        onChange={handleCityChange}
        searchable
        disabled={disabled}
        error={errors?.city}
      />
      <Select
        label={m.filler_field_ward()}
        placeholder={
          wardsLoading ? m.filler_address_wards_loading() : m.filler_ph_ward()
        }
        data={wardOptions}
        value={value.wardCode || null}
        onChange={handleWardChange}
        searchable
        disabled={disabled || !value.cityCode || wardsLoading}
        error={errors?.ward}
      />
      <TextInput
        label={m.filler_field_address_line()}
        placeholder={m.filler_ph_address_line()}
        value={value.line}
        onChange={(event) =>
          onChange({ ...value, line: event.currentTarget.value })
        }
        disabled={disabled}
      />
    </Stack>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd tanstack-app
pnpm vitest run src/components/address/VietnamAddressFields.test.tsx
```

Expected: PASS (adjust selectors if Mantine combobox needs `getByRole('option')` instead of `findByText`)

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/address/
git commit -m "$(cat <<'EOF'
feat: add VietnamAddressFields picker component

EOF
)"
```

---

### Task 6: Wire TempleEditorForm

**Files:**
- Modify: `tanstack-app/src/components/filler/TempleEditorForm.tsx`
- Modify: `tanstack-app/src/components/filler/TempleEditorForm.test.tsx`

**Interfaces:**
- Consumes: `VietnamAddressFields`, `hydrateAddress`, `addressDraftToValue`, `validateAddressDraft`, `AddressDraft`
- Produces: temple draft/save using `AddressValue` for `diaChiCu` / `diaChiMoi`

- [ ] **Step 1: Update TempleEditorForm draft types and helpers**

In `TempleEditorForm.tsx`:

1. Import address helpers + `VietnamAddressFields`.
2. Change draft fields:

```ts
import type { AddressDraft } from '#/domain/address'
import {
  addressDraftToValue,
  hydrateAddress,
  validateAddressDraft,
} from '#/domain/address'
import { VietnamAddressFields } from '#/components/address/VietnamAddressFields'

// TempleDraft:
diaChiCu: AddressDraft
diaChiMoi: AddressDraft

// emptyTempleDraft:
diaChiCu: hydrateAddress(initial.diaChiCu),
diaChiMoi: hydrateAddress(initial.diaChiMoi),

// buildPatch:
diaChiCu: addressDraftToValue(draft.diaChiCu),
diaChiMoi: addressDraftToValue(draft.diaChiMoi),
```

3. Add address error state:

```ts
type AddressFieldErrors = { city?: string; ward?: string }

const [addressErrors, setAddressErrors] = useState<{
  diaChiCu?: AddressFieldErrors
  diaChiMoi?: AddressFieldErrors
}>({})
```

4. Add save guard before `saveMutation.mutate()`:

```ts
function mapAddressErrors(
  result: ReturnType<typeof validateAddressDraft>,
): AddressFieldErrors | undefined {
  if (result.valid) return undefined
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

function handleSave() {
  const cu = validateAddressDraft(draft.diaChiCu)
  const moi = validateAddressDraft(draft.diaChiMoi)
  const nextErrors = {
    diaChiCu: mapAddressErrors(cu),
    diaChiMoi: mapAddressErrors(moi),
  }
  setAddressErrors(nextErrors)
  if (!cu.valid || !moi.valid) return
  saveMutation.mutate()
}
```

5. Replace address `SimpleGrid` `TextInput`s:

```tsx
<FormSection title={m.filler_section_temple_address()}>
  <SimpleGrid cols={{ base: 1, sm: 2 }}>
    <VietnamAddressFields
      label={m.filler_field_dia_chi_cu()}
      value={draft.diaChiCu}
      onChange={(value) => updateDraft('diaChiCu', value)}
      disabled={disabled}
      errors={addressErrors.diaChiCu}
    />
    <VietnamAddressFields
      label={m.filler_field_dia_chi_moi()}
      value={draft.diaChiMoi}
      onChange={(value) => updateDraft('diaChiMoi', value)}
      disabled={disabled}
      errors={addressErrors.diaChiMoi}
    />
  </SimpleGrid>
</FormSection>
```

6. Wire shell: `onSave={status === 'draft' ? handleSave : undefined}`

- [ ] **Step 2: Update TempleEditorForm tests**

Add test that save is blocked when only line is filled:

```tsx
it('blocks save when address line is set without city and ward', async () => {
  const user = userEvent.setup()
  renderForm()

  await user.type(
    screen.getByLabelText(m.filler_field_address_line(), {
      selector: 'input',
    }),
    '15 Ngõ 4',
  )
  await user.click(screen.getByRole('button', { name: m.filler_save() }))

  expect(saveTempleDraftMock).not.toHaveBeenCalled()
  expect(screen.getByText(m.filler_address_city_required())).toBeTruthy()
})
```

If multiple line inputs exist, scope by section label (`Địa chỉ cũ`) or use `getAllByLabelText` index 0.

Add save test with structured address:

```tsx
it('saves structured diaChiMoi when city and ward selected', async () => {
  const user = userEvent.setup()
  saveTempleDraftMock.mockResolvedValue({
    temple: temple({ id: 'created-temple' }),
    mode: 'created',
  })
  renderForm()

  // select city + ward in "Địa chỉ mới" block (second city select)
  // type line in second line input
  // click Save
  // expect patch.diaChiMoi to equal AddressValue object
})
```

- [ ] **Step 3: Run tests**

```bash
cd tanstack-app
pnpm vitest run src/components/filler/TempleEditorForm.test.tsx
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add tanstack-app/src/components/filler/TempleEditorForm.tsx tanstack-app/src/components/filler/TempleEditorForm.test.tsx
git commit -m "$(cat <<'EOF'
feat: wire Vietnam address picker into temple filler editor

EOF
)"
```

---

### Task 7: Wire MemberEditorForm

**Files:**
- Modify: `tanstack-app/src/components/filler/MemberEditorForm.tsx`
- Create: `tanstack-app/src/components/filler/MemberEditorForm.test.tsx` (if missing) or extend existing tests

**Interfaces:**
- Consumes: same address helpers + `VietnamAddressFields`
- Produces: member draft/save using `AddressValue` for `diaChiThuongTru`

- [ ] **Step 1: Mirror temple wiring for `diaChiThuongTru`**

Same pattern as Task 6:

```ts
diaChiThuongTru: AddressDraft

diaChiThuongTru: hydrateAddress(initial.diaChiThuongTru),

diaChiThuongTru: addressDraftToValue(draft.diaChiThuongTru),
```

Replace the `TextInput` for `diaChiThuongTru` with:

```tsx
<VietnamAddressFields
  label={m.filler_field_dia_chi_thuong_tru()}
  value={draft.diaChiThuongTru}
  onChange={(value) => updateDraft('diaChiThuongTru', value)}
  disabled={disabled}
  errors={addressErrors.diaChiThuongTru}
/>
```

Add `handleSave` with `validateAddressDraft(draft.diaChiThuongTru)` guard.

- [ ] **Step 2: Add/adjust MemberEditorForm tests**

At minimum:

```tsx
it('hydrates legacy diaChiThuongTru string into line field', () => {
  renderForm({ initial: { diaChiThuongTru: '123 Đường A' } })
  expect(screen.getByDisplayValue('123 Đường A')).toBeTruthy()
})

it('blocks save when permanent address line lacks city and ward', async () => {
  // type line only, click save, assert saveMemberDraft not called
})
```

- [ ] **Step 3: Run tests**

```bash
cd tanstack-app
pnpm vitest run src/components/filler/MemberEditorForm.test.tsx
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add tanstack-app/src/components/filler/MemberEditorForm.tsx tanstack-app/src/components/filler/MemberEditorForm.test.tsx
git commit -m "$(cat <<'EOF'
feat: wire Vietnam address picker into member filler editor

EOF
)"
```

---

### Task 8: Admin display compatibility shim

**Files:**
- Modify: `tanstack-app/src/components/admin/TempleFormPage.tsx`
- Modify: `tanstack-app/src/components/admin/TempleFormPage.test.tsx`

**Interfaces:**
- Consumes: `formatAddressDisplay`
- Produces: admin page compiles and shows legacy string or formatted `AddressValue`

- [ ] **Step 1: Use formatAddressDisplay when loading admin form**

In `TempleFormPage.tsx`:

```ts
import { formatAddressDisplay } from '#/domain/address'

// when hydrating:
setDiaChiMoi(formatAddressDisplay(temple.data.diaChiMoi))
```

Admin still saves a plain string (`diaChiMoi: diaChiMoi || undefined`) — out of scope per spec; this only prevents type/runtime breakage when reading structured addresses.

- [ ] **Step 2: Update admin test fixture if needed**

If test uses `diaChiMoi: '123 Đường A'`, it should still pass. Optionally add case:

```ts
diaChiMoi: {
  cityCode: '01',
  cityName: 'Hà Nội',
  wardCode: '00013',
  wardName: 'Hà Đông',
  line: '15 Ngõ 4',
}
```

and assert input shows `15 Ngõ 4, Hà Đông, Hà Nội`.

- [ ] **Step 3: Run admin test**

```bash
cd tanstack-app
pnpm vitest run src/components/admin/TempleFormPage.test.tsx
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add tanstack-app/src/components/admin/TempleFormPage.tsx tanstack-app/src/components/admin/TempleFormPage.test.tsx
git commit -m "$(cat <<'EOF'
fix: display structured temple addresses in admin form

EOF
)"
```

---

### Task 9: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run full unit test suite**

```bash
cd tanstack-app
pnpm test
```

Expected: all tests PASS

- [ ] **Step 2: Typecheck via build**

```bash
cd tanstack-app
pnpm build
```

Expected: build succeeds; Vite emits separate chunks for `wards/*.json` (lazy), not one giant ward bundle in the main chunk

- [ ] **Step 3: Manual smoke (dev server)**

1. Open temple filler editor → **Địa chỉ** section shows city/ward/line for both old and new address
2. Pick city → ward enables and loads
3. Save with city+ward → reload shows selections preserved
4. Open record with legacy string address → text appears in line field only
5. Member filler **Địa chỉ thường trú** behaves the same

- [ ] **Step 4: Final commit if any fixups needed**

Only if verification uncovered issues.

---

## Plan self-review (spec coverage)

| Spec requirement | Task |
| --- | --- |
| Structured `AddressValue` in Firestore | Task 1, 6, 7 |
| Legacy string → line only | Task 1 `hydrateAddress`, Task 6/7 |
| Cities eager, wards lazy | Task 2, 3 |
| Shared `VietnamAddressFields` | Task 5 |
| Temple `diaChiCu` / `diaChiMoi` | Task 6 |
| Member `diaChiThuongTru` | Task 7 |
| Validation rules | Task 1, 6, 7 |
| i18n | Task 4 |
| Vitest coverage | Tasks 1, 3, 5, 6, 7 |
| Admin out of scope (shim only) | Task 8 |
| No Cypress | Global constraints |
| Regenerate catalog from `city_wards.json` | Task 2 script |

No placeholders or TBDs remain.
