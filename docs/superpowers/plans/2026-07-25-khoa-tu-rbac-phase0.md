# Khóa tu — Phase 0: RBAC nhẹ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the current flat `admin: true` Firebase Auth claim into a scoped `role` (`he_phai_admin` | `giao_doan_admin` | `kiem_soat`) + `orgUnitId` model, fully backward-compatible with existing admin accounts, so later Khóa tu phases can enforce per-org-unit access.

**Architecture:** Add a pure domain module (`domain/authClaims.ts`) that parses raw Firebase ID-token claims into a typed `AuthClaims` shape and answers org-unit scope checks. Wire it into the two places that currently read `claims.admin` directly — `useAdminClaim` (drives the `/admin` route guard and every admin page's `enabled` gate) and `postLoginPath` (post-login redirect). No UI changes: assigning `role`/`orgUnitId` to a Firebase user happens outside the app (Firebase console / external script) in this phase, per `docs/superpowers/specs/2026-07-25-khoa-tu-roadmap-design.md`.

**Tech Stack:** TypeScript, Firebase Auth custom claims, Vitest + Testing Library (`renderHook`, `waitFor`).

## Global Constraints

- Legacy `admin: true` claim (no `role`) MUST continue to work exactly as today — it is treated as `{ role: 'he_phai_admin', orgUnitId: null }`.
- No new admin UI for assigning roles in this phase (spec: "manual Firebase console claim-set is acceptable").
- All existing call sites that check `claim.status === 'admin'` must keep compiling and passing without modification — this phase only *adds* fields to that state, never removes or renames the `'admin'` status string.
- Follow existing import alias convention: `#/domain/...`, `#/auth/...`.
- No comments in code unless explaining non-obvious WHY (matches repo convention already in these files).

---

## File Structure

- Create: `tanstack-app/src/domain/authClaims.ts` — pure claim-parsing + scope-check logic, no React/Firebase imports.
- Create: `tanstack-app/src/domain/authClaims.test.ts` — unit tests for the above.
- Modify: `tanstack-app/src/auth/useAdminClaim.ts` — use `parseAuthClaims` instead of the inline `claims.admin === true` check; widen the `'admin'` state variant with `role`/`orgUnitId`.
- Modify: `tanstack-app/src/auth/useAdminClaim.test.tsx` — update existing assertions for the widened shape, add a role-based claim test.
- Modify: `tanstack-app/src/auth/postLoginPath.ts` — use `parseAuthClaims` instead of the inline `claims.admin === true` check so role-only accounts (no legacy `admin` boolean) also land on `/admin`.
- Modify: `tanstack-app/src/auth/postLoginPath.test.ts` — add a role-based claim test.

---

### Task 1: Domain claims module

**Files:**
- Create: `tanstack-app/src/domain/authClaims.ts`
- Test: `tanstack-app/src/domain/authClaims.test.ts`

**Interfaces:**
- Consumes: nothing (pure module, first task).
- Produces:
  - `export type AdminRole = 'he_phai_admin' | 'giao_doan_admin' | 'kiem_soat'`
  - `export type AuthClaims = { role: AdminRole; orgUnitId: string | null }`
  - `export function parseAuthClaims(claims: Record<string, unknown>): AuthClaims | null`
  - `export function canAccessOrgUnit(claims: AuthClaims, orgUnitId: string): boolean`

- [ ] **Step 1: Write the failing tests**

Create `tanstack-app/src/domain/authClaims.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { canAccessOrgUnit, parseAuthClaims } from './authClaims'

describe('parseAuthClaims', () => {
  it('returns he_phai_admin with null orgUnitId when role is he_phai_admin', () => {
    expect(parseAuthClaims({ role: 'he_phai_admin' })).toEqual({
      role: 'he_phai_admin',
      orgUnitId: null,
    })
  })

  it('returns giao_doan_admin scoped to orgUnitId when both are present', () => {
    expect(
      parseAuthClaims({ role: 'giao_doan_admin', orgUnitId: 'gd-i' }),
    ).toEqual({ role: 'giao_doan_admin', orgUnitId: 'gd-i' })
  })

  it('returns kiem_soat scoped to orgUnitId when both are present', () => {
    expect(
      parseAuthClaims({ role: 'kiem_soat', orgUnitId: 'gd-ii' }),
    ).toEqual({ role: 'kiem_soat', orgUnitId: 'gd-ii' })
  })

  it('defaults orgUnitId to null when role is present but orgUnitId is not a string', () => {
    expect(
      parseAuthClaims({ role: 'giao_doan_admin', orgUnitId: 123 }),
    ).toEqual({ role: 'giao_doan_admin', orgUnitId: null })
  })

  it('falls back to he_phai_admin for the legacy admin:true claim', () => {
    expect(parseAuthClaims({ admin: true })).toEqual({
      role: 'he_phai_admin',
      orgUnitId: null,
    })
  })

  it('prefers an explicit role over the legacy admin boolean', () => {
    expect(
      parseAuthClaims({ admin: true, role: 'giao_doan_admin', orgUnitId: 'gd-iii' }),
    ).toEqual({ role: 'giao_doan_admin', orgUnitId: 'gd-iii' })
  })

  it('returns null when role is an unrecognized string and admin is not true', () => {
    expect(parseAuthClaims({ role: 'super_admin' })).toBeNull()
  })

  it('returns null for empty claims', () => {
    expect(parseAuthClaims({})).toBeNull()
  })
})

describe('canAccessOrgUnit', () => {
  it('always allows he_phai_admin regardless of orgUnitId', () => {
    expect(
      canAccessOrgUnit({ role: 'he_phai_admin', orgUnitId: null }, 'gd-i'),
    ).toBe(true)
  })

  it('allows giao_doan_admin when orgUnitId matches', () => {
    expect(
      canAccessOrgUnit({ role: 'giao_doan_admin', orgUnitId: 'gd-i' }, 'gd-i'),
    ).toBe(true)
  })

  it('denies giao_doan_admin when orgUnitId differs', () => {
    expect(
      canAccessOrgUnit({ role: 'giao_doan_admin', orgUnitId: 'gd-i' }, 'gd-ii'),
    ).toBe(false)
  })

  it('denies kiem_soat when orgUnitId is null', () => {
    expect(
      canAccessOrgUnit({ role: 'kiem_soat', orgUnitId: null }, 'gd-i'),
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `tanstack-app/`): `pnpm exec vitest run src/domain/authClaims.test.ts`
Expected: FAIL — `Cannot find module './authClaims'` (file does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `tanstack-app/src/domain/authClaims.ts`:

```ts
export type AdminRole = 'he_phai_admin' | 'giao_doan_admin' | 'kiem_soat'

export type AuthClaims = {
  role: AdminRole
  orgUnitId: string | null
}

const ADMIN_ROLES: readonly AdminRole[] = [
  'he_phai_admin',
  'giao_doan_admin',
  'kiem_soat',
]

function isAdminRole(value: unknown): value is AdminRole {
  return (
    typeof value === 'string' &&
    (ADMIN_ROLES as readonly string[]).includes(value)
  )
}

export function parseAuthClaims(
  claims: Record<string, unknown>,
): AuthClaims | null {
  if (isAdminRole(claims.role)) {
    return {
      role: claims.role,
      orgUnitId: typeof claims.orgUnitId === 'string' ? claims.orgUnitId : null,
    }
  }
  if (claims.admin === true) {
    return { role: 'he_phai_admin', orgUnitId: null }
  }
  return null
}

export function canAccessOrgUnit(
  claims: AuthClaims,
  orgUnitId: string,
): boolean {
  if (claims.role === 'he_phai_admin') return true
  return claims.orgUnitId === orgUnitId
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/domain/authClaims.test.ts`
Expected: PASS — all 12 tests green.

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/domain/authClaims.ts tanstack-app/src/domain/authClaims.test.ts
git commit -m "feat: add authClaims domain module for role-scoped admin access"
```

---

### Task 2: Wire `useAdminClaim` to `parseAuthClaims`

**Files:**
- Modify: `tanstack-app/src/auth/useAdminClaim.ts`
- Test: `tanstack-app/src/auth/useAdminClaim.test.tsx`

**Interfaces:**
- Consumes: `parseAuthClaims` and `AdminRole` from `#/domain/authClaims` (Task 1).
- Produces: `AdminClaimState` now has `{ status: 'admin'; uid: string; role: AdminRole; orgUnitId: string | null }` — every existing consumer that only checks `claim.status === 'admin'` (`TempleFormPage.tsx`, `OrgUnitsPage.tsx`, `MembersListPage.tsx`, `AdminCopyFormLinkButton.tsx`, `MemberFormPage.tsx`, `TemplesListPage.tsx`, `routes/admin.tsx`) keeps compiling unchanged since those fields are additive.

- [ ] **Step 1: Update the failing/changed tests**

Replace the contents of `tanstack-app/src/auth/useAdminClaim.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminClaim } from './useAdminClaim'

const useAuthMock = vi.fn()

vi.mock('#/auth/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

describe('useAdminClaim', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
  })

  it('returns signed_out when no user', async () => {
    useAuthMock.mockReturnValue({ user: null, loading: false })
    const { result } = renderHook(() => useAdminClaim())
    await waitFor(() => {
      expect(result.current.status).toBe('signed_out')
    })
  })

  it('returns denied when no recognizable claim is present', async () => {
    useAuthMock.mockReturnValue({
      user: {
        getIdTokenResult: async () => ({ claims: {} }),
        getIdToken: async () => 'token',
      },
      loading: false,
    })
    const { result } = renderHook(() => useAdminClaim())
    await waitFor(() => {
      expect(result.current.status).toBe('denied')
    })
  })

  it('returns denied when getIdTokenResult rejects', async () => {
    useAuthMock.mockReturnValue({
      user: {
        getIdTokenResult: async () => {
          throw new Error('token refresh failed')
        },
        getIdToken: async () => 'token',
      },
      loading: false,
    })
    const { result } = renderHook(() => useAdminClaim())
    await waitFor(() => {
      expect(result.current.status).toBe('denied')
    })
  })

  it('returns admin with he_phai_admin role for the legacy admin:true claim', async () => {
    const getIdTokenResult = vi.fn(async () => ({ claims: { admin: true } }))
    useAuthMock.mockReturnValue({
      user: { uid: 'admin-uid-1', getIdTokenResult },
      loading: false,
    })
    const { result } = renderHook(() => useAdminClaim())
    await waitFor(() => {
      expect(result.current.status).toBe('admin')
    })
    expect(getIdTokenResult).toHaveBeenCalledWith(true)
    if (result.current.status === 'admin') {
      expect(result.current.uid).toBe('admin-uid-1')
      expect(result.current.role).toBe('he_phai_admin')
      expect(result.current.orgUnitId).toBeNull()
    }
  })

  it('returns admin with a scoped role and orgUnitId for role-based claims', async () => {
    const getIdTokenResult = vi.fn(async () => ({
      claims: { role: 'giao_doan_admin', orgUnitId: 'gd-i' },
    }))
    useAuthMock.mockReturnValue({
      user: { uid: 'gd-admin-uid', getIdTokenResult },
      loading: false,
    })
    const { result } = renderHook(() => useAdminClaim())
    await waitFor(() => {
      expect(result.current.status).toBe('admin')
    })
    if (result.current.status === 'admin') {
      expect(result.current.uid).toBe('gd-admin-uid')
      expect(result.current.role).toBe('giao_doan_admin')
      expect(result.current.orgUnitId).toBe('gd-i')
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/auth/useAdminClaim.test.tsx`
Expected: FAIL — the "scoped role" test fails (current code only understands `claims.admin`), and the `he_phai_admin` assertions fail (`result.current.role` is `undefined` since the field doesn't exist yet).

- [ ] **Step 3: Update the implementation**

Replace the contents of `tanstack-app/src/auth/useAdminClaim.ts`:

```ts
import { useEffect, useState } from 'react'
import { parseAuthClaims, type AdminRole } from '#/domain/authClaims'
import { useAuth } from '#/auth/useAuth'

export type AdminClaimState =
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'denied' }
  | { status: 'admin'; uid: string; role: AdminRole; orgUnitId: string | null }

export function useAdminClaim(): AdminClaimState {
  const { user, loading } = useAuth()
  const [state, setState] = useState<AdminClaimState>({ status: 'loading' })

  useEffect(() => {
    if (loading) {
      setState((prev) =>
        prev.status === 'loading' ? prev : { status: 'loading' },
      )
      return
    }
    if (!user) {
      setState((prev) =>
        prev.status === 'signed_out' ? prev : { status: 'signed_out' },
      )
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const result = await user.getIdTokenResult(true)
        if (cancelled) return
        const claims = parseAuthClaims(result.claims)
        if (claims) {
          setState({ status: 'admin', uid: user.uid, ...claims })
        } else {
          setState({ status: 'denied' })
        }
      } catch {
        if (cancelled) return
        setState({ status: 'denied' })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user, loading])

  return state
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/auth/useAdminClaim.test.tsx`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Type-check the whole app**

Run (from `tanstack-app/`): `pnpm exec tsc --noEmit`
Expected: no new errors — confirms every existing `claim.status === 'admin'` call site still compiles against the widened type.

- [ ] **Step 6: Commit**

```bash
git add tanstack-app/src/auth/useAdminClaim.ts tanstack-app/src/auth/useAdminClaim.test.tsx
git commit -m "feat: expose role and orgUnitId from useAdminClaim"
```

---

### Task 3: Wire `postLoginPath` to `parseAuthClaims`

**Files:**
- Modify: `tanstack-app/src/auth/postLoginPath.ts`
- Test: `tanstack-app/src/auth/postLoginPath.test.ts`

**Interfaces:**
- Consumes: `parseAuthClaims` from `#/domain/authClaims` (Task 1).
- Produces: `postLoginPath(user, redirect): Promise<string>` — same signature as today; behavior change is that role-only accounts (no `admin: true`) now also resolve to `/admin`.

- [ ] **Step 1: Add the failing test**

In `tanstack-app/src/auth/postLoginPath.test.ts`, add this case inside the existing `describe('postLoginPath', ...)` block (after the `'returns /admin when no redirect and admin claim is true'` test):

```ts
  it('returns /admin when no redirect and a scoped role claim is present (no admin boolean)', async () => {
    const user = userWithClaims({ role: 'giao_doan_admin', orgUnitId: 'gd-i' })
    await expect(postLoginPath(user, undefined)).resolves.toBe('/admin')
  })
```

- [ ] **Step 2: Run tests to verify the new one fails**

Run: `pnpm exec vitest run src/auth/postLoginPath.test.ts`
Expected: FAIL on the new test — current code checks `result.claims.admin === true`, which is `undefined` for a role-only claim, so it falls through to `/`.

- [ ] **Step 3: Update the implementation**

Replace the contents of `tanstack-app/src/auth/postLoginPath.ts`:

```ts
import { safeRedirectPath } from '#/auth/safeRedirect'
import { parseAuthClaims } from '#/domain/authClaims'

type TokenUser = {
  getIdTokenResult: (
    forceRefresh?: boolean,
  ) => Promise<{ claims: Record<string, unknown> }>
}

/**
 * Destination after login / when an already-signed-in user hits /login.
 * Explicit safe redirect wins; otherwise admins go to /admin, others to /.
 */
export async function postLoginPath(
  user: TokenUser,
  redirect: unknown,
): Promise<string> {
  if (typeof redirect === 'string') {
    const safe = safeRedirectPath(redirect, '')
    // "/" is the non-admin default — do not treat it as an explicit deep link
    if (safe !== '' && safe !== '/') return safe
  }

  try {
    const result = await user.getIdTokenResult()
    if (parseAuthClaims(result.claims)) return '/admin'
  } catch {
    // fall through
  }
  return '/'
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/auth/postLoginPath.test.ts`
Expected: PASS — all 7 tests green.

- [ ] **Step 5: Run the full test suite**

Run (from `tanstack-app/`): `pnpm run test`
Expected: PASS — no regressions anywhere else in the app.

- [ ] **Step 6: Commit**

```bash
git add tanstack-app/src/auth/postLoginPath.ts tanstack-app/src/auth/postLoginPath.test.ts
git commit -m "feat: send scoped-role accounts to /admin after login"
```

---

## Self-Review Notes

- **Spec coverage**: Phase 0's spec acceptance criteria are "existing admin users still work unchanged" (Task 2 Step 5 `tsc --noEmit` + legacy-claim tests in Tasks 1-3) and "a test `giao_doan_admin` claim can read/write only its own `orgUnitId` scope in use-case-level checks" (Task 1's `canAccessOrgUnit` tests). Both covered. No role-assignment UI is in scope for this phase (spec explicitly defers it).
- **Placeholder scan**: no TBD/TODO; every step has runnable code and exact commands.
- **Type consistency**: `AdminRole` and `AuthClaims` are defined once in Task 1 and imported (never redefined) in Tasks 2-3; `parseAuthClaims` / `canAccessOrgUnit` signatures match across all call sites.

---

## After this phase

This unblocks Phase 1 (CRUD khóa tu, Giáo đoàn-scoped) from `docs/superpowers/specs/2026-07-25-khoa-tu-roadmap-design.md`, which will consume `canAccessOrgUnit` in its use-cases.
