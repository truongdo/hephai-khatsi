# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

- Repo root — the whole application (Hệ phái Khất sĩ admin + public filler/registration forms). All `pnpm` commands run from here.
- `migrations/*.sql` — the D1 schema (`wrangler d1 migrations`); `0002_seed_org_units.sql` is generated (`pnpm db:seed-sql:org-units`).
- `docs/superpowers/specs/*-design.md` and `docs/superpowers/plans/*.md` — dated design specs and implementation plans for each feature; check these for the intent behind a feature before changing it.
- `.cursor/rules/*.mdc` — project rules (summarized below).

UI copy and domain vocabulary are Vietnamese (e.g. `giaoDoan`, `haLap`, `danhHieu`, `khoa tu` = retreat). Keep that naming in domain code.

## Commands (run in the repo root)

```bash
pnpm dev                 # Vite on :3000; proxies /api → 127.0.0.1:8787
pnpm exec wrangler dev   # Worker on :8787 (all /api: data, photos, docs, search, directory-role); secrets in .dev.vars
pnpm build               # vite build → dist/
pnpm exec tsc            # typecheck (tsconfig has noEmit); there is no lint script
pnpm test                # compiles paraglide messages, then vitest run (unit, dom and worker-d1 projects)
pnpm exec vitest run src/domain/haLapSortKey.test.ts   # single test file
pnpm exec vitest run -t "name of test"                  # single test by name
pnpm test:e2e            # starts dev server and runs Cypress headless (cypress/e2e/*.cy.ts)
pnpm run deploy          # build + wrangler deploy (Worker + static assets + R2 + D1 bindings)
pnpm db:migrate:local    # apply migrations/*.sql to the local D1 (wrangler dev)
pnpm db:migrate:remote   # apply them to the production D1
pnpm db:migrate:preview  # apply them to hephai-khatsi-preview (the binding's preview_database_id)
```

- `pnpm test` runs `paraglide` first; if running vitest directly and `src/paraglide` is stale after editing `messages/vi.json`, run `pnpm paraglide`.
- Vitest has three projects (`vitest.config.ts`): `*.test.ts` run in **node**, `*.test.tsx` run in **jsdom** with `src/test/setup.ts`, and `src/worker/**/*.d1.test.ts` run in **workerd** (`@cloudflare/vitest-plugin`) against a local D1 with `migrations/` applied, fresh per test file (use `clearData` from `src/worker/dataApi/test/db.ts` in `beforeEach`). A `.ts` test that needs DOM/`window` must be added to the `domUnitTests` list in `vitest.config.ts`.
- New migrations are applied with `pnpm db:migrate:remote` before deploying code that needs them (`pnpm run deploy` does not migrate).
- Admin custom claims are set via `scripts/set-he-phai-admin.mjs` (see `README.md`).
- The data moved from Firestore to D1 (`docs/superpowers/plans/2026-10-30-firestore-to-d1-migration.md`). The Firestore database is kept read-only (frozen rules deployed at the cutover) as a backup until it is deleted; nothing in the app reads it.

## Architecture

Client-only SPA (React 19, TanStack Router file routes, TanStack Query, Mantine, Firebase Auth web SDK) plus a single Cloudflare Worker (`src/worker.ts`) that serves `dist/` assets and the `/api/*` routes. All data lives in Cloudflare D1 (binding `DB`) and is reached only through the Worker's data API `/api/data/*`, which verifies the caller (Firebase ID token, or nothing for the public forms, checked against the invite) and **enforces all data authorization server-side** with the pure functions in `src/domain/authz/`.

### Data layering (enforced by `.cursor/rules/firebase-tanstack.mdc`)

```
routes / components → src/query (key factories + queryOptions)
  → src/use-cases (multi-step operations: save/lock/delete/export…)
  → src/repositories (*Repo.ts: Store types; d1/*: fetch via src/data/apiClient.ts)
  → Worker /api/data/* (src/worker/dataApi: authz in src/domain/authz) → D1
```

