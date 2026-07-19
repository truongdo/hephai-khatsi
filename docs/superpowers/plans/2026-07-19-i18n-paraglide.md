# Paraglide i18n (Vietnamese) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Paraglide JS i18n to `tanstack-app` with Vietnamese as the only locale, wired through Vite, SSR middleware, document `lang`, and existing Home/UI strings.

**Architecture:** Configure an inlang project with `baseLocale: "vi"`, store copy in `messages/vi.json`, and generate typed `m.*` functions into `src/paraglide/`. Use strategy `["baseLocale"]` only (no URL prefixes). Wrap TanStack Start’s server entry with `paraglideMiddleware` and point Wrangler at that entry. Components and route `head` call message functions directly (no React i18n provider).

**Tech Stack:** `@inlang/paraglide-js` ^2, TanStack Start (Vite + Cloudflare SSR), Mantine, Vitest + Testing Library, Cypress, pnpm

**Spec:** `docs/superpowers/specs/2026-07-19-i18n-paraglide-design.md`

## Global Constraints

- Library: Paraglide JS only (do not add i18next / Lingui / react-intl)
- Locales: `vi` only; `baseLocale` must be `vi`
- No locale URL prefixes, no router `rewrite`, no language switcher UI
- UI API: generated `m.*` message functions + `getLocale()` from `src/paraglide/`
- Document: `<html lang={getLocale()}>`
- Work in the current workspace only — **never** `git worktree add`
- Before coding: create branch `feat/i18n-paraglide` from `main` (see Task 0)
- Do not commit unrelated dirty files (e.g. `.cursor/rules/plan-execution.mdc`)

## File Structure

| File | Responsibility |
| --- | --- |
| `tanstack-app/project.inlang/settings.json` | inlang locales + message path pattern |
| `tanstack-app/messages/vi.json` | Vietnamese source catalog |
| `tanstack-app/src/paraglide/` | Generated runtime + messages (compile output; do not hand-edit) |
| `tanstack-app/vite.config.ts` | `paraglideVitePlugin` with `strategy: ['baseLocale']` |
| `tanstack-app/src/server.ts` | Cloudflare/Start fetch entry wrapping `paraglideMiddleware` |
| `tanstack-app/wrangler.jsonc` | Point `main` at `./src/server.ts` |
| `tanstack-app/src/routes/__root.tsx` | `lang={getLocale()}`, title via `m.app_title()` |
| `tanstack-app/src/components/Home.tsx` | Render `m.home_welcome()` / `m.home_get_started()` |
| `tanstack-app/src/components/Home.test.tsx` | Assert Vietnamese heading from catalog |
| `tanstack-app/cypress/e2e/home.cy.ts` | Assert Vietnamese heading + `html[lang=vi]` |
| `tanstack-app/package.json` | Dependency + optional `paraglide` compile script |
| `tanstack-app/.gitignore` | Ignore inlang cache if present |

---

### Task 0: Create feature branch

**Files:** none (git only)

