# Member Profile PDF Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins export a full member profile PDF (all form fields + portrait) from the detail page, and from the list export selected rows or all members on the current ha-lạp filter as either one merged PDF or a ZIP of per-member PDFs plus original attached documents.

**Architecture:** Pure domain maps `Member` → PDF view-model (labels, “—”, dates, addresses). `@react-pdf/renderer` renders A4 pages from that view-model. A use-case loads members, fetches portrait/document blobs, builds PDF/ZIP, and triggers download. List UI adds a Mantine modal (source + format); detail page adds a one-click export button.

**Tech Stack:** TypeScript, Vitest, Testing Library, Mantine, Paraglide, `@react-pdf/renderer`, `jszip`, existing `memberRepo` / public photo-doc CDN URLs.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-14-member-pdf-export-design.md`
- Workspace rule: create branch `feat/member-pdf-export` from `main` before coding; **do not** use git worktrees (`git checkout -b` only).
- Admin only; no filler routes.
- No Cypress for this feature; Vitest + Testing Library only.
- Do not change Excel export behavior (`listAllForExport` remains tab-agnostic).
- “All by filter” **must** honor active `haLapTabRank` + org unit + status + sanghaType.
- Merged PDF: form + portrait only. ZIP: per-member PDF + original `documents` files.
- Empty field values render as `—` (em dash, U+2014).
- Omit internal fields listed in the spec (`inviteId`, raw paths, directory auth, sort keys, etc.).
- Tests: from `tanstack-app`, `pnpm exec vitest run <file>`. After editing `messages/vi.json`, run `pnpm paraglide`.
- Every task’s requirements include this section.

## File map

| File | Responsibility |
|------|----------------|
| Create `tanstack-app/src/domain/memberPdfNames.ts` | Slug, per-member / batch filenames, ZIP folder + doc entry paths |
| Create `tanstack-app/src/domain/memberPdfNames.test.ts` | Name/path tests |
| Create `tanstack-app/src/domain/memberPdfViewModel.ts` | `Member` → sections/fields for PDF |
| Create `tanstack-app/src/domain/memberPdfViewModel.test.ts` | Empty “—”, dates, tang/ni precepts, docs status |
| Create `tanstack-app/src/domain/downloadBlob.ts` | `downloadBlob(blob, filename)` |
| Create `tanstack-app/src/components/admin/pdf/memberPdfFonts.ts` | `Font.register` Be Vietnam Pro |
| Create `tanstack-app/src/components/admin/pdf/MemberPdfDocument.tsx` | `@react-pdf` Document from view-models + portraits |
| Create `tanstack-app/src/components/admin/pdf/renderMemberPdf.ts` | `pdf(...).toBlob()` wrappers |
| Create `tanstack-app/src/use-cases/exportMembersPdf.ts` | Resolve members, fetch binaries, PDF/ZIP, download |
| Create `tanstack-app/src/use-cases/exportMembersPdf.test.ts` | Use-case tests with mocks |
| Create `tanstack-app/src/components/admin/MembersPdfExportModal.tsx` | Source + format modal |
| Create `tanstack-app/src/components/admin/MembersPdfExportModal.test.tsx` | Modal default/disable rules |
| Modify `tanstack-app/messages/vi.json` | PDF export copy |
| Modify `tanstack-app/src/components/admin/MembersListPage.tsx` | Button + modal + mutation |
| Modify `tanstack-app/src/components/admin/MembersListPage.test.tsx` | List export wiring |
| Modify `tanstack-app/src/components/admin/MemberFormPage.tsx` | Detail Xuất PDF |
| Modify `tanstack-app/src/components/admin/MemberFormPage.test.tsx` | Button in edit mode |
| Modify `tanstack-app/package.json` | Add `@react-pdf/renderer`, `jszip` (+ `@types/jszip` if needed) |

---

### Task 1: Branch, deps, filename helpers

**Files:**
- Create: `tanstack-app/src/domain/memberPdfNames.ts`
- Test: `tanstack-app/src/domain/memberPdfNames.test.ts`
- Modify: `tanstack-app/package.json` (via pnpm)

**Interfaces:**
- Produces:
  - `export function memberPdfSlug(member: Pick<Member, 'phapDanh' | 'theDanh'>): string`
  - `export function memberPdfFilename(member: Pick<Member, 'id' | 'phapDanh' | 'theDanh'>): string` → `HoSo_<slug>_<id>.pdf`
  - `export function membersMergedPdfFilename(date?: Date): string` → `HoSoMembers_yyyy-mm-dd.pdf`
  - `export function membersPdfZipFilename(date?: Date): string` → `HoSoMembers_yyyy-mm-dd.zip`
  - `export function memberPdfZipFolder(member: Pick<Member, 'id' | 'phapDanh' | 'theDanh'>): string` → `<slug>_<id>`
  - `export function memberPdfZipDocEntry(folder: string, typeId: string, side: string, ext: string): string` → `<folder>/documents/<typeId>_<side>.<ext>`
  - `export function extFromObjectKeyOrType(objectKey: string, contentType?: string | null): string`

- [ ] **Step 1: Create branch from main**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git checkout main
git pull
git checkout -b feat/member-pdf-export
```

