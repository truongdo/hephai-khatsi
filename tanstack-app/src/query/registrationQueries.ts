import { queryOptions } from '@tanstack/react-query'
import { DomainError } from '#/domain/errors'
import { retreatRegistrationRepo } from '#/repositories/retreatRegistrationRepo'
import { retreatRepo } from '#/repositories/retreatRepo'
import { getInviteByToken } from '#/use-cases/getInviteByToken'
import { registrationKeys } from './registrationKeys'

export function retreatInviteByTokenQuery(token: string) {
  return queryOptions({
    queryKey: registrationKeys.invite(token),
    queryFn: () => getInviteByToken(token),
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export function publicRetreatQuery(retreatId: string) {
  return queryOptions({
    queryKey: registrationKeys.retreat(retreatId),
    queryFn: async () => {
      const retreat = await retreatRepo.getById(retreatId)
      if (!retreat) {
        throw new DomainError('NOT_FOUND', 'Retreat not found')
      }
      return retreat
    },
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export function publicRegistrationQuery(id: string) {
  return queryOptions({
    queryKey: registrationKeys.registration(id),
    queryFn: () => retreatRegistrationRepo.getById(id),
    staleTime: 5 * 60_000,
    retry: false,
  })
}
