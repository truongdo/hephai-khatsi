# Mantine initialization — Design

Date: 2026-07-19  
App: `tanstack-app` (TanStack Start + React 19 + Vite + Cloudflare SSR)

## Goal

Initialize Mantine as the UI system for the app: provider, theme, styles, and system color scheme. Remove Tailwind so styling has a single source of truth.

## Decisions

| Topic | Choice |
| --- | --- |
| Packages | `@mantine/core` + `@mantine/hooks` only |
| Styling | Mantine only — remove Tailwind |
| Color scheme | System preference (`defaultColorScheme="auto"`) |
| Structure | Theme module + root wiring (not a separate providers file) |

## Out of scope

- Custom brand colors / fonts
- Manual light/dark toggle UI
- `@mantine/notifications`, `@mantine/form`, `@mantine/dates`, and other Mantine packages
- Firebase or other app features

## Architecture

1. **`src/theme.ts`** — exports a `createTheme({})` object (minimal defaults; extend later).
2. **`postcss.config.cjs`** — `postcss-preset-mantine` + `postcss-simple-vars` breakpoints per [Mantine Vite guide](https://mantine.dev/guides/vite/).
3. **`src/routes/__root.tsx`** (document shell):
   - Import `@mantine/core/styles.css`.
   - Render `ColorSchemeScript` with `defaultColorScheme="auto"` in `<head>` (required for SSR to avoid color-scheme flash).
   - Wrap `{children}` with `MantineProvider` using the same `defaultColorScheme="auto"`, `theme`, and `deduplicateInlineStyles` (React 19).
4. **`src/styles.css`** — drop Tailwind import; keep a minimal `html`/`body`/`#app` reset.
5. **`src/routes/index.tsx`** — replace Tailwind classes with Mantine `Stack` / `Title` / `Text` as a smoke-test page.
6. **`vite.config.ts`** — remove `@tailwindcss/vite` plugin.
7. **`package.json`** — add Mantine + PostCSS deps; remove `tailwindcss`, `@tailwindcss/vite`, `@tailwindcss/typography`.

## Color scheme contract

`ColorSchemeScript` and `MantineProvider` **must** use the same `defaultColorScheme` value (`"auto"`). Mismatch causes flash of inaccurate color scheme on SSR.

## Success criteria

- `pnpm install` and `pnpm dev` succeed with no Tailwind.
- Home page renders with Mantine components and styles.
- System light/dark preference applies without a flash on SSR.
- No remaining Tailwind imports, Vite plugin, or class usage under `tanstack-app`.
