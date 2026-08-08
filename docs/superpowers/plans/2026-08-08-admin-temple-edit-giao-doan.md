# Admin temple editable Giáo đoàn Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `he_phai_admin` (and legacy admin) change a temple’s Giáo đoàn (`orgUnitId`) on `/admin/temples/$id` when the temple is `draft`, saving via the existing Hoàn tất action, with phone-index migration and rules support.

**Architecture:** Gate reassignment in `saveAdminTemple` with `isHePhaiAdmin` + draft-only checks; pass `allowOrgUnitChange` into `templeRepo.createOrUpdateDraft` so filler paths stay blocked; migrate `templeManagerPhoneIndex` in the same transaction; relax Firestore `coreIdentityUnchanged` only for he-phái admin on draft temples; enable the org `Select` in `TempleFormPage` under the same conditions.

**Tech Stack:** Firestore rules, Firebase client SDK transactions, TanStack Query/UI (Mantine Select), Vitest (+ Firestore emulator integration tests)

**Spec:** `docs/superpowers/specs/2026-08-08-admin-temple-edit-giao-doan-design.md`

## Global Constraints

- Implement on the **current branch** only — do **not** create a new branch or git worktree
- Who can reassign: `he_phai_admin` and legacy `admin: true` only (not `he_phai_secretary`, not `giao_doan_admin`)
- Reassign only when temple `status === 'draft'`
- Save with existing Hoàn tất (no modal / auto-save)
- Prefer Vitest; no new Cypress
- Member org unit stays immutable (out of scope)

## File Structure

| File | Responsibility |
| --- | --- |
| `tanstack-app/src/domain/authClaims.ts` | Add `isHePhaiAdmin(claims)` |
| `tanstack-app/src/domain/authClaims.test.ts` | Cover admin vs secretary vs giao_doan |
| `firebase/firestore.rules` | Allow he-phái admin draft `orgUnitId` change |
| `tanstack-app/src/firebase/firestoreRules.integration.test.ts` | Rules cases for allow/deny org change |
| `tanstack-app/src/repositories/templeRepo.ts` | `allowOrgUnitChange` + phone index migrate |
| `tanstack-app/src/repositories/templeRepo.integration.test.ts` | Repo reassignment + index migrate |
| `tanstack-app/src/test/memoryStores.ts` | Mirror `allowOrgUnitChange` + index migrate |
| `tanstack-app/src/use-cases/saveAdminTemple.ts` | Claims/status gate + set flag |
| `tanstack-app/src/use-cases/saveAdminDraft.test.ts` | Use-case reassignment cases |
| `tanstack-app/src/components/admin/TempleFormPage.tsx` | Enable Select when he-phái admin + draft |
| `tanstack-app/src/components/admin/TempleFormPage.test.tsx` | UI enabled/disabled cases |

---

### Task 1: `isHePhaiAdmin` claims helper

**Files:**
- Modify: `tanstack-app/src/domain/authClaims.ts`
- Modify: `tanstack-app/src/domain/authClaims.test.ts`

**Interfaces:**
- Produces: `export function isHePhaiAdmin(claims: AuthClaims): boolean`
- Note: `parseAuthClaims` already maps legacy `admin: true` → `{ role: 'he_phai_admin', orgUnitId: null }`, so client-side only needs `claims.role === 'he_phai_admin'`.

- [ ] **Step 1: Write the failing test**

In `authClaims.test.ts`, add:

```ts
import { isHePhaiAdmin } from './authClaims'

describe('isHePhaiAdmin', () => {
  it('allows he_phai_admin only', () => {
    expect(isHePhaiAdmin({ role: 'he_phai_admin', orgUnitId: null })).toBe(true)
    expect(isHePhaiAdmin({ role: 'he_phai_secretary', orgUnitId: null })).toBe(
      false,
    )
    expect(isHePhaiAdmin({ role: 'giao_doan_admin', orgUnitId: 'gd-i' })).toBe(
      false,
    )
    expect(isHePhaiAdmin({ role: 'kiem_soat', orgUnitId: null })).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/domain/authClaims.test.ts
```

Expected: FAIL — `isHePhaiAdmin` is not exported / not defined.

- [ ] **Step 3: Minimal implementation**

In `authClaims.ts`, next to `isHePhaiScope`:

