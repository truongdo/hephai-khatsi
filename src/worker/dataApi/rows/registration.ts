import type {
  RegisteredVia,
  RegistrationStatus,
  RetreatRegistration,
} from '#/domain/retreatRegistration'
import { fromDataColumn, toDataColumn } from './rowValues'

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

export function registrationToRow(registration: RetreatRegistration): RegistrationRow {
  return {
    id: registration.id,
    retreat_id: registration.retreatId,
    member_id: registration.memberId,
    org_unit_id: registration.orgUnitId,
    status: registration.status,
    registered_via: registration.registeredVia,
    registered_by: registration.registeredBy,
    approved_by: registration.approvedBy,
    approved_at: registration.approvedAt,
    rejection_reason: registration.rejectionReason,
    created_at: registration.createdAt,
    updated_at: registration.updatedAt,
    data: toDataColumn({ extraAnswers: registration.extraAnswers } satisfies RegistrationData),
  }
}

export function registrationFromRow(row: RegistrationRow): RetreatRegistration {
  const { extraAnswers } = fromDataColumn<RegistrationData>(row.data)
  return {
    id: row.id,
    retreatId: row.retreat_id,
    memberId: row.member_id,
    orgUnitId: row.org_unit_id,
    registeredVia: row.registered_via,
    registeredBy: row.registered_by,
    extraAnswers,
    status: row.status,
    rejectionReason: row.rejection_reason,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
