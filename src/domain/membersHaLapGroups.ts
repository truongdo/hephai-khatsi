import { rankLabel } from '#/components/filler/fillerFormOptions'
import {
  EMPTY_HA_LAP_TAB_RANK,
  memberHaLapHePhaiRank,
  sortMembersByHaLapSortKey,
} from '#/domain/haLapSortKey'
import type { Member, SanghaType } from '#/domain/types'
import { m } from '#/paraglide/messages'

export const EMPTY_HA_LAP_HE_PHAI_RANK = EMPTY_HA_LAP_TAB_RANK

const TANG_EXCEL_SHEET_RANK_ORDER = ['ty_kheo', 'sa_di'] as const
const NI_EXCEL_SHEET_RANK_ORDER = [
  'ty_kheo_ni',
  'thuc_xoa_ma_na',
  'sa_di_ni',
  'sa_di',
] as const

export function groupMembersByHaLapHePhaiRank(
  members: Member[],
): Map<string, Member[]> {
  const groups = new Map<string, Member[]>()
  for (const member of members) {
    const rank = memberHaLapHePhaiRank(member) || EMPTY_HA_LAP_HE_PHAI_RANK
    const list = groups.get(rank) ?? []
    list.push(member)
    groups.set(rank, list)
  }
  return groups
}

export function orderedMembersHaLapGroups(
  members: Member[],
  sanghaType: SanghaType,
): Array<{ rankKey: string; members: Member[] }> {
  const groups = groupMembersByHaLapHePhaiRank(members)
  const canonicalOrder =
    sanghaType === 'tang' ? TANG_EXCEL_SHEET_RANK_ORDER : NI_EXCEL_SHEET_RANK_ORDER
  const result: Array<{ rankKey: string; members: Member[] }> = []
  const seen = new Set<string>()

  for (const rank of canonicalOrder) {
    const groupMembers = groups.get(rank)
    if (!groupMembers?.length) continue
    result.push({ rankKey: rank, members: sortMembersByHaLapSortKey(groupMembers) })
    seen.add(rank)
  }

  const otherRanks = [...groups.keys()]
    .filter(
      (rank) =>
        rank !== EMPTY_HA_LAP_HE_PHAI_RANK && !seen.has(rank) && groups.get(rank)?.length,
    )
    .sort((a, b) => a.localeCompare(b, 'vi'))

  for (const rank of otherRanks) {
    result.push({
      rankKey: rank,
      members: sortMembersByHaLapSortKey(groups.get(rank)!),
    })
  }

  const emptyMembers = groups.get(EMPTY_HA_LAP_HE_PHAI_RANK)
  if (emptyMembers?.length) {
    result.push({
      rankKey: EMPTY_HA_LAP_HE_PHAI_RANK,
      members: sortMembersByHaLapSortKey(emptyMembers),
    })
  }

  return result
}

export function canonicalHaLapTabRankKeys(sanghaType: SanghaType): string[] {
  const order =
    sanghaType === 'tang' ? TANG_EXCEL_SHEET_RANK_ORDER : NI_EXCEL_SHEET_RANK_ORDER
  return [...order, EMPTY_HA_LAP_HE_PHAI_RANK]
}

export function sanitizeExcelSheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, '-').slice(0, 31)
}

export function excelSheetNameForHaLapHePhaiRank(
  rankKey: string,
  sanghaType: SanghaType,
): string {
  if (rankKey === EMPTY_HA_LAP_HE_PHAI_RANK) {
    return m.admin_members_export_sheet_empty_rank()
  }
  return rankLabel(rankKey, sanghaType) ?? rankKey
}

export function haLapTabLabel(
  rankKey: string,
  sanghaType: SanghaType,
  loadedCount: number,
  totalCount?: number,
): string {
  const name = excelSheetNameForHaLapHePhaiRank(rankKey, sanghaType)
  if (totalCount == null) {
    return `${name} (${loadedCount})`
  }
  if (loadedCount < totalCount) {
    return `${name} (${loadedCount}/${totalCount})`
  }
  return `${name} (${totalCount})`
}
