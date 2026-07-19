Hệ phái Khất sĩ admin app — a client-only single-page app built with
[TanStack Router](https://tanstack.com/router), [React Query](https://tanstack.com/query),
[Mantine](https://mantine.dev/), and [Firebase](https://firebase.google.com/)
(Auth, Firestore, Storage). There is no server: the browser talks to Firebase
directly, and Firestore/Storage security rules (see `../firebase/`) are the
authorization boundary.

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

Requires [Java](https://www.java.com/) for the Firestore/Storage emulators.

Terminal A — start the emulators from the repo root config:

```bash
cd tanstack-app
pnpm emulator
```

Terminal B — run the integration suite (repository logic + security rules) against them:

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

## Deploy to Firebase Hosting

```bash
pnpm deploy
```

This builds the static app and runs `firebase deploy --only hosting,firestore:rules,storage:rules`
against the monorepo-root `../firebase.json`. Client Firebase config (`VITE_FIREBASE_*`) lives in
`.env` — see `.env.example`.

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
