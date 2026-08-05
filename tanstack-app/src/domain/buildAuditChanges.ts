import type { AuditChange } from './auditLog'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function valuesEqual(before: unknown, after: unknown): boolean {
  if (Object.is(before, after)) return true
  if (Array.isArray(before) && Array.isArray(after)) {
    return JSON.stringify(before) === JSON.stringify(after)
  }
  return false
}

function diffObjects(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  prefix: string,
): AuditChange[] {
  const changes: AuditChange[] = []
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])

  for (const key of keys) {
    if (key === 'updatedAt') continue

    const path = prefix ? `${prefix}.${key}` : key
    const beforeVal = before[key]
    const afterVal = after[key]

    if (isPlainObject(beforeVal) && isPlainObject(afterVal)) {
      changes.push(...diffObjects(beforeVal, afterVal, path))
      continue
    }

    if (valuesEqual(beforeVal, afterVal)) continue

    changes.push({ path, before: beforeVal, after: afterVal })
  }

  return changes
}

export function buildAuditChanges(before: unknown, after: unknown): AuditChange[] {
  const normalizedBefore = before == null ? {} : before
  const normalizedAfter = after == null ? {} : after

  if (isPlainObject(normalizedBefore) && isPlainObject(normalizedAfter)) {
    return diffObjects(normalizedBefore, normalizedAfter, '')
  }

  if (valuesEqual(normalizedBefore, normalizedAfter)) return []

  return [{ path: '', before: normalizedBefore, after: normalizedAfter }]
}
