import { DomainError } from '#/domain/errors'
import type { AuditActor } from '#/domain/auditLog'
import { normalizeCccd } from '#/domain/normalize'
import { memberRepo, type MemberStore } from '#/repositories/memberRepo'

export type DeleteMemberPhotoInput = {
  memberId: string
  cccd: string
  /** Staff only: a filler cannot remove the photo of a locked member. */
  idToken?: string
  audit: AuditActor
}

export async function deleteMemberPhoto(
  input: DeleteMemberPhotoInput,
  memberStore: MemberStore = memberRepo,
): Promise<void> {
  const cccd = normalizeCccd(input.cccd)
  const member = await memberStore.getById(input.memberId)

  if (!member) {
    throw new DomainError('NOT_FOUND', 'Member not found')
  }

  if (member.cccd !== cccd) {
    throw new DomainError('FORBIDDEN', 'CCCD does not match member')
  }

  if (member.status === 'locked' && !input.idToken) {
    throw new DomainError('RECORD_LOCKED', 'Member is locked')
  }

  // The data API deletes the photo it drops.
  await memberStore.setPhotoPath(input.memberId, null, input.audit)
}
