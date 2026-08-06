# Thư ký hệ phái Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Hệ phái admin gốc grant/revoke claim `he_phai_secretary` (UI: Thư ký hệ phái) on a member with `@gmail.com`, with unscoped directory/retreat access like `he_phai_admin` but without grant/revoke or `orgUnits` write.

**Architecture:** New Auth role `he_phai_secretary`. Extend existing Worker grant/revoke + `directoryRole` on members. Domain helper `isHePhaiScope` for unscoped UI/access; `canGrantDirectoryRole` stays `he_phai_admin` only. Firestore rules treat secretary like he_phai for directory/retreats, exclude from `orgUnits` write.

**Tech Stack:** TanStack Start/React/Mantine, Firebase Auth custom claims, Cloudflare Worker, Firestore rules, Vitest

**Spec:** `docs/superpowers/specs/2026-08-06-thu-ky-he-phai-design.md`

## Global Constraints

- Work in the current workspace only — **never** `git worktree add`
- Create and use a feature branch from `main` (e.g. `feat/thu-ky-he-phai`); if already on another branch with WIP, stop and ask
- Claim string is `he_phai_secretary`; UI copy = “Thư ký hệ phái”
- Only `he_phai_admin` (incl. legacy `admin: true`) may grant/revoke
- Grant body **requires** explicit `role`: `"giao_doan_admin" | "he_phai_secretary"`
- Email must end with `@gmail.com` (normalize lowercase)
- Prefer Vitest; **no new Cypress**
- After merge squash into `main`, delete the local feature branch unless asked otherwise

## File Structure

| File | Responsibility |
| --- | --- |
| `docs/superpowers/specs/2026-08-06-thu-ky-he-phai-design.md` | Spec (already on `main`) |
| `docs/superpowers/plans/2026-08-06-thu-ky-he-phai.md` | This plan |
| `tanstack-app/src/domain/authClaims.ts` | `he_phai_secretary` + `isHePhaiScope` |
| `tanstack-app/src/domain/types.ts` | Widen `Member.directoryRole` |
| `firebase/firestore.rules` | `isHePhaiSecretary` in directory/retreat helpers; not orgUnits write |
| `tanstack-app/src/worker/verifyFirebaseAdmin.ts` | Accept secretary as staff admin token |
| `tanstack-app/src/worker/firestoreAdminRest.ts` | List both secretary role types for email-dup check |
| `tanstack-app/src/worker/directoryRoleApi.ts` | Grant by `role`; already-any-directoryRole guard |
| `tanstack-app/src/directoryRole/directoryRoleApiClient.ts` | Pass `role` on grant |
| `tanstack-app/src/repositories/memberRepo.ts` | Split/list he_phai secretaries |
| `tanstack-app/src/query/adminQueries.ts` | `hePhaiSecretariesQuery` |
| `tanstack-app/src/components/admin/MemberFormPage.tsx` | Dual grant + badges |
| `tanstack-app/src/components/admin/OrgUnitsPage.tsx` | He-phai secretaries section |
| `tanstack-app/src/components/admin/*ListPage.tsx` / `*FormPage.tsx` | Use `isHePhaiScope` for org filters |
| `tanstack-app/messages/vi.json` | i18n |
| Colocated `*.test.ts(x)` + rules integration tests |

---

### Task 0: Branch from main + commit plan

**Files:**
- Add: `docs/superpowers/plans/2026-08-06-thu-ky-he-phai.md`

**Interfaces:**
- Consumes: `main` with spec commit present
- Produces: branch `feat/thu-ky-he-phai` with this plan committed

- [ ] **Step 1: Confirm branch situation**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git branch --show-current
git status -sb
```

If not on `main` / `master`: **stop and ask** whether to stash/commit WIP and branch from `main`, or continue on current branch.

- [ ] **Step 2: Create feature branch**

```bash
git checkout main
git pull
git checkout -b feat/thu-ky-he-phai
```

- [ ] **Step 3: Commit plan if not already on branch**

```bash
git add docs/superpowers/plans/2026-08-06-thu-ky-he-phai.md
git commit -m "$(cat <<'EOF'
docs: plan Thư ký hệ phái (he_phai_secretary)

