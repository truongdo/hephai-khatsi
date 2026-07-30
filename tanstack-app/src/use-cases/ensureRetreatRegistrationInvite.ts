import {
  canAccessOrgUnit,
  canManageRetreats,
  type AuthClaims,
} from '#/domain/authClaims'
import { DomainError } from '#/domain/errors'
import { retreatRegistrationInviteId } from '#/domain/invite'
import type { Invite } from '#/domain/types'
import { inviteRepo, type InviteStore } from '#/repositories/inviteRepo'
import { retreatRepo, type RetreatStore } from '#/repositories/retreatRepo'

export type EnsureRetreatRegistrationInviteInput = {
  retreatId: string
  createdBy: string
}

export async function ensureRetreatRegistrationInvite(
  claims: AuthClaims,
  input: EnsureRetreatRegistrationInviteInput,
  inviteStore: InviteStore = inviteRepo,
  retreatStore: Pick<RetreatStore, 'getById'> = retreatRepo,
): Promise<Invite> {
  if (!canManageRetreats(claims)) {
    throw new DomainError('FORBIDDEN', 'Cannot manage retreats')
  }

  const retreat = await retreatStore.getById(input.retreatId)
  if (!retreat) {
    throw new DomainError('NOT_FOUND', 'Retreat not found')
  }
  if (!canAccessOrgUnit(claims, retreat.orgUnitId)) {
    throw new DomainError('FORBIDDEN', 'Cannot access retreat in other org unit')
  }

  const id = retreatRegistrationInviteId(retreat.id)
  const existing = await inviteStore.getByToken(id)
  if (existing && !existing.disabled) {
    return existing
  }

  const invite: Invite = {
    id,
    token: id,
    kind: 'retreat_registration',
    retreatId: retreat.id,
    orgUnitId: retreat.orgUnitId,
    disabled: false,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  }
  await inviteStore.create(invite)
  return invite
}
