import { normalizeVnPhone } from '#/domain/normalize'
import type { Member, SanghaType } from '#/domain/types'
import { inviteRepo, type InviteStore } from '#/repositories/inviteRepo'
import { memberRepo, type MemberStore } from '#/repositories/memberRepo'
import { getInviteByToken } from './getInviteByToken'

export type ResumeMemberByPhoneInput = {
  token: string
  orgUnitId: string
  phone: string
  /** When omitted, search both tang and ni indexes. */
  sanghaType?: SanghaType
}

export async function resumeMemberByPhone(
  input: ResumeMemberByPhoneInput,
  memberStore: MemberStore = memberRepo,
  inviteStore: InviteStore = inviteRepo,
): Promise<{ members: Array<{ member: Member; access: 'edit' | 'view' }> }> {
  const phone = normalizeVnPhone(input.phone)
  await getInviteByToken(input.token, inviteStore)

  let members: Member[]
  if (input.sanghaType) {
    members = await memberStore.listByOrgSanghaAndPhone({
      orgUnitId: input.orgUnitId,
      sanghaType: input.sanghaType,
      phone,
      inviteToken: input.token,
    })
  } else {
    const [tang, ni] = await Promise.all([
      memberStore.listByOrgSanghaAndPhone({
        orgUnitId: input.orgUnitId,
        sanghaType: 'tang',
        phone,
        inviteToken: input.token,
      }),
      memberStore.listByOrgSanghaAndPhone({
        orgUnitId: input.orgUnitId,
        sanghaType: 'ni',
        phone,
        inviteToken: input.token,
      }),
    ])
    members = [...tang, ...ni]
  }

  return {
    members: members.map((member) => ({
      member,
      access: member.status === 'locked' ? ('view' as const) : ('edit' as const),
    })),
  }
}
