import { DomainError } from '#/domain/errors'
import { normalizeCccd } from '#/domain/normalize'
import { getAdminStorage } from '#/firebase/admin'
import { memberRepo, type MemberStore } from '#/repositories/memberRepo'

export type StoragePort = {
  put(path: string, bytes: Uint8Array, contentType: string): Promise<void>
}

export type UploadMemberPhotoInput = {
  memberId: string
  cccd: string
  bytes: Uint8Array
  contentType: string
}

export type UploadMemberPhotoResult = {
  photoPath: string
}

const adminStorage: StoragePort = {
  async put(path, bytes, contentType) {
    const bucket = getAdminStorage().bucket()
    await bucket.file(path).save(bytes, { contentType })
  },
}

function memberPhotoPath(memberId: string): string {
  return `members/${memberId}/photo.jpg`
}

export async function uploadMemberPhoto(
  input: UploadMemberPhotoInput,
  memberStore: MemberStore = memberRepo,
  storage: StoragePort = adminStorage,
): Promise<UploadMemberPhotoResult> {
  const cccd = normalizeCccd(input.cccd)
  const member = await memberStore.getById(input.memberId)

  if (!member) {
    throw new DomainError('NOT_FOUND', 'Member not found')
  }

  if (member.cccd !== cccd) {
    throw new DomainError('FORBIDDEN', 'CCCD does not match member')
  }

  if (member.status === 'locked') {
    throw new DomainError('RECORD_LOCKED', 'Member is locked')
  }

  const photoPath = memberPhotoPath(input.memberId)
  await storage.put(photoPath, input.bytes, input.contentType)
  await memberStore.setPhotoPath(input.memberId, photoPath)

  return { photoPath }
}
