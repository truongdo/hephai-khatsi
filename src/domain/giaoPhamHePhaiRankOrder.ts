import type { SanghaType } from './types'

/** Missing rank sorts last when ascending. */
export const MISSING_GIAO_PHAM_HE_PHAI_RANK_ORDER = 999

const TANG_RANK_ORDER = [
  'hoa_thuong',
  'thuong_toa',
  'dai_duc',
  'ty_kheo',
  'sa_di',
  'tap_su',
] as const

const NI_RANK_ORDER = [
  'ni_truong',
  'ni_su',
  'ty_kheo_ni',
  'thuc_xoa_ma_na',
  'sa_di_ni',
  'tap_su',
] as const

export function giaoPhamHePhaiRankOrder(
  rank: string | undefined,
  sanghaType: SanghaType,
): number {
  if (!rank) return MISSING_GIAO_PHAM_HE_PHAI_RANK_ORDER
  const order = sanghaType === 'tang' ? TANG_RANK_ORDER : NI_RANK_ORDER
  const index = order.indexOf(rank as (typeof order)[number])
  return index >= 0 ? index : MISSING_GIAO_PHAM_HE_PHAI_RANK_ORDER
}