- [ ] **Step 2: Install dependencies**

```bash
cd tanstack-app
pnpm add @react-pdf/renderer jszip
pnpm add -D @types/jszip
```

If `@types/jszip` is unused / package already ships types, remove the types package and rely on built-in types.

- [ ] **Step 3: Write the failing test**

Create `tanstack-app/src/domain/memberPdfNames.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import {
  extFromObjectKeyOrType,
  memberPdfFilename,
  memberPdfSlug,
  memberPdfZipDocEntry,
  memberPdfZipFolder,
  membersMergedPdfFilename,
  membersPdfZipFilename,
} from '#/domain/memberPdfNames'

describe('memberPdfSlug', () => {
  it('prefers phapDanh, then theDanh, then member', () => {
    expect(memberPdfSlug({ phapDanh: 'Minh Tâm', theDanh: 'Nguyễn A' })).toBe('Minh_Tam')
    expect(memberPdfSlug({ theDanh: 'Nguyễn Văn A' })).toBe('Nguyen_Van_A')
    expect(memberPdfSlug({})).toBe('member')
  })

  it('strips path-unsafe characters', () => {
    expect(memberPdfSlug({ phapDanh: 'A/B\\C:D*E?' })).toBe('A_B_C_D_E')
  })
})

describe('filenames', () => {
  it('builds per-member and batch names', () => {
    expect(
      memberPdfFilename({ id: 'm1', phapDanh: 'Minh Tam' }),
    ).toBe('HoSo_Minh_Tam_m1.pdf')
    const d = new Date(2026, 8, 14) // local Sep 14
    expect(membersMergedPdfFilename(d)).toBe('HoSoMembers_2026-09-14.pdf')
    expect(membersPdfZipFilename(d)).toBe('HoSoMembers_2026-09-14.zip')
  })

  it('builds zip document entry paths', () => {
    const folder = memberPdfZipFolder({ id: 'm1', phapDanh: 'Minh Tam' })
    expect(folder).toBe('Minh_Tam_m1')
    expect(memberPdfZipDocEntry(folder, 'cccd', 'front', 'jpg')).toBe(
      'Minh_Tam_m1/documents/cccd_front.jpg',
    )
  })

  it('picks extension from key or content-type', () => {
    expect(extFromObjectKeyOrType('members/m1/docs/cccd/front.jpg')).toBe('jpg')
    expect(extFromObjectKeyOrType('x', 'application/pdf')).toBe('pdf')
    expect(extFromObjectKeyOrType('x', 'image/png')).toBe('png')
  })
})
```

Slug rules to implement: NFD normalize, strip combining marks, replace non `[A-Za-z0-9_-]` with `_`, collapse repeated `_`, trim `_`, fallback `member`.

- [ ] **Step 4: Run test to verify it fails**

Run: `cd tanstack-app && pnpm exec vitest run src/domain/memberPdfNames.test.ts`

Expected: FAIL (module missing)

- [ ] **Step 5: Implement `memberPdfNames.ts`**

