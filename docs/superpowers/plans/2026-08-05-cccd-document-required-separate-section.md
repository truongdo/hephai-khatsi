# CCCD Document Required Separate Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface Căn cước công dân as a dedicated always-visible block in Giấy tờ đính kèm and require both front and back on validated save (admin + filler).

**Architecture:** Keep CCCD inside `MemberDocumentsField` as a fixed block (not in the Select / “Đã đính kèm” list). Extend shared `validateMemberRequiredFields` with `documents` + `pendingDocuments`; wire errors through `MemberFormFields` into the CCCD block. Storage/API unchanged.

**Tech Stack:** React 19, Mantine 9, Paraglide (`pnpm paraglide` if new keys), Vitest + Testing Library, existing upload/delete document use-cases

**Spec:** `docs/superpowers/specs/2026-08-05-cccd-document-required-separate-section-design.md`

## Global Constraints

- Work in the current workspace only — **never** `git worktree add`
- Create and use a feature branch from `main` (e.g. `feat/cccd-document-required-section`); if already on another branch with WIP, stop and ask
- Require **both** CCCD sides (`front` + `back`) via uploaded path **or** pending `File`
- Surfaces: filler **Lưu** and admin **Hoàn thành** only (shared validator)
- No **Xóa** for CCCD; per-side **Thay thế** / **Chọn tệp** only
- Exclude `cccd` from Select and from “Đã đính kèm”
- Do **not** change Firestore schema, R2 keys, or worker docs API
- Prefer Vitest; **no new Cypress**
- After merge squash into `main`, delete the local feature branch unless asked otherwise

## File Structure

| File | Responsibility |
| --- | --- |
| `docs/superpowers/specs/2026-08-05-cccd-document-required-separate-section-design.md` | Spec (already on `main`) |
| `docs/superpowers/plans/2026-08-05-cccd-document-required-separate-section.md` | This plan |
| `tanstack-app/src/components/filler/memberRequiredValidation.ts` | Require both CCCD sides |
| `tanstack-app/src/components/filler/memberRequiredValidation.test.ts` | Validation unit tests |
| `tanstack-app/src/components/filler/MemberDocumentsField.tsx` | Dedicated CCCD UI + `error` prop |
| `tanstack-app/src/components/filler/MemberDocumentsField.test.tsx` | UI unit tests |
| `tanstack-app/src/components/filler/MemberFormFields.tsx` | Pass docs into field + map error |
| `tanstack-app/src/components/filler/MemberEditorForm.tsx` | Pass docs into validator on Lưu |
| `tanstack-app/src/components/admin/MemberFormPage.tsx` | Pass docs into validator on Hoàn thành |
| `tanstack-app/src/components/filler/MemberEditorForm.test.tsx` | Seed CCCD; fix file-input helper |
| `tanstack-app/src/components/admin/MemberFormPage.test.tsx` | Seed CCCD; fix file-input helper |

No new message keys required: reuse `m.filler_doc_type_cccd()`, `m.filler_error_field_required()`, and existing `filler_doc_*` strings. Use Mantine `Input.Label required` for the CCCD heading (same pattern as portrait).

---

### Task 0: Branch from main + commit plan

**Files:**
- Add: `docs/superpowers/plans/2026-08-05-cccd-document-required-separate-section.md`

**Interfaces:**
- Consumes: `main` including spec commit `docs: design dedicated required CCCD document section`
- Produces: branch `feat/cccd-document-required-section` with this plan committed

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
git checkout -b feat/cccd-document-required-section
```

- [ ] **Step 3: Commit plan only**

```bash
git add docs/superpowers/plans/2026-08-05-cccd-document-required-separate-section.md
git commit -m "$(cat <<'EOF'
docs: plan dedicated required CCCD document section

EOF
)"
```

---

### Task 1: Require CCCD front+back in `validateMemberRequiredFields`

**Files:**
- Modify: `tanstack-app/src/components/filler/memberRequiredValidation.ts`
- Modify: `tanstack-app/src/components/filler/memberRequiredValidation.test.ts`

**Interfaces:**
- Consumes: `MemberDocuments` from `#/domain/memberDocumentTypes`; `PendingDocumentFiles` from `#/components/filler/MemberDocumentsField`
- Produces:

```ts
export type MemberRequiredDraft = {
  // …existing fields…
  documents: MemberDocuments
  pendingDocuments: PendingDocumentFiles
}

export type MemberRequiredFieldErrors = {
  // …existing fields…
  cccdDocument?: 'REQUIRED'
}

export function validateMemberRequiredFields(draft: MemberRequiredDraft): {
  valid: boolean
  errors: MemberRequiredFieldErrors
}
```

Rule: set `errors.cccdDocument = 'REQUIRED'` unless both sides are present:

