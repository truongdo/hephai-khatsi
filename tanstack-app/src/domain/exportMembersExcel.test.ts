import { describe, expect, it } from 'vitest'
import type { Member } from '#/domain/types'
import {
  catalogMembersExcelColumns,
  defaultMembersExcelColumnIds,
  membersExcelExportColumns,
} from '#/domain/memberExcelColumns'
import {
  buildMembersExcelFilename,
  membersToExcelRows,
} from '#/domain/exportMembersExcel'

const emptyCtx = { orgUnitNameById: {} }

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
  it('puts STT first then selected headers in catalog order', () => {
    const rows = membersToExcelRows([], 'tang', ['hienTuHoc', 'theDanh'], emptyCtx)
    const cols = membersExcelExportColumns('tang', ['hienTuHoc', 'theDanh'])
    const theDanh = cols.find((c) => c.id === 'theDanh')!
    const hien = cols.find((c) => c.id === 'hienTuHoc')!
    const sapXepHaLap = cols.find((c) => c.id === 'sapXepHaLap')!
    expect(rows[0]).toEqual([
      'STT',
      theDanh.header(),
      hien.header(),
      sapXepHaLap.header(),
    ])
  })

  it('maps default tang columns including gioiTyKheo_ngayGh', () => {
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
      defaultMembersExcelColumnIds('tang'),
      emptyCtx,
    )
    expect(rows[1]).toEqual([
      1,
      'Nguyen Van A',
      'Thich A',
      '1990-05-01',
      '001122334455',
      '2015-01-02',
      'Ha Noi',
      'Tinh xa X',
      '2018-06-15',
      '',
    ])
  })

  it('always appends sapXepHaLap as the last export column', () => {
    const rows = membersToExcelRows(
      [
        member({
          id: 'm1',
          sanghaType: 'tang',
          sapXepHaLap: 'ty_kheo:2010-01-01:2009-01-01:2008-01-01',
        }),
      ],
      'tang',
      ['theDanh'],
      emptyCtx,
    )
    expect(rows[0]?.at(-1)).toBe(
      membersExcelExportColumns('tang', ['theDanh']).at(-1)!.header(),
    )
    expect(rows[1]).toEqual([1, '', 'ty_kheo:2010-01-01:2009-01-01:2008-01-01'])
  })

  it('maps ni default precept column from gioiTyKheoNi', () => {
    const rows = membersToExcelRows(
      [
        member({
          id: 'm2',
          sanghaType: 'ni',
          gioiTyKheo: { ngayGh: '2010-01-01' },
          gioiTyKheoNi: { ngayGh: '2020-08-20' },
        }),
      ],
      'ni',
      defaultMembersExcelColumnIds('ni'),
      emptyCtx,
    )
    expect(rows[1]?.[8]).toBe('2020-08-20')
  })

  it('ignores unknown ids and sequential STT', () => {
    const rows = membersToExcelRows(
      [
        member({ id: 'm1', sanghaType: 'tang', cccd: '111' }),
        member({ id: 'm2', sanghaType: 'tang', cccd: '222', theDanh: 'Only name' }),
      ],
      'tang',
      ['nope', 'theDanh', 'cccd'],
      emptyCtx,
    )
    expect(rows[1]).toEqual([1, '', '111', ''])
    expect(rows[2]).toEqual([2, 'Only name', '222', ''])
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
