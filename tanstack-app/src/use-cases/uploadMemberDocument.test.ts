import { describe, expect, it, vi } from 'vitest'
import { DomainError } from '#/domain/errors'
import type { MemberDocuments } from '#/domain/memberDocumentTypes'
import { MEMBER_DOCUMENT_MAX_BYTES } from '#/domain/memberDocumentTypes'
import type { Member } from '#/domain/types'
import { createMemoryMemberStore } from '#/test/memoryStores'
import {
  uploadMemberDocument,
  type DocumentStoragePort,
} from './uploadMemberDocument'

function fakeStorage() {
  const calls: Array<{
    memberId: string
    cccd: string
    typeId: string
    side: string
    bytes: Uint8Array
    contentType: string
    inviteToken?: string
    idToken?: string
  }> = []
  const storage: DocumentStoragePort = {
    async put(
      memberId,
      cccd,
      typeId,
      side,
      bytes,
      contentType,
      inviteToken,
      idToken,
    ) {
      calls.push({
        memberId,
        cccd,
        typeId,
        side,
        bytes,
        contentType,
        inviteToken,
        idToken,
      })
      return `members/${memberId}/docs/${typeId}/${side}.jpg`
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
  documents: {},
  createdAt: '2026-07-19T00:00:00.000Z',
  updatedAt: '2026-07-19T00:00:00.000Z',
  lockedAt: null,
  lockedBy: null,
}

describe('uploadMemberDocument', () => {
  it('uploads a document side and updates documents map', async () => {
    const store = createMemoryMemberStore([draftMember])
    const { storage, calls } = fakeStorage()
    const bytes = new Uint8Array([1, 2, 3])
    const current: MemberDocuments = {}

    const result = await uploadMemberDocument(
      {
        memberId: 'member-1',
        cccd: '0123 456 78901',
        typeId: 'cccd',
        side: 'front',
        bytes,
        contentType: 'image/jpeg',
        inviteToken: 'invite-1',
        current,
      },
      store,
      storage,
    )

    expect(result.filePath).toBe('members/member-1/docs/cccd/front.jpg')
    expect(result.documents).toEqual({
      cccd: { frontPath: 'members/member-1/docs/cccd/front.jpg' },
    })
    expect(calls).toEqual([
      {
        memberId: 'member-1',
        cccd: '012345678901',
        typeId: 'cccd',
        side: 'front',
        bytes,
        contentType: 'image/jpeg',
        inviteToken: 'invite-1',
        idToken: undefined,
      },
    ])
    expect((await store.getById('member-1'))?.documents).toEqual(
      result.documents,
    )
  })

  it('best-effort deletes the previous path when replacing a side', async () => {
    const oldPath = 'members/member-1/docs/cccd/front.png'
    const store = createMemoryMemberStore([
      {
        ...draftMember,
        documents: { cccd: { frontPath: oldPath } },
      },
    ])
    const { storage } = fakeStorage()
    const deleteObjects = vi.fn(async () => undefined)
    const current: MemberDocuments = { cccd: { frontPath: oldPath } }

    const result = await uploadMemberDocument(
      {
        memberId: 'member-1',
        cccd: '012345678901',
        typeId: 'cccd',
        side: 'front',
        bytes: new Uint8Array([1]),
        contentType: 'image/jpeg',
        inviteToken: 'invite-1',
        current,
      },
      store,
      storage,
      deleteObjects,
    )

    expect(result.documents.cccd?.frontPath).toBe(
      'members/member-1/docs/cccd/front.jpg',
    )
    expect(deleteObjects).toHaveBeenCalledWith({
      memberId: 'member-1',
      typeId: 'cccd',
      paths: [oldPath],
      cccd: '012345678901',
      inviteToken: 'invite-1',
      idToken: undefined,
    })
  })

  it('rejects invalid content type', async () => {
    const store = createMemoryMemberStore([draftMember])
    const { storage } = fakeStorage()

    await expect(
      uploadMemberDocument(
        {
          memberId: 'member-1',
          cccd: '012345678901',
          typeId: 'cccd',
          side: 'front',
          bytes: new Uint8Array([1]),
          contentType: 'image/gif',
          current: {},
        },
        store,
        storage,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })

  it('rejects oversized files', async () => {
    const store = createMemoryMemberStore([draftMember])
    const { storage } = fakeStorage()
    const bytes = new Uint8Array(MEMBER_DOCUMENT_MAX_BYTES + 1)

    await expect(
      uploadMemberDocument(
        {
          memberId: 'member-1',
          cccd: '012345678901',
          typeId: 'cccd',
          side: 'front',
          bytes,
          contentType: 'image/jpeg',
          current: {},
        },
        store,
        storage,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })

  it('rejects filler upload for locked members without idToken', async () => {
    const store = createMemoryMemberStore([
      {
        ...draftMember,
        status: 'locked',
        lockedAt: '2026-07-19T00:00:00.000Z',
        lockedBy: 'admin-1',
      },
    ])
    const { storage } = fakeStorage()

    await expect(
      uploadMemberDocument(
        {
          memberId: 'member-1',
          cccd: '012345678901',
          typeId: 'cccd',
          side: 'front',
          bytes: new Uint8Array([1]),
          contentType: 'image/jpeg',
          inviteToken: 'invite-1',
          current: {},
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

    const result = await uploadMemberDocument(
      {
        memberId: 'member-1',
        cccd: '012345678901',
        typeId: 'diep_sa_di',
        side: 'file',
        bytes: new Uint8Array([1, 2]),
        contentType: 'application/pdf',
        idToken: 'admin-id-token',
        current: {},
      },
      store,
      storage,
    )

    expect(result.filePath).toBe('members/member-1/docs/diep_sa_di/file.jpg')
    expect(calls[0]?.idToken).toBe('admin-id-token')
  })

  it('rejects when CCCD does not match the member', async () => {
    const store = createMemoryMemberStore([draftMember])
    const { storage } = fakeStorage()

    await expect(
      uploadMemberDocument(
        {
          memberId: 'member-1',
          cccd: '9999888777',
          typeId: 'cccd',
          side: 'front',
          bytes: new Uint8Array([1]),
          contentType: 'image/jpeg',
          current: {},
        },
        store,
        storage,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('accepts image/jpg content type', async () => {
    const store = createMemoryMemberStore([draftMember])
    const { storage } = fakeStorage()

    const result = await uploadMemberDocument(
      {
        memberId: 'member-1',
        cccd: '012345678901',
        typeId: 'cccd',
        side: 'front',
        bytes: new Uint8Array([1]),
        contentType: 'image/jpg',
        current: {},
      },
      store,
      storage,
    )

    expect(result.filePath).toBe('members/member-1/docs/cccd/front.jpg')
  })

  it('preserves concurrent uploads to different sides when client state is stale', async () => {
    const store = createMemoryMemberStore([draftMember])
    const { storage } = fakeStorage()
    const staleCurrent: MemberDocuments = {}

    await uploadMemberDocument(
      {
        memberId: 'member-1',
        cccd: '012345678901',
        typeId: 'cccd',
        side: 'front',
        bytes: new Uint8Array([1]),
        contentType: 'image/jpeg',
        current: staleCurrent,
      },
      store,
      storage,
    )

    const result = await uploadMemberDocument(
      {
        memberId: 'member-1',
        cccd: '012345678901',
        typeId: 'cccd',
        side: 'back',
        bytes: new Uint8Array([2]),
        contentType: 'image/jpeg',
        current: staleCurrent,
      },
      store,
      storage,
    )

    expect(result.documents).toEqual({
      cccd: {
        frontPath: 'members/member-1/docs/cccd/front.jpg',
        backPath: 'members/member-1/docs/cccd/back.jpg',
      },
    })
    expect((await store.getById('member-1'))?.documents).toEqual(result.documents)
  })
})
