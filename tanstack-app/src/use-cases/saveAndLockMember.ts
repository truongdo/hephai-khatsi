import { normalizeCccd } from '#/domain/normalize'
import type { SanghaType } from '#/domain/types'
import type { Member } from '#/domain/types'
import { inviteRepo, type InviteStore } from '#/repositories/inviteRepo'
import {
  memberRepo,
  type MemberProfilePatch,
  type MemberStore,
} from '#/repositories/memberRepo'
import { getInviteByToken } from './getInviteByToken'

export type SaveMemberDraftInput = {
  token: string
  orgUnitId: string
  sanghaType: SanghaType
  cccd: string
  patch: MemberProfilePatch
}

const protectedPatchKeys = [
  'id',
  'orgUnitId',
  'sanghaType',
  'status',
  'cccd',
  'inviteId',
  'createdAt',
  'updatedAt',
  'lockedAt',
  'lockedBy',
  'editRequestedAt',
  'editRequestedBy',
] satisfies Array<keyof Member>

function sanitizePatch(patch: MemberProfilePatch): MemberProfilePatch {
  const sanitized: Partial<Member> = { ...patch }
  for (const key of protectedPatchKeys) {
    delete sanitized[key]
  }
  return sanitized as MemberProfilePatch
}

export async function saveAndLockMember(
  input: SaveMemberDraftInput,
  memberStore: MemberStore = memberRepo,
  inviteStore: InviteStore = inviteRepo,
): Promise<{ member: Member; mode: 'created' | 'updated' }> {
  const cccd = normalizeCccd(input.cccd)
  const invite = await getInviteByToken(input.token, inviteStore)

  return memberStore.createOrUpdateAndLock({
    orgUnitId: input.orgUnitId,
    sanghaType: input.sanghaType,
    inviteId: invite.id,
    cccd,
    patch: sanitizePatch(input.patch),
  })
}
