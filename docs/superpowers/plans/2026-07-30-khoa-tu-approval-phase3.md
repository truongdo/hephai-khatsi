# Khóa tu — Phase 3: Xét duyệt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins approve/reject retreat registrations (single + bulk, optional rejection reason) on the existing registrations page, and let self-service users re-open `/r/$token` to see their decision status.

**Architecture:** Extend `RetreatRegistration` with `rejectionReason`; add `retreatRegistrationRepo.updateReview` + `reviewRetreatRegistrations` use-case (fail-fast validate-all-then-write). Open Firestore staff `update` with constrained field/transition rules. Admin UI reuses `useAdminListSelection`. Self flow: always load outlet after valid invite+retreat; on confirm route, `getById` first → status screen if exists, else register only when self-registration gate passes.

**Tech Stack:** TypeScript, Firestore (`updateDoc` / `writeBatch`), Vitest (+ `@firebase/rules-unit-testing`), TanStack Router/Query, Mantine, Paraglide (`messages/vi.json`).

## Global Constraints

- Spec: [docs/superpowers/specs/2026-07-30-khoa-tu-approval-phase3-design.md](../specs/2026-07-30-khoa-tu-approval-phase3-design.md)
- Parent roadmap: [docs/superpowers/specs/2026-07-25-khoa-tu-roadmap-design.md](../specs/2026-07-25-khoa-tu-roadmap-design.md)
- Review only when `status === 'pending'` → `approved` | `rejected` (terminal; no undo).
- Review allowed regardless of retreat `open` / registration window.
- `rejectionReason` optional on reject; always `null` on create and approve.
- Bulk: shared optional reason; fail-fast — validate all ids before any write.
- `approvedBy` / `approvedAt` set on both approve and reject.
- No export / Cypress in this phase.
- Import alias: `#/domain/...`, `#/repositories/...`, `#/use-cases/...`, `#/query/...`, `#/components/...`.
- No comments unless explaining non-obvious WHY.
- Workspace rule: implement on a **new branch from `main`** (`feat/khoa-tu-approval-phase3`); do **not** use git worktrees.
- TDD: failing test → implement → pass → commit per task.
- Run unit tests from `tanstack-app`: `pnpm test -- <path>`. Rules: `pnpm test:integration` with emulator.

---

## File Structure

- Modify: `tanstack-app/src/domain/retreatRegistration.ts` — `rejectionReason`; `normalizeRejectionReason`; `assertRegistrationPending`
- Modify: `tanstack-app/src/domain/retreatRegistration.test.ts`
- Modify: `tanstack-app/src/use-cases/createRetreatRegistration.ts` — set `rejectionReason: null`
- Modify: `tanstack-app/src/use-cases/createRetreatRegistration.test.ts` — expect `rejectionReason: null`
- Modify: `tanstack-app/src/repositories/retreatRegistrationRepo.ts` — `updateReview`
- Modify: `tanstack-app/src/repositories/retreatRegistrationRepo.memory.test.ts`
- Create: `tanstack-app/src/use-cases/reviewRetreatRegistrations.ts` (+ test)
- Modify: `firebase/firestore.rules` — registration update; create requires `rejectionReason == null`
- Modify: `tanstack-app/src/firebase/firestoreRules.integration.test.ts`
- Modify: `tanstack-app/src/query/registrationKeys.ts`, `registrationQueries.ts` — public registration by id query
- Modify: `tanstack-app/src/routes/r.$token.tsx` — always render outlet after valid invite+retreat
- Create: `tanstack-app/src/components/registration/RetreatRegistrationStatus.tsx` (+ test)
- Modify: `tanstack-app/src/components/registration/RetreatRegistrationConfirm.tsx` (+ test) — status branch
- Modify: `tanstack-app/src/components/admin/RetreatRegistrationsPage.tsx` (+ test) — selection + review UI
- Modify: `tanstack-app/messages/vi.json`
- Modify: roadmap Phase 3 status → Đã lập kế hoạch / Đang thực hiện as appropriate

---

### Task 1: Domain — `rejectionReason` + pending guard

