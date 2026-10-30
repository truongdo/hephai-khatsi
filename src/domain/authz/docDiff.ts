// Field comparisons the rules do on whole documents (`==`, `get(k, null)`,
// `diff().affectedKeys()`). Records come from D1 row mappers, where a NULL
// column of an optional field reads back as absent, so an absent field and a
// null one are the same value here.

type Doc = object

function field(doc: Doc, key: string): unknown {
  return (doc as Record<string, unknown>)[key] ?? null
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, i) => valuesEqual(item, b[i]))
    )
  }
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return false
  }
  // Nested maps compare like their JSON: keys holding `undefined` do not exist.
  const aRecord = a as Record<string, unknown>
  const bRecord = b as Record<string, unknown>
  const keys = new Set(
    [...Object.keys(aRecord), ...Object.keys(bRecord)].filter(
      (key) => aRecord[key] !== undefined || bRecord[key] !== undefined,
    ),
  )
  return [...keys].every((key) => valuesEqual(aRecord[key], bRecord[key]))
}

/** `after.k == before.k` for every key (absent counts as null). */
export function unchanged(before: Doc, after: Doc, keys: readonly string[]): boolean {
  return keys.every((key) => valuesEqual(field(before, key), field(after, key)))
}

/** Keys whose value differs between the two records (`diff().affectedKeys()`). */
export function changedKeys(before: Doc, after: Doc): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...keys].filter((key) => !valuesEqual(field(before, key), field(after, key)))
}

/** `diff().affectedKeys().hasOnly(allowed)`. */
export function changedOnly(before: Doc, after: Doc, allowed: readonly string[]): boolean {
  return changedKeys(before, after).every((key) => allowed.includes(key))
}

export function isString(value: unknown): value is string {
  return typeof value === 'string'
}
