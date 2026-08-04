import { describe, expect, it, vi } from 'vitest'
import { DomainError } from '#/domain/errors'
import type { MemberDocuments } from '#/domain/memberDocumentTypes'
import type { Member } from '#/domain/types'
import { createMemoryMemberStore } from '#/test/memoryStores'
import { deleteMemberDocument } from './deleteMemberDocument'

const draftMember: Member = {
  id: 'member-1',
  orgUnitId: 'gd-i',
  sanghaType: 'tang',
  status: 'draft',
  cccd: '012345678901',
  inviteId: 'invite-1',
  currentTempleId: null,
  photoPath: null,
  documents: {
    cccd: {
      frontPath: 'members/member-1/docs/cccd/front.jpg',
      backPath: 'members/member-1/docs/cccd/back.jpg',
    },
    diep_sa_di: {
      filePath: 'members/member-1/docs/diep_sa_di/file.pdf',
    },
  },
  createdAt: '2026-07-19T00:00:00.000Z',
  updatedAt: '2026-07-19T00:00:00.000Z',
  lockedAt: null,
  lockedBy: null,
  editRequestedAt: null,
  editRequestedBy: null,
}

describe('deleteMemberDocument', () => {
  it('deletes a single side and updates documents map', async () => {
    const store = createMemoryMemberStore([draftMember])
    const deleteObjects = vi.fn(async () => undefined)
    const current: MemberDocuments = {
      cccd: {
        frontPath: 'members/member-1/docs/cccd/front.jpg',
        backPath: 'members/member-1/docs/cccd/back.jpg',
      },
    }

    const result = await deleteMemberDocument(
      {
        memberId: 'member-1',
        cccd: '012345678901',
        typeId: 'cccd',
        side: 'front',
        inviteToken: 'invite-1',
        current,
      },
      store,
      deleteObjects,
    )

    expect(deleteObjects).toHaveBeenCalledWith({
      memberId: 'member-1',
      typeId: 'cccd',
      paths: ['members/member-1/docs/cccd/front.jpg'],
      cccd: '012345678901',
      inviteToken: 'invite-1',
      idToken: undefined,
    })
    expect(result.documents).toEqual({
      cccd: { backPath: 'members/member-1/docs/cccd/back.jpg' },
      diep_sa_di: {
        filePath: 'members/member-1/docs/diep_sa_di/file.pdf',
      },
    })
    expect((await store.getById('member-1'))?.documents).toEqual(
      result.documents,
    )
  })

  it('deletes all paths for a type when side is omitted', async () => {
    const store = createMemoryMemberStore([draftMember])
    const deleteObjects = vi.fn(async () => undefined)
    const current: MemberDocuments = {
      cccd: {
        frontPath: 'members/member-1/docs/cccd/front.jpg',
        backPath: 'members/member-1/docs/cccd/back.jpg',
      },
      diep_sa_di: {
        filePath: 'members/member-1/docs/diep_sa_di/file.pdf',
      },
    }

    const result = await deleteMemberDocument(
      {
        memberId: 'member-1',
        cccd: '012345678901',
        typeId: 'cccd',
        inviteToken: 'invite-1',
        current,
      },
      store,
      deleteObjects,
    )

    expect(deleteObjects).toHaveBeenCalledWith({
      memberId: 'member-1',
      typeId: 'cccd',
      paths: [
        'members/member-1/docs/cccd/front.jpg',
        'members/member-1/docs/cccd/back.jpg',
      ],
      cccd: '012345678901',
      inviteToken: 'invite-1',
      idToken: undefined,
    })
    expect(result.documents).toEqual({
      diep_sa_di: {
        filePath: 'members/member-1/docs/diep_sa_di/file.pdf',
      },
    })
  })

  it('deletes from server state when client current is stale', async () => {
    const store = createMemoryMemberStore([draftMember])
    const deleteObjects = vi.fn(async () => undefined)
    const staleCurrent: MemberDocuments = {
      cccd: { frontPath: 'members/member-1/docs/cccd/front.jpg' },
    }

    const result = await deleteMemberDocument(
      {
        memberId: 'member-1',
        cccd: '012345678901',
        typeId: 'cccd',
        side: 'back',
        inviteToken: 'invite-1',
        current: staleCurrent,
      },
      store,
      deleteObjects,
    )

    expect(deleteObjects).toHaveBeenCalledWith({
      memberId: 'member-1',
      typeId: 'cccd',
      paths: ['members/member-1/docs/cccd/back.jpg'],
      cccd: '012345678901',
      inviteToken: 'invite-1',
      idToken: undefined,
    })
    expect(result.documents).toEqual({
      cccd: { frontPath: 'members/member-1/docs/cccd/front.jpg' },
      diep_sa_di: {
        filePath: 'members/member-1/docs/diep_sa_di/file.pdf',
      },
    })
  })

  it('rejects filler delete for locked members without idToken', async () => {
    const store = createMemoryMemberStore([
      {
        ...draftMember,
        status: 'locked',
        lockedAt: '2026-07-19T00:00:00.000Z',
        lockedBy: 'admin-1',
      },
    ])
    const deleteObjects = vi.fn(async () => undefined)

    await expect(
      deleteMemberDocument(
        {
          memberId: 'member-1',
          cccd: '012345678901',
          typeId: 'cccd',
          side: 'front',
          inviteToken: 'invite-1',
          current: { cccd: { frontPath: 'members/member-1/docs/cccd/front.jpg' } },
        },
        store,
        deleteObjects,
      ),
    ).rejects.toMatchObject({ code: 'RECORD_LOCKED' } satisfies Partial<DomainError>)
    expect(deleteObjects).not.toHaveBeenCalled()
  })
})
