# Temple Recognition Status (Quyết định) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a required radio in the temple form **Quyết định** section: “Tự viện / Tịnh xá đã được công nhận chưa?” with values Chính thức / Chưa công nhận.

**Architecture:** Store status as `qdCongNhan.trangThai` (`'chinh_thuc' | 'chua_cong_nhan'`). Extend shared draft hydrate/patch, `validateTempleRequiredFields`, and `TempleQuyetDinhSection` (used by filler + admin). QĐ số/ngày stay optional.

**Tech Stack:** React 19, Mantine `Radio.Group`, Paraglide (`messages/vi.json`), Vitest + Testing Library, existing temple draft / required-validation patterns

**Spec:** `docs/superpowers/specs/2026-08-06-temple-cong-nhan-status-design.md`

## Global Constraints

- Work in the current workspace only — **never** `git worktree add`
- Create and use a feature branch from `main` (e.g. `feat/temple-cong-nhan-status`); if already on another branch with WIP, stop and ask
- Only the radio is required; **do not** require `qdCongNhan.so` / `qdCongNhan.ngay` when status is `chinh_thuc`
- Client-only validation (same as other temple required fields) — no Firestore rules changes
- Prefer Vitest; **no new Cypress**
- Reuse `m.filler_error_field_required()` for the radio error string
- After merge squash into `main`, delete the local feature branch unless asked otherwise

## File Structure

| File | Responsibility |
| --- | --- |
| `docs/superpowers/specs/2026-08-06-temple-cong-nhan-status-design.md` | Spec (already on `main`) |
| `docs/superpowers/plans/2026-08-06-temple-cong-nhan-status.md` | This plan |
| `tanstack-app/src/domain/types.ts` | Add `trangThai` on `Temple.qdCongNhan` |
| `tanstack-app/messages/vi.json` | Label + option message keys |
| `tanstack-app/src/components/filler/fillerFormOptions.ts` | Optional shared radio options list |
| `tanstack-app/src/components/filler/templeDraft.ts` | Draft type, hydrate, patch |
| `tanstack-app/src/components/filler/templeDraft.test.ts` | Hydrate/patch tests for `trangThai` |
| `tanstack-app/src/components/filler/templeRequiredValidation.ts` | Require `trangThai` |
| `tanstack-app/src/components/filler/templeRequiredValidation.test.ts` | Unit tests for the new rule |
| `tanstack-app/src/components/filler/TempleEditorFormSections.tsx` | `TempleQuyetDinhSection` radio UI |
| `tanstack-app/src/components/temple/TempleFormFields.tsx` | Pass mapped error into section |
| `tanstack-app/src/components/filler/TempleEditorForm.tsx` | Pass `qdCongNhanTrangThai` into validator |
| `tanstack-app/src/components/admin/TempleFormPage.tsx` | Same for admin **Hoàn thành** |
| `tanstack-app/src/components/filler/TempleEditorForm.test.tsx` | Assert radio present; optional save-block |

---

### Task 0: Branch from main + commit plan

**Files:**
- Add: `docs/superpowers/plans/2026-08-06-temple-cong-nhan-status.md`

**Interfaces:**
- Consumes: `main` with spec commit `docs: spec temple recognition status radio in Quyết định`
- Produces: branch `feat/temple-cong-nhan-status` with this plan committed

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
git checkout -b feat/temple-cong-nhan-status
```

(`git pull` may be a no-op if local `main` is ahead of origin with the spec commit — that is fine.)

- [ ] **Step 3: Commit this plan**

```bash
git add docs/superpowers/plans/2026-08-06-temple-cong-nhan-status.md
git commit -m "$(cat <<'EOF'
docs: plan temple recognition status radio in Quyết định

