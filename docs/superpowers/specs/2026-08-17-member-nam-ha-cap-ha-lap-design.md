# Member: Ngày hạ cấp hạ lạp (`ngayHaCapHaLap`)

Date: 2026-08-17 (amended 2026-08-21: default undefined, no auto-fill)  
Status: approved for planning  
Depends on: shared `MemberFormFields` / `memberDraft` / `buildMemberPatch`, admin Excel column catalog  
Surfaces: admin `MemberFormPage` (field visible); filler form hides field (stays unset on save)

## Goal

Add an optional date field **Ngày hạ cấp hạ lạp** on the member record. Show it only on the admin form (editable DateInput). Default is unset (`undefined`); filler submit does not auto-fill. Admin may set it manually.

## Decisions

| Topic | Choice |
|-------|--------|
| Relation to `haLap` | **New field** `ngayHaCapHaLap`; keep existing `haLap` unchanged |
| Storage | `string` `YYYY-MM-DD` (same as `ngayXuatGia`), not a year number |
| Auto-fill policy | **None** — default `undefined`; only set when admin enters a date |
| Phương trượng source | N/A (no auto resolve from precept / xuất gia) |
| Admin UI | DateInput; editable; not required |
| Filler UI | Hidden (no control) |
| Excel | New column in `ordination` group, next to `haLap` |
| Where auto runs | Does not auto-run; `buildMemberPatch` only writes draft value |
| `sanghaType` for resolve | N/A |
| Backfill existing docs | Out of scope |

## Non-goals

- Renaming, hiding, or changing meaning of `haLap`
- Bulk Firestore migration / backfill script
- Sorting or filtering member lists by `ngayHaCapHaLap`
- Cypress E2E (Vitest only)
- Making the field required
- Auto-deriving from thọ giới / xuất gia dates

## Data model

Add to `Member`:

```ts
ngayHaCapHaLap?: string // YYYY-MM-DD, e.g. 2018-06-15
```

Same optional date-string pattern as `ngayXuatGia`. Persists through existing `MemberProfilePatch` / `memberRepo` create-update paths.

## Update behavior

1. Admin may pick a date in the form; it flows through draft → patch like other date fields.
2. When building the patch: `ngayHaCapHaLap: textOrUndefined(draft.ngayHaCapHaLap)` — empty draft → `undefined` (not auto-filled).
3. Filler never sees the field; filler submit leaves the field unset unless somehow already on the draft.
4. Clearing the admin input and submitting leaves the field unset.

## UI & i18n

| Piece | Behavior |
|-------|----------|
| Prop | `showNgayHaCapHaLap?: boolean` on `MemberFormFields` (default false) |
| Admin | Pass `showNgayHaCapHaLap`; render DateInput near Hạ lạp (`valueFormat="DD-MM-YYYY"`) |
| Filler | Omit prop / false — do not render |
| Label | `filler_field_ngay_ha_cap_ha_lap` → “Ngày hạ cấp hạ lạp” |
| Required | No |

Draft: `emptyMemberDraft` / load-from-member / `buildMemberPatch` include `ngayHaCapHaLap` (same string helpers as `ngayXuatGia`).

## Excel

Add catalog column:

- `id: 'ngayHaCapHaLap'`
- `group: 'ordination'`
- Header from i18n label
- Cell: stored date string or empty

Available in admin column picker like other ordination columns.

## Architecture

```
domain (Member.ngayHaCapHaLap)
  → memberDraft / buildMemberPatch(draft) (draft value only)
  → MemberFormFields (admin-only DateInput)
  → MemberFormPage (showNgayHaCapHaLap)
  → saveAndLockMember / saveAdminMember (unchanged APIs)
  → memberExcelColumns (new column)
```

## Testing (Vitest)

- `buildMemberPatch`: empty → `undefined` even when precept / xuất gia dates exist; existing date → preserve
- Excel: column id present in catalog for both sangha types
- Admin form shows DateInput when prop true; filler path does not
