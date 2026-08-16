import {
  canAccessOrgUnit,
  isHePhaiAdmin,
  type AuthClaims,
} from '#/domain/authClaims'
import { DomainError } from '#/domain/errors'
import type { AuditActor } from '#/domain/auditLog'
import { normalizeEmail } from '#/domain/gmail'
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
  'directoryRole',
  'directoryAuthUid',
  'directoryRoleGrantedAt',
  'directoryRoleGrantedBy',
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
  audit: AuditActor,
  claims: AuthClaims,
  memberStore: MemberStore = memberRepo,
): Promise<{ member: Member; mode: 'created' | 'updated' }> {
  if (!canAccessOrgUnit(claims, input.orgUnitId)) {
    throw new DomainError('FORBIDDEN', 'Org unit out of scope')
  }

  if (isAdminMemberUpdate(input)) {
    const existing = await memberStore.getById(input.memberId)
    if (!existing) {
      throw new DomainError('NOT_FOUND', 'Member not found')
    }
    if (existing.sanghaType !== input.sanghaType) {
      throw new DomainError(
        'FORBIDDEN',
        'Member does not belong to this org unit or sangha type',
      )
    }

    const orgChanged = existing.orgUnitId !== input.orgUnitId
    if (orgChanged) {
      if (!isHePhaiAdmin(claims) || existing.status !== 'draft') {
        throw new DomainError('FORBIDDEN', 'Cannot change member org unit')
      }
      if (existing.directoryRole) {
        throw new DomainError(
          'FORBIDDEN',
          'Revoke Thư ký before changing org unit',
        )
      }
    }

    if (
      existing.directoryRole &&
      input.patch.email !== undefined &&
      normalizeEmail(input.patch.email) !== normalizeEmail(existing.email ?? '')
    ) {
      throw new DomainError(
        'FORBIDDEN',
        'Revoke Thư ký before changing email',
      )
    }

    const member = await memberStore.updateDraftById(
      input.memberId,
      sanitizePatch(input.patch),
      {
        allowWhenLocked: true,
        allowOrgUnitChange: orgChanged,
        orgUnitId: input.orgUnitId,
        audit,
      },
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
    audit,
  })
}
