# Typesense admin command-palette search

**Date:** 2026-08-17  
**Host:** Typesense at `https://typesense.giasuai.io`  
**UI:** Admin shell command palette (⌘K / Ctrl+K)  
**Primary surfaces:** `AdminShell`, Cloudflare Worker `/api/search*`, member/temple save & delete paths

## Goal

Give directory admins a global command-palette search over **members** and **temples** (pháp danh / thế danh / CCCD / phones / temple name / trụ trì) so they can jump to detail pages without paging lists. Results respect the same org scope as admin lists. Firestore stays source of truth; Typesense is a derived index kept near-realtime via write-path sync, with a manual rebuild for recovery.

## Non-goals

- Public / filler-facing search
- Retreats (Khóa tu) in the index
- Accent folding / Vietnamese diacritic normalization (v1 uses stored text as-is)
- Client-held Typesense API keys or scoped search-only keys
- Scheduled/cron reindex
- “Recent searches” history
- Replacing admin list filters/pagination with Typesense
- Cypress E2E for the palette (Vitest only in v1)

## Decisions

| Topic | Choice |
| --- | --- |
| UX | Admin command palette (Spotlight-style), not list-page text filters |
| Entities | Members + temples only |
| Scope | Same as lists: hệ phái sees all; giáo đoàn filtered by `orgUnitId` |
| Search fields | Names + CCCD + phones (member phone; temple `managerPhones` + trụ trì) |
| Typesense host | Existing `https://typesense.giasuai.io` |
| Sync | Write-path upsert/delete + manual rebuild |
| Status | Index both `draft` and `locked` |
| Matching | Exact-ish on stored strings; improve accent folding later |
| Search path | Worker proxy with admin key in secrets |
| Collections | Two Typesense collections: `members`, `temples` (multi-search) |
| Rebuild trigger | `he_phai_admin`-only button on `/admin/org-units` (not secretary) |

## Architecture

```
Admin UI (Spotlight / ⌘K)
        │  Bearer Firebase ID token + query
        ▼
Cloudflare Worker  /api/search  (+ upsert, delete, reindex)
        │  verify token → claims → filter_by org scope
        ▼
Typesense  https://typesense.giasuai.io
        ▲
After Firestore save/delete (browser use-cases)
        │  fire-and-forget upsert/delete via worker
        │  (admin Bearer or valid invite token for filler upserts)
        └── Rebuild: /admin/org-units → POST /api/search/reindex
```

**Rules**

- Firestore is source of truth; Typesense is derived.
- Admin API key only in worker secrets (`TYPESENSE_API_KEY` + host/URL).
- Search allowed only when `canManageDirectory(claims)`.
- Giáo đoàn: Typesense `filter_by` includes `orgUnitId:=<claim.orgUnitId>`. Hệ phái: no org filter.
- Typesense failures must not fail user saves (best-effort index; rebuild repairs drift).

## Typesense schema

Lean docs only — enough to search and render a palette row. Detail pages still load from Firestore.

### Collection `members`

| Field | Type | Role |
| --- | --- | --- |
| `id` | string | = Firestore member id |
| `orgUnitId` | string | filter / scope |
| `sanghaType` | string (`tang` \| `ni`) | display |
| `status` | string (`draft` \| `locked`) | display |
| `phapDanh` | string | search |
| `theDanh` | string | search |
| `cccd` | string | search |
| `dienThoai` | string | search (digits-only) |
| `updatedAt` | int64 | sort tie-break |

**Query-by:** `phapDanh, theDanh, cccd, dienThoai`

### Collection `temples`

| Field | Type | Role |
| --- | --- | --- |
| `id` | string | = Firestore temple id |
| `orgUnitId` | string | filter |
| `status` | string | display |
| `danhHieu` | string | search |
| `truTriPhapDanh` | string | search (`truTriHienNay.phapDanh`) |
| `phones` | string[] | search (`managerPhones` + trụ trì phone, digits) |
| `updatedAt` | int64 | sort |

