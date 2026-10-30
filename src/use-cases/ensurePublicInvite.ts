import type { Invite } from '#/domain/types'
import { PUBLIC_INVITE_ID, inviteRepo, type InviteStore } from '#/repositories/inviteRepo'
import { createInvite } from './createInvite'

export type EnsurePublicInviteInput = {
  createdBy: string
}

export async function ensurePublicInvite(
  input: EnsurePublicInviteInput,
  store: InviteStore = inviteRepo,
): Promise<Invite> {
  const existing = await store.getByToken(PUBLIC_INVITE_ID)
  if (existing) return existing
  return createInvite({ createdBy: input.createdBy }, store)
}
