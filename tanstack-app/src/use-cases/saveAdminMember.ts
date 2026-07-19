import { DomainError } from '#/domain/errors'
import { normalizeCccd } from '#/domain/normalize'
import type { Member, SanghaType } from '#/domain/types'
import {
  memberRepo,
  type MemberProfilePatch,
  type MemberStore,
} from '#/repositories/memberRepo'

export type SaveAdminMemberCreateInput = {
  orgUnitId: string
  sanghaType: SanghaType
  cccd: string
  patch: MemberProfilePatch
}

export type SaveAdminMemberUpdateInput = {
  memberId: string
  orgUnitId: string
  sanghaType: SanghaType
  patch: MemberProfilePatch
}

export type SaveAdminMemberInput =
  | SaveAdminMemberCreateInput
  | SaveAdminMemberUpdateInput

export function isAdminMemberUpdate(
  input: SaveAdminMemberInput,
): input is SaveAdminMemberUpdateInput {
  return 'memberId' in input && typeof input.memberId === 'string'
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

function sanitizePatch(patch: MemberProfilePatch): MemberProfilePatch {
  const sanitized: Partial<Member> = { ...patch }
  for (const key of protectedPatchKeys) {
    delete sanitized[key]
  }
  return sanitized as MemberProfilePatch
}

export async function saveAdminMember(
  input: SaveAdminMemberInput,
  memberStore: MemberStore = memberRepo,
): Promise<{ member: Member; mode: 'created' | 'updated' }> {
  if (isAdminMemberUpdate(input)) {
    const existing = await memberStore.getById(input.memberId)
    if (!existing) {
      throw new DomainError('NOT_FOUND', 'Member not found')
    }
    if (
      existing.orgUnitId !== input.orgUnitId ||
      existing.sanghaType !== input.sanghaType
    ) {
      throw new DomainError(
        'FORBIDDEN',
        'Member does not belong to this org unit or sangha type',
      )
    }

    const member = await memberStore.updateDraftById(
      input.memberId,
      sanitizePatch(input.patch),
    )
    return { member, mode: 'updated' }
  }

  const cccd = normalizeCccd(input.cccd)
  return memberStore.createOrUpdateDraft({
    orgUnitId: input.orgUnitId,
    sanghaType: input.sanghaType,
    inviteId: null,
    cccd,
    patch: sanitizePatch(input.patch),
  })
}