```typescript
import type { Member } from '#/domain/types'

function formatLocalDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function memberPdfSlug(
  member: Pick<Member, 'phapDanh' | 'theDanh'> | { phapDanh?: string; theDanh?: string },
): string {
  const raw = (member.phapDanh?.trim() || member.theDanh?.trim() || 'member')
  const ascii = raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  return ascii || 'member'
}

export function memberPdfFilename(
  member: Pick<Member, 'id' | 'phapDanh' | 'theDanh'>,
): string {
  return `HoSo_${memberPdfSlug(member)}_${member.id}.pdf`
}

export function membersMergedPdfFilename(date: Date = new Date()): string {
  return `HoSoMembers_${formatLocalDate(date)}.pdf`
}

export function membersPdfZipFilename(date: Date = new Date()): string {
  return `HoSoMembers_${formatLocalDate(date)}.zip`
}

export function memberPdfZipFolder(
  member: Pick<Member, 'id' | 'phapDanh' | 'theDanh'>,
): string {
  return `${memberPdfSlug(member)}_${member.id}`
}

export function memberPdfZipDocEntry(
  folder: string,
  typeId: string,
  side: string,
  ext: string,
): string {
  return `${folder}/documents/${typeId}_${side}.${ext}`
}

export function extFromObjectKeyOrType(
  objectKey: string,
  contentType?: string | null,
): string {
  const fromKey = objectKey.split('.').pop()?.toLowerCase()
  if (fromKey && /^[a-z0-9]{2,5}$/.test(fromKey) && fromKey !== objectKey) {
    return fromKey === 'jpeg' ? 'jpg' : fromKey
  }
  if (contentType === 'application/pdf') return 'pdf'
  if (contentType === 'image/png') return 'png'
  if (contentType === 'image/jpeg' || contentType === 'image/jpg') return 'jpg'
  return 'bin'
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd tanstack-app && pnpm exec vitest run src/domain/memberPdfNames.test.ts`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add tanstack-app/package.json tanstack-app/pnpm-lock.yaml \
  tanstack-app/src/domain/memberPdfNames.ts \
  tanstack-app/src/domain/memberPdfNames.test.ts
git commit -m "$(cat <<'EOF'
feat: add member PDF filename helpers and PDF export deps

EOF
)"
```

---

### Task 2: Member PDF view-model

**Files:**
- Create: `tanstack-app/src/domain/memberPdfViewModel.ts`
- Test: `tanstack-app/src/domain/memberPdfViewModel.test.ts`

**Interfaces:**
- Consumes: `Member`, `SanghaType`; `formatAddressDisplay` from `#/domain/address`; `rankLabel` from `#/components/filler/fillerFormOptions`; `MEMBER_DOCUMENT_TYPES` from `#/domain/memberDocumentTypes`; `documentTypeLabel` from `#/components/filler/memberDocumentLabels`; `m` from `#/paraglide/messages`
- Produces:
  - `export const MEMBER_PDF_EMPTY = '—'`
  - `export type MemberPdfField = { label: string; value: string }`
  - `export type MemberPdfBlock = { title: string; fields: MemberPdfField[] }`
  - `export type MemberPdfSection = { title: string; fields: MemberPdfField[]; blocks?: MemberPdfBlock[] }`
  - `export type MemberPdfViewModel = { memberId: string; header: { phapDanh: string; theDanh: string; sanghaLabel: string; orgUnitName: string; statusLabel: string }; sections: MemberPdfSection[] }`
  - `export type MemberPdfViewContext = { orgUnitNameById: Record<string, string> }`
  - `export function buildMemberPdfViewModel(member: Member, ctx: MemberPdfViewContext): MemberPdfViewModel`

Reuse date formatting identical to Excel (`YYYY-MM-DD` → `DD-MM-YYYY`). Display helper: empty/whitespace → `MEMBER_PDF_EMPTY`.

Section order (match `MemberFormFields`): identity (incl. CCCD/CNTN), contact, xuất gia, giới (sangha-specific), phẩm vị, học vấn, chức vụ (blocks for hệ phái / GHPGVN rows + đoàn thể field), khóa tu, gia đình, nguyện vọng, giấy tờ (attachment status only — not file bytes).

- [ ] **Step 1: Write the failing test**

