import * as XLSX from 'xlsx'
import { rankLabel } from '#/components/filler/fillerFormOptions'
import {
  membersExcelExportColumns,
  type MembersExcelRowContext,
} from '#/domain/memberExcelColumns'
import { memberHaLapHePhaiRank, sortMembersByHaLapSortKey } from '#/domain/haLapSortKey'
import type { Member, SanghaType } from '#/domain/types'
import { m } from '#/paraglide/messages'

export type MembersExcelCell = string | number

export const EMPTY_HA_LAP_HE_PHAI_RANK = '__empty__'

const TANG_EXCEL_SHEET_RANK_ORDER = ['ty_kheo', 'sa_di'] as const
const NI_EXCEL_SHEET_RANK_ORDER = [
  'ty_kheo_ni',
  'thuc_xoa_ma_na',
  'sa_di_ni',
  'sa_di',
] as const

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

export function groupMembersByHaLapHePhaiRank(
  members: Member[],
): Map<string, Member[]> {
  const groups = new Map<string, Member[]>()
  for (const member of members) {
    const rank = memberHaLapHePhaiRank(member) || EMPTY_HA_LAP_HE_PHAI_RANK
    const list = groups.get(rank) ?? []
    list.push(member)
    groups.set(rank, list)
  }
  return groups
}

export function orderedMembersExcelSheetGroups(
  members: Member[],
  sanghaType: SanghaType,
): Array<{ rankKey: string; members: Member[] }> {
  const groups = groupMembersByHaLapHePhaiRank(members)
  const canonicalOrder =
    sanghaType === 'tang' ? TANG_EXCEL_SHEET_RANK_ORDER : NI_EXCEL_SHEET_RANK_ORDER
  const result: Array<{ rankKey: string; members: Member[] }> = []
  const seen = new Set<string>()

  for (const rank of canonicalOrder) {
    const groupMembers = groups.get(rank)
    if (!groupMembers?.length) continue
    result.push({ rankKey: rank, members: sortMembersByHaLapSortKey(groupMembers) })
    seen.add(rank)
  }

  const otherRanks = [...groups.keys()]
    .filter(
      (rank) =>
        rank !== EMPTY_HA_LAP_HE_PHAI_RANK && !seen.has(rank) && groups.get(rank)?.length,
    )
    .sort((a, b) => a.localeCompare(b, 'vi'))

  for (const rank of otherRanks) {
    result.push({
      rankKey: rank,
      members: sortMembersByHaLapSortKey(groups.get(rank)!),
    })
  }

  const emptyMembers = groups.get(EMPTY_HA_LAP_HE_PHAI_RANK)
  if (emptyMembers?.length) {
    result.push({
      rankKey: EMPTY_HA_LAP_HE_PHAI_RANK,
      members: sortMembersByHaLapSortKey(emptyMembers),
    })
  }

  return result
}

export function sanitizeExcelSheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, '-').slice(0, 31)
}

export function excelSheetNameForHaLapHePhaiRank(
  rankKey: string,
  sanghaType: SanghaType,
): string {
  if (rankKey === EMPTY_HA_LAP_HE_PHAI_RANK) {
    return m.admin_members_export_sheet_empty_rank()
  }
  return rankLabel(rankKey, sanghaType) ?? rankKey
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
  const sheetGroups = orderedMembersExcelSheetGroups(members, sanghaType)
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
