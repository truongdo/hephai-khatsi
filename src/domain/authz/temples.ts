import type { Temple } from '#/domain/types'
import {
  canWriteDirectory,
  directoryOrgOk,
  isHePhaiAdmin,
  isStaff,
  type Caller,
  type InviteExists,
} from './caller'
import { isString, unchanged } from './docDiff'
import {
  hasTimestamps,
  hasValidInvite,
  inviteKeptOrAdopted,
  isAdminCreateShape,
  isFillerCreateShape,
  isFillerEditRequest,
  isFillerMediaUpdate,
  isFillerSaveAndLock,
  isLockTransition,
  lockFieldsUnchanged,
} from './lockableRecord'

// match /temples/{templeId}: get by id is public; list goes through
// `canListDirectory`. Unlike members, ids are random and only staff are
// excluded from the filler path (a signed-in admin cannot fill as a visitor).

const TEMPLE_MEDIA_FIELDS = ['photoPath']

/** Only a hệ phái admin may move a draft temple to another org unit. */
function orgUnitReassignOk(caller: Caller, before: Temple, after: Temple): boolean {
  return (
    isHePhaiAdmin(caller) &&
    before.status === 'draft' &&
    after.status === 'draft' &&
    isString(after.orgUnitId) &&
    directoryOrgOk(caller, before.orgUnitId) &&
    directoryOrgOk(caller, after.orgUnitId)
  )
}

function identityOk(caller: Caller, before: Temple, after: Temple): boolean {
  return (
    unchanged(before, after, ['createdAt']) &&
    (unchanged(before, after, ['orgUnitId']) || orgUnitReassignOk(caller, before, after))
  )
}

export function canCreateTemple(
  caller: Caller,
  temple: Temple,
  inviteExists: InviteExists,
): boolean {
  if (!hasTimestamps(temple)) return false
  if (!Array.isArray(temple.managerPhones) || temple.managerPhones.length === 0) {
    return false
  }
  return (
    (canWriteDirectory(caller) &&
      directoryOrgOk(caller, temple.orgUnitId) &&
      temple.inviteId == null &&
      isAdminCreateShape(temple)) ||
    (!isStaff(caller) && hasValidInvite(temple, inviteExists) && isFillerCreateShape(temple))
  )
}

export function canUpdateTemple(
  caller: Caller,
  before: Temple,
  after: Temple,
  inviteExists: InviteExists,
): boolean {
  if (!identityOk(caller, before, after)) return false
  if (canWriteDirectory(caller) && directoryOrgOk(caller, before.orgUnitId)) {
    // Either a pure lock / unlock, or an edit that leaves the lock alone.
    return isLockTransition(before, after) || lockFieldsUnchanged(before, after)
  }
  return (
    !isStaff(caller) &&
    hasValidInvite(after, inviteExists) &&
    inviteKeptOrAdopted(before, after) &&
    (isFillerSaveAndLock(before, after) ||
      isFillerEditRequest(before, after) ||
      isFillerMediaUpdate(before, after, TEMPLE_MEDIA_FIELDS))
  )
}

export function canDeleteTemple(caller: Caller, before: Temple): boolean {
  return canWriteDirectory(caller) && directoryOrgOk(caller, before.orgUnitId)
}
