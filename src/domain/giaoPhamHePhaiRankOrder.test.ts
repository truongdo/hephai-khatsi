import { describe, expect, it } from 'vitest'
import { NI_RANKS, TANG_RANKS } from '#/components/filler/fillerFormOptions'
import {
  GIAO_PHAM_HE_PHAI_RANKS,
  MISSING_GIAO_PHAM_HE_PHAI_RANK_ORDER,
  giaoPhamHePhaiRankOrder,
} from './giaoPhamHePhaiRankOrder'

describe('GIAO_PHAM_HE_PHAI_RANKS', () => {
  // The Worker's stats use this list; the dashboards label the form options.
  it('matches the form options', () => {
    expect(GIAO_PHAM_HE_PHAI_RANKS.tang).toEqual(TANG_RANKS.map((option) => option.value))
    expect(GIAO_PHAM_HE_PHAI_RANKS.ni).toEqual(NI_RANKS.map((option) => option.value))
  })
})

describe('giaoPhamHePhaiRankOrder', () => {
  it('orders tang ranks by hierarchy', () => {
    expect(giaoPhamHePhaiRankOrder('hoa_thuong', 'tang')).toBe(0)
    expect(giaoPhamHePhaiRankOrder('thuong_toa', 'tang')).toBe(1)
    expect(giaoPhamHePhaiRankOrder('dai_duc', 'tang')).toBe(2)
    expect(giaoPhamHePhaiRankOrder('ty_kheo', 'tang')).toBe(3)
    expect(giaoPhamHePhaiRankOrder('sa_di', 'tang')).toBe(4)
    expect(giaoPhamHePhaiRankOrder('tap_su', 'tang')).toBe(5)
  })

  it('orders ni ranks by hierarchy', () => {
    expect(giaoPhamHePhaiRankOrder('ni_truong', 'ni')).toBe(0)
    expect(giaoPhamHePhaiRankOrder('ni_su', 'ni')).toBe(1)
    expect(giaoPhamHePhaiRankOrder('ty_kheo_ni', 'ni')).toBe(2)
    expect(giaoPhamHePhaiRankOrder('thuc_xoa_ma_na', 'ni')).toBe(3)
    expect(giaoPhamHePhaiRankOrder('sa_di_ni', 'ni')).toBe(4)
    expect(giaoPhamHePhaiRankOrder('tap_su', 'ni')).toBe(5)
  })

  it('uses sentinel for missing or unknown rank', () => {
    expect(giaoPhamHePhaiRankOrder(undefined, 'tang')).toBe(
      MISSING_GIAO_PHAM_HE_PHAI_RANK_ORDER,
    )
    expect(giaoPhamHePhaiRankOrder('not_a_rank', 'tang')).toBe(
      MISSING_GIAO_PHAM_HE_PHAI_RANK_ORDER,
    )
  })
})
