import type {
  RegisteredVia,
  RegistrationStatus,
  RetreatRegistration,
} from '#/domain/retreatRegistration'
import { fromDataColumn, toColumn, toDataColumn } from './rowValues'

export type RegistrationRow = {
  id: string
  retreat_id: string
  member_id: string
  org_unit_id: string
  status: RegistrationStatus
  registered_via: RegisteredVia
  registered_by: string | null
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
  data: string
}

type RegistrationData = Pick<RetreatRegistration, 'extraAnswers'>

/** Nullable fields missing from older Firestore documents are stored as NULL. */
export function registrationToRow(registration: RetreatRegistration): RegistrationRow {
  const {
    id,
    retreatId,
    memberId,
    orgUnitId,
    status,
    registeredVia,
    registeredBy,
    approvedBy,
    approvedAt,
    rejectionReason,
    createdAt,
    updatedAt,
    ...data
  } = registration
  return {
    id,
    retreat_id: retreatId,
    member_id: memberId,
    org_unit_id: orgUnitId,
    status,
    registered_via: registeredVia,
    registered_by: toColumn(registeredBy),
    approved_by: toColumn(approvedBy),
    approved_at: toColumn(approvedAt),
    rejection_reason: toColumn(rejectionReason),
    created_at: createdAt,
    updated_at: updatedAt,
    data: toDataColumn(data satisfies RegistrationData),
  }
}

export function registrationFromRow(row: RegistrationRow): RetreatRegistration {
  return {
    ...fromDataColumn<RegistrationData>(row.data),
    id: row.id,
    retreatId: row.retreat_id,
    memberId: row.member_id,
    orgUnitId: row.org_unit_id,
    registeredVia: row.registered_via,
    registeredBy: row.registered_by,
    status: row.status,
    rejectionReason: row.rejection_reason,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
