# Member Portrait + Remove Family Phones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional 3×4 portrait upload on filler member editor (pending file → upload after create), and remove Điện thoại from Cha/Mẹ.

**Architecture:** New `MemberPortraitField` holds preview + pending `File`; calls existing `uploadMemberPhoto` when `memberId` exists. Parent creates draft first, then uploads pending file before `onCreated`. Family draft/UI drop `dienThoai` for cha/me only.

**Tech Stack:** React 19, Mantine 9 (`FileButton`, `Image`, `Box`), Firebase Storage `getDownloadURL`, existing `uploadMemberPhoto`, Vitest + Testing Library

**Spec:** `docs/superpowers/specs/2026-07-23-member-portrait-and-family-phone-design.md`

## Global Constraints

- Work in current workspace only — **never** `git worktree add`
- Continue on branch `feat/member-noi-sinh-xuat-gia-address`
- Photo is **optional**; do not block text save for missing photo
- Reuse `uploadMemberPhoto`; do not invent a second upload path
- Accept `image/jpeg` / `image/png` only
- Prefer Vitest; **no new Cypress**
- After merge squash into `main`, delete local feature branch unless asked otherwise

## File Structure

| File | Responsibility |
| --- | --- |
| `tanstack-app/messages/vi.json` | Portrait labels/errors |
| `tanstack-app/src/components/filler/memberPhotoUrl.ts` | `photoPath` → download URL |
| `tanstack-app/src/components/filler/MemberPortraitField.tsx` | UI + pending file + upload-when-id |
| `tanstack-app/src/components/filler/MemberPortraitField.test.tsx` | Component tests |
| `tanstack-app/src/components/filler/MemberEditorForm.tsx` | Wire portrait + create upload; remove family phones |
| `tanstack-app/src/components/filler/MemberEditorForm.test.tsx` | Integration tests |

---

### Task 0: Commit design spec

**Files:**
- Add: `docs/superpowers/specs/2026-07-23-member-portrait-and-family-phone-design.md`
- Add: `docs/superpowers/plans/2026-07-23-member-portrait-and-family-phone.md`

- [ ] **Step 1: Confirm branch**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git branch --show-current
# expect: feat/member-noi-sinh-xuat-gia-address
```

- [ ] **Step 2: Commit docs**

```bash
git add docs/superpowers/specs/2026-07-23-member-portrait-and-family-phone-design.md \
  docs/superpowers/plans/2026-07-23-member-portrait-and-family-phone.md
git commit -m "$(cat <<'EOF'
docs: spec and plan for member portrait and family phone removal

EOF
)"
```

---

### Task 1: i18n + photo URL helper

**Files:**
- Modify: `tanstack-app/messages/vi.json`
- Create: `tanstack-app/src/components/filler/memberPhotoUrl.ts`
- Create: `tanstack-app/src/components/filler/memberPhotoUrl.test.ts`

**Interfaces:**
- Produces: `getMemberPhotoDownloadUrl(photoPath: string): Promise<string>`
- Produces messages: `filler_field_anh_chan_dung`, `filler_photo_choose`, `filler_photo_change`, `filler_photo_invalid_type`, `filler_photo_upload_error`

- [ ] **Step 1: Add messages**

```json
  "filler_field_anh_chan_dung": "Ảnh chân dung",
  "filler_photo_choose": "Chọn ảnh",
  "filler_photo_change": "Đổi ảnh",
  "filler_photo_invalid_type": "Chỉ nhận ảnh JPEG hoặc PNG",
  "filler_photo_upload_error": "Không tải được ảnh. Hồ sơ đã lưu; thử chọn ảnh lại."
