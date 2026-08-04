# Filler Entry Member Identity Verify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On `/f/$token`, after a member phone lookup finds exactly one hồ sơ, require CCCD + ngày sinh on the same entry screen before opening the editor; wrong values show “Thông tin nhập không đúng.”

**Architecture:** Keep phone lookup via `resumeMemberByPhone`. On exactly one match, the route stores a small `matchedMember` challenge payload and does **not** navigate. `FillerEntryForm` reveals CCCD + `DateInput`, disables Continue until `memberIdentityMatches` passes (client-side against the already-fetched member), then Continue calls `onConfirmMatch` to navigate to edit. Zero matches still go to create; temple flow unchanged; >1 matches → generic error.

**Tech Stack:** React 19, Mantine 9 (`DateInput` from `@mantine/dates`), TanStack Router + Query, Paraglide i18n, Vitest + Testing Library

**Spec:** `docs/superpowers/specs/2026-08-04-filler-entry-member-identity-verify-design.md`

## Global Constraints

- Work in the current workspace only — **never** `git worktree add`
- Branch from `main` as `feat/filler-entry-member-identity-verify` (confirm with user if not on `main`)
- Prefer Vitest; **no new Cypress** in this plan
- Member only — temple resume/UI unchanged
- Product assumes one phone → one member; >1 matches → generic error, no pick-list for this path
- Missing `member.ngaySinh` → identity never passes
- After merge squash into `main`, delete the local feature branch unless asked otherwise

## File Structure

| File | Responsibility |
| --- | --- |
| `tanstack-app/messages/vi.json` | `filler_error_identity_mismatch` |
| `tanstack-app/src/domain/memberIdentityMatches.ts` | Pure CCCD + ngày sinh compare |
| `tanstack-app/src/domain/memberIdentityMatches.test.ts` | Unit tests for the helper |
| `tanstack-app/src/components/filler/FillerEntryForm.tsx` | Challenge UI + Continue disable/enable |
| `tanstack-app/src/components/filler/FillerEntryForm.test.tsx` | Form challenge behavior |
| `tanstack-app/src/routes/f.$token.index.tsx` | Hold match state; stop auto-navigate on 1 match; confirm → edit |

---

### Task 0: Branch

- [ ] **Step 1: Confirm base and create branch**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git status -sb
git branch --show-current
# Must be on main (or stash/ask). Then:
git checkout main
git pull
git checkout -b feat/filler-entry-member-identity-verify
```

- [ ] **Step 2: Commit nothing yet** — branch only

---

### Task 1: i18n + `memberIdentityMatches` helper

**Files:**
- Modify: `tanstack-app/messages/vi.json`
- Create: `tanstack-app/src/domain/memberIdentityMatches.ts`
- Create: `tanstack-app/src/domain/memberIdentityMatches.test.ts`

**Interfaces:**
- Consumes: `normalizeCccd` from `#/domain/normalize` (throws `DomainError` on invalid/empty)
- Produces:
  - Message key `filler_error_identity_mismatch` → `"Thông tin nhập không đúng."`
  - `memberIdentityMatches(member: { cccd: string; ngaySinh?: string }, input: { cccd: string; ngaySinh: string }): boolean`

- [ ] **Step 1: Add message** in `tanstack-app/messages/vi.json` near other `filler_error_*` keys:

```json
"filler_error_identity_mismatch": "Thông tin nhập không đúng."
```

- [ ] **Step 2: Write the failing tests**

```typescript
// tanstack-app/src/domain/memberIdentityMatches.test.ts
import { describe, expect, it } from 'vitest'
import { memberIdentityMatches } from './memberIdentityMatches'

describe('memberIdentityMatches', () => {
  const member = { cccd: '012345678901', ngaySinh: '1990-01-15' }

  it('returns true when CCCD and ngày sinh match', () => {
    expect(
      memberIdentityMatches(member, {
        cccd: '012345678901',
        ngaySinh: '1990-01-15',
      }),
    ).toBe(true)
  })

  it('normalizes CCCD digits before compare', () => {
    expect(
      memberIdentityMatches(member, {
        cccd: '0123 4567 8901',
        ngaySinh: '1990-01-15',
      }),
    ).toBe(true)
  })

  it('returns false when CCCD differs', () => {
    expect(
      memberIdentityMatches(member, {
        cccd: '999999999999',
        ngaySinh: '1990-01-15',
      }),
    ).toBe(false)
  })

  it('returns false when ngày sinh differs', () => {
    expect(
      memberIdentityMatches(member, {
        cccd: '012345678901',
        ngaySinh: '1990-01-16',
      }),
    ).toBe(false)
  })

  it('returns false when member has no ngày sinh', () => {
    expect(
      memberIdentityMatches(
        { cccd: '012345678901' },
        { cccd: '012345678901', ngaySinh: '1990-01-15' },
      ),
    ).toBe(false)
  })

  it('returns false when member ngày sinh is empty', () => {
    expect(
      memberIdentityMatches(
        { cccd: '012345678901', ngaySinh: '' },
        { cccd: '012345678901', ngaySinh: '1990-01-15' },
      ),
    ).toBe(false)
  })

  it('returns false when CCCD is invalid', () => {
    expect(
      memberIdentityMatches(member, {
        cccd: '123',
        ngaySinh: '1990-01-15',
      }),
    ).toBe(false)
  })

  it('returns false when input ngày sinh is empty', () => {
    expect(
      memberIdentityMatches(member, {
        cccd: '012345678901',
        ngaySinh: '',
      }),
    ).toBe(false)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd tanstack-app && pnpm exec vitest run src/domain/memberIdentityMatches.test.ts
```

