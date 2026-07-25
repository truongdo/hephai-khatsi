import { DomainError } from '#/domain/errors'
import { deleteTemplePhotoObject } from '#/photos/photosApiClient'
import { templeRepo, type TempleStore } from '#/repositories/templeRepo'

export type DeleteTemplePhotoInput = {
  templeId: string
  inviteToken?: string
  idToken?: string
}

export async function deleteTemplePhoto(
  input: DeleteTemplePhotoInput,
  templeStore: TempleStore = templeRepo,
  deleteObject: typeof deleteTemplePhotoObject = deleteTemplePhotoObject,
): Promise<void> {
  const temple = await templeStore.getById(input.templeId)

  if (!temple) {
    throw new DomainError('NOT_FOUND', 'Temple not found')
  }

  if (temple.status === 'locked' && !input.idToken) {
    throw new DomainError('RECORD_LOCKED', 'Temple is locked')
  }

  await deleteObject({
    templeId: input.templeId,
    inviteToken: input.inviteToken,
    idToken: input.idToken,
  })
  await templeStore.setPhotoPath(input.templeId, null)
}
