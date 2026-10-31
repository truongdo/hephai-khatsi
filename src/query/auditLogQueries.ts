import { queryOptions } from '@tanstack/react-query'
import { listAuditLogs, type AuditParent } from '#/repositories/auditLogRepo'
import { adminKeys } from './adminKeys'

export function auditLogsQuery(parent: AuditParent, pageSize = 20) {
  return queryOptions({
    queryKey:
      parent.collection === 'members'
        ? adminKeys.memberAuditLogs(parent.id)
        : adminKeys.templeAuditLogs(parent.id),
    queryFn: () => listAuditLogs(parent, { limit: pageSize }),
    staleTime: 60_000,
    enabled: !!parent.id,
  })
}

export function memberAuditLogsQuery(memberId: string, pageSize = 20) {
  return auditLogsQuery({ collection: 'members', id: memberId }, pageSize)
}

export function templeAuditLogsQuery(templeId: string, pageSize = 20) {
  return auditLogsQuery({ collection: 'temples', id: templeId }, pageSize)
}
