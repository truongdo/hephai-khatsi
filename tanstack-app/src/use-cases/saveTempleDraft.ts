import { buildManagerPhones, mergeManagerPhones } from '#/domain/templePhones'
import { DomainError } from '#/domain/errors'
import type { Temple } from '#/domain/types'
import { inviteRepo, type InviteStore } from '#/repositories/inviteRepo'
import {
  templeRepo,
  type TempleProfilePatch,
  type TempleStore,
} from '#/repositories/templeRepo'
import { getInviteByToken } from './getInviteByToken'

export type SaveTempleDraftInput = {
  token: string
  orgUnitId: string
  templeId?: string
  patch: TempleProfilePatch
  explicitPhones?: string[]
}

const protectedPatchKeys = [
  'id',
  'orgUnitId',
  'status',
  'managerPhones',
  'inviteId',
  'createdAt',
  'updatedAt',
  'lockedAt',
  'lockedBy',
] satisfies Array<keyof Temple>

function sanitizePatch(patch: TempleProfilePatch): TempleProfilePatch {
  const sanitized: Partial<Temple> = { ...patch }
  for (const key of protectedPatchKeys) {
    delete sanitized[key]
  }
  return sanitized as TempleProfilePatch
}

export async function saveTempleDraft(
  input: SaveTempleDraftInput,
  templeStore: TempleStore = templeRepo,
  inviteStore: InviteStore = inviteRepo,
): Promise<{ temple: Temple; mode: 'created' | 'updated' }> {
  // The invite only gates access to the form now (see PUBLIC_INVITE_ID) —
  // org unit is the visitor's own choice, not derived from it.
  const invite = await getInviteByToken(input.token, inviteStore)
  const patch = sanitizePatch(input.patch)
  const incomingPhones = {
    explicitPhones: input.explicitPhones ?? [],
    truTriPhone: patch.truTriHienNay?.dienThoai,
  }

  let managerPhones: string[]
  if (input.templeId) {
    const existing = await templeStore.getById(input.templeId)
    if (!existing) {
      throw new DomainError('NOT_FOUND', 'Temple not found')
    }
    managerPhones = mergeManagerPhones(existing.managerPhones, incomingPhones)
  } else {
    managerPhones = buildManagerPhones(incomingPhones)
  }

  return templeStore.createOrUpdateDraft({
    orgUnitId: input.orgUnitId,
    inviteId: invite.id,
    managerPhones,
    templeId: input.templeId,
    patch,
  })
}
