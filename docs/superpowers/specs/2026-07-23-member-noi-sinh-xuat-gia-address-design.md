# Member form: Nơi sinh & Nơi xuất gia as address pickers

Date: 2026-07-23  
Status: approved for planning  
Depends on: `2026-07-20-vietnam-address-picker-design.md`  
Supersedes (partial): non-goal exclusion of `noiSinh` in that spec — these two fields now use the same picker

## Goal

Replace free-text **Nơi sinh** and **Nơi xuất gia** on the filler member form (`MemberEditorForm`) with the shared `VietnamAddressFields` pattern already used for temple **Địa chỉ cũ** (city → ward → optional line).

Persist structured `AddressValue` in Firestore.

## Decisions (from review)

1. **UI parity with Địa chỉ cũ** — reuse `VietnamAddressFields`; do not invent a separate address layout.
2. **Nơi xuất gia line** — keep the default line **label** (“Số nhà, tổ/thôn”); only customize the **placeholder** to guide “Tịnh xá …” (option A).
3. **Required** — both fields always require **city + ward**; line remains optional (option A). Blank block is **not** valid for these two slots.

## Non-goals

- `nguyenQuan`, history-row `diaChi`, precept place fields, admin member form
- Auto-migration of legacy strings into city/ward codes
- Changing temple `diaChiCu` / `diaChiMoi` or member `diaChiThuongTru` behavior (still optional-when-blank)
- Cypress coverage for this change
- Broader Tăng/Ni feedback items (portrait photo, hệ phái gốc, thọ giới, etc.) — out of scope here

## Fields in scope

| Form | Field | Today | After |
|------|-------|-------|-------|
| `MemberEditorForm` | `noiSinh` | `string` | `AddressValue \| undefined` |
| `MemberEditorForm` | `noiXuatGia` | `string` | `AddressValue \| undefined` |

Domain type in `src/domain/types.ts`: accept `AddressValue | string | undefined` on read (legacy); write `AddressValue | undefined`.

## Data model & hydration

Reuse existing `AddressValue` / `AddressDraft` / `hydrateAddress` / `addressDraftToValue` / `formatAddressDisplay`.

- Legacy Firestore string → `{ line: oldString }` (city/ward empty) via `hydrateAddress`.
- On save with `required: true` validation: only persist when city + ward are set; omit empty `line`.
- Do not write `{}`.

## Validation

Extend `validateAddressDraft`:

```ts
validateAddressDraft(draft, options?: { required?: boolean })
```

| Mode | Blank (no city, ward, line) | Partial | Complete city+ward |
|------|----------------------------|---------|-------------------|
| default (`required` false/omitted) | valid (omit on save) | city+ward required | valid |
| `required: true` | **invalid** — city + ward errors | city+ward required | valid |

Member save for `noiSinh` / `noiXuatGia` always uses `{ required: true }`.

`diaChiThuongTru` / temple addresses keep the default (optional-when-blank) path.

## UI

| Slot | Section label | Line label | Line placeholder |
|------|---------------|------------|------------------|
| Nơi sinh | existing `filler_field_noi_sinh` | default `filler_field_address_line` | default `filler_ph_address_line` |
| Nơi xuất gia | existing `filler_field_noi_xuat_gia` (+ keep existing sublabel about Tịnh xá if present) | default `filler_field_address_line` | new i18n key, e.g. `filler_ph_noi_xuat_gia_line`: `vd: Tịnh xá …` |

Extend `VietnamAddressFields` props:

| Prop | Purpose |
|------|---------|
| `linePlaceholder?: string` | Falls back to `m.filler_ph_address_line()` |
| `required?: boolean` | When true, Mantine `required` on **city** and **ward** Selects only (asterisk); line stays optional |

Error messages reuse `filler_address_city_required` / `filler_address_ward_required`.

Layout: stack within Định danh / Xuất gia sections as today — full-width address block replacing the single `TextInput`.

## Form wiring

- Draft: `noiSinh: AddressDraft`, `noiXuatGia: AddressDraft` via `hydrateAddress`.
- On save attempt: run `validateAddressDraft(..., { required: true })` for both; if invalid, set field errors and **block save** (do not call `addressDraftToValue` / write until valid). Same pattern as other member required fields.
- After valid: persist `addressDraftToValue(draft)` (never `undefined` for these two when validation passed with `required: true`).
- Remove free-text usage of `filler_ph_noi_sinh` / `filler_ph_noi_xuat_gia`; delete those message keys if unused elsewhere.

## Testing

- Vitest: `validateAddressDraft(..., { required: true })` — blank fails; complete passes; line-only fails with city+ward errors.
- Vitest + Testing Library: `MemberEditorForm` renders address pickers for both fields; save without city/ward shows required errors; optional `linePlaceholder` prop on `VietnamAddressFields`.
- Update any tests that type into free-text `noiSinh` / `noiXuatGia`.
- **No new Cypress.**

## Implementation sketch

1. Domain: `validateAddressDraft` options + tests.
2. Types: `noiSinh` / `noiXuatGia` → `AddressValue | string | undefined`.
3. `VietnamAddressFields`: optional `linePlaceholder`.
4. i18n: placeholder for xuất gia line.
5. `MemberEditorForm`: replace TextInputs; required validation on save; hydrate/serialize.
6. Update member editor tests.
