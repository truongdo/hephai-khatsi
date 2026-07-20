import { queryOptions } from '@tanstack/react-query'
import { DomainError } from '#/domain/errors'
import type { Member, Temple } from '#/domain/types'
import { memberRepo } from '#/repositories/memberRepo'
import { listOrgUnits } from '#/repositories/orgUnitRepo'
import { templeRepo } from '#/repositories/templeRepo'
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

export function fillerMemberQuery(id: string) {
  return queryOptions({
    queryKey: fillerKeys.member(id),
    queryFn: async (): Promise<Member> => {
      const member = await memberRepo.getById(id)
      if (!member) throw new DomainError('NOT_FOUND', 'Member not found')
      return member
    },
    staleTime: 5 * 60_000,
  })
}

export function fillerTempleQuery(id: string) {
  return queryOptions({
    queryKey: fillerKeys.temple(id),
    queryFn: async (): Promise<Temple> => {
      const temple = await templeRepo.getById(id)
      if (!temple) throw new DomainError('NOT_FOUND', 'Temple not found')
      return temple
    },
    staleTime: 5 * 60_000,
  })
}
