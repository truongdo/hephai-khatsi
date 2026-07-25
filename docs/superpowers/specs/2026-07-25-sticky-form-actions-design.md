# Sticky form action bar

Date: 2026-07-25  
Status: approved for planning / implementation  
Surfaces: filler member & temple editors; admin member & temple form pages

## Goal

Keep primary form actions reachable while scrolling long member/temple forms.

## Decisions

| Topic | Choice |
|-------|--------|
| Pattern | Sticky bottom action bar (viewport-fixed) |
| Scope | Filler + admin (same pattern) |
| Duplicate bottom buttons | **Remove** — sticky bar is the only action strip |
| Semantics | Unchanged (same save / complete / lock handlers) |
| Status feedback | Success/error/pending visible near the bar |

## Behavior

1. Bar is `position: fixed` (or sticky within a full-height layout) at the bottom of the viewport.
2. Includes `padding-bottom: env(safe-area-inset-bottom)`.
3. Form content has enough bottom padding that the last fields are not covered.
4. Buttons mirror current actions:
   - Filler: `Lưu` (when editable)
   - Admin: `Lưu nháp`, `Hoàn thành`, lock/unlock when applicable
5. Loading/disabled state shared with existing mutations.
6. Buttons wrap on narrow widths; no overflow menu in v1.

## Visual

- Light background matching app surface; top border or light shadow for separation.
- Mantine `Group` / `Button` variants already used on these pages.
- No FAB, no new color system.

## Non-goals

- Autosave
- Per-section save
- Changing validation or lock rules
- Cypress (update Vitest queries if button location/roles change)

## Implementation sketch

- Shared `FormStickyActions` shell: children = action buttons + optional status node; applies fixed bar + safe-area + content spacer via CSS variable or sibling spacer.
- Wire into filler editor shells and admin form pages; delete in-flow action `Group` at form bottom.
- Vitest: assert save buttons remain findable by role/name (may need to account for portal/fixed if any).
