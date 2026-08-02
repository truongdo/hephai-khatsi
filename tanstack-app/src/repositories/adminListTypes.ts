import type { RetreatStatus } from '#/domain/retreat'
import type { Member, RecordStatus, SanghaType, Temple } from '#/domain/types'

export type AdminListPage<T> = {
  items: T[]
  nextCursor: string | null
}

export type ListTemplesAdminInput = {
  orgUnitId?: string
  status?: RecordStatus
  limit?: number
  cursor?: string
}

export type ListRetreatsAdminInput = {
  orgUnitId?: string
  status?: RetreatStatus
  limit?: number
  cursor?: string
}

export type ListMembersAdminInput = {
  orgUnitId?: string
  sanghaType: SanghaType
  status?: RecordStatus
  limit?: number
  cursor?: string
}

export type ListMembersExportInput = {
  orgUnitId?: string
  sanghaType: SanghaType
  status?: RecordStatus
}

export type TempleListResult = AdminListPage<Temple>
export type MemberListResult = AdminListPage<Member>
