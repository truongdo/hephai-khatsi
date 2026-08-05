# Thư ký giáo đoàn Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Hệ phái admin grant/revoke `giao_doan_admin` (UI: Thư ký giáo đoàn) on a member with `@gmail.com`, set Auth custom claims via Worker, show secretaries on `/admin/org-units`, and org-scope member/temple access like retreats.

**Architecture:** Reuse claim `role: 'giao_doan_admin'` + `orgUnitId`. Worker grant/revoke APIs use a Firebase service account (Identity Toolkit + Firestore REST). Member docs store `directoryRole*` for UI/query. Harden Firestore rules + list/form UI so `giao_doan_admin` only manages their org.

**Tech Stack:** TanStack Start/React/Mantine, Firebase Auth custom claims, Cloudflare Worker + `jose`, Firestore rules, Vitest

**Spec:** `docs/superpowers/specs/2026-08-05-thu-ky-giao-doan-design.md`

## Global Constraints

- Work in the current workspace only — **never** `git worktree add`
- Create and use a feature branch from `main` (e.g. `feat/thu-ky-giao-doan`); if already on another branch with WIP, stop and ask
- Role string stays `giao_doan_admin`; UI copy = “Thư ký giáo đoàn”
- Only `he_phai_admin` (incl. legacy `admin: true`) may grant/revoke
- Email must end with `@gmail.com` (normalize lowercase)
- Many secretaries per org allowed; one active Thư ký email across members
- Prefer Vitest; **no new Cypress**
- After merge squash into `main`, delete the local feature branch unless asked otherwise

## File Structure

| File | Responsibility |
| --- | --- |
| `docs/superpowers/specs/2026-08-05-thu-ky-giao-doan-design.md` | Spec (already on `main`) |
| `docs/superpowers/plans/2026-08-05-thu-ky-giao-doan.md` | This plan |
| `tanstack-app/src/domain/authClaims.ts` | `canGrantDirectoryRole` |
| `tanstack-app/src/domain/gmail.ts` | `isGmailEmail` / `normalizeEmail` |
| `tanstack-app/src/domain/types.ts` | `directoryRole*` on `Member` |
| `firebase/firestore.rules` | Org-scoped directory + he_phai-only orgUnits write + freeze `directoryRole*` on client updates |
| `tanstack-app/src/worker/env.ts` | `FIREBASE_SERVICE_ACCOUNT_JSON` |
| `tanstack-app/src/worker/googleServiceAccount.ts` | OAuth access token from SA JSON |
| `tanstack-app/src/worker/identityToolkit.ts` | Lookup/create user + set/clear custom claims |
| `tanstack-app/src/worker/firestoreAdminRest.ts` | Authenticated get/patch/runQuery for members |
| `tanstack-app/src/worker/verifyFirebaseAdmin.ts` | Return role; `verifyHePhaiAdminToken` |
| `tanstack-app/src/worker/directoryRoleApi.ts` | Grant/revoke handlers |
| `tanstack-app/src/worker.ts` | Route `/api/admin/directory-role/*` |
| `tanstack-app/src/directoryRole/directoryRoleApiClient.ts` | Browser client for grant/revoke |
| `tanstack-app/src/repositories/memberRepo.ts` | `listDirectorySecretaries` |
| `tanstack-app/src/query/adminQueries.ts` | `directorySecretariesQuery` |
| `tanstack-app/src/components/admin/OrgUnitsPage.tsx` | Secretaries column + modal |
| `tanstack-app/src/components/admin/OrgUnitSecretariesModal.tsx` | Modal list + revoke |
| `tanstack-app/src/components/admin/MemberFormPage.tsx` | Grant/revoke actions + badge |
| `tanstack-app/src/components/admin/MembersListPage.tsx` | Lock org filter for `giao_doan_admin` |
| `tanstack-app/src/components/admin/TemplesListPage.tsx` | Same |
| `tanstack-app/src/components/admin/MemberFormPage.tsx` / `TempleFormPage.tsx` | Lock org picker on create |
| `tanstack-app/src/use-cases/saveAdminMember.ts` (+ temple/delete siblings) | `canAccessOrgUnit` + block email/org change while secretary |
| `tanstack-app/messages/vi.json` (+ en if present) | i18n keys |
| Rules/integration + unit/UI tests colocated with above |

