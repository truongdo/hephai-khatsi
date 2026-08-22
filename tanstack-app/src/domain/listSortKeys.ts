import type { AddressValue } from './address'
import { isStructuredAddress } from './address'
import { giaoPhamHePhaiRankOrder } from './giaoPhamHePhaiRankOrder'
import type { SanghaType } from './types'

export function listCityNameFromDiaChiMoi(
  diaChiMoi: AddressValue | string | undefined,
): string {
  if (!isStructuredAddress(diaChiMoi)) return ''
  return diaChiMoi.cityName ?? ''
}

export function buildTempleListSortKeys(input: {
  diaChiMoi?: AddressValue | string
  orgUnitName: string
}): { listCityName: string; orgUnitName: string } {
  return {
    listCityName: listCityNameFromDiaChiMoi(input.diaChiMoi),
    orgUnitName: input.orgUnitName,
  }
}

export function buildMemberListSortKeys(input: {
  sanghaType: SanghaType
  orgUnitName: string
  giaoPhamHePhaiRank?: string
}): {
  orgUnitName: string
  giaoPhamHePhaiRankOrder: number
} {
  return {
    orgUnitName: input.orgUnitName,
    giaoPhamHePhaiRankOrder: giaoPhamHePhaiRankOrder(
      input.giaoPhamHePhaiRank,
      input.sanghaType,
    ),
  }
}