Expected: FAIL (module / export missing)

- [ ] **Step 4: Implement helper**

```typescript
// tanstack-app/src/domain/memberIdentityMatches.ts
import { isDomainError } from '#/domain/errors'
import { normalizeCccd } from '#/domain/normalize'

export function memberIdentityMatches(
  member: { cccd: string; ngaySinh?: string },
  input: { cccd: string; ngaySinh: string },
): boolean {
  const storedDob = member.ngaySinh?.trim() ?? ''
  if (!storedDob) return false
  if (!input.ngaySinh.trim()) return false

  let normalized: string
  try {
    normalized = normalizeCccd(input.cccd)
  } catch (err) {
    if (isDomainError(err)) return false
    throw err
  }

  return normalized === member.cccd && input.ngaySinh === storedDob
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd tanstack-app && pnpm test -- src/domain/memberIdentityMatches.test.ts
```

Expected: PASS (Paraglide compile runs via `pnpm test`; message key available for later tasks)

- [ ] **Step 6: Commit**

```bash
git add tanstack-app/messages/vi.json \
  tanstack-app/src/domain/memberIdentityMatches.ts \
  tanstack-app/src/domain/memberIdentityMatches.test.ts
git commit -m "$(cat <<'EOF'
feat: add member identity match helper for filler entry

EOF
)"
```

---

### Task 2: `FillerEntryForm` identity challenge UI

**Files:**
- Modify: `tanstack-app/src/components/filler/FillerEntryForm.tsx`
- Modify: `tanstack-app/src/components/filler/FillerEntryForm.test.tsx`

**Interfaces:**
- Consumes: `memberIdentityMatches`; labels `m.filler_field_cccd()`, `m.filler_field_ngay_sinh()`, `m.filler_ph_cccd()`, `m.filler_error_identity_mismatch()`
- Extends props:

```typescript
export type FillerEntryMatchedMember = {
  id: string
  cccd: string
  ngaySinh?: string
}

export type FillerEntryFormProps = {
  // ...existing props...
  matchedMember?: FillerEntryMatchedMember | null
  onConfirmMatch?: (memberId: string) => void
  onClearMatch?: () => void
}
```

- Produces: When `matchedMember` is set, CCCD + ngày sinh fields; Continue disabled until match; `onConfirmMatch(id)` on verified Continue; `onClearMatch()` when type/org/phone change while challenge active

**Continue / error rules (implement exactly):**

1. If `matchedMember` is null/undefined → Continue enabled for phone lookup `onSubmit` (existing).
2. If `matchedMember` is set:
   - Show CCCD `TextInput` + `DateInput` (`valueFormat="YYYY-MM-DD"`, clearable) after the phone field.
   - Derive `verified = memberIdentityMatches(matchedMember, { cccd, ngaySinh })`.
   - Continue `disabled={!verified}` (also respect `pending`).
   - When both `cccd` and `ngaySinh` are non-empty (after trim) and `!verified` → show `m.filler_error_identity_mismatch()` (Alert or field-level error near the challenge fields). When `verified` or either field empty → clear that error.
   - On Continue click while verified → `onConfirmMatch?.(matchedMember.id)` (do **not** call phone `onSubmit`).
3. Changing `formType`, `orgUnitId`, or `phone` while `matchedMember` is set → clear local CCCD/ngày sinh/error and call `onClearMatch?.()`.
4. Do not show challenge fields for temple or when `matchedMember` absent.

- [ ] **Step 1: Write failing form tests** (wrap with `DatesProvider` like `MemberEditorForm.test.tsx`):

