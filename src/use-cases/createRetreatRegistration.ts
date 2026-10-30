import {
  canAccessOrgUnit,
  canManageRetreats,
  type AuthClaims,
} from '#/domain/authClaims'
import { DomainError } from '#/domain/errors'
import {
  assertMemberOrgMatches,
  assertQuyenAllows,
  assertRegistrationOpen,
  retreatRegistrationId,
  validateExtraAnswers,
  type RegisteredVia,
  type RetreatRegistration,
} from '#/domain/retreatRegistration'
import { memberRepo, type MemberStore } from '#/repositories/memberRepo'
import { retreatRepo, type RetreatStore } from '#/repositories/retreatRepo'
import {
  retreatRegistrationRepo,
  type RetreatRegistrationStore,
} from '#/repositories/retreatRegistrationRepo'

export type CreateRetreatRegistrationInput = {
  claims: AuthClaims | null
  retreatId: string
  memberId: string
  registeredVia: RegisteredVia
  registeredBy: string | null
  extraAnswers: Record<string, string>
  nowIso?: string
}

export type CreateRetreatRegistrationDeps = {
  retreatStore?: Pick<RetreatStore, 'getById'>
  memberStore?: Pick<MemberStore, 'getById'>
  registrationStore?: RetreatRegistrationStore
}

export async function createRetreatRegistration(
  input: CreateRetreatRegistrationInput,
  deps: CreateRetreatRegistrationDeps = {},
): Promise<RetreatRegistration> {
  const retreatStore = deps.retreatStore ?? retreatRepo
  const memberStore = deps.memberStore ?? memberRepo
  const registrationStore = deps.registrationStore ?? retreatRegistrationRepo

  const retreat = await retreatStore.getById(input.retreatId)
  if (!retreat) {
    throw new DomainError('NOT_FOUND', 'Retreat not found')
  }

  const nowIso = input.nowIso ?? new Date().toISOString()
  assertRegistrationOpen(retreat, nowIso)
  assertQuyenAllows(retreat.quyenDangKy, input.registeredVia)

  if (input.registeredVia === 'proxy') {
    if (!input.claims) {
      throw new DomainError('UNAUTHORIZED', 'Proxy registration requires authentication')
    }
    if (!canManageRetreats(input.claims)) {
      throw new DomainError('FORBIDDEN', 'Cannot manage retreats')
    }
    if (!canAccessOrgUnit(input.claims, retreat.orgUnitId)) {
      throw new DomainError('FORBIDDEN', 'Cannot access retreat in other org unit')
    }
    if (!input.registeredBy) {
      throw new DomainError('INVALID_INPUT', 'registeredBy is required for proxy registration')
    }
  } else {
    if (input.registeredBy !== null) {
      throw new DomainError('INVALID_INPUT', 'registeredBy must be null for self registration')
    }
  }

  const member = await memberStore.getById(input.memberId)
  if (!member) {
    throw new DomainError('NOT_FOUND', 'Member not found')
  }
  assertMemberOrgMatches(member.orgUnitId, retreat.orgUnitId)

  validateExtraAnswers(retreat.extraFields, input.extraAnswers)

  const id = retreatRegistrationId(input.retreatId, input.memberId)
  const existing = await registrationStore.getById(id)
  if (existing) {
    throw new DomainError('ALREADY_EXISTS', 'Registration already exists')
  }

  const registration: RetreatRegistration = {
    id,
    retreatId: input.retreatId,
    memberId: input.memberId,
    orgUnitId: retreat.orgUnitId,
    registeredVia: input.registeredVia,
    registeredBy: input.registeredBy,
    extraAnswers: input.extraAnswers,
    status: 'pending',
    rejectionReason: null,
    approvedBy: null,
    approvedAt: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  }

  await registrationStore.create(registration)
  return registration
}
