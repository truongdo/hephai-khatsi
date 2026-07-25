# Admin Login Redirect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After login (or when an already signed-in user hits `/login`), send admins to `/admin` by default while honoring a safe explicit `?redirect=`.

**Architecture:** Pure async helper `postLoginPath(user, redirect)` checks for an explicit redirect first, otherwise reads the Firebase `admin` custom claim. `LoginPage` and `/login` search validation use that helper; home `/` is unchanged.

**Tech Stack:** Firebase Auth client (`getIdTokenResult`), TanStack Router, Vitest, Testing Library

## Global Constraints

- Work on the **current branch**; do **not** create a new branch or git worktree.
- Do **not** commit unless the user explicitly asks.
- Prefer Vitest for this change; no new Cypress spec.
- Keep `safeRedirectPath` as a pure path sanitizer (no auth claims inside it).

---

### Task 1: `postLoginPath` helper

**Files:**
- Create: `tanstack-app/src/auth/postLoginPath.ts`
- Create: `tanstack-app/src/auth/postLoginPath.test.ts`
- Related: `tanstack-app/src/auth/safeRedirect.ts` (reuse, do not change behavior)

**Interfaces:**
- Consumes: `safeRedirectPath(raw, fallback?)` from `#/auth/safeRedirect`
- Produces: `postLoginPath(user, redirect): Promise<string>` where `user` has `getIdTokenResult(forceRefresh?: boolean): Promise<{ claims: Record<string, unknown> }>`

- [x] **Step 1: Write the failing tests**

Create `tanstack-app/src/auth/postLoginPath.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest'
import { postLoginPath } from '#/auth/postLoginPath'

function userWithClaims(claims: Record<string, unknown>) {
  return {
    getIdTokenResult: vi.fn(async () => ({ claims })),
  }
}

describe('postLoginPath', () => {
  it('returns safe redirect when redirect is provided', async () => {
    const user = userWithClaims({ admin: true })
    await expect(postLoginPath(user, '/admin/temples')).resolves.toBe(
      '/admin/temples',
    )
    expect(user.getIdTokenResult).not.toHaveBeenCalled()
  })

  it('rejects open-redirect values and falls through to claim check', async () => {
    const user = userWithClaims({ admin: true })
    await expect(postLoginPath(user, '//evil.example')).resolves.toBe('/admin')
  })

  it('returns /admin when no redirect and admin claim is true', async () => {
    const user = userWithClaims({ admin: true })
    await expect(postLoginPath(user, undefined)).resolves.toBe('/admin')
  })

  it('returns / when no redirect and user is not admin', async () => {
    const user = userWithClaims({})
    await expect(postLoginPath(user, undefined)).resolves.toBe('/')
  })

  it('returns / when getIdTokenResult throws', async () => {
    const user = {
      getIdTokenResult: vi.fn(async () => {
        throw new Error('token failed')
      }),
    }
    await expect(postLoginPath(user, undefined)).resolves.toBe('/')
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd tanstack-app && pnpm exec vitest run src/auth/postLoginPath.test.ts`

Expected: FAIL (module or `postLoginPath` not found)

- [x] **Step 3: Write minimal implementation**

Create `tanstack-app/src/auth/postLoginPath.ts`:

```typescript
import { safeRedirectPath } from '#/auth/safeRedirect'

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
    if (safe !== '') return safe
  }

  try {
    const result = await user.getIdTokenResult()
    if (result.claims.admin === true) return '/admin'
  } catch {
    // fall through
  }
  return '/'
}
```

Note: `safeRedirectPath(redirect, '')` returns `''` for invalid paths (e.g. `//evil`), so invalid explicit values fall through to the admin claim check instead of silently becoming `/`.

- [x] **Step 4: Run tests to verify they pass**

Run: `cd tanstack-app && pnpm exec vitest run src/auth/postLoginPath.test.ts`

Expected: PASS (all 5 tests)

