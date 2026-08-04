import { describe, expect, it, vi } from 'vitest'
import { DomainError } from '#/domain/errors'
import type { Temple } from '#/domain/types'
import { createMemoryTempleStore } from '#/test/memoryStores'
import { deleteTemplePhoto } from './deleteTemplePhoto'

const draftTemple: Temple = {
  id: 'temple-1',
  orgUnitId: 'gd-i',
  status: 'draft',
  managerPhones: [],
  inviteId: 'invite-1',
  photoPath: 'temples/temple-1/photo.jpg',
  createdAt: '2026-07-19T00:00:00.000Z',
  updatedAt: '2026-07-19T00:00:00.000Z',
  lockedAt: null,
  lockedBy: null,
  editRequestedAt: null,
  editRequestedBy: null,
}

describe('deleteTemplePhoto', () => {
  it('deletes R2 object and clears photoPath', async () => {
    const store = createMemoryTempleStore([draftTemple])
    const deleteObject = vi.fn(async () => undefined)

    await deleteTemplePhoto(
      {
        templeId: 'temple-1',
        inviteToken: 'invite-1',
      },
      store,
      deleteObject,
    )

    expect(deleteObject).toHaveBeenCalledWith({
      templeId: 'temple-1',
      inviteToken: 'invite-1',
      idToken: undefined,
    })
    expect((await store.getById('temple-1'))?.photoPath).toBeNull()
  })

  it('rejects filler delete for locked temples without idToken', async () => {
    const store = createMemoryTempleStore([
      {
        ...draftTemple,
        status: 'locked',
        lockedAt: '2026-07-19T00:00:00.000Z',
        lockedBy: 'admin-1',
      },
    ])
    const deleteObject = vi.fn(async () => undefined)

    await expect(
      deleteTemplePhoto(
        {
          templeId: 'temple-1',
          inviteToken: 'invite-1',
        },
        store,
        deleteObject,
      ),
    ).rejects.toMatchObject({ code: 'RECORD_LOCKED' } satisfies Partial<DomainError>)
    expect(deleteObject).not.toHaveBeenCalled()
  })
})
