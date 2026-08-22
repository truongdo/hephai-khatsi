import { describe, expect, it } from 'vitest'
import {
  buildMemberHaLapSortKey,
  memberHaLapHePhaiRank,
  normalizeHaLapHePhaiRank,
} from './haLapSortKey'

describe('normalizeHaLapHePhaiRank', () => {
  it('maps tang senior ranks to ty_kheo and tap_su to sa_di', () => {
    expect(normalizeHaLapHePhaiRank('hoa_thuong', 'tang')).toBe('ty_kheo')
    expect(normalizeHaLapHePhaiRank('thuong_toa', 'tang')).toBe('ty_kheo')
    expect(normalizeHaLapHePhaiRank('dai_duc', 'tang')).toBe('ty_kheo')
    expect(normalizeHaLapHePhaiRank('ty_kheo', 'tang')).toBe('ty_kheo')
    expect(normalizeHaLapHePhaiRank('sa_di', 'tang')).toBe('sa_di')
    expect(normalizeHaLapHePhaiRank('tap_su', 'tang')).toBe('sa_di')
  })

  it('maps ni senior ranks to ty_kheo_ni and tap_su to sa_di_ni', () => {
    expect(normalizeHaLapHePhaiRank('ni_truong', 'ni')).toBe('ty_kheo_ni')
    expect(normalizeHaLapHePhaiRank('ni_su', 'ni')).toBe('ty_kheo_ni')
    expect(normalizeHaLapHePhaiRank('ty_kheo_ni', 'ni')).toBe('ty_kheo_ni')
    expect(normalizeHaLapHePhaiRank('thuc_xoa_ma_na', 'ni')).toBe('thuc_xoa_ma_na')
    expect(normalizeHaLapHePhaiRank('sa_di_ni', 'ni')).toBe('sa_di_ni')
    expect(normalizeHaLapHePhaiRank('tap_su', 'ni')).toBe('sa_di_ni')
  })
})

describe('buildMemberHaLapSortKey', () => {
  it('builds tang key from he-phai rank and precept ngayHePhai dates', () => {
    expect(
      buildMemberHaLapSortKey({
        sanghaType: 'tang',
        giaoPhamHePhaiRank: 'hoa_thuong',
        gioiTyKheo: { ngayHePhai: '2010-05-01' },
        gioiSaDi: { ngayHePhai: '2008-03-15' },
        ngayXuatGia: '2005-06-01',
      }),
    ).toBe('ty_kheo:2010-05-01:2008-03-15:2005-06-01')
  })

  it('uses ngayHaCapHaLap instead of ty kheo precept date when set', () => {
    expect(
      buildMemberHaLapSortKey({
        sanghaType: 'tang',
        giaoPhamHePhaiRank: 'ty_kheo',
        ngayHaCapHaLap: '2018-06-15',
        gioiTyKheo: { ngayHePhai: '2010-05-01' },
        gioiSaDi: { ngayHePhai: '2008-03-15' },
        ngayXuatGia: '2005-06-01',
      }),
    ).toBe('ty_kheo:2018-06-15:2008-03-15:2005-06-01')
  })

  it('builds ni key with four ordination dates plus xuat gia', () => {
    expect(
      buildMemberHaLapSortKey({
        sanghaType: 'ni',
        giaoPhamHePhaiRank: 'ni_su',
        gioiTyKheoNi: { ngayHePhai: '2012-01-10' },
        gioiThucXoaMaNa: { ngayHePhai: '2011-04-20' },
        gioiSaDiNi: { ngayHePhai: '2010-02-05' },
        ngayXuatGia: '2009-08-01',
      }),
    ).toBe('ty_kheo_ni:2012-01-10:2011-04-20:2010-02-05:2009-08-01')
  })

  it('leaves empty segments when dates are missing', () => {
    expect(
      buildMemberHaLapSortKey({
        sanghaType: 'tang',
        giaoPhamHePhaiRank: 'tap_su',
      }),
    ).toBe('sa_di:::')
  })
})

describe('memberHaLapHePhaiRank', () => {
  it('reads the first sapXepHaLap segment when present', () => {
    expect(
      memberHaLapHePhaiRank({
        sanghaType: 'tang',
        sapXepHaLap: 'ty_kheo:2010-01-01::',
        giaoPhamHePhai: { rank: 'hoa_thuong' },
      }),
    ).toBe('ty_kheo')
  })

  it('falls back to normalized he-phai rank when sapXepHaLap is missing', () => {
    expect(
      memberHaLapHePhaiRank({
        sanghaType: 'ni',
        giaoPhamHePhai: { rank: 'tap_su' },
      }),
    ).toBe('sa_di_ni')
  })
})
