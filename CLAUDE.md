# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

- Repo root — the whole application (Hệ phái Khất sĩ admin + public filler/registration forms). All `pnpm` commands run from here.
- `firebase/` — Firestore rules + indexes (`firestore.rules` is the data authorization boundary). `storage.rules` is legacy/unused (portraits live in R2). Wired up by root `firebase.json` (project `hephaikhatsi-82658`); the `hosting` block there is legacy — the app is deployed to Cloudflare.
- `docs/superpowers/specs/*-design.md` and `docs/superpowers/plans/*.md` — dated design specs and implementation plans for each feature; check these for the intent behind a feature before changing it.
- `.cursor/rules/*.mdc` — project rules (summarized below).

UI copy and domain vocabulary are Vietnamese (e.g. `giaoDoan`, `haLap`, `danhHieu`, `khoa tu` = retreat). Keep that naming in domain code.

## Commands (run in the repo root)

```bash
pnpm dev                 # Vite on :3000; proxies /api → 127.0.0.1:8787
pnpm exec wrangler dev   # Worker on :8787 (needed for /api: photos, docs, search, directory-role); secrets in .dev.vars
pnpm build               # vite build → dist/
pnpm exec tsc            # typecheck (tsconfig has noEmit); there is no lint script
pnpm test                # compiles paraglide messages, then vitest run (unit + dom projects)
pnpm exec vitest run src/domain/haLapSortKey.test.ts   # single test file
pnpm exec vitest run -t "name of test"                  # single test by name
pnpm emulator            # Firestore + Auth emulators (needs Java), uses ../firebase.json
pnpm test:integration    # *.integration.test.ts against running emulators (incl. firestore rules tests)
pnpm test:e2e            # starts dev server and runs Cypress headless (cypress/e2e/*.cy.ts)
pnpm deploy              # build + wrangler deploy (Worker + static assets + R2 + D1 bindings)
pnpm db:migrate:local    # apply migrations/*.sql to the local D1 (wrangler dev)
pnpm db:migrate:remote   # apply them to the production D1
```

- `pnpm test` runs `paraglide` first; if running vitest directly and `src/paraglide` is stale after editing `messages/vi.json`, run `pnpm paraglide`.
- Vitest has three projects (`vitest.config.ts`): `*.test.ts` run in **node**, `*.test.tsx` run in **jsdom** with `src/test/setup.ts`, and `src/worker/**/*.d1.test.ts` run in **workerd** (`@cloudflare/vitest-plugin`) against a local D1 with `migrations/` applied, fresh per test file (use `clearData` from `src/worker/dataApi/test/db.ts` in `beforeEach`). A `.ts` test that needs DOM/`window` must be added to the `domUnitTests` list in `vitest.config.ts`.
- D1 migration (in progress, see `docs/superpowers/plans/2026-10-30-firestore-to-d1-migration.md`): schema in `migrations/*.sql`, row ↔ domain mappers in `src/worker/dataApi/rows/`, server-side authz in `src/domain/authz/`, Worker data API `/api/data/*` in `src/worker/dataApi/` (handlers per table, D1 tests in `*.d1.test.ts`). Firestore is still the live backend: the data API is off and the photo/doc/search/directory-role routes read Firestore unless the Worker var `DATA_BACKEND` is `d1` (`src/worker/recordSource.ts`). Client side, each repository module exports the Firestore or the `src/repositories/d1/*` implementation (HTTP via `src/data/apiClient.ts`) by `VITE_DATA_BACKEND` (`src/data/dataBackend.ts`, default `firestore`); both flags must match. `migrations/0002_seed_org_units.sql` is generated (`pnpm db:seed-sql:org-units`).
- Integration tests are excluded from `pnpm test` and use `vitest.integration.config.ts`.
- Firestore rules/indexes deploy separately from the repo root via the Firebase CLI, not with `pnpm deploy`.
- One-off data scripts in `scripts/` (`seed:org-units`, `backfill:*`) run with `node --env-file=.env`. Admin custom claims are set via `scripts/set-he-phai-admin.mjs` (see `README.md`).

## Architecture

Client-only SPA (React 19, TanStack Router file routes, TanStack Query, Mantine, Firebase Auth/Firestore web SDK) plus a single Cloudflare Worker (`src/worker.ts`) that serves `dist/` assets and the `/api/*` routes. There is no app server between the browser and Firestore — the browser talks to Firestore directly, so **Firestore security rules enforce all data authorization**, and client queries must be shaped to satisfy them.

