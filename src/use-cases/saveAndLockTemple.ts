import { buildManagerPhones, mergeManagerPhones } from '#/domain/templePhones'
import { DomainError } from '#/domain/errors'
import { normalizeVnPhone } from '#/domain/normalize'
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
  'editRequestedAt',
  'editRequestedBy',
] satisfies Array<keyof Temple>

function sanitizePatch(patch: TempleProfilePatch): TempleProfilePatch {
  const sanitized: Partial<Temple> = { ...patch }
  for (const key of protectedPatchKeys) {
    delete sanitized[key]
  }
  return sanitized as TempleProfilePatch
}

function fillerActorFromTempleInput(
  patch: TempleProfilePatch,
  explicitPhones: string[],
) {
  let actorId = 'filler'
  const phone = patch.truTriHienNay?.dienThoai ?? explicitPhones[0]
  if (phone) {
    try {
      actorId = normalizeVnPhone(phone)
    } catch {
      // keep default filler
    }
  }
  return { actorType: 'filler' as const, actorId }
}

export async function saveAndLockTemple(
  input: SaveTempleDraftInput,
  templeStore: TempleStore = templeRepo,
  inviteStore: InviteStore = inviteRepo,
): Promise<{ temple: Temple; mode: 'created' | 'updated' }> {
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

  return templeStore.createOrUpdateAndLock({
    orgUnitId: input.orgUnitId,
    inviteId: invite.id,
    managerPhones,
    templeId: input.templeId,
    patch,
    audit: fillerActorFromTempleInput(patch, input.explicitPhones ?? []),
  })
}
