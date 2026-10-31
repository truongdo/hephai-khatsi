Hệ phái Khất sĩ admin app — a client-only single-page app built with
[TanStack Router](https://tanstack.com/router), [React Query](https://tanstack.com/query),
[Mantine](https://mantine.dev/), and [Firebase Auth](https://firebase.google.com/docs/auth)
(sign-in and role claims). The data lives in [Cloudflare D1](https://developers.cloudflare.com/d1/),
reached only through the Worker's `/api/data/*` routes (`src/worker.ts`, `src/worker/dataApi/`),
which enforce authorization (`src/domain/authz/`). Member portraits and documents are stored in
[Cloudflare R2](https://developers.cloudflare.com/r2/): the browser uploads with presigned PUT URLs
and reads public objects from `VITE_PHOTOS_PUBLIC_BASE`.

# Getting Started

To run this application:

```bash
pnpm install
pnpm dev
```

## Provision seed admin custom claims

`admin@example.com` (or whatever you set as `SEED_ADMIN_EMAIL` in `.env`) only becomes a hệ phái admin after Firebase Auth **custom claims** are set on that user. The Firebase Console cannot set custom claims; use the Admin SDK (or Identity Toolkit with a service account).

`khatsihephai@gmail.com` already has claims. The in-app “Thư ký” grant only covers `@gmail.com` secretary roles (`giao_doan_admin` / `he_phai_secretary`), not bootstrapping `he_phai_admin`.

### What to set

Either of these works (same access as the Gmail admin):

| Claims | Meaning |
|--------|---------|
| `{ role: 'he_phai_admin' }` | Preferred |
| `{ admin: true }` | Legacy; the app and the Worker map it to `he_phai_admin` |

### One-off script

1. Ensure the email/password user exists in Firebase Auth (your `SEED_ADMIN_*` account).
2. Use a Firebase service account JSON (same kind as `FIREBASE_SERVICE_ACCOUNT_JSON` / `*-firebase-adminsdk-*.json`). Do not commit that file (already covered by `.gitignore`).
3. From the repo root, install Admin SDK if needed and run a one-off script:

```bash
pnpm add -D firebase-admin
```

```js
// scripts/set-he-phai-admin.mjs
import { readFileSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const email = process.argv[2] ?? 'admin@example.com'
const saPath = process.argv[3] // path to service account JSON

initializeApp({
  credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))),
})

const auth = getAuth()
const user = await auth.getUserByEmail(email)
await auth.setCustomUserClaims(user.uid, { role: 'he_phai_admin' })
// optional: { admin: true, role: 'he_phai_admin' }

console.log('OK', email, user.uid, (await auth.getUser(user.uid)).customClaims)
```

```bash
node scripts/set-he-phai-admin.mjs admin@example.com ./path/to/hephaikhatsi-*-firebase-adminsdk-*.json
```

### After setting

1. Sign out and sign in again as that user (or force-refresh the ID token with `getIdToken(true)`) so the new claims appear on the token.
2. `/admin` should work.

# Building For Production

To build this application for production:

```bash
pnpm build
```

## Testing

### Unit / component (Vitest)

This project uses [Vitest](https://vitest.dev/) and Testing Library for unit and component tests:

```bash
pnpm test
```

`pnpm test` also runs the Worker + D1 tests (`src/worker/**/*.d1.test.ts`) in workerd against a
local D1 with `migrations/` applied.

### End-to-end (Cypress)

[Cypress](https://www.cypress.io/) covers browser e2e flows against the running app (`http://localhost:3000`).

Interactive (start the app first with `pnpm dev` if it is not already running):

```bash
pnpm cy:open
```

Headless one-shot (starts `pnpm dev`, waits for the URL, runs Cypress, then stops the server):

```bash
pnpm test:e2e
```

## Styling

This project uses [Mantine](https://mantine.dev/) for UI components and theming (`@mantine/core` + `@mantine/hooks`).

## Member photos (R2 + Worker)

Portraits upload to R2 via presigned PUT URLs from `/api/photos/*`; the client displays them from
`VITE_PHOTOS_PUBLIC_BASE` + `photoPath`. Admin delete removes the R2 object through the Worker.

### One-time ops checklist (Cloudflare dashboard)

1. Create R2 bucket **`member-photos`** (optional preview bucket **`member-photos-preview`** — names must match `wrangler.jsonc`).
2. Enable a **public development URL** (`*.r2.dev`) or attach a **custom domain** for the bucket; set the base (no trailing slash) as `VITE_PHOTOS_PUBLIC_BASE` in `.env` / deploy env.
3. Create an **R2 API token** with Object Read & Write scoped to the bucket. Non-secret vars (`R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `FIREBASE_PROJECT_ID`) live in `wrangler.jsonc` under `vars` (already set for this project). Put **secrets** with Wrangler from the repo root (use `pnpm exec` — Wrangler is a local dep, not a global CLI):

   ```bash
   pnpm exec wrangler secret put R2_ACCESS_KEY_ID
   pnpm exec wrangler secret put R2_SECRET_ACCESS_KEY
   ```

4. Deploy: `pnpm run deploy` builds the SPA (`dist/`) and publishes the Worker + Assets via Wrangler (not `pnpm deploy`: under pnpm 11 that is pnpm's own workspace command).

`GET /api/health` returns `{"ok":true}` for smoke checks.

5. Database schema: new `migrations/*.sql` files are applied with `pnpm db:migrate:remote` (production D1 `hephai-khatsi`) before deploying code that needs them; `pnpm db:migrate:local` for `wrangler dev`.

### Local development (Vite + Wrangler)

Copy `.env.example` → `.env` and set Firebase client vars plus `VITE_PHOTOS_PUBLIC_BASE`.

All data goes through the Worker, so run it locally and proxy from Vite (`vite.config.ts` forwards `/api` → `http://127.0.0.1:8787`). Apply the schema to the local D1 once (and after adding a migration): `pnpm db:migrate:local`.

Terminal A — Worker (needs the R2 / D1 bindings + secrets in `.dev.vars`, gitignored):

```bash
# .dev.vars example (secrets; plain vars come from wrangler.jsonc in prod):
# R2_ACCESS_KEY_ID=...
# R2_SECRET_ACCESS_KEY=...
# FIREBASE_SERVICE_ACCOUNT_JSON must be the raw JSON string (one line), NOT a file path.
# Example (minify your *-firebase-adminsdk-*.json first):
#   node -e 'console.log(JSON.stringify(require("./hephaikhatsi-….json")))'
# then paste: FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
pnpm exec wrangler dev
```

Terminal B — Vite dev server:

```bash
pnpm dev
```

Alternatively, `pnpm preview` builds once and runs `wrangler dev` (serves built assets; no Vite HMR).

## Deploy (Cloudflare Worker + D1 + R2)

```bash
pnpm db:migrate:remote   # only when migrations/ has new files
pnpm run deploy
```

## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from "@tanstack/react-router";
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

The root layout lives in `src/routes/__root.tsx`. Anything rendered there (providers, headers, devtools) wraps every route; the matched route's own content renders where `<Outlet />` appears.

```tsx
import { Outlet, createRootRoute, Link } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => (
    <>
      <header>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
        </nav>
      </header>
      <Outlet />
    </>
  ),
})
```

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).

## Data Fetching

Data access goes through the repository/use-case layers in `src/repositories` and
`src/use-cases`, called from `src/query/*` React Query hooks. Repositories call the Worker's
`/api/data/*` routes (`src/data/apiClient.ts` adds the Firebase ID token); the Worker checks
authorization and runs SQL on D1.

# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).