```ts
export function isHePhaiAdmin(claims: AuthClaims): boolean {
  return claims.role === 'he_phai_admin'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run the same command as Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/domain/authClaims.ts tanstack-app/src/domain/authClaims.test.ts
git commit -m "$(cat <<'EOF'
feat: add isHePhaiAdmin claims helper

EOF
)"
```

---

### Task 2: Firestore rules — draft org reassignment for he-phái admin

**Files:**
- Modify: `firebase/firestore.rules` (temples `match` block ~244–342)
- Modify: `tanstack-app/src/firebase/firestoreRules.integration.test.ts`

**Interfaces:**
- Consumes: existing `isHePhaiAdmin()`, `directoryOrgOk()`, `canWriteDirectory()`
- Produces: temple updates may change `orgUnitId` only when he-phái admin + draft→draft; `createdAt` still immutable

- [ ] **Step 1: Write / update failing rules tests**

Keep the locked-temple case failing for org change (already at ~631–632). Add a focused test in the temples describe:

```ts
it('allows he_phai_admin to change orgUnitId on draft temple; blocks others', async () => {
  const env = await getTestEnv()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'temples', 'temple-1'), templeDraft())
  })

  const hePhai = env
    .authenticatedContext('hp-admin', { role: 'he_phai_admin' })
    .firestore()
  await assertSucceeds(
    updateDoc(doc(hePhai, 'temples', 'temple-1'), {
      orgUnitId: 'gd-ii',
      updatedAt: '2026-01-03T00:00:00.000Z',
    }),
  )

  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'temples', 'temple-2'), templeDraft())
  })
  const gdAdmin = env
    .authenticatedContext('gd-admin', {
      role: 'giao_doan_admin',
      orgUnitId: 'gd-i',
    })
    .firestore()
  await assertFails(
    updateDoc(doc(gdAdmin, 'temples', 'temple-2'), {
      orgUnitId: 'gd-ii',
      updatedAt: '2026-01-03T00:00:00.000Z',
    }),
  )

  const secretary = env
    .authenticatedContext('sec', { role: 'he_phai_secretary' })
    .firestore()
  await assertFails(
    updateDoc(doc(secretary, 'temples', 'temple-2'), {
      orgUnitId: 'gd-ii',
      updatedAt: '2026-01-03T00:00:00.000Z',
    }),
  )

  const anon = env.unauthenticatedContext().firestore()
  await assertFails(
    updateDoc(doc(anon, 'temples', 'temple-2'), {
      orgUnitId: 'gd-ii',
      updatedAt: '2026-01-03T00:00:00.000Z',
    }),
  )
})
```

Also keep / reaffirm in the existing locked-admin test:

```ts
await assertFails(
  updateDoc(doc(admin, 'temples', 'temple-1'), { orgUnitId: 'gd-ii' }),
)
```

- [ ] **Step 2: Run rules tests to verify new allow case fails**

Run:

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm test:integration -- src/firebase/firestoreRules.integration.test.ts
```

Expected: FAIL on he-phái admin draft org change (`assertSucceeds` fails) until rules change.

- [ ] **Step 3: Update rules**

In `firebase/firestore.rules` inside `match /temples/{templeId}`, replace `coreIdentityUnchanged` usage with:

```
function createdAtUnchanged() {
  return request.resource.data.createdAt == resource.data.createdAt;
}

function orgUnitUnchanged() {
  return request.resource.data.orgUnitId == resource.data.orgUnitId;
}

function orgUnitReassignOk() {
  return isHePhaiAdmin()
    && resource.data.status == 'draft'
    && request.resource.data.status == 'draft'
    && request.resource.data.orgUnitId is string
    && directoryOrgOk(resource.data.orgUnitId)
    && directoryOrgOk(request.resource.data.orgUnitId);
}

function identityOk() {
  return createdAtUnchanged()
    && (orgUnitUnchanged() || orgUnitReassignOk());
}
```

Change `allow update` from `coreIdentityUnchanged()` to `identityOk()`. Remove unused `coreIdentityUnchanged` if nothing else references it.

Leave the existing admin/filler update branches unchanged (they still require `directoryOrgOk(resource.data.orgUnitId)` etc.).

- [ ] **Step 4: Re-run rules tests**

Same command as Step 2. Expected: PASS for new test + locked org-change still fails.

- [ ] **Step 5: Commit**

```bash
git add firebase/firestore.rules tanstack-app/src/firebase/firestoreRules.integration.test.ts
git commit -m "$(cat <<'EOF'
feat: allow he-phai admin to reassign draft temple org unit in rules

