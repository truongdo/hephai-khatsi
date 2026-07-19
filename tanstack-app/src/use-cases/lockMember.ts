import type { Member } from '#/domain/types'
import { memberRepo, type MemberStore } from '#/repositories/memberRepo'

export type LockMemberInput = {
  memberId: string
  lockedBy: string
}

export async function lockMember(
  input: LockMemberInput,
  memberStore: MemberStore = memberRepo,
): Promise<Member> {
  return memberStore.lock(input.memberId, input.lockedBy)
}
