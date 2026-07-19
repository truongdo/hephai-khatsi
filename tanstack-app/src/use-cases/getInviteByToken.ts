import { DomainError } from '#/domain/errors'
import type { Invite } from '#/domain/types'
import { inviteRepo, type InviteStore } from '#/repositories/inviteRepo'

export async function getInviteByToken(
  token: string,
  store: InviteStore = inviteRepo,
): Promise<Invite> {
  const invite = await store.getByToken(token)
  if (!invite) {
    throw new DomainError('INVITE_NOT_FOUND', 'Invite not found')
  }
  return invite
}
