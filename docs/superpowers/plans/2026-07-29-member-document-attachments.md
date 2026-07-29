# Member Document Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional, config-driven giấy tờ uploads below Nguyện vọng on the shared member form (filler + admin), stored on R2 with paths on the Firestore member doc.

**Architecture:** A domain registry defines document `typeId` + `sides`. Worker endpoints mirror portraits (`/api/docs/*`) for presigned PUT and delete. Client use-cases upload then call `memberRepo.setDocumentPaths`. UI is layout B (select type → slots; “Đã đính kèm” list for replace/remove). Pending files on create flush after first save, like portraits. `documents` is **not** written via `buildMemberPatch` (same pattern as `photoPath`).

**Tech Stack:** Cloudflare Worker + R2, Firestore, TanStack Query/forms already in app, Mantine, Paraglide, Vitest

**Spec:** `docs/superpowers/specs/2026-07-29-member-document-attachments-design.md`

## Global Constraints

- Work in the current workspace only — **never** `git worktree add`
- Branch: `feat/member-document-attachments` from latest `main`
- All document types optional; JPEG/PNG/PDF; ≤1 entry per `typeId`; frontBack = two slots
- Reuse `VITE_PHOTOS_PUBLIC_BASE` / R2 `PHOTOS` bucket
- Prefer Vitest; **no new Cypress**
- Leave unrelated dirty files (`.serena/project.yml`, `firestore-debug.log`, `quy_trinh_quan_ly_khoa_tu.docx`) unstaged
- After merge squash into `main`, delete local feature branch unless asked otherwise

## File Structure

| File | Responsibility |
| --- | --- |
| `tanstack-app/src/domain/memberDocumentTypes.ts` | Registry, `DocumentTypeId`, side helpers, path key builder |
| `tanstack-app/src/domain/types.ts` | `MemberDocuments` + `documents?` on `Member` |
| `tanstack-app/messages/vi.json` | Section + type + slot labels |
| `tanstack-app/src/repositories/memberRepo.ts` | `setDocumentPaths` on `MemberStore` |
| `tanstack-app/src/test/memoryStores.ts` | Memory impl of `setDocumentPaths` |
| `tanstack-app/src/worker/presignR2Put.ts` | `memberDocumentKey(...)` |
| `tanstack-app/src/worker/docsApi.ts` | Upload-url + delete (+ prefix wipe) handlers |
| `tanstack-app/src/worker.ts` | Route `/api/docs` → `handleDocsApi` |
| `tanstack-app/src/photos/docsApiClient.ts` | Browser fetch helpers for docs API |
| `tanstack-app/src/use-cases/uploadMemberDocument.ts` | Presign + PUT + setDocumentPaths |
| `tanstack-app/src/use-cases/deleteMemberDocument.ts` | R2 delete + clear paths |
| `tanstack-app/src/use-cases/deleteMembers.ts` | Also wipe docs prefix after hard-delete |
| `tanstack-app/src/components/filler/memberDocumentUrl.ts` | Public URL join (reuse photos base) |
| `tanstack-app/src/components/filler/MemberDocumentsField.tsx` | Layout B UI |
| `tanstack-app/src/components/filler/MemberFormFields.tsx` | Section after Nguyện vọng + apiRef hooks |
| `tanstack-app/src/components/admin/MemberFormPage.tsx` | Flush pending docs after create |
| `tanstack-app/src/components/filler/MemberEditorForm.tsx` | Flush pending docs after create |

---

### Task 0: Branch + commit this plan

**Files:**
- Add: `docs/superpowers/plans/2026-07-29-member-document-attachments.md`

**Interfaces:**
- Consumes: approved design at `docs/superpowers/specs/2026-07-29-member-document-attachments-design.md`
- Produces: plan committed on `feat/member-document-attachments`

- [ ] **Step 1: Branch from main**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git checkout main
git pull
git checkout -b feat/member-document-attachments
```

If currently not on `main` with unrelated WIP, stop and ask (stash/commit vs continue). Do not use worktrees.

- [ ] **Step 2: Commit plan**

```bash
git add docs/superpowers/plans/2026-07-29-member-document-attachments.md
git commit -m "$(cat <<'EOF'
docs: plan member document attachments

