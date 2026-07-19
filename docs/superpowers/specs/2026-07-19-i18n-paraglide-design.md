# i18n (Paraglide) — Design

Date: 2026-07-19  
App: `tanstack-app` (TanStack Start + React 19 + Vite + Cloudflare SSR)

## Goal

Add proper internationalization with **Paraglide JS**, defaulting to Vietnamese only. Structure the app so additional locales can be added later without rewriting call sites. Do **not** introduce locale URL prefixes or a language switcher yet.

## Decisions

| Topic | Choice |
| --- | --- |
| Library | Paraglide JS (`@inlang/paraglide-js`) |
| Locales | `vi` only; base locale `vi` |
| Routing | Fixed locale — no `/vi` prefix, no router rewrite |
| UI API | Generated message functions (`m.*`); no React i18n provider |
| Document lang | `<html lang={getLocale()}>` (always `"vi"` today) |
| SSR | Paraglide middleware at the Start/Cloudflare request boundary |

## Out of scope

- Additional locales (e.g. English)
- Language switcher UI
- Locale-aware URL prefixes / path rewriting
- Translator CI / inlang marketplace workflows beyond basic project setup
- Mantine Dates locale packages
- ICU/plural edge cases beyond what the first strings need

## Architecture

1. **`project.inlang/`** — inlang project config with locale `vi` as the only (and base) locale.
2. **`messages/vi.json`** — Vietnamese message catalog (source of truth for copy).
3. **`src/paraglide/`** — generated runtime and message modules (build output; not hand-edited).
4. **`vite.config.ts`** — add `paraglideVitePlugin` with `project: './project.inlang'` and `outdir: './src/paraglide'`.
5. **Request boundary** — wrap SSR requests with `paraglideMiddleware` so locale is consistent on the server (even with a single locale). Follow the official [TanStack Start + Paraglide](https://github.com/TanStack/router/tree/main/examples/react/start-i18n-paraglide) pattern; add a server entry if the current Cloudflare Vite setup does not expose one yet.
6. **`src/routes/__root.tsx`** — set `lang={getLocale()}`; move document `title` into a message key (e.g. `app_title`).
7. **`src/components/Home.tsx`** — replace hardcoded English with message functions (e.g. `m.home_welcome()`, `m.home_get_started()`).

## Message keys (initial)

| Key | Purpose |
| --- | --- |
| `app_title` | Document / browser title |
| `home_welcome` | Home page `h1` |
| `home_get_started` | Home page supporting text |

Exact Vietnamese wording is chosen at implementation time; tests assert against the catalog values.

## Usage flow

1. Add or edit strings in `messages/vi.json`.
2. Dev/build regenerates typed `m.*` functions under `src/paraglide/`.
3. Components and route `head` config call `m.keyName()` / `getLocale()` as needed.

Future locales: add `messages/<locale>.json` and enable Paraglide locale/URL strategy later; existing `m.*` call sites stay the same.

## Testing

- Update `Home.test.tsx` to assert the Vietnamese heading from the catalog (not English).
- Update `cypress/e2e/home.cy.ts` if it asserts English copy.
- No separate i18n test suite beyond verifying UI uses message-backed strings.

## Success criteria

- App defaults to Vietnamese; `<html lang="vi">`.
- Home copy and document title come from Paraglide messages.
- `pnpm test` and existing e2e pass.
- No language switcher; no locale URL prefixes.
