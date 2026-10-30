import { describe, expect, it } from 'vitest'
import type { Member } from '#/domain/types'
import { createMemoryMemberStore } from '#/test/memoryStores'
import { requestMemberEdit } from './requestMemberEdit'

function lockedMember(id: string): Member {
  return {
    id,
    orgUnitId: 'gd-i',
    sanghaType: 'tang',
    status: 'locked',
    cccd: '001099012345',
    inviteId: 'public',
    currentTempleId: null,
    photoPath: null,
    createdAt: '2026-07-19T00:00:00.000Z',
    updatedAt: '2026-07-19T00:00:00.000Z',
    lockedAt: '2026-07-19T00:00:00.000Z',
    lockedBy: 'filler',
    editRequestedAt: null,
    editRequestedBy: null,
  }
}

describe('requestMemberEdit', () => {
  it('requestMemberEdit sets phone', async () => {
    const store = createMemoryMemberStore()
    store.members.set('m1', lockedMember('m1'))

    const result = await requestMemberEdit(
      { memberId: 'm1', phone: '0901234567' },
      store,
    )

    expect(result.editRequestedBy).toBe('0901234567')
    expect(result.editRequestedAt).toBe('2026-07-19T00:00:00.000Z')
  })

  it('rejects when member is not locked', async () => {
    const store = createMemoryMemberStore()
    store.members.set('m1', { ...lockedMember('m1'), status: 'draft' })

    await expect(
      requestMemberEdit({ memberId: 'm1', phone: '0901234567' }, store),
    ).rejects.toMatchObject({ code: 'INVALID_STATUS' })
  })
})
