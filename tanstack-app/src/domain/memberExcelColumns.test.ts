import { describe, expect, it } from 'vitest'
import type { Member } from '#/domain/types'
import { m } from '#/paraglide/messages'
import {
  allowedMembersExcelColumnIdSet,
  catalogMembersExcelColumns,
  defaultMembersExcelColumnIds,
  MEMBER_EXCEL_COLUMNS,
} from '#/domain/memberExcelColumns'

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

describe('catalogMembersExcelColumns', () => {
  it('omits ni precepts for tang and tang precepts for ni', () => {
    const tangIds = catalogMembersExcelColumns('tang').map((c) => c.id)
    const niIds = catalogMembersExcelColumns('ni').map((c) => c.id)
    expect(tangIds).toContain('gioiTyKheo_ngayGh')
    expect(tangIds).not.toContain('gioiTyKheoNi_ngayGh')
    expect(niIds).toContain('gioiTyKheoNi_ngayGh')
    expect(niIds).not.toContain('gioiTyKheo_ngayGh')
  })

  it('includes ngayHaCapHaLap in catalog for tang and ni', () => {
    expect(catalogMembersExcelColumns('tang').map((c) => c.id)).toContain(
      'ngayHaCapHaLap',
    )
    expect(catalogMembersExcelColumns('ni').map((c) => c.id)).toContain(
      'ngayHaCapHaLap',
    )
  })
})

describe('defaultMembersExcelColumnIds', () => {
  it('returns the eight legacy content columns for each sangha', () => {
    expect(defaultMembersExcelColumnIds('tang')).toEqual([
      'theDanh',
      'phapDanh',
      'ngaySinh',
      'cccd',
      'cccdNgayCap',
      'cccdNoiCap',
      'gioiTyKheo_ngayGh',
      'hienTuHoc',
    ])
    expect(defaultMembersExcelColumnIds('ni')).toEqual([
      'theDanh',
      'phapDanh',
      'ngaySinh',
      'cccd',
      'cccdNgayCap',
      'cccdNoiCap',
      'gioiTyKheoNi_ngayGh',
      'hienTuHoc',
    ])
  })

  it('defaults are a subset of the sangha catalog', () => {
    for (const sangha of ['tang', 'ni'] as const) {
      const allowed = allowedMembersExcelColumnIdSet(sangha)
      for (const id of defaultMembersExcelColumnIds(sangha)) {
        expect(allowed.has(id)).toBe(true)
      }
    }
  })
})

describe('MEMBER_EXCEL_COLUMNS cells', () => {
  const ctx = { orgUnitNameById: { 'gd-i': 'Giáo đoàn I' } }

  function cell(id: string, mem: Member): string | number {
    const col = MEMBER_EXCEL_COLUMNS.find((c) => c.id === id)
    if (!col) throw new Error(id)
    return col.cell(mem, ctx)
  }

  it('resolves org unit name, formats address, and localizes rank and status', () => {
    const mem = member({
      id: 'm1',
      sanghaType: 'tang',
      noiSinh: { line: '1 A', wardName: 'P.1', cityName: 'HCM' },
      giaoPhamHePhai: { rank: 'ty_kheo', namTienPhong: 2010 },
    })
    expect(cell('orgUnitName', mem)).toBe('Giáo đoàn I')
    expect(cell('noiSinh', mem)).toBe('1 A, P.1, HCM')
    expect(cell('giaoPhamHePhaiRank', mem)).toBe(m.filler_rank_ty_kheo())
    expect(cell('status', mem)).toBe(m.admin_members_status_draft())
  })

  it('falls back to orgUnitId when the name map has no entry', () => {
    const mem = member({ id: 'm1', sanghaType: 'tang', orgUnitId: 'missing' })
    expect(cell('orgUnitName', mem)).toBe('missing')
  })

  it('renders ngayHaCapHaLap cell', () => {
    const col = MEMBER_EXCEL_COLUMNS.find((c) => c.id === 'ngayHaCapHaLap')
    expect(col).toBeTruthy()
    expect(
      col!.cell(
        member({ id: 'm1', sanghaType: 'tang', ngayHaCapHaLap: '2018-06-15' }),
        ctx,
      ),
    ).toBe('2018-06-15')
    expect(col!.cell(member({ id: 'm2', sanghaType: 'tang' }), ctx)).toBe('')
  })
})
