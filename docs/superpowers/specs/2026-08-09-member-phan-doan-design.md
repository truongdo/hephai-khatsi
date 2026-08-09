# Member form: Phân đoàn for Ni giới org units

Date: 2026-08-09  
Status: approved for planning  
Depends on: member form shared `MemberFormFields` / `memberDraft`, org unit seed `kind: 'ni_gioi'`, required-field validation pattern  
Surfaces: filler `MemberEditorForm` + admin `MemberFormPage` (shared fields)

## Goal

When a member’s selected org unit is **Ni giới** (`OrgUnit.kind === 'ni_gioi'`, including **Ni giới Hệ phái Khất sĩ**), show a required **Phân đoàn** select with four fixed values and persist it on the member document.

## Decisions

| Topic | Choice |
|-------|--------|
| Approach | Optional string field on `Member`; conditional Mantine `Select` in shared form |
| When visible | `orgUnit.kind === 'ni_gioi'` for the current `orgUnitId` |
| When hidden | Giáo đoàn tăng (`kind === 'giao_doan'`) — field not shown |
| Options (stored + displayed) | `"Phân đoàn 1"`, `"Phân đoàn 2"`, `"Phân đoàn 3"`, `"Phân đoàn 4"` |
| Required | Yes — cannot save while field is visible and empty |
| Surfaces | Filler + admin (same `MemberFormFields`) |
| Clear on org change | If `orgUnitId` changes to a non–`ni_gioi` unit, clear `phanDoan` before/with save |
| Temple `phanDoan` | Unrelated; temple field stays as today (no temple work in this feature) |

## Non-goals

- Modeling phân đoàn as nested org units or Firestore subcollections
- Filtering member lists by phân đoàn (can come later; field is stored for that)
- Changing org unit seed / names
- Cypress; Vitest only
- Firestore security-rule special cases for `phanDoan` (same write paths as other profile fields)

## Data model

Add to `Member` (and thus to `MemberProfilePatch` via existing `Partial<Omit<Member, …>>`):

```ts
phanDoan?: string // 'Phân đoàn 1' | 'Phân đoàn 2' | 'Phân đoàn 3' | 'Phân đoàn 4'
```

- Omit or leave unset when org is not `ni_gioi`.
- Do not invent a second encoding (`"1"` / `"pd-1"`); store the Vietnamese label exactly.

Export a small constant list (e.g. `PHAN_DOAN_OPTIONS` next to other filler option constants) used by UI and tests.

## UI

| Piece | Behavior |
|-------|----------|
| Control | Mantine `Select`, label **Phân đoàn**, `required` when visible |
| Placement | Near org / identity controls — admin: under Giáo đoàn / Loại tăng ni; filler editor: near top of fields (org already chosen at entry) |
| Wiring | Pass `orgUnitId` into `MemberFormFields`; resolve kind via existing org-units query/seed already used for Giáo đoàn gốc |
| i18n | Reuse or add `filler_field_phan_doan` / admin-equivalent message key consistent with other member labels |

When the resolved org unit is not `ni_gioi`, do not render the select.

## Validation & save

Extend shared validation (same spirit as `validateMemberRequiredFields`):

- Input includes current `orgUnitId` (or precomputed `requiresPhanDoan: boolean`).
- If org is `ni_gioi` and `phanDoan` is missing / not one of the four allowed values → error `REQUIRED` (or invalid).
- Enforce on **every write path that persists the member** while the field is applicable: filler save, admin **Hoàn thành**, and admin **Lưu nháp** — empty Phân đoàn must not be stored for ni giới members.

`MemberDraft` / `emptyMemberDraft` / `buildMemberPatch` include `phanDoan`.

When admin changes `orgUnitId` on create from `ni_gioi` → `giao_doan`, clear draft `phanDoan` so it is not written.

## Architecture (layers)

```
domain (Member.phanDoan, PHAN_DOAN_OPTIONS)
  → memberDraft / buildMemberPatch
  → validateMemberRequiredFields (+ org kind gate)
  → MemberFormFields Select (conditional)
  → MemberEditorForm / MemberFormPage (pass orgUnitId)
  → existing save use-cases / memberRepo (no new API)
```

No new repository methods; patch field rides existing create/update.

## Testing (Vitest)

- Options constant has exactly the four labels.
- `MemberFormFields` (or page tests): select visible for `ni-gd-i` / `ni-gioi`; hidden for `gd-i`.
- Validation: fails when `ni_gioi` + empty; passes with `"Phân đoàn 2"`; skips when `giao_doan`.
- Patch/draft: `phanDoan` round-trips; cleared when org leaves `ni_gioi`.

## Acceptance

1. Selecting any `ni_gioi` org unit shows Phân đoàn with four options.
2. Save blocked until one option is chosen.
3. Choosing a tăng giáo đoàn hides the field and does not persist `phanDoan`.
4. Saved value is exactly one of `"Phân đoàn 1"` … `"Phân đoàn 4"`.
5. Works on both filler and admin member forms.
`)