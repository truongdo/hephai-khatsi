import { describe, expect, it } from 'vitest'
import { DomainError } from '#/domain/errors'
import type { Member } from '#/domain/types'
import type { MemberStore } from '#/repositories/memberRepo'
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
    },
  }
  return { storage, calls }
}

function memberStoreWith(members: Member[]): MemberStore & {
  members: Map<string, Member>
} {
  const map = new Map(members.map((member) => [member.id, member]))
  return {
    members: map,
    async createOrUpdateDraft() {
      throw new Error('not implemented')
    },
    async updateDraftById() {
      throw new Error('not implemented')
    },
    async getByCccd() {
      return null
    },
    async listByOrgSanghaAndPhone() {
      return []
    },
    async lock() {
      throw new Error('not implemented')
    },
    async unlock() {
      throw new Error('not implemented')
    },
    async getById(memberId: string) {
      return map.get(memberId) ?? null
    },
    async setPhotoPath(memberId: string, photoPath: string | null) {
      const existing = map.get(memberId)
      if (!existing) throw new DomainError('NOT_FOUND', 'Member not found')
      const member = {
        ...existing,
        photoPath,
        updatedAt: '2026-07-19T00:00:00.000Z',
      }
      map.set(memberId, member)
      return member
    },
    async setDocumentPaths(memberId: string, documents) {
      const existing = map.get(memberId)
      if (!existing) throw new DomainError('NOT_FOUND', 'Member not found')
      const member = {
        ...existing,
        documents,
        updatedAt: '2026-07-19T00:00:00.000Z',
      }
      map.set(memberId, member)
      return member
    },
    async list() {
      return { items: [], nextCursor: null }
    },
    async listAllForExport() {
      return []
    },
    async listByCurrentTempleIds() {
      return []
    },
    async deleteMany() {},
    async mergeDocumentSide() {
      throw new Error('not implemented')
    },
    async removeDocumentPaths() {
      throw new Error('not implemented')
    },
  }
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
    const store = memberStoreWith([draftMember])
    const { storage, calls } = fakeStorage()
    const bytes = new Uint8Array([1, 2, 3])

    const result = await uploadMemberPhoto(
      {
        memberId: 'member-1',
        cccd: '0123 456 78901',
        bytes,
        contentType: 'image/jpeg',
        inviteToken: 'invite-1',
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
    expect(store.members.get('member-1')?.photoPath).toBe(
      'members/member-1/photo.jpg',
    )
  })

  it('allows filler upload for locked members with inviteToken when photoPath is null', async () => {
    const store = memberStoreWith([
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
      },
      store,
      storage,
    )

    expect(result).toEqual({ photoPath: 'members/member-1/photo.jpg' })
    expect(calls[0]?.inviteToken).toBe('invite-1')
    expect(store.members.get('member-1')?.photoPath).toBe(
      'members/member-1/photo.jpg',
    )
  })

  it('rejects filler upload for locked members that already have a photo', async () => {
    const store = memberStoreWith([
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
        },
        store,
        storage,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects locked upload without inviteToken or idToken', async () => {
    const store = memberStoreWith([
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
        },
        store,
        storage,
      ),
    ).rejects.toMatchObject({ code: 'RECORD_LOCKED' })
  })

  it('allows admin upload for locked members and passes idToken to storage', async () => {
    const store = memberStoreWith([
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
      },
      store,
      storage,
    )

    expect(result).toEqual({ photoPath: 'members/member-1/photo.jpg' })
    expect(calls[0]?.idToken).toBe('admin-id-token')
    expect(store.members.get('member-1')?.photoPath).toBe(
      'members/member-1/photo.jpg',
    )
  })

  it('rejects when CCCD does not match the member', async () => {
    const store = memberStoreWith([draftMember])
    const { storage } = fakeStorage()

    await expect(
      uploadMemberPhoto(
        {
          memberId: 'member-1',
          cccd: '9999888777',
          bytes: new Uint8Array([1]),
          contentType: 'image/jpeg',
        },
        store,
        storage,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
