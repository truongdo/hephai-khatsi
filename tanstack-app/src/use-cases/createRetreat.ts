import {
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

export async function createRetreat(
  claims: AuthClaims,
  input: {
    orgUnitId?: string
    createdBy: string
    fields: RetreatWritableFields
  },
  store: RetreatStore = retreatRepo,
): Promise<Retreat> {
  if (!canManageRetreats(claims)) {
    throw new DomainError('FORBIDDEN', 'Cannot manage retreats')
  }

  let orgUnitId: string
  if (claims.role === 'giao_doan_admin') {
    if (!claims.orgUnitId) {
      throw new DomainError('FORBIDDEN', 'Missing org unit scope')
    }
    if (input.orgUnitId && input.orgUnitId !== claims.orgUnitId) {
      throw new DomainError('FORBIDDEN', 'Cannot create retreat for other org unit')
    }
    orgUnitId = claims.orgUnitId
  } else {
    if (!input.orgUnitId) {
      throw new DomainError('INVALID_INPUT', 'orgUnitId is required')
    }
    orgUnitId = input.orgUnitId
  }

  validateRetreatFields(input.fields)

  return store.create({
    orgUnitId,
    createdBy: input.createdBy,
    fields: input.fields,
  })
}
