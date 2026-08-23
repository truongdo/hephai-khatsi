import type { RetreatStatus } from '#/domain/retreat'
import type { Member, RecordStatus, SanghaType, Temple } from '#/domain/types'

export type AdminSortDir = 'asc' | 'desc'

export type TempleAdminSortBy = 'listCityName' | 'orgUnitName' | 'updatedAt'
export type MemberAdminSortBy =
  | 'giaoPhamHePhaiRankOrder'
  | 'orgUnitName'
  | 'status'
  | 'updatedAt'

export type AdminListPage<T> = {
  items: T[]
  nextCursor: string | null
}

export type ListTemplesAdminInput = {
  orgUnitId?: string
  status?: RecordStatus
  limit?: number
  cursor?: string
  sortBy?: TempleAdminSortBy
  sortDir?: AdminSortDir
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
  sortBy?: MemberAdminSortBy
  sortDir?: AdminSortDir
}

export type ListMembersExportInput = {
  orgUnitId?: string
  sanghaType: SanghaType
  status?: RecordStatus
}

export type ListMembersByHaLapTabInput = {
  orgUnitId?: string
  sanghaType: SanghaType
  haLapTabRank: string
  status?: RecordStatus
  limit?: number
  cursor?: string
}

export type CountMembersByHaLapTabInput = {
  orgUnitId?: string
  sanghaType: SanghaType
  haLapTabRank: string
  status?: RecordStatus
}

export type ListTemplesExportInput = {
  orgUnitId?: string
  status?: RecordStatus
}

export type TempleListResult = AdminListPage<Temple>
export type MemberListResult = AdminListPage<Member>