```

- [ ] **Step 2: `pnpm paraglide`** (from `tanstack-app`)

- [ ] **Step 3: Write failing URL helper test**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('firebase/storage', () => ({
  ref: vi.fn((_storage, path: string) => ({ fullPath: path })),
  getDownloadURL: vi.fn(async () => 'https://example.com/photo.jpg'),
}))

vi.mock('#/firebase/storage', () => ({
  getClientStorage: vi.fn(() => ({ app: {} })),
}))

import { getDownloadURL } from 'firebase/storage'
import { getMemberPhotoDownloadUrl } from './memberPhotoUrl'

describe('getMemberPhotoDownloadUrl', () => {
  beforeEach(() => {
    vi.mocked(getDownloadURL).mockClear()
  })

  it('returns download URL for a storage path', async () => {
    await expect(
      getMemberPhotoDownloadUrl('members/m1/photo.jpg'),
    ).resolves.toBe('https://example.com/photo.jpg')
    expect(getDownloadURL).toHaveBeenCalled()
  })

  it('throws when storage is not configured', async () => {
    const { getClientStorage } = await import('#/firebase/storage')
    vi.mocked(getClientStorage).mockReturnValueOnce(null)
    await expect(
      getMemberPhotoDownloadUrl('members/m1/photo.jpg'),
    ).rejects.toThrow(/Storage/)
  })
})
```

- [ ] **Step 4: Run test — expect FAIL**

```bash
cd tanstack-app && pnpm vitest run src/components/filler/memberPhotoUrl.test.ts
```

- [ ] **Step 5: Implement helper**

```ts
import { getDownloadURL, ref } from 'firebase/storage'
import { getClientStorage } from '#/firebase/storage'

export async function getMemberPhotoDownloadUrl(
  photoPath: string,
): Promise<string> {
  const storage = getClientStorage()
  if (!storage) throw new Error('Storage is not configured')
  return getDownloadURL(ref(storage, photoPath))
}
```

- [ ] **Step 6: Run tests — expect PASS; commit**

```bash
git add tanstack-app/messages/vi.json \
  tanstack-app/src/components/filler/memberPhotoUrl.ts \
  tanstack-app/src/components/filler/memberPhotoUrl.test.ts
git commit -m "$(cat <<'EOF'
feat: add member photo download URL helper and i18n

EOF
)"
```

---

### Task 2: MemberPortraitField component

**Files:**
- Create: `tanstack-app/src/components/filler/MemberPortraitField.tsx`
- Create: `tanstack-app/src/components/filler/MemberPortraitField.test.tsx`

**Interfaces:**

```ts
export type MemberPortraitFieldProps = {
  memberId?: string
  cccd: string
  inviteToken: string
  photoPath: string | null
  disabled?: boolean
  pendingFile: File | null
  onPendingFileChange: (file: File | null) => void
  onPhotoPathChange: (photoPath: string) => void
  onUploadError?: (message: string) => void
}
```

- [ ] **Step 1: Write failing tests** (mock `uploadMemberPhoto` and `getMemberPhotoDownloadUrl`)

```ts
vi.mock('#/use-cases/uploadMemberPhoto', () => ({
  uploadMemberPhoto: vi.fn(),
}))
vi.mock('./memberPhotoUrl', () => ({
  getMemberPhotoDownloadUrl: vi.fn(async () => 'https://cdn.example/p.jpg'),
}))

// - without memberId: selecting a jpeg file calls onPendingFileChange with the File
// - with memberId: selecting a file calls uploadMemberPhoto and onPhotoPathChange
// - rejecting .gif shows filler_photo_invalid_type
```

Use `MantineProvider` + `userEvent.upload` / hidden file input from `FileButton`.

- [ ] **Step 2: Run — expect FAIL**

```bash
cd tanstack-app && pnpm vitest run src/components/filler/MemberPortraitField.test.tsx
```

- [ ] **Step 3: Implement component**

Behavior:
- Aspect ratio box ~3/4 (`aspectRatio: '3 / 4'`, max width ~120–140px).
- Preview: `URL.createObjectURL(pendingFile)` or download URL from `photoPath` (effect; revoke object URLs on cleanup).
- `FileButton` accept `image/jpeg,image/png`; validate `file.type`.
- If `memberId` and `cccd`: `file.arrayBuffer()` → `Uint8Array` → `uploadMemberPhoto(...)`.
- Else: `onPendingFileChange(file)`.
- Disabled / view: hide FileButton.

- [ ] **Step 4: Run — expect PASS; commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add MemberPortraitField for optional 3x4 photo

