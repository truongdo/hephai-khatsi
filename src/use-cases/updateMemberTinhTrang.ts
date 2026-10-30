import { canAccessOrgUnit, type AuthClaims } from '#/domain/authClaims'
import type { AuditActor } from '#/domain/auditLog'
import { DomainError } from '#/domain/errors'
import {
  isTinhTrangValue,
  type TinhTrangValue,
} from '#/domain/tinhTrang'
import type { Member } from '#/domain/types'
import { memberRepo, type MemberStore } from '#/repositories/memberRepo'

export type UpdateMemberTinhTrangInput = {
  memberId: string
  tinhTrang: TinhTrangValue
}

export async function updateMemberTinhTrang(
  input: UpdateMemberTinhTrangInput,
  audit: AuditActor,
  claims: AuthClaims,
  memberStore: MemberStore = memberRepo,
): Promise<Member> {
  if (!isTinhTrangValue(input.tinhTrang)) {
    throw new DomainError('INVALID_INPUT', 'Invalid tinhTrang')
  }

  const existing = await memberStore.getById(input.memberId)
  if (!existing) {
    throw new DomainError('NOT_FOUND', 'Member not found')
  }
  if (!canAccessOrgUnit(claims, existing.orgUnitId)) {
    throw new DomainError('FORBIDDEN', 'Org unit out of scope')
  }

  return memberStore.updateDraftById(
    input.memberId,
    { tinhTrang: input.tinhTrang },
    { allowWhenLocked: true, audit },
  )
}
