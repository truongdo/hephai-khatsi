import { DomainError } from '#/domain/errors'
import { normalizeCccd } from '#/domain/normalize'
import type { Member } from '#/domain/types'
import { inviteRepo, type InviteStore } from '#/repositories/inviteRepo'
import { memberRepo, type MemberStore } from '#/repositories/memberRepo'
import { getMemberInviteContext } from './saveMemberDraft'

export type ResumeMemberByCccdInput = {
  token: string
  cccd: string
}

export async function resumeMemberByCccd(
  input: ResumeMemberByCccdInput,
  memberStore: MemberStore = memberRepo,
  inviteStore: InviteStore = inviteRepo,
): Promise<{ member: Member; access: 'edit' | 'view' }> {
  const cccd = normalizeCccd(input.cccd)
  const { invite, sanghaType } = await getMemberInviteContext(
    input.token,
    inviteStore,
  )
  const member = await memberStore.getByCccd({
    orgUnitId: invite.orgUnitId,
    sanghaType,
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
