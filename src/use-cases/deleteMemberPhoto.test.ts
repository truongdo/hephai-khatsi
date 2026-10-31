import { describe, expect, it } from 'vitest'
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
  it('clears photoPath', async () => {
    const store = createMemoryMemberStore([draftMember])

    await deleteMemberPhoto(
      {
        memberId: 'member-1',
        cccd: '012345678901',
        audit: FILLER_AUDIT,
      },
      store,
    )

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

    await expect(
      deleteMemberPhoto(
        {
          memberId: 'member-1',
          cccd: '012345678901',
            audit: FILLER_AUDIT,
        },
        store,
      ),
    ).rejects.toMatchObject({ code: 'RECORD_LOCKED' } satisfies Partial<DomainError>)
    expect((await store.getById('member-1'))?.photoPath).toBe(
      'members/member-1/photo.jpg',
    )
  })
})
