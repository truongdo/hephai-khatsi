import { describe, expect, it, vi } from 'vitest'
import { DomainError } from '#/domain/errors'
import type { Member } from '#/domain/types'
import { createMemoryMemberStore } from '#/test/memoryStores'
import { FILLER_AUDIT } from '#/test/auditActors'
import { deleteMemberPhoto } from './deleteMemberPhoto'

const draftMember: Member = {
  id: 'member-1',
  orgUnitId: 'gd-i',
  sanghaType: 'tang',
  status: 'draft',
  cccd: '012345678901',
  inviteId: 'invite-1',
  currentTempleId: null,
  photoPath: 'members/member-1/photo.jpg',
  createdAt: '2026-07-19T00:00:00.000Z',
  updatedAt: '2026-07-19T00:00:00.000Z',
  lockedAt: null,
  lockedBy: null,
  editRequestedAt: null,
  editRequestedBy: null,
}

describe('deleteMemberPhoto', () => {
  it('deletes R2 object and clears photoPath', async () => {
    const store = createMemoryMemberStore([draftMember])
    const deleteObject = vi.fn(async () => undefined)

    await deleteMemberPhoto(
      {
        memberId: 'member-1',
        cccd: '012345678901',
        inviteToken: 'invite-1',
        audit: FILLER_AUDIT,
      },
      store,
      deleteObject,
    )

    expect(deleteObject).toHaveBeenCalledWith({
      memberId: 'member-1',
      cccd: '012345678901',
      inviteToken: 'invite-1',
      idToken: undefined,
    })
    expect((await store.getById('member-1'))?.photoPath).toBeNull()
  })

  it('rejects filler delete for locked members without idToken', async () => {
    const store = createMemoryMemberStore([
      {
        ...draftMember,
        status: 'locked',
        lockedAt: '2026-07-19T00:00:00.000Z',
        lockedBy: 'admin-1',
      },
    ])
    const deleteObject = vi.fn(async () => undefined)

    await expect(
      deleteMemberPhoto(
        {
          memberId: 'member-1',
          cccd: '012345678901',
          inviteToken: 'invite-1',
          audit: FILLER_AUDIT,
        },
        store,
        deleteObject,
      ),
    ).rejects.toMatchObject({ code: 'RECORD_LOCKED' } satisfies Partial<DomainError>)
    expect(deleteObject).not.toHaveBeenCalled()
  })
})
