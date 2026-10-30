import * as XLSX from 'xlsx'
import {
  membersExcelExportColumns,
  type MembersExcelRowContext,
} from '#/domain/memberExcelColumns'
import {
  excelSheetNameForHaLapHePhaiRank,
  orderedMembersHaLapGroups,
  sanitizeExcelSheetName,
} from '#/domain/membersHaLapGroups'
import type { Member, SanghaType } from '#/domain/types'
import { m } from '#/paraglide/messages'

export { orderedMembersHaLapGroups as orderedMembersExcelSheetGroups } from '#/domain/membersHaLapGroups'

export type MembersExcelCell = string | number

export function membersToExcelRows(
  members: Member[],
  sanghaType: SanghaType,
  columnIds: string[],
  ctx: MembersExcelRowContext,
): MembersExcelCell[][] {
  const columns = membersExcelExportColumns(sanghaType, columnIds)
  return [
    ['STT', ...columns.map((c) => c.header())],
    ...members.map((member, index) => [
      index + 1,
      ...columns.map((c) => c.cell(member, ctx)),
    ]),
  ]
}

function uniqueExcelSheetName(baseName: string, usedNames: Set<string>): string {
  let candidate = sanitizeExcelSheetName(baseName)
  if (!usedNames.has(candidate)) return candidate

  for (let index = 2; index < 100; index++) {
    const suffix = ` (${index})`
    const trimmedBase = baseName.slice(0, Math.max(0, 31 - suffix.length))
    candidate = sanitizeExcelSheetName(`${trimmedBase}${suffix}`)
    if (!usedNames.has(candidate)) return candidate
  }

  return sanitizeExcelSheetName(`${baseName.slice(0, 24)}-${Date.now()}`)
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function buildMembersExcelFilename(
  sanghaType: SanghaType,
  date: Date = new Date(),
): string {
  return `${sanghaType}-members-${formatLocalDate(date)}.xlsx`
}

export function downloadMembersExcel(
  members: Member[],
  sanghaType: SanghaType,
  columnIds: string[],
  ctx: MembersExcelRowContext,
  options?: { filename?: string },
): void {
  const sheetGroups = orderedMembersHaLapGroups(members, sanghaType)
  const workbook = XLSX.utils.book_new()
  const usedSheetNames = new Set<string>()

  if (sheetGroups.length === 0) {
    const rows = membersToExcelRows([], sanghaType, columnIds, ctx)
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(rows),
      uniqueExcelSheetName(m.admin_members_export_sheet_empty_rank(), usedSheetNames),
    )
  } else {
    for (const { rankKey, members: groupMembers } of sheetGroups) {
      const sheetName = uniqueExcelSheetName(
        excelSheetNameForHaLapHePhaiRank(rankKey, sanghaType),
        usedSheetNames,
      )
      usedSheetNames.add(sheetName)
      const rows = membersToExcelRows(groupMembers, sanghaType, columnIds, ctx)
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName)
    }
  }

  XLSX.writeFile(workbook, options?.filename ?? buildMembersExcelFilename(sanghaType))
}
