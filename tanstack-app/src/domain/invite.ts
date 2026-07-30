import type { Invite, InviteKind } from './types'

export function retreatRegistrationInviteId(retreatId: string): string {
  return `retreat_${retreatId}`
}

export function parseInvite(id: string, data: Record<string, unknown>): Invite {
  const kind = (data.kind as InviteKind | undefined) ?? 'filler'
  return {
    id,
    token: String(data.token),
    createdAt: String(data.createdAt),
    createdBy: String(data.createdBy),
    kind,
    retreatId: kind === 'retreat_registration' ? String(data.retreatId ?? '') : null,
    orgUnitId: kind === 'retreat_registration' ? String(data.orgUnitId ?? '') : null,
    disabled: data.kind === undefined ? false : Boolean(data.disabled),
  }
}