EOF
)"
```

---

### Task 1: Domain type + i18n + radio options

**Files:**
- Modify: `tanstack-app/src/domain/types.ts` (`Temple.qdCongNhan`)
- Modify: `tanstack-app/messages/vi.json`
- Modify: `tanstack-app/src/components/filler/fillerFormOptions.ts`
- Modify: `tanstack-app/src/components/filler/fillerFormOptions.test.ts` (if present patterns exist; otherwise add minimal asserts)

**Interfaces:**
- Consumes: existing `Temple.qdCongNhan?: { so?: string; ngay?: string }`
- Produces:
  - `Temple.qdCongNhan?: { trangThai?: 'chinh_thuc' | 'chua_cong_nhan'; so?: string; ngay?: string }`
  - Message keys (exact strings):
    - `filler_field_qd_cong_nhan_trang_thai`: `Tự viện / Tịnh xá đã được công nhận chưa?`
    - `filler_opt_qd_cong_nhan_chinh_thuc`: `Chính thức`
    - `filler_opt_qd_cong_nhan_chua`: `Chưa công nhận`
  - `QD_CONG_NHAN_TRANG_THAI_OPTIONS: FillerOption[]` with values `chinh_thuc` / `chua_cong_nhan`

- [ ] **Step 1: Extend `Temple.qdCongNhan`**

In `tanstack-app/src/domain/types.ts`, change:

```ts
  qdCongNhan?: { so?: string; ngay?: string }
```

to:

```ts
  qdCongNhan?: {
    trangThai?: 'chinh_thuc' | 'chua_cong_nhan'
    so?: string
    ngay?: string
  }
```

(`TempleProfilePatch` is `Partial<Omit<Temple, …>>` — no separate patch type change.)

- [ ] **Step 2: Add Paraglide messages**

In `tanstack-app/messages/vi.json`, near the existing `filler_field_qd_cong_nhan_*` keys (~411), add:

```json
  "filler_field_qd_cong_nhan_trang_thai": "Tự viện / Tịnh xá đã được công nhận chưa?",
  "filler_opt_qd_cong_nhan_chinh_thuc": "Chính thức",
  "filler_opt_qd_cong_nhan_chua": "Chưa công nhận",
```

- [ ] **Step 3: Add options constant**

In `fillerFormOptions.ts`:

```ts
export const QD_CONG_NHAN_TRANG_THAI_OPTIONS: FillerOption[] = [
  {
    value: 'chinh_thuc',
    label: () => m.filler_opt_qd_cong_nhan_chinh_thuc(),
  },
  {
    value: 'chua_cong_nhan',
    label: () => m.filler_opt_qd_cong_nhan_chua(),
  },
]
```

- [ ] **Step 4: Compile paraglide and smoke-check options**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm run paraglide
pnpm exec vitest run src/components/filler/fillerFormOptions.test.ts
```

If `fillerFormOptions.test.ts` does not cover option lists yet, either skip extra asserts or add:

```ts
it('exposes qd cong nhan trang thai options', () => {
  expect(QD_CONG_NHAN_TRANG_THAI_OPTIONS.map((o) => o.value)).toEqual([
    'chinh_thuc',
    'chua_cong_nhan',
  ])
})
```

Expected: PASS (or only paraglide succeeds if you defer the options test).

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/domain/types.ts \
  tanstack-app/messages/vi.json \
  tanstack-app/src/components/filler/fillerFormOptions.ts \
  tanstack-app/src/components/filler/fillerFormOptions.test.ts
git commit -m "$(cat <<'EOF'
feat: add temple recognition status type and i18n