Create `tanstack-app/src/domain/memberPdfViewModel.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import type { Member } from '#/domain/types'
import { m } from '#/paraglide/messages'
import {
  buildMemberPdfViewModel,
  MEMBER_PDF_EMPTY,
} from '#/domain/memberPdfViewModel'

function member(overrides: Partial<Member> & Pick<Member, 'id' | 'sanghaType'>): Member {
  return {
    orgUnitId: 'gd-i',
    status: 'draft',
    cccd: '012345678901',
    inviteId: null,
    currentTempleId: null,
    photoPath: null,
    createdAt: '2026-07-19T00:00:00.000Z',
    updatedAt: '2026-07-19T00:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    editRequestedAt: null,
    editRequestedBy: null,
    ...overrides,
  }
}

function fieldValue(vm: ReturnType<typeof buildMemberPdfViewModel>, label: string): string | undefined {
  for (const section of vm.sections) {
    const hit = section.fields.find((f) => f.label === label)
    if (hit) return hit.value
    for (const block of section.blocks ?? []) {
      const bHit = block.fields.find((f) => f.label === label)
      if (bHit) return bHit.value
    }
  }
  return undefined
}

describe('buildMemberPdfViewModel', () => {
  it('uses em dash for empty fields and formats dates', () => {
    const vm = buildMemberPdfViewModel(
      member({
        id: 'm1',
        sanghaType: 'tang',
        phapDanh: 'Minh Tam',
        ngaySinh: '1990-01-15',
      }),
      { orgUnitNameById: { 'gd-i': 'Giáo đoàn I' } },
    )
    expect(vm.header.phapDanh).toBe('Minh Tam')
    expect(vm.header.orgUnitName).toBe('Giáo đoàn I')
    expect(vm.header.statusLabel).toBe(m.admin_members_status_draft())
    expect(fieldValue(vm, m.filler_field_ngay_sinh())).toBe('15-01-1990')
    expect(fieldValue(vm, m.filler_field_email())).toBe(MEMBER_PDF_EMPTY)
  })

  it('includes tang and ni precept sections with formatted dates', () => {
    const tang = buildMemberPdfViewModel(
      member({
        id: 'm1',
        sanghaType: 'tang',
        gioiTyKheo: { ngayGh: '2015-06-01' },
      }),
      { orgUnitNameById: {} },
    )
    const ni = buildMemberPdfViewModel(
      member({
        id: 'm2',
        sanghaType: 'ni',
        gioiTyKheoNi: { ngayGh: '2016-06-01' },
      }),
      { orgUnitNameById: {} },
    )
    expect(tang.sections.map((s) => s.title)).toContain(m.filler_section_gioi())
    expect(ni.sections.map((s) => s.title)).toContain(m.filler_section_gioi())
    expect(JSON.stringify(tang)).toContain('01-06-2015')
    expect(JSON.stringify(ni)).toContain('01-06-2016')
  })

  it('lists document attachment status without raw paths', () => {
    const vm = buildMemberPdfViewModel(
      member({
        id: 'm1',
        sanghaType: 'tang',
        documents: {
          cccd: {
            frontPath: 'members/m1/docs/cccd/front.jpg',
            backPath: 'members/m1/docs/cccd/back.jpg',
          },
        },
      }),
      { orgUnitNameById: {} },
    )
    const json = JSON.stringify(vm)
    expect(json).not.toContain('members/m1/docs')
    expect(fieldValue(vm, m.filler_doc_type_diep_sa_di()) ?? MEMBER_PDF_EMPTY).toBe(
      MEMBER_PDF_EMPTY,
    )
  })

  it('falls back org unit id when name missing', () => {
    const vm = buildMemberPdfViewModel(
      member({ id: 'm1', sanghaType: 'tang', orgUnitId: 'gd-x' }),
      { orgUnitNameById: {} },
    )
    expect(vm.header.orgUnitName).toBe('gd-x')
  })
})
```