- front: `draft.documents.cccd?.frontPath` **or** `draft.pendingDocuments.cccd?.front`
- back: `draft.documents.cccd?.backPath` **or** `draft.pendingDocuments.cccd?.back`

- [ ] **Step 1: Write failing tests**

Update `filledDraft` defaults to include empty docs (so existing “accepts fully filled” fails until implementation + seeds):

```ts
import type { PendingDocumentFiles } from './MemberDocumentsField'

const completeCccdDocuments = {
  cccd: {
    frontPath: 'members/m1/docs/cccd/front.jpg',
    backPath: 'members/m1/docs/cccd/back.jpg',
  },
}

function filledDraft(
  overrides: Partial<MemberRequiredDraft> = {},
): MemberRequiredDraft {
  return {
    // …existing fields unchanged…
    photoPath: 'members/m1/photo.jpg',
    pendingPhoto: null,
    giaDinh: { cha: filledFamilyPerson, me: filledFamilyPerson },
    documents: completeCccdDocuments,
    pendingDocuments: {},
    ...overrides,
  }
}
```

Also add `documents: {}` and `pendingDocuments: {}` to the blank-draft object in `fails all text/date/address when blank`.

Append:

```ts
it('requires both CCCD document sides', () => {
  const result = validateMemberRequiredFields(
    filledDraft({ documents: {}, pendingDocuments: {} }),
  )
  expect(result.valid).toBe(false)
  expect(result.errors.cccdDocument).toBe('REQUIRED')
})

it('requires CCCD back when only front path exists', () => {
  const result = validateMemberRequiredFields(
    filledDraft({
      documents: {
        cccd: { frontPath: 'members/m1/docs/cccd/front.jpg' },
      },
    }),
  )
  expect(result.valid).toBe(false)
  expect(result.errors.cccdDocument).toBe('REQUIRED')
})

it('accepts pending CCCD front and back without paths', () => {
  const front = new File(['a'], 'front.jpg', { type: 'image/jpeg' })
  const back = new File(['b'], 'back.jpg', { type: 'image/jpeg' })
  expect(
    validateMemberRequiredFields(
      filledDraft({
        documents: {},
        pendingDocuments: { cccd: { front, back } },
      }),
    ),
  ).toEqual({ valid: true, errors: {} })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/components/filler/memberRequiredValidation.test.ts
```

Expected: FAIL — `documents` / `cccdDocument` not in types/validator yet, or missing-required cases not flagged.

- [ ] **Step 3: Minimal implementation**

In `memberRequiredValidation.ts`:

```ts
import type { MemberDocuments } from '#/domain/memberDocumentTypes'
import type { PendingDocumentFiles } from './MemberDocumentsField'

// Add to MemberRequiredDraft:
documents: MemberDocuments
pendingDocuments: PendingDocumentFiles

// Add to MemberRequiredFieldErrors:
cccdDocument?: 'REQUIRED'

// Inside validateMemberRequiredFields, after photo check:
const cccdFiles = draft.documents.cccd
const cccdPending = draft.pendingDocuments.cccd
const hasCccdFront = Boolean(cccdFiles?.frontPath || cccdPending?.front)
const hasCccdBack = Boolean(cccdFiles?.backPath || cccdPending?.back)
if (!hasCccdFront || !hasCccdBack) errors.cccdDocument = 'REQUIRED'
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/components/filler/memberRequiredValidation.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/src/components/filler/memberRequiredValidation.ts \
  tanstack-app/src/components/filler/memberRequiredValidation.test.ts
git commit -m "$(cat <<'EOF'
feat(member): require CCCD front and back documents on save

EOF
)"
```

---

### Task 2: Dedicated CCCD block in `MemberDocumentsField`

**Files:**
- Modify: `tanstack-app/src/components/filler/MemberDocumentsField.tsx`
- Modify: `tanstack-app/src/components/filler/MemberDocumentsField.test.tsx`

**Interfaces:**
- Consumes: existing props + handlers
- Produces:

```ts
export type MemberDocumentsFieldProps = {
  // …existing…
  error?: string
}
```

UI rules:

1. Always render a CCCD `Paper` (or bordered stack) **above** the Select, with `Input.Label required` = `documentTypeLabel('cccd')`.
2. Always show front/back side rows (same missing / link / replace behavior as today’s card rows).
3. **Never** show **Xóa** on the CCCD block.
4. Select `availableOptions`: filter `type.id !== 'cccd'` **and** `!isTypeAttached(...)`.
5. `attachedTypeIds`: exclude `'cccd'` so CCCD never appears under “Đã đính kèm”.
6. When `error` is set, show `<Text size="sm" c="red">{error}</Text>` under the CCCD block.
7. When `disabled`: hide choose/replace; omit empty-side rows (same as attached cards today).

