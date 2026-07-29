# Temple Địa chỉ cũ — free-text field

## Goal

Replace the structured Vietnam address picker for temple **Địa chỉ cũ** (`diaChiCu`) with a single required text input. **Địa chỉ mới** (`diaChiMoi`) stays unchanged.

## Decisions

| Topic | Choice |
|-------|--------|
| UI | One `TextInput`, label `Địa chỉ cũ`, `required` |
| Required | Non-empty after trim |
| Legacy structured value | Hydrate as empty string — user re-enters |
| Legacy string value | Keep as-is in the input |
| Persist shape | Save trimmed `string` (or omit/`undefined` if blank); no longer write `AddressValue` for new saves |
| Scope | Shared temple form (filler + admin via `TempleFormFields` / `TempleAddressSection`) |

## Data model

- Domain type stays `diaChiCu?: AddressValue | string` (reads must still accept old structured docs).
- `TempleDraft.diaChiCu` becomes `string`.
- Hydrate:
  - `typeof value === 'string'` → use that string
  - `AddressValue` or missing → `''`
- `buildTemplePatch`: `diaChiCu: textOrUndefined(draft.diaChiCu)` (trimmed string or `undefined`).

## Validation

- `TempleRequiredFieldErrors.diaChiCu` becomes `'REQUIRED' | undefined` (same pattern as `danhHieu`).
- Drop `{ city, ward }` mapping for `diaChiCu` only; `diaChiMoi` keeps address draft validation.

## UI

In `TempleAddressSection`:

- Remove `VietnamAddressFields` for `diaChiCu`.
- Render one `TextInput` bound to `draft.diaChiCu`.
- Error: map `'REQUIRED'` → `filler_error_field_required`.
- Keep section heading + `diaChiMoi` picker as today.

## Tests

Update Vitest for:

- `templeRequiredValidation` — blank `diaChiCu` string → `'REQUIRED'`; non-empty passes
- `templeDraft` hydrate/patch — structured → `''` / string round-trip
- Form tests that assert city/ward controls for Địa chỉ cũ → assert single text field instead

## Out of scope

- Changing `diaChiMoi` picker or its required city/ward rules
- Batch migration of existing Firestore `AddressValue` documents
- Admin-only or filler-only divergence
