# Cypress e2e baseline — Design

Date: 2026-07-19  
App: `tanstack-app` (TanStack Start + React 19 + Vite + Mantine)

## Goal

Add a local Cypress end-to-end testing baseline: TypeScript config, scripts (`cy:open`, `cy:run`, `test:e2e`), one home-page smoke test, and README docs. Keep Vitest for unit/component tests.

## Decisions

| Topic | Choice |
| --- | --- |
| Scope | E2E only (no Cypress Component Testing) |
| Unit tests | Keep Vitest + Testing Library unchanged |
| Language | TypeScript (`cypress.config.ts`, `*.cy.ts`) |
| Location | Inside `tanstack-app/` |
| Server for headless | `start-server-and-test` boots `pnpm dev`, waits on `http://localhost:3000`, then `cy:run` |
| `baseUrl` | `http://localhost:3000` (matches existing `dev` script port) |
| CI | Out of scope for this pass |

## Out of scope

- GitHub Actions / CI wiring
- Cypress Component Testing
- Custom Cypress commands beyond defaults
- Non-default video/screenshot configuration
- Replacing or removing Vitest

## Architecture

1. **`cypress.config.ts`** — e2e-only Cypress config with `baseUrl: 'http://localhost:3000'`.
2. **`cypress/e2e/home.cy.ts`** — smoke: `cy.visit('/')`, assert heading `Welcome to TanStack Start` (current `Home` copy).
3. **`cypress/support/e2e.ts`** — minimal default support entry.
4. **`package.json` scripts:**
   - `cy:open` → `cypress open`
   - `cy:run` → `cypress run`
   - `test:e2e` → `start-server-and-test` with `dev`, `http://localhost:3000`, `cy:run`
5. **Dependencies (dev):** `cypress`, `start-server-and-test`.
6. **`.gitignore`** — ignore Cypress artifacts (`cypress/screenshots`, `cypress/videos`, `cypress/downloads`).
7. **`README.md` Testing section** — document Vitest (`pnpm test`) vs Cypress (`pnpm cy:open`, `pnpm test:e2e`).

## Test layer contract

| Layer | Tool | Command | Purpose |
| --- | --- | --- | --- |
| Unit / component | Vitest + Testing Library | `pnpm test` | Fast isolated tests (jsdom) |
| End-to-end | Cypress | `pnpm test:e2e` / `pnpm cy:open` | Real browser against running app |

## Local workflow

- **Interactive:** start `pnpm dev` (if needed), then `pnpm cy:open`.
- **Headless one-shot:** `pnpm test:e2e` starts the dev server, waits until ready, runs Cypress headless, then tears down.

## Success criteria

- `pnpm test` still passes (Vitest unchanged in behavior).
- `pnpm test:e2e` passes on a fresh install with the home smoke test green.
- README clearly describes both testing layers and the Cypress commands.
- No CI workflows added in this change.
