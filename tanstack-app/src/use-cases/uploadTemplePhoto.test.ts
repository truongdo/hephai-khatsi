import { describe, expect, it } from 'vitest'
import { DomainError } from '#/domain/errors'
import type { Temple } from '#/domain/types'
import type { TempleStore } from '#/repositories/templeRepo'
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
    },
  }
  return { storage, calls }
}

function templeStoreWith(temples: Temple[]): TempleStore & {
  temples: Map<string, Temple>
} {
  const map = new Map(temples.map((t) => [t.id, t]))
  return {
    temples: map,
    async createOrUpdateDraft() {
      throw new Error('not implemented')
    },
    async getById(templeId: string) {
      return map.get(templeId) ?? null
    },
    async listByOrgAndPhone() {
      return []
    },
    async list() {
      return { items: [], nextCursor: null }
    },
    async lock() {
      throw new Error('not implemented')
    },
    async unlock() {
      throw new Error('not implemented')
    },
    async setPhotoPath(templeId: string, photoPath: string | null) {
      const existing = map.get(templeId)
      if (!existing) throw new DomainError('NOT_FOUND', 'Temple not found')
      const temple = {
        ...existing,
        photoPath,
        updatedAt: '2026-07-19T00:00:00.000Z',
      }
      map.set(templeId, temple)
      return temple
    },
    async deleteMany() {},
  }
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
    const store = templeStoreWith([draftTemple])
    const { storage, calls } = fakeStorage()
    const bytes = new Uint8Array([1, 2, 3])

    const result = await uploadTemplePhoto(
      {
        templeId: 'temple-1',
        bytes,
        contentType: 'image/jpeg',
        inviteToken: 'invite-1',
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
    expect(store.temples.get('temple-1')?.photoPath).toBe(
      'temples/temple-1/photo.jpg',
    )
  })

  it('allows filler upload for locked temples with inviteToken when photoPath is null', async () => {
    const store = templeStoreWith([
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
      },
      store,
      storage,
    )

    expect(result).toEqual({ photoPath: 'temples/temple-1/photo.jpg' })
    expect(calls[0]?.inviteToken).toBe('invite-1')
    expect(store.temples.get('temple-1')?.photoPath).toBe(
      'temples/temple-1/photo.jpg',
    )
  })

  it('rejects filler upload for locked temples that already have a photo', async () => {
    const store = templeStoreWith([
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
        },
        store,
        storage,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects locked upload without inviteToken or idToken', async () => {
    const store = templeStoreWith([
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
        },
        store,
        storage,
      ),
    ).rejects.toMatchObject({ code: 'RECORD_LOCKED' })
  })

  it('allows admin upload for locked temples and passes idToken to storage', async () => {
    const store = templeStoreWith([
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
      },
      store,
      storage,
    )

    expect(result).toEqual({ photoPath: 'temples/temple-1/photo.jpg' })
    expect(calls[0]?.idToken).toBe('admin-id-token')
    expect(store.temples.get('temple-1')?.photoPath).toBe(
      'temples/temple-1/photo.jpg',
    )
  })
})
