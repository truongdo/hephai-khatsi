import { DomainError } from '#/domain/errors'
import { normalizeCccd } from '#/domain/normalize'
import type { Member, SanghaType } from '#/domain/types'
import { inviteRepo, type InviteStore } from '#/repositories/inviteRepo'
import { memberRepo, type MemberStore } from '#/repositories/memberRepo'
import { getInviteByToken } from './getInviteByToken'

export type ResumeMemberByCccdInput = {
  token: string
  orgUnitId: string
  sanghaType: SanghaType
  cccd: string
}

export async function resumeMemberByCccd(
  input: ResumeMemberByCccdInput,
  memberStore: MemberStore = memberRepo,
  inviteStore: InviteStore = inviteRepo,
): Promise<{ member: Member; access: 'edit' | 'view' }> {
  const cccd = normalizeCccd(input.cccd)
  await getInviteByToken(input.token, inviteStore)
  const member = await memberStore.getByCccd({
    orgUnitId: input.orgUnitId,
    sanghaType: input.sanghaType,
    cccd,
  })

  if (!member) {
    throw new DomainError('NOT_FOUND', 'Member not found')
  }

  return {
    member,
    access: member.status === 'locked' ? 'view' : 'edit',
  }
}
