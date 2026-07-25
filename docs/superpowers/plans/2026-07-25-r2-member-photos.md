# Cloudflare R2 Member Portraits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Firebase Storage with Cloudflare R2 for member portraits: public read, Worker-issued S3 presigned PUT uploads (invite or admin), and admin R2 delete on member hard-delete.

**Architecture:** Add a Worker (`src/worker.ts`) beside SPA Assets. `/api/photos/*` validates invite/admin + member state via Firestore REST, returns a short-lived S3-compatible presigned PUT (aws4fetch + R2 API token secrets), and deletes via the `PHOTOS` R2 binding. Client builds public URLs from `VITE_PHOTOS_PUBLIC_BASE` and stops using Firebase Storage for portraits.

**Tech Stack:** Cloudflare Workers + Assets, R2, aws4fetch, jose (Firebase ID token verify), Vite SPA, Vitest, existing Firestore/Auth

**Spec:** `docs/superpowers/specs/2026-07-25-r2-member-photos-design.md`

## Global Constraints

- Work in the current workspace only — **never** `git worktree add`
- Branch: `feat/r2-member-photos` (from `feat/admin-bulk-delete` so `MemberStore.deleteMany` exists). If bulk-delete already merged to `main`, branch from `main` instead.
- Member portraits only; object key `members/{memberId}/photo.jpg`; no Firebase photo migration; **R2-only display**
- Presigned browser PUT (not proxied upload body); public read via `VITE_PHOTOS_PUBLIC_BASE`
- Prefer Vitest; **no new Cypress**
- Leave unrelated dirty files (`.serena/project.yml`, `firestore-debug.log`) unstaged
- Human must create R2 bucket + public domain + API token before prod works (document in README; code can still land with mocks)

## File Structure

| File | Responsibility |
| --- | --- |
| `tanstack-app/wrangler.jsonc` | `main` Worker, `ASSETS` binding, `r2_buckets` `PHOTOS` |
| `tanstack-app/src/worker.ts` | Fetch router: `/api/*` vs `env.ASSETS.fetch` |
| `tanstack-app/src/worker/env.ts` | `Env` type |
| `tanstack-app/src/worker/firestoreRest.ts` | GET member / invite via Firestore REST |
| `tanstack-app/src/worker/verifyFirebaseAdmin.ts` | Verify Bearer ID token + `admin` claim |
| `tanstack-app/src/worker/presignR2Put.ts` | S3-compatible presigned PUT URL |
| `tanstack-app/src/worker/photosApi.ts` | Route handlers for upload-url + delete |
| `tanstack-app/src/worker/*.test.ts` | Vitest unit tests for handlers/helpers |
| `tanstack-app/src/photos/photosApiClient.ts` | Browser: request upload URL, PUT, delete |
| `tanstack-app/src/use-cases/uploadMemberPhoto.ts` | Use photos client instead of Firebase Storage |
| `tanstack-app/src/components/filler/memberPhotoUrl.ts` | Sync public URL from env |
| `tanstack-app/src/repositories/memberRepo.ts` | Best-effort R2 delete instead of Firebase Storage |
| `tanstack-app/.env.example` | `VITE_PHOTOS_PUBLIC_BASE` |
| `tanstack-app/README.md` | R2 setup + deploy notes |

---

### Task 0: Confirm branch + commit this plan

**Files:**
- Add: `docs/superpowers/plans/2026-07-25-r2-member-photos.md`

**Interfaces:**
- Consumes: design commit on `feat/r2-member-photos`
- Produces: plan committed on the feature branch

- [ ] **Step 1: Confirm branch**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git branch --show-current   # expect feat/r2-member-photos
git merge-base --is-ancestor fb61d02 HEAD && echo "has bulk-delete base"
```

If not on `feat/r2-member-photos`, stop and ask.

- [ ] **Step 2: Commit plan**

```bash
git add docs/superpowers/plans/2026-07-25-r2-member-photos.md
git commit -m "$(cat <<'EOF'
docs: plan for Cloudflare R2 member portraits

