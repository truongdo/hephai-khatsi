import type { AuditActor } from '#/domain/auditLog'
import type { Temple } from '#/domain/types'
import type { AdminListPage, ListTemplesAdminInput, ListTemplesExportInput } from '#/repositories/adminListTypes'
import { d1TempleRepo } from '#/repositories/d1/templeRepo'

export type TempleProfilePatch = Partial<
  Omit<
    Temple,
    | 'id'
    | 'orgUnitId'
    | 'status'
    | 'managerPhones'
    | 'inviteId'
    | 'createdAt'
    | 'updatedAt'
    | 'lockedAt'
    | 'lockedBy'
    | 'listCityName'
    | 'orgUnitName'
  >
>

export type CreateOrUpdateTempleDraftInput = {
  orgUnitId: string
  inviteId: string | null
  managerPhones: string[]
  templeId?: string
  patch: TempleProfilePatch
  allowWhenLocked?: boolean
  allowOrgUnitChange?: boolean
  audit?: AuditActor
}

export type CreateOrUpdateTempleAndLockInput = CreateOrUpdateTempleDraftInput & {
  audit: AuditActor
}

export type TemplePhoneLookupInput = {
  orgUnitId: string
  phone: string
  /** The filler's invite; required unless the caller is staff. */
  inviteToken?: string
}

export type TempleStore = {
  createOrUpdateDraft(
    input: CreateOrUpdateTempleDraftInput,
  ): Promise<{ temple: Temple; mode: 'created' | 'updated' }>
  createOrUpdateAndLock(
    input: CreateOrUpdateTempleAndLockInput,
  ): Promise<{ temple: Temple; mode: 'created' | 'updated' }>
  requestEdit(templeId: string, phone: string): Promise<Temple>
  getById(templeId: string): Promise<Temple | null>
  listByOrgAndPhone(input: TemplePhoneLookupInput): Promise<Temple[]>
  list(input: ListTemplesAdminInput): Promise<AdminListPage<Temple>>
  listAllForExport(input: ListTemplesExportInput): Promise<Temple[]>
  lock(templeId: string, lockedBy: string, audit: AuditActor): Promise<Temple>
  unlock(templeId: string, audit: AuditActor): Promise<Temple>
  setPhotoPath(
    templeId: string,
    photoPath: string | null,
    audit: AuditActor,
  ): Promise<Temple>
  deleteMany(ids: string[]): Promise<void>
}

export const templeRepo: TempleStore = d1TempleRepo
