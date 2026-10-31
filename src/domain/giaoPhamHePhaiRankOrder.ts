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

/** Giáo phẩm hệ phái ranks per sangha, highest first (same values as the form options). */
export const GIAO_PHAM_HE_PHAI_RANKS: Record<SanghaType, readonly string[]> = {
  tang: TANG_RANK_ORDER,
  ni: NI_RANK_ORDER,
}

export function giaoPhamHePhaiRankOrder(
  rank: string | undefined,
  sanghaType: SanghaType,
): number {
  if (!rank) return MISSING_GIAO_PHAM_HE_PHAI_RANK_ORDER
  const order = sanghaType === 'tang' ? TANG_RANK_ORDER : NI_RANK_ORDER
  const index = (order as readonly string[]).indexOf(rank)
  return index >= 0 ? index : MISSING_GIAO_PHAM_HE_PHAI_RANK_ORDER
}
