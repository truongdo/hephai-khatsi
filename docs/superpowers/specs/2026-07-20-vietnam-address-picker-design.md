# Vietnam address picker (city → ward → line)

Date: 2026-07-20  
Status: approved for planning  
Depends on: `2026-07-20-filler-full-editors-design.md`  
Scope: Structured address UI in filler temple + member editors; location catalog split for lazy ward loading

## Goal

Replace free-text address fields on filler editors with a shared picker:

1. Select **Tỉnh / Thành phố** (city)
2. Select **Phường / Xã** (ward) — options load for the selected city only
3. Type free-form **Số nhà, tổ/thôn** (optional line)

Persist a structured `AddressValue` in Firestore (not a concatenated string).

## Non-goals

- Admin temple form (`TempleFormPage`) — keep existing string input for now
- Other free-text place fields (`noiSinh`, `nguyenQuan`, history-row `diaChi`, etc.)
- Geocoding, maps, or street-level autocomplete
- Migrating historical string addresses into city/ward codes automatically
- Shipping the full `city_wards.json` to the client as one eager bundle

## Fields in scope

| Form | Field(s) | Today | After |
|------|----------|-------|-------|
| `TempleEditorForm` | `diaChiCu`, `diaChiMoi` | `string` | `AddressValue \| undefined` |
| `MemberEditorForm` | `diaChiThuongTru` | `string` | `AddressValue \| undefined` |

## Data model

```ts
type AddressValue = {
  cityCode: string
  cityName: string
  wardCode: string
  wardName: string
  line?: string // "Số nhà, tổ/thôn"
}
```

- Store **codes and display names** so lists/exports still work if the catalog is updated later.
- No separate `fullText` field — format on read when needed (`[line, wardName, cityName].filter(Boolean).join(', ')`).
- Empty address → omit the field on save (`undefined`); do not write `{}`.
- Domain types in `src/domain/types.ts` change from `string?` to `AddressValue?` for the three fields above.

### Legacy hydration

If Firestore still has a plain string for one of these fields:

- Treat as `{ line: oldString }` (city/ward empty).
- User can save after picking city + ward (and optionally editing the line).

Converters / draft mappers must accept `string | AddressValue | undefined` on read and normalize to `AddressValue | undefined` for the form.

## Location catalog

Source of truth in the repo: `tanstack-app/city_wards.json` (34 cities, ~3320 wards). Do not import this file directly from UI.

### Derived assets (cities eager, wards lazy)

Generate (script or checked-in derived files under e.g. `src/data/vietnam-locations/`):

| Asset | Contents |
|-------|----------|
| `cities.json` | `{ code, name, fullName, slug }[]` — no wards |
| `wards/{cityCode}.json` | wards for that city only |

### Runtime module

- Eager import `cities.json`.
- `getWards(cityCode): Promise<Ward[]>` — dynamic `import()` of `wards/{cityCode}.json`, cached in memory after first load.
- UI and tests talk only to this module, not to raw JSON paths.

Keep `city_wards.json` as the regeneratable source; document how to re-run the split when the source updates.

## UI — `VietnamAddressFields`

Shared Mantine component used by temple and member filler editors.

| Control | Behavior |
|---------|----------|
| City | Searchable select/combobox from eager cities list |
| Ward | Disabled until city chosen; loads via `getWards`; searchable; **clears when city changes** |
| Line | `TextInput` — “Số nhà, tổ/thôn”; optional |

Props: `value: AddressValue \| null`, `onChange`, labels / section title, optional `error`, `disabled`.

### Layout

- **Temple:** section **Địa chỉ** — two `VietnamAddressFields` side by side on `sm+` (`diaChiCu`, `diaChiMoi`), stacked on mobile.
- **Member:** one full-width block for **Địa chỉ thường trú**.

### Validation (per address slot)

| State | Rule |
|-------|------|
| City, ward, and line all empty | OK — omit field on save |
| Any of city / ward / line set | **City and ward required**; line optional |
| City without ward (or ward without city) | Block save; field-level error |

Same save-attempt error pattern as other filler form validation.

## Form wiring

- Replace the three `TextInput`s with `VietnamAddressFields`.
- Draft state holds `AddressValue | null` (or empty object shape used by the form).
- On save: if address is blank → `undefined`; if valid → write `AddressValue` (omit empty `line`).
- i18n: add Paraglide keys for city/ward/line labels, placeholders, and validation messages (vi).

## Testing

- Vitest: hydrate (string → `{ line }`), blank/partial/complete validation, city-change clears ward.
- Vitest + Testing Library: `VietnamAddressFields` render + select interaction (mock `getWards`).
- Update existing temple/member editor tests that assert address text inputs.
- **No new Cypress** for this change.

## Out of scope follow-ups

- Admin forms and any display-only address strings
- Backfill job for historical free-text addresses
- Applying the picker to other place fields

## Success criteria

1. Filler users can pick city → ward → optional line for temple old/new address and member permanent address.
2. Firestore stores structured `AddressValue` (or omits the field when blank).
3. Legacy strings open with text in the line field and empty city/ward.
4. Initial JS does not include the full ward catalog; wards load per selected city.
5. Partial addresses without both city and ward cannot be saved.
