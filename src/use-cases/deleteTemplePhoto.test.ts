import { describe, expect, it } from 'vitest'
import { DomainError } from '#/domain/errors'
import type { Temple } from '#/domain/types'
import { FILLER_AUDIT } from '#/test/auditActors'
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
  it('clears photoPath', async () => {
    const store = createMemoryTempleStore([draftTemple])

    await deleteTemplePhoto(
      {
        templeId: 'temple-1',
        audit: FILLER_AUDIT,
      },
      store,
    )

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

    await expect(
      deleteTemplePhoto(
        {
          templeId: 'temple-1',
            audit: FILLER_AUDIT,
        },
        store,
      ),
    ).rejects.toMatchObject({ code: 'RECORD_LOCKED' } satisfies Partial<DomainError>)
    expect((await store.getById('temple-1'))?.photoPath).toBe(
      'temples/temple-1/photo.jpg',
    )
  })
})
