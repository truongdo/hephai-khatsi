# Filler Entry Phone Lookup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/f/$token` entry phone-only, look up members by phone via a new index, and collect CCCD on the new-member editor before first save.

**Architecture:** Mirror `templeManagerPhoneIndex` with `memberPhoneIndex` (`{orgUnitId}_{sanghaType}_{phone}` → `{ memberIds }`). Entry form validates phone for all types; temple resume unchanged; member resume returns 0/1/N matches. New-member create URL carries `phone` (not `cccd`); CCCD is editable until first create.

**Tech Stack:** React 19, Mantine 9, TanStack Router + Query, Firebase Firestore, Paraglide, Vitest + Testing Library

**Spec:** `docs/superpowers/specs/2026-07-20-filler-entry-phone-lookup-design.md`

## Global Constraints

- Work in the current workspace only — **never** `git worktree add`
- Branch from `feat/filler-full-editors` if that work is not on `main` yet; otherwise branch from `main` as `feat/filler-entry-phone-lookup`
- Prefer Vitest; no new Cypress in this plan (update existing smoke only if it asserts CCCD on entry)
- Grow-only phone index (cap 20); filter stale ids on read — do not shrink index docs
- CCCD remains the member document id
- After merge squash into `main`, delete the local feature branch unless asked otherwise

## File Structure

| File | Responsibility |
| --- | --- |
| `tanstack-app/messages/vi.json` | Phone descriptions, member pick copy; stop using entry CCCD helper |
| `tanstack-app/src/firebase/collections.ts` | Add `memberPhoneIndex` |
| `firebase/firestore.rules` | Rules for `memberPhoneIndex` |
| `tanstack-app/src/domain/memberPhoneIndex.ts` | `memberPhoneIndexId` helper |
| `tanstack-app/src/repositories/memberRepo.ts` | Index writes + `listByOrgSanghaAndPhone` |
| `tanstack-app/src/test/memoryStores.ts` | In-memory phone index for unit tests |
| `tanstack-app/src/use-cases/resumeMemberByPhone.ts` | Public resume by phone |
| `tanstack-app/src/components/filler/FillerEntryForm.tsx` | Phone-only entry UI |
| `tanstack-app/src/routes/f.$token.index.tsx` | Wire member phone resume + pick list |
| `tanstack-app/src/routes/f.$token.edit.member.index.tsx` | Search `{ orgUnitId, sanghaType, phone }` |
| `tanstack-app/src/components/filler/MemberEditorForm.tsx` | Editable CCCD on create; seed phone |

---

### Task 0: Branch

- [ ] **Step 1: Confirm base and create branch**

```bash
git status -sb
git branch --show-current
# If on feat/filler-full-editors (or editors not on main):
git checkout -b feat/filler-entry-phone-lookup
# If editors already merged to main:
# git checkout main && git pull && git checkout -b feat/filler-entry-phone-lookup
```

- [ ] **Step 2: Commit nothing yet** — branch only

---

### Task 1: i18n, collection constant, Firestore rules

**Files:**
- Modify: `tanstack-app/messages/vi.json`
- Modify: `tanstack-app/src/firebase/collections.ts`
- Modify: `firebase/firestore.rules`
- Test: `tanstack-app/src/firebase/firestoreRules.integration.test.ts`

**Interfaces:**
- Produces: message keys `filler_phone_description_member`, `filler_phone_description_temple`, `filler_identity_pick_member`; collection key `memberPhoneIndex`; rules matching temple index pattern

- [ ] **Step 1: Add messages** in `tanstack-app/messages/vi.json` (keep unused `filler_cccd_label` / `filler_identity_helper` for now; entry will stop calling them):

```json
"filler_phone_description_member": "Số điện thoại để tìm hồ sơ Tăng/Ni đã có.",
"filler_phone_description_temple": "Số điện thoại quản lý để tìm tịnh xá đã có.",
"filler_identity_pick_member": "Chọn hồ sơ đã có"
```

