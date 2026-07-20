import { normalizeVnPhone } from '#/domain/normalize'
import type { Member, SanghaType } from '#/domain/types'
import { inviteRepo, type InviteStore } from '#/repositories/inviteRepo'
import { memberRepo, type MemberStore } from '#/repositories/memberRepo'
import { getInviteByToken } from './getInviteByToken'

export type ResumeMemberByPhoneInput = {
  token: string
  orgUnitId: string
  sanghaType: SanghaType
  phone: string
}

export async function resumeMemberByPhone(
  input: ResumeMemberByPhoneInput,
  memberStore: MemberStore = memberRepo,
  inviteStore: InviteStore = inviteRepo,
): Promise<{ members: Array<{ member: Member; access: 'edit' | 'view' }> }> {
  const phone = normalizeVnPhone(input.phone)
  await getInviteByToken(input.token, inviteStore)
  const members = await memberStore.listByOrgSanghaAndPhone({
    orgUnitId: input.orgUnitId,
    sanghaType: input.sanghaType,
    phone,
  })

  return {
    members: members.map((member) => ({
      member,
      access: member.status === 'locked' ? ('view' as const) : ('edit' as const),
    })),
  }
}
