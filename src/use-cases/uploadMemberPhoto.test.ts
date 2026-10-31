import { describe, expect, it } from 'vitest'
import type { Member } from '#/domain/types'
import { ADMIN_AUDIT, FILLER_AUDIT } from '#/test/auditActors'
import { createMemoryMemberStore } from '#/test/memoryStores'
import {
  uploadMemberPhoto,
  type StoragePort,
} from './uploadMemberPhoto'

function fakeStorage() {
  const calls: Array<{
    memberId: string
    cccd: string
    bytes: Uint8Array
    contentType: string
    inviteToken?: string
    idToken?: string
  }> = []
  const storage: StoragePort = {
    async put(memberId, cccd, bytes, contentType, inviteToken, idToken) {
      calls.push({ memberId, cccd, bytes, contentType, inviteToken, idToken })
      return `members/${memberId}/photo.jpg`
    },
  }
  return { storage, calls }
}


const draftMember: Member = {
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
  editRequestedAt: null,
  editRequestedBy: null,
}

describe('uploadMemberPhoto', () => {
  it('uploads a draft member photo and updates photoPath', async () => {
    const store = createMemoryMemberStore([draftMember])
    const { storage, calls } = fakeStorage()
    const bytes = new Uint8Array([1, 2, 3])

    const result = await uploadMemberPhoto(
      {
        memberId: 'member-1',
        cccd: '0123 456 78901',
        bytes,
        contentType: 'image/jpeg',
        inviteToken: 'invite-1',
        audit: FILLER_AUDIT,
      },
      store,
      storage,
    )

    expect(result).toEqual({ photoPath: 'members/member-1/photo.jpg' })
    expect(calls).toEqual([
      {
        memberId: 'member-1',
        cccd: '012345678901',
        bytes,
        contentType: 'image/jpeg',
        inviteToken: 'invite-1',
        idToken: undefined,
      },
    ])
    expect((await store.getById('member-1'))?.photoPath).toBe(
      'members/member-1/photo.jpg',
    )
  })

  it('allows filler upload for locked members with inviteToken when photoPath is null', async () => {
    const store = createMemoryMemberStore([
      {
        ...draftMember,
        status: 'locked',
        lockedAt: '2026-07-19T00:00:00.000Z',
        lockedBy: 'filler',
        photoPath: null,
      },
    ])
    const { storage, calls } = fakeStorage()

    const result = await uploadMemberPhoto(
      {
        memberId: 'member-1',
        cccd: '012345678901',
        bytes: new Uint8Array([1]),
        contentType: 'image/jpeg',
        inviteToken: 'invite-1',
        audit: FILLER_AUDIT,
      },
      store,
      storage,
    )

    expect(result).toEqual({ photoPath: 'members/member-1/photo.jpg' })
    expect(calls[0]?.inviteToken).toBe('invite-1')
    expect((await store.getById('member-1'))?.photoPath).toBe(
      'members/member-1/photo.jpg',
    )
  })

  it('rejects filler upload for locked members that already have a photo', async () => {
    const store = createMemoryMemberStore([
      {
        ...draftMember,
        status: 'locked',
        lockedAt: '2026-07-19T00:00:00.000Z',
        lockedBy: 'filler',
        photoPath: 'members/member-1/photo.jpg',
      },
    ])
    const { storage } = fakeStorage()

    await expect(
      uploadMemberPhoto(
        {
          memberId: 'member-1',
          cccd: '012345678901',
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
    const store = createMemoryMemberStore([
      {
        ...draftMember,
        status: 'locked',
        lockedAt: '2026-07-19T00:00:00.000Z',
        lockedBy: 'filler',
      },
    ])
    const { storage } = fakeStorage()

    await expect(
      uploadMemberPhoto(
        {
          memberId: 'member-1',
          cccd: '012345678901',
          bytes: new Uint8Array([1]),
          contentType: 'image/jpeg',
          audit: FILLER_AUDIT,
        },
        store,
        storage,
      ),
    ).rejects.toMatchObject({ code: 'RECORD_LOCKED' })
  })

  it('allows admin upload for locked members and passes idToken to storage', async () => {
    const store = createMemoryMemberStore([
      {
        ...draftMember,
        status: 'locked',
        lockedAt: '2026-07-19T00:00:00.000Z',
        lockedBy: 'admin-1',
      },
    ])
    const { storage, calls } = fakeStorage()

    const result = await uploadMemberPhoto(
      {
        memberId: 'member-1',
        cccd: '012345678901',
        bytes: new Uint8Array([1, 2]),
        contentType: 'image/png',
        idToken: 'admin-id-token',
        audit: ADMIN_AUDIT,
      },
      store,
      storage,
    )

    expect(result).toEqual({ photoPath: 'members/member-1/photo.jpg' })
    expect(calls[0]?.idToken).toBe('admin-id-token')
    expect((await store.getById('member-1'))?.photoPath).toBe(
      'members/member-1/photo.jpg',
    )
  })

  it('rejects when CCCD does not match the member', async () => {
    const store = createMemoryMemberStore([draftMember])
    const { storage } = fakeStorage()

    await expect(
      uploadMemberPhoto(
        {
          memberId: 'member-1',
          cccd: '9999888777',
          bytes: new Uint8Array([1]),
          contentType: 'image/jpeg',
          audit: FILLER_AUDIT,
        },
        store,
        storage,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