Run Paraglide compile if the project does not auto-compile on next `pnpm` script (usually `pnpm --filter tanstack-app build` or the app’s existing `paraglide` step). Prefer running the nearest test that imports `m` after edits.

- [ ] **Step 2: Add collection**

```typescript
// tanstack-app/src/firebase/collections.ts
export const COLLECTIONS = {
  orgUnits: 'orgUnits',
  invites: 'invites',
  temples: 'temples',
  members: 'members',
  templeManagerPhoneIndex: 'templeManagerPhoneIndex',
  memberPhoneIndex: 'memberPhoneIndex',
} as const
```

- [ ] **Step 3: Add rules** after the `templeManagerPhoneIndex` block in `firebase/firestore.rules`:

```
match /memberPhoneIndex/{indexId} {
  allow get: if true;
  allow list: if isAdmin();
  allow create, update: if request.resource.data.memberIds is list
    && request.resource.data.memberIds.size() <= 20
    && request.resource.data.memberIds.size() >= (resource == null ? 0 : resource.data.memberIds.size());
  allow delete: if false;
}
```

- [ ] **Step 4: Write failing rules test** in `firestoreRules.integration.test.ts`:

```typescript
describe('memberPhoneIndex', () => {
  it('anyone can get, only admin can list, and the id list can only grow up to the cap', async () => {
    const env = await getTestEnv()
    const anon = env.unauthenticatedContext().firestore()
    await assertSucceeds(
      setDoc(doc(anon, 'memberPhoneIndex', 'gd-i_tang_0912345678'), {
        memberIds: ['member-1'],
      }),
    )
    await assertSucceeds(getDoc(doc(anon, 'memberPhoneIndex', 'gd-i_tang_0912345678')))
    await assertFails(getDocs(fsCollection(anon, 'memberPhoneIndex')))
    await assertFails(
      updateDoc(doc(anon, 'memberPhoneIndex', 'gd-i_tang_0912345678'), {
        memberIds: [],
      }),
    )
  })
})
```

- [ ] **Step 5: Run rules test**

Run: `pnpm --filter tanstack-app exec vitest run src/firebase/firestoreRules.integration.test.ts -t memberPhoneIndex`

Expected: PASS (rules already added in Step 3)

- [ ] **Step 6: Commit**

```bash
git add tanstack-app/messages/vi.json tanstack-app/src/firebase/collections.ts firebase/firestore.rules tanstack-app/src/firebase/firestoreRules.integration.test.ts
git commit -m "$(cat <<'EOF'
feat: add member phone index collection and entry i18n

EOF
)"
```

---

### Task 2: `memberPhoneIndexId` helper

**Files:**
- Create: `tanstack-app/src/domain/memberPhoneIndex.ts`
- Modify: `tanstack-app/src/domain/normalize.test.ts` (or add `memberPhoneIndex.test.ts`)

**Interfaces:**
- Produces: `memberPhoneIndexId(orgUnitId, sanghaType, phone): string`

- [ ] **Step 1: Write failing test**

```typescript
import { memberPhoneIndexId } from './memberPhoneIndex'

describe('memberPhoneIndexId', () => {
  it('joins org, sangha type, and phone', () => {
    expect(memberPhoneIndexId('gd-i', 'tang', '0901234567')).toBe(
      'gd-i_tang_0901234567',
    )
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `pnpm --filter tanstack-app exec vitest run src/domain/normalize.test.ts` (or the new test file)

- [ ] **Step 3: Implement**

```typescript
// tanstack-app/src/domain/memberPhoneIndex.ts
import type { SanghaType } from './types'

export function memberPhoneIndexId(
  orgUnitId: string,
  sanghaType: SanghaType,
  phone: string,
): string {
  return `${orgUnitId}_${sanghaType}_${phone}`
}
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/domain/memberPhoneIndex.ts tanstack-app/src/domain/normalize.test.ts
git commit -m "$(cat <<'EOF'
feat: add memberPhoneIndexId helper

