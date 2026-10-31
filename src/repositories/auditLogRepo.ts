import type { AuditLogEntry } from '#/domain/auditLog'
import { d1ListAuditLogs } from '#/repositories/d1/auditLogRepo'

export type AuditParent = { collection: 'members' | 'temples'; id: string }

export type ListAuditLogs = (
  parent: AuditParent,
  opts: { limit: number; startAfterAt?: string },
) => Promise<{ entries: AuditLogEntry[]; nextStartAfterAt: string | null }>

export const listAuditLogs: ListAuditLogs = d1ListAuditLogs
