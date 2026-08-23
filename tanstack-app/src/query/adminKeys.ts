import type {
  ListMembersAdminInput,
  ListMembersByHaLapTabInput,
  ListMembersExportInput,
  ListRetreatsAdminInput,
  ListTemplesAdminInput,
} from '#/repositories/adminListTypes'
import type { RecordStatus, SanghaType } from '#/domain/types'

export const adminKeys = {
  all: ['admin'] as const,
  orgUnits: () => [...adminKeys.all, 'orgUnits'] as const,
  temples: (filters: ListTemplesAdminInput) =>
    [...adminKeys.all, 'temples', filters] as const,
  temple: (id: string) => [...adminKeys.all, 'temple', id] as const,
  members: (filters: ListMembersAdminInput) =>
    [...adminKeys.all, 'members', filters] as const,
  membersByHaLapTab: (filters: ListMembersByHaLapTabInput) =>
    [...adminKeys.all, 'membersByHaLapTab', filters] as const,
  membersHaLapTabCounts: (filters: {
    sanghaType: SanghaType
    orgUnitId?: string
    status?: RecordStatus
    tabRanks: readonly string[]
  }) => [...adminKeys.all, 'membersHaLapTabCounts', filters] as const,
  membersAll: (filters: ListMembersExportInput) =>
    [...adminKeys.all, 'membersAll', filters] as const,
  member: (id: string) => [...adminKeys.all, 'member', id] as const,
  retreats: (filters: ListRetreatsAdminInput) =>
    [...adminKeys.all, 'retreats', filters] as const,
  retreat: (id: string) => [...adminKeys.all, 'retreat', id] as const,
  retreatRegistrations: (retreatId: string) =>
    [...adminKeys.all, 'retreatRegistrations', retreatId] as const,
  directorySecretaries: () =>
    [...adminKeys.all, 'directorySecretaries'] as const,
  hePhaiSecretaries: () =>
    [...adminKeys.all, 'hePhaiSecretaries'] as const,
  memberAuditLogs: (memberId: string) =>
    [...adminKeys.member(memberId), 'auditLogs'] as const,
  templeAuditLogs: (templeId: string) =>
    [...adminKeys.temple(templeId), 'auditLogs'] as const,
  memberDirectoryStats: (scope: {
    orgUnitId: string | null
    orgUnitIdsForBreakdown: string[]
  }) => [...adminKeys.all, 'memberDirectoryStats', scope] as const,
}
