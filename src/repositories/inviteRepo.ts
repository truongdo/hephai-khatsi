import type { Invite } from '#/domain/types'
import { d1InviteRepo } from '#/repositories/d1/inviteRepo'

export { PUBLIC_INVITE_ID } from '#/domain/invite'

export type InviteStore = {
  create(invite: Invite): Promise<void>
  getByToken(token: string): Promise<Invite | null>
}

export const inviteRepo: InviteStore = d1InviteRepo
