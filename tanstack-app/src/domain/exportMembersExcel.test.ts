import { describe, expect, it } from 'vitest'
import type { Member } from '#/domain/types'
import {
  MEMBERS_EXCEL_HEADERS,
  buildMembersExcelFilename,
  membersToExcelRows,
} from '#/domain/exportMembersExcel'

function member(overrides: Partial<Member> & Pick<Member, 'id' | 'sanghaType'>): Member {
  return {
    orgUnitId: 'gd-i',
    status: 'draft',
    cccd: '012345678901',
    inviteId: null,
    currentTempleId: null,
    photoPath: null,
    createdAt: '2026-07-19T00:00:00.000Z',
    updatedAt: '2026-07-19T00:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    editRequestedAt: null,
    editRequestedBy: null,
    ...overrides,
  }
}

describe('membersToExcelRows', () => {
  it('includes Vietnamese headers as the first row', () => {
    const rows = membersToExcelRows([], 'tang')
    expect(rows).toEqual([[...MEMBERS_EXCEL_HEADERS]])
  })

  it('maps tang member fields including gioiTyKheo.ngayGh', () => {
    const rows = membersToExcelRows(
      [
        member({
          id: 'm1',
          sanghaType: 'tang',
          theDanh: 'Nguyen Van A',
          phapDanh: 'Thich A',
          ngaySinh: '1990-05-01',
          cccd: '001122334455',
          cccdMeta: { ngayCap: '2015-01-02', noiCap: 'Ha Noi' },
          gioiTyKheo: { ngayGh: '2018-06-15' },
          gioiTyKheoNi: { ngayGh: '2099-01-01' },
          hienTuHoc: 'Tinh xa X',
        }),
      ],
      'tang',
    )

    expect(rows[1]).toEqual([
      1,
      'Nguyen Van A',
      'Thich A',
      '1990-05-01',
      '001122334455',
      '2015-01-02',
      'Ha Noi',
      '2018-06-15',
      'Tinh xa X',
    ])
  })

  it('maps ni member fields using gioiTyKheoNi.ngayGh', () => {
    const rows = membersToExcelRows(
      [
        member({
          id: 'm2',
          sanghaType: 'ni',
          theDanh: 'Tran Thi B',
          phapDanh: 'Thich Nu B',
          gioiTyKheo: { ngayGh: '2010-01-01' },
          gioiTyKheoNi: { ngayGh: '2020-08-20' },
        }),
      ],
      'ni',
    )

    expect(rows[1]?.[7]).toBe('2020-08-20')
  })

  it('uses empty strings for missing optional fields and sequential STT', () => {
    const rows = membersToExcelRows(
      [
        member({ id: 'm1', sanghaType: 'tang', cccd: '111' }),
        member({ id: 'm2', sanghaType: 'tang', cccd: '222', theDanh: 'Only name' }),
      ],
      'tang',
    )

    expect(rows[1]).toEqual([1, '', '', '', '111', '', '', '', ''])
    expect(rows[2]).toEqual([2, 'Only name', '', '', '222', '', '', '', ''])
  })
})

describe('buildMembersExcelFilename', () => {
  it('uses sangha type and local date', () => {
    expect(buildMembersExcelFilename('tang', new Date(2026, 7, 2))).toBe(
      'tang-members-2026-08-02.xlsx',
    )
    expect(buildMembersExcelFilename('ni', new Date(2026, 0, 9))).toBe(
      'ni-members-2026-01-09.xlsx',
    )
  })
})
