import type { AuditActor } from '#/domain/auditLog'
import type { Member } from '#/domain/types'
import { memberRepo, type MemberStore } from '#/repositories/memberRepo'

export type UnlockMemberInput = { memberId: string; audit: AuditActor }

export async function unlockMember(
  input: UnlockMemberInput,
  memberStore: MemberStore = memberRepo,
): Promise<Member> {
  return memberStore.unlock(input.memberId, input.audit)
}