- [x] **Step 5: Skip commit** (user requested no commits)

---

### Task 2: Wire `LoginPage` + `/login` search validation

**Files:**
- Modify: `tanstack-app/src/routes/login.tsx`
- Modify: `tanstack-app/src/components/LoginPage.tsx`
- Modify: `tanstack-app/src/components/LoginPage.test.tsx`

**Interfaces:**
- Consumes: `postLoginPath(user, redirect)` from Task 1
- Produces: `/login` search type `{ redirect?: string }`; LoginPage navigates to helper result

- [x] **Step 1: Write failing LoginPage tests**

Update `tanstack-app/src/components/LoginPage.test.tsx`:

1. Change the existing “navigates home when already signed in” case so the mock user is **non-admin** (`getIdTokenResult` → `{ claims: {} }`) and still expects `{ to: '/' }`.
2. Add cases:

```typescript
it('navigates to /admin when already signed in as admin', async () => {
  renderLogin({
    user: {
      uid: 'admin-1',
      email: 'admin@b.c',
      getIdTokenResult: async () => ({ claims: { admin: true } }),
    },
    loading: false,
  })
  await waitFor(() => {
    expect(navigateMock).toHaveBeenCalledWith({ to: '/admin' })
  })
})

it('navigates to /admin after Google sign-in when user is admin', async () => {
  const adminUser = {
    uid: 'admin-1',
    getIdTokenResult: async () => ({ claims: { admin: true } }),
  }
  signInWithGoogle.mockImplementationOnce(async () => {
    // AuthProvider is not live in this test; LoginPage must resolve path
    // from the signed-in user available after authRepo returns.
    // Implementation passes the user from useAuth after sign-in OR
    // from the credential — prefer reading useAuth.user in useEffect.
    // For this click path, mock so after resolve the page re-renders with user:
  })
  // Prefer simpler approach: call navigate inside run() using
  // postLoginPath with the user returned from sign-in helpers.
})
```

**Concrete LoginPage contract for this task:**

- After `await action()` in `run()`, obtain the current Firebase user for path resolution:
  - Prefer: change `signInWithGoogle` / `signInWithEmailPassword` usage so `run` receives a `User` (return value of the repo methods), then `await navigate({ to: await postLoginPath(signedInUser, redirect) })`.
  - Check `authRepo` return types; if they already return `UserCredential` / `User`, use that. If they return `void`, either update them to return the user **or** rely on the existing `useEffect` that fires when `user` becomes non-null (in that case remove the navigate from `run()` and only navigate from the effect — but then Google test must set auth context after click).

**Preferred minimal approach (pick this):**

1. Keep navigate in both places, but in `run()` after `await action()`, call `postLoginPath` only if you have a user. Simplest reliable path: **navigate only from `useEffect` when `!loading && user`**, and remove the navigate from `run()` so one code path owns redirects. Show loader while `pending` or while signed-in redirect is in flight.

Actually keep both paths working: after `action()`, the AuthProvider may not have updated yet in the same tick. Check current `authRepo` — if sign-in returns a user/credential, use it in `run()`; the `useEffect` covers already-signed-in.

Write these tests (final):

