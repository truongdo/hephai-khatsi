import { DomainError } from '#/domain/errors'
import { normalizeCccd } from '#/domain/normalize'
import {
  putToPresignedUrl,
  requestMemberPhotoUploadUrl,
} from '#/photos/photosApiClient'
import { memberRepo, type MemberStore } from '#/repositories/memberRepo'

export type StoragePort = {
  put(
    memberId: string,
    cccd: string,
    bytes: Uint8Array,
    contentType: string,
    inviteToken?: string,
    idToken?: string,
  ): Promise<void>
}

export type UploadMemberPhotoInput = {
  memberId: string
  cccd: string
  bytes: Uint8Array
  contentType: string
  // Required for the public invite-claim flow; omitted for admin uploads.
  inviteToken?: string
  /** Admin Firebase ID token — required for locked-member uploads; sent as Bearer to the worker. */
  idToken?: string
}

export type UploadMemberPhotoResult = {
  photoPath: string
}

const clientStorage: StoragePort = {
  async put(memberId, cccd, bytes, contentType, inviteToken, idToken) {
    const { uploadUrl } = await requestMemberPhotoUploadUrl({
      memberId,
      cccd,
      contentType,
      inviteToken,
      idToken,
    })
    await putToPresignedUrl(uploadUrl, bytes, contentType)
  },
}

function memberPhotoPath(memberId: string): string {
  return `members/${memberId}/photo.jpg`
}

export async function uploadMemberPhoto(
  input: UploadMemberPhotoInput,
  memberStore: MemberStore = memberRepo,
  storage: StoragePort = clientStorage,
): Promise<UploadMemberPhotoResult> {
  const cccd = normalizeCccd(input.cccd)
  const member = await memberStore.getById(input.memberId)

  if (!member) {
    throw new DomainError('NOT_FOUND', 'Member not found')
  }

  if (member.cccd !== cccd) {
    throw new DomainError('FORBIDDEN', 'CCCD does not match member')
  }

  if (member.status === 'locked' && !input.idToken) {
    throw new DomainError('RECORD_LOCKED', 'Member is locked')
  }

  const photoPath = memberPhotoPath(input.memberId)
  await storage.put(
    input.memberId,
    cccd,
    input.bytes,
    input.contentType,
    input.inviteToken,
    input.idToken,
  )
  await memberStore.setPhotoPath(input.memberId, photoPath)

  return { photoPath }
}