---

### Task 0: Branch from main + commit plan

**Files:**
- Add: `docs/superpowers/plans/2026-08-05-thu-ky-giao-doan.md`

**Interfaces:**
- Consumes: clean-enough `main` (spec commit present)
- Produces: branch `feat/thu-ky-giao-doan` with this plan committed

- [ ] **Step 1: Confirm branch situation**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git branch --show-current
git status -sb
```

If not on `main` / `master`: **stop and ask** whether to stash/commit WIP and branch from `main`, or continue on current branch.

- [ ] **Step 2: Create feature branch from main**

```bash
git checkout main
git pull
git checkout -b feat/thu-ky-giao-doan
```

- [ ] **Step 3: Ensure plan file exists and commit**

```bash
git add docs/superpowers/plans/2026-08-05-thu-ky-giao-doan.md
git commit -m "$(cat <<'EOF'
docs: plan Thư ký giáo đoàn grant/revoke and org scoping

EOF
)"
```

If the plan is already committed on `main`, skip empty commit; still create the feature branch.

---

### Task 1: Domain — Gmail helper + grant capability + Member fields

**Files:**
- Create: `tanstack-app/src/domain/gmail.ts`
- Create: `tanstack-app/src/domain/gmail.test.ts`
- Modify: `tanstack-app/src/domain/authClaims.ts`
- Modify: `tanstack-app/src/domain/authClaims.test.ts`
- Modify: `tanstack-app/src/domain/types.ts` (`Member`)

**Interfaces:**
- Produces:
  - `normalizeEmail(email: string): string` — trim + lowercase
  - `isGmailEmail(email: string | null | undefined): boolean` — true iff normalized ends with `@gmail.com` and local-part non-empty
  - `canGrantDirectoryRole(claims: AuthClaims): boolean` — `claims.role === 'he_phai_admin'`
  - `Member.directoryRole?: 'giao_doan_admin'`
  - `Member.directoryAuthUid?: string`
  - `Member.directoryRoleGrantedAt?: string`
  - `Member.directoryRoleGrantedBy?: string`

- [ ] **Step 1: Write failing tests**

`gmail.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isGmailEmail, normalizeEmail } from './gmail'

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Foo.Bar@Gmail.COM ')).toBe('foo.bar@gmail.com')
  })
})

describe('isGmailEmail', () => {
  it('accepts @gmail.com', () => {
    expect(isGmailEmail('a@gmail.com')).toBe(true)
    expect(isGmailEmail('A@Gmail.Com')).toBe(true)
  })
  it('rejects other domains and empty', () => {
    expect(isGmailEmail('a@googlemail.com')).toBe(false)
    expect(isGmailEmail('a@hephai.org')).toBe(false)
    expect(isGmailEmail('')).toBe(false)
    expect(isGmailEmail(undefined)).toBe(false)
    expect(isGmailEmail('@gmail.com')).toBe(false)
  })
})
```

In `authClaims.test.ts` add:

```ts
import { canGrantDirectoryRole } from './authClaims'

