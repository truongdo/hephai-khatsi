import { DomainError } from '#/domain/errors'
import { normalizeCccd } from '#/domain/normalize'
import type { FormType, Invite, Member, SanghaType } from '#/domain/types'
import { inviteRepo, type InviteStore } from '#/repositories/inviteRepo'
import {
  memberRepo,
  type MemberProfilePatch,
  type MemberStore,
} from '#/repositories/memberRepo'
import { getInviteByToken } from './getInviteByToken'

export type SaveMemberDraftInput = {
  token: string
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
] satisfies Array<keyof Member>

export function sanghaTypeFromMemberInvite(formType: FormType): SanghaType {
  if (formType === 'member_tang') return 'tang'
  if (formType === 'member_ni') return 'ni'
  throw new DomainError('FORBIDDEN', 'Invite is not valid for member drafts')
}

export async function getMemberInviteContext(
  token: string,
  inviteStore: InviteStore = inviteRepo,
): Promise<{ invite: Invite; sanghaType: SanghaType }> {
  const invite = await getInviteByToken(token, inviteStore)
  return {
    invite,
    sanghaType: sanghaTypeFromMemberInvite(invite.formType),
  }
}

function sanitizePatch(patch: MemberProfilePatch): MemberProfilePatch {
  const sanitized: Partial<Member> = { ...patch }
  for (const key of protectedPatchKeys) {
    delete sanitized[key]
  }
  return sanitized as MemberProfilePatch
}

export async function saveMemberDraft(
  input: SaveMemberDraftInput,
  memberStore: MemberStore = memberRepo,
  inviteStore: InviteStore = inviteRepo,
): Promise<{ member: Member; mode: 'created' | 'updated' }> {
  const cccd = normalizeCccd(input.cccd)
  const { invite, sanghaType } = await getMemberInviteContext(
    input.token,
    inviteStore,
  )

  return memberStore.createOrUpdateDraft({
    orgUnitId: invite.orgUnitId,
    sanghaType,
    inviteId: invite.id,
    cccd,
    patch: sanitizePatch(input.patch),
  })
}
