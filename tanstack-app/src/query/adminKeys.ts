import type {
  ListMembersAdminInput,
  ListTemplesAdminInput,
} from '#/repositories/adminListTypes'

export const adminKeys = {
  all: ['admin'] as const,
  orgUnits: () => [...adminKeys.all, 'orgUnits'] as const,
  invite: () => [...adminKeys.all, 'invite'] as const,
  temples: (filters: ListTemplesAdminInput) =>
    [...adminKeys.all, 'temples', filters] as const,
  temple: (id: string) => [...adminKeys.all, 'temple', id] as const,
  members: (filters: ListMembersAdminInput) =>
    [...adminKeys.all, 'members', filters] as const,
  member: (id: string) => [...adminKeys.all, 'member', id] as const,
}
