# Member form — giáo phẩm ranks by sanghaType + conditional Năm tiến phong

Date: 2026-08-05  
Status: approved for planning  
Scope: member form fields `giaoPhamGiaoHoi` / `giaoPhamHePhai` (filler + admin share `MemberFormFields`)

## Goal

Align phẩm vị dropdowns with the official Tăng / Ni lists, and show **Năm tiến phong** only for senior ranks that use that field — still optional when shown.

## Product decisions

| Topic | Choice |
|-------|--------|
| Tang ranks | `hoa_thuong`, `thuong_toa`, `dai_duc`, `ty_kheo`, `sa_di`, `tap_su` |
| Ni ranks | `ni_truong`, `ni_su`, `ty_kheo_ni`, `thuc_xoa_ma_na`, `sa_di_ni`, `tap_su` |
| Removed from Ni select | `su_co`, `ni_co` (no Firestore migration; legacy values stay on stored docs) |
| Shared lists | Both Giáo hội and Hệ phái fieldsets use the same list for the current `sanghaType` |
| Show Năm tiến phong when rank ∈ | `hoa_thuong`, `thuong_toa`, `ni_truong`, `ni_su` |
| Năm tiến phong required? | No — optional whenever visible |
| On rank change away from that set (or clear) | Clear `namTienPhong` to blank in draft |
| On load with legacy rank / orphaned year | Do not auto-clear on mount; UI follows visibility rules only |

## Rank labels (vi)

| value | label |
|-------|--------|
| `hoa_thuong` | Hòa thượng |
| `thuong_toa` | Thượng tọa |
| `dai_duc` | Đại đức |
| `ty_kheo` | Tỳ-kheo |
| `sa_di` | Sa-di |
| `tap_su` | Tập sự |
| `ni_truong` | Ni trưởng |
| `ni_su` | Ni sư |
| `ty_kheo_ni` | Tỳ-kheo-ni |
| `thuc_xoa_ma_na` | Thức-xoa-ma-na |
| `sa_di_ni` | Sa-di-ni |

Existing message keys for the first nine (except new ones) stay; add keys for `sa_di`, `tap_su`, `thuc_xoa_ma_na`, `sa_di_ni`. Keep unused `filler_rank_su_co` / `filler_rank_ni_co` messages (no cleanup required).

## Behavior

1. `rankOptions(sanghaType)` continues to drive both Selects.
2. Helper `rankShowsNamTienPhong(rank: string): boolean` (exported next to rank constants) gates each fieldset’s `NumberInput`.
3. Rank `onChange` for a fieldset: if the new rank does not show năm tiến phong, set that fieldset’s `namTienPhong` to `''`.
4. No change to `GiaoPham` type, save use-cases, or required-field validation.

## Files

- `tanstack-app/src/components/filler/fillerFormOptions.ts` — lists + helper
- `tanstack-app/messages/vi.json` — new rank messages
- `tanstack-app/src/components/filler/MemberFormFields.tsx` — conditional render + clear on change
- `tanstack-app/src/components/filler/fillerFormOptions.test.ts` — expected values + helper
- Optional: small Vitest on form fields if an existing pattern covers Select/visibility cheaply; no Cypress

## Non-goals

- Migrating or remapping stored `su_co` / `ni_co`
- Making năm tiến phong required
- Separate Giáo hội vs Hệ phái rank lists
- Export / sort changes driven by rank order
- Deleting obsolete i18n keys

## Testing

- Unit: `TANG_RANKS` / `NI_RANKS` value arrays match the tables above; `rankShowsNamTienPhong` true only for the four senior ranks.
- Component (optional): changing rank from `hoa_thuong` to `dai_duc` clears that fieldset’s year and hides the input.
