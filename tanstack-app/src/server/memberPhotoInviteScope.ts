import { DomainError } from '#/domain/errors'
import type { Invite, Member } from '#/domain/types'
import { sanghaTypeFromMemberInvite } from '#/use-cases/saveMemberDraft'

export function assertMemberPhotoInviteScope(
  invite: Invite,
  member: Member,
): void {
  const sanghaType = sanghaTypeFromMemberInvite(invite.formType)

  if (member.orgUnitId !== invite.orgUnitId) {
    throw new DomainError(
      'FORBIDDEN',
      'Member does not belong to invite org unit',
    )
  }

  if (member.sanghaType !== sanghaType) {
    throw new DomainError(
      'FORBIDDEN',
      'Member sangha type does not match invite',
    )
  }
}
