import * as XLSX from 'xlsx'
import {
  catalogMembersExcelColumns,
  type MembersExcelRowContext,
} from '#/domain/memberExcelColumns'
import type { Member, SanghaType } from '#/domain/types'

export type MembersExcelCell = string | number

export function membersToExcelRows(
  members: Member[],
  sanghaType: SanghaType,
  columnIds: string[],
  ctx: MembersExcelRowContext,
): MembersExcelCell[][] {
  const selected = new Set(columnIds)
  const columns = catalogMembersExcelColumns(sanghaType).filter((c) => selected.has(c.id))
  return [
    ['STT', ...columns.map((c) => c.header())],
    ...members.map((member, index) => [
      index + 1,
      ...columns.map((c) => c.cell(member, ctx)),
    ]),
  ]
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
  options?: { filename?: string; sheetName?: string },
): void {
  const rows = membersToExcelRows(members, sanghaType, columnIds, ctx)
  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, options?.sheetName ?? 'Members')
  XLSX.writeFile(workbook, options?.filename ?? buildMembersExcelFilename(sanghaType))
}