```typescript
it('navigates home when already signed in as non-admin', async () => {
  renderLogin({
    user: {
      uid: 'u1',
      email: 'a@b.c',
      getIdTokenResult: async () => ({ claims: {} }),
    },
    loading: false,
  })
  await waitFor(() => {
    expect(navigateMock).toHaveBeenCalledWith({ to: '/' })
  })
})

it('navigates to /admin when already signed in as admin', async () => {
  renderLogin({
    user: {
      uid: 'admin-1',
      email: 'admin@b.c',
      getIdTokenResult: async () => ({ claims: { admin: true } }),
    },
    loading: false,
  })
  await waitFor(() => {
    expect(navigateMock).toHaveBeenCalledWith({ to: '/admin' })
  })
})

it('navigates to redirect path after Google sign-in', async () => {
  useSearchMock.mockReturnValue({ redirect: '/admin/temples' })
  signInWithGoogle.mockResolvedValueOnce({
    user: {
      uid: 'u1',
      getIdTokenResult: async () => ({ claims: { admin: true } }),
    },
  })
  const user = userEvent.setup()
  renderLogin()
  await user.click(
    screen.getByRole('button', { name: m.auth_login_google() }),
  )
  await waitFor(() => {
    expect(navigateMock).toHaveBeenCalledWith({ to: '/admin/temples' })
  })
})

it('navigates to /admin after Google sign-in when admin and no redirect', async () => {
  signInWithGoogle.mockResolvedValueOnce({
    user: {
      uid: 'admin-1',
      getIdTokenResult: async () => ({ claims: { admin: true } }),
    },
  })
  const user = userEvent.setup()
  renderLogin()
  await user.click(
    screen.getByRole('button', { name: m.auth_login_google() }),
  )
  await waitFor(() => {
    expect(navigateMock).toHaveBeenCalledWith({ to: '/admin' })
  })
})
```

- [x] **Step 2: Run LoginPage tests — expect failures**

Run: `cd tanstack-app && pnpm exec vitest run src/components/LoginPage.test.tsx`

Expected: FAIL on admin cases / credential shape until implementation catches up

- [x] **Step 3: Update `login.tsx` validateSearch**

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { safeRedirectPath } from '#/auth/safeRedirect'
import { LoginPage } from '#/components/LoginPage'

function parseRedirect(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined
  const safe = safeRedirectPath(raw, '')
  return safe === '' ? undefined : safe
}

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: parseRedirect(search.redirect),
  }),
  component: LoginPage,
})
```

- [x] **Step 4: Update `LoginPage` to use `postLoginPath`**

In `tanstack-app/src/components/LoginPage.tsx`:

- Import `postLoginPath`.
- In `useEffect`, when `!loading && user`, `void navigate({ to: await postLoginPath(user, redirect) })` (async IIFE).
- In `run()`, after `const credential = await action()`, if credential has `.user`, navigate with `postLoginPath(credential.user, redirect)`; else if repo returns void, navigate only via effect (then adjust tests to re-render with user — prefer returning user from action).

Check and align with `authRepo`:

```typescript
// If sign-in helpers return UserCredential:
await action()
// change run to:
async function run(action: () => Promise<{ user: User } | void>) {
  ...
  const result = await action()
  const signedIn = result && 'user' in result ? result.user : null
  if (signedIn) {
    await navigate({ to: await postLoginPath(signedIn, redirect) })
  }
}
```

If `signInWithGoogle` / `signInWithEmailPassword` currently return `Promise<void>`, update them to return the Firebase `UserCredential` (or `User`) so `run()` can resolve the path without waiting for context. Do **not** broaden repo API beyond returning the existing SDK result.

- [x] **Step 5: Run tests**

Run:

```bash
cd tanstack-app && pnpm exec vitest run src/auth/postLoginPath.test.ts src/components/LoginPage.test.tsx
```

Expected: PASS

- [x] **Step 6: Skip commit** (user requested no commits)

---

### Task 3: Verification

**Files:** none new

- [x] **Step 1: Run focused + related auth tests**

```bash
cd tanstack-app && pnpm exec vitest run src/auth/postLoginPath.test.ts src/components/LoginPage.test.tsx src/auth/useAdminClaim.test.tsx src/auth/AuthProvider.test.tsx
```

Expected: PASS

- [x] **Step 2: Manual smoke (optional if wrangler already running)**

1. Sign in as admin with no `?redirect=` → land on `/admin`
2. Open `/login?redirect=/admin/temples` as admin → land on `/admin/temples`
3. Sign in as non-admin → land on `/`

- [x] **Step 3: Skip commit**
