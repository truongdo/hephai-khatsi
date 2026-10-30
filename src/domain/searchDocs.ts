import type { Member, Temple } from '#/domain/types'
import { normalizeVnPhone } from '#/domain/normalize'

export const TYPESENSE_MEMBERS_COLLECTION = 'khatsi_members'
export const TYPESENSE_TEMPLES_COLLECTION = 'khatsi_temples'

export type MemberSearchDoc = {
  id: string
  orgUnitId: string
  sanghaType: string
  status: string
  phapDanh: string
  theDanh: string
  cccd: string
  dienThoai: string
  updatedAt: number
}

export type TempleSearchDoc = {
  id: string
  orgUnitId: string
  status: string
  danhHieu: string
  truTriPhapDanh: string
  phones: string[]
  updatedAt: number
}

export function searchPhoneDigits(raw: string | undefined): string {
  if (!raw?.trim()) return ''
  try {
    return normalizeVnPhone(raw)
  } catch {
    return ''
  }
}

export function toUpdatedAtMs(iso: string): number {
  const n = Date.parse(iso)
  return Number.isFinite(n) ? n : 0
}

export function toMemberSearchDoc(member: Member): MemberSearchDoc {
  return {
    id: member.id,
    orgUnitId: member.orgUnitId,
    sanghaType: member.sanghaType,
    status: member.status,
    phapDanh: member.phapDanh ?? '',
    theDanh: member.theDanh ?? '',
    cccd: member.cccd ?? '',
    dienThoai: searchPhoneDigits(member.dienThoai),
    updatedAt: toUpdatedAtMs(member.updatedAt),
  }
}

export function toTempleSearchDoc(temple: Temple): TempleSearchDoc {
  const phones = new Set<string>()
  for (const p of temple.managerPhones ?? []) {
    const d = searchPhoneDigits(p)
    if (d) phones.add(d)
  }
  const truTriPhone = searchPhoneDigits(temple.truTriHienNay?.dienThoai)
  if (truTriPhone) phones.add(truTriPhone)
  return {
    id: temple.id,
    orgUnitId: temple.orgUnitId,
    status: temple.status,
    danhHieu: temple.danhHieu ?? '',
    truTriPhapDanh: temple.truTriHienNay?.phapDanh ?? '',
    phones: [...phones],
    updatedAt: toUpdatedAtMs(temple.updatedAt),
  }
}
