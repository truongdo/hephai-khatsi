import { canAccessOrgUnit, type AuthClaims } from '#/domain/authClaims'
import { DomainError } from '#/domain/errors'
import { memberRepo, type MemberStore } from '#/repositories/memberRepo'
import { deleteMemberDocumentsPrefix } from '#/photos/docsApiClient'
import { deleteMemberPhotoObject } from '#/photos/photosApiClient'

export async function deleteMembers(
  claims: AuthClaims,
  input: { ids: string[]; idToken: string },
  memberStore: MemberStore = memberRepo,
  deletePhoto: (memberId: string) => Promise<void> = (id) =>
    deleteMemberPhotoObject({ memberId: id, idToken: input.idToken }),
  deleteDocsPrefix: (memberId: string) => Promise<void> = (id) =>
    deleteMemberDocumentsPrefix({ memberId: id, idToken: input.idToken }),
): Promise<void> {
  for (const id of input.ids) {
    const member = await memberStore.getById(id)
    if (member && !canAccessOrgUnit(claims, member.orgUnitId)) {
      throw new DomainError('FORBIDDEN', 'Org unit out of scope')
    }
  }

  await memberStore.deleteMany(input.ids)
  await Promise.allSettled(
    input.ids.flatMap((id) => [deletePhoto(id), deleteDocsPrefix(id)]),
  )
}