EOF
)"
```

Skip empty commit if the plan is already committed; still create the feature branch.

---

### Task 1: Domain — `he_phai_secretary` + `isHePhaiScope` + Member type

**Files:**
- Modify: `tanstack-app/src/domain/authClaims.ts`
- Modify: `tanstack-app/src/domain/authClaims.test.ts`
- Modify: `tanstack-app/src/domain/types.ts`

**Interfaces:**
- Produces:
  - `AdminRole` includes `'he_phai_secretary'`
  - `isHePhaiScope(claims: AuthClaims): boolean` — `he_phai_admin | he_phai_secretary`
  - `canAccessOrgUnit` / `canManageDirectory` / `canManageRetreats` include secretary
  - `canGrantDirectoryRole` remains **only** `he_phai_admin`
  - `blocksSecretaryGrantOnAuthClaims` returns `true` when raw role is `he_phai_secretary`
  - `Member.directoryRole?: 'giao_doan_admin' | 'he_phai_secretary'`

- [ ] **Step 1: Write failing tests** in `authClaims.test.ts`

```typescript
it('returns he_phai_secretary with null orgUnitId', () => {
  expect(parseAuthClaims({ role: 'he_phai_secretary' })).toEqual({
    role: 'he_phai_secretary',
    orgUnitId: null,
  })
})

it('always allows he_phai_secretary for any org', () => {
  expect(
    canAccessOrgUnit({ role: 'he_phai_secretary', orgUnitId: null }, 'gd-i'),
  ).toBe(true)
})

it('isHePhaiScope true for he_phai_admin and he_phai_secretary only', () => {
  expect(isHePhaiScope({ role: 'he_phai_admin', orgUnitId: null })).toBe(true)
  expect(isHePhaiScope({ role: 'he_phai_secretary', orgUnitId: null })).toBe(true)
  expect(isHePhaiScope({ role: 'giao_doan_admin', orgUnitId: 'gd-i' })).toBe(false)
})

it('canManageDirectory allows he_phai_secretary; canGrantDirectoryRole denies it', () => {
  const c = { role: 'he_phai_secretary' as const, orgUnitId: null }
  expect(canManageDirectory(c)).toBe(true)
  expect(canManageRetreats(c)).toBe(true)
  expect(canGrantDirectoryRole(c)).toBe(false)
})