Adjust label lookups if exact message keys differ — open `MemberFormFields.tsx` / `messages/vi.json` and use the same `m.filler_field_*` keys the form uses.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tanstack-app && pnpm exec vitest run src/domain/memberPdfViewModel.test.ts`

Expected: FAIL (module missing)

- [ ] **Step 3: Implement view-model**

Create `tanstack-app/src/domain/memberPdfViewModel.ts` with:

- `display(value?: string | null): string` → trim or `MEMBER_PDF_EMPTY`
- `formatDateDdMmYyyy` (copy from `memberExcelColumns.ts`)
- `field(label, value)` helper
- Precept subsection builder (same subkeys as Excel: `ngayGh`, `taiGh`, `tonHieuGioiDan`, `ngayHePhai`, `taiHePhai`)
- Repeatable blocks for `chucVuHePhai`, `chucVuGhpgvn`, `khoaTu`, `giaDinh.anhChiEm`
- Documents: for each `MEMBER_DOCUMENT_TYPES` entry, if no paths → empty; if front/back → side labels (or `"Mặt trước, mặt sau"` / `"Đã đính kèm"`); never put raw storage paths in `value`

Map **all** form fields the admin form shows (mirror `MemberFormFields` sections). Prefer calling existing `m.*` keys; do not invent English labels.

Omit: `id` as a labeled field, `inviteId`, `photoPath`, `documents` paths, directory role grant metadata, `lockedBy`, `editRequestedBy`, `giaoPhamHePhaiRankOrder`, `haLapTabRank`, `sapXepHaLap`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tanstack-app && pnpm exec vitest run src/domain/memberPdfViewModel.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/domain/memberPdfViewModel.ts \
  tanstack-app/src/domain/memberPdfViewModel.test.ts
git commit -m "$(cat <<'EOF'
feat: map member records to PDF view-models

EOF
)"
```

---

### Task 3: PDF document render + download helper

**Files:**
- Create: `tanstack-app/src/domain/downloadBlob.ts`
- Create: `tanstack-app/src/components/admin/pdf/memberPdfFonts.ts`
- Create: `tanstack-app/src/components/admin/pdf/MemberPdfDocument.tsx`
- Create: `tanstack-app/src/components/admin/pdf/renderMemberPdf.ts`
- Test: `tanstack-app/src/components/admin/pdf/renderMemberPdf.test.ts`

**Interfaces:**
- Consumes: `MemberPdfViewModel` from Task 2; `@react-pdf/renderer` (`Document`, `Page`, `View`, `Text`, `Image`, `StyleSheet`, `Font`, `pdf`)
- Produces:
  - `export function downloadBlob(blob: Blob, filename: string): void`
  - `export function registerMemberPdfFonts(): void` (idempotent)
  - `export type MemberPdfRenderInput = { viewModel: MemberPdfViewModel; portraitDataUrl: string | null }`
  - `export function MemberPdfDocument(props: { members: MemberPdfRenderInput[] }): React.ReactElement`
  - `export async function renderMembersPdfBlob(members: MemberPdfRenderInput[]): Promise<Blob>`

- [ ] **Step 1: Write failing render smoke test**

Create `tanstack-app/src/components/admin/pdf/renderMemberPdf.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { MEMBER_PDF_EMPTY, type MemberPdfViewModel } from '#/domain/memberPdfViewModel'
import { renderMembersPdfBlob } from '#/components/admin/pdf/renderMemberPdf'

const sampleVm: MemberPdfViewModel = {
  memberId: 'm1',
  header: {
    phapDanh: 'Minh Tam',
    theDanh: 'Nguyen A',
    sanghaLabel: 'Tăng',
    orgUnitName: 'GD I',
    statusLabel: 'Nháp',
  },
  sections: [
    {
      title: 'Định danh',
      fields: [{ label: 'Email', value: MEMBER_PDF_EMPTY }],
    },
  ],
}

describe('renderMembersPdfBlob', () => {
  it('returns a non-empty PDF blob for one member', async () => {
    const blob = await renderMembersPdfBlob([
      { viewModel: sampleVm, portraitDataUrl: null },
    ])
    expect(blob.type).toBe('application/pdf')
    expect(blob.size).toBeGreaterThan(100)
  }, 30_000)

  it('returns a PDF blob for two members', async () => {
    const second = {
      ...sampleVm,
      memberId: 'm2',
      header: { ...sampleVm.header, phapDanh: 'Other' },
    }
    const blob = await renderMembersPdfBlob([
      { viewModel: sampleVm, portraitDataUrl: null },
      { viewModel: second, portraitDataUrl: null },
    ])
    expect(blob.size).toBeGreaterThan(100)
  }, 30_000)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tanstack-app && pnpm exec vitest run src/components/admin/pdf/renderMemberPdf.test.ts`

Expected: FAIL (module missing)

- [ ] **Step 3: Implement fonts, document, render, downloadBlob**

`memberPdfFonts.ts` — register Be Vietnam Pro once:

