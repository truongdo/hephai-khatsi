# Temple Photo Required Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require temple portrait (`Ảnh tịnh xá`) on validated save for filler **Lưu** and admin **Hoàn thành**.

**Architecture:** Extend shared `validateTempleRequiredFields` with `hasPhoto: boolean`. Call sites pass `!!(photoPath || pendingPhoto)`. Mirror member portrait UI: `required` + field error on `TemplePortraitField`. Client-only — no Firestore rules.

**Tech Stack:** React 19, Mantine, Vitest + Testing Library, existing `validateTempleRequiredFields` / `TempleFormFields` / `TemplePortraitField`

**Spec:** `docs/superpowers/specs/2026-08-05-temple-photo-required-design.md`

## Global Constraints

- Work in the current workspace only — **never** `git worktree add`
- Create and use a feature branch from `main` (e.g. `feat/temple-photo-required`); if already on another branch with WIP, stop and ask
- Photo satisfied when `photoPath` non-null **or** pending `File` present
- Create flow: pending file is enough before save; post-create upload unchanged
- Admin **Lưu nháp** still skips required validation
- No Firestore / server-side required enforcement
- Prefer Vitest; **no new Cypress**
- Reuse `m.filler_error_field_required()` for photo error (no new i18n keys)
- After merge squash into `main`, delete the local feature branch unless asked otherwise

## File Structure

| File | Responsibility |
| --- | --- |
| `docs/superpowers/specs/2026-08-05-temple-photo-required-design.md` | Spec (already on `main`) |
| `docs/superpowers/plans/2026-08-05-temple-photo-required.md` | This plan |
| `tanstack-app/src/components/filler/templeRequiredValidation.ts` | Add `hasPhoto` + `errors.photo` |
| `tanstack-app/src/components/filler/templeRequiredValidation.test.ts` | Unit tests for photo rule |
| `tanstack-app/src/components/temple/TemplePortraitField.tsx` | `required` + `error` props (member pattern) |
| `tanstack-app/src/components/temple/TemplePortraitField.test.tsx` | Light UI tests for required/error |
| `tanstack-app/src/components/temple/TempleFormFields.tsx` | Wire `required` + mapped photo error |
| `tanstack-app/src/components/filler/TempleEditorForm.tsx` | Pass `hasPhoto` into validator on **Lưu** |
| `tanstack-app/src/components/admin/TempleFormPage.tsx` | Pass `hasPhoto` into validator on **Hoàn thành** |
| `tanstack-app/src/components/filler/TempleEditorForm.test.tsx` | Seed photo; block-save without photo |
| `tanstack-app/src/components/admin/TempleFormPage.test.tsx` | Block Hoàn thành without photo (optional assert) |

---

### Task 0: Branch from main + commit plan

**Files:**
- Add: `docs/superpowers/plans/2026-08-05-temple-photo-required.md`

**Interfaces:**
- Consumes: clean-enough `main` (spec commit already present)
- Produces: branch `feat/temple-photo-required` with this plan committed

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
git checkout -b feat/temple-photo-required
```

- [ ] **Step 3: Commit this plan**

```bash
git add docs/superpowers/plans/2026-08-05-temple-photo-required.md
git commit -m "$(cat <<'EOF'
docs: plan for required temple portrait on filler and admin forms

