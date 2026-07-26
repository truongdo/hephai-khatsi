import {
  canAccessOrgUnit,
  canManageRetreats,
  type AuthClaims,
} from '#/domain/authClaims'
import { DomainError } from '#/domain/errors'
import { assertCanDelete } from '#/domain/retreat'
import { retreatRepo, type RetreatStore } from '#/repositories/retreatRepo'

export async function deleteRetreat(
  claims: AuthClaims,
  retreatId: string,
  store: RetreatStore = retreatRepo,
): Promise<void> {
  if (!canManageRetreats(claims)) {
    throw new DomainError('FORBIDDEN', 'Cannot manage retreats')
  }

  const retreat = await store.getById(retreatId)
  if (!retreat) {
    throw new DomainError('NOT_FOUND', 'Retreat not found')
  }
  if (!canAccessOrgUnit(claims, retreat.orgUnitId)) {
    throw new DomainError('FORBIDDEN', 'Cannot access retreat in other org unit')
  }

  assertCanDelete(retreat.status)
  await store.delete(retreatId)
}