describe('canGrantDirectoryRole', () => {
  it('allows only he_phai_admin', () => {
    expect(
      canGrantDirectoryRole({ role: 'he_phai_admin', orgUnitId: null }),
    ).toBe(true)
    expect(
      canGrantDirectoryRole({ role: 'giao_doan_admin', orgUnitId: 'gd-i' }),
    ).toBe(false)
    expect(
      canGrantDirectoryRole({ role: 'kiem_soat', orgUnitId: 'gd-i' }),
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd tanstack-app && pnpm exec vitest run src/domain/gmail.test.ts src/domain/authClaims.test.ts
```

Expected: FAIL (modules/exports missing)

- [ ] **Step 3: Implement**

`gmail.ts`:

```ts
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isGmailEmail(email: string | null | undefined): boolean {
  if (email == null) return false
  const normalized = normalizeEmail(email)
  const at = normalized.lastIndexOf('@')
  if (at <= 0) return false
  return normalized.slice(at) === '@gmail.com'
}
```

In `authClaims.ts`:

```ts
export function canGrantDirectoryRole(claims: AuthClaims): boolean {
  return claims.role === 'he_phai_admin'
}
```

On `Member` in `types.ts`, add optional fields listed in Interfaces.

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd tanstack-app && pnpm exec vitest run src/domain/gmail.test.ts src/domain/authClaims.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/domain/gmail.ts tanstack-app/src/domain/gmail.test.ts \
  tanstack-app/src/domain/authClaims.ts tanstack-app/src/domain/authClaims.test.ts \
  tanstack-app/src/domain/types.ts
git commit -m "$(cat <<'EOF'
feat(domain): Gmail check and Thư ký grant capability helpers

EOF
)"
```

---

### Task 2: Firestore rules — org-scoped directory + freeze secretary fields

**Files:**
- Modify: `firebase/firestore.rules`
- Modify: `tanstack-app/src/firebase/firestoreRules.integration.test.ts`

**Interfaces:**
- Produces helpers (names exact):
  - `directoryOrgOk(orgUnitId)` — same logic as `retreatOrgOk`
  - `canListDirectory()` — he_phai **or** (giao_doan_admin) — list still needs query constraint via `directoryOrgOk(resource.data.orgUnitId)` like retreats
  - `directoryRoleFieldsUnchanged()` on members — `directoryRole`, `directoryAuthUid`, `directoryRoleGrantedAt`, `directoryRoleGrantedBy` equal between `resource` and `request.resource` (treat missing as null-equivalent: both absent or both null/equal strings)
  - `orgUnits` `allow write: if isHePhaiAdmin();`
  - members/temples: `allow list: if canWriteDirectory() && (isHePhaiAdmin() || directoryOrgOk(resource.data.orgUnitId));`
  - members/temples create/update/delete admin branches: require `directoryOrgOk(...)` for giao_doan; he_phai unrestricted
  - member `allow update`: also `&& directoryRoleFieldsUnchanged()` for all non-bypass clients (service account bypasses rules)

- [ ] **Step 1: Add failing integration tests** (mirror retreat org tests around lines 887–920)

Add cases:

1. `giao_doan_admin` list members with `where('orgUnitId','==',claim.orgUnitId)` succeeds; unconstrained list fails.
2. `giao_doan_admin` cannot update member in other org.
3. `giao_doan_admin` cannot write `orgUnits`.
4. Authenticated he_phai update that changes `directoryRole` fails (fields must stay unchanged).

- [ ] **Step 2: Run integration tests — expect FAIL**

```bash
cd tanstack-app && pnpm exec vitest run src/firebase/firestoreRules.integration.test.ts
```

(Use the project’s existing emulator script if tests require it — same as other rules tests.)

- [ ] **Step 3: Update `firestore.rules`**

Add near `retreatOrgOk`:

```
function directoryOrgOk(orgUnitId) {
  return isHePhaiAdmin() || isLegacyAdmin()
    || (isGiaoDoanAdmin() && request.auth.token.orgUnitId == orgUnitId);
}
```

Change `orgUnits` write to `isHePhaiAdmin()`.

For `members` and `temples` list/create/update/delete admin paths, gate with `directoryOrgOk` like `retreats`. Keep public `get` and filler invite paths unchanged.

Add `directoryRoleFieldsUnchanged()` and require it on member updates.

- [ ] **Step 4: Run integration tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add firebase/firestore.rules tanstack-app/src/firebase/firestoreRules.integration.test.ts
git commit -m "$(cat <<'EOF'
feat(rules): org-scope members/temples for giao_doan_admin

EOF
)"
```

---

### Task 3: Worker — service account token + Identity Toolkit + Firestore admin REST

**Files:**
- Modify: `tanstack-app/src/worker/env.ts`
- Create: `tanstack-app/src/worker/googleServiceAccount.ts`
- Create: `tanstack-app/src/worker/googleServiceAccount.test.ts`
- Create: `tanstack-app/src/worker/identityToolkit.ts`
- Create: `tanstack-app/src/worker/identityToolkit.test.ts`
- Create: `tanstack-app/src/worker/firestoreAdminRest.ts`
- Create: `tanstack-app/src/worker/firestoreAdminRest.test.ts`

**Interfaces:**
- Consumes: `Env.FIREBASE_SERVICE_ACCOUNT_JSON: string` (raw SA JSON)
- Produces:
  - `parseServiceAccountJson(json: string): { clientEmail: string; privateKey: string; projectId: string }`
  - `getGoogleAccessToken(sa, fetchImpl?): Promise<string>` — JWT bearer → `https://oauth2.googleapis.com/token` with scope `https://www.googleapis.com/auth/identitytoolkit` + `https://www.googleapis.com/auth/datastore`
  - `lookupAuthUserByEmail(accessToken, email): Promise<{ localId: string } | null>`
  - `createAuthUserWithEmail(accessToken, email): Promise<{ localId: string }>`
  - `setAuthCustomClaims(accessToken, localId, claims: Record<string, unknown>): Promise<void>` — Identity Toolkit `accounts:update` with `customAttributes` JSON string
  - `getMemberAdminFields(accessToken, projectId, memberId): Promise<{ id, orgUnitId, email, directoryRole, directoryAuthUid } | null>`
  - `listSecretaries(accessToken, projectId): Promise<Array<{ id, orgUnitId, email, phapDanh?, theDanh?, directoryRoleGrantedAt? }>>` — runQuery `directoryRole == 'giao_doan_admin'`
  - `patchMemberDirectoryFields(accessToken, projectId, memberId, fields): Promise<void>`

- [ ] **Step 1: Failing unit tests with mocked `fetch`**

Cover: parse SA JSON; access token request shape; lookup 404 → null; set claims posts `customAttributes`; patch member builds Firestore REST body; listSecretaries parses documents.

- [ ] **Step 2: Run — expect FAIL**

```bash
cd tanstack-app && pnpm exec vitest run src/worker/googleServiceAccount.test.ts src/worker/identityToolkit.test.ts src/worker/firestoreAdminRest.test.ts
```

- [ ] **Step 3: Implement modules** using `jose` (already used in worker) for RS256 SA JWT. Do **not** import `firebase-admin` (Node-only).

Identity Toolkit endpoints (API key not required when using OAuth access token):

- `POST https://identitytoolkit.googleapis.com/v1/accounts:lookup` body `{ email: [email] }`
- `POST https://identitytoolkit.googleapis.com/v1/accounts:signUp` body `{ email, localId? }` or `accounts:update` create pattern used by Admin — prefer lookup then `signUp` with email only if missing
- `POST https://identitytoolkit.googleapis.com/v1/accounts:update` body `{ localId, customAttributes: JSON.stringify(claims) }` — empty object `{}` to clear

Firestore: `PATCH .../documents/members/{id}?updateMask.fieldPaths=...` with Bearer access token.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/worker/env.ts tanstack-app/src/worker/googleServiceAccount.ts \
  tanstack-app/src/worker/googleServiceAccount.test.ts \
  tanstack-app/src/worker/identityToolkit.ts tanstack-app/src/worker/identityToolkit.test.ts \
  tanstack-app/src/worker/firestoreAdminRest.ts tanstack-app/src/worker/firestoreAdminRest.test.ts
git commit -m "$(cat <<'EOF'
feat(worker): Identity Toolkit and Firestore admin helpers for claims

EOF
)"
```

---

### Task 4: Worker — verify he_phai + directory-role grant/revoke API

**Files:**
- Modify: `tanstack-app/src/worker/verifyFirebaseAdmin.ts`
- Modify: `tanstack-app/src/worker/verifyFirebaseAdmin.test.ts`
- Create: `tanstack-app/src/worker/directoryRoleApi.ts`
- Create: `tanstack-app/src/worker/directoryRoleApi.test.ts`
- Modify: `tanstack-app/src/worker.ts`

**Interfaces:**
- Produces:
  - `verifyFirebaseAdminToken` → `{ uid: string; role: 'he_phai_admin' | 'giao_doan_admin' }` (map legacy `admin:true` → `he_phai_admin`)
  - `verifyHePhaiAdminToken(idToken, projectId): Promise<{ uid: string } | null>` — null unless he_phai
  - `handleDirectoryRoleApi(request, env): Promise<Response>`
  - Routes:
    - `POST /api/admin/directory-role/grant` body `{ memberId: string }`
    - `POST /api/admin/directory-role/revoke` body `{ memberId: string }`

Grant algorithm (exact):

1. Bearer token → `verifyHePhaiAdminToken`; else 403
2. Parse JSON `{ memberId }`; else 400
3. SA access token + `getMemberAdminFields`; 404 if missing
4. `isGmailEmail(member.email)` else 400 `{ code: 'EMAIL_NOT_GMAIL' }`
5. If `member.directoryRole === 'giao_doan_admin'` → 400 `{ code: 'ALREADY_SECRETARY' }`
6. `listSecretaries`; if another member same normalized email → 400 `{ code: 'EMAIL_IN_USE' }`
7. lookup Auth user by email; else create
8. `setAuthCustomClaims(token, localId, { role: 'giao_doan_admin', orgUnitId: member.orgUnitId })`
9. `patchMemberDirectoryFields` with `directoryRole`, `directoryAuthUid`, `directoryRoleGrantedAt` (ISO now), `directoryRoleGrantedBy` (uid)
10. 200 `{ memberId, directoryAuthUid, orgUnitId, email }`

On step 9 failure after step 8: call `setAuthCustomClaims(..., {})` to compensate, then 500.

Revoke:

1. he_phai only
2. Load member; if no `directoryRole`, 200 idempotent
3. If `directoryAuthUid`, clear claims
4. Patch fields to delete/null (`directoryRole` etc. — use Firestore REST delete/null per field mask)
5. 200 `{ memberId }`

- [ ] **Step 1: Extend verify tests** for role return + he_phai-only helper; write directoryRoleApi tests mocking toolkit/firestore modules (grant happy path, 403 giao_doan, bad email, duplicate).

- [ ] **Step 2: Run — expect FAIL**

```bash
cd tanstack-app && pnpm exec vitest run src/worker/verifyFirebaseAdmin.test.ts src/worker/directoryRoleApi.test.ts
```

- [ ] **Step 3: Implement** `directoryRoleApi.ts` + wire in `worker.ts`:

```ts
if (url.pathname.startsWith('/api/admin/directory-role')) {
  return handleDirectoryRoleApi(request, env)
}
```

Update existing photos/docs callers if `verifyFirebaseAdminToken` return type gained `role` — keep `{ uid }` usable (`role` extra is fine).

- [ ] **Step 4: Run — expect PASS** (also re-run `photosApi.test.ts` / `docsApi.test.ts` if verify mock shapes break)

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/worker/verifyFirebaseAdmin.ts tanstack-app/src/worker/verifyFirebaseAdmin.test.ts \
  tanstack-app/src/worker/directoryRoleApi.ts tanstack-app/src/worker/directoryRoleApi.test.ts \
  tanstack-app/src/worker.ts
git commit -m "$(cat <<'EOF'
feat(worker): grant and revoke Thư ký giáo đoàn directory role

EOF
)"
```

**Ops note (do not skip in PR description):** set Cloudflare secret `FIREBASE_SERVICE_ACCOUNT_JSON` to the Firebase service account JSON string before deploy.

---

### Task 5: Client API + member list secretaries query

**Files:**
- Create: `tanstack-app/src/directoryRole/directoryRoleApiClient.ts`
- Create: `tanstack-app/src/directoryRole/directoryRoleApiClient.test.ts`
- Modify: `tanstack-app/src/repositories/memberRepo.ts` (+ tests if present)
- Modify: `tanstack-app/src/query/adminQueries.ts`
- Modify: `tanstack-app/src/query/adminKeys.ts` (if needed)
- Modify: `tanstack-app/src/use-cases/saveAdminMember.ts` — strip `directoryRole*` in `protectedPatchKeys`; reject email change when `directoryRole` set

**Interfaces:**
- Produces:
  - `grantDirectoryRole(input: { memberId: string; idToken: string }): Promise<{ memberId: string; directoryAuthUid: string; orgUnitId: string; email: string }>`
  - `revokeDirectoryRole(input: { memberId: string; idToken: string }): Promise<{ memberId: string }>`
  - `memberRepo.listDirectorySecretaries(): Promise<Member[]>` — `where('directoryRole','==','giao_doan_admin')` + `limit(200)`
  - `directorySecretariesQuery()` — `queryOptions` key `adminKeys.directorySecretaries()`, `staleTime: 60_000`

- [ ] **Step 1: Failing client + repo tests** (fetch mock like `docsApiClient.test.ts`)

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement client, repo query, queryOptions; extend `saveAdminMember`:**

```ts
const protectedPatchKeys = [ /* existing */, 'directoryRole', 'directoryAuthUid', 'directoryRoleGrantedAt', 'directoryRoleGrantedBy' ]

// On update, if existing.directoryRole && patch.email is defined and normalizeEmail(patch.email) !== normalizeEmail(existing.email ?? ''):
//   throw new DomainError('FORBIDDEN', 'Revoke Thư ký before changing email')
```

(Org unit is already immutable via `coreIdentityUnchanged` / protected keys.)

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/directoryRole tanstack-app/src/repositories/memberRepo.ts \
  tanstack-app/src/query/adminQueries.ts tanstack-app/src/query/adminKeys.ts \
  tanstack-app/src/use-cases/saveAdminMember.ts tanstack-app/src/use-cases/saveAdminDraft.test.ts
git commit -m "$(cat <<'EOF'
feat(client): directory role API client and secretaries query

EOF
)"
```

---

### Task 6: i18n + OrgUnits secretaries column/modal

**Files:**
- Modify: `tanstack-app/messages/vi.json` (and `en.json` if the app maintains it)
- Create: `tanstack-app/src/components/admin/OrgUnitSecretariesModal.tsx`
- Create: `tanstack-app/src/components/admin/OrgUnitSecretariesModal.test.tsx`
- Modify: `tanstack-app/src/components/admin/OrgUnitsPage.tsx`
- Create/Modify: `tanstack-app/src/components/admin/OrgUnitsPage.test.tsx`

**Interfaces:**
- UI only for `canGrantDirectoryRole`
- Column label: `admin_org_units_col_secretaries` = “Thư ký giáo đoàn”
- Display names: `phapDanh || theDanh || email || member.id`
- Empty cell: `—` (em dash)
- Modal: table columns name / email / grantedAt; button Xoá → confirm → `revokeDirectoryRole` → invalidate `directorySecretariesQuery`

- [ ] **Step 1: Add message keys** (run paraglide compile if required by project scripts)

```json
"admin_org_units_col_secretaries": "Thư ký giáo đoàn",
"admin_org_units_secretaries_empty": "—",
"admin_org_units_secretaries_modal_title": "Thư ký giáo đoàn",
"admin_org_units_secretaries_col_name": "Tên",
"admin_org_units_secretaries_col_email": "Email",
"admin_org_units_secretaries_col_granted_at": "Ngày cấp",
"admin_org_units_secretaries_revoke": "Xoá",
"admin_org_units_secretaries_revoke_confirm": "Thu hồi quyền Thư ký giáo đoàn của thành viên này?",
"admin_member_directory_role_badge": "Thư ký giáo đoàn",
"admin_member_directory_role_grant": "Cấp Thư ký giáo đoàn",
"admin_member_directory_role_revoke": "Thu hồi Thư ký",
"admin_member_directory_role_need_gmail": "Cần email @gmail.com để cấp quyền Thư ký",
"admin_member_directory_role_grant_success": "Đã cấp quyền Thư ký giáo đoàn",
"admin_member_directory_role_revoke_success": "Đã thu hồi quyền Thư ký giáo đoàn"
```

- [ ] **Step 2: Failing UI tests** — OrgUnits with mocked secretaries shows names; click opens modal; revoke calls API

- [ ] **Step 3: Implement modal + OrgUnitsPage**

Pattern: `useQuery(directorySecretariesQuery())` when `canGrantDirectoryRole`; `groupBy orgUnitId`; clickable `Anchor`/`UnstyledButton` on cell.

- [ ] **Step 4: Run UI tests — expect PASS**

```bash
cd tanstack-app && pnpm exec vitest run src/components/admin/OrgUnitsPage.test.tsx src/components/admin/OrgUnitSecretariesModal.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/messages tanstack-app/src/components/admin/OrgUnitsPage.tsx \
  tanstack-app/src/components/admin/OrgUnitsPage.test.tsx \
  tanstack-app/src/components/admin/OrgUnitSecretariesModal.tsx \
  tanstack-app/src/components/admin/OrgUnitSecretariesModal.test.tsx \
  tanstack-app/src/paraglide
git commit -m "$(cat <<'EOF'
feat(admin): show and revoke Thư ký on org-units page

EOF
)"
```

---

### Task 7: Member detail grant/revoke UI

**Files:**
- Modify: `tanstack-app/src/components/admin/MemberFormPage.tsx`
- Modify: `tanstack-app/src/components/admin/MemberFormPage.test.tsx`

**Interfaces:**
- When `canGrantDirectoryRole` and edit mode with loaded member:
  - Badge if `member.directoryRole === 'giao_doan_admin'`
  - Button grant (disabled + tooltip if `!isGmailEmail(member.email)`) or revoke
  - Mutations call client APIs with `user.getIdToken()`; invalidate member detail + `directorySecretariesQuery`

- [ ] **Step 1: Failing tests** — grant disabled without gmail; grant enabled with gmail; badge when role set

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement UI near title/actions** (Mantine `Badge`, `Button`, `Tooltip`, confirm modal for revoke)

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/admin/MemberFormPage.tsx tanstack-app/src/components/admin/MemberFormPage.test.tsx
git commit -m "$(cat <<'EOF'
feat(admin): grant and revoke Thư ký from member detail

EOF
)"
```

---

### Task 8: Lock member/temple UI + use-case org scope for `giao_doan_admin`

**Files:**
- Modify: `tanstack-app/src/components/admin/MembersListPage.tsx` (+ test)
- Modify: `tanstack-app/src/components/admin/TemplesListPage.tsx` (+ test if exists)
- Modify: `tanstack-app/src/components/admin/MemberFormPage.tsx` (create: lock org Select)
- Modify: `tanstack-app/src/components/admin/TempleFormPage.tsx` (create: lock org Select)
- Modify: `tanstack-app/src/use-cases/saveAdminMember.ts`
- Modify: `tanstack-app/src/use-cases/saveAdminTemple.ts`
- Modify: `tanstack-app/src/use-cases/deleteMembers.ts`
- Modify: `tanstack-app/src/use-cases/deleteTemples.ts` (or equivalent)
- Related tests

**Interfaces:**
- Mirror `RetreatsListPage` `scopedOrgUnitId`:

```ts
const scopedOrgUnitId =
  claim.status === 'admin' && claim.role === 'giao_doan_admin'
    ? (claim.orgUnitId ?? undefined)
    : (orgUnitFilter ?? undefined)
```

- Hide/disable org filter Select when `giao_doan_admin`
- Create forms: org Select fixed to `claim.orgUnitId`
- Use-cases that write directory: accept `claims: AuthClaims` **or** read from a new optional param — prefer pass `claims` from pages like retreat use-cases:

```ts
export async function saveAdminMember(
  input: SaveAdminMemberInput,
  audit: AuditActor,
  claims: AuthClaims,
  memberStore: MemberStore = memberRepo,
): Promise<...> {
  if (!canAccessOrgUnit(claims, input.orgUnitId)) {
    throw new DomainError('FORBIDDEN', 'Org unit out of scope')
  }
  // existing logic
}
```

Update all call sites and tests. Same for temple save/delete; for bulk delete, load each member/temple and check `canAccessOrgUnit` (or ensure list UI only selects in-scope ids + rules deny).

- [ ] **Step 1: Failing tests** for scoped filter default and FORBIDDEN on cross-org save

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement UI lock + claims params**

- [ ] **Step 4: Run affected vitest files — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/admin/MembersListPage.tsx \
  tanstack-app/src/components/admin/TemplesListPage.tsx \
  tanstack-app/src/components/admin/MemberFormPage.tsx \
  tanstack-app/src/components/admin/TempleFormPage.tsx \
  tanstack-app/src/use-cases/saveAdminMember.ts \
  tanstack-app/src/use-cases/saveAdminTemple.ts \
  tanstack-app/src/use-cases/deleteMembers.ts \
  tanstack-app/src/use-cases
git commit -m "$(cat <<'EOF'
feat(admin): scope member and temple management to giao_doan org

EOF
)"
```

---

### Task 9: Final verification

**Files:** none new

- [ ] **Step 1: Run focused suites**

```bash
cd tanstack-app && pnpm exec vitest run \
  src/domain/gmail.test.ts \
  src/domain/authClaims.test.ts \
  src/worker/directoryRoleApi.test.ts \
  src/worker/identityToolkit.test.ts \
  src/worker/firestoreAdminRest.test.ts \
  src/directoryRole/directoryRoleApiClient.test.ts \
  src/components/admin/OrgUnitsPage.test.tsx \
  src/components/admin/OrgUnitSecretariesModal.test.tsx \
  src/components/admin/MemberFormPage.test.tsx \
  src/firebase/firestoreRules.integration.test.ts