it('blocks he_phai_secretary on Auth claims', () => {
  expect(
    blocksSecretaryGrantOnAuthClaims({ role: 'he_phai_secretary' }, 'gd-i'),
  ).toBe(true)
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd tanstack-app && pnpm exec vitest run src/domain/authClaims.test.ts
```

- [ ] **Step 3: Implement**

In `authClaims.ts`:

```typescript
export type AdminRole =
  | 'he_phai_admin'
  | 'he_phai_secretary'
  | 'giao_doan_admin'
  | 'kiem_soat'

// ADMIN_ROLES includes 'he_phai_secretary'

export function isHePhaiScope(claims: AuthClaims): boolean {
  return claims.role === 'he_phai_admin' || claims.role === 'he_phai_secretary'
}

export function canAccessOrgUnit(claims: AuthClaims, orgUnitId: string): boolean {
  if (isHePhaiScope(claims)) return true
  return claims.orgUnitId === orgUnitId
}

export function canManageDirectory(claims: AuthClaims): boolean {
  return isHePhaiScope(claims) || claims.role === 'giao_doan_admin'
}

// canGrantDirectoryRole unchanged: claims.role === 'he_phai_admin'

// In blocksSecretaryGrantOnAuthClaims:
// if (role === 'he_phai_admin' || role === 'kiem_soat' || role === 'he_phai_secretary') return true
```

In `types.ts`: `directoryRole?: 'giao_doan_admin' | 'he_phai_secretary'`

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd tanstack-app && pnpm exec vitest run src/domain/authClaims.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/domain/authClaims.ts tanstack-app/src/domain/authClaims.test.ts tanstack-app/src/domain/types.ts
git commit -m "$(cat <<'EOF'
feat: add he_phai_secretary role and isHePhaiScope helper

EOF
)"
```

---

### Task 2: Firestore rules — secretary as unscoped directory writer

**Files:**
- Modify: `firebase/firestore.rules`
- Modify: `tanstack-app/src/firebase/firestoreRules.integration.test.ts`

**Interfaces:**
- Consumes: `isHePhaiScope` semantics (rules-side)
- Produces: `isHePhaiSecretary()`; directory/retreat helpers include secretary; `orgUnits` write stays he_phai-only

- [ ] **Step 1: Add failing integration tests**

```typescript
it('he_phai_secretary can list members without org filter', async () => {
  const db = env.authenticatedContext('hp-sec', { role: 'he_phai_secretary' }).firestore()
  await assertSucceeds(db.collection('members').limit(1).get())
})

it('he_phai_secretary cannot write orgUnits', async () => {
  const db = env.authenticatedContext('hp-sec', { role: 'he_phai_secretary' }).firestore()
  await assertFails(db.collection('orgUnits').doc('gd-i').set({ name: 'x' }, { merge: true }))
})

it('he_phai_secretary can update member in any org', async () => {
  // seed member in gd-ii; update as he_phai_secretary — assertSucceeds
  // follow existing he_phai_admin update patterns in this file
})
```

- [ ] **Step 2: Run rules tests — expect FAIL**

```bash
cd tanstack-app && pnpm exec vitest run src/firebase/firestoreRules.integration.test.ts
```

- [ ] **Step 3: Update rules**

```javascript
function isHePhaiSecretary() {
  return role() == 'he_phai_secretary';
}

function isHePhaiScope() {
  return isHePhaiAdmin() || isHePhaiSecretary();
}

function isStaff() {
  return isHePhaiScope() || isGiaoDoanAdmin() || isKiemSoat() || isLegacyAdmin();
}

function canWriteDirectory() {
  return isHePhaiScope() || isGiaoDoanAdmin() || isLegacyAdmin();
}

function retreatOrgOk(orgUnitId) {
  return isHePhaiScope() || isLegacyAdmin()
    || (isGiaoDoanAdmin() && request.auth.token.orgUnitId == orgUnitId);
}

function directoryOrgOk(orgUnitId) {
  return isHePhaiScope() || isLegacyAdmin()
    || (isGiaoDoanAdmin() && request.auth.token.orgUnitId == orgUnitId);
}

function canListDirectory() {
  return isHePhaiScope() || isGiaoDoanAdmin();
}

// orgUnits write UNCHANGED:
allow write: if isHePhaiAdmin();
```

`secretaryEmailUnchanged` / `directoryRoleFieldsUnchanged` already key off any non-null `directoryRole` — no change needed for `he_phai_secretary` email freeze.

- [ ] **Step 4: Run rules tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add firebase/firestore.rules tanstack-app/src/firebase/firestoreRules.integration.test.ts
git commit -m "$(cat <<'EOF'
feat: treat he_phai_secretary as unscoped directory writer in rules

EOF
)"
```

---

### Task 3: Worker grant/revoke + client — explicit `role`

**Files:**
- Modify: `tanstack-app/src/worker/directoryRoleApi.ts`
- Modify: `tanstack-app/src/worker/directoryRoleApi.test.ts`
- Modify: `tanstack-app/src/worker/firestoreAdminRest.ts`
- Modify: `tanstack-app/src/worker/firestoreAdminRest.test.ts`
- Modify: `tanstack-app/src/worker/verifyFirebaseAdmin.ts`
- Modify: `tanstack-app/src/worker/verifyFirebaseAdmin.test.ts`
- Modify: `tanstack-app/src/directoryRole/directoryRoleApiClient.ts`
- Modify: `tanstack-app/src/directoryRole/directoryRoleApiClient.test.ts`

**Interfaces:**
- Consumes: `blocksSecretaryGrantOnAuthClaims`, Gmail helpers
- Produces:
  - Grant body: `{ memberId: string, role: 'giao_doan_admin' | 'he_phai_secretary' }`
  - Claims for hệ phái: `{ role: 'he_phai_secretary' }` (no `orgUnitId`)
  - `listSecretaries` finds members with either directoryRole (for EMAIL_IN_USE)
  - `verifyFirebaseAdminToken` accepts `he_phai_secretary`; `verifyHePhaiAdminToken` still he_phai only
  - Client: `grantDirectoryRole({ memberId, role, idToken })`

- [ ] **Step 1: Write failing tests**

`directoryRoleApi.test.ts` — grant he_phai_secretary:

```typescript
it('grants he_phai_secretary claims and patches member', async () => {
  // POST grant with { memberId, role: 'he_phai_secretary' }
  // expect setAuthCustomClaims(..., { role: 'he_phai_secretary' })
  // expect patch directoryRole: 'he_phai_secretary'
})

it('returns 400 ROLE_REQUIRED when role missing', async () => {
  // body { memberId } only → 400 code ROLE_REQUIRED or error text
})

it('returns 400 ALREADY_SECRETARY when member has he_phai_secretary', async () => {
  // member.directoryRole = 'he_phai_secretary'
})

it('returns 403 when caller is he_phai_secretary', async () => {
  // token role he_phai_secretary → Forbidden (verifyHePhaiAdminToken null)
})
```

Update existing grant tests to send `role: 'giao_doan_admin'`.

`directoryRoleApiClient.test.ts`: assert body includes `role`.

`verifyFirebaseAdmin.test.ts`: token with `he_phai_secretary` → `verifyFirebaseAdminToken` returns that role; `verifyHePhaiAdminToken` returns null.

`firestoreAdminRest`: `listSecretaries` uses IN filter (or two queries) so both roles appear — update test.

- [ ] **Step 2: Run relevant vitest — expect FAIL**

```bash
cd tanstack-app && pnpm exec vitest run \
  src/worker/directoryRoleApi.test.ts \
  src/directoryRole/directoryRoleApiClient.test.ts \
  src/worker/verifyFirebaseAdmin.test.ts \
  src/worker/firestoreAdminRest.test.ts
```

- [ ] **Step 3: Implement**

`DirectoryRoleBody`:

```typescript
type DirectoryRoleKind = 'giao_doan_admin' | 'he_phai_secretary'
type DirectoryRoleBody = { memberId?: string; role?: string }
```

In `handleGrant`:

1. Validate `role` is `'giao_doan_admin' | 'he_phai_secretary'` else `400` `{ code: 'ROLE_REQUIRED' }`
2. If `member.directoryRole` truthy → `ALREADY_SECRETARY`
3. Email dup via `listSecretaries` (both roles)
4. For `giao_doan_admin`: claims `{ role, orgUnitId: member.orgUnitId }`; `blocksSecretaryGrantOnAuthClaims(..., member.orgUnitId)`
5. For `he_phai_secretary`: claims `{ role: 'he_phai_secretary' }`; call `blocksSecretaryGrantOnAuthClaims(claims, member.orgUnitId)` (blocks privileged including secretary / he_phai; also blocks any `giao_doan_admin` when granting hệ phái — extend helper:

```typescript
// After he_phai_secretary / he_phai_admin / kiem_soat checks:
if (role === 'giao_doan_admin') {
  // existing same-org allow / cross-org block
}
```

When granting `he_phai_secretary`, treat any existing `giao_doan_admin` Auth claim as blocked:

```typescript
if (grantRole === 'he_phai_secretary' && rawClaims.role === 'giao_doan_admin') {
  return true // in a dedicated check in handleGrant OR extend helper with grantRole param
}
```

**Decision for implementer:** extend to:

```typescript
export function blocksSecretaryGrantOnAuthClaims(
  rawClaims: Record<string, unknown>,
  targetOrgUnitId: string,
  grantRole: 'giao_doan_admin' | 'he_phai_secretary' = 'giao_doan_admin',
): boolean
```

- Always block `admin`, `he_phai_admin`, `kiem_soat`, `he_phai_secretary`
- If `grantRole === 'he_phai_secretary'`: also block any `giao_doan_admin`
- If `grantRole === 'giao_doan_admin'`: keep current same-org allow / cross-org block

6. Patch member with chosen `directoryRole`
7. Response may omit `orgUnitId` for hệ phái or still return member’s profile `orgUnitId` (client should not rely on it for claims) — keep returning `orgUnitId: member.orgUnitId` for shape stability

`listSecretaries` structuredQuery `IN` on `directoryRole` with both string values (Firestore REST `op: "IN"` / `arrayValue`).

`verifyFirebaseAdmin.ts`:

```typescript
export type AdminRole = 'he_phai_admin' | 'he_phai_secretary' | 'giao_doan_admin'
// resolveAdminRole includes he_phai_secretary
```

Client:

```typescript
export async function grantDirectoryRole(input: {
  memberId: string
  role: 'giao_doan_admin' | 'he_phai_secretary'
  idToken: string
}): Promise<{ memberId: string; directoryAuthUid: string; orgUnitId: string; email: string }>
```

- [ ] **Step 4: Run tests — expect PASS** (update domain tests if helper signature gained `grantRole`)

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/worker tanstack-app/src/directoryRole tanstack-app/src/domain/authClaims.ts tanstack-app/src/domain/authClaims.test.ts
git commit -m "$(cat <<'EOF'
feat: grant/revoke he_phai_secretary via directory-role API

EOF
)"
```

---

### Task 4: Repo + queries — list Thư ký hệ phái

**Files:**
- Modify: `tanstack-app/src/repositories/memberRepo.ts`
- Modify: `tanstack-app/src/repositories/memberRepo.test.ts`
- Modify: `tanstack-app/src/test/memoryStores.ts`
- Modify: `tanstack-app/src/query/adminQueries.ts`
- Modify: `tanstack-app/src/query/adminQueries.test.ts`

**Interfaces:**
- Produces:
  - `memberRepo.listDirectorySecretaries()` — keep querying `directoryRole == 'giao_doan_admin'` (org-units column)
  - `memberRepo.listHePhaiSecretaries()` — `directoryRole == 'he_phai_secretary'`, `limit(200)`
  - `hePhaiSecretariesQuery()` — same key pattern as `directorySecretariesQuery`

- [ ] **Step 1: Failing tests** for `listHePhaiSecretaries` (mirror `listDirectorySecretaries` test with role `he_phai_secretary`)

- [ ] **Step 2: Run — expect FAIL**

```bash
cd tanstack-app && pnpm exec vitest run src/repositories/memberRepo.test.ts src/query/adminQueries.test.ts
```

- [ ] **Step 3: Implement** repo method + memory store filter + queryOptions

```typescript
export function hePhaiSecretariesQuery() {
  return queryOptions({
    queryKey: ['admin', 'hePhaiSecretaries'] as const,
    queryFn: () => memberRepo.listHePhaiSecretaries(),
    staleTime: 60_000,
  })
}
```

(Match `staleTime` / key style of existing `directorySecretariesQuery`.)

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/repositories/memberRepo.ts tanstack-app/src/repositories/memberRepo.test.ts \
  tanstack-app/src/test/memoryStores.ts tanstack-app/src/query/adminQueries.ts tanstack-app/src/query/adminQueries.test.ts
git commit -m "$(cat <<'EOF'
feat: query members with directoryRole he_phai_secretary

EOF
)"
```

---

### Task 5: i18n keys

**Files:**
- Modify: `tanstack-app/messages/vi.json`
- Modify en messages file if present in repo

**Interfaces:**
- Produces message keys used by Tasks 6–7

- [ ] **Step 1: Add keys**

```json
"admin_member_directory_role_badge_he_phai": "Thư ký hệ phái",
"admin_member_directory_role_grant_he_phai": "Cấp Thư ký hệ phái",
"admin_member_directory_role_revoke_he_phai": "Thu hồi Thư ký hệ phái",
"admin_member_directory_role_grant_success_he_phai": "Đã cấp quyền Thư ký hệ phái",
"admin_member_directory_role_revoke_success_he_phai": "Đã thu hồi quyền Thư ký hệ phái",
"admin_org_units_he_phai_secretaries_title": "Thư ký hệ phái",
"admin_org_units_he_phai_secretaries_empty": "Chưa có Thư ký hệ phái",
"admin_org_units_he_phai_secretaries_col_name": "Tên",
"admin_org_units_he_phai_secretaries_col_email": "Email",
"admin_org_units_he_phai_secretaries_col_granted_at": "Cấp lúc",
"admin_org_units_he_phai_secretaries_revoke": "Xoá"
```

Keep existing giáo đoàn keys unchanged. Optionally rename revoke success for giáo đoàn only if needed — leave as-is.

- [ ] **Step 2: Commit**

```bash
git add tanstack-app/messages/vi.json
git commit -m "$(cat <<'EOF'
feat: i18n for Thư ký hệ phái UI