EOF
)"
```

---

### Task 3: Repo + memory store — `allowOrgUnitChange` and phone index migrate

**Files:**
- Modify: `tanstack-app/src/repositories/templeRepo.ts`
- Modify: `tanstack-app/src/repositories/templeRepo.integration.test.ts`
- Modify: `tanstack-app/src/test/memoryStores.ts`

**Interfaces:**
- Consumes: existing `shrinkTemplePhoneIndex`, `readTemplePhoneIndexForTransaction`, `phoneIndexId`
- Produces: `CreateOrUpdateTempleDraftInput.allowOrgUnitChange?: boolean`

- [ ] **Step 1: Write the failing integration test**

In `templeRepo.integration.test.ts`, extend / add:

```ts
it('reassigns orgUnitId when allowOrgUnitChange and migrates phone index', async () => {
  const { templeRepo } = await import('#/repositories/templeRepo')
  const { temple } = await templeRepo.createOrUpdateDraft({
    orgUnitId: 'gd-i',
    inviteId: INVITE_ID,
    managerPhones: ['0912345678'],
    patch: { danhHieu: 'Chua Move' },
  })

  const { temple: moved } = await templeRepo.createOrUpdateDraft({
    orgUnitId: 'gd-ii',
    inviteId: null,
    managerPhones: ['0912345678'],
    templeId: temple.id,
    patch: {},
    allowOrgUnitChange: true,
  })
  expect(moved.orgUnitId).toBe('gd-ii')

  const oldIndex = await getDoc(
    doc(adminDb, 'templeManagerPhoneIndex', 'gd-i_0912345678'),
  )
  const newIndex = await getDoc(
    doc(adminDb, 'templeManagerPhoneIndex', 'gd-ii_0912345678'),
  )
  const oldIds = oldIndex.exists()
    ? ((oldIndex.data()?.templeIds as string[]) ?? [])
    : []
  expect(oldIds).not.toContain(temple.id)
  expect(newIndex.data()?.templeIds).toContain(temple.id)
})
```

Keep the existing test that rejects org mismatch **without** `allowOrgUnitChange`.

- [ ] **Step 2: Run integration test to verify it fails**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm test:integration -- src/repositories/templeRepo.integration.test.ts
```

Expected: FAIL — `allowOrgUnitChange` ignored / FORBIDDEN.

- [ ] **Step 3: Implement repo changes**

1. Add to `CreateOrUpdateTempleDraftInput`:

```ts
allowOrgUnitChange?: boolean
```

2. In `createOrUpdateTemple`, replace the hard org mismatch throw with:

```ts
const orgChanged = existing.orgUnitId !== input.orgUnitId
if (orgChanged && !input.allowOrgUnitChange) {
  throw new DomainError(
    'FORBIDDEN',
    'Temple does not belong to this invite org unit',
  )
}
```

3. Before writes, when `existing` and `orgChanged`, **read** old-org phone index docs for every phone in `existing.managerPhones` (all reads before writes). Keep reading new-org indexes for `input.managerPhones` as today.

4. Build updated temple with `orgUnitId: input.orgUnitId` (not `existing.orgUnitId`).

5. After `transaction.set(templeRef, ...)`:
   - If `orgChanged` and `existing`: for each old phone index, `shrinkTemplePhoneIndex(transaction, index, temple.id)`
   - Then run existing append-into-new-index loop for `input.managerPhones` / new org refs

Sketch for the read phase when updating:

```ts
const oldOrgUnitId = existing.orgUnitId
const orgChanged = oldOrgUnitId !== input.orgUnitId
if (orgChanged && !input.allowOrgUnitChange) {
  throw new DomainError(
    'FORBIDDEN',
    'Temple does not belong to this invite org unit',
  )
}

const phoneIndexRefs = input.managerPhones.map((phone) =>
  doc(db, COLLECTIONS.templeManagerPhoneIndex, phoneIndexId(input.orgUnitId, phone)),
)
const phoneIndexSnaps = await Promise.all(
  phoneIndexRefs.map((ref) => transaction.get(ref)),
)

const oldPhoneIndexes =
  existing && orgChanged
    ? await Promise.all(
        existing.managerPhones.map((phone) =>
          readTemplePhoneIndexForTransaction(
            transaction,
            oldOrgUnitId,
            phone,
          ),
        ),
      )
    : []
```

