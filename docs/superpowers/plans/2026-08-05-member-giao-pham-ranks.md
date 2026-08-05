# Member Giáo Phẩm Ranks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update member form phẩm vị lists by `sanghaType` and show optional **Năm tiến phong** only for Hòa thượng / Thượng tọa / Ni trưởng / Ni sư.

**Architecture:** Keep options in `fillerFormOptions.ts` (shared by filler + admin via `MemberFormFields`). Add `rankShowsNamTienPhong` + a tiny pure helper for clearing year on rank change. Conditionally render each fieldset’s `NumberInput`; clear `namTienPhong` in the same state update when the new rank is outside the senior set. No schema, validation, or migration changes.

**Tech Stack:** React 19, Mantine Select/NumberInput, Paraglide (`messages/vi.json`), Vitest

**Spec:** `docs/superpowers/specs/2026-08-05-member-giao-pham-ranks-design.md`

## Global Constraints

- Work in the current workspace only — **never** `git worktree add`
- Create and use a feature branch from `main` (e.g. `feat/member-giao-pham-ranks`); if already on another branch with WIP, stop and ask
- Tang ranks: `hoa_thuong`, `thuong_toa`, `dai_duc`, `ty_kheo`, `sa_di`, `tap_su`
- Ni ranks: `ni_truong`, `ni_su`, `ty_kheo_ni`, `thuc_xoa_ma_na`, `sa_di_ni`, `tap_su`
- Show Năm tiến phong when rank ∈ `hoa_thuong` | `thuong_toa` | `ni_truong` | `ni_su`
- Năm tiến phong remains **optional** (no required validation)
- On rank change away from that set (or clear): set that fieldset’s `namTienPhong` to `''`
- Do **not** auto-clear `namTienPhong` on mount for legacy data
- Do **not** migrate stored `su_co` / `ni_co`; leave unused i18n keys
- Prefer Vitest; **no new Cypress**
- After merge squash into `main`, delete the local feature branch unless asked otherwise

## File Structure

| File | Responsibility |
| --- | --- |
| `docs/superpowers/specs/2026-08-05-member-giao-pham-ranks-design.md` | Spec (already on `main`) |
| `docs/superpowers/plans/2026-08-05-member-giao-pham-ranks.md` | This plan |
| `tanstack-app/messages/vi.json` | New rank labels |
| `tanstack-app/src/components/filler/fillerFormOptions.ts` | Rank lists + `rankShowsNamTienPhong` + clear helper |
| `tanstack-app/src/components/filler/fillerFormOptions.test.ts` | Values + helper unit tests |
| `tanstack-app/src/components/filler/MemberFormFields.tsx` | Conditional Năm tiến phong + clear on rank change |

---

### Task 0: Branch from main + commit plan

**Files:**
- Add: `docs/superpowers/plans/2026-08-05-member-giao-pham-ranks.md`

**Interfaces:**
- Consumes: clean-enough `main` (spec commit already present)
- Produces: branch `feat/member-giao-pham-ranks` with this plan committed

- [ ] **Step 1: Confirm branch situation**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git branch --show-current
git status -sb
```

If not on `main` / `master`: **stop and ask** whether to stash/commit WIP and branch from `main`, or continue on current branch.

- [ ] **Step 2: Create feature branch from main**

```bash
git checkout main
git pull
git checkout -b feat/member-giao-pham-ranks
```

- [ ] **Step 3: Commit this plan**

```bash
git add docs/superpowers/plans/2026-08-05-member-giao-pham-ranks.md
git commit -m "$(cat <<'EOF'
docs: plan member giáo phẩm ranks and conditional năm tiến phong

EOF
)"
```

---

### Task 1: Rank options + i18n + `rankShowsNamTienPhong`

**Files:**
- Modify: `tanstack-app/messages/vi.json`
- Modify: `tanstack-app/src/components/filler/fillerFormOptions.ts`
- Modify: `tanstack-app/src/components/filler/fillerFormOptions.test.ts`

**Interfaces:**
- Consumes: existing `FillerOption`, Paraglide `m.*`
- Produces:
  - Updated `TANG_RANKS` / `NI_RANKS` value arrays (exact order below)
  - `export function rankShowsNamTienPhong(rank: string): boolean`
  - `export function namTienPhongAfterRankChange(rank: string, current: string | number): string | number`
  - Message keys: `filler_rank_sa_di`, `filler_rank_tap_su`, `filler_rank_thuc_xoa_ma_na`, `filler_rank_sa_di_ni`

- [ ] **Step 1: Write the failing tests**

Replace the rank expectations in `fillerFormOptions.test.ts` and add helper tests:

```ts
import { describe, expect, it } from 'vitest'
import {
  DAC_DIEM_OPTIONS,
  HANG_MUC_XAY_DUNG_OPTIONS,
  namTienPhongAfterRankChange,
  NI_RANKS,
  rankShowsNamTienPhong,
  TANG_RANKS,
} from './fillerFormOptions'

