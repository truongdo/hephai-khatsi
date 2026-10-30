import type { AuditActor } from '#/domain/auditLog'
import type { MemberTinhTrang } from '#/domain/memberTinhTrang'
import type { Member } from '#/domain/types'
import { memberRepo, type MemberStore } from '#/repositories/memberRepo'

export type SetMemberTinhTrangInput = {
  memberId: string
  tinhTrang: MemberTinhTrang | null
  audit: AuditActor
}

export async function setMemberTinhTrang(
  input: SetMemberTinhTrangInput,
  memberStore: MemberStore = memberRepo,
): Promise<Member> {
  return memberStore.setTinhTrang(input.memberId, input.tinhTrang, input.audit)
}
