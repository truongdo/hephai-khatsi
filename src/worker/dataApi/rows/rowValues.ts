/** Value types D1 stores for the columns this app uses. */
export type ColumnValue = string | number | null

/** Optional domain fields are stored as NULL when absent. */
export function toColumn<T extends string | number>(value: T | null | undefined): T | null {
  return value ?? null
}

/**
 * Domain fields from columns of optional fields: NULL columns are left out, so
 * a record read back has the same keys as the one written.
 */
export function presentFields<T extends Record<string, ColumnValue>>(
  columns: T,
): { [K in keyof T]?: Exclude<T[K], null> } {
  const fields: { [K in keyof T]?: Exclude<T[K], null> } = {}
  for (const key of Object.keys(columns) as Array<keyof T>) {
    const value = columns[key]
    if (value !== null) fields[key] = value as Exclude<T[keyof T], null>
  }
  return fields
}

export function toBooleanColumn(value: boolean): number {
  return value ? 1 : 0
}

export function fromBooleanColumn(value: number): boolean {
  return value !== 0
}

/** A column value as an SQL literal, for generated SQL files (seed, import). */
export function sqlLiteral(value: ColumnValue): string {
  if (value === null) return 'NULL'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Cannot write ${value} as SQL`)
    return String(value)
  }
  return `'${value.replaceAll("'", "''")}'`
}

/** Serializes the part of a record kept in the `data` JSON column. */
export function toDataColumn(fields: object): string {
  return JSON.stringify(fields)
}

export function fromDataColumn<T>(data: string): T {
  return JSON.parse(data) as T
}