- `src/domain/` holds pure types and logic (claims parsing, authz, sort keys, address normalization, Excel/PDF view-models) — keep it SDK-free and unit-tested.
- Components and routes must not call `/api/data/*` directly; go through the repositories.
- Worker data API: router `src/worker/dataApi/index.ts`, handlers per table in `handlers/*.ts` (D1 tests in `*.d1.test.ts`), row ↔ domain mappers in `rows/`. Writes are one `db.batch` guarded by a `version` column (lost race → `CONFLICT` / 409; the client retries once) and sync Typesense in `ctx.waitUntil` (`searchSync.ts`). Routes outside the data API (photos, docs, search, directory-role) read D1 through `src/worker/recordSource.ts`.
- Paginate lists with the opaque `cursor` the Worker returns (never offsets); stats come from one request (`stats/*`); set an intentional `staleTime`; invalidate targeted keys after mutations; seed detail cache from list data via `setQueryData`.
- Lists that need ordering rely on denormalized sort-key columns (computed in the Worker with `domain/listSortKeys.ts`, `haLapSortKey.ts`) and SQL indexes in `migrations/`; a new sorted/filtered query needs an index in a new migration and an `EXPLAIN QUERY PLAN` check in its D1 test.

### Auth & roles

Roles come from Firebase Auth **custom claims** (`domain/authClaims.ts`): `he_phai_admin`, `he_phai_secretary`, `giao_doan_admin` (scoped by `orgUnitId`), `kiem_soat`; legacy `{admin: true}` maps to `he_phai_admin`. The Worker turns a verified ID token into a `Caller` (`verifyFirebaseUser`) and checks it with `src/domain/authz/*` — change role logic there and cover it in `src/domain/authz/*.test.ts` (incl. the table-driven `roles.test.ts`). Granting directory roles goes through the Worker (`/api/admin/directory-role`, using the Identity Toolkit with a service account).

### Routes (`src/routes`, generated `routeTree.gen.ts` — do not edit by hand)

- `/admin/*` — authenticated admin UI (members, temples, retreats, org units, stats), guarded by `auth/RequireAuth`.
- `/f/$token/*` — public "filler" flow: an invite token lets unauthenticated users look up (by phone/CCCD) and edit their own member/temple record; records can be locked and edit-requested.
- `/r/$token/*` — public retreat (khóa tu) self-registration via a retreat invite token.

### Worker (`src/worker/`)

Routes in `src/worker.ts`: `/api/data/*` (the data API above), `/api/photos` and `/api/docs` (presigned R2 PUT + delete for portraits and member documents), `/api/admin/directory-role`, and Typesense search (`searchApi.ts`: search, reindex from D1). The Worker verifies Firebase ID tokens (`verifyFirebaseAdmin.ts`) or invite tokens and reads D1. Client-side wrappers live in `src/data/`, `src/photos/`, `src/search/`, `src/directoryRole/`. Images are read publicly from `VITE_PHOTOS_PUBLIC_BASE + photoPath`.

### i18n

Paraglide with a single `vi` locale: strings in `messages/vi.json`, used as `m.key()` from `#/paraglide/messages`. Don't hardcode UI copy.

### Imports

Use the `#/` alias for `src/` (`@/` also resolves).

## Project rules (from `.cursor/rules`)

- **Stack**: Cloudflare D1 (behind the Worker) is the only database, Firebase is for Auth only; Mantine is the only UI kit (theme in `src/theme.ts`). Confirm with the user before diverging.
- **Query/Router**: server state lives in Query, never mirrored into `useState`; one module-level `QueryClient` (`query/queryClient.ts`); every `queryFn` dependency in the key; loaders use `ensureQueryData` with shared `queryOptions`; `loaderDeps` returns only the params the loader reads; stable module-level `select`. Don't add `useMemo`/`useCallback` by default.
- **Large forms**: single `draft`/`setDraft` in the shell; each section is a `memo()` child receiving only its field values + `setDraft`; read `event.currentTarget.value` before calling `setDraft`; memoize address `Select`s with stable `onChange`. Reference: `TempleEditorForm.tsx`, `TempleEditorFormSections.tsx`, `VietnamAddressFields.tsx`.
- **Tests**: Vitest + Testing Library for components/logic (colocated `*.test.ts(x)`); Cypress only for smoke tests or one critical journey per feature — never for styling/copy tweaks.
- **Branching when executing a plan**: branch from `main` (`feat/…`, `fix/…`) with `git checkout -b`; do **not** use git worktrees; if not on `main`, ask before proceeding. After the branch is squash-merged into `main`, delete the local branch.