**Query-by:** `danhHieu, truTriPhapDanh, phones`

### Mapping

- Shared pure helpers: `toMemberSearchDoc(member)`, `toTempleSearchDoc(temple)`.
- Phones normalized digits-only (same rules as resume-by-phone).
- Optional missing fields → empty string / empty array.
- Do not index family phones, addresses, or full form blobs.

## Admin UI

**Placement:** `AdminShell` for signed-in admins with `canManageDirectory`.

**Open:** ⌘K / Ctrl+K; optional header search control for mobile discoverability.

**Component:** Mantine Spotlight (or equivalent Mantine 9 command overlay).

**Results**

- Groups: Thành viên / Tịnh xá (~5–8 each; soft total ~15).
- Member row: pháp danh (fallback thế danh), thế danh, CCCD (may truncate), status, giáo đoàn name from existing `orgUnits` cache when available.
- Temple row: danh hiệu, trụ trì pháp danh, status.
- Empty query: hint only (no recent list in v1).
- Empty results: short “Không tìm thấy”.

**Select:** Navigate to `/admin/members/$id` or `/admin/temples/$id`; close palette.

**Debounce:** ~200–300ms; abort in-flight requests on new input.

## Sync

### Write-path

Firestore writes run in the browser (use-cases → repos). After successful create/update/delete:

1. Map returned entity → lean search doc.
2. Fire-and-forget worker call: upsert or delete.
3. Never fail the user mutation if Typesense errors; log server-side.

**Upsert auth:** directory admin (Bearer) **or** valid public invite token (filler drafts must appear without waiting for rebuild).  
**Delete auth:** directory admin only (bulk delete).

**Hook points:** admin and filler mutations that create/update/delete members or temples (draft save, lock save, field-changing updates, bulk delete). Prefer a small `searchIndexClient` from mutation `onSuccess` (or injectable indexer) so paths stay consistent.

**Org reassignment:** upsert same id with new `orgUnitId`.

### Rebuild

- **Trigger:** `he_phai_admin`-only button on `/admin/org-units` → confirm → `POST /api/search/reindex` → toast with counts. Secretaries and giáo đoàn admins do not see or call rebuild.
- **Also:** same endpoint callable manually (e.g. curl) for first backfill after deploy.
- **Behavior:** ensure collections/schema; page Firestore via existing Admin REST patterns; import by id (idempotent); return imported counts.
- **Not in v1:** cron/scheduled reindex.

## Worker APIs

| Endpoint | Auth | Behavior |
| --- | --- | --- |
| `POST /api/search` | `canManageDirectory` | Multi-search `members` + `temples`; apply org `filter_by` for giáo đoàn; return grouped hits |
| `POST /api/search/upsert` | directory admin or invite | Upsert one member or temple doc |
| `POST /api/search/delete` | directory admin | Delete by collection + id |
| `POST /api/search/reindex` | `he_phai_admin` (same gate as directory-role grants) | Ensure schema; full Firestore → Typesense import; return counts |

Wire handlers from `tanstack-app/src/worker.ts` alongside existing `/api/photos`, `/api/docs`, `/api/admin/directory-role`.

## Errors

- Typesense unavailable: palette shows a short error; saves still succeed.
- Empty / whitespace query: no Typesense call.
- Reindex: confirm dialog; prevent double-submit; toast success/failure with counts.

## Testing

- **Vitest:** search doc mappers; worker handlers (auth, scope `filter_by`, upsert/delete validation) with mocked Typesense HTTP; palette open/navigate with mocked search client; org-units rebuild button gated to `he_phai_admin`.
- **No new Cypress** for v1.

## Out of scope / follow-ups

- Accent folding for Vietnamese names
- Indexing retreats
- List-page Typesense-backed filters
- Scoped client search keys
- Scheduled reindex