- [ ] **Step 1: Rewrite failing / outdated tests**

Replace tests that `pickDocType(user, 'cccd')` with always-visible CCCD assertions. Key cases:

```ts
it('always shows CCCD block without selecting a type', () => {
  renderField()
  expect(screen.getByText(documentTypeLabel('cccd'))).toBeTruthy()
  expect(screen.getByText(m.filler_doc_side_front())).toBeTruthy()
  expect(screen.getByText(m.filler_doc_side_back())).toBeTruthy()
  expect(
    screen.getAllByRole('button', { name: m.filler_doc_choose_file() }),
  ).toHaveLength(2)
})

it('excludes cccd from the select even when not attached', async () => {
  const user = userEvent.setup()
  renderField()
  await openDocTypeSelect(user)
  const select = screen.getByRole('combobox', {
    name: m.filler_doc_select_label(),
  })
  const listbox = document.getElementById(select.getAttribute('aria-controls')!)
  expect(listbox?.textContent).not.toContain(documentTypeLabel('cccd'))
  expect(listbox?.textContent).toContain(documentTypeLabel('diep_sa_di'))
})

it('does not show remove for CCCD and keeps CCCD out of attached list', () => {
  renderField({
    documents: {
      cccd: { frontPath: 'members/m1/docs/cccd/front.jpg' },
    },
  })
  expect(screen.queryByText(m.filler_doc_attached_heading())).toBeNull()
  expect(
    screen.queryByRole('button', { name: m.filler_doc_remove() }),
  ).toBeNull()
  expect(screen.getByText(m.filler_doc_missing())).toBeTruthy()
  expect(
    screen.getByRole('button', { name: m.filler_doc_replace() }),
  ).toBeTruthy()
})

it('shows required error under CCCD block', () => {
  renderField({ error: m.filler_error_field_required() })
  expect(screen.getByText(m.filler_error_field_required())).toBeTruthy()
})

it('with memberId: uploads CCCD front from dedicated block', async () => {
  uploadMemberDocumentMock.mockResolvedValue({
    filePath: 'members/m1/docs/cccd/front.jpg',
    documents: {
      cccd: { frontPath: 'members/m1/docs/cccd/front.jpg' },
    },
  })
  const user = userEvent.setup()
  const { onDocumentsChange } = renderField({ memberId: 'm1' })
  const file = new File(['jpeg'], 'front.jpg', { type: 'image/jpeg' })
  const [frontInput] = getFileInputs()
  await user.upload(frontInput, file)
  expect(uploadMemberDocumentMock).toHaveBeenCalledWith(
    expect.objectContaining({ typeId: 'cccd', side: 'front' }),
  )
  expect(onDocumentsChange).toHaveBeenCalledWith({
    cccd: { frontPath: 'members/m1/docs/cccd/front.jpg' },
  })
})
```

Keep optional-type tests (`diep_sa_di` pending / invalid type) working. For “attached cards” coverage, use a non-CCCD type (e.g. `diep_sa_di`) instead of CCCD.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/components/filler/MemberDocumentsField.test.tsx
```

Expected: FAIL on always-visible CCCD / no-remove / exclude-from-select.

- [ ] **Step 3: Implement UI**

Sketch (adapt to existing helpers `renderUploadSlot`, `pathForSide`, `sidesForType`):

```tsx
import { Input } from '@mantine/core'

// props: add error?: string

const OPTIONAL_DOCUMENT_TYPES = MEMBER_DOCUMENT_TYPES.filter(
  (type) => type.id !== 'cccd',
)

// availableOptions from OPTIONAL_DOCUMENT_TYPES + !isTypeAttached
// attachedTypeIds from OPTIONAL_DOCUMENT_TYPES + isTypeAttached

return (
  <Stack gap="md" align="stretch">
    <Paper withBorder p="sm" radius="md">
      <Input.Label required>{documentTypeLabel('cccd')}</Input.Label>
      {/* front/back rows; no remove button */}
      {error ? (
        <Text size="sm" c="red" mt="xs">
          {error}
        </Text>
      ) : null}
    </Paper>

    {/* existing Select + selected-type slots for optional types */}
    {/* existing “Đã đính kèm” for attachedTypeIds only */}
  </Stack>
)
```

Reuse `handleFileSelected('cccd', side, file)` — do **not** pass `clearSelect` for the dedicated block.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/components/filler/MemberDocumentsField.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/src/components/filler/MemberDocumentsField.tsx \
  tanstack-app/src/components/filler/MemberDocumentsField.test.tsx
git commit -m "$(cat <<'EOF'
feat(member): show CCCD documents as dedicated required block

EOF
)"
```

---

### Task 3: Wire validator + error through forms

