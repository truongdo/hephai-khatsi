# Mantine Initialization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize Mantine (`@mantine/core` + `@mantine/hooks`) in `tanstack-app` with system color scheme, and remove Tailwind.

**Architecture:** Export a minimal theme from `src/theme.ts`. Wire `ColorSchemeScript` + `MantineProvider` in the TanStack Start document shell (`__root.tsx`) with matching `defaultColorScheme="auto"`. Add PostCSS preset for Mantine. Strip Tailwind from deps, Vite config, CSS, and the home page.

**Tech Stack:** Mantine v8, React 19, TanStack Start (Vite + Cloudflare SSR), Vitest + Testing Library, pnpm

**Spec:** `docs/superpowers/specs/2026-07-19-mantine-init-design.md`

## Global Constraints

- Packages: `@mantine/core` and `@mantine/hooks` only (no notifications/form/dates)
- Remove Tailwind completely (`tailwindcss`, `@tailwindcss/vite`, `@tailwindcss/typography`)
- `ColorSchemeScript` and `MantineProvider` must both use `defaultColorScheme="auto"`
- Work in the current workspace only — **never** `git worktree add`
- Before coding: create branch `feat/mantine-init` from `main` (see Task 0)
- Do not invent custom brand colors/fonts in this plan

## File Structure

| File | Responsibility |
| --- | --- |
| `tanstack-app/src/theme.ts` | `createTheme` export |
| `tanstack-app/src/theme.test.ts` | Theme smoke test |
| `tanstack-app/postcss.config.cjs` | Mantine PostCSS preset + breakpoints |
| `tanstack-app/src/routes/__root.tsx` | CSS import, `ColorSchemeScript`, `MantineProvider` |
| `tanstack-app/src/styles.css` | Minimal reset (no Tailwind) |
| `tanstack-app/src/routes/index.tsx` | Home page with Mantine primitives |
| `tanstack-app/src/routes/index.test.tsx` | Home render smoke test |
| `tanstack-app/vite.config.ts` | Drop Tailwind plugin; add Vitest test config |
| `tanstack-app/package.json` / lockfile | Dep changes |

---

### Task 0: Create feature branch

**Files:** none (git only)

- [ ] **Step 1: Confirm on `main` and create branch**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git checkout main
git pull
git checkout -b feat/mantine-init
```

Expected: current branch is `feat/mantine-init`.

If not on `main` / pull fails / dirty tree: stop and ask the user before continuing.

---

### Task 1: Install Mantine, PostCSS; remove Tailwind

**Files:**
- Modify: `tanstack-app/package.json`
- Create: `tanstack-app/postcss.config.cjs`
- Modify: `tanstack-app/pnpm-lock.yaml` (via pnpm)

**Interfaces:**
- Consumes: none
- Produces: `@mantine/core`, `@mantine/hooks` available to import; PostCSS config present

- [ ] **Step 1: Add Mantine + PostCSS packages**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm add @mantine/core @mantine/hooks
pnpm add -D postcss postcss-preset-mantine postcss-simple-vars
```

- [ ] **Step 2: Remove Tailwind packages**

```bash
pnpm remove tailwindcss @tailwindcss/vite @tailwindcss/typography
```

- [ ] **Step 3: Create `tanstack-app/postcss.config.cjs`**

```js
module.exports = {
  plugins: {
    'postcss-preset-mantine': {},
    'postcss-simple-vars': {
      variables: {
        'mantine-breakpoint-xs': '36em',
        'mantine-breakpoint-sm': '48em',
        'mantine-breakpoint-md': '62em',
        'mantine-breakpoint-lg': '75em',
        'mantine-breakpoint-xl': '88em',
      },
    },
  },
}
```

- [ ] **Step 4: Verify package.json no longer lists Tailwind**

```bash
rg -n "tailwind" package.json || true
```

Expected: no matches in `package.json`.

- [ ] **Step 5: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/package.json tanstack-app/pnpm-lock.yaml tanstack-app/postcss.config.cjs
git commit -m "$(cat <<'EOF'
Add Mantine and PostCSS; remove Tailwind packages.

EOF
)"
```

---

### Task 2: Theme module

**Files:**
- Create: `tanstack-app/src/theme.ts`
- Create: `tanstack-app/src/theme.test.ts`
- Modify: `tanstack-app/vite.config.ts` (Vitest `test` block only in this task if missing — otherwise add in Task 3 with Tailwind removal)

**Interfaces:**
- Consumes: `createTheme` from `@mantine/core`
- Produces: `export const theme = createTheme({})` from `#/theme` (or relative `../theme`)

- [ ] **Step 1: Write failing theme test**

Create `tanstack-app/src/theme.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { theme } from './theme'

describe('theme', () => {
  it('exports a Mantine theme object', () => {
    expect(theme).toBeTypeOf('object')
    expect(theme).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm test src/theme.test.ts
```

Expected: FAIL (cannot resolve `./theme` or similar).

- [ ] **Step 3: Create `tanstack-app/src/theme.ts`**

```ts
import { createTheme } from '@mantine/core'

export const theme = createTheme({})
```

- [ ] **Step 4: Ensure Vitest can run (if Step 2 failed for config reasons)**

If Vitest needs an environment config, add this to `tanstack-app/vite.config.ts` (keep existing plugins for now; Tailwind plugin removal is Task 3):

```ts
/// keep existing imports and plugins
export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    // existing plugins unchanged in this step
  ],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
```

