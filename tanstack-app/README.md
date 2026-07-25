Hệ phái Khất sĩ admin app — a client-only single-page app built with
[TanStack Router](https://tanstack.com/router), [React Query](https://tanstack.com/query),
[Mantine](https://mantine.dev/), and [Firebase](https://firebase.google.com/)
(Auth, Firestore). Member portraits are stored in [Cloudflare R2](https://developers.cloudflare.com/r2/)
via a Cloudflare Worker (`src/worker.ts`); the browser uploads with presigned PUT URLs and reads
public objects from `VITE_PHOTOS_PUBLIC_BASE`. Firestore security rules (see `../firebase/`) are the
authorization boundary for data; `firebase/storage.rules` remains in the repo as legacy (unused for portraits).

# Getting Started

To run this application:

```bash
pnpm install
pnpm dev
```

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

### Firebase emulator integration (optional)

Requires [Java](https://www.java.com/) for the Firestore/Auth emulators. The Storage emulator is not
started for portrait flows (portraits use R2). Legacy `firebase/storage.rules` and
`storageRules.integration.test.ts` remain but are not part of the default emulator script.

Terminal A — start the emulators from the repo root config:

```bash
cd tanstack-app
pnpm emulator
```

Terminal B — run the integration suite (repository logic + Firestore security rules) against them:

```bash
cd tanstack-app
pnpm test:integration
```

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
3. Create an **R2 API token** with Object Read & Write scoped to the bucket. Set secrets on the Worker:

   ```bash
   cd tanstack-app
   wrangler secret put R2_ACCESS_KEY_ID
   wrangler secret put R2_SECRET_ACCESS_KEY
   ```

   Set non-secret vars (dashboard or CLI):

   ```bash
   wrangler vars put R2_ACCOUNT_ID "<cloudflare-account-id>"
   wrangler vars put R2_BUCKET_NAME "member-photos"
   wrangler vars put FIREBASE_PROJECT_ID "<firebase-project-id>"
   ```

4. Deploy: `pnpm deploy` builds the SPA (`dist/`) and publishes the Worker + Assets via Wrangler.

`GET /api/health` returns `{"ok":true}` for smoke checks. Firestore security rules still deploy separately from the monorepo root (`../firebase/`).

### Local development (Vite + Wrangler)

Copy `.env.example` → `.env` and set Firebase client vars plus `VITE_PHOTOS_PUBLIC_BASE`.

For photo upload/delete API routes, run the Worker locally and proxy from Vite (`vite.config.ts` forwards `/api` → `http://127.0.0.1:8787`):

Terminal A — Worker (needs R2 binding + secrets in `.dev.vars`, gitignored):

```bash
cd tanstack-app
# .dev.vars example:
# R2_ACCOUNT_ID=...
# R2_ACCESS_KEY_ID=...
# R2_SECRET_ACCESS_KEY=...
# R2_BUCKET_NAME=member-photos
# FIREBASE_PROJECT_ID=hephaikhatsi-82658
wrangler dev
```

Terminal B — Vite dev server:

```bash
cd tanstack-app
pnpm dev
```

Alternatively, `pnpm preview` builds once and runs `wrangler dev` (serves built assets; no Vite HMR).

## Deploy (Cloudflare Worker + R2)

```bash
pnpm deploy
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
`src/use-cases` (thin wrappers around the Firebase client SDK), called directly from
`src/query/*` React Query hooks — there's no server RPC layer to cross.

# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).
