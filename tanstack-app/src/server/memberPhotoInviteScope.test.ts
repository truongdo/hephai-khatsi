import { describe, expect, it } from 'vitest'
import { DomainError } from '#/domain/errors'
import type { Invite, Member } from '#/domain/types'
import { assertMemberPhotoInviteScope } from './memberPhotoInviteScope'

const baseMember: Member = {
  id: 'member-1',
  orgUnitId: 'gd-i',
  sanghaType: 'tang',
  status: 'draft',
  cccd: '012345678901',
  inviteId: 'invite-1',
  currentTempleId: null,
  photoPath: null,
  createdAt: '2026-07-19T00:00:00.000Z',
  updatedAt: '2026-07-19T00:00:00.000Z',
  lockedAt: null,
  lockedBy: null,
}

const baseInvite: Invite = {
  id: 'invite-1',
  token: 'token-1',
  orgUnitId: 'gd-i',
  formType: 'member_tang',
  createdAt: '2026-07-19T00:00:00.000Z',
  createdBy: 'admin-1',
}

describe('assertMemberPhotoInviteScope', () => {
  it('allows matching member_tang invite and member', () => {
    expect(() =>
      assertMemberPhotoInviteScope(baseInvite, baseMember),
    ).not.toThrow()
  })

  it('allows matching member_ni invite and member', () => {
    expect(() =>
      assertMemberPhotoInviteScope(
        { ...baseInvite, formType: 'member_ni' },
        { ...baseMember, sanghaType: 'ni' },
      ),
    ).not.toThrow()
  })

  it('rejects temple invites', () => {
    expect(() =>
      assertMemberPhotoInviteScope(
        { ...baseInvite, formType: 'temple' },
        baseMember,
      ),
    ).toThrow(
      new DomainError('FORBIDDEN', 'Invite is not valid for member drafts'),
    )
  })

  it('rejects mismatched org unit', () => {
    expect(() =>
      assertMemberPhotoInviteScope(
        { ...baseInvite, orgUnitId: 'gd-ii' },
        baseMember,
      ),
    ).toThrow(
      new DomainError('FORBIDDEN', 'Member does not belong to invite org unit'),
    )
  })

  it('rejects mismatched sangha type', () => {
    expect(() =>
      assertMemberPhotoInviteScope(
        { ...baseInvite, formType: 'member_ni' },
        baseMember,
      ),
    ).toThrow(
      new DomainError('FORBIDDEN', 'Member sangha type does not match invite'),
    )
  })
})
