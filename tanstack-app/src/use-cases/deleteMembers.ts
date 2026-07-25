import { memberRepo, type MemberStore } from '#/repositories/memberRepo'

export async function deleteMembers(
  input: { ids: string[] },
  memberStore: MemberStore = memberRepo,
): Promise<void> {
  await memberStore.deleteMany(input.ids)
}
