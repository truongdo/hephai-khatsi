# Firebase Auth login — Design

Date: 2026-07-19  
App: `tanstack-app` (TanStack Start + React 19 + Mantine + Paraglide)  
Auth: Firebase Authentication (client SDK)

## Goal

Ship a login page and client session for any Firebase Auth user, using **Google** and **email/password** sign-in. After success, redirect to home; expose Sign out on the home header. Role checks (admin claim), phone OTP, and server session cookies are deferred.

## Decisions

| Topic | Choice |
| --- | --- |
| Audience | Any signed-in Firebase user (no admin-claim gate in this phase) |
| Providers (this phase) | Google (popup) + email/password (sign-in only) |
| Phone | Deferred to a follow-up |
| Email flows | Sign-in only — no sign-up, no password reset |
| Session model | Client Firebase Auth + React context (`onAuthStateChanged`) |
| Post-login | Redirect to `/` |
| Already signed in on `/login` | Redirect to `/` |
| Sign out | Home header only |
| UI kit | Mantine primitives + Paraglide copy (Vietnamese default) |
| Server Admin SDK | Unchanged; UI may call `user.getIdToken()` later for admin server fns |

## Out of scope

- Phone SMS OTP / reCAPTCHA
- Email sign-up and password-reset flows
- Admin custom-claim checks or admin-only redirects
- HttpOnly session cookies / SSR-aware auth
- Account linking / multi-provider merge UX
- Full account profile page
- Live Firebase sign-in in Cypress CI (smoke render only)

## Architecture

```
firebase/client init → auth repository (SDK only) → AuthProvider (onAuthStateChanged)
  → /login (Google + email/password) → redirect /
  → Home header (identity + Sign out)
```

1. **`src/firebase/client.ts`** — single client Firebase app + Auth export; config from `VITE_FIREBASE_*` env vars.
2. **`src/repositories/authRepo.ts`** — `signInWithGoogle`, `signInWithEmailPassword`, `signOut`, `subscribeAuth`. Components and routes do not call the Auth SDK directly.
3. **`src/auth/AuthProvider.tsx`** — one `onAuthStateChanged` subscription; exposes `{ user, loading, signOut }` via context. Wrap the app in `__root.tsx` inside `MantineProvider`.
4. **`src/routes/login.tsx`** — login UI; if `user` present after auth resolves, navigate to `/`; while `loading`, show a brief loading state.
5. **Home header** (extend existing `Home` / shared header component as fits current layout) — signed out: link to `/login`; signed in: display name/email (fallback truncated uid) + Sign out. Sign out stays on `/`.

Existing `assertAdmin(idToken)` server path remains the future bridge for admin UI; this phase does not call it from the login flow.

## UI

### `/login`

- Brand / app title, heading “Đăng nhập”
- Primary: “Continue with Google” button
- Divider “or”
- Email + password fields + “Sign in”
- Inline `Alert` for mapped auth errors
- No sign-up / forgot-password / phone teaser links

### `/` header

- Signed out: compact “Đăng nhập” link (not a hero CTA)
- Signed in: identity label + “Đăng xuất”

## Data flow

1. App boots → `AuthProvider` sets `loading` until the first `onAuthStateChanged` event.
2. User signs in on `/login` → repository methods → Firebase → provider updates `user` → navigate `/`.
3. Home reads auth only from context (no second listener).
4. Sign out → repository `signOut` → `user` becomes `null` → header shows login link.

## Error handling

- Map Firebase Auth error codes to Paraglide messages at minimum for:
  - `auth/invalid-credential` (and related wrong-password / user-not-found equivalents Firebase may return)
  - `auth/too-many-requests`
  - `auth/popup-closed-by-user`
  - network / unknown fallback
- Disable Google and email submit controls while a request is in flight.
- Clear the previous error when the user starts a new attempt.
- Prefer inline `Alert` on `/login`; no notifications package required.

## Configuration (ops)

Manual Firebase Console setup (documented in the implementation plan, not automated in app code):

- Enable **Email/Password** and **Google** providers
- Authorized domains for local and production hosts
- Required client env vars for init: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` (plus `VITE_FIREBASE_MESSAGING_SENDER_ID` / `VITE_FIREBASE_STORAGE_BUCKET` if present in the Firebase web config snippet)

Do not commit secrets; `.env` stays local / deploy secrets.

## Testing

| Layer | Coverage |
| --- | --- |
| Vitest | Login form renders providers/fields; shows mapped error; header signed-in vs signed-out (mock auth context / repo) |
| Cypress | Thin smoke: `/login` loads and shows Google control + email fields — no live credential sign-in in CI for this phase |

## Success criteria

- `/login` signs in with Google popup and with email/password against a configured Firebase project.
- Successful sign-in lands on `/`; visiting `/login` while signed in redirects to `/`.
- Home header shows identity + Sign out when signed in, and a login link when signed out.
- Auth SDK usage is confined to the client init + auth repository; one auth listener in the provider.
- Vitest coverage above passes; Cypress smoke for `/login` passes without requiring live Auth in CI.
- Phone, sign-up, password reset, and admin gating remain unimplemented.
