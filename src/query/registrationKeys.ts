export const registrationKeys = {
  all: ['registration'] as const,
  invite: (token: string) => [...registrationKeys.all, 'invite', token] as const,
  retreat: (id: string) => [...registrationKeys.all, 'retreat', id] as const,
  registration: (id: string) =>
    [...registrationKeys.all, 'registration', id] as const,
}
