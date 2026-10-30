import {
  canAccessOrgUnit,
  canManageRetreats,
  type AuthClaims,
} from '#/domain/authClaims'
import { DomainError } from '#/domain/errors'
import { assertCanClose, type Retreat } from '#/domain/retreat'
import { retreatRepo, type RetreatStore } from '#/repositories/retreatRepo'

export async function closeRetreat(
  claims: AuthClaims,
  retreatId: string,
  store: RetreatStore = retreatRepo,
): Promise<Retreat> {
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

  assertCanClose(retreat.status)
  return store.setStatus(retreatId, 'closed')
}
