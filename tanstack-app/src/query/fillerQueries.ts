import { queryOptions } from '@tanstack/react-query'
import { listOrgUnits } from '#/repositories/orgUnitRepo'
import { getInviteByToken } from '#/use-cases/getInviteByToken'
import { fillerKeys } from './fillerKeys'

export function inviteByTokenQuery(token: string) {
  return queryOptions({
    queryKey: fillerKeys.invite(token),
    queryFn: () => getInviteByToken(token),
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export function fillerOrgUnitsQuery() {
  return queryOptions({
    queryKey: fillerKeys.orgUnits(),
    queryFn: listOrgUnits,
    staleTime: 5 * 60_000,
  })
}
