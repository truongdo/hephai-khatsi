# Firebase Auth login — Design

Date: 2026-07-19  
App: `tanstack-app` (TanStack Start + React 19 + Mantine + Paraglide)  
Auth: Firebase Authentication (client SDK)

## Goal

Ship a login page and client session for any Firebase Auth user, using **Google** and **email/password** sign-in. After success, redirect to home; expose Sign out in a shared header. Role checks (admin claim), phone OTP, and server session cookies are deferred — keep this phase simple.

## Decisions

| Topic | Choice |
| --- | --- |
| Audience | Any signed-in Firebase user (no admin-claim gate in this phase) |
| Providers (this phase) | Google (popup) + email/password (sign-in only) |
| Phone | Deferred to a follow-up |
| Email flows | Sign-in only — no sign-up, no password reset |
| Session model | Client Firebase Auth + React context (`onAuthStateChanged`) — **not** session cookies |
| SSR / flash | Accept client-only auth; use a **`loading` gate** so header and `/login` do not flash the wrong state |
| Post-login | Redirect to `/` |
| Already signed in on `/login` | Redirect to `/` only after `loading === false` and `user` is set |
| Sign out | Shared `AppHeader` (root layout), visible on pages that use it |
| UI kit | Mantine primitives + Paraglide copy (Vietnamese default) |
| Server Admin SDK | Unchanged; UI may call `user.getIdToken()` later for admin server fns |

## Out of scope

- Phone SMS OTP / reCAPTCHA
- Email sign-up and password-reset flows
- Admin custom-claim checks or admin-only redirects
- HttpOnly session cookies / SSR-verified auth (future upgrade when admin UI needs it)
- Account linking / multi-provider merge UX
- Full account profile page
- Live Firebase sign-in in Cypress CI (smoke render only)
- Google `signInWithRedirect` fallback (popup only for now; known mobile popup limits)

## Architecture

```
firebase/client init (browser-only) → auth repository (SDK only) → AuthProvider (onAuthStateChanged)
  → /login (Google + email/password) → redirect /
  → AppHeader (identity + Sign out | login link)
```

1. **`src/firebase/client.ts`** — client Firebase app + Auth helpers; config from `VITE_FIREBASE_*`. **Initialize only in the browser.** Missing/incomplete config must not crash the app at import time (important for SSR and Cypress smoke); surface a clear UI error if the user tries to sign in without config.
2. **`src/repositories/authRepo.ts`** — `signInWithGoogle`, `signInWithEmailPassword`, `signOut`, `subscribeAuth`. Components and routes do not call the Auth SDK directly.
3. **`src/auth/AuthProvider.tsx`** — one `onAuthStateChanged` subscription; exposes `{ user, loading, signOut }`. Wrap route children in `__root.tsx` inside `MantineProvider`. Until the first auth event, `loading` is `true`.
4. **`src/routes/login.tsx`** — login UI. While `loading`, show a brief loading state (same idea on server + first paint). After resolve: if `user` → navigate `/`; else show the form.
5. **`src/components/AppHeader.tsx`** — shared header in the root layout around route children. While `loading`, show a compact neutral placeholder (no login link / no identity flicker). Signed out: link to `/login`. Signed in: display name/email (fallback truncated uid) + Sign out. Sign out stays on the current page (typically `/`).

Existing `assertAdmin(idToken)` server path remains the future bridge for admin UI; this phase does not call it from the login flow.

## UI

### `/login`

- Brand / app title, heading “Đăng nhập”
- Primary: “Continue with Google” button
- Divider “or”
- Email + password fields + “Sign in”
- Inline `Alert` for mapped auth errors
- No sign-up / forgot-password / phone teaser links

### `AppHeader`

- Loading: neutral placeholder (no wrong chrome)
- Signed out: compact “Đăng nhập” link (not a hero CTA)
- Signed in: identity label + “Đăng xuất”

## Data flow

1. App boots (browser) → `AuthProvider` sets `loading` until the first `onAuthStateChanged` event.
2. User signs in on `/login` → repository methods → Firebase → provider updates `user` → navigate `/`.
3. Header and pages read auth only from context (no second listener).
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
- Extend **`tanstack-app/.env.example`** to document client vars alongside existing Admin SDK vars:
  - Client: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` (plus `VITE_FIREBASE_MESSAGING_SENDER_ID` / `VITE_FIREBASE_STORAGE_BUCKET` if present in the Firebase web config snippet)
  - Admin (already present): `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_STORAGE_BUCKET`

Do not commit secrets; `.env` stays local / deploy secrets.

## Testing

| Layer | Coverage |
| --- | --- |
| Vitest | Login form renders providers/fields; shows mapped error; header signed-in / signed-out / loading (mock auth context / repo) |
| Cypress | Thin smoke: `/login` loads and shows Google control + email fields — no live credential sign-in; app must boot without requiring a live Auth session |

## Success criteria

- `/login` signs in with Google popup and with email/password against a configured Firebase project.
- Successful sign-in lands on `/`; visiting `/login` while signed in redirects to `/` only after auth has resolved.
- `AppHeader` shows identity + Sign out when signed in, and a login link when signed out; no signed-out/signed-in chrome flicker while `loading`.
- Auth SDK usage is confined to the client init + auth repository; one auth listener in the provider; client init is browser-safe.
- Vitest coverage above passes; Cypress smoke for `/login` passes without requiring live Auth in CI.
- Phone, sign-up, password reset, session cookies, and admin gating remain unimplemented.

## Follow-up (explicitly later)

- Phone OTP login
- Firebase session cookies when SSR-accurate auth / protected admin routes are needed
- Admin-claim route gating