```typescript
import { Font } from '@react-pdf/renderer'
import be400 from '@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-ext-400-normal.woff?url'
import be700 from '@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-ext-700-normal.woff?url'

let registered = false

export function registerMemberPdfFonts(): void {
  if (registered) return
  Font.register({
    family: 'BeVietnamPro',
    fonts: [
      { src: be400, fontWeight: 400 },
      { src: be700, fontWeight: 700 },
    ],
  })
  registered = true
}
```

If Vitest cannot resolve `?url`, add a vitest alias or register with absolute file URLs in test via conditional. Prefer fixing Vite/Vitest config minimally rather than skipping font registration in tests.

`MemberPdfDocument.tsx` — A4 pages; each member starts on a new page sequence. Header row: text left, optional `<Image src={portraitDataUrl} style={{ width: 85, height: 113 }} />` right. Sections: bold title, then label/value rows; blocks with subtitle. Font family `BeVietnamPro`, fontSize ~9–11.

`renderMemberPdf.ts`:

```typescript
import { pdf } from '@react-pdf/renderer'
import { createElement } from 'react'
import { MemberPdfDocument, type MemberPdfRenderInput } from './MemberPdfDocument'
import { registerMemberPdfFonts } from './memberPdfFonts'

export type { MemberPdfRenderInput }

export async function renderMembersPdfBlob(
  members: MemberPdfRenderInput[],
): Promise<Blob> {
  registerMemberPdfFonts()
  return pdf(createElement(MemberPdfDocument, { members })).toBlob()
}
```

`downloadBlob.ts`:

```typescript
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tanstack-app && pnpm exec vitest run src/components/admin/pdf/renderMemberPdf.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/domain/downloadBlob.ts \
  tanstack-app/src/components/admin/pdf
# only add vite/vitest config if changed for ?url
git commit -m "$(cat <<'EOF'
feat: render member profile PDFs with react-pdf

EOF
)"
```

---

### Task 4: Export use-case (resolve, fetch, PDF/ZIP)

**Files:**
- Create: `tanstack-app/src/use-cases/exportMembersPdf.ts`
- Test: `tanstack-app/src/use-cases/exportMembersPdf.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3; `memberRepo` (`getById`, `listByHaLapTab`); photo/doc URL helpers; `JSZip`
- Produces:
  - `export type MembersPdfFormat = 'merged_pdf' | 'zip'`
  - `export type ExportMembersPdfProgress = { done: number; total: number }`
  - `export type ExportMembersPdfInput = { members?: Member[]; memberIds?: string[]; listAll?: { sanghaType: SanghaType; orgUnitId?: string; status?: RecordStatus; haLapTabRank: string }; format: MembersPdfFormat; orgUnitNameById: Record<string, string>; filenameOverride?: string; onProgress?: (p: ExportMembersPdfProgress) => void }`
  - `export type ExportMembersPdfResult = { filename: string; failedDocumentCount: number }`
  - `export async function exportMembersPdf(input, deps?): Promise<ExportMembersPdfResult>`

Resolution order:
1. If `input.members` provided → use that array.
2. Else if `input.memberIds` → `getById` each; skip nulls.
3. Else if `input.listAll` → paginate `listByHaLapTab` with `limit: 50` until `nextCursor` is null.
4. If final array length 0 → throw `new Error('EMPTY_EXPORT')`.

Portrait: if `photoPath`, fetch via deps; on failure `portraitDataUrl: null`.

ZIP: per member render one PDF into `${folder}/HoSo.pdf`; fetch documents into `memberPdfZipDocEntry(...)`; count failures; download zip.

Merged: one `renderMembersPdfBlob(all)`; filename = `filenameOverride` ?? (length === 1 ? `memberPdfFilename` : `membersMergedPdfFilename()`).

Process members sequentially; call `onProgress` after each.

- [ ] **Step 1: Write failing use-case tests**

Create `tanstack-app/src/use-cases/exportMembersPdf.test.ts` covering:

1. Single merged PDF download with `filenameOverride`
2. ZIP of two members with one failed document fetch → `failedDocumentCount === 1`
3. `listAll` empty → `EMPTY_EXPORT`
4. Photo fetch failure still renders with `portraitDataUrl: null`

Inject deps: `downloadBlob`, `renderMembersPdfBlob`, `fetchPhoto`, `fetchDocument`, `memberStore`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tanstack-app && pnpm exec vitest run src/use-cases/exportMembersPdf.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement `exportMembersPdf.ts`**

Paginate inside the use-case (do not change Excel’s `listAllForExport`):

```typescript
async function listAllByHaLapTab(
  store: Pick<MemberStore, 'listByHaLapTab'>,
  input: {
    sanghaType: SanghaType
    orgUnitId?: string
    status?: RecordStatus
    haLapTabRank: string
  },
): Promise<Member[]> {
  const all: Member[] = []
  let cursor: string | undefined
  for (;;) {
    const page = await store.listByHaLapTab({ ...input, limit: 50, cursor })
    all.push(...page.items)
    if (!page.nextCursor) break
    cursor = page.nextCursor
  }
  return all
}
```

Default fetch helpers: build URL via `getMemberPhotoDownloadUrl` / `getMemberDocumentDownloadUrl`, `fetch`, return null on failure.

ZIP via `JSZip`; paths from Task 1.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tanstack-app && pnpm exec vitest run src/use-cases/exportMembersPdf.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/use-cases/exportMembersPdf.ts \
  tanstack-app/src/use-cases/exportMembersPdf.test.ts
git commit -m "$(cat <<'EOF'
feat: add exportMembersPdf use-case for PDF and ZIP

EOF
)"
```

