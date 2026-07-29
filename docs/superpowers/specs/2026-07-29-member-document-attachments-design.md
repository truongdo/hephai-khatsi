# Member document attachments (giấy tờ)

Date: 2026-07-29  
Status: draft for review  
Depends on: `2026-07-25-r2-member-photos-design.md`, `2026-07-25-admin-member-full-form-design.md`, `2026-07-19-he-phai-khatsi-database-design.md`

## Goal

Add an optional **Giấy tờ đính kèm** section below **Nguyện vọng** on the shared member form (filler invite + admin create/edit). Users pick a document type from a dropdown and upload the matching file(s). The type list is **config-driven** so new types are one registry entry + i18n string.

## Decisions

| Topic | Choice |
|-------|--------|
| Required? | All optional — save / complete never blocked by missing docs |
| Surfaces | Filler + admin (shared `MemberFormFields`) |
| Front/back | Same type, two slots (`front` / `back`) when registry says so |
| File types | JPEG, PNG, PDF |
| Per type | At most one entry per `typeId` (dropdown hides already-added types) |
| Data shape | Config registry + `documents` map on the `members` Firestore doc |
| Storage | Cloudflare R2 (same bucket / public base as portraits) |
| UI layout | **B** — select type → upload slots appear immediately; “Đã đính kèm” list below |

## Non-goals

- OCR / verification of document content
- Required-document validation on complete
- Version history / multiple files of the same type
- Temple (or other entity) document uploads
- Cypress (Vitest + Worker unit tests only)
- Migrating any legacy Firebase Storage objects

## Document type registry

Source of truth: `memberDocumentTypes.ts` (or equivalent under `src/domain/`).

Each entry:

```ts
{
  id: DocumentTypeId
  labelMessage: () => string  // Paraglide
  sides: 'frontBack' | 'single'
}
```

Initial types:

| id | sides | Label (VI) |
|----|--------|------------|
| `cccd` | frontBack | Căn cước công dân |
| `chung_nhan_tang_ni` | frontBack | Giấy chứng nhận Tăng-Ni |
| `diep_sa_di` | single | Giấy chứng điệp Thọ Sa-di/Sa-di-ni |
| `diep_thuc_xoa` | single | Giấy chứng điệp Thọ Thức-xoa-ma-na |
| `diep_ty_kheo` | single | Giấy chứng điệp Thọ Tỳ-kheo/Tỳ-kheo-ni |
| `qd_tru_tri` | single | Quyết định Bổ nhiệm Trụ trì (nếu có) |
| `qd_giao_pham` | single | Quyết định tấn phong giáo phẩm |
| `qd_chuc_vu_gh` | single | Quyết định bổ nhiệm chức vụ Giáo hội |

**Extending later:** append one registry row + Paraglide message. No form schema changes.

## Firestore model

On `Member`:

```ts
documents?: Partial<
  Record<
    DocumentTypeId,
    {
      frontPath?: string  // sides === 'frontBack'
      backPath?: string
      filePath?: string    // sides === 'single'
    }
  >
>
```

- Omit empty types; clear a type by deleting its key (and R2 objects).
- Paths are R2 object keys (same convention as `photoPath`).
- Draft / patch helpers include `documents` in `buildMemberPatch` / member converters.

## R2 object layout

```
members/{memberId}/docs/{typeId}/front.{ext}
members/{memberId}/docs/{typeId}/back.{ext}
members/{memberId}/docs/{typeId}/file.{ext}
```

`ext` from content type: `jpg` | `png` | `pdf`. Public URL: `${VITE_PHOTOS_PUBLIC_BASE}/{path}` (reuse portrait public base).

On member hard-delete: delete portrait **and** all objects under `members/{memberId}/docs/` (prefix delete or list+delete).

## Worker API

Mirror portrait auth (invite token **or** admin Bearer with admin claim); reject when member `status === 'locked'` for filler (admin may upload when editing locked — same policy as portrait if already allowed).

### `POST /api/docs/member-upload-url`

**Body:** `{ memberId, cccd, typeId, side: 'front' | 'back' | 'file', contentType }`

**Checks:** member exists; CCCD matches; `typeId` in registry; `side` matches registry `sides`; `contentType` ∈ `image/jpeg` | `image/png` | `application/pdf`; size intent ≤ **10MB**.

**Response:** `{ uploadUrl, filePath, headers? }` — client `PUT`s bytes, then updates Firestore `documents[typeId][sidePathField]`.

### `DELETE /api/docs/member`

**Auth:** admin (and filler with invite when unlocked, if portrait delete allows filler — keep consistent with portrait delete policy).

**Body:** `{ memberId, typeId, side? }` — if `side` omitted, delete all sides for that type and clear the map entry; if `side` set, delete one object and clear that path field.

## UI

Section title: **Giấy tờ đính kèm** (or equivalent Paraglide key), placed **after** Nguyện vọng in `MemberFormFields`.

1. **Select** — only types **not** yet present in `documents` / pending local state (used types are hidden).
2. **Upload slots** — appear for the currently selected type:
   - `frontBack` → two file inputs labeled Mặt trước / Mặt sau
   - `single` → one file input
   Choosing a file for a new type adds it to “Đã đính kèm” and clears the select (or advances to next unused type).
3. **Đã đính kèm** — list of types that have at least one path (or pending file): label, preview/link, **replace** file(s), **remove** type. Replace/remove happen only here — not by re-picking the type in the dropdown.

**Create without `memberId`:** hold pending `File`s in component state keyed by `typeId`+`side`; after first successful save creates the member, upload all pending (same pattern as portrait `pendingPhoto`).

**Edit / filler with id:** upload immediately on file choose (like portrait).

Accept attribute: `image/jpeg,image/png,application/pdf`.

## Components & layering

```
domain/memberDocumentTypes.ts     # registry + DocumentTypeId
MemberDocumentsField.tsx          # section UI (Select + slots + list)
uploadMemberDocument.ts           # use-case (Worker + PUT + repo patch)
worker: docs endpoints            # beside photosApi
memberRepo / Member type          # documents field
memberDraft                       # load/save documents
```

Repositories own Firestore updates; Worker owns R2 presign/delete. UI does not call R2 SDK directly.

## Error handling

- Upload failure → inline error message (reuse / extend filler photo error pattern).
- Invalid content type or oversize → client reject before request; Worker rejects on intent mismatch.
- Locked member (filler) → Worker 403; UI shows existing locked messaging where applicable.

## Testing

- Unit: registry side validation; draft ↔ `documents` mapping; `MemberDocumentsField` select/hide-used-types / pending state (Vitest + Testing Library).
- Use-case: upload updates correct path field; delete clears side/type.
- Worker: auth, contentType, side vs registry, locked member.
- No new Cypress journey unless a later smoke needs it.

## Out of scope follow-ups

- Admin-only bulk download / zip of all docs
- Per-type required rules by sangha type
- Private (non-public) R2 objects with signed GET