describe('fillerFormOptions', () => {
  it('exposes tang and ni rank values from the DB design', () => {
    expect(TANG_RANKS.map((r) => r.value)).toEqual([
      'hoa_thuong',
      'thuong_toa',
      'dai_duc',
      'ty_kheo',
      'sa_di',
      'tap_su',
    ])
    expect(NI_RANKS.map((r) => r.value)).toEqual([
      'ni_truong',
      'ni_su',
      'ty_kheo_ni',
      'thuc_xoa_ma_na',
      'sa_di_ni',
      'tap_su',
    ])
  })

  it('shows namTienPhong only for senior ranks', () => {
    expect(rankShowsNamTienPhong('hoa_thuong')).toBe(true)
    expect(rankShowsNamTienPhong('thuong_toa')).toBe(true)
    expect(rankShowsNamTienPhong('ni_truong')).toBe(true)
    expect(rankShowsNamTienPhong('ni_su')).toBe(true)
    expect(rankShowsNamTienPhong('dai_duc')).toBe(false)
    expect(rankShowsNamTienPhong('ty_kheo')).toBe(false)
    expect(rankShowsNamTienPhong('sa_di')).toBe(false)
    expect(rankShowsNamTienPhong('tap_su')).toBe(false)
    expect(rankShowsNamTienPhong('ty_kheo_ni')).toBe(false)
    expect(rankShowsNamTienPhong('thuc_xoa_ma_na')).toBe(false)
    expect(rankShowsNamTienPhong('sa_di_ni')).toBe(false)
    expect(rankShowsNamTienPhong('')).toBe(false)
  })

  it('clears namTienPhong when rank no longer shows the field', () => {
    expect(namTienPhongAfterRankChange('hoa_thuong', 1990)).toBe(1990)
    expect(namTienPhongAfterRankChange('dai_duc', 1990)).toBe('')
    expect(namTienPhongAfterRankChange('', 1990)).toBe('')
  })

  it('exposes fixed dacDiem and hangMuc option values', () => {
    expect(DAC_DIEM_OPTIONS.length).toBeGreaterThanOrEqual(5)
    expect(HANG_MUC_XAY_DUNG_OPTIONS.length).toBeGreaterThanOrEqual(5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/components/filler/fillerFormOptions.test.ts
```

Expected: FAIL — missing ranks / missing exports.

- [ ] **Step 3: Add i18n keys**

In `tanstack-app/messages/vi.json`, near the other `filler_rank_*` keys, add:

```json
  "filler_rank_sa_di": "Sa-di",
  "filler_rank_tap_su": "Tập sự",
  "filler_rank_thuc_xoa_ma_na": "Thức-xoa-ma-na",
  "filler_rank_sa_di_ni": "Sa-di-ni",
```

Keep `filler_rank_su_co` and `filler_rank_ni_co` unchanged.

- [ ] **Step 4: Implement options + helpers**

In `fillerFormOptions.ts`:

```ts
export const TANG_RANKS: FillerOption[] = [
  { value: 'hoa_thuong', label: () => m.filler_rank_hoa_thuong() },
  { value: 'thuong_toa', label: () => m.filler_rank_thuong_toa() },
  { value: 'dai_duc', label: () => m.filler_rank_dai_duc() },
  { value: 'ty_kheo', label: () => m.filler_rank_ty_kheo() },
  { value: 'sa_di', label: () => m.filler_rank_sa_di() },
  { value: 'tap_su', label: () => m.filler_rank_tap_su() },
]

export const NI_RANKS: FillerOption[] = [
  { value: 'ni_truong', label: () => m.filler_rank_ni_truong() },
  { value: 'ni_su', label: () => m.filler_rank_ni_su() },
  { value: 'ty_kheo_ni', label: () => m.filler_rank_ty_kheo_ni() },
  { value: 'thuc_xoa_ma_na', label: () => m.filler_rank_thuc_xoa_ma_na() },
  { value: 'sa_di_ni', label: () => m.filler_rank_sa_di_ni() },
  { value: 'tap_su', label: () => m.filler_rank_tap_su() },
]

const RANKS_WITH_NAM_TIEN_PHONG = new Set([
  'hoa_thuong',
  'thuong_toa',
  'ni_truong',
  'ni_su',
])

export function rankShowsNamTienPhong(rank: string): boolean {
  return RANKS_WITH_NAM_TIEN_PHONG.has(rank)
}

export function namTienPhongAfterRankChange(
  rank: string,
  current: string | number,
): string | number {
  return rankShowsNamTienPhong(rank) ? current : ''
}
```

If Paraglide types complain about missing `m.filler_rank_*`, run:

```bash
pnpm run paraglide
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/components/filler/fillerFormOptions.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add \
  tanstack-app/messages/vi.json \
  tanstack-app/src/components/filler/fillerFormOptions.ts \
  tanstack-app/src/components/filler/fillerFormOptions.test.ts \
  tanstack-app/src/paraglide
git commit -m "$(cat <<'EOF'
feat(members): expand tang/ni giáo phẩm ranks and năm tiến phong helpers

EOF
)"
```

(Only stage `src/paraglide` if `pnpm run paraglide` changed generated files.)

---

### Task 2: Conditionally show Năm tiến phong + clear on rank change

**Files:**
- Modify: `tanstack-app/src/components/filler/MemberFormFields.tsx` (imports ~22; phẩm vị section ~754–808; nested update helper if needed)

**Interfaces:**
- Consumes: `rankShowsNamTienPhong`, `namTienPhongAfterRankChange` from Task 1
- Produces: each fieldset shows `NumberInput` only when `rankShowsNamTienPhong(draft.*.rank)`; rank `onChange` updates `rank` and possibly clears `namTienPhong` in one `setDraft`

- [ ] **Step 1: Import helpers**

Change the import from `./fillerFormOptions`:

```ts
import {
  namTienPhongAfterRankChange,
  NI_RANKS,
  rankShowsNamTienPhong,
  TANG_RANKS,
} from './fillerFormOptions'
```

- [ ] **Step 2: Add a nested updater that can patch multiple fields**

Near `updateNested`, add (or inline equivalent in both Selects — prefer one helper to avoid drift):

```ts
  const updateGiaoPhamRank = (
    key: 'giaoPhamGiaoHoi' | 'giaoPhamHePhai',
    rank: string,
  ) =>
    setDraft((current) => ({
      ...current,
      [key]: {
        ...current[key],
        rank,
        namTienPhong: namTienPhongAfterRankChange(
          rank,
          current[key].namTienPhong,
        ),
      },
    }))
```

- [ ] **Step 3: Wire Giáo hội fieldset**

Replace the Giáo hội rank Select `onChange` and wrap the year input:

```tsx
                <Select
                  label={m.filler_field_rank()}
                  data={ranks}
                  value={draft.giaoPhamGiaoHoi.rank || null}
                  onChange={(value) =>
                    updateGiaoPhamRank('giaoPhamGiaoHoi', value ?? '')
                  }
                  clearable
                />
                {rankShowsNamTienPhong(draft.giaoPhamGiaoHoi.rank) ? (
                  <NumberInput
                    label={m.filler_field_nam_tien_phong()}
                    placeholder={m.filler_ph_year()}
                    value={draft.giaoPhamGiaoHoi.namTienPhong}
                    onChange={(value) =>
                      updateNested(
                        'giaoPhamGiaoHoi',
                        'namTienPhong',
                        numberInputValue(value),
                      )
                    }
                    min={0}
                  />
                ) : null}
```

- [ ] **Step 4: Wire Hệ phái fieldset**

Same pattern for `giaoPhamHePhai`:

```tsx
                <Select
                  label={m.filler_field_rank()}
                  data={ranks}
                  value={draft.giaoPhamHePhai.rank || null}
                  onChange={(value) =>
                    updateGiaoPhamRank('giaoPhamHePhai', value ?? '')
                  }
                  clearable
                />
                {rankShowsNamTienPhong(draft.giaoPhamHePhai.rank) ? (
                  <NumberInput
                    label={m.filler_field_nam_tien_phong()}
                    placeholder={m.filler_ph_year()}
                    value={draft.giaoPhamHePhai.namTienPhong}
                    onChange={(value) =>
                      updateNested(
                        'giaoPhamHePhai',
                        'namTienPhong',
                        numberInputValue(value),
                      )
                    }
                    min={0}
                  />
                ) : null}
```

Do **not** mark `NumberInput` as `required`. Do **not** clear year on mount.

- [ ] **Step 5: Run related Vitest**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/components/filler/fillerFormOptions.test.ts src/components/filler/MemberEditorForm.test.tsx src/components/admin/MemberFormPage.test.tsx
```

Expected: PASS (no Cypress).

- [ ] **Step 6: Commit**

```bash
git add tanstack-app/src/components/filler/MemberFormFields.tsx
git commit -m "$(cat <<'EOF'
feat(members): show năm tiến phong only for senior giáo phẩm ranks

EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| Tang rank list (6 values) | Task 1 |
| Ni rank list (6 values; drop `su_co`/`ni_co`) | Task 1 |
| New i18n labels | Task 1 |
| Show year for 4 senior ranks only | Task 1 helper + Task 2 UI |
| Year optional | Task 2 (no `required`) |
| Clear year on rank change away / clear | Task 1 helper + Task 2 `updateGiaoPhamRank` |
| No mount auto-clear / no migration | Global constraints; no task migrates |
| Both Giáo hội + Hệ phái | Task 2 |
| Vitest only | Tasks 1–2 |

No placeholders remaining. Helper signatures in Task 2 match Task 1 exports.