EOF
)"
```

(If paraglide requires compile, run the project’s usual message compile script before UI tasks.)

---

### Task 6: Member detail — dual grant / revoke + badges

**Files:**
- Modify: `tanstack-app/src/components/admin/MemberFormPage.tsx`
- Modify: `tanstack-app/src/components/admin/MemberFormPage.test.tsx`

**Interfaces:**
- Consumes: `grantDirectoryRole({ memberId, role, idToken })`, `canGrantDirectoryRole`, i18n keys
- Produces: UI for both secretary types; read-only badge for non-grantors when `directoryRole` set

- [ ] **Step 1: Failing UI tests**

- When `canGrant` and no `directoryRole`: both grant buttons present
- Grant he_phai calls API with `role: 'he_phai_secretary'`
- When `directoryRole === 'he_phai_secretary'`: badge hệ phái + revoke hệ phái
- When `directoryRole === 'giao_doan_admin'`: existing badge + revoke (API still revoke by memberId)
- When claim is `he_phai_secretary`: no grant/revoke buttons; badge visible if member is secretary

Update existing grant mock calls to pass `role: 'giao_doan_admin'`.

- [ ] **Step 2: Run — expect FAIL**

```bash
cd tanstack-app && pnpm exec vitest run src/components/admin/MemberFormPage.test.tsx
```

- [ ] **Step 3: Implement**

- `grantDirectoryRoleMutation` accepts `role` variable: `mutate('giao_doan_admin' | 'he_phai_secretary')`
- Two grant buttons when `!member.directoryRole`
- Branch badge/revoke copy on `directoryRole`
- Show badge when `directoryRole` set even if `!canGrant` (read-only)
- Success toasts use role-specific i18n
- Org picker unscoped: use `isHePhaiScope` instead of `role === 'he_phai_admin'` on this page

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/admin/MemberFormPage.tsx tanstack-app/src/components/admin/MemberFormPage.test.tsx
git commit -m "$(cat <<'EOF'
feat: grant/revoke Thư ký hệ phái on member form

EOF
)"
```