EOF
)"
```

---

### Task 3: Member repo phone index + lookup + memory store

**Files:**
- Modify: `tanstack-app/src/repositories/memberRepo.ts`
- Modify: `tanstack-app/src/test/memoryStores.ts`
- Test: `tanstack-app/src/use-cases/memberDraft.test.ts` (extend) or new `memberPhoneIndex.memory.test.ts`

**Interfaces:**
- Consumes: `memberPhoneIndexId`, `COLLECTIONS.memberPhoneIndex`, `normalizeVnPhone`
- Produces on `MemberStore`:
  - `listByOrgSanghaAndPhone(input: { orgUnitId, sanghaType, phone }): Promise<Member[]>`
- Index write inside `createOrUpdateDraft` and `updateDraftById` when final `dienThoai` normalizes successfully

- [ ] **Step 1: Write failing memory-store test**

```typescript
import { createMemoryMemberStore } from '#/test/memoryStores'
import { normalizeVnPhone } from '#/domain/normalize'

it('indexes dienThoai and lists members by org/sangha/phone', async () => {
  const store = createMemoryMemberStore()
  const phone = normalizeVnPhone('0901 234 567')
  const { member } = await store.createOrUpdateDraft({
    orgUnitId: 'gd-i',
    sanghaType: 'tang',
    inviteId: 'public',
    cccd: '012345678901',
    patch: { dienThoai: phone, phapDanh: 'Minh Tam' },
  })

  const found = await store.listByOrgSanghaAndPhone({
    orgUnitId: 'gd-i',
    sanghaType: 'tang',
    phone,
  })
  expect(found.map((m) => m.id)).toEqual([member.id])

  const wrongSangha = await store.listByOrgSanghaAndPhone({
    orgUnitId: 'gd-i',
    sanghaType: 'ni',
    phone,
  })
  expect(wrongSangha).toEqual([])
})
```

- [ ] **Step 2: Run test — expect FAIL** (method missing)

- [ ] **Step 3: Extend `MemberStore` + Firestore `memberRepo`**

Add constant `PHONE_INDEX_CAP = 20`.

Helper to write index (all reads before writes in the same transaction):

```typescript
async function readPhoneIndexForTransaction(
  transaction: Transaction,
  orgUnitId: string,
  sanghaType: SanghaType,
  rawPhone: string | undefined,
) {
  if (!rawPhone) return null
  let phone: string
  try {
    phone = normalizeVnPhone(rawPhone)
  } catch {
    return null
  }
  const ref = doc(
    requireDb(),
    COLLECTIONS.memberPhoneIndex,
    memberPhoneIndexId(orgUnitId, sanghaType, phone),
  )
  const snap = await transaction.get(ref)
  return { ref, snap, phone }
}

