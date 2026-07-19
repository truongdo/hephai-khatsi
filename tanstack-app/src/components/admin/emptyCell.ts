export function emptyCell(value: string | null | undefined): string {
  if (value == null) return '-'
  const trimmed = value.trim()
  return trimmed.length === 0 ? '-' : trimmed
}