---

### Task 5: i18n + list modal + MembersListPage

**Files:**
- Modify: `tanstack-app/messages/vi.json`
- Create: `tanstack-app/src/components/admin/MembersPdfExportModal.tsx`
- Test: `tanstack-app/src/components/admin/MembersPdfExportModal.test.tsx`
- Modify: `tanstack-app/src/components/admin/MembersListPage.tsx`
- Modify: `tanstack-app/src/components/admin/MembersListPage.test.tsx`

**Interfaces:**
- Modal props:
  - `opened`, `onClose`, `selectedCount`, `progress: { done: number; total: number } | null`, `loading`, `onConfirm: (choice: { source: 'selected' | 'filter'; format: MembersPdfFormat }) => void`

- [ ] **Step 1: Add Paraglide messages**

In `tanstack-app/messages/vi.json`:

```json
"admin_members_export_pdf": "Xuất PDF",
"admin_members_export_pdf_title": "Xuất hồ sơ PDF",
"admin_members_export_pdf_source": "Nguồn",
"admin_members_export_pdf_source_selected": "Các dòng đang chọn",
"admin_members_export_pdf_source_filter": "Tất cả theo bộ lọc hiện tại",
"admin_members_export_pdf_source_selected_disabled": "Chưa chọn dòng nào",
"admin_members_export_pdf_format": "Định dạng",
"admin_members_export_pdf_format_merged": "Một file PDF",
"admin_members_export_pdf_format_zip": "ZIP (mỗi hồ sơ một PDF + giấy tờ đính kèm)",
"admin_members_export_pdf_confirm": "Xuất",
"admin_members_export_pdf_progress": "Đang tạo {done}/{total}…",
"admin_members_export_pdf_empty": "Không có hồ sơ để xuất",
"admin_members_export_pdf_docs_failed": "Thiếu {count} file đính kèm trong ZIP"
```

Run: `cd tanstack-app && pnpm paraglide`

- [ ] **Step 2: Write modal failing tests**

Tests for:

1. Default source = filter when `selectedCount === 0`
2. Default source = selected when `selectedCount > 0`
3. Confirm disabled when selected source + zero selection

Use Mantine `Radio.Group` for accessible labels.

- [ ] **Step 3: Run modal test — expect FAIL**

Run: `cd tanstack-app && pnpm exec vitest run src/components/admin/MembersPdfExportModal.test.tsx`

- [ ] **Step 4: Implement modal + wire list page**

On open: default source `selected` if `selectedCount > 0`, else `filter`; format default `merged_pdf`.

`MembersListPage` mutation:

- `selected`: members from loaded tab items whose id ∈ selection (order = `itemIds` filtered); missing ids → `memberIds` fallback in use-case
- `filter`: `listAll: { sanghaType, orgUnitId: scopedOrgUnitId, status: statusFilter, haLapTabRank: resolvedActiveTab }`
- Progress → state; success closes modal; `failedDocumentCount > 0` → warning; `EMPTY_EXPORT` → empty message

Button beside Xuất Excel opens modal.

- [ ] **Step 5: Extend `MembersListPage.test.tsx`**

Clicking Xuất PDF opens modal (mock export use-case). Follow existing mocks in that file.