EOF
)"
```

---

### Task 3: Wire portrait into MemberEditorForm + create upload

**Files:**
- Modify: `tanstack-app/src/components/filler/MemberEditorForm.tsx`
- Modify: `tanstack-app/src/components/filler/MemberEditorForm.test.tsx`

**Interfaces:**
- Consumes: `MemberPortraitField`, `uploadMemberPhoto`
- Produces: create path uploads pending file before `onCreated`

- [ ] **Step 1: Failing form test**

```ts
vi.mock('#/use-cases/uploadMemberPhoto', () => ({
  uploadMemberPhoto: vi.fn(async () => ({
    photoPath: 'members/created-member/photo.jpg',
  })),
}))

it('uploads pending portrait after successful create', async () => {
  // seed required fields as existing happy-path
  // set pending file via portrait input OR expose by selecting file before save
  // click Lưu
  // expect uploadMemberPhoto called with created member id
  // expect onCreated called after upload
})
```

Also keep existing create test (no pending file) still calling `onCreated`.

- [ ] **Step 2: Wire form**

State:
```ts
const [photoPath, setPhotoPath] = useState<string | null>(
  initial.photoPath ?? null,
)
const [pendingPhoto, setPendingPhoto] = useState<File | null>(null)
```

Render `MemberPortraitField` above identity section (or at top of stack).

In `saveMutation.onSuccess` when `result.mode === 'created'`:
```ts
if (pendingPhoto) {
  try {
    const bytes = new Uint8Array(await pendingPhoto.arrayBuffer())
    await uploadMemberPhoto({
      memberId: result.member.id,
      cccd: resolvedCccd,
      bytes,
      contentType: pendingPhoto.type,
      inviteToken: token,
    })
    setPendingPhoto(null)
  } catch {
    setSaveError(m.filler_photo_upload_error())
  }
}
onCreated(result.member.id)
```

Note: `onSuccess` may need to be `async` and the mutation should await it (TanStack Query supports async onSuccess). Prefer handling upload in the `onSave` path after `mutateAsync` if clearer:

```ts
const result = await saveMutation.mutateAsync()
if (result.mode === 'created' && pendingPhoto) { ... upload ... }
if (result.mode === 'created') onCreated(result.member.id)
```

Refactor save button to `mutateAsync` + try/catch so create+upload ordering is explicit. Keep existing error/success toasts.

- [ ] **Step 3: Run MemberEditorForm tests — PASS; commit**

```bash
git commit -m "$(cat <<'EOF'
feat: wire optional portrait upload into member editor

EOF
)"
```

---

### Task 4: Remove Cha/Mẹ phone fields

**Files:**
- Modify: `tanstack-app/src/components/filler/MemberEditorForm.tsx`
- Modify: `tanstack-app/src/components/filler/MemberEditorForm.test.tsx` (if needed)

- [ ] **Step 1: Failing test**

```ts
it('does not show phone fields for father or mother', () => {
  renderForm({ cccd: '012345678901', memberId: 'm1' })
  const cha = screen.getByRole('group', { name: m.filler_field_cha() })
    // or getByText legend — Fieldset legend
  // assert within cha/me: no label matching filler_field_dien_thoai
  // member contact phone still present
})
```

Mantine `Fieldset` may expose legend as group name — adjust query to match DOM.

- [ ] **Step 2: Remove from draft/UI/build**

- Drop `dienThoai` from `FamilyPersonDraft`, `emptyFamilyPerson`, `buildFamilyPerson` (omit from `hasText` check and return object).
- Delete Cha/Mẹ `TextInput` for phone.
- Leave domain `Member.giaDinh.cha.dienThoai?` untouched.

- [ ] **Step 3: Run tests — PASS; commit**

```bash
git commit -m "$(cat <<'EOF'
feat: remove phone fields from member family cha/me

EOF
)"
```

---

### Task 5: Verification

```bash
cd tanstack-app && pnpm vitest run \
  src/components/filler/memberPhotoUrl.test.ts \
  src/components/filler/MemberPortraitField.test.tsx \
  src/components/filler/MemberEditorForm.test.tsx
```

Expected: all PASS.

---

## Spec coverage

| Spec item | Task |
| --- | --- |
| Optional portrait UI 3×4 | Task 2–3 |
| Pending file → upload after create | Task 3 |
| Immediate upload when memberId | Task 2 |
| getDownloadURL helper | Task 1 |
| Remove cha/me phone | Task 4 |
| Vitest / no Cypress | Tasks 1–5 |
