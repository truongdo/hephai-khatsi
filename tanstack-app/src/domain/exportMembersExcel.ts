import * as XLSX from 'xlsx'
import type { Member, SanghaType } from '#/domain/types'

export const MEMBERS_EXCEL_HEADERS = [
  'STT',
  'Họ và tên',
  'Pháp danh',
  'Năm sinh',
  'số CCCD',
  'Ngày cấp',
  'Nơi Cấp',
  'Năm thọ giới tỳ kheo/tỳ kheo Ni',
  'Trú xứ Hiện tu học',
] as const

export type MembersExcelCell = string | number

function cell(value: string | undefined): string {
  return value ?? ''
}

function preceptNgayGh(member: Member, sanghaType: SanghaType): string {
  if (sanghaType === 'tang') return cell(member.gioiTyKheo?.ngayGh)
  return cell(member.gioiTyKheoNi?.ngayGh)
}

export function membersToExcelRows(
  members: Member[],
  sanghaType: SanghaType,
): MembersExcelCell[][] {
  return [
    [...MEMBERS_EXCEL_HEADERS],
    ...members.map((member, index) => [
      index + 1,
      cell(member.theDanh),
      cell(member.phapDanh),
      cell(member.ngaySinh),
      cell(member.cccd),
      cell(member.cccdMeta?.ngayCap),
      cell(member.cccdMeta?.noiCap),
      preceptNgayGh(member, sanghaType),
      cell(member.hienTuHoc),
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
  options?: { filename?: string; sheetName?: string },
): void {
  const rows = membersToExcelRows(members, sanghaType)
  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, options?.sheetName ?? 'Members')
  XLSX.writeFile(workbook, options?.filename ?? buildMembersExcelFilename(sanghaType))
}
