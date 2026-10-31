import type { AuditLogEntry } from '#/domain/auditLog'
import { d1ListAuditLogs } from '#/repositories/d1/auditLogRepo'

export { shouldWriteAudit } from '#/domain/auditLogWrite'

export type AuditParent = { collection: 'members' | 'temples'; id: string }

export type ListAuditLogs = (
  parent: AuditParent,
  opts: { limit: number; startAfterAt?: string },
) => Promise<{ entries: AuditLogEntry[]; nextStartAfterAt: string | null }>

export function auditParentKey(parent: AuditParent): string {
  return `${parent.collection}:${parent.id}`
}

export const listAuditLogs: ListAuditLogs = d1ListAuditLogs
