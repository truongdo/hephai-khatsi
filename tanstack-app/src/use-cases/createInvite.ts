import type { Invite } from '#/domain/types'
import { PUBLIC_INVITE_ID, inviteRepo, type InviteStore } from '#/repositories/inviteRepo'

export type CreateInviteInput = {
  createdBy: string
}

export async function createInvite(
  input: CreateInviteInput,
  store: InviteStore = inviteRepo,
): Promise<Invite> {
  const invite: Invite = {
    id: PUBLIC_INVITE_ID,
    token: PUBLIC_INVITE_ID,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  }
  await store.create(invite)
  return invite
}
