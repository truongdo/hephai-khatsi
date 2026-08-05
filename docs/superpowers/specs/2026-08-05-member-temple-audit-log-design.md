# Member & temple audit log

Date: 2026-08-05  
Status: approved for planning  
Depends on: `2026-07-19-he-phai-khatsi-database-design.md`, `2026-08-04-form-local-draft-lock-edit-request-design.md`  
Surfaces: admin `MemberFormPage` / `TempleFormPage` (“Xem lịch sử” modal); write paths for member & temple mutations (admin + filler)

## Goal

Give **admin** a per-record history of member and temple changes: content updates, lock/unlock, create, edit requests, and photo/document upload/delete — with **full before → after** field diffs, viewed from a modal on the detail form.

## Decisions

| Topic | Choice |
|-------|--------|
| Where to view | Admin detail form only — button **Xem lịch sử** → modal (not global audit screen) |
| Diff depth | Full values before/after (including CCCD, phones, photo paths) — no masking |
| Actions | `created`, `updated`, `locked`, `unlocked`, `edit_requested`, `photo_uploaded`, `photo_deleted`, `document_uploaded`, `document_deleted` |
| Storage | Append-only subcollections `members/{id}/auditLogs/{logId}` and `temples/{id}/auditLogs/{logId}` |
| Write mechanism | Same Firestore transaction as the mutation (use-case / repo); not Cloud Functions |
| Actor | `actorType`: `admin` \| `filler`; `actorId`: admin uid or filler phone (fallback `'filler'`) |
| Empty save | No audit entry when diff is empty |
| Backfill | None — history starts when feature ships |
| Filler UI | No audit viewer for filler |
| Sensitive fields | Store and display full values (admin-only read) |

## Non-goals

- Global / cross-entity audit dashboard or reports
- Cloud Function `onWrite` audit generation
- Embedding history array on the parent document
- Masking or redacting PII in stored logs
- Cascading delete of audit logs when member/temple is deleted (v1)
- Cypress E2E for this feature
- Backfilling historical edits

## Data model

### Document shape (`AuditLogEntry`)

| Field | Type | Meaning |
|-------|------|---------|
| `action` | string enum (see Decisions) | Kind of mutation |
| `at` | string (ISO) | When the change was committed |
| `actorType` | `'admin'` \| `'filler'` | Who initiated |
| `actorId` | string | Admin Firebase uid, filler entry phone, or `'filler'` |
| `changes` | `{ path: string; before: unknown; after: unknown }[]` | Field-level diff; may be empty for metadata-only actions |
| `summary` | string \| null | Optional short label (e.g. changed field count) for list headers |

`path` uses dot notation for nested fields (e.g. `truTriHienNay.dienThoai`, `documents.cccd.front`).

### Diff rules

- Deep-compare profile / media fields between before and after snapshots.
- Always ignore `updatedAt` noise.
- For dedicated lock / unlock / edit-request use-cases, set the matching `action` and include only the relevant status/lock/editRequest fields in `changes` when they differ.
- **Save-and-lock (filler):** one log with `action: created` or `updated` (not a separate `locked` row for the same write); include `status` / `lockedAt` / `lockedBy` in `changes` when they change.
- **Admin lock-only / unlock-only:** `action: locked` or `unlocked`.
- Photo/document use-cases: corresponding media `action` with `changes` on `photoPath` or `documents.*`.

### Paths

```
members/{memberId}/auditLogs/{logId}
temples/{templeId}/auditLogs/{logId}
```

Auto-id documents; order reads by `at` descending.

## Write architecture

### Shared pieces

- `buildAuditChanges(before, after)` — pure deep diff helper (unit-tested).
- `appendAuditLog` / `auditLogRepo` — create log under the parent; accept an optional Firestore `transaction` so it participates in existing `runTransaction` flows.
- Domain type `AuditLogEntry` shared by member and temple.

### Call sites (member + temple equivalents)

| Use-case | `action` |
|----------|----------|
| Filler `saveAndLock*` (create) | `created` |
| Filler `saveAndLock*` (update) | `updated` |
| Admin `saveAdmin*` create / update | `created` / `updated` |
| `lock*` | `locked` |
| `unlock*` | `unlocked` |
| `request*Edit` | `edit_requested` |
| `upload*Photo` / `delete*Photo` | `photo_uploaded` / `photo_deleted` |
| Member document upload / delete | `document_uploaded` / `document_deleted` |

**Actor plumbing:** every audited call site passes `{ actorType, actorId }`. Unlock (and any path that currently omits actor) must be extended to pass the signed-in admin uid. Filler paths use the entry phone when available.

**Atomicity:** parent mutation and audit create succeed or fail together. Missing actor is a programming error — fail the use-case rather than writing a half-complete log.

**Reads:** TanStack Query `queryOptions` with `limit` (~20), `orderBy('at', 'desc')`, cursor pagination; one-shot reads (no realtime). Admin-only via rules.

## Firestore rules

Under each `members/{memberId}` and `temples/{templeId}`:

```
match /auditLogs/{logId} {
  allow read: if canWriteDirectory();
  allow create: if isValidAuditCreate() && (
    canWriteDirectory()
    || (validInviteScope(get(parent).data) && !isKiemSoat())
  );
  allow update, delete: if false;
}
```

- **Read:** directory writers (admin) only — never public/filler list or get.
- **`isValidAuditCreate()`:** requires `action` in the allowed enum, `at` string, `actorType` in `admin`|`filler`, non-empty `actorId` string, `changes` list (may be empty). No other top-level keys required beyond these (+ optional `summary`).
- **Create callers:** admin directory writers, or filler with a valid invite on the parent (same invite model as parent create/update) — so save-and-lock / edit-request / first media can append a log. Filler still cannot **read** audit logs.
- **Update/delete:** denied (append-only).

## Admin UI

- On `MemberFormPage` and `TempleFormPage`, when editing an existing record, show **Xem lịch sử**.
- Opens a Mantine `Modal` titled e.g. “Lịch sử thay đổi”, with record identity in the subtitle.
- Newest first. Each entry: timestamp, actor label (`Admin` / `Filler` + `actorId`), i18n action label, then lines `path: before → after` (stringify objects/arrays).
- Empty `changes`: show action label only.
- Empty list: “Chưa có lịch sử.”
- **Tải thêm** for next page.
- Filler editors: no history control.

## Error & edge cases

| Case | Handling |
|------|----------|
| Transaction fails | No parent change and no orphan log |
| Save with no field changes | Skip audit write |
| Modal fetch denied / errors | Show error inside modal; form remains usable |
| Large nested values in `changes` | Store as-is; UI wraps / monospace stringify |
| Delete member/temple | Audit subcollection may remain; no admin UI after delete; cleanup out of scope v1 |
| Pre-feature data | Empty history is expected |

## Testing

| Layer | Coverage |
|-------|----------|
| Unit | `buildAuditChanges` — nested paths, ignore `updatedAt`, null↔value, empty diff |
| Use-case / memory store | Each audited action writes correct `action`, `actor*`, and `changes` |
| Rules integration | Admin can read; filler/public cannot; create allowed on valid path; update/delete denied |
| Component (Vitest) | History button opens modal; list + empty + load-more with mocked query |

No new Cypress specs.

## Out of scope follow-ups

- Cascade delete of `auditLogs` on parent delete
- Global audit browser / export
- Server-triggered audit backstop (Cloud Functions)
- Field-level redaction or retention TTL
