import {
  retreatRegistrationId,
  type RetreatRegistration,
} from '#/domain/retreatRegistration'
import { canWriteDirectory, directoryOrgOk, type Caller } from './caller'
import { changedOnly, isString, unchanged } from './docDiff'

// match /retreatRegistrations/{id}: get by id is public (duplicate check
// before a self registration); list goes through `canListDirectory`; never
// deleted.

const REVIEW_FIELDS = ['status', 'approvedBy', 'approvedAt', 'rejectionReason', 'updatedAt']
const IMMUTABLE_FIELDS = [
  'retreatId',
  'memberId',
  'orgUnitId',
  'registeredVia',
  'registeredBy',
  'extraAnswers',
  'createdAt',
]

function idOk(registration: RetreatRegistration): boolean {
  return registration.id === retreatRegistrationId(registration.retreatId, registration.memberId)
}

function isCreateShape(registration: RetreatRegistration): boolean {
  return (
    registration.status === 'pending' &&
    registration.approvedBy == null &&
    registration.approvedAt == null &&
    registration.rejectionReason == null &&
    idOk(registration)
  )
}

/**
 * Self registration: anyone, including signed-in staff on the public /r form.
 * Proxy registration: directory writers of the registration's org unit.
 */
export function canCreateRegistration(
  caller: Caller,
  registration: RetreatRegistration,
): boolean {
  if (!isCreateShape(registration)) return false
  if (registration.registeredVia === 'self') return registration.registeredBy == null
  return (
    caller !== null &&
    canWriteDirectory(caller) &&
    directoryOrgOk(caller, registration.orgUnitId) &&
    registration.registeredVia === 'proxy' &&
    registration.registeredBy === caller.uid
  )
}

function isValidReview(caller: Caller, before: RetreatRegistration, after: RetreatRegistration): boolean {
  if (before.status !== 'pending') return false
  if (caller === null || after.approvedBy !== caller.uid) return false
  if (!isString(after.approvedAt) || !isString(after.updatedAt)) return false
  if (after.status === 'approved') return after.rejectionReason == null
  return (
    after.status === 'rejected' &&
    (after.rejectionReason == null ||
      (isString(after.rejectionReason) && after.rejectionReason.length > 0))
  )
}

/** The only update is an approve / reject review of a pending registration. */
export function canReviewRegistration(
  caller: Caller,
  before: RetreatRegistration,
  after: RetreatRegistration,
): boolean {
  return (
    canWriteDirectory(caller) &&
    directoryOrgOk(caller, before.orgUnitId) &&
    changedOnly(before, after, REVIEW_FIELDS) &&
    unchanged(before, after, IMMUTABLE_FIELDS) &&
    idOk(after) &&
    isValidReview(caller, before, after)
  )
}