- [ ] **Step 1: Confirm on `main` and create branch**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git checkout main
git pull
git checkout -b feat/i18n-paraglide
```

Expected: current branch is `feat/i18n-paraglide`.

If not on `main` / pull fails / dirty tree blocks checkout: stop and ask the user before continuing.

---

### Task 1: Install Paraglide and create Vietnamese catalog

**Files:**
- Modify: `tanstack-app/package.json`, `tanstack-app/pnpm-lock.yaml`
- Create: `tanstack-app/project.inlang/settings.json`
- Create: `tanstack-app/messages/vi.json`
- Modify: `tanstack-app/vite.config.ts`
- Modify: `tanstack-app/.gitignore`
- Create (via compile): `tanstack-app/src/paraglide/**`

**Interfaces:**
- Consumes: none
- Produces: `m.app_title()`, `m.home_welcome()`, `m.home_get_started()` from `#/paraglide/messages`; `getLocale()` from `#/paraglide/runtime` returning `"vi"`

- [ ] **Step 1: Install package**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm add -D @inlang/paraglide-js
```

- [ ] **Step 2: Create `tanstack-app/project.inlang/settings.json`**

```json
{
  "$schema": "https://inlang.com/schema/project-settings",
  "baseLocale": "vi",
  "locales": ["vi"],
  "modules": [
    "https://cdn.jsdelivr.net/npm/@inlang/plugin-message-format@4/dist/index.js",
    "https://cdn.jsdelivr.net/npm/@inlang/plugin-m-function-matcher@2/dist/index.js"
  ],
  "plugin.inlang.messageFormat": {
    "pathPattern": "./messages/{locale}.json"
  }
}
```

- [ ] **Step 3: Create `tanstack-app/messages/vi.json`**

```json
{
  "$schema": "https://inlang.com/schema/inlang-message-format",
  "app_title": "TanStack Start",
  "home_welcome": "Chào mừng đến với TanStack Start",
  "home_get_started": "Chỉnh sửa src/routes/index.tsx để bắt đầu."
}
```

- [ ] **Step 4: Update `tanstack-app/vite.config.ts`**

Replace file contents with:

```ts
import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'
import { paraglideVitePlugin } from '@inlang/paraglide-js'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/paraglide',
      strategy: ['baseLocale'],
    }),
    devtools(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
```

- [ ] **Step 5: Add compile script to `package.json`**

Under `"scripts"`, add:

```json
"paraglide": "paraglide-js compile --project ./project.inlang --outdir ./src/paraglide --strategy baseLocale"
```

- [ ] **Step 6: Ignore inlang cache**

Append to `tanstack-app/.gitignore`:

```
project.inlang/cache
```

- [ ] **Step 7: Compile messages**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm run paraglide
```

Expected: `src/paraglide/` created with `messages.js` / `runtime.js` / `server.js` (exact filenames may include `.ts` or nested modules depending on Paraglide version — use whatever the compile step emits). Confirm `m.home_welcome` is importable.

Quick check:

```bash
node -e "import('./src/paraglide/messages.js').then(m => console.log(m.m.home_welcome()))"
```

Expected stdout: `Chào mừng đến với TanStack Start`  
(If the generated export shape differs — e.g. named exports per message — adjust the check to match the generated API, but keep call sites as `m.home_welcome()` from `#/paraglide/messages`.)

- [ ] **Step 8: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/package.json tanstack-app/pnpm-lock.yaml \
  tanstack-app/project.inlang/settings.json \
  tanstack-app/messages/vi.json \
  tanstack-app/vite.config.ts \
  tanstack-app/.gitignore \
  tanstack-app/src/paraglide
git commit -m "$(cat <<'EOF'
Add Paraglide with Vietnamese-only message catalog.

EOF
)"
```

---

### Task 2: Fail Home test on English copy (TDD)

**Files:**
- Modify: `tanstack-app/src/components/Home.test.tsx`
- Test: `tanstack-app/src/components/Home.test.tsx`

**Interfaces:**
- Consumes: `m.home_welcome()` from `#/paraglide/messages`
- Produces: failing test that requires Home to render Vietnamese catalog text

- [ ] **Step 1: Update `Home.test.tsx` to assert catalog Vietnamese**

Replace the assertion (and add the import) so the test expects the message function output:

```tsx
import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { m } from '#/paraglide/messages'
import { theme } from '../theme'
import { Home } from './Home'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
})

describe('Home', () => {
  it('renders the welcome heading with Mantine', () => {
    render(
      <MantineProvider theme={theme} defaultColorScheme="light">
        <Home />
      </MantineProvider>,
    )

    expect(
      screen.getByRole('heading', { name: m.home_welcome() }),
    ).toBeTruthy()
  })
})
```

If `#/paraglide/messages` fails to resolve under Vitest, use a relative import `../paraglide/messages` instead (and keep the same `m.home_welcome()` API). Prefer matching whatever import style works in this repo’s Vitest config.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/components/Home.test.tsx
```

Expected: FAIL — heading still English (`Welcome to TanStack Start`), not `m.home_welcome()`.

- [ ] **Step 3: Commit the failing test expectation**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/src/components/Home.test.tsx
git commit -m "$(cat <<'EOF'
Expect Home heading from Vietnamese Paraglide catalog.

EOF
)"
```

---

### Task 3: Wire Home + document lang/title to Paraglide

**Files:**
- Modify: `tanstack-app/src/components/Home.tsx`
- Modify: `tanstack-app/src/routes/__root.tsx`
- Test: `tanstack-app/src/components/Home.test.tsx`

**Interfaces:**
- Consumes: `m.app_title`, `m.home_welcome`, `m.home_get_started` from `#/paraglide/messages`; `getLocale` from `#/paraglide/runtime`
- Produces: Vietnamese Home UI; `<html lang="vi">`; document title from catalog

- [ ] **Step 1: Update `Home.tsx`**

```tsx
import { Stack, Text, Title } from '@mantine/core'
import { m } from '#/paraglide/messages'

export function Home() {
  return (
    <Stack p="xl" gap="md">
      <Title order={1}>{m.home_welcome()}</Title>
      <Text size="lg">{m.home_get_started()}</Text>
    </Stack>
  )
}
```

- [ ] **Step 2: Update `__root.tsx` for `lang` + title**

In `head()`, set title from the catalog:

```tsx
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'
```

Change the title meta entry to:

```tsx
{
  title: m.app_title(),
},
```

Change the document shell opening tag to:

```tsx
<html lang={getLocale()} {...mantineHtmlProps}>
```

Keep existing Mantine / devtools wiring unchanged.

- [ ] **Step 3: Run unit tests**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm test
```

Expected: all tests PASS, including Home heading matching `m.home_welcome()`.

- [ ] **Step 4: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/src/components/Home.tsx tanstack-app/src/routes/__root.tsx
git commit -m "$(cat <<'EOF'
Render Home and document metadata from Paraglide messages.

EOF
)"
```

---

### Task 4: SSR middleware via custom server entry

**Files:**
- Create: `tanstack-app/src/server.ts`
- Modify: `tanstack-app/wrangler.jsonc`

**Interfaces:**
- Consumes: `paraglideMiddleware` from `./paraglide/server` (generated); `@tanstack/react-start/server-entry`
- Produces: Cloudflare `fetch` handler that runs Paraglide middleware before Start

- [ ] **Step 1: Create `tanstack-app/src/server.ts`**

```ts
import handler from '@tanstack/react-start/server-entry'
import { paraglideMiddleware } from './paraglide/server.js'

export default {
  fetch(req: Request): Promise<Response> {
    return paraglideMiddleware(req, () => handler.fetch(req))
  },
}
```

If the generated server module path differs (e.g. `./paraglide/server` without `.js`), adjust the import to match compile output while keeping the same middleware wrapper shape.

- [ ] **Step 2: Point Wrangler at the custom entry**

In `tanstack-app/wrangler.jsonc`, change:

```json
"main": "@tanstack/react-start/server-entry"
```

to:

```json
"main": "./src/server.ts"
```

- [ ] **Step 3: Smoke-check dev server starts**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm dev
```

Expected: server starts on port 3000 without middleware import errors. Stop the process after confirming. If `src/server.ts` is ignored by the Cloudflare Vite plugin and only Wrangler deploy uses `main`, still keep the file + wrangler change per the TanStack Start + Paraglide pattern; verify `pnpm build` succeeds:

```bash
pnpm build
```

Expected: build completes successfully.

- [ ] **Step 4: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/src/server.ts tanstack-app/wrangler.jsonc
git commit -m "$(cat <<'EOF'
Wrap Start server entry with Paraglide SSR middleware.

EOF
)"
```

---

### Task 5: Update Cypress e2e for Vietnamese

**Files:**
- Modify: `tanstack-app/cypress/e2e/home.cy.ts`
- Test: `tanstack-app/cypress/e2e/home.cy.ts`

**Interfaces:**
- Consumes: catalog string `Chào mừng đến với TanStack Start` (same as `m.home_welcome()`)
- Produces: e2e coverage for Vietnamese heading and `lang="vi"`

- [ ] **Step 1: Replace `home.cy.ts`**

```ts
describe('Home page', () => {
  it('loads the Vietnamese welcome heading', () => {
    cy.visit('/')
    cy.document().its('documentElement.lang').should('eq', 'vi')
    cy.contains('h1', 'Chào mừng đến với TanStack Start').should('be.visible')
  })
})
```

- [ ] **Step 2: Run e2e**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm test:e2e
```

Expected: Cypress passes (dev server boots, home heading + `lang` assertions succeed).

- [ ] **Step 3: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/cypress/e2e/home.cy.ts
git commit -m "$(cat <<'EOF'
Assert Vietnamese Home copy and html lang in Cypress.

EOF
)"
```

---

### Task 6: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run unit tests**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm test
```

Expected: PASS

- [ ] **Step 2: Confirm no English Home heading remains**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
rg -n "Welcome to TanStack Start" src cypress || true
```

Expected: no matches under `src/` or `cypress/`.

- [ ] **Step 3: Confirm single-locale constraints**

```bash
rg -n "setLocale|language switcher|/vi/" src || true
rg -n "rewrite:" src/router.tsx || true
```

Expected: no language switcher / locale prefix routing added.

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Paraglide + `project.inlang` + `messages/vi.json` | Task 1 |
| Vite plugin, `src/paraglide/` generated | Task 1 |
| Strategy without URL prefixes (`baseLocale` only) | Task 1 |
| Home uses `m.*` | Task 3 |
| Document title + `lang={getLocale()}` | Task 3 |
| SSR `paraglideMiddleware` + server entry | Task 4 |
| Home unit test Vietnamese | Tasks 2–3 |
| Cypress updated | Task 5 |
| No switcher / no locale URLs | Task 6 |