**Files:**
- Modify: `tanstack-app/src/components/filler/MemberFormFields.tsx`
- Modify: `tanstack-app/src/components/filler/MemberEditorForm.tsx`
- Modify: `tanstack-app/src/components/admin/MemberFormPage.tsx`
- Modify: `tanstack-app/src/components/filler/MemberEditorForm.test.tsx`
- Modify: `tanstack-app/src/components/admin/MemberFormPage.test.tsx`

**Interfaces:**
- Consumes: `MemberRequiredFieldErrors.cccdDocument`, `api.getDocuments()`, `api.getPendingDocuments()`
- Produces: `MemberDocumentsField` receives `error={mapRequiredError(fieldErrors.cccdDocument)}`; save/complete pass documents into validator

- [ ] **Step 1: Update form fixtures / helpers (failing save paths first)**

In both `MemberEditorForm.test.tsx` and `MemberFormPage.test.tsx`:

1. Add CCCD to complete seeds:

```ts
documents: {
  cccd: {
    frontPath: 'members/m1/docs/cccd/front.jpg',
    backPath: 'members/m1/docs/cccd/back.jpg',
  },
},
```

Apply to `requiredCoreInitial` (filler) and `completeDraftMember()` (admin).

2. Fix `getDocumentFileInput` so optional-type uploads hit the **last** non-portrait file input (CCCD now occupies the first two):

```ts
function getDocumentFileInput(): HTMLInputElement {
  const portrait = getPortraitFileInput()
  const inputs = Array.from(
    document.querySelectorAll('input[type="file"]'),
  ) as HTMLInputElement[]
  const docs = inputs.filter((input) => input !== portrait)
  return docs[docs.length - 1]!
}
```

3. Add one assertion that Hoàn thành / Lưu without CCCD shows `m.filler_error_field_required()` (create path already checks required missing for admin; extend or add a focused case if needed). Filler: save with `requiredCoreInitial` minus documents should not open confirm — prefer a small unit-level form test **or** rely on validator unit tests + ensure seeds keep saves green.

- [ ] **Step 2: Run form tests to see TypeScript / runtime failures**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run \
  src/components/filler/MemberEditorForm.test.tsx \
  src/components/admin/MemberFormPage.test.tsx
```

Expected: FAIL / TS errors until call sites pass `documents` + `pendingDocuments`.

- [ ] **Step 3: Wire call sites**

`MemberEditorForm.handleSave` and `MemberFormPage.complete`:

```ts
const result = validateMemberRequiredFields({
  // …existing fields…
  photoPath: api.getPhotoPath(),
  pendingPhoto: api.getPendingPhoto(),
  giaDinh: { cha: draft.giaDinh.cha, me: draft.giaDinh.me },
  documents: api.getDocuments(),
  pendingDocuments: api.getPendingDocuments(),
})
```

`MemberFormFields` documents section:

```tsx
<MemberDocumentsField
  memberId={memberId}
  cccd={cccd}
  inviteToken={inviteToken}
  getIdToken={getIdToken}
  documents={documents}
  onDocumentsChange={setDocuments}
  pendingFiles={pendingDocuments}
  onPendingFilesChange={setPendingDocuments}
  disabled={disabled}
  onUploadError={onUploadError}
  error={mapRequiredError(fieldErrors.cccdDocument)}
/>
```

Include `fieldErrors.cccdDocument` in the memo deps for the documents section if that block is memoized.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run \
  src/components/filler/memberRequiredValidation.test.ts \
  src/components/filler/MemberDocumentsField.test.tsx \
  src/components/filler/MemberEditorForm.test.tsx \
  src/components/admin/MemberFormPage.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add \
  tanstack-app/src/components/filler/MemberFormFields.tsx \
  tanstack-app/src/components/filler/MemberEditorForm.tsx \
  tanstack-app/src/components/admin/MemberFormPage.tsx \
  tanstack-app/src/components/filler/MemberEditorForm.test.tsx \
  tanstack-app/src/components/admin/MemberFormPage.test.tsx
git commit -m "$(cat <<'EOF'
feat(member): wire required CCCD documents into admin and filler save

EOF
)"
```

---

## Spec coverage check

| Spec requirement | Task |
| --- | --- |
| Dedicated always-visible CCCD block | Task 2 |
| Both front + back required | Task 1 |
| Admin + filler surfaces | Task 3 |
| No Xóa for CCCD; replace only | Task 2 |
| CCCD excluded from Select / Đã đính kèm | Task 2 |
| Error under CCCD block | Task 2 + Task 3 |
| No storage/API changes | All (no backend files) |
| Vitest only | All |

## Placeholder / consistency check

- Error key: `cccdDocument?: 'REQUIRED'` used consistently in validator, field props mapping, and tests
- `PendingDocumentFiles` imported from `MemberDocumentsField` into validation (existing export)
- Form file-input helper updated for always-visible CCCD slots
