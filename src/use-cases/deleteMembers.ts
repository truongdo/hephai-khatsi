import { canAccessOrgUnit, type AuthClaims } from '#/domain/authClaims'
import { DomainError } from '#/domain/errors'
import { memberRepo, type MemberStore } from '#/repositories/memberRepo'

export async function deleteMembers(
  claims: AuthClaims,
  input: { ids: string[] },
  memberStore: MemberStore = memberRepo,
): Promise<void> {
  for (const id of input.ids) {
    const member = await memberStore.getById(id)
    if (member && !canAccessOrgUnit(claims, member.orgUnitId)) {
      throw new DomainError('FORBIDDEN', 'Org unit out of scope')
    }
  }

  // The data API deletes the members' photos and documents with them.
  await memberStore.deleteMany(input.ids)
}