EOF
)"
```

---

### Task 1: Domain registry + Member.documents type

**Files:**
- Create: `tanstack-app/src/domain/memberDocumentTypes.ts`
- Create: `tanstack-app/src/domain/memberDocumentTypes.test.ts`
- Modify: `tanstack-app/src/domain/types.ts` (add types + `documents?` on `Member`)

**Interfaces:**
- Produces:

```ts
export type DocumentTypeId =
  | 'cccd'
  | 'chung_nhan_tang_ni'
  | 'diep_sa_di'
  | 'diep_thuc_xoa'
  | 'diep_ty_kheo'
  | 'qd_tru_tri'
  | 'qd_giao_pham'
  | 'qd_chuc_vu_gh'

export type DocumentSideMode = 'frontBack' | 'single'
export type DocumentSide = 'front' | 'back' | 'file'

export type MemberDocumentTypeDef = {
  id: DocumentTypeId
  sides: DocumentSideMode
}

export type MemberDocumentFiles = {
  frontPath?: string
  backPath?: string
  filePath?: string
}

export type MemberDocuments = Partial<Record<DocumentTypeId, MemberDocumentFiles>>

export const MEMBER_DOCUMENT_TYPES: readonly MemberDocumentTypeDef[]
export function getDocumentType(id: string): MemberDocumentTypeDef | undefined
export function isValidDocumentSide(type: MemberDocumentTypeDef, side: string): side is DocumentSide
export function pathFieldForSide(side: DocumentSide): 'frontPath' | 'backPath' | 'filePath'
export function extForContentType(contentType: string): 'jpg' | 'png' | 'pdf'
export function memberDocumentObjectKey(
  memberId: string,
  typeId: DocumentTypeId,
  side: DocumentSide,
  contentType: string,
): string
export const MEMBER_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024
export const MEMBER_DOCUMENT_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const
```

- [ ] **Step 1: Write failing tests**

```ts
// tanstack-app/src/domain/memberDocumentTypes.test.ts
import { describe, expect, it } from 'vitest'
import {
  MEMBER_DOCUMENT_TYPES,
  extForContentType,
  getDocumentType,
  isValidDocumentSide,
  memberDocumentObjectKey,
  pathFieldForSide,
} from './memberDocumentTypes'