- [ ] **Step 6: Run tests**

```bash
cd tanstack-app
pnpm exec vitest run src/components/admin/MembersPdfExportModal.test.tsx src/components/admin/MembersListPage.test.tsx
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add tanstack-app/messages/vi.json tanstack-app/src/paraglide \
  tanstack-app/src/components/admin/MembersPdfExportModal.tsx \
  tanstack-app/src/components/admin/MembersPdfExportModal.test.tsx \
  tanstack-app/src/components/admin/MembersListPage.tsx \
  tanstack-app/src/components/admin/MembersListPage.test.tsx
git commit -m "$(cat <<'EOF'
feat: add admin members list PDF export modal

EOF
)"
```

---

### Task 6: Detail page Xuất PDF

**Files:**
- Modify: `tanstack-app/src/components/admin/MemberFormPage.tsx`
- Modify: `tanstack-app/src/components/admin/MemberFormPage.test.tsx`

**Interfaces:**
- Consumes: `exportMembersPdf`, `memberPdfFilename`, loaded `member.data`, org unit name map

- [ ] **Step 1: Write failing UI test**

Mock `#/use-cases/exportMembersPdf`. Assert edit mode shows `m.admin_members_export_pdf()`; create mode does not. Click calls export with `format: 'merged_pdf'`, `members: [member]`, `filenameOverride: memberPdfFilename(member)`.

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd tanstack-app && pnpm exec vitest run src/components/admin/MemberFormPage.test.tsx`

- [ ] **Step 3: Implement button**

In header actions (edit mode only), default variant button with loading; call:

```typescript
exportMembersPdf({
  members: [member.data],
  format: 'merged_pdf',
  orgUnitNameById,
  filenameOverride: memberPdfFilename(member.data),
})
```

Surface errors with existing alert pattern.

- [ ] **Step 4: Run tests PASS**

```bash
cd tanstack-app && pnpm exec vitest run src/components/admin/MemberFormPage.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/admin/MemberFormPage.tsx \
  tanstack-app/src/components/admin/MemberFormPage.test.tsx
git commit -m "$(cat <<'EOF'
feat: export single member profile PDF from admin detail

EOF
)"
```

---

### Task 7: Verification sweep

**Files:** none new (fix only)

- [ ] **Step 1: Run targeted suites**

```bash
cd tanstack-app
pnpm exec vitest run \
  src/domain/memberPdfNames.test.ts \
  src/domain/memberPdfViewModel.test.ts \
  src/components/admin/pdf/renderMemberPdf.test.ts \
  src/use-cases/exportMembersPdf.test.ts \
  src/components/admin/MembersPdfExportModal.test.tsx \
  src/components/admin/MembersListPage.test.tsx \
  src/components/admin/MemberFormPage.test.tsx
```

Expected: all PASS

- [ ] **Step 2: Manual smoke (optional but recommended)**

`pnpm dev` → admin member detail → Xuất PDF → check Vietnamese text + sections. List → select 2 → ZIP → confirm folders + `documents/`.

- [ ] **Step 3: Commit fixes only if verification required changes**

Message: `fix: member PDF export verification`

---

## Spec coverage self-review

| Spec requirement | Task |
|------------------|------|
| Detail one-click PDF | Task 6 |
| List modal source selected / filter | Task 5 |
| Format merged vs ZIP | Tasks 4–5 |
| Full form fields + portrait | Tasks 2–4 |
| Empty → — | Task 2 |
| ZIP original documents | Task 4 |
| Merged PDF no document bytes | Task 4 |
| Ha-lạp tab in “all by filter” | Tasks 4–5 |
| Excel unchanged | Global + Task 4 |
| Admin only | Admin UI only |
| Fonts Vietnamese | Task 3 |
| Progress done/total | Tasks 4–5 |
| Soft photo/doc failures | Task 4 |
| Vitest only; no Cypress | Tasks 1–6 |
| Deps `@react-pdf/renderer`, `jszip` | Task 1 |

## Placeholder / consistency check

- No TBD; `EMPTY_EXPORT` and message keys named consistently across Tasks 4–6.
- `MembersPdfFormat = 'merged_pdf' | 'zip'` shared by modal and use-case.
- Filename helpers (Task 1) used by Tasks 4 and 6.
- View-model (Task 2) is the only content source for Task 3 render.
