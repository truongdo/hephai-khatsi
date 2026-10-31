import { memberCccdIndexId } from '#/domain/memberCccdIndex'
import type { Member } from '#/domain/types'
import {
  canWriteDirectory,
  directoryOrgOk,
  isHePhaiAdmin,
  isKiemSoat,
  isStaff,
  type Caller,
  type InviteExists,
} from './caller'
import { unchanged } from './docDiff'
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

// match /members/{memberId}: get by id is public (the deterministic id is the
// bearer secret); list goes through `canListDirectory`.

const CORE_IDENTITY_FIELDS = ['orgUnitId', 'sanghaType', 'cccd', 'createdAt']
const DIRECTORY_ROLE_FIELDS = [
  'directoryRole',
  'directoryAuthUid',
  'directoryRoleGrantedAt',
  'directoryRoleGrantedBy',
]
const MEMBER_MEDIA_FIELDS = ['photoPath', 'documents']

// tinhTrang is admin-only (quick-edited from the members list): fillers may
// neither set it on create nor change it on save-and-lock.
function isMemberFillerSaveAndLock(before: Member, after: Member): boolean {
  return isFillerSaveAndLock(before, after) && unchanged(before, after, ['tinhTrang'])
}

function isMemberFillerCreateShape(member: Member): boolean {
  return isFillerCreateShape(member) && member.tinhTrang == null
}

/** Directory-role fields are written only by the directory-role Worker route. */
function directoryRoleFieldsUnchanged(before: Member, after: Member): boolean {
  return unchanged(before, after, DIRECTORY_ROLE_FIELDS)
}

/**
 * A new member never carries a directory role: only the directory-role route
 * grants one, on an existing member (stricter than the rules, which did not
 * check creates).
 */
function hasNoDirectoryRole(member: Member): boolean {
  return (
    member.directoryRole == null &&
    member.directoryAuthUid == null &&
    member.directoryRoleGrantedAt == null &&
    member.directoryRoleGrantedBy == null
  )
}

/** A secretary's email is their sign-in identity. */
function secretaryEmailUnchanged(before: Member, after: Member): boolean {
  return before.directoryRole == null || unchanged(before, after, ['email'])
}

export function canCreateMember(
  caller: Caller,
  member: Member,
  inviteExists: InviteExists,
): boolean {
  if (member.id !== memberCccdIndexId(member.orgUnitId, member.sanghaType, member.cccd)) {
    return false
  }
  if (!hasTimestamps(member) || !hasNoDirectoryRole(member)) return false
  const orgOk = directoryOrgOk(caller, member.orgUnitId)
  return (
    // A hệ phái admin moving a draft to another org unit keeps its invite.
    (isHePhaiAdmin(caller) && orgOk && isAdminCreateShape(member)) ||
    (canWriteDirectory(caller) &&
      orgOk &&
      member.inviteId == null &&
      isAdminCreateShape(member)) ||
    (hasValidInvite(member, inviteExists) &&
      !isKiemSoat(caller) &&
      isMemberFillerCreateShape(member))
  )
}

export function canUpdateMember(
  caller: Caller,
  before: Member,
  after: Member,
  inviteExists: InviteExists,
): boolean {
  if (
    !unchanged(before, after, CORE_IDENTITY_FIELDS) ||
    !directoryRoleFieldsUnchanged(before, after) ||
    !secretaryEmailUnchanged(before, after)
  ) {
    return false
  }
  const directoryWriter =
    canWriteDirectory(caller) &&
    directoryOrgOk(caller, before.orgUnitId) &&
    unchanged(before, after, ['inviteId'])
  if (directoryWriter) {
    // Either a pure lock / unlock, or an edit that leaves the lock alone.
    return isLockTransition(before, after) || lockFieldsUnchanged(before, after)
  }
  return (
    !isStaff(caller) &&
    hasValidInvite(after, inviteExists) &&
    inviteKeptOrAdopted(before, after) &&
    (isMemberFillerSaveAndLock(before, after) ||
      isFillerEditRequest(before, after) ||
      isFillerMediaUpdate(before, after, MEMBER_MEDIA_FIELDS))
  )
}

export function canDeleteMember(caller: Caller, before: Member): boolean {
  return canWriteDirectory(caller) && directoryOrgOk(caller, before.orgUnitId)
}
