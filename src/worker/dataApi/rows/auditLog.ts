import type { AuditAction, AuditActor, AuditChange, AuditLogEntry } from '#/domain/auditLog'
import { fromDataColumn, toDataColumn } from './rowValues'

export type AuditLogParent = { type: 'members' | 'temples'; id: string }

export type AuditLogRow = {
  parent_type: AuditLogParent['type']
  parent_id: string
  id: string
  action: AuditAction
  at: string
  actor_type: AuditActor['actorType']
  actor_id: string
  changes: string
  summary: string | null
}

export function auditLogToRow(parent: AuditLogParent, entry: AuditLogEntry): AuditLogRow {
  return {
    parent_type: parent.type,
    parent_id: parent.id,
    id: entry.id,
    action: entry.action,
    at: entry.at,
    actor_type: entry.actorType,
    actor_id: entry.actorId,
    changes: toDataColumn(entry.changes),
    summary: entry.summary,
  }
}

export function auditLogFromRow(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    action: row.action,
    at: row.at,
    actorType: row.actor_type,
    actorId: row.actor_id,
    changes: fromDataColumn<AuditChange[]>(row.changes),
    summary: row.summary,
  }
}
