import type { Member } from '#/domain/types'
import type { InviteExists } from './caller'
import { changedOnly, isString, unchanged } from './docDiff'

// The draft → locked lifecycle shared by members and temples (the functions of
// the same name inside `match /members` and `match /temples`).

export type LockableRecord = Pick<
  Member,
  | 'status'
  | 'inviteId'
  | 'photoPath'
  | 'createdAt'
  | 'updatedAt'
  | 'lockedAt'
  | 'lockedBy'
  | 'editRequestedAt'
  | 'editRequestedBy'
>

const LOCK_FIELDS = ['status', 'lockedAt', 'lockedBy'] as const
const EDIT_REQUEST_FIELDS = ['editRequestedAt', 'editRequestedBy'] as const
const LOCK_TRANSITION_FIELDS = [...LOCK_FIELDS, ...EDIT_REQUEST_FIELDS, 'updatedAt']

export function lockFieldsUnchanged(before: LockableRecord, after: LockableRecord): boolean {
  return unchanged(before, after, LOCK_FIELDS)
}

/** Only lock / unlock fields change (the admin lock and unlock actions). */
export function isLockTransition(before: LockableRecord, after: LockableRecord): boolean {
  return changedOnly(before, after, LOCK_TRANSITION_FIELDS)
}

export function isFillerSaveAndLock(before: LockableRecord, after: LockableRecord): boolean {
  return (
    before.status === 'draft' &&
    after.status === 'locked' &&
    after.lockedBy === 'filler' &&
    isString(after.lockedAt) &&
    after.editRequestedAt == null &&
    after.editRequestedBy == null
  )
}

export function isFillerEditRequest(before: LockableRecord, after: LockableRecord): boolean {
  return (
    before.status === 'locked' &&
    after.status === 'locked' &&
    lockFieldsUnchanged(before, after) &&
    changedOnly(before, after, [...EDIT_REQUEST_FIELDS, 'updatedAt'])
  )
}

/**
 * Photo (and for members, document) changes by a filler: free on a draft; on a
 * locked record only the first portrait may be attached, never cleared or
 * replaced.
 */
export function isFillerMediaUpdate(
  before: LockableRecord,
  after: LockableRecord,
  mediaFields: readonly string[],
): boolean {
  if (!lockFieldsUnchanged(before, after)) return false
  if (!unchanged(before, after, EDIT_REQUEST_FIELDS)) return false
  if (!changedOnly(before, after, [...mediaFields, 'updatedAt'])) return false
  if (before.status === 'draft') return after.status === 'draft'
  return (
    before.status === 'locked' &&
    ((after.photoPath ?? null) === (before.photoPath ?? null) || before.photoPath == null)
  )
}

/**
 * Admin-created drafts have no invite; a filler completing one (save-and-lock)
 * stamps the current invite on it. Otherwise the invite stays fixed.
 */
export function inviteKeptOrAdopted(before: LockableRecord, after: LockableRecord): boolean {
  return (
    unchanged(before, after, ['inviteId']) ||
    (before.inviteId == null && isFillerSaveAndLock(before, after))
  )
}

/** The rules' `validInviteScope`: the record names an invite that exists. */
export function hasValidInvite(record: LockableRecord, inviteExists: InviteExists): boolean {
  return isString(record.inviteId) && inviteExists(record.inviteId)
}

export function isAdminCreateShape(record: LockableRecord): boolean {
  return record.status === 'draft' && record.lockedAt == null && record.lockedBy == null
}

export function isFillerCreateShape(record: LockableRecord): boolean {
  return (
    record.status === 'locked' &&
    record.lockedBy === 'filler' &&
    isString(record.lockedAt) &&
    record.editRequestedAt == null &&
    record.editRequestedBy == null
  )
}

export function hasTimestamps(record: LockableRecord): boolean {
  return isString(record.createdAt) && isString(record.updatedAt)
}