---

### Task 7: Org-units page — Thư ký hệ phái section

**Files:**
- Modify: `tanstack-app/src/components/admin/OrgUnitsPage.tsx`
- Modify: `tanstack-app/src/components/admin/OrgUnitsPage.test.tsx`
- Optionally extract: `HePhaiSecretariesSection.tsx` (+ test) if `OrgUnitsPage` grows unwieldy — prefer small inline section first

**Interfaces:**
- Consumes: `hePhaiSecretariesQuery`, `revokeDirectoryRole`, `canGrantDirectoryRole`
- Produces: section visible only when `canGrant`; revoke with confirm (reuse modal pattern or inline ConfirmModal like `OrgUnitSecretariesModal`)

- [ ] **Step 1: Failing tests**

- He_phai admin sees title “Thư ký hệ phái” and secretary row name/email
- Click revoke → calls `revokeDirectoryRole`
- `he_phai_secretary` claim: no section / no grant column (read-only org table)

- [ ] **Step 2: Run — expect FAIL**

```bash
cd tanstack-app && pnpm exec vitest run src/components/admin/OrgUnitsPage.test.tsx
```

- [ ] **Step 3: Implement**

Above or below the org-units table, when `canGrant`:

```tsx
<Title order={3}>{m.admin_org_units_he_phai_secretaries_title()}</Title>
{/* table: name (directorySecretaryDisplayName), email, grantedAt, revoke button */}
```

