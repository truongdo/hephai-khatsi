import type { AuditAction, AuditLogWrite } from '#/domain/auditLog'
import type { Member, Temple } from '#/domain/types'
import {
  canWriteDirectory,
  isKiemSoat,
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

export type AuditLogParent =
  | { type: 'members'; record: Member }
  | { type: 'temples'; record: Temple }

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
  parent: AuditLogParent,
  entry: AuditLogWrite,
  inviteExists: InviteExists,
): boolean {
  if (!isValidAuditEntry(entry)) return false
  if (canWriteDirectory(caller)) return true
  // Members let a signed-in non-directory user fill; temples exclude all staff.
  const fillerCallerOk = parent.type === 'members' ? !isKiemSoat(caller) : !isStaff(caller)
  return (
    fillerCallerOk &&
    hasValidInvite(parent.record, inviteExists) &&
    entry.actorType === 'filler'
  )
}
