import {
  canAccessOrgUnit,
  canManageRetreats,
  type AuthClaims,
} from '#/domain/authClaims'
import { DomainError } from '#/domain/errors'
import {
  assertRegistrationPending,
  normalizeRejectionReason,
} from '#/domain/retreatRegistration'
import { retreatRepo, type RetreatStore } from '#/repositories/retreatRepo'
import {
  retreatRegistrationRepo,
  type RetreatRegistrationStore,
} from '#/repositories/retreatRegistrationRepo'

export type ReviewDecision = 'approved' | 'rejected'

export type ReviewRetreatRegistrationsInput = {
  claims: AuthClaims
  reviewerUid: string
  retreatId: string
  ids: string[]
  decision: ReviewDecision
  rejectionReason?: string | null
  nowIso?: string
}

export async function reviewRetreatRegistrations(
  input: ReviewRetreatRegistrationsInput,
  deps?: {
    retreatStore?: Pick<RetreatStore, 'getById'>
    registrationStore?: Pick<RetreatRegistrationStore, 'getById' | 'updateReview'>
  },
): Promise<void> {
  if (input.ids.length === 0) {
    throw new DomainError('INVALID_INPUT', 'No registration ids provided')
  }

  if (!canManageRetreats(input.claims)) {
    throw new DomainError('FORBIDDEN', 'Cannot manage retreats')
  }

  const retreatStore = deps?.retreatStore ?? retreatRepo
  const registrationStore = deps?.registrationStore ?? retreatRegistrationRepo

  const retreat = await retreatStore.getById(input.retreatId)
  if (!retreat) {
    throw new DomainError('NOT_FOUND', 'Retreat not found')
  }
  if (!canAccessOrgUnit(input.claims, retreat.orgUnitId)) {
    throw new DomainError('FORBIDDEN', 'Cannot access retreat in other org unit')
  }

  for (const id of input.ids) {
    const reg = await registrationStore.getById(id)
    if (!reg) {
      throw new DomainError('NOT_FOUND', 'Registration not found')
    }
    if (reg.retreatId !== input.retreatId) {
      throw new DomainError('INVALID_INPUT', 'Registration does not belong to retreat')
    }
    assertRegistrationPending(reg.status)
  }

  const nowIso = input.nowIso ?? new Date().toISOString()
  const patch = {
    status: input.decision,
    approvedBy: input.reviewerUid,
    approvedAt: nowIso,
    updatedAt: nowIso,
    rejectionReason:
      input.decision === 'approved'
        ? null
        : normalizeRejectionReason(input.rejectionReason),
  }

  await registrationStore.updateReview(input.ids, patch)
}
