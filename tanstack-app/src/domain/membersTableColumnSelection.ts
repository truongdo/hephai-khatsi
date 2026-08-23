import type { SanghaType } from '#/domain/types'
import {
  allowedMembersExcelColumnIdSet,
  catalogMembersExcelColumns,
  defaultMembersTableColumnIds,
  membersTableDisplayColumns,
} from '#/domain/memberExcelColumns'

export function membersTableColumnsStorageKey(sanghaType: SanghaType): string {
  return `members-table-columns:${sanghaType}`
}

export function parseStoredMembersTableColumnIds(
  raw: string | null,
  sanghaType: SanghaType,
): string[] {
  const defaults = defaultMembersTableColumnIds(sanghaType)
  if (raw == null) return defaults
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === 'string')) {
      return defaults
    }
    const allowed = allowedMembersExcelColumnIdSet(sanghaType)
    const selected = new Set(parsed.filter((id) => allowed.has(id)))
    if (selected.size === 0) return defaults
    return membersTableDisplayColumns(sanghaType, [...selected]).map((c) => c.id)
  } catch {
    return defaults
  }
}

export function loadMembersTableColumnIds(
  sanghaType: SanghaType,
  storage: Pick<Storage, 'getItem'> = globalThis.localStorage,
): string[] {
  return parseStoredMembersTableColumnIds(
    storage.getItem(membersTableColumnsStorageKey(sanghaType)),
    sanghaType,
  )
}

export function saveMembersTableColumnIds(
  sanghaType: SanghaType,
  ids: string[],
  storage: Pick<Storage, 'setItem'> = globalThis.localStorage,
): void {
  const allowed = allowedMembersExcelColumnIdSet(sanghaType)
  const selected = new Set(ids.filter((id) => allowed.has(id)))
  const ordered = membersTableDisplayColumns(sanghaType, [...selected]).map((c) => c.id)
  storage.setItem(
    membersTableColumnsStorageKey(sanghaType),
    JSON.stringify(
      ordered.length > 0 ? ordered : defaultMembersTableColumnIds(sanghaType),
    ),
  )
}