```

- [ ] **Step 2: Fix any failures**

- [ ] **Step 3: Manual smoke checklist** (document in PR):

1. Set `FIREBASE_SERVICE_ACCOUNT_JSON` on worker (local wrangler secret / dashboard)
2. Deploy rules
3. As he_phai: set member email `@gmail.com` → grant → see on org-units → Google login as that Gmail → `/admin` → only own org members/temples/retreats
4. Revoke from modal → refresh token → access denied

- [ ] **Step 4: Commit any fixes** (if needed)

---

## Spec coverage self-check

| Spec requirement | Task |
| --- | --- |
| Reuse `giao_doan_admin` | 1, 4 |
| he_phai-only grant/revoke | 1, 4, 6, 7 |
| `@gmail.com` required | 1, 4, 7 |
| Worker set claims immediately | 3, 4 |
| Member `directoryRole*` fields | 1, 4, 5 |
| Org-units column + modal revoke | 6 |
| Member detail grant/revoke | 7 |
| Full CRUD in org for Thư ký | 2, 8 |
| Rules org-scope members/temples | 2 |
| orgUnits write he_phai only | 2 |
| Block email change while secretary | 5 |
| Vitest, no Cypress | all |
| Service account secret | 3, 4 ops note, 9 |

## Placeholder / consistency check

- No TBD left; API paths and field names match the spec.
- Claim role string is always `giao_doan_admin`.
- `canGrantDirectoryRole` vs UI “Thư ký” labeling kept separate on purpose.
