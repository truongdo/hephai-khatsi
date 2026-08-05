import { queryOptions } from '@tanstack/react-query'
import { listAuditLogs } from '#/repositories/auditLogRepo'
import { adminKeys } from './adminKeys'

export function memberAuditLogsQuery(memberId: string, pageSize = 20) {
  return queryOptions({
    queryKey: adminKeys.memberAuditLogs(memberId),
    queryFn: () =>
      listAuditLogs({ collection: 'members', id: memberId }, { limit: pageSize }),
    staleTime: 60_000,
    enabled: !!memberId,
  })
}

export function templeAuditLogsQuery(templeId: string, pageSize = 20) {
  return queryOptions({
    queryKey: adminKeys.templeAuditLogs(templeId),
    queryFn: () =>
      listAuditLogs({ collection: 'temples', id: templeId }, { limit: pageSize }),
    staleTime: 60_000,
    enabled: !!templeId,
  })
}
