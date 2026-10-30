import { DomainError } from '#/domain/errors'
import type { Invite, InviteKind } from '#/domain/types'
import { fromBooleanColumn, toBooleanColumn } from './rowValues'

export type InviteRow = {
  id: string
  kind: InviteKind
  retreat_id: string | null
  org_unit_id: string | null
  disabled: number
  created_at: string
  created_by: string
}

/** The invite id is its token, so the token is not stored twice. */
export function inviteToRow(invite: Invite): InviteRow {
  if (invite.token !== invite.id) {
    throw new DomainError('INVALID_INPUT', 'Invite token must equal its id')
  }
  return {
    id: invite.id,
    kind: invite.kind,
    retreat_id: invite.retreatId,
    org_unit_id: invite.orgUnitId,
    disabled: toBooleanColumn(invite.disabled),
    created_at: invite.createdAt,
    created_by: invite.createdBy,
  }
}

export function inviteFromRow(row: InviteRow): Invite {
  return {
    id: row.id,
    token: row.id,
    kind: row.kind,
    retreatId: row.retreat_id,
    orgUnitId: row.org_unit_id,
    disabled: fromBooleanColumn(row.disabled),
    createdAt: row.created_at,
    createdBy: row.created_by,
  }
}
