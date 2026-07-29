# Member documents — “Đã đính kèm” list UI

**Date:** 2026-07-29  
**Scope:** Visual/UX polish of the attached-documents list inside `MemberDocumentsField` only.  
**Parent feature:** `docs/superpowers/specs/2026-07-29-member-document-attachments-design.md` (Layout B unchanged)

## Problem

The “Đã đính kèm” block is a flat stack of labels, side links, and action buttons. Hierarchy is weak: document type, sides, and remove/replace are hard to scan on a long member form.

## Goals

- Clear visual grouping per document type
- Compact, scannable rows per side/file (no thumbnails)
- Keep existing Layout B flow and all upload/delete behavior
- Stay within Mantine primitives already used in the app

## Non-goals

- Changing Select / “add new type” UX above the list
- Thumbnails or image preview
- Backend, R2, domain types, or upload/delete use-cases
- New Cypress coverage (update Vitest only if assertions break)

## Design

### Structure

```
Đã đính kèm                    ← existing heading
┌ Paper / Card ──────────────────────────────┐
│ Type label                          [Xóa]  │
│ ─────────────────────────────────────────  │
│ Side label · file name · [Mở] [Thay thế]   │
│ Side label · (chưa có)      · [Chọn tệp]   │
└────────────────────────────────────────────┘
(repeat per attached typeId)
```

### Rules

1. **One card per attached `typeId`** — `Paper` with light border (or equivalent Mantine `Card`), padding consistent with other form fieldsets.
2. **Card header** — document type label (left) + remove button (right: subtle, red, existing loading/`removingTypeId` behavior). Hidden when `disabled`.
3. **Side rows** — one row per side required by the type (`front`/`back` or `file`):
   - **Has file:** side label · display name · open link · replace (`FileButton` + existing handler).
   - **Missing file (edit mode):** side label · muted “(chưa có)” · choose-file button.
   - **Missing file (`disabled`):** omit the row (same as today).
4. **Display name**
   - Pending: `file.name`
   - Uploaded: basename of storage path (last `/` segment)
5. **Open** — existing public URL / object URL; open in new tab. Prefer filename as the clickable link; a separate “Mở” control is optional if space is tight—default: filename is the link, no extra “Mở” button.
6. **Add-new block** (Select + fresh-type slots) — unchanged; out of scope.
7. **Validation / upload errors** — unchanged placement and copy.

### Copy (Paraglide)

| Key | Purpose |
| --- | --- |
| Existing `filler_doc_*` | Keep labels/actions |
| New `filler_doc_missing` (or similar) | Muted empty-side text, e.g. “Chưa có” |

Only add keys that the new empty-side row needs.

### Components

- Prefer refining `MemberDocumentsField.tsx` (small local helpers for card / row ok).
- No new route or shared design-system package.

### Testing

- Update `MemberDocumentsField.test.tsx` if role/text queries change (heading, remove, replace, missing-side label).
- No Cypress.

## Acceptance

- [ ] Each attached type renders as a bordered card with type title + remove
- [ ] Each side is one aligned row with label, name or “Chưa có”, and actions
- [ ] Replace / choose / remove / upload still work for edit + create (pending) modes
- [ ] Disabled/read-only hides edit actions and missing-side upload slots
- [ ] Select / add-new UI above the list is visually unchanged
```