EOF
)"
```

---

### Task 1: Validation — `hasPhoto` required

**Files:**
- Modify: `tanstack-app/src/components/filler/templeRequiredValidation.ts`
- Modify: `tanstack-app/src/components/filler/templeRequiredValidation.test.ts`

**Interfaces:**
- Consumes: existing `TempleRequiredDraft` / `TempleRequiredFieldErrors` / `validateTempleRequiredFields`
- Produces:
  - `TempleRequiredDraft.hasPhoto: boolean`
  - `TempleRequiredFieldErrors.photo?: 'REQUIRED'`
  - `validateTempleRequiredFields` sets `errors.photo = 'REQUIRED'` when `!draft.hasPhoto`

- [ ] **Step 1: Write the failing tests**

In `templeRequiredValidation.test.ts`:

1. Add `hasPhoto: true` to `filledDraft()` defaults.
2. Add `hasPhoto: false` to the blank/identity failing draft object in the first test, and assert `expect(result.errors.photo).toBe('REQUIRED')`.
3. Add:

```ts
  it('requires photo when hasPhoto is false', () => {
    const result = validateTempleRequiredFields(
      filledDraft({ hasPhoto: false }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.photo).toBe('REQUIRED')
  })

  it('accepts hasPhoto true without other photo fields', () => {
    expect(validateTempleRequiredFields(filledDraft({ hasPhoto: true }))).toEqual({
      valid: true,
      errors: {},
    })
  })
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/components/filler/templeRequiredValidation.test.ts
```

Expected: FAIL — `hasPhoto` not on type / not validated (TypeScript or missing `errors.photo`).

- [ ] **Step 3: Minimal implementation**

In `templeRequiredValidation.ts`:

```ts
export type TempleRequiredDraft = {
  // …existing fields…
  hasPhoto: boolean
}

export type TempleRequiredFieldErrors = {
  // …existing fields…
  photo?: 'REQUIRED'
}

// inside validateTempleRequiredFields, before return:
if (!draft.hasPhoto) errors.photo = 'REQUIRED'
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/components/filler/templeRequiredValidation.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/filler/templeRequiredValidation.ts \
  tanstack-app/src/components/filler/templeRequiredValidation.test.ts
git commit -m "$(cat <<'EOF'
feat(temple): require hasPhoto in temple required-field validation

EOF
)"
```

---

### Task 2: Portrait UI — `required` + `error`

**Files:**
- Modify: `tanstack-app/src/components/temple/TemplePortraitField.tsx`
- Modify: `tanstack-app/src/components/temple/TemplePortraitField.test.tsx`
- Modify: `tanstack-app/src/components/temple/TempleFormFields.tsx`

**Interfaces:**
- Consumes: `m.filler_field_anh_tinh_xa()`, `m.filler_error_field_required()`, `TempleRequiredFieldErrors.photo`
- Produces:
  - `TemplePortraitFieldProps.required?: boolean` (default `false`)
  - `TemplePortraitFieldProps.error?: string`
  - `TempleFormFields` always passes `required` and `error={mapRequiredError(fieldErrors.photo)}`

- [ ] **Step 1: Write failing portrait field test**

In `TemplePortraitField.test.tsx`, add (imports already have `m` / render helpers — follow existing `renderField`):

```ts
  it('shows required label and validation error', () => {
    renderField({
      required: true,
      error: m.filler_error_field_required(),
    })
    expect(screen.getByText(m.filler_field_anh_tinh_xa())).toBeTruthy()
    expect(screen.getByText(m.filler_error_field_required())).toBeTruthy()
  })
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/components/temple/TemplePortraitField.test.tsx
```

Expected: FAIL — `required` / `error` not accepted or error text not rendered.

- [ ] **Step 3: Implement portrait props (mirror member)**

In `TemplePortraitField.tsx`:

1. Import `Input` from `@mantine/core` (keep existing imports).
2. Add props:

```ts
  required?: boolean
  error?: string
```

Default `required = false`.

3. Replace label `<Text size="sm" fw={500}>…</Text>` with:

```tsx
<Input.Label required={required}>
  {m.filler_field_anh_tinh_xa()}
</Input.Label>
```

4. Before `typeError` block, render validation error:

```tsx
{error ? (
  <Text size="sm" c="red">
    {error}
  </Text>
) : null}
```

- [ ] **Step 4: Wire `TempleFormFields`**

In `TempleFormFields.tsx`, update the `TemplePortraitField` usage:

```tsx
<TemplePortraitField
  templeId={templeId}
  inviteToken={inviteToken}
  getIdToken={getIdToken}
  photoPath={photoPath}
  photoUpdatedAt={initial.updatedAt ?? null}
  disabled={disabled}
  pendingFile={pendingPhoto}
  onPendingFileChange={setPendingPhoto}
  onPhotoPathChange={setPhotoPath}
  onUploadError={onUploadError}
  required
  error={mapRequiredError(fieldErrors.photo)}
/>
```

`mapRequiredError` already maps `'REQUIRED'` → `m.filler_error_field_required()`.

- [ ] **Step 5: Run portrait + typecheck slice**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/components/temple/TemplePortraitField.test.tsx
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add tanstack-app/src/components/temple/TemplePortraitField.tsx \
  tanstack-app/src/components/temple/TemplePortraitField.test.tsx \
  tanstack-app/src/components/temple/TempleFormFields.tsx
git commit -m "$(cat <<'EOF'
feat(temple): show required affordance and error on temple portrait

EOF
)"
```

---

### Task 3: Wire call sites + form tests

**Files:**
- Modify: `tanstack-app/src/components/filler/TempleEditorForm.tsx`
- Modify: `tanstack-app/src/components/admin/TempleFormPage.tsx`
- Modify: `tanstack-app/src/components/filler/TempleEditorForm.test.tsx`
- Modify: `tanstack-app/src/components/admin/TempleFormPage.test.tsx` (if needed)

**Interfaces:**
- Consumes: `api.getPhotoPath()`, `api.getPendingPhoto()`, `validateTempleRequiredFields({ …, hasPhoto })`
- Produces: save/complete blocked when neither photoPath nor pending file exists

- [ ] **Step 1: Write failing filler form test**

In `TempleEditorForm.test.tsx`:

1. Update `requiredTempleInitial` to include a seed photo so existing happy-path saves still pass:

```ts
    photoPath: 'temples/seed/photo.jpg',
```

(Place inside the returned object before `...overrides`.)

2. Add a test that blocks save when other fields are filled but photo is missing:

