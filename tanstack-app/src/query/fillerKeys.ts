export const fillerKeys = {
  all: ['filler'] as const,
  invite: (token: string) => [...fillerKeys.all, 'invite', token] as const,
  orgUnits: () => [...fillerKeys.all, 'orgUnits'] as const,
}
