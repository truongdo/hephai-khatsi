# Admin login redirect — Design

Date: 2026-07-25  
App: `tanstack-app`

## Goal

When an admin signs in (or an already signed-in admin opens `/login`), send them to `/admin` by default. Honor an explicit safe `?redirect=` when present. Non-admins keep going to `/`.

## Decisions

| Topic | Choice |
| --- | --- |
| Explicit `redirect` | Always win when present and safe |
| Default for admin | `/admin` |
| Default for non-admin / claim failure | `/` |
| Already signed in on `/login` | Same destination rules |
| Home `/` while signed in as admin | No auto-redirect (login only) |
| Admin detection | Firebase ID token custom claim `admin === true` via `user.getIdTokenResult()` |

## Behavior

1. If `redirect` search param is present → `safeRedirectPath(redirect)`
2. Else if `claims.admin === true` → `/admin`
3. Else → `/`

Absent or empty `redirect` must stay “no redirect” (not coerced to `/` before the admin check). Invalid `redirect` values are sanitized by `safeRedirectPath` when a value is present.

## Architecture

- Add `postLoginPath(user, redirect)` in `src/auth/` next to `safeRedirect.ts`.
- `LoginPage` uses it in the signed-in `useEffect` and after successful `run()` sign-in.
- Adjust `/login` `validateSearch` so missing/empty `redirect` remains `undefined`.

## Out of scope

- Redirecting admins away from `/` outside the login flow
- Changing admin layout auth gates
- Server-side session cookies

## Testing

- Unit tests for `postLoginPath`
- Update `LoginPage` tests for admin / non-admin / explicit redirect / already signed-in admin
