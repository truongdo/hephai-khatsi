# App logo — replace brand mark with `mylogo.svg`

## Goal

Replace the app brand logo (sidebar mark, browser favicon, and PWA icons) with the provided `tanstack-app/public/mylogo.svg` artwork, after normalizing that SVG for small-size display.

## Non-goals

- Do not change nav item icons for Tăng / Ni — keep `DharmaWheel`.
- Do not redesign the admin shell layout, colors, or app title copy.
- Do not add new Vitest or Cypress coverage for this asset swap.

## Current state

| Surface | Current asset |
| --- | --- |
| Admin sidebar brand circle | `DharmaWheel` React icon (`AdminShell.tsx`) |
| Browser tab | `public/favicon.svg` (dharma wheel on teal) |
| PWA / manifest | `favicon.ico`, `logo192.png`, `logo512.png` via `manifest.json` |
| Source artwork | `public/mylogo.svg` (CorelDRAW export: UTF-16, A4 `viewBox` 21000×29700, fill `#F58735`) |

## Approach

Normalize the SVG (trim `viewBox` to content, UTF-8), use it as the brand source, and regenerate favicon / PWA rasters from that cropped SVG.

## Implementation

### 1. Normalize `mylogo.svg`

- Compute a tight bounding box around the path content and set `viewBox` accordingly (optionally pad slightly for breathing room).
- Save as UTF-8; drop unused Corel metadata / XML noise where safe.
- Keep file at `tanstack-app/public/mylogo.svg` as the canonical brand SVG.

### 2. Admin sidebar brand mark

- In `AdminShell.tsx`, inside the existing circular brand box, replace `<DharmaWheel … />` with an `<img src="/mylogo.svg" alt="" />` (or equivalent) using `object-fit: contain` so the mark fills the circle without cropping incorrectly.
- Leave `DharmaWheel` imports for Tăng / Ni nav items unchanged.

### 3. Favicon

- Replace `public/favicon.svg` with a favicon-ready version of the cropped logo (transparent or simple background as needed for contrast on light/dark tabs).
- `index.html` already points at `/favicon.svg` — keep that link.

### 4. PWA / raster icons

- Regenerate `favicon.ico`, `logo192.png`, and `logo512.png` from the cropped SVG.
- Keep `manifest.json` icon paths as-is (`favicon.ico`, `logo192.png`, `logo512.png`).

## Verification

- Open an admin route: sidebar shows the new logo in the brand circle; Tăng / Ni still use the dharma-wheel nav icons.
- Browser tab shows the new favicon.
- Manual spot-check only — no new automated tests.

## Out of scope follow-ups

- Updating `manifest.json` `name` / `short_name` / theme colors (still sample defaults).
- Replacing `DharmaWheel` elsewhere in the product.
