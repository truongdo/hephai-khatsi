import { describe, expect, it, vi } from 'vitest'
import type { Member } from '#/domain/types'
import { createMemoryMemberStore } from '#/test/memoryStores'
import { deleteMembers } from './deleteMembers'

function member(
  overrides: Partial<Member> & { id: string },
): Member {
  return {
    orgUnitId: 'gd-i',
    sanghaType: 'tang',
    status: 'draft',
    cccd: '123456789012',
    inviteId: null,
    currentTempleId: null,
    photoPath: null,
    createdAt: '2026-07-19T00:00:00.000Z',
    updatedAt: '2026-07-19T00:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    editRequestedAt: null,
    editRequestedBy: null,
    ...overrides,
  }
}

describe('deleteMembers', () => {
  it('deletes the given members', async () => {
    const store = createMemoryMemberStore([
      member({ id: 'm1' }),
      member({ id: 'm2' }),
    ])

    await deleteMembers({ ids: ['m1'], idToken: 'token' }, store)

    expect(await store.getById('m1')).toBeNull()
    expect(await store.getById('m2')).not.toBeNull()
  })

  it('passes all ids to deleteMany', async () => {
    const store = createMemoryMemberStore([
      member({ id: 'm1' }),
      member({ id: 'm2' }),
      member({ id: 'm3' }),
    ])

    await deleteMembers({ ids: ['m1', 'm3'], idToken: 'token' }, store)

    expect(await store.getById('m1')).toBeNull()
    expect(await store.getById('m2')).not.toBeNull()
    expect(await store.getById('m3')).toBeNull()
  })

  it('calls photo deleter for each member id after store delete', async () => {
    const store = createMemoryMemberStore([member({ id: 'm1' }), member({ id: 'm2' })])
    const deletePhoto = vi.fn().mockResolvedValue(undefined)

    await deleteMembers(
      { ids: ['m1', 'm2'], idToken: 'admin-token' },
      store,
      deletePhoto,
    )

    expect(deletePhoto).toHaveBeenCalledTimes(2)
    expect(deletePhoto).toHaveBeenCalledWith('m1')
    expect(deletePhoto).toHaveBeenCalledWith('m2')
  })

  it('does not throw when photo delete fails (best-effort)', async () => {
    const store = createMemoryMemberStore([member({ id: 'm1' })])
    const deletePhoto = vi.fn().mockRejectedValue(new Error('R2 delete failed'))
    const deleteDocsPrefix = vi.fn().mockResolvedValue(undefined)

    await expect(
      deleteMembers(
        { ids: ['m1'], idToken: 'token' },
        store,
        deletePhoto,
        deleteDocsPrefix,
      ),
    ).resolves.toBeUndefined()

    expect(await store.getById('m1')).toBeNull()
    expect(deletePhoto).toHaveBeenCalledWith('m1')
  })

  it('calls docs prefix deleter for each member id after store delete', async () => {
    const store = createMemoryMemberStore([member({ id: 'm1' }), member({ id: 'm2' })])
    const deletePhoto = vi.fn().mockResolvedValue(undefined)
    const deleteDocsPrefix = vi.fn().mockResolvedValue(undefined)

    await deleteMembers(
      { ids: ['m1', 'm2'], idToken: 'admin-token' },
      store,
      deletePhoto,
      deleteDocsPrefix,
    )

    expect(deleteDocsPrefix).toHaveBeenCalledTimes(2)
    expect(deleteDocsPrefix).toHaveBeenCalledWith('m1')
    expect(deleteDocsPrefix).toHaveBeenCalledWith('m2')
  })

  it('does not throw when docs prefix delete fails (best-effort)', async () => {
    const store = createMemoryMemberStore([member({ id: 'm1' })])
    const deletePhoto = vi.fn().mockResolvedValue(undefined)
    const deleteDocsPrefix = vi.fn().mockRejectedValue(new Error('R2 prefix delete failed'))

    await expect(
      deleteMembers(
        { ids: ['m1'], idToken: 'token' },
        store,
        deletePhoto,
        deleteDocsPrefix,
      ),
    ).resolves.toBeUndefined()

    expect(await store.getById('m1')).toBeNull()
    expect(deleteDocsPrefix).toHaveBeenCalledWith('m1')
  })
})
