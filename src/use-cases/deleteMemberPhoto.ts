import { DomainError } from '#/domain/errors'
import type { AuditActor } from '#/domain/auditLog'
import { normalizeCccd } from '#/domain/normalize'
import { deleteMemberPhotoObject } from '#/photos/photosApiClient'
import { memberRepo, type MemberStore } from '#/repositories/memberRepo'

export type DeleteMemberPhotoInput = {
  memberId: string
  cccd: string
  inviteToken?: string
  idToken?: string
  audit: AuditActor
}

export async function deleteMemberPhoto(
  input: DeleteMemberPhotoInput,
  memberStore: MemberStore = memberRepo,
  deleteObject: typeof deleteMemberPhotoObject = deleteMemberPhotoObject,
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

  await deleteObject({
    memberId: input.memberId,
    cccd,
    inviteToken: input.inviteToken,
    idToken: input.idToken,
  })
  await memberStore.setPhotoPath(input.memberId, null, input.audit)
}
