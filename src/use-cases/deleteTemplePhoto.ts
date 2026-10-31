import { DomainError } from '#/domain/errors'
import type { AuditActor } from '#/domain/auditLog'
import { templeRepo, type TempleStore } from '#/repositories/templeRepo'

export type DeleteTemplePhotoInput = {
  templeId: string
  /** Staff only: a filler cannot remove the photo of a locked temple. */
  idToken?: string
  audit: AuditActor
}

export async function deleteTemplePhoto(
  input: DeleteTemplePhotoInput,
  templeStore: TempleStore = templeRepo,
): Promise<void> {
  const temple = await templeStore.getById(input.templeId)

  if (!temple) {
    throw new DomainError('NOT_FOUND', 'Temple not found')
  }

  if (temple.status === 'locked' && !input.idToken) {
    throw new DomainError('RECORD_LOCKED', 'Temple is locked')
  }

  // The data API deletes the photo it drops.
  await templeStore.setPhotoPath(input.templeId, null, input.audit)
}
