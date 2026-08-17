# Member: Năm hạ cấp hạ lạp (`namHaCapHaLap`)

Date: 2026-08-17  
Status: approved for planning  
Depends on: shared `MemberFormFields` / `memberDraft` / `buildMemberPatch`, precept `ngayHePhai`, `ngayXuatGia`, admin Excel column catalog  
Surfaces: admin `MemberFormPage` (field visible); filler submit still auto-fills via patch (field hidden)

## Goal

Add an optional year field **Năm hạ cấp hạ lạp** on the member record. Show it only on the admin form (editable). On filler or admin submit, if the field is empty, set it from the first available source year (Phương trượng = `ngayHePhai`, then xuất gia), ordered by sangha type.

## Decisions

| Topic | Choice |
|-------|--------|
| Relation to `haLap` | **New field** `namHaCapHaLap`; keep existing `haLap` unchanged |
| Auto-fill policy | Only when `namHaCapHaLap` is empty; never overwrite an existing number |
| Phương trượng source | Year extracted from precept `ngayHePhai` |
| Admin UI | Number input; editable; not required |
| Filler UI | Hidden (no control) |
| Excel | New column in `ordination` group, next to `haLap` |
| Where auto runs | Shared domain helper applied when building the save patch (filler + admin) |
| `sanghaType` for resolve | Pass into patch build (draft has no `sanghaType` today) — e.g. `buildMemberPatch(draft, { sanghaType })` |
| Backfill existing docs | Out of scope; fill on next submit when empty |

## Non-goals

- Renaming, hiding, or changing meaning of `haLap`
- Bulk Firestore migration / backfill script
- Sorting or filtering member lists by `namHaCapHaLap`
- Cypress E2E (Vitest only)
- Making the field required

## Data model

Add to `Member`:

```ts
namHaCapHaLap?: number // calendar year, e.g. 2018
```

Same optional number pattern as `haLap`. Persists through existing `MemberProfilePatch` / `memberRepo` create-update paths.

## Resolve helper

Pure function, e.g. `resolveNamHaCapHaLap(input)` in domain:

**Input:** `sanghaType`, optional precept records, `ngayXuatGia`.

**Year parse:** take YYYY from date strings used by the form (typically `YYYY-MM-DD`); invalid/empty → skip that source.

**Priority (first valid year wins):**

| Tăng | Ni |
|------|-----|
| `gioiTyKheo.ngayHePhai` | `gioiTyKheoNi.ngayHePhai` |
| `gioiSaDi.ngayHePhai` | `gioiThucXoaMaNa.ngayHePhai` |
| `ngayXuatGia` | `gioiSaDiNi.ngayHePhai` |
| | `ngayXuatGia` |

**Output:** `number | undefined` (undefined if no source yields a year).

## Update behavior

1. Admin may type a year into the form; it flows through draft → patch like other numeric fields.
2. When building the patch (extend `buildMemberPatch` to accept `sanghaType`, or equivalent thin wrapper used by both callers): if draft `namHaCapHaLap` is already a number → write that value; if empty → set `resolveNamHaCapHaLap(...)` (may remain omitted/undefined).
3. Call sites (`MemberEditorForm`, `MemberFormPage`) already know `sanghaType` — pass it into patch build.
4. Filler never sees the field; filler submit still gets auto-fill when empty because patch build runs.
5. Clearing the admin input and submitting again re-runs auto-fill (empty means “fill if possible”, not “persist cleared”).
6. Later submits do **not** recompute if a value is already stored or typed.

## UI & i18n

| Piece | Behavior |
|-------|----------|
| Prop | `showNamHaCapHaLap?: boolean` on `MemberFormFields` (default false) |
| Admin | Pass `showNamHaCapHaLap`; render number input near Hạ lạp |
| Filler | Omit prop / false — do not render |
| Label | `filler_field_nam_ha_cap_ha_lap` → “Năm hạ cấp hạ lạp” |
| Required | No |

Draft: `emptyMemberDraft` / load-from-member / `buildMemberPatch` include `namHaCapHaLap` (same blank/number helpers as `haLap`).

## Excel

Add catalog column:

- `id: 'namHaCapHaLap'`
- `group: 'ordination'`
- Header from i18n label
- Cell: string of year or empty

Available in admin column picker like other ordination columns.

## Architecture

```
domain (Member.namHaCapHaLap, resolveNamHaCapHaLap)
  → memberDraft / buildMemberPatch(draft, { sanghaType }) (fill-if-empty)
  → MemberFormFields (admin-only number input)
  → MemberFormPage (showNamHaCapHaLap) + MemberEditorForm (pass sanghaType only)
  → saveAndLockMember / saveAdminMember (unchanged APIs)
  → memberExcelColumns (new column)
```

## Testing (Vitest)

- `resolveNamHaCapHaLap`: tang/ni priority, skip empty sources, undefined when none, year parse from `ngayHePhai` / `ngayXuatGia`
- `buildMemberPatch`: empty → auto; existing number → preserve
- Excel: column id present in catalog for both sangha types as applicable
- Optional: admin form shows control when prop true; filler path does not (component test only if cheap)

## Error handling

- No source years: leave field unset; submit still succeeds
- Malformed date string: treat that source as missing; try next in priority