function writePhoneIndex(
  transaction: Transaction,
  index: { ref: DocumentReference; snap: DocumentSnapshot } | null,
  memberId: string,
) {
  if (!index) return
  const existingIds =
    (index.snap.exists()
      ? (index.snap.data()?.memberIds as string[] | undefined)
      : undefined) ?? []
  if (existingIds.includes(memberId) || existingIds.length >= PHONE_INDEX_CAP) {
    return
  }
  transaction.set(index.ref, { memberIds: [...existingIds, memberId] })
}
```

In `createOrUpdateDraft` / `updateDraftById`: after computing the final `member` object, **before** any writes, `await readPhoneIndexForTransaction(...)` using `member.dienThoai`, then `transaction.set` member, then `writePhoneIndex`.

Implement `listByOrgSanghaAndPhone`:

```typescript
async function listByOrgSanghaAndPhone(input: {
  orgUnitId: string
  sanghaType: SanghaType
  phone: string
}): Promise<Member[]> {
  const db = requireDb()
  const phone = input.phone // already normalized by use-case
  const indexSnap = await getDoc(
    doc(
      db,
      COLLECTIONS.memberPhoneIndex,
      memberPhoneIndexId(input.orgUnitId, input.sanghaType, phone),
    ),
  )
  if (!indexSnap.exists()) return []
  const memberIds =
    (indexSnap.data().memberIds as string[] | undefined) ?? []
  const members = await Promise.all(
    memberIds.map(async (id) => {
      const snap = await getDoc(doc(db, COLLECTIONS.members, id))
      return snap.exists() ? memberFromSnap(snap) : null
    }),
  )
  return members.filter((m): m is Member => {
    if (!m) return false
    if (m.orgUnitId !== input.orgUnitId || m.sanghaType !== input.sanghaType) {
      return false
    }
    try {
      return normalizeVnPhone(m.dienThoai ?? '') === phone
    } catch {
      return false
    }
  })
}
```

Export on `memberRepo` / `MemberStore`.

- [ ] **Step 4: Update `createMemoryMemberStore`**

Add `phoneIndex: Map<string, string[]>` keyed by `memberPhoneIndexId`. On `createOrUpdateDraft` / `updateDraftById`, if `member.dienThoai` normalizes, append id (cap 20). Implement `listByOrgSanghaAndPhone` with the same filter logic.

- [ ] **Step 5: Run memory test — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add tanstack-app/src/repositories/memberRepo.ts tanstack-app/src/test/memoryStores.ts tanstack-app/src/**/*.test.ts
git commit -m "$(cat <<'EOF'
feat: index members by phone for resume lookup

EOF
)"
```

---

### Task 4: `resumeMemberByPhone` use-case

**Files:**
- Create: `tanstack-app/src/use-cases/resumeMemberByPhone.ts`
- Test: `tanstack-app/src/use-cases/memberDraft.test.ts` (add cases) or `resumeMemberByPhone.test.ts`

**Interfaces:**
- Consumes: `memberStore.listByOrgSanghaAndPhone`, `getInviteByToken`, `normalizeVnPhone`
- Produces:

```typescript
export type ResumeMemberByPhoneInput = {
  token: string
  orgUnitId: string
  sanghaType: SanghaType
  phone: string
}

export async function resumeMemberByPhone(
  input: ResumeMemberByPhoneInput,
  memberStore?: MemberStore,
  inviteStore?: InviteStore,
): Promise<{ members: Array<{ member: Member; access: 'edit' | 'view' }> }>
```

- [ ] **Step 1: Write failing tests**

```typescript
it('returns empty members when phone has no index hits', async () => {
  const store = createMemoryMemberStore()
  const result = await resumeMemberByPhone(
    {
      token: 'public',
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      phone: '0901234567',
    },
    store,
    inviteMemory,
  )
  expect(result.members).toEqual([])
})

it('returns matching members with access from status', async () => {
  const store = createMemoryMemberStore([
    {
      /* draft member with dienThoai 0901234567, org gd-i, tang */
    },
  ])
  // seed phoneIndex via createOrUpdateDraft in arrange
  const result = await resumeMemberByPhone(
    { token: 'public', orgUnitId: 'gd-i', sanghaType: 'tang', phone: '0901.234.567' },
    store,
    inviteMemory,
  )
  expect(result.members).toHaveLength(1)
  expect(result.members[0]!.access).toBe('edit')
})
```

Use the same invite memory pattern as existing `memberDraft.test.ts`.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement** (mirror `resumeTemplesByPhone.ts`):

