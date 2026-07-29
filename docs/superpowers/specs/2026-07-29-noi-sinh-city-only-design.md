# Member form: Nơi sinh city-only

Date: 2026-07-29  
Status: draft for review  
Depends on: `2026-07-23-member-noi-sinh-xuat-gia-address-design.md`, `2026-07-20-vietnam-address-picker-design.md`  
Supersedes (partial): required city+ward for `noiSinh` in those specs — `noiSinh` becomes city-only

## Goal

On the member form (filler + admin via shared `MemberFormFields`), **Nơi sinh** shows only **Tỉnh / Thành phố**. Remove Phường/Xã and số nhà/tổ/thôn for this field.

On every save, persist city only and **strip** any existing ward/line on `noiSinh`.

## Decisions

1. **UI** — reuse `VietnamAddressFields` with a city-only mode (hide ward select + line input). Do not invent a separate picker.
2. **Required** — `noiSinh` still required; only `cityCode` is required (ward not required).
3. **Persist on save** — write `AddressValue` with `cityCode` / `cityName` and empty `wardCode` / `wardName`; omit `line`. Existing ward/line on `noiSinh` are cleared when the member is saved.
4. **Other addresses unchanged** — `noiXuatGia`, `diaChiThuongTru`, temple addresses keep full city → ward → optional line.

## Non-goals

- Changing `AddressValue` / `AddressDraft` type shape (still same fields; ward/line empty for `noiSinh`)
- Batch migration / script over existing Firestore docs without opening the form
- Changing `nguyenQuan` or free-text place fields
- Cypress coverage for this change

## UI

| Field | Before | After |
|-------|--------|-------|
| Nơi sinh | City + Ward + line | City only |
| Nơi xuất gia | City + Ward + line | unchanged |
| Địa chỉ thường trú | City + Ward + line | unchanged |

Section heading remains **Nơi sinh**; city select keeps existing **Tỉnh / Thành phố** label.

## Validation & draft → value

- Add a validation option for city-only required addresses (e.g. `validateAddressDraft(draft, { required: true, cityOnly: true })`): blank → `city: REQUIRED` only; non-blank → require `cityCode` only (ignore ward).
- `memberRequiredValidation` for `noiSinh`: city only (no ward error).
- Conversion for `noiSinh` on save: if city present, emit `{ cityCode, cityName, wardCode: '', wardName: '' }` with no `line`, regardless of draft ward/line (or clear them when applying city-only mode). Prefer a dedicated helper or `addressDraftToValue(draft, { cityOnly: true })` so other callers stay strict.

## Display

`formatAddressDisplay` already joins non-empty parts; city-only values display as `cityName`. No special case required unless tests assert ward inclusion for stripped values.

## Files likely touched

- `VietnamAddressFields` — `cityOnly` (or equivalent) prop
- `domain/address.ts` — city-only validate + convert
- `memberRequiredValidation.ts` (+ tests)
- `MemberFormFields.tsx` — pass city-only for `noiSinh`
- `memberDraft` / save path if convert helper is wired there
- Unit tests for address helpers and member form validation

## Out of scope follow-ups

- Optional later: tighten Firestore rules or a one-off cleanup script for leftover ward/line on unread docs
