import { describe, expect, it } from 'vitest'
import type { Temple } from '#/domain/types'
import { ADMIN_AUDIT, FILLER_AUDIT } from '#/test/auditActors'
import { createMemoryTempleStore } from '#/test/memoryStores'
import {
  uploadTemplePhoto,
  type TempleStoragePort,
} from './uploadTemplePhoto'

function fakeStorage() {
  const calls: Array<{
    templeId: string
    bytes: Uint8Array
    contentType: string
    inviteToken?: string
    idToken?: string
  }> = []
  const storage: TempleStoragePort = {
    async put(templeId, bytes, contentType, inviteToken, idToken) {
      calls.push({ templeId, bytes, contentType, inviteToken, idToken })
      return `temples/${templeId}/photo.jpg`
    },
  }
  return { storage, calls }
}


const draftTemple: Temple = {
  id: 'temple-1',
  orgUnitId: 'gd-i',
  status: 'draft',
  managerPhones: [],
  inviteId: 'invite-1',
  photoPath: null,
  createdAt: '2026-07-19T00:00:00.000Z',
  updatedAt: '2026-07-19T00:00:00.000Z',
  lockedAt: null,
  lockedBy: null,
  editRequestedAt: null,
  editRequestedBy: null,
}

describe('uploadTemplePhoto', () => {
  it('uploads a draft temple photo and updates photoPath', async () => {
    const store = createMemoryTempleStore([draftTemple])
    const { storage, calls } = fakeStorage()
    const bytes = new Uint8Array([1, 2, 3])

    const result = await uploadTemplePhoto(
      {
        templeId: 'temple-1',
        bytes,
        contentType: 'image/jpeg',
        inviteToken: 'invite-1',
        audit: FILLER_AUDIT,
      },
      store,
      storage,
    )

    expect(result).toEqual({ photoPath: 'temples/temple-1/photo.jpg' })
    expect(calls).toEqual([
      {
        templeId: 'temple-1',
        bytes,
        contentType: 'image/jpeg',
        inviteToken: 'invite-1',
        idToken: undefined,
      },
    ])
    expect((await store.getById('temple-1'))?.photoPath).toBe(
      'temples/temple-1/photo.jpg',
    )
  })

  it('allows filler upload for locked temples with inviteToken when photoPath is null', async () => {
    const store = createMemoryTempleStore([
      {
        ...draftTemple,
        status: 'locked',
        lockedAt: '2026-07-19T00:00:00.000Z',
        lockedBy: 'filler',
        photoPath: null,
      },
    ])
    const { storage, calls } = fakeStorage()

    const result = await uploadTemplePhoto(
      {
        templeId: 'temple-1',
        bytes: new Uint8Array([1]),
        contentType: 'image/jpeg',
        inviteToken: 'invite-1',
        audit: FILLER_AUDIT,
      },
      store,
      storage,
    )

    expect(result).toEqual({ photoPath: 'temples/temple-1/photo.jpg' })
    expect(calls[0]?.inviteToken).toBe('invite-1')
    expect((await store.getById('temple-1'))?.photoPath).toBe(
      'temples/temple-1/photo.jpg',
    )
  })

  it('rejects filler upload for locked temples that already have a photo', async () => {
    const store = createMemoryTempleStore([
      {
        ...draftTemple,
        status: 'locked',
        lockedAt: '2026-07-19T00:00:00.000Z',
        lockedBy: 'filler',
        photoPath: 'temples/temple-1/photo.jpg',
      },
    ])
    const { storage } = fakeStorage()

    await expect(
      uploadTemplePhoto(
        {
          templeId: 'temple-1',
          bytes: new Uint8Array([1]),
          contentType: 'image/jpeg',
          inviteToken: 'invite-1',
          audit: FILLER_AUDIT,
        },
        store,
        storage,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects locked upload without inviteToken or idToken', async () => {
    const store = createMemoryTempleStore([
      {
        ...draftTemple,
        status: 'locked',
        lockedAt: '2026-07-19T00:00:00.000Z',
        lockedBy: 'filler',
      },
    ])
    const { storage } = fakeStorage()

    await expect(
      uploadTemplePhoto(
        {
          templeId: 'temple-1',
          bytes: new Uint8Array([1]),
          contentType: 'image/jpeg',
          audit: FILLER_AUDIT,
        },
        store,
        storage,
      ),
    ).rejects.toMatchObject({ code: 'RECORD_LOCKED' })
  })

  it('allows admin upload for locked temples and passes idToken to storage', async () => {
    const store = createMemoryTempleStore([
      {
        ...draftTemple,
        status: 'locked',
        lockedAt: '2026-07-19T00:00:00.000Z',
        lockedBy: 'admin-1',
      },
    ])
    const { storage, calls } = fakeStorage()

    const result = await uploadTemplePhoto(
      {
        templeId: 'temple-1',
        bytes: new Uint8Array([1, 2]),
        contentType: 'image/png',
        idToken: 'admin-id-token',
        audit: ADMIN_AUDIT,
      },
      store,
      storage,
    )

    expect(result).toEqual({ photoPath: 'temples/temple-1/photo.jpg' })
    expect(calls[0]?.idToken).toBe('admin-id-token')
    expect((await store.getById('temple-1'))?.photoPath).toBe(
      'temples/temple-1/photo.jpg',
    )
  })
})