```typescript
export async function resumeMemberByPhone(
  input: ResumeMemberByPhoneInput,
  memberStore: MemberStore = memberRepo,
  inviteStore: InviteStore = inviteRepo,
) {
  const phone = normalizeVnPhone(input.phone)
  await getInviteByToken(input.token, inviteStore)
  const members = await memberStore.listByOrgSanghaAndPhone({
    orgUnitId: input.orgUnitId,
    sanghaType: input.sanghaType,
    phone,
  })
  return {
    members: members.map((member) => ({
      member,
      access: member.status === 'locked' ? ('view' as const) : ('edit' as const),
    })),
  }
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/use-cases/resumeMemberByPhone.ts tanstack-app/src/use-cases/*.test.ts
git commit -m "$(cat <<'EOF'
feat: resume members by phone

EOF
)"
```

---

### Task 5: `FillerEntryForm` phone-only UI

**Files:**
- Modify: `tanstack-app/src/components/filler/FillerEntryForm.tsx`
- Modify: `tanstack-app/src/components/filler/FillerEntryForm.test.tsx`

**Interfaces:**
- Produces submit payload `{ formType, orgUnitId, phone }` (no `cccd`)
- Props: add `memberMatches?: Array<{ id: string; label: string }>`, `onPickMember?: (memberId: string) => void`; keep temple pick props; remove reliance on CCCD / member `notFound` create path for the happy path (can leave `notFound` / `onCreateMember` unused or delete if unused)

- [ ] **Step 1: Update tests first**

Replace render assertions:

```typescript
it('renders type radios, org select, phone, and continue — no CCCD', () => {
  renderForm()
  expect(screen.queryByRole('textbox', { name: m.filler_cccd_label() })).toBeNull()
  expect(screen.getByRole('textbox', { name: m.filler_phone_label() })).toBeTruthy()
  expect(screen.queryByText(m.filler_identity_helper())).toBeNull()
})

it('shows member phone description after selecting tang', async () => {
  const user = userEvent.setup()
  renderForm()
  await pickFormType(user, m.filler_type_tang())
  expect(screen.getByText(m.filler_phone_description_member())).toBeTruthy()
})

it('submits member_tang with org and phone', async () => {
  // type phone, assert onSubmit({ formType, orgUnitId, phone: '0901234567' })
})

it('shows member pick list when memberMatches provided', () => {
  renderForm({
    memberMatches: [{ id: 'm1', label: 'Minh Tam' }],
    onPickMember: vi.fn(),
  })
  expect(screen.getByText(m.filler_identity_pick_member())).toBeTruthy()
})
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement form**

Key behavior:

```tsx
const phoneDescription =
  formType === 'temple'
    ? m.filler_phone_description_temple()
    : formType === 'member_tang' || formType === 'member_ni'
      ? m.filler_phone_description_member()
      : undefined

// validate only phone for any selected formType
// onSubmit({ formType, orgUnitId, phone: normalizedPhone })

<TextInput
  label={m.filler_phone_label()}
  description={phoneDescription}
  value={phone}
  onChange={(e) => setPhone(e.currentTarget.value)}
  error={fieldErrors.phone}
/>
```

Remove CCCD state/inputs/`SimpleGrid`. Add member pick UI parallel to temple pick.

- [ ] **Step 4: Run form tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/filler/FillerEntryForm.tsx tanstack-app/src/components/filler/FillerEntryForm.test.tsx
git commit -m "$(cat <<'EOF'
feat: make filler entry phone-only with type descriptions

EOF
)"
```

---

### Task 6: Wire entry route to member phone resume

**Files:**
- Modify: `tanstack-app/src/routes/f.$token.index.tsx`

**Interfaces:**
- Consumes: `resumeMemberByPhone`, updated `FillerEntryForm` props
- Produces: navigate create with `search: { orgUnitId, sanghaType, phone }` on 0 matches; edit on 1; pick list on N

- [ ] **Step 1: Replace member branch in `resumeMutation`**

```typescript
if (payload.formType === 'temple') {
  // unchanged
}

const sanghaType = formTypeToSanghaType(payload.formType)
const result = await resumeMemberByPhone({
  token,
  orgUnitId: payload.orgUnitId,
  sanghaType,
  phone: payload.phone,
})
return { kind: 'member' as const, payload, sanghaType, result }
```