You may need `/// <reference types="vitest/config" />` or a triple-slash / `vitest/config` import so `test` is typed — use whatever the project's Vite 8 + Vitest 4 combo accepts (e.g. `import { defineConfig } from 'vitest/config'` if required).

- [ ] **Step 5: Run test to verify it passes**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm test src/theme.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/src/theme.ts tanstack-app/src/theme.test.ts tanstack-app/vite.config.ts
git commit -m "$(cat <<'EOF'
Add minimal Mantine theme module.

EOF
)"
```

---

### Task 3: Wire provider, styles, and Vite (remove Tailwind)

**Files:**
- Modify: `tanstack-app/src/routes/__root.tsx`
- Modify: `tanstack-app/src/styles.css`
- Modify: `tanstack-app/vite.config.ts`

**Interfaces:**
- Consumes: `theme` from `../theme`
- Produces: App shell with `MantineProvider` + `ColorSchemeScript` (`defaultColorScheme="auto"`)

- [ ] **Step 1: Replace `tanstack-app/src/styles.css` with a minimal reset**

```css
* {
  box-sizing: border-box;
}

html,
body,
#app {
  min-height: 100%;
}

body {
  margin: 0;
}
```

- [ ] **Step 2: Update `tanstack-app/vite.config.ts` — remove Tailwind plugin**

Final file should look like:

```ts
import { defineConfig } from 'vitest/config'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart(),
    viteReact(),
  ],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})

export default config
```

If `vitest/config` breaks the Cloudflare/Start plugins, keep `defineConfig` from `vite` and use a `/// <reference types="vitest/config" />` plus a `test` block instead — prefer whatever typechecks and runs `pnpm test`.

- [ ] **Step 3: Update `tanstack-app/src/routes/__root.tsx`**

```tsx
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { ColorSchemeScript, MantineProvider } from '@mantine/core'

import '@mantine/core/styles.css'
import appCss from '../styles.css?url'
import { theme } from '../theme'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'TanStack Start Starter',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <ColorSchemeScript defaultColorScheme="auto" />
      </head>
      <body>
        <MantineProvider
          theme={theme}
          defaultColorScheme="auto"
          deduplicateInlineStyles
        >
          {children}
        </MantineProvider>
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Confirm no Tailwind references in config/CSS**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
rg -n "tailwind" vite.config.ts src/styles.css package.json || true
```

Expected: no matches.

- [ ] **Step 5: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/src/routes/__root.tsx tanstack-app/src/styles.css tanstack-app/vite.config.ts
git commit -m "$(cat <<'EOF'
Wire MantineProvider and drop Tailwind from Vite/CSS.

EOF
)"
```

---

### Task 4: Home page smoke UI + test

**Files:**
- Modify: `tanstack-app/src/routes/index.tsx`
- Create: `tanstack-app/src/routes/index.test.tsx`

**Interfaces:**
- Consumes: Mantine `Stack`, `Title`, `Text`; provider optional in unit test (wrap locally)
- Produces: Home route without Tailwind classes

- [ ] **Step 1: Write failing home smoke test**

Create `tanstack-app/src/routes/index.test.tsx`:

```tsx
import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { theme } from '../theme'

// Import the route component via a small export if needed.
// Prefer testing the Home component: if it is not exported, export it
// as `export function Home` from index.tsx in Step 3.

import { Home } from './index'

describe('Home', () => {
  it('renders the welcome heading with Mantine', () => {
    render(
      <MantineProvider theme={theme}>
        <Home />
      </MantineProvider>,
    )

    expect(
      screen.getByRole('heading', { name: /welcome to tanstack start/i }),
    ).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm test src/routes/index.test.tsx
```

Expected: FAIL (`Home` not exported / Tailwind page not matching yet).

- [ ] **Step 3: Replace `tanstack-app/src/routes/index.tsx`**

```tsx
import { Stack, Text, Title } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

export function Home() {
  return (
    <Stack p="xl" gap="md">
      <Title order={1}>Welcome to TanStack Start</Title>
      <Text size="lg">
        Edit <code>src/routes/index.tsx</code> to get started.
      </Text>
    </Stack>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm test src/routes/index.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/src/routes/index.tsx tanstack-app/src/routes/index.test.tsx
git commit -m "$(cat <<'EOF'
Use Mantine components on the home page.

EOF
)"
```

---

### Task 5: End-to-end verification

**Files:** none (commands only); fix any failures found

- [ ] **Step 1: Run full unit tests**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm test
```

Expected: all tests PASS.

- [ ] **Step 2: Production build**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm build
```

Expected: build completes with exit code 0.

- [ ] **Step 3: Repo-wide Tailwind leftover check**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
rg -n "tailwind|@tailwindcss" --glob '!pnpm-lock.yaml' || true
```

Expected: no matches (except possibly a comment — if any remain, remove them and amend via a new commit).

- [ ] **Step 4: Manual smoke (optional but preferred)**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm dev
```

Open `http://localhost:3000`. Confirm heading renders and OS light/dark preference is reflected (toggle OS appearance if practical). Stop the server when done.

- [ ] **Step 5: Commit any verification fixes** (skip if clean)

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add -A
git status
# only if there are fixes:
git commit -m "$(cat <<'EOF'
Fix Mantine init verification issues.

EOF
)"
```

---

## Self-review checklist (author)

1. **Spec coverage:** Theme module, PostCSS, `__root` provider + script, styles reset, index Mantine UI, Vite Tailwind removal, package removals, `auto` color scheme contract, success criteria via tests/build/rg — all mapped to tasks.
2. **Placeholders:** none intended.
3. **Type consistency:** `theme` export name and `Home` export used by tests match implementation steps.
