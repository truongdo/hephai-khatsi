import {
  canAccessOrgUnit,
  canManageRetreats,
  type AuthClaims,
} from '#/domain/authClaims'
import { DomainError } from '#/domain/errors'
import {
  validateRetreatFields,
  type Retreat,
  type RetreatWritableFields,
} from '#/domain/retreat'
import { retreatRepo, type RetreatStore } from '#/repositories/retreatRepo'

export async function updateRetreat(
  claims: AuthClaims,
  input: {
    retreatId: string
    fields: RetreatWritableFields
  },
  store: RetreatStore = retreatRepo,
): Promise<Retreat> {
  if (!canManageRetreats(claims)) {
    throw new DomainError('FORBIDDEN', 'Cannot manage retreats')
  }

  const retreat = await store.getById(input.retreatId)
  if (!retreat) {
    throw new DomainError('NOT_FOUND', 'Retreat not found')
  }
  if (!canAccessOrgUnit(claims, retreat.orgUnitId)) {
    throw new DomainError('FORBIDDEN', 'Cannot access retreat in other org unit')
  }

  validateRetreatFields(input.fields)
  return store.update(input.retreatId, input.fields)
}