```typescript
import { DatesProvider } from '@mantine/dates'
import { memberIdentityMatches } from '#/domain/memberIdentityMatches'

// In renderForm, wrap children:
// <DatesProvider settings={{ locale: 'vi', firstDayOfWeek: 1 }}>
//   <FillerEntryForm ... />
// </DatesProvider>

it('hides CCCD and ngày sinh until matchedMember is provided', () => {
  renderForm()
  expect(screen.queryByLabelText(m.filler_field_cccd())).toBeNull()
  expect(screen.queryByLabelText(m.filler_field_ngay_sinh())).toBeNull()
})

it('shows identity fields and disables Continue when matchedMember is set', () => {
  renderForm({
    matchedMember: {
      id: 'm1',
      cccd: '012345678901',
      ngaySinh: '1990-01-15',
    },
  })
  expect(screen.getByLabelText(m.filler_field_cccd())).toBeTruthy()
  expect(screen.getByLabelText(m.filler_field_ngay_sinh())).toBeTruthy()
  expect(screen.getByRole('button', { name: m.filler_continue() })).toBeDisabled()
})

it('shows mismatch error when both fields filled incorrectly', async () => {
  const user = userEvent.setup()
  renderForm({
    matchedMember: {
      id: 'm1',
      cccd: '012345678901',
      ngaySinh: '1990-01-15',
    },
  })
  await user.type(screen.getByLabelText(m.filler_field_cccd()), '999999999999')
  // DateInput: type ISO date string into the labeled input
  await user.type(screen.getByLabelText(m.filler_field_ngay_sinh()), '1990-01-16')
  expect(await screen.findByText(m.filler_error_identity_mismatch())).toBeTruthy()
  expect(screen.getByRole('button', { name: m.filler_continue() })).toBeDisabled()
})

it('enables Continue and calls onConfirmMatch when identity matches', async () => {
  const user = userEvent.setup()
  const onConfirmMatch = vi.fn()
  const onSubmit = vi.fn()
  renderForm({
    onSubmit,
    onConfirmMatch,
    matchedMember: {
      id: 'm1',
      cccd: '012345678901',
      ngaySinh: '1990-01-15',
    },
  })
  await user.type(screen.getByLabelText(m.filler_field_cccd()), '012345678901')
  await user.type(screen.getByLabelText(m.filler_field_ngay_sinh()), '1990-01-15')
  const continueBtn = screen.getByRole('button', { name: m.filler_continue() })
  expect(continueBtn).not.toBeDisabled()
  await user.click(continueBtn)
  expect(onConfirmMatch).toHaveBeenCalledWith('m1')
  expect(onSubmit).not.toHaveBeenCalled()
})

it('calls onClearMatch when phone changes during challenge', async () => {
  const user = userEvent.setup()
  const onClearMatch = vi.fn()
  renderForm({
    onClearMatch,
    matchedMember: {
      id: 'm1',
      cccd: '012345678901',
      ngaySinh: '1990-01-15',
    },
  })
  await user.type(screen.getByRole('textbox', { name: m.filler_phone_label() }), '1')
  expect(onClearMatch).toHaveBeenCalled()
})
```

If `DateInput` typing is flaky in JSDOM, set the date via the input’s `change` event or use Testing Library `fireEvent.change` with value `1990-01-15` / `1990-01-16` on the ngày sinh control — keep assertions on `memberIdentityMatches` + button disabled/enabled behavior.

- [ ] **Step 2: Run form tests — expect FAIL**

```bash
cd tanstack-app && pnpm exec vitest run src/components/filler/FillerEntryForm.test.tsx
```

- [ ] **Step 3: Implement form changes**

Sketch (merge into existing component; keep temple/member pick lists as-is for unused paths):

```typescript
import { DateInput } from '@mantine/dates'
import { memberIdentityMatches } from '#/domain/memberIdentityMatches'

// state: challengeCccd, challengeNgaySinh (strings)
const inChallenge = Boolean(matchedMember)
const verified =
  inChallenge && matchedMember
    ? memberIdentityMatches(matchedMember, {
        cccd: challengeCccd,
        ngaySinh: challengeNgaySinh,
      })
    : false

const showIdentityError =
  inChallenge &&
  challengeCccd.trim() !== '' &&
  challengeNgaySinh.trim() !== '' &&
  !verified

// Continue: disabled={pending || (inChallenge && !verified)}
// handleSubmit: if inChallenge && verified → onConfirmMatch(matchedMember.id); else existing phone submit
// on phone/type/org change: if matchedMember → reset challenge fields + onClearMatch?.()
```

Place identity fields after the phone `TextInput`, before the Continue button. Reuse `m.filler_field_cccd()`, `m.filler_ph_cccd()`, `m.filler_field_ngay_sinh()`.

