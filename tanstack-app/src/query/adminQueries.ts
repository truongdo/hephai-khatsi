import { queryOptions } from '@tanstack/react-query'
import { DomainError } from '#/domain/errors'
import type { Retreat } from '#/domain/retreat'
import type { Member, Temple } from '#/domain/types'
import { memberRepo } from '#/repositories/memberRepo'
import { listOrgUnits } from '#/repositories/orgUnitRepo'
import { retreatRegistrationRepo } from '#/repositories/retreatRegistrationRepo'
import { retreatRepo } from '#/repositories/retreatRepo'
import { templeRepo } from '#/repositories/templeRepo'
import type {
  ListMembersAdminInput,
  ListRetreatsAdminInput,
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

export function retreatsQuery(filters: ListRetreatsAdminInput) {
  return queryOptions({
    queryKey: adminKeys.retreats(filters),
    queryFn: () => retreatRepo.list(filters),
    retry: 3,
  })
}

export function retreatQuery(id: string) {
  return queryOptions({
    queryKey: adminKeys.retreat(id),
    queryFn: async (): Promise<Retreat> => {
      const retreat = await retreatRepo.getById(id)
      if (!retreat) throw new DomainError('NOT_FOUND', 'Retreat not found')
      return retreat
    },
    retry: 3,
  })
}

export function retreatRegistrationsQuery(retreatId: string) {
  return queryOptions({
    queryKey: adminKeys.retreatRegistrations(retreatId),
    queryFn: () => retreatRegistrationRepo.listByRetreat({ retreatId }),
    retry: 3,
  })
}

export function directorySecretariesQuery() {
  return queryOptions({
    queryKey: adminKeys.directorySecretaries(),
    queryFn: () => memberRepo.listDirectorySecretaries(),
    staleTime: 60_000,
    retry: 3,
  })
}
