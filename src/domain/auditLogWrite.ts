import type { AuditAction, AuditActor, AuditChange, AuditLogWrite } from './auditLog'
import { buildAuditChanges } from './buildAuditChanges'

export function shouldWriteAudit(action: AuditAction, changes: AuditChange[]): boolean {
  if (action === 'updated' && changes.length === 0) return false
  return true
}

/** The audit entry of a write, or null when an update changed nothing. */
export function buildAuditLogWrite(args: {
  action: AuditAction
  actor: AuditActor
  at: string
  before: unknown
  after: unknown
}): AuditLogWrite | null {
  const changes = buildAuditChanges(args.before, args.after)
  if (!shouldWriteAudit(args.action, changes)) return null
  return {
    action: args.action,
    at: args.at,
    actorType: args.actor.actorType,
    actorId: args.actor.actorId,
    changes,
    summary: changes.length === 0 ? null : String(changes.length),
  }
}