Then after temple write:

```ts
if (existing && orgChanged) {
  oldPhoneIndexes.forEach((index) => {
    shrinkTemplePhoneIndex(transaction, index, temple.id)
  })
}
phoneIndexRefs.forEach((ref, i) => {
  // existing append logic unchanged
})
```

- [ ] **Step 4: Mirror in `memoryStores.ts`**

In `createMemoryTempleStore` → `createOrUpdateDraft`:

```ts
const orgChanged = existing.orgUnitId !== input.orgUnitId
if (orgChanged && !input.allowOrgUnitChange) {
  throw new DomainError(
    'FORBIDDEN',
    'Temple does not belong to this invite org unit',
  )
}
// ...
if (orgChanged) {
  removeTempleFromPhoneIndex(phoneIndex, existing)
}
const temple: Temple = {
  ...existing,
  ...input.patch,
  id: existing.id,
  orgUnitId: input.orgUnitId,
  // status / phones / inviteId same as today
}
temples.set(temple.id, temple)
appendTemplePhoneIndex(phoneIndex, temple)
```

- [ ] **Step 5: Re-run integration tests**

Same command as Step 2. Expected: PASS (including existing reject-without-flag test).

- [ ] **Step 6: Commit**

```bash
git add \
  tanstack-app/src/repositories/templeRepo.ts \
  tanstack-app/src/repositories/templeRepo.integration.test.ts \
  tanstack-app/src/test/memoryStores.ts
git commit -m "$(cat <<'EOF'
feat: migrate temple phone indexes when org unit reassigned

EOF
)"
```

---

### Task 4: `saveAdminTemple` — gate reassignment

**Files:**
- Modify: `tanstack-app/src/use-cases/saveAdminTemple.ts`
- Modify: `tanstack-app/src/use-cases/saveAdminDraft.test.ts`

**Interfaces:**
- Consumes: `isHePhaiAdmin`, `CreateOrUpdateTempleDraftInput.allowOrgUnitChange`
- Produces: same `saveAdminTemple(...)` signature; sets `allowOrgUnitChange: true` only for he-phái admin draft reassignment

- [ ] **Step 1: Write failing use-case tests**

In `saveAdminDraft.test.ts` under `describe('saveAdminTemple')`:

```ts
it('reassigns orgUnitId for he_phai_admin on draft', async () => {
  const store = createMemoryTempleStore([
    {
      id: 't1',
      orgUnitId: 'gd-i',
      status: 'draft',
      managerPhones: ['0901234567'],
      inviteId: 'inv-1',
      photoPath: null,
      danhHieu: 'Old',
      createdAt: '2026-07-19T00:00:00.000Z',
      updatedAt: '2026-07-19T00:00:00.000Z',
      lockedAt: null,
      lockedBy: null,
      editRequestedAt: null,
      editRequestedBy: null,
    },
  ])
  const { temple } = await saveAdminTemple(
    {
      orgUnitId: 'gd-ii',
      templeId: 't1',
      patch: { danhHieu: 'New' },
    },
    ADMIN_AUDIT,
    HE_PHAI_CLAIMS,
    store,
  )
  expect(temple.orgUnitId).toBe('gd-ii')
  expect(temple.danhHieu).toBe('New')
  expect(temple.inviteId).toBe('inv-1')
  expect(store.phoneIndex.get('gd-i_0901234567') ?? []).not.toContain('t1')
  expect(store.phoneIndex.get('gd-ii_0901234567')).toContain('t1')
})

it('rejects org reassignment when temple is locked', async () => {
  const store = createMemoryTempleStore([
    {
      id: 't1',
      orgUnitId: 'gd-i',
      status: 'locked',
      managerPhones: ['0901234567'],
      inviteId: null,
      photoPath: null,
      createdAt: '2026-07-19T00:00:00.000Z',
      updatedAt: '2026-07-19T00:00:00.000Z',
      lockedAt: '2026-07-19T01:00:00.000Z',
      lockedBy: 'admin-1',
      editRequestedAt: null,
      editRequestedBy: null,
    },
  ])
  await expect(
    saveAdminTemple(
      { orgUnitId: 'gd-ii', templeId: 't1', patch: { danhHieu: 'X' } },
      ADMIN_AUDIT,
      HE_PHAI_CLAIMS,
      store,
    ),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' })
})

it('rejects org reassignment for he_phai_secretary', async () => {
  const store = createMemoryTempleStore([
    {
      id: 't1',
      orgUnitId: 'gd-i',
      status: 'draft',
      managerPhones: ['0901234567'],
      inviteId: null,
      photoPath: null,
      createdAt: '2026-07-19T00:00:00.000Z',
      updatedAt: '2026-07-19T00:00:00.000Z',
      lockedAt: null,
      lockedBy: null,
      editRequestedAt: null,
      editRequestedBy: null,
    },
  ])
  await expect(
    saveAdminTemple(
      { orgUnitId: 'gd-ii', templeId: 't1', patch: {} },
      ADMIN_AUDIT,
      { role: 'he_phai_secretary', orgUnitId: null },
      store,
    ),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' })
})
```