- [ ] **Step 2: Update `onSuccess` for members** (mirror temple branching):

```typescript
if (resume.kind === 'member') {
  const matches = resume.result.members
  setLastMemberSearch({
    orgUnitId: resume.payload.orgUnitId,
    sanghaType: resume.sanghaType,
    phone: resume.payload.phone,
  })

  if (matches.length === 0) {
    void navigate({
      to: '/f/$token/edit/member',
      params: { token },
      search: {
        orgUnitId: resume.payload.orgUnitId,
        sanghaType: resume.sanghaType,
        phone: resume.payload.phone,
      },
    })
    return
  }

  if (matches.length === 1) {
    void navigate({
      to: '/f/$token/edit/member/$memberId',
      params: { token, memberId: matches[0]!.member.id },
    })
    return
  }

  setMemberMatches(
    matches.map(({ member }) => ({
      id: member.id,
      label: member.phapDanh || member.theDanh || member.cccd || member.id,
    })),
  )
  return
}
```

Remove `NOT_FOUND` → `setNotFound` path for members (empty list handles create). Drop unused `cccd` from `lastMemberSearch` type; use `phone`.

Pass `memberMatches` / `onPickMember` into `FillerEntryForm`. Keep `onCreateMember` only if still needed for pick-list “create new” — optional: add a create button when N>1 like temples (`onCreateTemple`). Add `onCreateMember` when `lastMemberSearch` is set (same as temples).

- [ ] **Step 3: Typecheck / run related unit tests**

Run: `pnpm --filter tanstack-app exec vitest run src/components/filler/FillerEntryForm.test.tsx`

- [ ] **Step 4: Commit**

```bash
git add tanstack-app/src/routes/f.$token.index.tsx
git commit -m "$(cat <<'EOF'
feat: resume filler members by phone on entry

EOF
)"
```

---

### Task 7: New-member route + editable CCCD + seed phone

**Files:**
- Modify: `tanstack-app/src/routes/f.$token.edit.member.index.tsx`
- Modify: `tanstack-app/src/components/filler/MemberEditorForm.tsx`
- Modify: `tanstack-app/src/components/filler/MemberEditorForm.test.tsx`

**Interfaces:**
- Route search: `{ orgUnitId, sanghaType, phone }` (drop `cccd`)
- `MemberEditorForm` props: `cccd` optional for create; add `seedPhone?: string`; when `memberId` absent, CCCD is local editable state; seed `dienThoai` from `seedPhone`

- [ ] **Step 1: Update editor tests**

```typescript
it('allows editing CCCD on create and seeds phone', () => {
  renderForm({
    cccd: undefined,
    seedPhone: '0901234567',
    memberId: undefined,
  })
  const cccd = screen.getByLabelText(m.filler_field_cccd()) as HTMLInputElement
  expect(cccd.disabled).toBe(false)
  expect(
    (screen.getByLabelText(m.filler_field_dien_thoai()) as HTMLInputElement)
      .value,
  ).toBe('0901234567')
})

it('keeps CCCD locked when editing existing (cccd prop set, treat as existing via initial id path)', () => {
  // existing tests pass cccd + initial member identity — CCCD stays disabled
  expect(screen.getByLabelText(m.filler_field_cccd())).toBeDisabled()
})
```

Define create mode as: no `memberId` and editable CCCD. Existing `$memberId` route keeps passing `cccd={member.cccd}` and disabled field.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Update route**

```typescript
validateSearch: (search: Record<string, unknown>) => ({
  orgUnitId: typeof search.orgUnitId === 'string' ? search.orgUnitId : '',
  sanghaType: parseSanghaType(search.sanghaType),
  phone: typeof search.phone === 'string' ? search.phone : '',
}),

// ...
<MemberEditorForm
  key={`new-${orgUnitId}-${sanghaType}-${phone}`}
  title={m.filler_editor_title_member_new()}
  token={token}
  orgUnitId={orgUnitId}
  sanghaType={sanghaType}
  seedPhone={phone}
  status="draft"
  onCreated={(memberId) =>
    navigate({
      to: '/f/$token/edit/member/$memberId',
      params: { token, memberId },
    })
  }
/>
```

