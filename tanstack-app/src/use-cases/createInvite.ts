import type { FormType, Invite } from '#/domain/types'
import { inviteRepo, type InviteStore } from '#/repositories/inviteRepo'

export type CreateInviteInput = {
  orgUnitId: string
  formType: FormType
  createdBy: string
  token?: string
}

export async function createInvite(
  input: CreateInviteInput,
  store: InviteStore = inviteRepo,
): Promise<Invite> {
  const token = input.token ?? crypto.randomUUID()
  const invite: Invite = {
    id: token,
    token,
    orgUnitId: input.orgUnitId,
    formType: input.formType,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  }
  await store.create(invite)
  return invite
}
