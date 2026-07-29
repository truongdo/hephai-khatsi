import { memberRepo, type MemberStore } from '#/repositories/memberRepo'
import { deleteMemberDocumentsPrefix } from '#/photos/docsApiClient'
import { deleteMemberPhotoObject } from '#/photos/photosApiClient'

export async function deleteMembers(
  input: { ids: string[]; idToken: string },
  memberStore: MemberStore = memberRepo,
  deletePhoto: (memberId: string) => Promise<void> = (id) =>
    deleteMemberPhotoObject({ memberId: id, idToken: input.idToken }),
  deleteDocsPrefix: (memberId: string) => Promise<void> = (id) =>
    deleteMemberDocumentsPrefix({ memberId: id, idToken: input.idToken }),
): Promise<void> {
  await memberStore.deleteMany(input.ids)
  await Promise.allSettled(
    input.ids.flatMap((id) => [deletePhoto(id), deleteDocsPrefix(id)]),
  )
}