### Data layering (enforced by `.cursor/rules/firebase-tanstack.mdc`)

```
src/firebase (init, COLLECTIONS) → src/repositories (*Repo.ts, only place that calls Firestore SDK)
  → src/use-cases (multi-step operations: save/lock/delete/export…) → src/query (key factories + queryOptions)
  → routes / components
```

- `src/domain/` holds pure types and logic (claims parsing, sort keys, address normalization, Excel/PDF view-models) — keep it SDK-free and unit-tested.
- Components and routes must not import the Firestore SDK directly.
- Prefer one-shot `getDoc`/`getDocs` over `onSnapshot`; always `limit()` lists and paginate with cursors (never `offset`); use `getCountFromServer` for counts; set an intentional `staleTime`; invalidate targeted keys after mutations; seed detail cache from list data via `setQueryData`. Reads are billed — minimize them.
- Lists that need ordering rely on denormalized sort-key fields (see `domain/listSortKeys.ts`, `haLapSortKey.ts`) and composite indexes in `firebase/firestore.indexes.json`; new sorted/filtered queries usually need both an index and possibly a backfill script.

### Auth & roles

Roles come from Firebase Auth **custom claims** (`domain/authClaims.ts`): `he_phai_admin`, `he_phai_secretary`, `giao_doan_admin` (scoped by `orgUnitId`), `kiem_soat`; legacy `{admin: true}` maps to `he_phai_admin`. The same role logic is mirrored in `firebase/firestore.rules` — change both together and cover rules changes in `src/firebase/firestoreRules.integration.test.ts`. Granting directory roles goes through the Worker (`/api/admin/directory-role`, using the Identity Toolkit with a service account).

### Routes (`src/routes`, generated `routeTree.gen.ts` — do not edit by hand)

- `/admin/*` — authenticated admin UI (members, temples, retreats, org units, stats), guarded by `auth/RequireAuth`.
- `/f/$token/*` — public "filler" flow: an invite token lets unauthenticated users look up (by phone/CCCD) and edit their own member/temple record; records can be locked and edit-requested.
- `/r/$token/*` — public retreat (khóa tu) self-registration via a retreat invite token.

### Worker (`src/worker/`)

Routes in `src/worker.ts`: `/api/photos` and `/api/docs` (presigned R2 PUT + delete for portraits and member documents), `/api/admin/directory-role`, and Typesense search (`searchApi.ts`: search/upsert/delete/reindex). The Worker verifies Firebase ID tokens (`verifyFirebaseAdmin.ts`) or invite tokens, and talks to Firestore via REST with a service account. Client-side wrappers live in `src/photos/`, `src/search/`, `src/directoryRole/`. Images are read publicly from `VITE_PHOTOS_PUBLIC_BASE + photoPath`.

### i18n

Paraglide with a single `vi` locale: strings in `messages/vi.json`, used as `m.key()` from `#/paraglide/messages`. Don't hardcode UI copy.

### Imports

Use the `#/` alias for `src/` (`@/` also resolves).

## Project rules (from `.cursor/rules`)

- **Stack**: Firebase is the only database; Mantine is the only UI kit (theme in `src/theme.ts`). Confirm with the user before diverging.
- **Query/Router**: server state lives in Query, never mirrored into `useState`; one module-level `QueryClient` (`query/queryClient.ts`); every `queryFn` dependency in the key; loaders use `ensureQueryData` with shared `queryOptions`; `loaderDeps` returns only the params the loader reads; stable module-level `select`. Don't add `useMemo`/`useCallback` by default.
- **Large forms**: single `draft`/`setDraft` in the shell; each section is a `memo()` child receiving only its field values + `setDraft`; read `event.currentTarget.value` before calling `setDraft`; memoize address `Select`s with stable `onChange`. Reference: `TempleEditorForm.tsx`, `TempleEditorFormSections.tsx`, `VietnamAddressFields.tsx`.
- **Tests**: Vitest + Testing Library for components/logic (colocated `*.test.ts(x)`); Cypress only for smoke tests or one critical journey per feature — never for styling/copy tweaks.
- **Branching when executing a plan**: branch from `main` (`feat/…`, `fix/…`) with `git checkout -b`; do **not** use git worktrees; if not on `main`, ask before proceeding. After the branch is squash-merged into `main`, delete the local branch.
