import { describe, expect, it } from 'vitest'
import type { Member } from '#/domain/types'
import { m } from '#/paraglide/messages'
import {
  EMPTY_HA_LAP_HE_PHAI_RANK,
  excelSheetNameForHaLapHePhaiRank,
  haLapTabLabel,
  orderedMembersHaLapGroups,
  sanitizeExcelSheetName,
} from '#/domain/membersHaLapGroups'

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

describe('orderedMembersHaLapGroups', () => {
  it('splits tang members by normalized he-phai rank with empty last', () => {
    const groups = orderedMembersHaLapGroups(
      [
        member({
          id: 'm1',
          sanghaType: 'tang',
          giaoPhamHePhai: { rank: 'sa_di' },
        }),
        member({
          id: 'm2',
          sanghaType: 'tang',
          giaoPhamHePhai: { rank: 'hoa_thuong' },
        }),
        member({ id: 'm3', sanghaType: 'tang' }),
      ],
      'tang',
    )

    expect(groups.map((group) => group.rankKey)).toEqual([
      'ty_kheo',
      'sa_di',
      EMPTY_HA_LAP_HE_PHAI_RANK,
    ])
    expect(groups[0]?.members.map((item) => item.id)).toEqual(['m2'])
    expect(groups[1]?.members.map((item) => item.id)).toEqual(['m1'])
    expect(groups[2]?.members.map((item) => item.id)).toEqual(['m3'])
  })

  it('orders ni sheets by canonical rank before empty', () => {
    const groups = orderedMembersHaLapGroups(
      [
        member({
          id: 'm1',
          sanghaType: 'ni',
          giaoPhamHePhai: { rank: 'sa_di_ni' },
        }),
        member({
          id: 'm2',
          sanghaType: 'ni',
          giaoPhamHePhai: { rank: 'ni_su' },
        }),
        member({
          id: 'm3',
          sanghaType: 'ni',
          giaoPhamHePhai: { rank: 'thuc_xoa_ma_na' },
        }),
        member({ id: 'm4', sanghaType: 'ni' }),
      ],
      'ni',
    )

    expect(groups.map((group) => group.rankKey)).toEqual([
      'ty_kheo_ni',
      'thuc_xoa_ma_na',
      'sa_di_ni',
      EMPTY_HA_LAP_HE_PHAI_RANK,
    ])
  })

  it('sorts members within each group by haLap sort key ascending', () => {
    const groups = orderedMembersHaLapGroups(
      [
        member({
          id: 'm1',
          sanghaType: 'tang',
          giaoPhamHePhai: { rank: 'ty_kheo' },
          sapXepHaLap: 'ty_kheo:2012-01-01:2010-01-01:2008-01-01',
        }),
        member({
          id: 'm2',
          sanghaType: 'tang',
          giaoPhamHePhai: { rank: 'ty_kheo' },
          sapXepHaLap: 'ty_kheo:2010-01-01:2009-01-01:2008-01-01',
        }),
        member({
          id: 'm3',
          sanghaType: 'tang',
          giaoPhamHePhai: { rank: 'ty_kheo' },
          gioiTyKheo: { ngayHePhai: '2011-01-01' },
        }),
      ],
      'tang',
    )

    expect(groups[0]?.members.map((item) => item.id)).toEqual(['m2', 'm3', 'm1'])
  })
})

describe('excel sheet naming', () => {
  it('uses localized rank labels and empty-rank label', () => {
    expect(excelSheetNameForHaLapHePhaiRank('ty_kheo', 'tang')).toBe(
      m.filler_rank_ty_kheo(),
    )
    expect(excelSheetNameForHaLapHePhaiRank(EMPTY_HA_LAP_HE_PHAI_RANK, 'tang')).toBe(
      m.admin_members_export_sheet_empty_rank(),
    )
  })

  it('sanitizes invalid excel sheet characters', () => {
    expect(sanitizeExcelSheetName('A/B?C*D[E]')).toBe('A-B-C-D-E-')
  })
})

describe('haLapTabLabel', () => {
  it('includes localized rank and loaded count when total is unknown', () => {
    expect(haLapTabLabel('ty_kheo', 'tang', 42)).toBe(
      `${m.filler_rank_ty_kheo()} (42)`,
    )
  })

  it('shows loaded/total when paginating', () => {
    expect(haLapTabLabel('ty_kheo', 'tang', 25, 100)).toBe(
      `${m.filler_rank_ty_kheo()} (25/100)`,
    )
  })

  it('shows total only when fully loaded', () => {
    expect(haLapTabLabel('ty_kheo', 'tang', 100, 100)).toBe(
      `${m.filler_rank_ty_kheo()} (100)`,
    )
  })
})
