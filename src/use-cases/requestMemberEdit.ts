import type { Member } from '#/domain/types'
import { memberRepo, type MemberStore } from '#/repositories/memberRepo'

export type RequestMemberEditInput = {
  memberId: string
  phone: string
}

export async function requestMemberEdit(
  input: RequestMemberEditInput,
  memberStore: MemberStore = memberRepo,
): Promise<Member> {
  return memberStore.requestEdit(input.memberId, input.phone)
}
