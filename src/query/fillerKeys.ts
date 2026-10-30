export const fillerKeys = {
  all: ['filler'] as const,
  invite: (token: string) => [...fillerKeys.all, 'invite', token] as const,
  orgUnits: () => [...fillerKeys.all, 'orgUnits'] as const,
  member: (id: string) => [...fillerKeys.all, 'member', id] as const,
  temple: (id: string) => [...fillerKeys.all, 'temple', id] as const,
}