- [ ] **Step 4: Run form tests — expect PASS**

```bash
cd tanstack-app && pnpm exec vitest run src/components/filler/FillerEntryForm.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/filler/FillerEntryForm.tsx \
  tanstack-app/src/components/filler/FillerEntryForm.test.tsx
git commit -m "$(cat <<'EOF'
feat: challenge CCCD and DOB on filler entry after phone match

EOF
)"
```

---

### Task 3: Wire `f.$token.index` route

**Files:**
- Modify: `tanstack-app/src/routes/f.$token.index.tsx`

**Interfaces:**
- Consumes: `FillerEntryMatchedMember` shape from form props; existing `resumeMemberByPhone`
- Produces: route state `matchedMember: FillerEntryMatchedMember | null`; no navigate on single member match until `onConfirmMatch`

- [ ] **Step 1: Replace member success handling**

In `resumeMutation.onSuccess` for `resume.kind === 'member'`:

```typescript
const matches = resume.result.members
setLastMemberSearch({
  orgUnitId: resume.payload.orgUnitId,
  sanghaType: resume.sanghaType,
  phone: resume.payload.phone,
})
setMatchedMember(null)
setMemberMatches([])

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
  const member = matches[0]!.member
  setMatchedMember({
    id: member.id,
    cccd: member.cccd,
    ngaySinh: member.ngaySinh,
  })
  return
}

// >1 — unexpected for product rule
setError(m.filler_error_generic())
```

Remove the previous single-match `navigate` to `$memberId` and the multi-match `setMemberMatches(...)` path for happy path (or keep `setMemberMatches` unused — prefer remove navigate + prefer generic error for N as above).

- [ ] **Step 2: Pass new props into `FillerEntryForm`**

```typescript
const [matchedMember, setMatchedMember] = useState<{
  id: string
  cccd: string
  ngaySinh?: string
} | null>(null)

// in onMutate: also setMatchedMember(null)

<FillerEntryForm
  // ...existing...
  matchedMember={matchedMember}
  onClearMatch={() => setMatchedMember(null)}
  onConfirmMatch={(memberId) => {
    void navigate({
      to: '/f/$token/edit/member/$memberId',
      params: { token, memberId },
      search: lastMemberSearch
        ? { phone: lastMemberSearch.phone }
        : {},
    })
  }}
/>
```

Ensure `lastMemberSearch` is set before confirm (it is set in `onSuccess` when match is found).

Clear `matchedMember` in `onMutate` alongside existing match list clears.

- [ ] **Step 3: Smoke-check related unit tests**

```bash
cd tanstack-app && pnpm exec vitest run \
  src/routes/fillerEntryRoute.test.ts \
  src/components/filler/FillerEntryForm.test.tsx \
  src/domain/memberIdentityMatches.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add tanstack-app/src/routes/f.$token.index.tsx
git commit -m "$(cat <<'EOF'
feat: gate filler member edit behind CCCD and DOB verify

EOF
)"
```

---

### Task 4: Final verification

- [ ] **Step 1: Run focused + broader filler tests**

```bash
cd tanstack-app && pnpm test -- \
  src/domain/memberIdentityMatches.test.ts \
  src/components/filler/FillerEntryForm.test.tsx \
  src/routes/fillerEntryRoute.test.ts
```

Expected: all PASS

- [ ] **Step 2: Manual checklist** (dev server `/f/public` if emulator available)

1. Temple + phone → unchanged resume/create
2. Member + unknown phone → create editor
3. Member + known phone → CCCD + ngày sinh appear; Continue disabled
4. Wrong CCCD/DOB → “Thông tin nhập không đúng.”; Continue stays disabled
5. Correct CCCD/DOB → Continue enables → opens member editor
6. Change phone after challenge → fields reset / lookup again

- [ ] **Step 3: No further commit unless Step 1 required fixes** — if fixes needed, commit:

```bash
git commit -m "$(cat <<'EOF'
fix: filler entry identity challenge edge cases

EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| Member-only; temple unchanged | Task 3 (temple branch untouched) |
| 0 matches → create | Task 3 |
| 1 match → challenge fields; Continue disabled until verified | Tasks 2–3 |
| Wrong info message | Tasks 1–2 |
| Missing `ngaySinh` never passes | Task 1 |
| >1 matches → generic error | Task 3 |
| Client-side compare; no new API | Task 1 |
| Vitest only; no Cypress | Tasks 1–2, 4 |
| Reset on type/org/phone change | Task 2 |

No placeholders left; types `FillerEntryMatchedMember` / `memberIdentityMatches` consistent across tasks.
