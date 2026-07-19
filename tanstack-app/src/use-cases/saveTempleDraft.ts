import { buildManagerPhones, mergeManagerPhones } from '#/domain/templePhones'
import { DomainError } from '#/domain/errors'
import type { Invite, Temple } from '#/domain/types'
import { inviteRepo, type InviteStore } from '#/repositories/inviteRepo'
import {
  templeRepo,
  type TempleProfilePatch,
  type TempleStore,
} from '#/repositories/templeRepo'
import { getInviteByToken } from './getInviteByToken'

export type SaveTempleDraftInput = {
  token: string
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

export async function getTempleInviteContext(
  token: string,
  inviteStore: InviteStore = inviteRepo,
): Promise<{ invite: Invite }> {
  const invite = await getInviteByToken(token, inviteStore)
  if (invite.formType !== 'temple') {
    throw new DomainError('FORBIDDEN', 'Invite is not valid for temple drafts')
  }
  return { invite }
}

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
  const { invite } = await getTempleInviteContext(input.token, inviteStore)
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
    orgUnitId: invite.orgUnitId,
    inviteId: invite.id,
    managerPhones,
    templeId: input.templeId,
    patch,
  })
}
