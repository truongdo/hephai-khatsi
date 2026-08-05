import type {
  ListMembersAdminInput,
  ListRetreatsAdminInput,
  ListTemplesAdminInput,
} from '#/repositories/adminListTypes'

export const adminKeys = {
  all: ['admin'] as const,
  orgUnits: () => [...adminKeys.all, 'orgUnits'] as const,
  temples: (filters: ListTemplesAdminInput) =>
    [...adminKeys.all, 'temples', filters] as const,
  temple: (id: string) => [...adminKeys.all, 'temple', id] as const,
  members: (filters: ListMembersAdminInput) =>
    [...adminKeys.all, 'members', filters] as const,
  member: (id: string) => [...adminKeys.all, 'member', id] as const,
  retreats: (filters: ListRetreatsAdminInput) =>
    [...adminKeys.all, 'retreats', filters] as const,
  retreat: (id: string) => [...adminKeys.all, 'retreat', id] as const,
  retreatRegistrations: (retreatId: string) =>
    [...adminKeys.all, 'retreatRegistrations', retreatId] as const,
  memberAuditLogs: (memberId: string) =>
    [...adminKeys.member(memberId), 'auditLogs'] as const,
  templeAuditLogs: (templeId: string) =>
    [...adminKeys.temple(templeId), 'auditLogs'] as const,
}
