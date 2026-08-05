# Filler save: visible validation feedback

Date: 2026-08-05  
Status: approved for planning  
Depends on: `2026-07-25-sticky-form-actions-design.md`, `2026-07-23-member-required-core-fields-design.md`, `2026-07-25-temple-required-fields-design.md`  
Surfaces: filler `MemberEditorForm` and `TempleEditorForm` **Lưu** (via `FillerEditorShell` / `FormStickyActions`)

## Goal

When the user taps **Lưu** and required-field validation fails, they must see feedback **without scrolling** — a sticky-bar Alert plus scroll to the first invalid field. Field-level errors stay as today.

## Decisions

| Topic | Choice |
|-------|--------|
| Approach | Sticky Alert via new `validationError` prop on `FillerEditorShell` + `scrollToFirstFieldError` after `setFieldErrors` |
| Scope | Filler member + temple editors only |
| Admin Hoàn thành | Out of scope (same gap; follow-up if needed) |
| Field errors | Unchanged (`setFieldErrors` / Mantine `error` props) |
| Summary copy | One new Paraglide key (vi): short fixed message, not a per-field list |
| Dismiss | Existing `FormStickyActions` CloseButton dismisses the sticky status; does **not** clear field-level errors |

## Non-goals

- Changing which fields are required or validator logic
- Listing every missing field in the sticky Alert
- Admin forms / Cypress
- Toast / notification stack (`@mantine/notifications`)

## Root cause

**Lưu** lives in a viewport-fixed sticky footer. On validation failure the forms only set per-field errors, which often sit above the fold (e.g. portrait). Sticky status currently shows API `saveError` / success only — not client validation — so a failed Lưu looks like a no-op until the user scrolls.

## Behavior

On **Lưu** when `validate*RequiredFields` returns `valid: false`:

1. Call `api.setFieldErrors(result.errors)` (unchanged).
2. Set `validationError` to the new i18n string (e.g. `filler_validation_incomplete`).
3. After paint (e.g. `requestAnimationFrame` twice or `queueMicrotask` + `requestAnimationFrame`), call `scrollToFirstFieldError` within the editor content root:
   - Prefer first `[aria-invalid="true"]`.
   - Else first `[data-field-error="true"]` (for custom controls that only show error `Text`).
   - `scrollIntoView({ behavior: 'smooth', block: 'center' })` so sticky header/footer do not fully cover the target.
4. Do **not** open the save-confirm modal.

When validation passes:

1. `api.clearFieldErrors()`.
2. Clear `validationError`.
3. Open confirm modal as today.

Also clear `validationError` when:

- Setting a new API `saveError` / `saveSuccess` (avoid stacked conflicting statuses)
- User edits the draft again (`onDraftChange` / equivalent), so the summary does not linger after they start fixing fields (field-level errors clear only on the next successful validate or explicit `clearFieldErrors`)

Dismissing the sticky status only hides the Alert for that signature; field errors remain until the next successful validate or explicit `clearFieldErrors`.

## UI wiring

```ts
// FillerEditorShell — conceptual
validationError?: string | null
// In FormStickyActions status:
{validationError ? <Alert color="red">{validationError}</Alert> : null}
{saveError ? <Alert color="red">{saveError}</Alert> : null}
// …existing success / request-edit alerts
```

`MemberEditorForm` / `TempleEditorForm` `handleSave`: on invalid → set validation error + scroll; on valid → clear both error channels used for validation summary.

## Scroll helper

Small shared util (e.g. `scrollToFirstFieldError(root: ParentNode)` under `src/components/` or `src/lib/`).

Custom controls that render error as plain `Text` without Mantine `error` (portrait, documents) must set `data-field-error="true"` on the error node **or** `aria-invalid` on the interactive control when `error` is present, so scroll can find them. Prefer minimal attribute on the existing error `Text` / wrapper — no redesign of those fields.

## i18n

| Key | vi (proposed) |
|-----|----------------|
| `filler_validation_incomplete` | Vui lòng điền các mục bắt buộc còn thiếu. |

## Testing

| Layer | Coverage |
|-------|----------|
| Unit | `scrollToFirstFieldError` — prefers `aria-invalid`, falls back to `data-field-error`; no-op when none |
| Component | Filler shell: `validationError` renders in sticky status |
| Component | Member and/or temple editor: Lưu with missing required → sticky Alert text; `scrollIntoView` called (mock `Element.prototype.scrollIntoView`); confirm modal not opened |

## Out of scope follow-ups

- Same sticky + scroll on admin **Hoàn thành**
- Focus management / `focus()` on first invalid control (scroll-only in v1)
