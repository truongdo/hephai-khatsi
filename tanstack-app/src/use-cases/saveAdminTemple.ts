import {
  canAccessOrgUnit,
  isHePhaiAdmin,
  type AuthClaims,
} from '#/domain/authClaims'
import { buildManagerPhones, mergeManagerPhones } from '#/domain/templePhones'
import { DomainError } from '#/domain/errors'
import type { AuditActor } from '#/domain/auditLog'
import type { Temple } from '#/domain/types'
import {
  templeRepo,
  type TempleProfilePatch,
  type TempleStore,
} from '#/repositories/templeRepo'

export type SaveAdminTempleInput = {
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

export async function saveAdminTemple(
  input: SaveAdminTempleInput,
  audit: AuditActor,
  claims: AuthClaims,
  templeStore: TempleStore = templeRepo,
): Promise<{ temple: Temple; mode: 'created' | 'updated' }> {
  if (!canAccessOrgUnit(claims, input.orgUnitId)) {
    throw new DomainError('FORBIDDEN', 'Org unit out of scope')
  }

  const patch = sanitizePatch(input.patch)
  const incomingPhones = {
    explicitPhones: input.explicitPhones ?? [],
    truTriPhone: patch.truTriHienNay?.dienThoai,
  }

  let managerPhones: string[]
  let allowOrgUnitChange = false

  if (input.templeId) {
    const existing = await templeStore.getById(input.templeId)
    if (!existing) {
      throw new DomainError('NOT_FOUND', 'Temple not found')
    }

    const orgChanged = existing.orgUnitId !== input.orgUnitId
    if (orgChanged) {
      if (!isHePhaiAdmin(claims) || existing.status !== 'draft') {
        throw new DomainError('FORBIDDEN', 'Cannot change temple org unit')
      }
      allowOrgUnitChange = true
    }

    managerPhones = mergeManagerPhones(existing.managerPhones, incomingPhones)
  } else {
    managerPhones = buildManagerPhones(incomingPhones)
  }

  return templeStore.createOrUpdateDraft({
    orgUnitId: input.orgUnitId,
    inviteId: null,
    managerPhones,
    templeId: input.templeId,
    patch,
    allowWhenLocked: true,
    allowOrgUnitChange,
    audit,
  })
}
