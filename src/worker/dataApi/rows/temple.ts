import type { RecordStatus, Temple } from '#/domain/types'
import {
  fromDataColumn,
  presentFields,
  toColumn,
  toDataColumn,
} from './rowValues'

export type TempleRow = {
  id: string
  org_unit_id: string
  status: RecordStatus
  invite_id: string | null
  list_city_name: string | null
  org_unit_name: string | null
  locked_at: string | null
  locked_by: string | null
  edit_requested_at: string | null
  edit_requested_by: string | null
  created_at: string
  updated_at: string
  data: string
}

export type TempleManagerPhoneRow = {
  temple_id: string
  org_unit_id: string
  phone: string
}

type TempleColumnFields =
  | 'id'
  | 'orgUnitId'
  | 'status'
  | 'inviteId'
  | 'listCityName'
  | 'orgUnitName'
  | 'lockedAt'
  | 'lockedBy'
  | 'editRequestedAt'
  | 'editRequestedBy'
  | 'createdAt'
  | 'updatedAt'

type TempleData = Omit<Temple, TempleColumnFields>

/** `version` is left to the write handlers (the column defaults to 1). */
export function templeToRow(temple: Temple): TempleRow {
  const {
    id,
    orgUnitId,
    status,
    inviteId,
    listCityName,
    orgUnitName,
    lockedAt,
    lockedBy,
    editRequestedAt,
    editRequestedBy,
    createdAt,
    updatedAt,
    ...data
  } = temple
  return {
    id,
    org_unit_id: orgUnitId,
    status,
    invite_id: inviteId,
    list_city_name: toColumn(listCityName),
    org_unit_name: toColumn(orgUnitName),
    locked_at: lockedAt,
    locked_by: lockedBy,
    edit_requested_at: editRequestedAt,
    edit_requested_by: editRequestedBy,
    created_at: createdAt,
    updated_at: updatedAt,
    data: toDataColumn(data satisfies TempleData),
  }
}

/** `managerPhones` stay in `data`; these rows are their lookup index. */
export function templeManagerPhoneRows(temple: Temple): TempleManagerPhoneRow[] {
  return [...new Set(temple.managerPhones)].map((phone) => ({
    temple_id: temple.id,
    org_unit_id: temple.orgUnitId,
    phone,
  }))
}

export function templeFromRow(row: TempleRow): Temple {
  const data = fromDataColumn<TempleData>(row.data)
  return {
    ...data,
    // Older Firestore temples have no photoPath (same default as templeRepo).
    photoPath: data.photoPath ?? null,
    id: row.id,
    orgUnitId: row.org_unit_id,
    status: row.status,
    inviteId: row.invite_id,
    lockedAt: row.locked_at,
    lockedBy: row.locked_by,
    editRequestedAt: row.edit_requested_at,
    editRequestedBy: row.edit_requested_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...presentFields({
      listCityName: row.list_city_name,
      orgUnitName: row.org_unit_name,
    }),
  }
}