EOF
)"
```

---

### Task 2: Draft hydrate + patch for `trangThai`

**Files:**
- Modify: `tanstack-app/src/components/filler/templeDraft.ts`
- Modify: `tanstack-app/src/components/filler/templeDraft.test.ts`

**Interfaces:**
- Consumes: `Temple.qdCongNhan.trangThai` from Task 1
- Produces:
  - `TempleDraft['qdCongNhan'] = { trangThai: 'chinh_thuc' | 'chua_cong_nhan' | ''; so: string; ngay: string }`
  - `emptyTempleDraft` sets `trangThai` from initial when value is `'chinh_thuc' | 'chua_cong_nhan'`, else `''`
  - `buildTemplePatch` sets `qdCongNhan.trangThai` to the enum when selected, else `undefined` (keep sending `so`/`ngay` as today)

- [ ] **Step 1: Write the failing tests**

Append to `templeDraft.test.ts`:

```ts
describe('templeDraft qdCongNhan.trangThai', () => {
  it('hydrates known trangThai and patches it', () => {
    const draft = emptyTempleDraft({
      qdCongNhan: { trangThai: 'chinh_thuc', so: '01', ngay: '01/01/2020' },
    })
    expect(draft.qdCongNhan.trangThai).toBe('chinh_thuc')
    expect(buildTemplePatch(draft).qdCongNhan).toEqual({
      trangThai: 'chinh_thuc',
      so: '01',
      ngay: '01/01/2020',
    })
  })

  it('defaults missing trangThai to empty and omits it from patch', () => {
    const draft = emptyTempleDraft({
      qdCongNhan: { so: '01', ngay: '' },
    })
    expect(draft.qdCongNhan.trangThai).toBe('')
    expect(buildTemplePatch(draft).qdCongNhan).toEqual({
      trangThai: undefined,
      so: '01',
      ngay: undefined,
    })
  })

  it('ignores unknown trangThai values on hydrate', () => {
    const draft = emptyTempleDraft({
      qdCongNhan: {
        // @ts-expect-error intentional invalid legacy value
        trangThai: 'other',
      },
    })
    expect(draft.qdCongNhan.trangThai).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/components/filler/templeDraft.test.ts
```

Expected: FAIL (draft type / hydrate missing `trangThai`).

- [ ] **Step 3: Implement hydrate + patch**

In `templeDraft.ts`:

1. Add helper near other helpers:

```ts
const QD_CONG_NHAN_TRANG_THAI = new Set(['chinh_thuc', 'chua_cong_nhan'] as const)

type QdCongNhanTrangThai = 'chinh_thuc' | 'chua_cong_nhan'

function hydrateQdCongNhanTrangThai(
  value: string | undefined,
): QdCongNhanTrangThai | '' {
  return value === 'chinh_thuc' || value === 'chua_cong_nhan' ? value : ''
}
```

2. Update `TempleDraft`:

```ts
  qdCongNhan: {
    trangThai: QdCongNhanTrangThai | ''
    so: string
    ngay: string
  }
```

3. In `emptyTempleDraft`:

```ts
    qdCongNhan: {
      trangThai: hydrateQdCongNhanTrangThai(initial.qdCongNhan?.trangThai),
      so: initial.qdCongNhan?.so ?? '',
      ngay: initial.qdCongNhan?.ngay ?? '',
    },
```

4. In `buildTemplePatch`:

```ts
    qdCongNhan: {
      trangThai:
        draft.qdCongNhan.trangThai === ''
          ? undefined
          : draft.qdCongNhan.trangThai,
      so: textOrUndefined(draft.qdCongNhan.so),
      ngay: textOrUndefined(draft.qdCongNhan.ngay),
    },
```

Remove unused `QD_CONG_NHAN_TRANG_THAI` if you inlined the checks (or use the Set in the helper — either is fine; prefer the explicit `===` helper above and drop the unused Set).

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/components/filler/templeDraft.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/filler/templeDraft.ts \
  tanstack-app/src/components/filler/templeDraft.test.ts
git commit -m "$(cat <<'EOF'
feat: hydrate and patch temple qdCongNhan.trangThai

EOF
)"
```

---

### Task 3: Required validation for `trangThai`

**Files:**
- Modify: `tanstack-app/src/components/filler/templeRequiredValidation.ts`
- Modify: `tanstack-app/src/components/filler/templeRequiredValidation.test.ts`

**Interfaces:**
- Consumes: draft status string from call sites (`'chinh_thuc' | 'chua_cong_nhan' | ''`)
- Produces:
  - `TempleRequiredDraft.qdCongNhanTrangThai: string` (or the union including `''`)
  - `TempleRequiredFieldErrors.qdCongNhanTrangThai?: 'REQUIRED'`
  - `validateTempleRequiredFields` fails when value is not `'chinh_thuc'` and not `'chua_cong_nhan'`
  - Does **not** look at `so` / `ngay`

- [ ] **Step 1: Write the failing tests**

In `templeRequiredValidation.test.ts`:

1. Add `qdCongNhanTrangThai: 'chinh_thuc'` to `filledDraft()` defaults.
2. In the blank failing draft object of the first test, add `qdCongNhanTrangThai: ''` and assert `expect(result.errors.qdCongNhanTrangThai).toBe('REQUIRED')`.
3. Add:

```ts
  it('requires qdCongNhanTrangThai when empty', () => {
    const result = validateTempleRequiredFields(
      filledDraft({ qdCongNhanTrangThai: '' }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.qdCongNhanTrangThai).toBe('REQUIRED')
  })

  it('accepts chua_cong_nhan without requiring so/ngay', () => {
    expect(
      validateTempleRequiredFields(
        filledDraft({ qdCongNhanTrangThai: 'chua_cong_nhan' }),
      ),
    ).toEqual({ valid: true, errors: {} })
  })
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/components/filler/templeRequiredValidation.test.ts
```

Expected: FAIL (unknown field / missing error).

- [ ] **Step 3: Implement validation**

In `templeRequiredValidation.ts`:

```ts
export type TempleRequiredDraft = {
  // ...existing fields...
  qdCongNhanTrangThai: string
  hasPhoto: boolean
  extraManagerPhone?: string
}

export type TempleRequiredFieldErrors = {
  // ...existing fields...
  qdCongNhanTrangThai?: 'REQUIRED'
  photo?: 'REQUIRED'
  extraManagerPhone?: 'INVALID'
}
```

Inside `validateTempleRequiredFields`, after photo check (or before — order does not matter for validity):

```ts
  if (
    draft.qdCongNhanTrangThai !== 'chinh_thuc' &&
    draft.qdCongNhanTrangThai !== 'chua_cong_nhan'
  ) {
    errors.qdCongNhanTrangThai = 'REQUIRED'
  }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/components/filler/templeRequiredValidation.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/filler/templeRequiredValidation.ts \
  tanstack-app/src/components/filler/templeRequiredValidation.test.ts
git commit -m "$(cat <<'EOF'
feat: require temple recognition status on validated save

EOF
)"
```

---

### Task 4: UI radio + wire errors and save call sites

**Files:**
- Modify: `tanstack-app/src/components/filler/TempleEditorFormSections.tsx` (`TempleQuyetDinhSection`)
- Modify: `tanstack-app/src/components/temple/TempleFormFields.tsx`
- Modify: `tanstack-app/src/components/filler/TempleEditorForm.tsx`
- Modify: `tanstack-app/src/components/admin/TempleFormPage.tsx`
- Modify: `tanstack-app/src/components/filler/TempleEditorForm.test.tsx`

**Interfaces:**
- Consumes:
  - `QD_CONG_NHAN_TRANG_THAI_OPTIONS` / Paraglide labels from Task 1
  - `TempleDraft.qdCongNhan.trangThai` from Task 2
  - `TempleRequiredFieldErrors.qdCongNhanTrangThai` from Task 3
- Produces:
  - `TempleQuyetDinhSection` props: `errors?: { qdCongNhanTrangThai?: string }`
  - Radio above existing QĐ text inputs; `withAsterisk`; updates `draft.qdCongNhan.trangThai`
  - Filler `handleSave` and admin `complete` pass `qdCongNhanTrangThai: draft.qdCongNhan.trangThai`

- [ ] **Step 1: Write / extend failing UI test**

In `TempleEditorForm.test.tsx`, inside the existing “renders sections” test (or a new focused test), after the Quyết định heading assert:

```ts
    expect(
      screen.getByText(m.filler_field_qd_cong_nhan_trang_thai()),
    ).toBeTruthy()
    expect(
      screen.getByRole('radio', { name: m.filler_opt_qd_cong_nhan_chinh_thuc() }),
    ).toBeTruthy()
    expect(
      screen.getByRole('radio', { name: m.filler_opt_qd_cong_nhan_chua() }),
    ).toBeTruthy()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm run paraglide
pnpm exec vitest run src/components/filler/TempleEditorForm.test.tsx
```

Expected: FAIL (radio / label not found).

- [ ] **Step 3: Implement `TempleQuyetDinhSection` radio**

1. Import `Radio` from `@mantine/core` and `QD_CONG_NHAN_TRANG_THAI_OPTIONS` from `./fillerFormOptions`.
2. Extend props:

```ts
export const TempleQuyetDinhSection = memo(function TempleQuyetDinhSection({
  qdCongNhan,
  qdBoNhiemTruTri,
  setDraft,
  errors,
  disabled,
}: {
  qdCongNhan: TempleDraft['qdCongNhan']
  qdBoNhiemTruTri: TempleDraft['qdBoNhiemTruTri']
  setDraft: SetDraft
  errors?: { qdCongNhanTrangThai?: string }
  disabled: boolean
}) {
```

3. At the top of the `FormSection` (before `SimpleGrid`):

```tsx
      <Radio.Group
        label={m.filler_field_qd_cong_nhan_trang_thai()}
        withAsterisk
        value={qdCongNhan.trangThai}
        onChange={(value) =>
          setDraft((current) => ({
            ...current,
            qdCongNhan: {
              ...current.qdCongNhan,
              trangThai: value as TempleDraft['qdCongNhan']['trangThai'],
            },
          }))
        }
        error={errors?.qdCongNhanTrangThai}
      >
        <Group mt="xs">
          {QD_CONG_NHAN_TRANG_THAI_OPTIONS.map((option) => (
            <Radio
              key={option.value}
              value={option.value}
              label={option.label()}
              disabled={disabled}
            />
          ))}
        </Group>
      </Radio.Group>
```

Keep the existing `SimpleGrid` of four text inputs unchanged below.

- [ ] **Step 4: Wire `TempleFormFields` + save validators**

In `TempleFormFields.tsx`:

```tsx
      <TempleQuyetDinhSection
        qdCongNhan={draft.qdCongNhan}
        qdBoNhiemTruTri={draft.qdBoNhiemTruTri}
        setDraft={setDraft}
        errors={{
          qdCongNhanTrangThai: mapRequiredError(
            fieldErrors.qdCongNhanTrangThai,
          ),
        }}
        disabled={disabled}
      />
```

In `TempleEditorForm.tsx` `handleSave` and `TempleFormPage.tsx` `complete`, add to the `validateTempleRequiredFields({...})` object:

```ts
      qdCongNhanTrangThai: draft.qdCongNhan.trangThai,
```

- [ ] **Step 5: Run UI + validation-related tests**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm run paraglide
pnpm exec vitest run \
  src/components/filler/templeDraft.test.ts \
  src/components/filler/templeRequiredValidation.test.ts \
  src/components/filler/TempleEditorForm.test.tsx \
  src/components/admin/TempleFormPage.test.tsx
```

Expected: PASS. If `TempleFormPage.test.tsx` or save-path tests construct incomplete required drafts / mock validation, update them only as needed so TypeScript and assertions still hold (any real `validateTempleRequiredFields` call must include `qdCongNhanTrangThai`).

- [ ] **Step 6: Commit**

```bash
git add \
  tanstack-app/src/components/filler/TempleEditorFormSections.tsx \
  tanstack-app/src/components/temple/TempleFormFields.tsx \
  tanstack-app/src/components/filler/TempleEditorForm.tsx \
  tanstack-app/src/components/admin/TempleFormPage.tsx \
  tanstack-app/src/components/filler/TempleEditorForm.test.tsx \
  tanstack-app/src/components/admin/TempleFormPage.test.tsx
git commit -m "$(cat <<'EOF'
feat: add required recognition status radio to temple Quyết định

EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| `qdCongNhan.trangThai` enum on Temple | Task 1 |
| Draft hydrate `''` / known values; patch omits empty | Task 2 |
| Required validation; so/ngày not required | Task 3 |
| Radio above existing QD fields; asterisk + error | Task 4 |
| Filler + admin via shared section | Task 4 |
| i18n VI labels | Task 1 |
| Vitest only / no Cypress | Tasks 2–4 |
| No Firestore rules | Global Constraints |

No placeholders remaining. Types use `qdCongNhanTrangThai` error key consistently across validation, form wiring, and UI props.
