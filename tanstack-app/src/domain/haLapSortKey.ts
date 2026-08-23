import type { Member, SanghaType } from './types'

/** Normalizes hệ-phái rank for hạ-lạp sort key (ty_kheo / sa_di or ty_kheo_ni / sa_di_ni). */
export function normalizeHaLapHePhaiRank(
  rank: string | undefined,
  sanghaType: SanghaType,
): string {
  if (!rank) return ''
  if (sanghaType === 'tang') {
    if (
      rank === 'hoa_thuong' ||
      rank === 'thuong_toa' ||
      rank === 'dai_duc' ||
      rank === 'ty_kheo'
    ) {
      return 'ty_kheo'
    }
    if (rank === 'sa_di' || rank === 'tap_su') {
      return 'sa_di'
    }
    return rank
  }
  if (rank === 'ni_truong' || rank === 'ni_su' || rank === 'ty_kheo_ni') {
    return 'ty_kheo_ni'
  }
  if (rank === 'tap_su') {
    return 'sa_di_ni'
  }
  return rank
}

function preceptHePhaiDate(value: { ngayHePhai?: string } | undefined): string {
  return value?.ngayHePhai?.trim() ?? ''
}

function tyKheoOrdinationDate(
  sanghaType: SanghaType,
  ngayHaCapHaLap: string | undefined,
  gioiTyKheo: Member['gioiTyKheo'],
  gioiTyKheoNi: Member['gioiTyKheoNi'],
): string {
  const demoted = ngayHaCapHaLap?.trim()
  if (demoted) return demoted
  const precept = sanghaType === 'tang' ? gioiTyKheo : gioiTyKheoNi
  return preceptHePhaiDate(precept)
}

export function buildMemberHaLapSortKey(input: {
  sanghaType: SanghaType
  giaoPhamHePhaiRank?: string
  ngayHaCapHaLap?: string
  gioiTyKheo?: Member['gioiTyKheo']
  gioiTyKheoNi?: Member['gioiTyKheoNi']
  gioiSaDi?: Member['gioiSaDi']
  gioiThucXoaMaNa?: Member['gioiThucXoaMaNa']
  gioiSaDiNi?: Member['gioiSaDiNi']
  ngayXuatGia?: string
}): string {
  const rank = normalizeHaLapHePhaiRank(input.giaoPhamHePhaiRank, input.sanghaType)
  const tyKheoDate = tyKheoOrdinationDate(
    input.sanghaType,
    input.ngayHaCapHaLap,
    input.gioiTyKheo,
    input.gioiTyKheoNi,
  )
  const ngayXuatGia = input.ngayXuatGia?.trim() ?? ''

  if (input.sanghaType === 'tang') {
    const saDiDate = preceptHePhaiDate(input.gioiSaDi)
    return [rank, tyKheoDate, saDiDate, ngayXuatGia].join(':')
  }

  const xoaMaNaDate = preceptHePhaiDate(input.gioiThucXoaMaNa)
  const saDiNiDate = preceptHePhaiDate(input.gioiSaDiNi)
  return [rank, tyKheoDate, xoaMaNaDate, saDiNiDate, ngayXuatGia].join(':')
}

export function memberHaLapHePhaiRank(
  member: Pick<Member, 'sapXepHaLap' | 'giaoPhamHePhai' | 'sanghaType'>,
): string {
  const fromKey = member.sapXepHaLap?.split(':')[0]?.trim()
  if (fromKey) return fromKey
  return normalizeHaLapHePhaiRank(member.giaoPhamHePhai?.rank, member.sanghaType)
}

/** Stored on member docs for admin hạ-lạp tab queries. */
export const EMPTY_HA_LAP_TAB_RANK = '__empty__'

export function memberHaLapTabRank(
  member: Pick<Member, 'sapXepHaLap' | 'giaoPhamHePhai' | 'sanghaType'>,
): string {
  const rawRank = memberHaLapHePhaiRank(member)
  const normalized = normalizeHaLapHePhaiRank(rawRank, member.sanghaType)
  return normalized || EMPTY_HA_LAP_TAB_RANK
}

export function memberHaLapSortKeyForExport(
  member: Pick<
    Member,
    | 'sapXepHaLap'
    | 'sanghaType'
    | 'giaoPhamHePhai'
    | 'ngayHaCapHaLap'
    | 'gioiTyKheo'
    | 'gioiTyKheoNi'
    | 'gioiSaDi'
    | 'gioiThucXoaMaNa'
    | 'gioiSaDiNi'
    | 'ngayXuatGia'
  >,
): string {
  const stored = member.sapXepHaLap?.trim()
  if (stored) return stored
  return buildMemberHaLapSortKeyFromMember(member)
}

export function compareMembersByHaLapSortKey(a: Member, b: Member): number {
  return memberHaLapSortKeyForExport(a).localeCompare(memberHaLapSortKeyForExport(b))
}

export function sortMembersByHaLapSortKey(members: Member[]): Member[] {
  return [...members].sort(compareMembersByHaLapSortKey)
}

export function buildMemberHaLapSortKeyFromMember(
  member: Pick<
    Member,
    | 'sanghaType'
    | 'giaoPhamHePhai'
    | 'ngayHaCapHaLap'
    | 'gioiTyKheo'
    | 'gioiTyKheoNi'
    | 'gioiSaDi'
    | 'gioiThucXoaMaNa'
    | 'gioiSaDiNi'
    | 'ngayXuatGia'
  >,
): string {
  return buildMemberHaLapSortKey({
    sanghaType: member.sanghaType,
    giaoPhamHePhaiRank: member.giaoPhamHePhai?.rank,
    ngayHaCapHaLap: member.ngayHaCapHaLap,
    gioiTyKheo: member.gioiTyKheo,
    gioiTyKheoNi: member.gioiTyKheoNi,
    gioiSaDi: member.gioiSaDi,
    gioiThucXoaMaNa: member.gioiThucXoaMaNa,
    gioiSaDiNi: member.gioiSaDiNi,
    ngayXuatGia: member.ngayXuatGia,
  })
}
