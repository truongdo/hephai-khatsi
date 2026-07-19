import { normalizeVnPhone } from '#/domain/normalize'
import type { Temple } from '#/domain/types'
import { inviteRepo, type InviteStore } from '#/repositories/inviteRepo'
import { templeRepo, type TempleStore } from '#/repositories/templeRepo'
import { getTempleInviteContext } from './saveTempleDraft'

export type ResumeTemplesByPhoneInput = {
  token: string
  phone: string
}

export async function resumeTemplesByPhone(
  input: ResumeTemplesByPhoneInput,
  templeStore: TempleStore = templeRepo,
  inviteStore: InviteStore = inviteRepo,
): Promise<{ temples: Array<{ temple: Temple; access: 'edit' | 'view' }> }> {
  const phone = normalizeVnPhone(input.phone)
  const { invite } = await getTempleInviteContext(input.token, inviteStore)
  const temples = await templeStore.listByOrgAndPhone({
    orgUnitId: invite.orgUnitId,
    phone,
  })

  return {
    temples: temples.map((temple) => ({
      temple,
      access: temple.status === 'locked' ? 'view' : 'edit',
    })),
  }
}
