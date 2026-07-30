import { DomainError } from './errors'
import type { QuyenDangKy, Retreat, RetreatExtraField } from './retreat'

export type RegistrationStatus = 'pending' | 'approved' | 'rejected'

export type RegisteredVia = 'self' | 'proxy'

export type RetreatRegistration = {
  id: string
  retreatId: string
  memberId: string
  orgUnitId: string
  registeredVia: RegisteredVia
  registeredBy: string | null
  extraAnswers: Record<string, string>
  status: RegistrationStatus
  approvedBy: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
}

export function retreatRegistrationId(retreatId: string, memberId: string): string {
  return `${retreatId}_${memberId}`
}

export function assertRegistrationOpen(
  retreat: Pick<Retreat, 'status' | 'dangKyMoTu' | 'dangKyDongLuc'>,
  nowIso: string,
): void {
  if (retreat.status !== 'open') {
    throw new DomainError('INVALID_STATUS', 'Registration is not open')
  }
  if (nowIso < retreat.dangKyMoTu || nowIso > retreat.dangKyDongLuc) {
    throw new DomainError('INVALID_INPUT', 'Registration is outside the allowed window')
  }
}

export function assertQuyenAllows(quyen: QuyenDangKy, via: RegisteredVia): void {
  if (via === 'self' && quyen === 'proxy_only') {
    throw new DomainError('INVALID_INPUT', 'Self registration is not allowed')
  }
  if (via === 'proxy' && quyen === 'tu_dang_ky') {
    throw new DomainError('INVALID_INPUT', 'Proxy registration is not allowed')
  }
}

export function validateExtraAnswers(
  extraFields: RetreatExtraField[],
  answers: Record<string, string>,
): void {
  for (const field of extraFields) {
    if (field.required && !answers[field.key]?.trim()) {
      throw new DomainError('INVALID_INPUT', `Missing required answer: ${field.key}`)
    }
  }
}

export function assertMemberOrgMatches(
  memberOrgUnitId: string,
  retreatOrgUnitId: string,
): void {
  if (memberOrgUnitId !== retreatOrgUnitId) {
    throw new DomainError('FORBIDDEN', 'Member org unit does not match retreat org unit')
  }
}
