import type { Retreat, RetreatStatus, RetreatType } from '#/domain/retreat'
import { fromDataColumn, toDataColumn } from './rowValues'

export type RetreatRow = {
  id: string
  type: RetreatType
  org_unit_id: string
  status: RetreatStatus
  created_by: string
  created_at: string
  updated_at: string
  data: string
}

type RetreatData = Omit<
  Retreat,
  'id' | 'type' | 'orgUnitId' | 'status' | 'createdBy' | 'createdAt' | 'updatedAt'
>

export function retreatToRow(retreat: Retreat): RetreatRow {
  const { id, type, orgUnitId, status, createdBy, createdAt, updatedAt, ...data } = retreat
  return {
    id,
    type,
    org_unit_id: orgUnitId,
    status,
    created_by: createdBy,
    created_at: createdAt,
    updated_at: updatedAt,
    data: toDataColumn(data satisfies RetreatData),
  }
}

export function retreatFromRow(row: RetreatRow): Retreat {
  return {
    ...fromDataColumn<RetreatData>(row.data),
    id: row.id,
    type: row.type,
    orgUnitId: row.org_unit_id,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
