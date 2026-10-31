import { describe, expect, it } from 'vitest'
import { DomainError } from '#/domain/errors'
import type { MemberDocuments } from '#/domain/memberDocumentTypes'
import type { Member } from '#/domain/types'
import { createMemoryMemberStore } from '#/test/memoryStores'
import { FILLER_AUDIT } from '#/test/auditActors'
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
  it('removes a single side and updates documents map', async () => {
    const store = createMemoryMemberStore([draftMember])
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
        current,
        audit: FILLER_AUDIT,
      },
      store,
    )

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

  it('removes all paths for a type when side is omitted', async () => {
    const store = createMemoryMemberStore([draftMember])
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
        current,
        audit: FILLER_AUDIT,
      },
      store,
    )

    expect(result.documents).toEqual({
      diep_sa_di: {
        filePath: 'members/member-1/docs/diep_sa_di/file.pdf',
      },
    })
  })

  it('removes from server state when client current is stale', async () => {
    const store = createMemoryMemberStore([draftMember])
    const staleCurrent: MemberDocuments = {
      cccd: { frontPath: 'members/member-1/docs/cccd/front.jpg' },
    }

    const result = await deleteMemberDocument(
      {
        memberId: 'member-1',
        cccd: '012345678901',
        typeId: 'cccd',
        side: 'back',
        current: staleCurrent,
        audit: FILLER_AUDIT,
      },
      store,
    )

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

    await expect(
      deleteMemberDocument(
        {
          memberId: 'member-1',
          cccd: '012345678901',
          typeId: 'cccd',
          side: 'front',
          current: { cccd: { frontPath: 'members/member-1/docs/cccd/front.jpg' } },
          audit: FILLER_AUDIT,
        },
        store,
      ),
    ).rejects.toMatchObject({ code: 'RECORD_LOCKED' } satisfies Partial<DomainError>)
    expect((await store.getById('member-1'))?.documents).toEqual(
      draftMember.documents,
    )
  })
})
