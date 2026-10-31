import { dataApi, type DataApiClient } from '#/data/apiClient'
import type { ListAuditLogs } from '#/repositories/auditLogRepo'

// Audit history reads over /api/data/audit-logs/list; entries are written by
// the Worker's member / temple handlers.

export function createD1ListAuditLogs(api: DataApiClient = dataApi): ListAuditLogs {
  return (parent, opts) =>
    api.post('audit-logs/list', {
      parentType: parent.collection,
      parentId: parent.id,
      limit: opts.limit,
      startAfterAt: opts.startAfterAt,
    })
}

export const d1ListAuditLogs = createD1ListAuditLogs()
