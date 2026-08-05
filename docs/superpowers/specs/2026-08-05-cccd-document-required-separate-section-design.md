# CCCD document: dedicated required section

Date: 2026-08-05  
Status: approved for planning  
Depends on: `2026-07-29-member-document-attachments-design.md`, `2026-07-29-member-documents-attached-list-ui-design.md`, `2026-08-05-member-form-required-fields-date-format-design.md`  
Surfaces: filler `MemberEditorForm` **Lưu** and admin `MemberFormPage` **Hoàn thành** (shared `MemberDocumentsField` + `validateMemberRequiredFields`)

## Goal

In **Giấy tờ đính kèm**, surface **Căn cước công dân** as its own always-visible block and require **both** front and back before validated save. Other document types stay optional via the existing Select flow.

## Decisions

| Topic | Choice |
|-------|--------|
| Approach | Dedicated CCCD block inside `MemberDocumentsField` (not a separate component) |
| Required sides | Both `front` and `back` (path uploaded **or** pending `File`) |
| Surfaces | Admin member form and filler member form |
| Remove CCCD | Not allowed — only per-side replace |
| Other types | Unchanged (Select + “Đã đính kèm” cards with Xóa) |
| Storage / API | Unchanged (`documents.cccd.frontPath` / `backPath`, existing upload/delete use-cases) |

## Non-goals

- Changing Firestore schema, R2 keys, or worker docs API
- Requiring any other document type
- Allowing delete of the whole CCCD type from the UI
- Cypress coverage (Vitest only)
- Server-side / security-rules enforcement of “CCCD required”

## UI design

Inside `MemberDocumentsField`, order:

1. **Căn cước công dân** — always rendered (label + `required` marker)
   - Two side rows: mặt trước / mặt sau
   - Empty: “Chưa có” + Chọn tệp
   - Present: filename link + Thay thế
   - No **Xóa** button for this type
2. **Loại giấy tờ** Select — options exclude `cccd` (and already-attached optional types, as today)
3. **Đã đính kèm** — optional types only (CCCD must not appear again here)

Reuse existing upload/pending/replace handlers; do not invent a second upload path.

## Validation design

Extend `validateMemberRequiredFields` / `MemberRequiredDraft` / `MemberRequiredFieldErrors`:

```ts
// conceptual additions
type MemberRequiredDraft = {
  // …existing…
  documents: MemberDocuments
  pendingDocuments: PendingDocumentFiles
}

type MemberRequiredFieldErrors = {
  // …existing…
  cccdDocument?: 'REQUIRED'
}
```

Rule: invalid unless both sides are satisfied:

- front: `documents.cccd?.frontPath` **or** `pendingDocuments.cccd?.front`
- back: `documents.cccd?.backPath` **or** `pendingDocuments.cccd?.back`

Call sites (`MemberEditorForm.handleSave`, `MemberFormPage.complete`) pass `api.getDocuments()` and `api.getPendingDocuments()` into the validator.

UI: pass the error into `MemberDocumentsField` (new optional `error` prop) and show it under the CCCD block, using the same required-message pattern as portrait (`filler_error_field_required` or equivalent).

## Testing

| Area | Expectation |
|------|-------------|
| `MemberDocumentsField` | CCCD block always visible; `cccd` absent from Select; no remove for CCCD; optional types unchanged |
| `memberRequiredValidation` | Missing front and/or back → `cccdDocument: 'REQUIRED'`; both present (path or pending) → valid |
| Admin / filler form tests | Update flows that previously picked CCCD from Select; assert save blocked without both sides if covered |

No new Cypress specs.

## Out of scope follow-ups

- Backend rule that rejects lock/save without CCCD docs
- Migrating members who already locked without CCCD images
