import { queryOptions } from '@tanstack/react-query'
import { DomainError } from '#/domain/errors'
import type { Invite, Member, Temple } from '#/domain/types'
import { PUBLIC_INVITE_ID, inviteRepo } from '#/repositories/inviteRepo'
import { memberRepo } from '#/repositories/memberRepo'
import { listOrgUnits } from '#/repositories/orgUnitRepo'
import { templeRepo } from '#/repositories/templeRepo'
import type {
  ListMembersAdminInput,
  ListTemplesAdminInput,
} from '#/repositories/adminListTypes'
import { adminKeys } from './adminKeys'

export function orgUnitsQuery() {
  return queryOptions({
    queryKey: adminKeys.orgUnits(),
    queryFn: listOrgUnits,
    staleTime: 5 * 60_000,
    retry: 3,
  })
}

export function inviteQuery() {
  return queryOptions({
    queryKey: adminKeys.invite(),
    queryFn: (): Promise<Invite | null> => inviteRepo.getByToken(PUBLIC_INVITE_ID),
    retry: 3,
  })
}

export function templesQuery(filters: ListTemplesAdminInput) {
  return queryOptions({
    queryKey: adminKeys.temples(filters),
    queryFn: () => templeRepo.list(filters),
    retry: 3,
  })
}

export function templeQuery(id: string) {
  return queryOptions({
    queryKey: adminKeys.temple(id),
    queryFn: async (): Promise<Temple> => {
      const temple = await templeRepo.getById(id)
      if (!temple) throw new DomainError('NOT_FOUND', 'Temple not found')
      return temple
    },
    retry: 3,
  })
}

export function membersQuery(filters: ListMembersAdminInput) {
  return queryOptions({
    queryKey: adminKeys.members(filters),
    queryFn: () => memberRepo.list(filters),
    retry: 3,
  })
}

export function memberQuery(id: string) {
  return queryOptions({
    queryKey: adminKeys.member(id),
    queryFn: async (): Promise<Member> => {
      const member = await memberRepo.getById(id)
      if (!member) throw new DomainError('NOT_FOUND', 'Member not found')
      return member
    },
    retry: 3,
  })
}