describe('memberDocumentTypes', () => {
  it('registers eight types with expected sides', () => {
    expect(MEMBER_DOCUMENT_TYPES).toHaveLength(8)
    expect(getDocumentType('cccd')?.sides).toBe('frontBack')
    expect(getDocumentType('diep_sa_di')?.sides).toBe('single')
  })

  it('validates sides against registry', () => {
    const cccd = getDocumentType('cccd')!
    expect(isValidDocumentSide(cccd, 'front')).toBe(true)
    expect(isValidDocumentSide(cccd, 'file')).toBe(false)
    const single = getDocumentType('diep_sa_di')!
    expect(isValidDocumentSide(single, 'file')).toBe(true)
    expect(isValidDocumentSide(single, 'front')).toBe(false)
  })

  it('builds R2 keys with content-type extension', () => {
    expect(extForContentType('image/jpeg')).toBe('jpg')
    expect(extForContentType('application/pdf')).toBe('pdf')
    expect(
      memberDocumentObjectKey('m1', 'cccd', 'front', 'image/png'),
    ).toBe('members/m1/docs/cccd/front.png')
    expect(pathFieldForSide('back')).toBe('backPath')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd tanstack-app && pnpm exec vitest run src/domain/memberDocumentTypes.test.ts
```

Expected: FAIL (module missing)

- [ ] **Step 3: Implement registry + types**

```ts
// tanstack-app/src/domain/memberDocumentTypes.ts
export type DocumentTypeId =
  | 'cccd'
  | 'chung_nhan_tang_ni'
  | 'diep_sa_di'
  | 'diep_thuc_xoa'
  | 'diep_ty_kheo'
  | 'qd_tru_tri'
  | 'qd_giao_pham'
  | 'qd_chuc_vu_gh'

export type DocumentSideMode = 'frontBack' | 'single'
export type DocumentSide = 'front' | 'back' | 'file'

export type MemberDocumentTypeDef = {
  id: DocumentTypeId
  sides: DocumentSideMode
}

export type MemberDocumentFiles = {
  frontPath?: string
  backPath?: string
  filePath?: string
}

export type MemberDocuments = Partial<Record<DocumentTypeId, MemberDocumentFiles>>

export const MEMBER_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024

export const MEMBER_DOCUMENT_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const

export const MEMBER_DOCUMENT_TYPES: readonly MemberDocumentTypeDef[] = [
  { id: 'cccd', sides: 'frontBack' },
  { id: 'chung_nhan_tang_ni', sides: 'frontBack' },
  { id: 'diep_sa_di', sides: 'single' },
  { id: 'diep_thuc_xoa', sides: 'single' },
  { id: 'diep_ty_kheo', sides: 'single' },
  { id: 'qd_tru_tri', sides: 'single' },
  { id: 'qd_giao_pham', sides: 'single' },
  { id: 'qd_chuc_vu_gh', sides: 'single' },
] as const

const byId = new Map(MEMBER_DOCUMENT_TYPES.map((t) => [t.id, t]))

export function getDocumentType(id: string): MemberDocumentTypeDef | undefined {
  return byId.get(id as DocumentTypeId)
}

export function isValidDocumentSide(
  type: MemberDocumentTypeDef,
  side: string,
): side is DocumentSide {
  if (type.sides === 'frontBack') return side === 'front' || side === 'back'
  return side === 'file'
}

export function pathFieldForSide(
  side: DocumentSide,
): 'frontPath' | 'backPath' | 'filePath' {
  if (side === 'front') return 'frontPath'
  if (side === 'back') return 'backPath'
  return 'filePath'
}

export function extForContentType(contentType: string): 'jpg' | 'png' | 'pdf' {
  if (contentType === 'image/jpeg' || contentType === 'image/jpg') return 'jpg'
  if (contentType === 'image/png') return 'png'
  if (contentType === 'application/pdf') return 'pdf'
  throw new Error(`Unsupported content type: ${contentType}`)
}

export function memberDocumentObjectKey(
  memberId: string,
  typeId: DocumentTypeId,
  side: DocumentSide,
  contentType: string,
): string {
  const ext = extForContentType(contentType)
  return `members/${memberId}/docs/${typeId}/${side}.${ext}`
}
```

In `types.ts`, import `MemberDocuments` (or re-export) and add `documents?: MemberDocuments` on `Member` next to `nguyenVong`.

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd tanstack-app && pnpm exec vitest run src/domain/memberDocumentTypes.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/domain/memberDocumentTypes.ts \
  tanstack-app/src/domain/memberDocumentTypes.test.ts \
  tanstack-app/src/domain/types.ts
git commit -m "$(cat <<'EOF'
feat: add member document type registry

EOF
)"
```

---

### Task 2: Paraglide messages

**Files:**
- Modify: `tanstack-app/messages/vi.json`

**Interfaces:**
- Produces message keys used by UI (run `pnpm paraglide` / `pnpm test` compiles them):

```json
"filler_section_giay_to": "Giấy tờ đính kèm",
"filler_doc_select_label": "Loại giấy tờ",
"filler_doc_select_placeholder": "Chọn loại giấy tờ",
"filler_doc_attached_heading": "Đã đính kèm",
"filler_doc_side_front": "Mặt trước",
"filler_doc_side_back": "Mặt sau",
"filler_doc_side_file": "Tệp đính kèm",
"filler_doc_choose_file": "Chọn tệp",
"filler_doc_replace": "Thay thế",
"filler_doc_remove": "Xóa",
"filler_doc_invalid_type": "Chỉ chấp nhận JPEG, PNG hoặc PDF",
"filler_doc_too_large": "Tệp tối đa 10MB",
"filler_doc_upload_error": "Không tải lên được giấy tờ. Vui lòng thử lại.",
"filler_doc_type_cccd": "Căn cước công dân",
"filler_doc_type_chung_nhan_tang_ni": "Giấy chứng nhận Tăng-Ni",
"filler_doc_type_diep_sa_di": "Giấy chứng điệp Thọ Sa-di/Sa-di-ni",
"filler_doc_type_diep_thuc_xoa": "Giấy chứng điệp Thọ Thức-xoa-ma-na",
"filler_doc_type_diep_ty_kheo": "Giấy chứng điệp Thọ Tỳ-kheo/Tỳ-kheo-ni",
"filler_doc_type_qd_tru_tri": "Quyết định Bổ nhiệm Trụ trì (nếu có)",
"filler_doc_type_qd_giao_pham": "Quyết định tấn phong giáo phẩm",
"filler_doc_type_qd_chuc_vu_gh": "Quyết định bổ nhiệm chức vụ Giáo hội"
```

Add a small UI helper in `memberDocumentTypes.ts` or colocated `memberDocumentLabels.ts`:

```ts
import { m } from '#/paraglide/messages'
import type { DocumentTypeId } from './memberDocumentTypes'

const LABELS: Record<DocumentTypeId, () => string> = {
  cccd: () => m.filler_doc_type_cccd(),
  chung_nhan_tang_ni: () => m.filler_doc_type_chung_nhan_tang_ni(),
  diep_sa_di: () => m.filler_doc_type_diep_sa_di(),
  diep_thuc_xoa: () => m.filler_doc_type_diep_thuc_xoa(),
  diep_ty_kheo: () => m.filler_doc_type_diep_ty_kheo(),
  qd_tru_tri: () => m.filler_doc_type_qd_tru_tri(),
  qd_giao_pham: () => m.filler_doc_type_qd_giao_pham(),
  qd_chuc_vu_gh: () => m.filler_doc_type_qd_chuc_vu_gh(),
}

export function documentTypeLabel(id: DocumentTypeId): string {
  return LABELS[id]()
}
```

Prefer putting label map next to the UI component if domain must stay free of Paraglide — either is fine if tests that import domain do not pull Paraglide.

- [ ] **Step 1: Add keys to `vi.json`** (exact strings above)

- [ ] **Step 2: Compile**

```bash
cd tanstack-app && pnpm paraglide
```

Expected: success; `m.filler_section_giay_to` exists

- [ ] **Step 3: Commit**

```bash
git add tanstack-app/messages/vi.json
git commit -m "$(cat <<'EOF'
feat: i18n strings for member document uploads

EOF
)"
```

---

### Task 3: `memberRepo.setDocumentPaths`

**Files:**
- Modify: `tanstack-app/src/repositories/memberRepo.ts`
- Modify: `tanstack-app/src/test/memoryStores.ts`
- Create: `tanstack-app/src/repositories/memberDocuments.test.ts` (unit via memory store)

**Interfaces:**
- Consumes: `MemberDocuments`, `DocumentTypeId`, `DocumentSide`, `pathFieldForSide`
- Produces on `MemberStore`:

```ts
setDocumentPaths(
  memberId: string,
  documents: MemberDocuments,
): Promise<Member>
```

Semantics: replace the whole `documents` map on the member (caller merges locally then writes). Allows locked members (admin path), same as `setPhotoPath`.

- [ ] **Step 1: Failing memory-store test**

```ts
import { describe, expect, it } from 'vitest'
import { createMemoryMemberStore } from '#/test/memoryStores'

describe('setDocumentPaths', () => {
  it('writes documents map on member', async () => {
    const store = createMemoryMemberStore()
    const { member } = await store.createOrUpdateDraft({
      orgUnitId: 'gd1',
      sanghaType: 'tang',
      inviteId: null,
      cccd: '012345678901',
      patch: {},
    })
    const updated = await store.setDocumentPaths(member.id, {
      cccd: { frontPath: 'members/x/docs/cccd/front.jpg' },
    })
    expect(updated.documents?.cccd?.frontPath).toContain('front.jpg')
    expect((await store.getById(member.id))?.documents?.cccd?.frontPath).toBe(
      updated.documents?.cccd?.frontPath,
    )
  })
})
```

Adapt `createMemoryMemberStore` import/name to whatever `memoryStores.ts` already exports (mirror `setPhotoPath` tests).

- [ ] **Step 2: Run — expect FAIL**

```bash
cd tanstack-app && pnpm exec vitest run src/repositories/memberDocuments.test.ts
```

- [ ] **Step 3: Implement**

In Firestore repo, mirror `setPhotoPath`: load member, set `documents`, `updatedAt = now`, write. In memory store, same.

```ts
async function setDocumentPaths(
  memberId: string,
  documents: MemberDocuments,
): Promise<Member> {
  // load existing; throw NOT_FOUND if missing
  // write { ...existing, documents, updatedAt }
}
```

Empty map: pass `{}` or omit field — prefer storing `{}` cleared via `deleteField()` / omit when empty; for simplicity store the object the caller passes (caller removes empty type keys).

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/repositories/memberRepo.ts \
  tanstack-app/src/test/memoryStores.ts \
  tanstack-app/src/repositories/memberDocuments.test.ts
git commit -m "$(cat <<'EOF'
feat: persist member documents map on Firestore

EOF
)"
```

---

### Task 4: Worker docs API

**Files:**
- Modify: `tanstack-app/src/worker/presignR2Put.ts` — add `memberDocumentKey` (or import shared helper; Worker may not resolve `#/` domain — **duplicate thin key builder in worker** or import from a path Vite/Worker both can load). Prefer re-exporting from domain if worker tsconfig already allows `#/domain/*`; else duplicate:

```ts
export function memberDocumentKey(
  memberId: string,
  typeId: string,
  side: string,
  ext: string,
): string {
  return `members/${memberId}/docs/${typeId}/${side}.${ext}`
}
```

- Create: `tanstack-app/src/worker/docsApi.ts`
- Create: `tanstack-app/src/worker/docsApi.test.ts`
- Modify: `tanstack-app/src/worker.ts` — route `/api/docs`

**Interfaces:**
- Produces:

```
POST /api/docs/member-upload-url
  body: { memberId, cccd, typeId, side, contentType, inviteToken? }
  → { uploadUrl, filePath }

DELETE /api/docs/member
  body: { memberId, typeId, side?, paths: string[], cccd?, inviteToken? }
  → { ok: true }
  // Client passes known R2 paths to delete (Worker deletes those keys).
  // Auth: same as photos (admin Bearer or invite+cccd). Locked blocks non-admin.

DELETE /api/docs/member-prefix
  body: { memberId } + admin Bearer only
  → list prefix members/{memberId}/docs/ and delete all; { ok: true }
```

Worker validates `typeId`/`side` against an inline copy of the registry (or import domain). Content types: jpeg/png/pdf only. Extension from content type.

- [ ] **Step 1: Write failing handler tests** (mock Firestore REST + `createR2PresignedPutUrl` + `env.PHOTOS` like `photosApi.test.ts`)

Cover: happy upload-url; reject bad side; reject non-admin locked; delete listed paths; prefix delete admin-only.

- [ ] **Step 2: Run — expect FAIL**

```bash
cd tanstack-app && pnpm exec vitest run src/worker/docsApi.test.ts
```

- [ ] **Step 3: Implement `docsApi.ts` + wire `worker.ts`**

```ts
// worker.ts addition
if (url.pathname.startsWith('/api/docs')) {
  return handleDocsApi(request, env)
}
```

Copy auth structure from `handleMemberUploadUrl` / `handleMemberDelete` in `photosApi.ts`.

For prefix delete:

```ts
const listed = await env.PHOTOS.list({ prefix: `members/${memberId}/docs/` })
await Promise.all(listed.objects.map((o) => env.PHOTOS.delete(o.key)))
// paginate with listed.truncated if needed
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/worker/presignR2Put.ts \
  tanstack-app/src/worker/docsApi.ts \
  tanstack-app/src/worker/docsApi.test.ts \
  tanstack-app/src/worker.ts
git commit -m "$(cat <<'EOF'
feat: worker API for member document upload and delete

EOF
)"
```

---

### Task 5: Client API + upload/delete use-cases

**Files:**
- Create: `tanstack-app/src/photos/docsApiClient.ts`
- Create: `tanstack-app/src/photos/docsApiClient.test.ts`
- Create: `tanstack-app/src/use-cases/uploadMemberDocument.ts`
- Create: `tanstack-app/src/use-cases/uploadMemberDocument.test.ts`
- Create: `tanstack-app/src/use-cases/deleteMemberDocument.ts`
- Create: `tanstack-app/src/use-cases/deleteMemberDocument.test.ts`
- Create: `tanstack-app/src/components/filler/memberDocumentUrl.ts`

**Interfaces:**
- Consumes: docs Worker API, `memberRepo.setDocumentPaths`, domain key helpers
- Produces:

```ts
export async function uploadMemberDocument(input: {
  memberId: string
  cccd: string
  typeId: DocumentTypeId
  side: DocumentSide
  bytes: Uint8Array
  contentType: string
  inviteToken?: string
  idToken?: string
  /** Current documents map before this side upload */
  current: MemberDocuments
}): Promise<{ filePath: string; documents: MemberDocuments }>

export async function deleteMemberDocument(input: {
  memberId: string
  cccd: string
  typeId: DocumentTypeId
  side?: DocumentSide  // omit = whole type
  current: MemberDocuments
  inviteToken?: string
  idToken?: string
}): Promise<{ documents: MemberDocuments }>

export function getMemberDocumentDownloadUrl(filePath: string): string
```

Upload flow: validate content type + size client-side in use-case; request URL; PUT; merge path into `current`; `setDocumentPaths`; if previous path for that side differs, best-effort `DELETE /api/docs/member` with old path only.

Delete flow: collect path(s) to remove from `current`; call DELETE with `paths`; write merged map without those fields/types.

- [ ] **Step 1: Failing use-case tests with fake storage + memory member store** (pattern from `uploadMemberPhoto.test.ts`)

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement client + use-cases + URL helper** (URL helper copies `memberPhotoUrl.ts` using same `VITE_PHOTOS_PUBLIC_BASE`)

- [ ] **Step 4: Run — expect PASS**

```bash
cd tanstack-app && pnpm exec vitest run \
  src/photos/docsApiClient.test.ts \
  src/use-cases/uploadMemberDocument.test.ts \
  src/use-cases/deleteMemberDocument.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/photos/docsApiClient.ts \
  tanstack-app/src/photos/docsApiClient.test.ts \
  tanstack-app/src/use-cases/uploadMemberDocument.ts \
  tanstack-app/src/use-cases/uploadMemberDocument.test.ts \
  tanstack-app/src/use-cases/deleteMemberDocument.ts \
  tanstack-app/src/use-cases/deleteMemberDocument.test.ts \
  tanstack-app/src/components/filler/memberDocumentUrl.ts
git commit -m "$(cat <<'EOF'
feat: upload and delete member document use-cases

EOF
)"
```

---

### Task 6: Wipe docs on member hard-delete

**Files:**
- Modify: `tanstack-app/src/use-cases/deleteMembers.ts`
- Modify: `tanstack-app/src/use-cases/deleteMembers.test.ts` (create if missing; else extend)
- Modify: `tanstack-app/src/photos/docsApiClient.ts` — `deleteMemberDocumentsPrefix({ memberId, idToken })`

**Interfaces:**
- After `deleteMany`, `Promise.allSettled` both photo delete and docs prefix delete per id.

```ts
await Promise.allSettled(
  input.ids.flatMap((id) => [
    deletePhoto(id),
    deleteDocsPrefix(id),
  ]),
)
```

- [ ] **Step 1: Failing test** — assert prefix delete called for each id

- [ ] **Step 2: Implement**

- [ ] **Step 3: Run tests PASS + commit**

```bash
git commit -m "$(cat <<'EOF'
feat: delete R2 document prefix when hard-deleting members

EOF
)"
```

---

### Task 7: `MemberDocumentsField` UI (layout B)

**Files:**
- Create: `tanstack-app/src/components/filler/MemberDocumentsField.tsx`
- Create: `tanstack-app/src/components/filler/MemberDocumentsField.test.tsx`

**Interfaces:**
- Consumes: upload/delete use-cases, registry, labels, Mantine `Select` / `FileButton` / `Stack` / `Group` / `Anchor` / `Text` / `Button`

```ts
export type PendingDocumentFiles = Partial<
  Record<DocumentTypeId, Partial<Record<DocumentSide, File>>>
>

export type MemberDocumentsFieldProps = {
  memberId?: string
  cccd: string
  inviteToken?: string
  getIdToken?: () => Promise<string | undefined>
  documents: MemberDocuments
  onDocumentsChange: (next: MemberDocuments) => void
  pendingFiles: PendingDocumentFiles
  onPendingFilesChange: (next: PendingDocumentFiles) => void
  disabled?: boolean
  onUploadError?: (message: string) => void
}
```

Behavior:
1. `Select` options = registry types **absent** from `documents` and from pending-with-any-file.
2. When a type is selected, show slots (`front`/`back` or `file`) with FileButton accept `image/jpeg,image/png,application/pdf`.
3. On file choose with `memberId`: upload immediately; merge into `documents`; clear select.
4. Without `memberId`: stash into `pendingFiles`; treat type as “attached” for list + hide from select.
5. “Đã đính kèm” lists types with any path or pending file; show links (public URL or object URL); Replace / Remove type (delete R2 when id present).
6. Client reject invalid type / >10MB with message keys from Task 2.

- [ ] **Step 1: Write component tests**

```ts
it('hides used types from the select', async () => { /* ... */ })
it('shows front/back slots for cccd', async () => { /* ... */ })
it('stores pending file when memberId is missing', async () => { /* ... */ })
```

Mock `uploadMemberDocument` / `deleteMemberDocument`.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement component** (keep file focused; no cards beyond interaction containers; match existing form styling — `FormSection` wrapper can live in parent)

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: MemberDocumentsField upload UI

EOF
)"
```

---

### Task 8: Wire into form + flush pending on create

**Files:**
- Modify: `tanstack-app/src/components/filler/MemberFormFields.tsx`
- Modify: `tanstack-app/src/components/admin/MemberFormPage.tsx`
- Modify: `tanstack-app/src/components/filler/MemberEditorForm.tsx`
- Modify tests: `MemberEditorForm.test.tsx`, `MemberFormPage` tests if any assert create+photo

**Interfaces:**
- Extend `MemberFormFieldsApi`:

```ts
getDocuments: () => MemberDocuments
setDocuments: (docs: MemberDocuments) => void
getPendingDocuments: () => PendingDocumentFiles
clearPendingDocuments: () => void
```

- After Nguyện vọng `FormSection`, add:

```tsx
<FormSection title={m.filler_section_giay_to()}>
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
  />
</FormSection>
```

Init `documents` from `initial.documents ?? {}`.

**Create flush** (admin + filler), after portrait pending upload:

```ts
const pending = api.getPendingDocuments()
for (const typeId of Object.keys(pending) as DocumentTypeId[]) {
  const sides = pending[typeId] ?? {}
  for (const side of Object.keys(sides) as DocumentSide[]) {
    const file = sides[side]
    if (!file) continue
    const bytes = new Uint8Array(await file.arrayBuffer())
    const result = await uploadMemberDocument({
      memberId: resultMemberId,
      cccd: resolvedCccd,
      typeId,
      side,
      bytes,
      contentType: file.type,
      inviteToken, // filler
      idToken,     // admin
      current: api.getDocuments(),
    })
    api.setDocuments(result.documents)
  }
}
api.clearPendingDocuments()
```

Wrap in try/catch; on failure set upload error message (`filler_doc_upload_error`).

- [ ] **Step 1: Update failing/extend existing create+photo tests** to also cover one pending doc upload (or add a focused test)

- [ ] **Step 2: Implement wiring**

- [ ] **Step 3: Run**

```bash
cd tanstack-app && pnpm test
```

Expected: PASS (fix any fixture Members missing `documents` — optional field)

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: wire document uploads into member form

EOF
)"
```

---

### Task 9: Spec self-check + final verification

- [ ] **Step 1: Checklist vs spec**

| Spec item | Task |
| --- | --- |
| Registry + 8 types | 1 |
| `documents` on Member | 1, 3 |
| R2 keys + Worker upload/delete | 4 |
| JPEG/PNG/PDF, 10MB | 1, 5, 7 |
| Layout B UI under Nguyện vọng | 7, 8 |
| Optional / filler+admin | 8 |
| Pending on create | 8 |
| Hard-delete prefix | 6 |
| Vitest, no Cypress | all |

- [ ] **Step 2: Full test run**

```bash
cd tanstack-app && pnpm test
```

Expected: PASS

- [ ] **Step 3: Final commit only if leftovers** (messages, small fixes)

---

## Plan self-review

1. **Spec coverage:** All decision table rows mapped; OCR/required/Cypress explicitly out of scope.
2. **Placeholders:** None intentional; Worker registry may be duplicated — call that out in Task 4.
3. **Types:** `DocumentTypeId`, `DocumentSide`, `MemberDocuments`, `PendingDocumentFiles`, `setDocumentPaths` names consistent across tasks.
4. **Deviation note:** Spec mentioned `buildMemberPatch` for documents; plan uses dedicated `setDocumentPaths` like `photoPath` to avoid save races with immediate uploads.
