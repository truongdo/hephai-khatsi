/** Find the first invalid control / error marker and scroll it into view. */
export function scrollToFirstFieldError(root: ParentNode = document): void {
  const target =
    (root.querySelector('[aria-invalid="true"]') as HTMLElement | null) ??
    (root.querySelector('[data-field-error="true"]') as HTMLElement | null)
  target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

/** Run after React paints field errors from `setFieldErrors`. */
export function scheduleScrollToFirstFieldError(
  root: ParentNode = document,
): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      scrollToFirstFieldError(root)
    })
  })
}
