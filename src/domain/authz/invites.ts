import { retreatRegistrationInviteId } from '#/domain/invite'
import type { Invite } from '#/domain/types'
import { canWriteDirectory, type Caller } from './caller'
import { isString } from './docDiff'

// match /invites/{id}: get by id (the token) is public; invites are never
// updated or deleted.

export function canListInvites(caller: Caller): boolean {
  return canWriteDirectory(caller)
}

export function canCreateInvite(caller: Caller, invite: Invite): boolean {
  if (!canWriteDirectory(caller) || caller === null) return false
  if (!isString(invite.token) || invite.id !== invite.token) return false
  if (!isString(invite.createdAt) || invite.createdBy !== caller.uid) return false
  switch (invite.kind) {
    case 'filler':
      return true
    case 'retreat_registration':
      return (
        isString(invite.retreatId) &&
        isString(invite.orgUnitId) &&
        invite.id === retreatRegistrationInviteId(invite.retreatId)
      )
  }
}
