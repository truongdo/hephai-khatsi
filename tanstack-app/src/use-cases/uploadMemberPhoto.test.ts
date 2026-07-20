import { describe, expect, it } from 'vitest'
import { DomainError } from '#/domain/errors'
import type { Member } from '#/domain/types'
import type { MemberStore } from '#/repositories/memberRepo'
import {
  uploadMemberPhoto,
  type StoragePort,
} from './uploadMemberPhoto'

function fakeStorage() {
  const files = new Map<string, { bytes: Uint8Array; contentType: string }>()
  const storage: StoragePort = {
    async put(path, bytes, contentType) {
      files.set(path, { bytes, contentType })
    },
  }
  return { storage, files }
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
    async setPhotoPath(memberId: string, photoPath: string) {
      const existing = map.get(memberId)
      if (!existing) throw new DomainError('NOT_FOUND', 'Member not found')
      if (existing.status === 'locked') {
        throw new DomainError('RECORD_LOCKED', 'Member is locked')
      }
      const member = {
        ...existing,
        photoPath,
        updatedAt: '2026-07-19T00:00:00.000Z',
      }
      map.set(memberId, member)
      return member
    },
    async list() {
      return { items: [], nextCursor: null }
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
}

describe('uploadMemberPhoto', () => {
  it('uploads a draft member photo and updates photoPath', async () => {
    const store = memberStoreWith([draftMember])
    const { storage, files } = fakeStorage()
    const bytes = new Uint8Array([1, 2, 3])

    const result = await uploadMemberPhoto(
      {
        memberId: 'member-1',
        cccd: '0123 456 78901',
        bytes,
        contentType: 'image/jpeg',
      },
      store,
      storage,
    )

    expect(result).toEqual({ photoPath: 'members/member-1/photo.jpg' })
    expect(files.get('members/member-1/photo.jpg')).toEqual({
      bytes,
      contentType: 'image/jpeg',
    })
    expect(store.members.get('member-1')?.photoPath).toBe(
      'members/member-1/photo.jpg',
    )
  })

  it('rejects photo upload for locked members', async () => {
    const store = memberStoreWith([
      {
        ...draftMember,
        status: 'locked',
        lockedAt: '2026-07-19T00:00:00.000Z',
        lockedBy: 'admin-1',
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
