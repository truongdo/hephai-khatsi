import { ref, uploadBytes } from 'firebase/storage'
import { DomainError } from '#/domain/errors'
import { normalizeCccd } from '#/domain/normalize'
import { getClientStorage } from '#/firebase/storage'
import { memberRepo, type MemberStore } from '#/repositories/memberRepo'

export type StoragePort = {
  put(
    path: string,
    bytes: Uint8Array,
    contentType: string,
    inviteToken?: string,
  ): Promise<void>
}

export type UploadMemberPhotoInput = {
  memberId: string
  cccd: string
  bytes: Uint8Array
  contentType: string
  // Required for the public invite-claim flow; omitted for admin uploads
  // (see firebase/storage.rules — admin bypasses this check).
  inviteToken?: string
}

export type UploadMemberPhotoResult = {
  photoPath: string
}

const clientStorage: StoragePort = {
  async put(path, bytes, contentType, inviteToken) {
    const storage = getClientStorage()
    if (!storage) throw new Error('Storage is not configured')
    await uploadBytes(ref(storage, path), bytes, {
      contentType,
      customMetadata: inviteToken ? { inviteToken } : undefined,
    })
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

  if (member.status === 'locked') {
    throw new DomainError('RECORD_LOCKED', 'Member is locked')
  }

  const photoPath = memberPhotoPath(input.memberId)
  await storage.put(photoPath, input.bytes, input.contentType, input.inviteToken)
  await memberStore.setPhotoPath(input.memberId, photoPath)

  return { photoPath }
}