- [ ] **Step 4: Update `MemberEditorForm`**

```typescript
export type MemberEditorFormProps = {
  // ...
  cccd?: string
  seedPhone?: string
  memberId?: string
  // ...
}

// inside component:
const isCreate = !memberId
const [cccdDraft, setCccdDraft] = useState(cccd ?? '')
const resolvedCccd = isCreate ? cccdDraft : (cccd ?? '')

// emptyMemberDraft(initial) already seeds dienThoai from initial —
// pass initial={{ dienThoai: seedPhone }} from create route OR merge seedPhone in emptyMemberDraft call:
const [draft, setDraft] = useState(() =>
  emptyMemberDraft({
    ...initial,
    dienThoai: initial.dienThoai ?? seedPhone,
  }),
)

// saveMutation uses resolvedCccd
// CCCD field:
<TextInput
  label={m.filler_field_cccd()}
  value={resolvedCccd}
  disabled={!isCreate || disabled}
  onChange={(e) => setCccdDraft(e.currentTarget.value)}
  required={isCreate}
/>
```

Ensure `$memberId` route still passes `cccd={member.cccd}` and `memberId={memberId}` (or rely on `cccd` prop alone: treat `cccd` prop present + loaded member as locked). Prefer explicit `memberId` from the edit route for clarity:

In `f.$token.edit.member.$memberId.tsx`, pass `memberId={memberId}` and `cccd={member.cccd}`.

- [ ] **Step 5: Run editor + form tests**

Run:

```bash
pnpm --filter tanstack-app exec vitest run \
  src/components/filler/MemberEditorForm.test.tsx \
  src/components/filler/FillerEntryForm.test.tsx
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add tanstack-app/src/routes/f.$token.edit.member.index.tsx \
  tanstack-app/src/routes/f.$token.edit.member.\$memberId.tsx \
  tanstack-app/src/components/filler/MemberEditorForm.tsx \
  tanstack-app/src/components/filler/MemberEditorForm.test.tsx
git commit -m "$(cat <<'EOF'
feat: collect CCCD on new member editor; seed phone from entry

EOF
)"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run focused suites**

```bash
pnpm --filter tanstack-app exec vitest run \
  src/components/filler/FillerEntryForm.test.tsx \
  src/components/filler/MemberEditorForm.test.tsx \
  src/use-cases/memberDraft.test.ts \
  src/domain/normalize.test.ts \
  src/firebase/firestoreRules.integration.test.ts
```

Fix any failures.

- [ ] **Step 2: Manual smoke** (dev server)

1. Open `/f/public` (or valid token).
2. Select Tăng → org → phone → Tiếp tục → lands on new member editor with phone seeded, CCCD editable.
3. Save with CCCD → redirects to `$memberId`; CCCD locked.
4. Return to entry with same phone → resumes that member.
5. Tịnh xá path still works with phone.

- [ ] **Step 3: Final commit only if fixes were needed**

---

## Self-review (plan vs spec)

| Spec requirement | Task |
| --- | --- |
| Phone-only entry + descriptions | Task 5 |
| Drop CCCD from entry payload | Task 5–6 |
| `memberPhoneIndex` + rules + grow-only | Task 1, 3 |
| `resumeMemberByPhone` 0/1/N | Task 4, 6 |
| Create search uses `phone` | Task 6–7 |
| Editable CCCD on create; seed phone | Task 7 |
| Admin/filler saves write index | Task 3 (`createOrUpdateDraft` + `updateDraftById`) |
| Vitest coverage; no new Cypress | Tasks 1–7 |
| No historical backfill | Out of scope (honored) |