EOF
)"
```

---

### Task 1: Wrangler Worker + Assets + R2 binding scaffold

**Files:**
- Modify: `tanstack-app/wrangler.jsonc`
- Create: `tanstack-app/src/worker.ts`
- Create: `tanstack-app/src/worker/env.ts`
- Modify: `tanstack-app/package.json` (add deps in later tasks if needed; this task only scaffold)
- Modify: `tanstack-app/README.md` (short “Worker + R2” note)

**Interfaces:**
- Produces:

```ts
// src/worker/env.ts
export type Env = {
  ASSETS: Fetcher
  PHOTOS: R2Bucket
  R2_ACCOUNT_ID: string
  R2_ACCESS_KEY_ID: string
  R2_SECRET_ACCESS_KEY: string
  R2_BUCKET_NAME: string
  FIREBASE_PROJECT_ID: string
  // optional: VITE_ not available on worker — use worker vars
}
```

Worker returns `{"ok":true}` for `GET /api/health`, else `env.ASSETS.fetch(request)`.

- [ ] **Step 1: Update wrangler.jsonc**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "hephai-khatsi",
  "main": "src/worker.ts",
  "compatibility_date": "2026-07-20",
  "compatibility_flags": ["nodejs_compat"],
  "observability": { "enabled": true },
  "assets": {
    "directory": "dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application"
  },
  "r2_buckets": [
    {
      "binding": "PHOTOS",
      "bucket_name": "member-photos",
      "preview_bucket_name": "member-photos-preview"
    }
  ]
}
```

Bucket names may be adjusted to the real bucket; document in README that `bucket_name` must match the Cloudflare dashboard.

- [ ] **Step 2: Implement minimal worker**

```ts
// src/worker.ts
import type { Env } from './worker/env'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api/health') {
      return Response.json({ ok: true })
    }
    if (url.pathname.startsWith('/api/')) {
      return new Response('Not found', { status: 404 })
    }
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
```

- [ ] **Step 3: Smoke**

```bash
cd tanstack-app && pnpm run build && pnpm exec wrangler deploy --dry-run
```

Expected: config validates (or `wrangler dev` starts). Fix TS path if wrangler cannot resolve.

- [ ] **Step 4: Commit**

```bash
git add tanstack-app/wrangler.jsonc tanstack-app/src/worker.ts tanstack-app/src/worker/env.ts tanstack-app/README.md
git commit -m "$(cat <<'EOF'
feat: add Cloudflare Worker entry with R2 and Assets bindings

EOF
)"
```

---

### Task 2: Firestore REST + Firebase admin JWT helpers

**Files:**
- Create: `tanstack-app/src/worker/firestoreRest.ts`
- Create: `tanstack-app/src/worker/firestoreRest.test.ts`
- Create: `tanstack-app/src/worker/verifyFirebaseAdmin.ts`
- Create: `tanstack-app/src/worker/verifyFirebaseAdmin.test.ts`
- Modify: `tanstack-app/package.json` — add `jose` dependency

**Interfaces:**
- Produces:

```ts
export type WorkerMember = {
  id: string
  orgUnitId: string
  cccd: string
  status: 'draft' | 'locked'
}

export async function getMemberDocument(
  projectId: string,
  memberId: string,
): Promise<WorkerMember | null>

export async function getInviteOrgUnitId(
  projectId: string,
  inviteId: string,
): Promise<string | null>

export async function verifyFirebaseAdminToken(
  idToken: string,
  projectId: string,
): Promise<{ uid: string } | null>
```

Firestore REST (public get):  
`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/members/${memberId}`  
Parse `fields` map to plain values (stringValue / etc.). Same for `invites/{id}` → `orgUnitId`.

Admin verify with `jose`: fetch Google JWKS for `securetoken@system.gserviceaccount.com`, verify `aud` = projectId, `iss` = `https://securetoken.google.com/${projectId}`, require `admin === true` in claims (custom claims appear as `admin` boolean).

- [ ] **Step 1: Add jose**

```bash
cd tanstack-app && pnpm add jose
```

- [ ] **Step 2: Failing tests** — mock `fetch` for Firestore JSON; mock JWKS for admin true/false

- [ ] **Step 3: Implement helpers**

- [ ] **Step 4: Run tests**

```bash
cd tanstack-app && pnpm exec vitest run src/worker/firestoreRest.test.ts src/worker/verifyFirebaseAdmin.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: worker Firestore REST and Firebase admin token verify

EOF
)"
```

---

### Task 3: Presign R2 PUT + photo API routes