Confirm `createMemoryTempleStore` return value exposes `phoneIndex` (it already does via the store object fields used in other tests — if not exported on the return type, assert via `listByOrgAndPhone` instead:

```ts
expect(
  await store.listByOrgAndPhone({ orgUnitId: 'gd-i', phone: '0901234567' }),
).toEqual([])
expect(
  await store.listByOrgAndPhone({ orgUnitId: 'gd-ii', phone: '0901234567' }),
).toHaveLength(1)
```

Prefer `listByOrgAndPhone` if `phoneIndex` is not part of the public store type.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/use-cases/saveAdminDraft.test.ts
```

Expected: FAIL on reassignment (store still freezes org / no flag).

- [ ] **Step 3: Implement `saveAdminTemple`**

```ts
import { canAccessOrgUnit, isHePhaiAdmin, type AuthClaims } from '#/domain/authClaims'
// ...

export async function saveAdminTemple(
  input: SaveAdminTempleInput,
  audit: AuditActor,
  claims: AuthClaims,
  templeStore: TempleStore = templeRepo,
): Promise<{ temple: Temple; mode: 'created' | 'updated' }> {
  if (!canAccessOrgUnit(claims, input.orgUnitId)) {
    throw new DomainError('FORBIDDEN', 'Org unit out of scope')
  }

  const patch = sanitizePatch(input.patch)
  const incomingPhones = {
    explicitPhones: input.explicitPhones ?? [],
    truTriPhone: patch.truTriHienNay?.dienThoai,
  }

  let managerPhones: string[]
  let allowOrgUnitChange = false

  if (input.templeId) {
    const existing = await templeStore.getById(input.templeId)
    if (!existing) {
      throw new DomainError('NOT_FOUND', 'Temple not found')
    }

    const orgChanged = existing.orgUnitId !== input.orgUnitId
    if (orgChanged) {
      if (!isHePhaiAdmin(claims) || existing.status !== 'draft') {
        throw new DomainError('FORBIDDEN', 'Cannot change temple org unit')
      }
      allowOrgUnitChange = true
    }

    managerPhones = mergeManagerPhones(existing.managerPhones, incomingPhones)
  } else {
    managerPhones = buildManagerPhones(incomingPhones)
  }

  return templeStore.createOrUpdateDraft({
    orgUnitId: input.orgUnitId,
    inviteId: null,
    managerPhones,
    templeId: input.templeId,
    patch,
    allowWhenLocked: true,
    allowOrgUnitChange,
    audit,
  })
}
```

- [ ] **Step 4: Re-run use-case tests**

Same command as Step 2. Expected: PASS (including prior locked profile-update test with unchanged org).

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/use-cases/saveAdminTemple.ts tanstack-app/src/use-cases/saveAdminDraft.test.ts
git commit -m "$(cat <<'EOF'
feat: gate temple org reassignment in saveAdminTemple

EOF
)"
```

---

### Task 5: Enable Giáo đoàn Select on temple detail UI

**Files:**
- Modify: `tanstack-app/src/components/admin/TempleFormPage.tsx`
- Modify: `tanstack-app/src/components/admin/TempleFormPage.test.tsx`

**Interfaces:**
- Consumes: `isHePhaiAdmin` from `#/domain/authClaims`
- Produces: Select `disabled` false only for he-phái admin + edit + draft (create behavior unchanged)

- [ ] **Step 1: Write failing UI tests**

Ensure `orgUnitsQuery` mock / `setQueryData` includes both `gd-i` and `gd-ii` if needed for selection. Add:

```tsx
it('enables org unit select for he_phai_admin when temple is draft', async () => {
  templeFixture = draftTemple
  renderForm({ mode: 'edit' })
  const select = await screen.findByRole('combobox', {
    name: new RegExp(`^${m.admin_temples_form_org_unit()}`),
  })
  expect(select).not.toBeDisabled()
})

it('disables org unit select when temple is locked', async () => {
  templeFixture = lockedTemple
  renderForm({ mode: 'edit' })
  const select = await screen.findByRole('combobox', {
    name: new RegExp(`^${m.admin_temples_form_org_unit()}`),
  })
  expect(select).toBeDisabled()
})

it('disables org unit select for giao_doan_admin on edit', async () => {
  useAdminClaimMock.mockReturnValue({
    status: 'admin',
    uid: 'admin-uid',
    role: 'giao_doan_admin',
    orgUnitId: 'gd-i',
  })
  templeFixture = draftTemple
  renderForm({ mode: 'edit' })
  const select = await screen.findByRole('combobox', {
    name: new RegExp(`^${m.admin_temples_form_org_unit()}`),
  })
  expect(select).toBeDisabled()
})
```

Inside existing `describe('he_phai_secretary')`:

```tsx
it('disables org unit select on edit even when draft', async () => {
  templeFixture = draftTemple
  renderForm({ mode: 'edit' })
  const select = await screen.findByRole('combobox', {
    name: new RegExp(`^${m.admin_temples_form_org_unit()}`),
  })
  expect(select).toBeDisabled()
})
```

If Mantine Select puts `disabled` on a wrapper rather than the combobox, assert with the attribute the component actually sets (e.g. `aria-disabled="true"` / parent). Adjust the matcher to match existing patterns in the file after the first run.

- [ ] **Step 2: Run UI tests to verify they fail**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/components/admin/TempleFormPage.test.tsx
```

Expected: FAIL — draft he-phái select still disabled (`disabled={mode === 'edit'}`).

- [ ] **Step 3: Implement UI**

In `TempleFormPage.tsx`:

```tsx
import {
  canManageDirectory,
  isHePhaiAdmin,
  isHePhaiScope,
} from '#/domain/authClaims'
```

Compute:

```tsx
const canEditOrgUnitOnDetail =
  claim.status === 'admin' &&
  isHePhaiAdmin({ role: claim.role, orgUnitId: claim.orgUnitId }) &&
  mode === 'edit' &&
  temple.data?.status === 'draft'

// ...
<Select
  label={m.admin_temples_form_org_unit()}
  data={orgUnitSelectData}
  value={orgUnitId}
  onChange={setOrgUnitId}
  searchable
  required
  disabled={mode === 'edit' && !canEditOrgUnitOnDetail}
/>
```

No other save-path changes: `performSave` already passes `orgUnitId` into `saveAdminTemple`.

- [ ] **Step 4: Re-run UI tests**

Same command as Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add \
  tanstack-app/src/components/admin/TempleFormPage.tsx \
  tanstack-app/src/components/admin/TempleFormPage.test.tsx
git commit -m "$(cat <<'EOF'
feat: enable Giáo đoàn select on draft temple detail for he-phai admin

EOF
)"
```

---

### Task 6: Final verification

- [ ] **Step 1: Run targeted suites**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run \
  src/domain/authClaims.test.ts \
  src/use-cases/saveAdminDraft.test.ts \
  src/components/admin/TempleFormPage.test.tsx

cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm test:integration -- \
  src/firebase/firestoreRules.integration.test.ts \
  src/repositories/templeRepo.integration.test.ts
```

Expected: all PASS.

- [ ] **Step 2: Manual smoke (optional)**

As `he_phai_admin`, open a draft temple detail, change Giáo đoàn, Hoàn tất, confirm list filter by new giáo đoàn shows the temple; locked temple Select stays disabled.

- [ ] **Step 3: No commit unless verification fixed something** — if fixes were needed, commit them with a focused message.

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| he_phai_admin / legacy only | 1, 4, 5 |
| draft-only reassignment | 2, 4, 5 |
| Save via Hoàn tất | 5 (no new control) |
| `allowOrgUnitChange` flag | 3, 4 |
| Phone index migrate | 3 |
| Rules identity exception | 2 |
| Audit via existing diff | 3 (org on temple after write) |
| inviteId preserved | 4 tests |
| UI enabled/disabled matrix | 5 |
| No Cypress / members out of scope | Global constraints |
| Current branch / no worktree | Global constraints |
