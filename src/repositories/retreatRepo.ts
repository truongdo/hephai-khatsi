import type { Retreat, RetreatStatus, RetreatWritableFields } from '#/domain/retreat'
import type { AdminListPage, ListRetreatsAdminInput } from '#/repositories/adminListTypes'
import { d1RetreatRepo } from '#/repositories/d1/retreatRepo'

export type CreateRetreatInput = {
  orgUnitId: string
  createdBy: string
  fields: RetreatWritableFields
}

export type RetreatStore = {
  create(input: CreateRetreatInput): Promise<Retreat>
  update(id: string, fields: RetreatWritableFields): Promise<Retreat>
  setStatus(id: string, status: RetreatStatus): Promise<Retreat>
  getById(id: string): Promise<Retreat | null>
  list(input: ListRetreatsAdminInput): Promise<AdminListPage<Retreat>>
  delete(id: string): Promise<void>
}

export const retreatRepo: RetreatStore = d1RetreatRepo