Enable `hePhaiSecretariesQuery` when `canGrant`. Invalidate both secretary queries on revoke success (same as modal).

Reuse `directorySecretaryDisplayName` from `OrgUnitSecretariesModal`.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/admin/OrgUnitsPage.tsx tanstack-app/src/components/admin/OrgUnitsPage.test.tsx
git commit -m "$(cat <<'EOF'
feat: list and revoke Thư ký hệ phái on org-units page

EOF
)"
```

---

### Task 8: Unscoped admin UX — `isHePhaiScope` in lists/forms

**Files:**
- Modify: `MembersListPage.tsx`, `TemplesListPage.tsx`, `RetreatsListPage.tsx`
- Modify: `TempleFormPage.tsx`, `RetreatFormPage.tsx`
- Modify colocated tests that assert `he_phai_admin`-only org filters

**Interfaces:**
- Consumes: `isHePhaiScope({ role, orgUnitId })`
- Produces: org filter / create-for-any-org enabled for `he_phai_secretary` identically to `he_phai_admin`

- [ ] **Step 1: Replace** local `isHePhaiAdmin = claim.role === 'he_phai_admin'` used for **org scoping UX** with:

```typescript
const hePhaiScope =
  claim.status === 'admin' &&
  isHePhaiScope({ role: claim.role, orgUnitId: claim.orgUnitId })