**Files:**
- Modify: `tanstack-app/src/domain/retreatRegistration.ts`
- Modify: `tanstack-app/src/domain/retreatRegistration.test.ts`

**Interfaces:**
- Consumes: existing `RetreatRegistration` / `RegistrationStatus`
- Produces:
  - `RetreatRegistration.rejectionReason: string | null`
  - `export function normalizeRejectionReason(raw: string | null | undefined): string | null` — trim; empty → `null`
  - `export function assertRegistrationPending(status: RegistrationStatus): void` — throws `DomainError('INVALID_STATUS', ...)` unless `pending`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { DomainError } from './errors'
import {
  assertRegistrationPending,
  normalizeRejectionReason,
} from './retreatRegistration'

describe('normalizeRejectionReason', () => {
  it('trims and maps empty to null', () => {
    expect(normalizeRejectionReason('  lý do  ')).toBe('lý do')
    expect(normalizeRejectionReason('   ')).toBeNull()
    expect(normalizeRejectionReason(null)).toBeNull()
    expect(normalizeRejectionReason(undefined)).toBeNull()
  })
})

describe('assertRegistrationPending', () => {
  it('allows pending', () => {
    expect(() => assertRegistrationPending('pending')).not.toThrow()
  })
  it('rejects approved and rejected', () => {
    expect(() => assertRegistrationPending('approved')).toThrow(DomainError)
    expect(() => assertRegistrationPending('rejected')).toThrow(DomainError)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tanstack-app && pnpm test -- src/domain/retreatRegistration.test.ts`

Expected: FAIL — exports missing / type incomplete

- [ ] **Step 3: Write minimal implementation**

Add to `RetreatRegistration`:

```ts
rejectionReason: string | null
```

```ts
export function normalizeRejectionReason(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function assertRegistrationPending(status: RegistrationStatus): void {
  if (status !== 'pending') {
    throw new DomainError('INVALID_STATUS', 'Registration is not pending')
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tanstack-app && pnpm test -- src/domain/retreatRegistration.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/domain/retreatRegistration.ts tanstack-app/src/domain/retreatRegistration.test.ts
git commit -m "feat: add registration rejectionReason and pending guard"
```

---

### Task 2: Create path writes `rejectionReason: null`

**Files:**
- Modify: `tanstack-app/src/use-cases/createRetreatRegistration.ts`
- Modify: `tanstack-app/src/use-cases/createRetreatRegistration.test.ts`
- Modify: `tanstack-app/src/repositories/retreatRegistrationRepo.memory.test.ts` (`sampleRegistration`)
- Modify: any other test fixtures that construct `RetreatRegistration` literals (fix compile errors)

**Interfaces:**
- Consumes: Task 1 type
- Produces: creates always include `rejectionReason: null`

- [ ] **Step 1: Extend failing assertions in create tests**

In `createRetreatRegistration.test.ts`, on successful create expectations add:

```ts
rejectionReason: null,
```

Update `sampleRegistration` in memory repo test:

```ts
rejectionReason: overrides.rejectionReason ?? null,
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tanstack-app && pnpm test -- src/use-cases/createRetreatRegistration.test.ts src/repositories/retreatRegistrationRepo.memory.test.ts`

Expected: FAIL — missing `rejectionReason` on created object / type errors

- [ ] **Step 3: Implement**

In `createRetreatRegistration.ts` registration literal:

```ts
rejectionReason: null,
```

Fix all compile-breaking fixtures the same way.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tanstack-app && pnpm test -- src/use-cases/createRetreatRegistration.test.ts src/repositories/retreatRegistrationRepo.memory.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/use-cases/createRetreatRegistration.ts tanstack-app/src/use-cases/createRetreatRegistration.test.ts tanstack-app/src/repositories/retreatRegistrationRepo.memory.test.ts
git commit -m "feat: persist rejectionReason null on registration create"
```

---

### Task 3: Repo `updateReview`

**Files:**
- Modify: `tanstack-app/src/repositories/retreatRegistrationRepo.ts`
- Modify: `tanstack-app/src/repositories/retreatRegistrationRepo.memory.test.ts`

**Interfaces:**
- Consumes: `RetreatRegistration` with `rejectionReason`
- Produces:

```ts
export type RegistrationReviewPatch = {
  status: 'approved' | 'rejected'
  approvedBy: string
  approvedAt: string
  rejectionReason: string | null
  updatedAt: string
}

// on RetreatRegistrationStore:
updateReview(ids: string[], patch: RegistrationReviewPatch): Promise<void>
```

Implementation: `writeBatch` + `updateDoc`-style field updates (only patch fields). Chunk if `ids.length > 450` (stay under Firestore 500 batch limit). Memory store merges patch onto each id (throw if missing — use-case validates first, but memory may assert).

- [ ] **Step 1: Write the failing memory test**

```ts
it('updateReview patches status fields for each id', async () => {
  const store = createMemoryRetreatRegistrationStore()
  const a = sampleRegistration({ retreatId: 'r1', memberId: 'm1' })
  const b = sampleRegistration({ retreatId: 'r1', memberId: 'm2' })
  await store.create(a)
  await store.create(b)

  await store.updateReview([a.id, b.id], {
    status: 'rejected',
    approvedBy: 'admin-1',
    approvedAt: '2026-07-30T12:00:00.000Z',
    rejectionReason: 'đủ chỉ tiêu',
    updatedAt: '2026-07-30T12:00:00.000Z',
  })

  expect(await store.getById(a.id)).toMatchObject({
    status: 'rejected',
    approvedBy: 'admin-1',
    rejectionReason: 'đủ chỉ tiêu',
  })
  expect(await store.getById(b.id)).toMatchObject({ status: 'rejected' })
})
```

Extend memory store type with `updateReview` stub that throws `not implemented` so the test fails meaningfully, or omit method so TypeScript fails — prefer implementing the interface and failing test until real merge works.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tanstack-app && pnpm test -- src/repositories/retreatRegistrationRepo.memory.test.ts`

Expected: FAIL — `updateReview` missing

- [ ] **Step 3: Implement repo + memory**

```ts
import { writeBatch, updateDoc, doc } from 'firebase/firestore'

async function updateReview(
  ids: string[],
  patch: RegistrationReviewPatch,
): Promise<void> {
  const db = requireDb()
  const chunkSize = 450
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    const batch = writeBatch(db)
    for (const id of chunk) {
      batch.update(doc(db, COLLECTIONS.retreatRegistrations, id), { ...patch })
    }
    await batch.commit()
  }
}
```

Memory:

```ts
async updateReview(ids, patch) {
  for (const id of ids) {
    const existing = registrations.get(id)
    if (!existing) throw new Error(`Missing registration ${id}`)
    registrations.set(id, { ...existing, ...patch })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tanstack-app && pnpm test -- src/repositories/retreatRegistrationRepo.memory.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/repositories/retreatRegistrationRepo.ts tanstack-app/src/repositories/retreatRegistrationRepo.memory.test.ts
git commit -m "feat: add retreatRegistrationRepo.updateReview"
```

---

### Task 4: Use-case `reviewRetreatRegistrations`

**Files:**
- Create: `tanstack-app/src/use-cases/reviewRetreatRegistrations.ts`
- Create: `tanstack-app/src/use-cases/reviewRetreatRegistrations.test.ts`

**Interfaces:**
- Consumes: `canManageRetreats`, `canAccessOrgUnit`, `assertRegistrationPending`, `normalizeRejectionReason`, `retreatRepo.getById`, `registrationStore.getById` + `updateReview`
- Produces:

```ts
export type ReviewDecision = 'approved' | 'rejected'

export type ReviewRetreatRegistrationsInput = {
  claims: AuthClaims
  reviewerUid: string
  retreatId: string
  ids: string[]
  decision: ReviewDecision
  rejectionReason?: string | null
  nowIso?: string
}

export async function reviewRetreatRegistrations(
  input: ReviewRetreatRegistrationsInput,
  deps?: {
    retreatStore?: Pick<RetreatStore, 'getById'>
    registrationStore?: Pick<RetreatRegistrationStore, 'getById' | 'updateReview'>
  },
): Promise<void>
```

Logic:
1. If `ids.length === 0` → `INVALID_INPUT`
2. If `!canManageRetreats(claims)` → `FORBIDDEN`
3. Load retreat; missing → `NOT_FOUND`; `!canAccessOrgUnit(claims, retreat.orgUnitId)` → `FORBIDDEN`
4. For each id: `getById`; missing → `NOT_FOUND`; `reg.retreatId !== input.retreatId` → `INVALID_INPUT`; `assertRegistrationPending(reg.status)`
5. Build patch: `status: decision`, `approvedBy: reviewerUid`, `approvedAt: nowIso`, `updatedAt: nowIso`, `rejectionReason: decision === 'approved' ? null : normalizeRejectionReason(input.rejectionReason)`
6. `await registrationStore.updateReview(ids, patch)`

- [ ] **Step 1: Write failing tests** (memory stores)

Cover at least:
- approve sets status + null reason
- reject with blank reason → null; with text → trimmed
- fails when any id already approved (nothing written — spy `updateReview` not called)
- fails wrong org for `giao_doan_admin`
- succeeds when retreat `status: 'closed'`
- fails empty ids

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tanstack-app && pnpm test -- src/use-cases/reviewRetreatRegistrations.test.ts`

Expected: FAIL — module missing

- [ ] **Step 3: Implement use-case**

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tanstack-app && pnpm test -- src/use-cases/reviewRetreatRegistrations.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/use-cases/reviewRetreatRegistrations.ts tanstack-app/src/use-cases/reviewRetreatRegistrations.test.ts
git commit -m "feat: add reviewRetreatRegistrations use-case"
```

---

### Task 5: Firestore rules + integration tests

**Files:**
- Modify: `firebase/firestore.rules` (`match /retreatRegistrations/{id}`)
- Modify: `tanstack-app/src/firebase/firestoreRules.integration.test.ts`

**Interfaces:**
- Consumes: existing `canWriteDirectory`, `retreatOrgOk`
- Produces: staff update allowed under constraints; create requires `rejectionReason == null`

Rules sketch:

```
function registrationCreateShape(data) {
  return data.status == 'pending'
    && data.approvedBy == null
    && data.approvedAt == null
    && data.rejectionReason == null
    && registrationIdOk(data);
}

function registrationReviewKeysOnly() {
  return request.resource.data.diff(resource.data).affectedKeys()
    .hasOnly(['status', 'approvedBy', 'approvedAt', 'rejectionReason', 'updatedAt']);
}

function registrationImmutableOk() {
  return request.resource.data.retreatId == resource.data.retreatId
    && request.resource.data.memberId == resource.data.memberId
    && request.resource.data.orgUnitId == resource.data.orgUnitId
    && request.resource.data.registeredVia == resource.data.registeredVia
    && request.resource.data.registeredBy == resource.data.registeredBy
    && request.resource.data.extraAnswers == resource.data.extraAnswers
    && request.resource.data.createdAt == resource.data.createdAt
    && registrationIdOk(request.resource.data);
}

function validRegistrationReview() {
  return resource.data.status == 'pending'
    && (request.resource.data.status == 'approved' || request.resource.data.status == 'rejected')
    && request.resource.data.approvedBy == request.auth.uid
    && request.resource.data.approvedAt is string
    && request.resource.data.updatedAt is string
    && (
      (request.resource.data.status == 'approved' && request.resource.data.rejectionReason == null)
      || (request.resource.data.status == 'rejected'
          && (request.resource.data.rejectionReason == null
              || (request.resource.data.rejectionReason is string
                  && request.resource.data.rejectionReason.size() > 0)))
    );
}

allow update: if canWriteDirectory()
  && retreatOrgOk(resource.data.orgUnitId)
  && registrationReviewKeysOnly()
  && registrationImmutableOk()
  && validRegistrationReview();
allow delete: if false;
```

Update `registrationDraft()` helper to include `rejectionReason: null`.

Replace test `denies staff update of registration status` with:
- allows he_phai / giao_doan own-org approve and reject (with/without reason)
- denies anon update
- denies giao_doan cross-org update
- denies update when already `approved`
- denies changing `memberId` alongside status

- [ ] **Step 1: Write failing integration assertions** (flip expect on approve success)

- [ ] **Step 2: Run integration suite (expect FAIL on new allows)**

Run: `cd tanstack-app && pnpm emulator` (other terminal) then `pnpm test:integration -- src/firebase/firestoreRules.integration.test.ts`

Expected: FAIL — updates still denied / create missing `rejectionReason`

- [ ] **Step 3: Update rules**

- [ ] **Step 4: Re-run integration tests**

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add firebase/firestore.rules tanstack-app/src/firebase/firestoreRules.integration.test.ts
git commit -m "feat: allow scoped registration status updates in Firestore rules"
```

---

### Task 6: Admin registrations UI — select + approve/reject

**Files:**
- Modify: `tanstack-app/src/components/admin/RetreatRegistrationsPage.tsx`
- Modify: `tanstack-app/src/components/admin/RetreatRegistrationsPage.test.tsx`
- Modify: `tanstack-app/messages/vi.json` (review copy keys)

**Interfaces:**
- Consumes: `reviewRetreatRegistrations`, `useAdminListSelection`, existing list query
- Produces: checkbox column; toolbar Duyệt / Từ chối; row actions for `pending`; reject `Modal` with optional `Textarea`; on success clear selection + `invalidateQueries(adminKeys.retreatRegistrations(retreatId))`

Copy keys (Vietnamese):
- `admin_retreat_registrations_subtitle` → update away from “chỉ xem” (e.g. “Danh sách đăng ký”)
- `admin_retreat_registrations_approve`
- `admin_retreat_registrations_reject`
- `admin_retreat_registrations_reject_title`
- `admin_retreat_registrations_reject_reason_label`
- `admin_retreat_registrations_reject_confirm`
- `admin_retreat_registrations_approve_confirm_title` / body (optional confirm modal or `window.confirm` — prefer Mantine `Modal` consistent with reject)
- `admin_retreat_registrations_col_actions`
- `admin_retreat_registrations_reason` (show truncated under rejected badge)

Pattern: mirror checkbox + toolbar from `MembersListPage.tsx` (`useAdminListSelection(itemIds)` where `itemIds = allItems.map(r => r.id)`).

Only enable bulk actions when every selected id is `pending` (or filter selection to pending-only on action and show error if any non-pending — prefer: disable approve/reject if selection includes non-pending; clearer UX).

- [ ] **Step 1: Write failing component tests**

```ts
it('shows approve and reject when a pending row is selected', async () => {
  // mock retreat + registrations query with one pending item
  // check checkbox → expect buttons with approve/reject labels
})

it('does not show row review actions for approved registrations', async () => {
  // approved item → no approve button in row
})
```

Mock `reviewRetreatRegistrations` via vi.mock.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tanstack-app && pnpm test -- src/components/admin/RetreatRegistrationsPage.test.tsx`

Expected: FAIL

- [ ] **Step 3: Implement UI + messages**

- [ ] **Step 4: Run test to verify it passes**

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/admin/RetreatRegistrationsPage.tsx tanstack-app/src/components/admin/RetreatRegistrationsPage.test.tsx tanstack-app/messages/vi.json
git commit -m "feat: admin approve and reject retreat registrations"
```

---

### Task 7: Self status — layout + query + status UI

**Files:**
- Modify: `tanstack-app/src/routes/r.$token.tsx` — always wrap `Outlet` in `RegistrationRouteProvider` when invite+retreat valid; keep showing `RetreatRegistrationGateAlert` when `gateCode` is set (informational), but **do not** unmount outlet
- Modify: `tanstack-app/src/query/registrationKeys.ts` — add `registration: (id: string) => ...`
- Modify: `tanstack-app/src/query/registrationQueries.ts` — `publicRegistrationQuery(id)` via `retreatRegistrationRepo.getById`
- Create: `tanstack-app/src/components/registration/RetreatRegistrationStatus.tsx` (+ test)
- Modify: `tanstack-app/src/components/registration/RetreatRegistrationConfirm.tsx` (+ test)
- Modify: `tanstack-app/src/components/registration/RetreatRegistrationEntry.tsx` — if gate closed, still allow phone lookup / navigate to register for status; block “new member” create path when gate closed (show gate message)
- Modify: `tanstack-app/messages/vi.json` — status titles/bodies

**Interfaces:**
- Consumes: `retreatRegistrationId`, `publicRegistrationQuery`, `getRetreatSelfRegistrationGate`
- Produces: `RetreatRegistrationStatus({ registration, member })` showing pending/approved/rejected + reason

`RetreatRegistrationConfirm` flow:
1. `useQuery(publicRegistrationQuery(retreatRegistrationId(retreat.id, member.id)))`
2. If data → render `RetreatRegistrationStatus`
3. Else if `getRetreatSelfRegistrationGate(retreat)` → render `RetreatRegistrationGateAlert` only
4. Else → existing extraAnswers form

Layout change is required so closed retreats still reach confirm for status.

- [ ] **Step 1: Write failing tests for Status + Confirm branch**

```ts
it('shows approved status when registration already exists', async () => {
  // mock query returning approved registration → expect status copy, no submit button
})

it('shows gate instead of form when no registration and retreat closed', async () => {
  // mock null registration + closed retreat → gate alert, no submit
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tanstack-app && pnpm test -- src/components/registration/RetreatRegistrationStatus.test.tsx src/components/registration/RetreatRegistrationConfirm.test.tsx`

Expected: FAIL

- [ ] **Step 3: Implement layout, query, components, entry gate for new-member only**

- [ ] **Step 4: Run tests to verify they pass**

Also re-run related registration entry/layout tests if any break.

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/routes/r.\$token.tsx tanstack-app/src/query/registrationKeys.ts tanstack-app/src/query/registrationQueries.ts tanstack-app/src/components/registration/RetreatRegistrationStatus.tsx tanstack-app/src/components/registration/RetreatRegistrationStatus.test.tsx tanstack-app/src/components/registration/RetreatRegistrationConfirm.tsx tanstack-app/src/components/registration/RetreatRegistrationConfirm.test.tsx tanstack-app/src/components/registration/RetreatRegistrationEntry.tsx tanstack-app/messages/vi.json
git commit -m "feat: show retreat registration status on self return visit"
```

---

### Task 8: Roadmap status + smoke checklist note

**Files:**
- Modify: `docs/superpowers/specs/2026-07-25-khoa-tu-roadmap-design.md` — Phase 3 → Đang thực hiện / Hoàn thành when done; link plan file

- [ ] **Step 1: Update roadmap table**

Set Phase 3 plan link to `../plans/2026-07-30-khoa-tu-approval-phase3.md`. While implementing: `Đang thực hiện`. After final smoke (human): `Hoàn thành`.

Suggested smoke (document under Next step, do not automate):
1. Pending row → approve → badge approved; self `/r` shows approved
2. Pending → reject with reason → self sees reason
3. Bulk approve two pending
4. Approve still works after close retreat
5. Cannot re-register same member

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-07-25-khoa-tu-roadmap-design.md
git commit -m "docs: mark Phase 3 approval in progress on roadmap"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| `rejectionReason` optional | 1, 4, 6 |
| Single + bulk approve/reject | 4, 6 |
| Terminal pending→approved/rejected | 1, 4, 5 |
| Review when retreat closed | 4 tests, 5, 7 |
| Fail-fast bulk | 4 |
| Staff-scoped rules update | 5 |
| Create writes `rejectionReason: null` | 2, 5 |
| Self status via `/r` without open gate | 7 |
| No export / no undo | out of scope (no tasks) |
| Admin extends existing registrations page | 6 |

**Placeholder scan:** none intentional.  
**Type consistency:** `RegistrationReviewPatch` / `ReviewDecision` / `updateReview` names aligned across Tasks 3–6.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-30-khoa-tu-approval-phase3.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with executing-plans checkpoints  

Which approach?