```ts
  it('blocks save when temple photo is missing', async () => {
    const user = userEvent.setup()
    renderForm({
      initial: requiredTempleInitial({ photoPath: null }),
    })
    await user.click(screen.getByRole('button', { name: m.filler_save() }))

    expect(saveAndLockTempleMock).not.toHaveBeenCalled()
    expect(screen.getByText(m.filler_error_field_required())).toBeTruthy()
  })
```

Note: with `photoPath: null` and no file chosen, `hasPhoto` must be false. Other fields from `requiredTempleInitial` remain filled — only photo should fail (or at least one `filler_error_field_required` appears and save is not called). Confirm modal must **not** open.

- [ ] **Step 2: Run filler form test to verify fail**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/components/filler/TempleEditorForm.test.tsx
```

Expected: FAIL on the new test (save still proceeds / confirm opens) and/or TypeScript errors at call sites missing `hasPhoto`. Existing tests may also fail until `photoPath` seed is added — add the seed in Step 1 before running if needed so only the new behavior fails intentionally.

- [ ] **Step 3: Wire filler + admin validators**

In `TempleEditorForm.tsx` `handleSave`, extend the validate call:

```ts
    const result = validateTempleRequiredFields({
      danhHieu: draft.danhHieu,
      nguoiKhaiSon: draft.nguoiKhaiSon,
      namThanhLap: draft.namThanhLap,
      diaChiCu: draft.diaChiCu,
      diaChiMoi: draft.diaChiMoi,
      truTriHienNay: draft.truTriHienNay,
      truTriTienNhiem: draft.truTriTienNhiem,
      tangSoHienTru: draft.tangSoHienTru,
      soPhatTuQuyY: draft.soPhatTuQuyY,
      soPhatTuThuongXuyen: draft.soPhatTuThuongXuyen,
      hasPhoto: !!(api.getPhotoPath() || api.getPendingPhoto()),
    })
```

In `TempleFormPage.tsx` `complete`, same `hasPhoto` line on the existing `validateTempleRequiredFields({ … })` call.

Do **not** add `hasPhoto` to admin draft-save path (Lưu nháp).

- [ ] **Step 4: Admin test assert (optional but preferred)**

In `TempleFormPage.test.tsx`, either:

- Rely on create-mode “required fields missing” already asserting errors, **or**
- Add:

```ts
  it('Hoàn thành blocks when photo missing on otherwise complete draft', async () => {
    const user = userEvent.setup()
    templeFixture = { ...completeDraftTemple(), photoPath: null }
    renderForm({ mode: 'edit' })
    await screen.findByRole('button', { name: m.admin_temples_complete() })
    await user.click(
      screen.getByRole('button', { name: m.admin_temples_complete() }),
    )
    expect(saveAdminTempleMock).not.toHaveBeenCalled()
    expect(screen.getByText(m.filler_error_field_required())).toBeTruthy()
  })
```

(`completeDraftTemple()` already sets `photoPath` for the happy-path complete test — keep that.)

- [ ] **Step 5: Run form tests**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run \
  src/components/filler/TempleEditorForm.test.tsx \
  src/components/admin/TempleFormPage.test.tsx \
  src/components/filler/templeRequiredValidation.test.ts \
  src/components/temple/TemplePortraitField.test.tsx
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add tanstack-app/src/components/filler/TempleEditorForm.tsx \
  tanstack-app/src/components/admin/TempleFormPage.tsx \
  tanstack-app/src/components/filler/TempleEditorForm.test.tsx \
  tanstack-app/src/components/admin/TempleFormPage.test.tsx
git commit -m "$(cat <<'EOF'
feat(temple): require portrait on filler save and admin complete

EOF
)"
```

---

### Task 4: Verification

**Files:** none new

- [ ] **Step 1: Run focused suite again**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run \
  src/components/filler/templeRequiredValidation.test.ts \
  src/components/temple/TemplePortraitField.test.tsx \
  src/components/filler/TempleEditorForm.test.tsx \
  src/components/admin/TempleFormPage.test.tsx
```

Expected: all PASS

- [ ] **Step 2: Manual smoke (optional if `pnpm dev` running)**

1. Open filler or admin temple form without photo → **Lưu** / **Hoàn thành** shows required error on Ảnh tịnh xá.
2. Choose a JPEG/PNG → save proceeds (confirm modal / save mutation).
3. Admin **Lưu nháp** still works without photo.

- [ ] **Step 3: No further commit unless verification fixed something**

---

## Spec coverage checklist

| Spec item | Task |
| --- | --- |
| Extend `validateTempleRequiredFields` with `hasPhoto` / `photo?: 'REQUIRED'` | Task 1 |
| Filler + admin pass `hasPhoto` from path \|\| pending | Task 3 |
| Portrait `required` + field error | Task 2 |
| Pending file OR photoPath satisfies | Task 1 + 3 |
| Client-only; no Firestore | Global Constraints |
| Vitest; no Cypress | Tasks 1–4 |
| Admin Lưu nháp skips validation | Task 3 (unchanged path) |