```

Do **not** use this for grant UI (`canGrantDirectoryRole` stays separate).

- [ ] **Step 2: Add/adjust tests** — with claim `he_phai_secretary`, org filter/select appears (same assertions as he_phai_admin cases).

- [ ] **Step 3: Run affected tests**

```bash
cd tanstack-app && pnpm exec vitest run \
  src/components/admin/MembersListPage.test.tsx \
  src/components/admin/TemplesListPage.test.tsx \
  src/components/admin/RetreatsListPage.test.tsx \
  src/components/admin/TempleFormPage.test.tsx \
  src/components/admin/RetreatFormPage.test.tsx \
  src/components/admin/MemberFormPage.test.tsx
```

- [ ] **Step 4: Commit**

```bash
git add tanstack-app/src/components/admin
git commit -m "$(cat <<'EOF'
feat: give he_phai_secretary unscoped admin list/form UX

EOF
)"
```

---

### Task 9: Smoke verification

**Files:** none (commands only)

- [ ] **Step 1: Run focused suite**

```bash
cd tanstack-app && pnpm exec vitest run \
  src/domain/authClaims.test.ts \
  src/worker/directoryRoleApi.test.ts \
  src/directoryRole/directoryRoleApiClient.test.ts \
  src/repositories/memberRepo.test.ts \
  src/components/admin/MemberFormPage.test.tsx \
  src/components/admin/OrgUnitsPage.test.tsx \
  src/firebase/firestoreRules.integration.test.ts
```

Expected: all PASS

- [ ] **Step 2: Manual checklist (document in PR later)**

1. As he_phai: grant Thư ký hệ phái on Gmail member → section on org-units shows them
2. Sign in as that Gmail → `/admin` members/temples/retreats across orgs
3. As secretary: no grant buttons; cannot save org-unit edits
4. Revoke → access gone after token refresh
5. Thư ký giáo đoàn grant still works with `role: 'giao_doan_admin'`

- [ ] **Step 3: Final commit only if leftover fixes**; otherwise done

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| Claim `he_phai_secretary` | 1 |
| Unscoped CRUD helpers | 1, 8 |
| No grant for secretary | 1, 3, 6 |
| No orgUnits write | 2, 7 |
| Grant/revoke Worker + `@gmail.com` | 3 |
| Explicit grant `role` | 3, 6 |
| Member `directoryRole` | 1, 3 |
| Member detail UI | 6 |
| Org-units section | 4, 7 |
| Rules | 2 |
| Vitest only | all |
| Email lock while directoryRole | already in rules/use-cases; covered by any-role directoryRole |

## Type consistency

- Grant role union: `'giao_doan_admin' | 'he_phai_secretary'` in API, client, and `Member.directoryRole`
- Helper name: `isHePhaiScope` (domain + rules `isHePhaiScope()`)
- Query: `listHePhaiSecretaries` / `hePhaiSecretariesQuery`
)
