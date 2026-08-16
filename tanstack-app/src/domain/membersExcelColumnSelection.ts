import type { SanghaType } from '#/domain/types'
import {
  allowedMembersExcelColumnIdSet,
  catalogMembersExcelColumns,
  defaultMembersExcelColumnIds,
} from '#/domain/memberExcelColumns'

export function membersExcelColumnsStorageKey(sanghaType: SanghaType): string {
  return `members-excel-columns:${sanghaType}`
}

export function parseStoredMembersExcelColumnIds(
  raw: string | null,
  sanghaType: SanghaType,
): string[] {
  const defaults = defaultMembersExcelColumnIds(sanghaType)
  if (raw == null) return defaults
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === 'string')) {
      return defaults
    }
    const allowed = allowedMembersExcelColumnIdSet(sanghaType)
    const selected = new Set(parsed.filter((id) => allowed.has(id)))
    if (selected.size === 0) return defaults
    return catalogMembersExcelColumns(sanghaType)
      .map((c) => c.id)
      .filter((id) => selected.has(id))
  } catch {
    return defaults
  }
}

export function loadMembersExcelColumnIds(
  sanghaType: SanghaType,
  storage: Pick<Storage, 'getItem'> = globalThis.localStorage,
): string[] {
  return parseStoredMembersExcelColumnIds(storage.getItem(membersExcelColumnsStorageKey(sanghaType)), sanghaType)
}

export function saveMembersExcelColumnIds(
  sanghaType: SanghaType,
  ids: string[],
  storage: Pick<Storage, 'setItem'> = globalThis.localStorage,
): void {
  const allowed = allowedMembersExcelColumnIdSet(sanghaType)
  const selected = new Set(ids.filter((id) => allowed.has(id)))
  const ordered = catalogMembersExcelColumns(sanghaType)
    .map((c) => c.id)
    .filter((id) => selected.has(id))
  storage.setItem(
    membersExcelColumnsStorageKey(sanghaType),
    JSON.stringify(ordered.length > 0 ? ordered : defaultMembersExcelColumnIds(sanghaType)),
  )
}
