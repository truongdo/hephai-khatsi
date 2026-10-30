import { DomainError } from '#/domain/errors'
import type { AuditActor } from '#/domain/auditLog'
import {
  putToPresignedUrl,
  requestTemplePhotoUploadUrl,
} from '#/photos/photosApiClient'
import { templeRepo, type TempleStore } from '#/repositories/templeRepo'

export type TempleStoragePort = {
  put(
    templeId: string,
    bytes: Uint8Array,
    contentType: string,
    inviteToken?: string,
    idToken?: string,
  ): Promise<void>
}

export type UploadTemplePhotoInput = {
  templeId: string
  bytes: Uint8Array
  contentType: string
  inviteToken?: string
  /** Admin Firebase ID token — required for locked-temple uploads; sent as Bearer to the worker. */
  idToken?: string
  audit: AuditActor
}

export type UploadTemplePhotoResult = {
  photoPath: string
}

const clientStorage: TempleStoragePort = {
  async put(templeId, bytes, contentType, inviteToken, idToken) {
    const { uploadUrl } = await requestTemplePhotoUploadUrl({
      templeId,
      contentType,
      inviteToken,
      idToken,
    })
    await putToPresignedUrl(uploadUrl, bytes, contentType)
  },
}

function templePhotoPath(templeId: string): string {
  return `temples/${templeId}/photo.jpg`
}

export async function uploadTemplePhoto(
  input: UploadTemplePhotoInput,
  templeStore: TempleStore = templeRepo,
  storage: TempleStoragePort = clientStorage,
): Promise<UploadTemplePhotoResult> {
  const temple = await templeStore.getById(input.templeId)

  if (!temple) {
    throw new DomainError('NOT_FOUND', 'Temple not found')
  }

  if (
    temple.status === 'locked' &&
    !input.idToken &&
    !input.inviteToken?.trim()
  ) {
    throw new DomainError('RECORD_LOCKED', 'Temple is locked')
  }

  if (
    temple.status === 'locked' &&
    !input.idToken &&
    temple.photoPath
  ) {
    throw new DomainError('FORBIDDEN', 'Photo already set on locked temple')
  }

  const photoPath = templePhotoPath(input.templeId)
  await storage.put(
    input.templeId,
    input.bytes,
    input.contentType,
    input.inviteToken,
    input.idToken,
  )
  await templeStore.setPhotoPath(input.templeId, photoPath, input.audit)

  return { photoPath }
}
