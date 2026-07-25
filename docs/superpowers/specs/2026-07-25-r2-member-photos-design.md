# Cloudflare R2 for member portraits

Date: 2026-07-25  
Status: approved for planning  
Depends on: `2026-07-23-member-portrait-and-family-phone-design.md`, `2026-07-19-he-phai-khatsi-database-design.md`

## Goal

Replace **Firebase Storage** with **Cloudflare R2** for member 3×4 portraits: public read, browser upload via **presigned PUT**, Worker-authorized checks (invite or admin), and admin delete on member hard-delete.

## Decisions

| Topic | Choice |
|-------|--------|
| Scope | Member portraits only (replace Firebase Storage for this use) |
| Upload | Presigned PUT after Worker auth (not proxied body upload) |
| Read | Public via R2 custom domain / public URL base |
| Old Firebase objects | No migration; **R2-only display** (blank until re-upload) |
| Object key | Keep `members/{memberId}/photo.jpg` (`photoPath` unchanged) |
| App shape | Static SPA today → add a **Worker** for `/api/*` beside Assets |

## Non-goals

- Temple / land-certificate / QĐ file uploads
- Migrating existing Firebase Storage objects
- Dual-read (Firebase download URL fallback)
- Changing Firestore `photoPath` semantics beyond the storage backend
- Cypress (Vitest + Worker unit tests)

## Why a Worker

`wrangler.jsonc` currently serves **Assets only** (SPA). R2 bindings and trusted auth checks cannot run in the browser. This work adds a Worker entry that:

- Handles `/api/*`
- Falls through / serves SPA assets for all other routes (same deploy as today)

## Architecture

```
Browser                    Worker                         R2
  |                          |                             |
  | POST /api/photos/        |                             |
  |   member-upload-url      |-- validate invite/admin --> |
  |   { memberId, cccd,      |-- load member (Firestore) ->|
  |     contentType }        |                             |
  |<-- { uploadUrl,          |                             |
  |      photoPath } --------|                             |
  |                          |                             |
  | PUT uploadUrl (bytes) ---|---------------------------> |
  |                          |                             |
  | setPhotoPath (Firestore)|                             |
  |                          |                             |
  | GET ${PUBLIC_BASE}/path -|---------------------------> |
```

Admin member delete (after Firestore delete):

```
Browser/admin mutation → DELETE /api/photos/member { memberId }
                      → Worker (admin token) → R2 delete object
```

## Object layout & URLs

- Key: `members/{memberId}/photo.jpg` (same as today)
- Public URL: `${VITE_PHOTOS_PUBLIC_BASE}/${photoPath}`  
  Example: `https://media.example.com/members/gd-i_tang_001/photo.jpg`
- `getMemberPhotoDownloadUrl(photoPath)` becomes a sync string join (no Firebase `getDownloadURL`)

## Worker API

### `POST /api/photos/member-upload-url`

**Auth (one of):**

1. **Filler:** body/header includes invite token; Worker loads `invites/{token}`, verifies invite exists and `orgUnitId` matches the member’s `orgUnitId` (same intent as current Storage rules).
2. **Admin:** `Authorization: Bearer <Firebase ID token>` with `admin: true` claim (verify via Firebase Auth REST / JWKS on Worker).

**Body:** `{ memberId: string, cccd: string, contentType: string }`

**Checks:** member exists; normalized CCCD matches; `status !== 'locked'`; `contentType` matches `image/*`; size limit enforced on presign (Content-Length max **5MB**) where the S3 presign API allows, and/or documented client-side + Worker rejection of oversized intent.

**Response:** `{ uploadUrl: string, photoPath: string, headers?: Record<string, string> }`  
Presign TTL: short (e.g. **5 minutes**). Method: `PUT`.

**Then client:** `fetch(uploadUrl, { method: 'PUT', body: bytes, headers: { 'Content-Type': contentType, ... } })` → existing `memberRepo.setPhotoPath(memberId, photoPath)`.

### `DELETE /api/photos/member`

**Auth:** admin ID token only.

**Body or query:** `{ memberId: string }`

**Behavior:** delete R2 key `members/{memberId}/photo.jpg`; succeed if already missing (idempotent). Used from member `deleteMany` / bulk-delete best-effort path (replace Firebase `deleteObject`).

## R2 credentials & binding

| Mechanism | Use |
|-----------|-----|
| Wrangler `r2_buckets` binding (e.g. `PHOTOS`) | Preferred for **server-side delete** (and optional server put in tests) |
| S3-compatible API token (account ID + access key + secret) as **Wrangler secrets** | **Presigned PUT** for the browser (bindings alone do not mint browser PUT URLs) |

Secrets (names illustrative): `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` (if not only from binding).  
Public base for the client: `VITE_PHOTOS_PUBLIC_BASE`.

## Client changes

| Area | Change |
|------|--------|
| `uploadMemberPhoto` | Request upload URL from Worker, PUT to R2, then `setPhotoPath`; keep `StoragePort`-style seam for tests |
| `memberPhotoUrl.ts` | Build public URL from env + `photoPath` |
| Member delete cleanup | Call Worker DELETE instead of Firebase Storage |
| `getClientStorage` / Firebase Storage for photos | Stop using for portraits; remove from upload/display paths |
| Emulator script | Storage emulator no longer required for portrait flows (Auth/Firestore remain) |

## Firebase Storage

- Stop writing/reading portraits via the client SDK.
- `firebase/storage.rules`: leave as legacy unused for this feature, or a follow-up cleanup PR to remove portrait rules / emulator tests — **not required** for R2 cutover.
- No data migration job.

## Local development

- Prefer `wrangler dev` (or vite + wrangler) so `/api/*` and R2 (local simulator) work.
- Vitest: mock Worker/photo port; do not require live R2 for unit tests.
- Document one-time Cloudflare dashboard steps: create bucket, public domain, API token, `wrangler secret put`, set `VITE_PHOTOS_PUBLIC_BASE`.

## Testing

- Unit: upload use-case with mocked presign + PUT; public URL helper; delete photo helper.
- Worker handler tests: reject locked member, bad CCCD, missing invite, non-admin delete; happy path returns URL shape.
- Update existing portrait / member-delete tests that assumed Firebase Storage.
- **No Cypress** for this cutover.

## Implementation sketch

1. Cloudflare bucket + public base + secrets (manual / docs in plan).
2. Wrangler: Worker entry + R2 binding + asset routing for `/api/*`.
3. Worker routes: upload-url + delete; Firestore + Auth verification helpers.
4. Client: upload + URL helper + delete wiring; drop Firebase Storage portrait usage.
5. Tests + README deploy/dev notes.

## Open ops checklist (human)

- [ ] Create R2 bucket  
- [ ] Attach public custom domain (or enable public r2.dev URL)  
- [ ] Create R2 API token (Object Read & Write)  
- [ ] Set Wrangler secrets + `VITE_PHOTOS_PUBLIC_BASE` for preview/prod  
- [ ] Deploy Worker+Assets; confirm PUT + public GET + admin DELETE  
