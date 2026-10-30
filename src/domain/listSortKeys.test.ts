import { describe, expect, it } from 'vitest'
import { MISSING_GIAO_PHAM_HE_PHAI_RANK_ORDER } from './giaoPhamHePhaiRankOrder'
import {
  buildMemberListSortKeys,
  buildTempleListSortKeys,
  listCityNameFromDiaChiMoi,
} from './listSortKeys'

describe('listCityNameFromDiaChiMoi', () => {
  it('reads cityName from structured address', () => {
    expect(
      listCityNameFromDiaChiMoi({
        cityCode: '01',
        cityName: 'Hà Nội',
        wardCode: '00001',
        wardName: 'Phường A',
      }),
    ).toBe('Hà Nội')
  })

  it('returns empty string for legacy string or missing', () => {
    expect(listCityNameFromDiaChiMoi('123 đường')).toBe('')
    expect(listCityNameFromDiaChiMoi(undefined)).toBe('')
  })
})

describe('buildTempleListSortKeys', () => {
  it('includes orgUnitName and city', () => {
    expect(
      buildTempleListSortKeys({
        orgUnitName: 'Giáo đoàn I',
        diaChiMoi: {
          cityCode: '01',
          cityName: 'Đà Nẵng',
          wardCode: 'x',
          wardName: 'y',
        },
      }),
    ).toEqual({ listCityName: 'Đà Nẵng', orgUnitName: 'Giáo đoàn I' })
  })
})

describe('buildMemberListSortKeys', () => {
  it('maps rank to hierarchy order', () => {
    expect(
      buildMemberListSortKeys({
        sanghaType: 'tang',
        orgUnitName: 'Giáo đoàn II',
        giaoPhamHePhaiRank: 'dai_duc',
      }),
    ).toEqual({
      orgUnitName: 'Giáo đoàn II',
      giaoPhamHePhaiRankOrder: 2,
    })
  })

  it('uses sentinel when rank missing', () => {
    expect(
      buildMemberListSortKeys({
        sanghaType: 'ni',
        orgUnitName: 'Ni giới Giáo đoàn I',
      }).giaoPhamHePhaiRankOrder,
    ).toBe(MISSING_GIAO_PHAM_HE_PHAI_RANK_ORDER)
  })
})