**Files:**
- Create: `tanstack-app/src/worker/presignR2Put.ts`
- Create: `tanstack-app/src/worker/presignR2Put.test.ts`
- Create: `tanstack-app/src/worker/photosApi.ts`
- Create: `tanstack-app/src/worker/photosApi.test.ts`
- Modify: `tanstack-app/src/worker.ts` — dispatch to photosApi
- Modify: `tanstack-app/package.json` — add `aws4fetch`

**Interfaces:**
- Consumes: Task 2 helpers, `Env`
- Produces:

```ts
export function memberPhotoKey(memberId: string): string {
  return `members/${memberId}/photo.jpg`
}

export async function createR2PresignedPutUrl(input: {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  key: string
  contentType: string
  expiresSeconds: number // use 300
}): Promise<string>

export async function handlePhotosApi(
  request: Request,
  env: Env,
): Promise<Response>
```

**POST `/api/photos/member-upload-url`**
- Parse JSON `{ memberId, cccd, contentType, inviteToken?: string }`
- `contentType` must match `/^image\//`
- Auth: if `Authorization: Bearer …` → `verifyFirebaseAdminToken`; else require `inviteToken` and `getInviteOrgUnitId` matching member.orgUnitId
- Load member; 404 if missing; 403 if cccd mismatch (normalize digits like client `normalizeCccd`) or locked
- Presign PUT for `memberPhotoKey(memberId)`; return `{ uploadUrl, photoPath }`

**DELETE `/api/photos/member`**
- Admin Bearer only
- JSON `{ memberId }`
- `await env.PHOTOS.delete(memberPhotoKey(memberId))`
- Return `{ ok: true }` even if object missing

Wire in `worker.ts`: if pathname starts with `/api/photos`, `return handlePhotosApi(...)`.

- [ ] **Step 1: pnpm add aws4fetch**

- [ ] **Step 2: Failing tests** for presign URL shape (contains bucket endpoint host) and photosApi auth failures / happy path with mocked deps

- [ ] **Step 3: Implement** using `AwsClient` from `aws4fetch`:

```ts
import { AwsClient } from 'aws4fetch'

const client = new AwsClient({
  accessKeyId,
  secretAccessKey,
  service: 's3',
  region: 'auto',
})
const url = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}?X-Amz-Expires=${expiresSeconds}`
const signed = await client.sign(new Request(url, { method: 'PUT', headers: { 'Content-Type': contentType } }), {
  aws: { signQuery: true },
})
return signed.url
```

(Adjust exact aws4fetch signQuery usage to the library’s current API if the snippet differs — verify against aws4fetch README.)

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: R2 presigned upload-url and admin delete API

EOF
)"
```

---

### Task 4: Client photos API + upload use-case + public URL

**Files:**
- Create: `tanstack-app/src/photos/photosApiClient.ts`
- Create: `tanstack-app/src/photos/photosApiClient.test.ts`
- Modify: `tanstack-app/src/use-cases/uploadMemberPhoto.ts`
- Modify: `tanstack-app/src/use-cases/uploadMemberPhoto.test.ts`
- Modify: `tanstack-app/src/components/filler/memberPhotoUrl.ts`
- Modify: `tanstack-app/src/components/filler/memberPhotoUrl.test.ts`
- Modify: `tanstack-app/.env.example` — add `VITE_PHOTOS_PUBLIC_BASE=`

**Interfaces:**
- Produces:

```ts
// photosApiClient.ts
export async function requestMemberPhotoUploadUrl(input: {
  memberId: string
  cccd: string
  contentType: string
  inviteToken?: string
  idToken?: string // admin
}): Promise<{ uploadUrl: string; photoPath: string }>

export async function putToPresignedUrl(
  uploadUrl: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void>

export async function deleteMemberPhotoObject(input: {
  memberId: string
  idToken: string
}): Promise<void>
```

`requestMemberPhotoUploadUrl` → `POST /api/photos/member-upload-url` (same origin in prod; in Vite dev, either proxy `/api` to wrangler or document using `wrangler dev` as primary). Prefer adding Vite proxy in `vite.config.ts`:

```ts
server: { proxy: { '/api': 'http://127.0.0.1:8787' } }
```

Rewrite `StoragePort` default implementation to: request URL (pass inviteToken) → putToPresignedUrl → (setPhotoPath stays in use-case).

`getMemberPhotoDownloadUrl(photoPath)`:

```ts
export function getMemberPhotoDownloadUrl(photoPath: string): string {
  const base = import.meta.env.VITE_PHOTOS_PUBLIC_BASE
  if (!base) throw new Error('VITE_PHOTOS_PUBLIC_BASE is not configured')
  return `${base.replace(/\/$/, '')}/${photoPath.replace(/^\//, '')}`
}
```

Update callers if they `await` the old Promise API (make sync or keep `async` wrapper returning the string for minimal churn — prefer **sync** and update `MemberPortraitField` accordingly).

- [ ] **Step 1: Failing URL + client tests**

- [ ] **Step 2: Implement client + rewrite upload + URL**

- [ ] **Step 3: Run**

```bash
cd tanstack-app && pnpm exec vitest run src/photos/photosApiClient.test.ts src/use-cases/uploadMemberPhoto.test.ts src/components/filler/memberPhotoUrl.test.ts src/components/filler/MemberPortraitField.test.tsx
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: upload member photos via R2 presigned URLs

EOF
)"
```

---

### Task 5: Wire R2 delete into member hard-delete

**Files:**
- Modify: `tanstack-app/src/repositories/memberRepo.ts` — replace Firebase `deleteObject` best-effort with a injectable photo deleter **or** move best-effort delete to `deleteMembers` use-case
- Modify: `tanstack-app/src/use-cases/deleteMembers.ts` (preferred: after `deleteMany`, loop ids and call `deleteMemberPhotoObject` with admin idToken)

**Preferred design (keep repo free of HTTP):**

```ts
// deleteMembers.ts
export async function deleteMembers(
  input: { ids: string[]; idToken: string },
  memberStore: MemberStore = memberRepo,
  deletePhoto: (memberId: string) => Promise<void> = (id) =>
    deleteMemberPhotoObject({ memberId: id, idToken: input.idToken }),
): Promise<void> {
  await memberStore.deleteMany(input.ids)
  await Promise.allSettled(input.ids.map((id) => deletePhoto(id)))
}
```

Remove Firebase Storage delete from `memberRepo.deleteMany` if present.

Update `MembersListPage` mutation to pass Firebase `currentUser.getIdToken()`.

Update `deleteMembers.test.ts` + list page tests mocks.

- [ ] **Step 1: Failing tests** — deleteMembers calls photo deleter; repo no longer imports firebase/storage

- [ ] **Step 2: Implement**

- [ ] **Step 3: Run**

```bash
cd tanstack-app && pnpm exec vitest run src/use-cases/deleteMembers.test.ts src/repositories/memberDelete.memory.test.ts src/components/admin/MembersListPage.test.tsx
```

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: delete member portraits from R2 on admin bulk delete

EOF
)"
```

---

### Task 6: Docs + stop Firebase Storage portrait usage

**Files:**
- Modify: `tanstack-app/README.md` — R2 bucket setup, secrets, `VITE_PHOTOS_PUBLIC_BASE`, `wrangler secret put`, local `wrangler dev` + vite proxy
- Modify: `tanstack-app/.env.example`
- Modify: `tanstack-app/package.json` `emulator` script — drop `storage` from `--only` if nothing else needs it (`auth,firestore` only)
- Leave `firebase/storage.rules` in place (legacy); do **not** delete rules tests in this task unless they block CI — optional note in README “legacy unused for portraits”

Ops checklist to paste into README:

1. Create R2 bucket `member-photos` (+ preview bucket optional)  
2. Public development URL or custom domain → set `VITE_PHOTOS_PUBLIC_BASE`  
3. Create R2 API token (Object Read & Write) → `wrangler secret put R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`; vars for `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `FIREBASE_PROJECT_ID`  
4. `pnpm deploy` builds Assets + Worker  

- [ ] **Step 1: Update README + env example + emulator script**

- [ ] **Step 2: Commit**

```bash
git commit -m "$(cat <<'EOF'
docs: R2 member photo setup and drop Storage emulator for portraits

EOF
)"
```

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| Worker + Assets + `/api/*` | 1, 3 |
| Presigned PUT upload-url (invite/admin) | 2, 3, 4 |
| Public URL display R2-only | 4 |
| Admin DELETE on member delete | 3, 5 |
| No migration / no Cypress | all |
| Ops checklist documented | 6 |

## Manual gate (human, before prod)

- [ ] Bucket + public base live  
- [ ] Secrets set on Cloudflare  
- [ ] Smoke: filler upload, public `<img>`, admin bulk delete removes object  
