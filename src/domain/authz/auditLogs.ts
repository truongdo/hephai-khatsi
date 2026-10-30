import type { AuditAction, AuditLogWrite } from '#/domain/auditLog'
import type { Member, Temple } from '#/domain/types'
import {
  canWriteDirectory,
  isStaff,
  type Caller,
  type InviteExists,
} from './caller'
import { isString } from './docDiff'
import { hasValidInvite } from './lockableRecord'

// match /members/{id}/auditLogs and /temples/{id}/auditLogs: append-only
// (never updated or deleted).

const AUDIT_ACTIONS: readonly AuditAction[] = [
  'created',
  'updated',
  'locked',
  'unlocked',
  'edit_requested',
  'photo_uploaded',
  'photo_deleted',
  'document_uploaded',
  'document_deleted',
]

function isValidAuditEntry(entry: AuditLogWrite): boolean {
  return (
    AUDIT_ACTIONS.includes(entry.action) &&
    isString(entry.at) &&
    (entry.actorType === 'admin' || entry.actorType === 'filler') &&
    isString(entry.actorId) &&
    entry.actorId.length > 0 &&
    Array.isArray(entry.changes)
  )
}

export function canReadAuditLogs(caller: Caller): boolean {
  return canWriteDirectory(caller)
}

/**
 * `parent` is the member / temple as it is after the write the log belongs to
 * (the rules' `getAfter`), so a filler can create a record and its log
 * together.
 */
export function canCreateAuditLog(
  caller: Caller,
  parent: Member | Temple,
  entry: AuditLogWrite,
  inviteExists: InviteExists,
): boolean {
  if (!isValidAuditEntry(entry)) return false
  if (canWriteDirectory(caller)) return true
  // The only staff left is kiểm soát, so the rules' `!isKiemSoat()` (members)
  // and `!isStaff()` (temples) are the same check here.
  return (
    !isStaff(caller) &&
    hasValidInvite(parent, inviteExists) &&
    entry.actorType === 'filler'
  )
}
