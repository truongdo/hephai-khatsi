import { describe, expect, it } from 'vitest'
import { DomainError } from '#/domain/errors'
import { memberCccdIndexId } from '#/domain/memberCccdIndex'
import type { FormType, Invite, Member, SanghaType } from '#/domain/types'
import type { InviteStore } from '#/repositories/inviteRepo'
import type {
  CreateOrUpdateMemberDraftInput,
  MemberStore,
} from '#/repositories/memberRepo'
import { lockMember } from './lockMember'
import { resumeMemberByCccd } from './resumeMemberByCccd'
import { saveMemberDraft } from './saveMemberDraft'

function memoryInviteStore(invites: Invite[]): InviteStore {
  const map = new Map(invites.map((invite) => [invite.token, invite]))
  return {
    async create(invite: Invite) {
      map.set(invite.token, invite)
    },
    async getByToken(token: string) {
      return map.get(token) ?? null
    },
  }
}

function invite(formType: FormType, token = `token-${formType}`): Invite {
  return {
    id: token,
    token,
    orgUnitId: 'gd-i',
    formType,
    createdAt: '2026-07-19T00:00:00.000Z',
    createdBy: 'admin-1',
  }
}

function emptyMemberStore() {
  const members = new Map<string, Member>()
  const index = new Map<string, string>()

  const store: MemberStore & {
    members: Map<string, Member>
    index: Map<string, string>
  } = {
    members,
    index,
    async createOrUpdateDraft(input: CreateOrUpdateMemberDraftInput) {
      const indexId = memberCccdIndexId(
        input.orgUnitId,
        input.sanghaType,
        input.cccd,
      )
      const now = '2026-07-19T00:00:00.000Z'
      const existingMemberId = index.get(indexId)

      if (existingMemberId) {
        const existing = members.get(existingMemberId)
        if (!existing) throw new DomainError('NOT_FOUND', 'Member not found')
        if (existing.status === 'locked') {
          throw new DomainError('RECORD_LOCKED', 'Member is locked')
        }
        const member = { ...existing, ...input.patch, updatedAt: now }
        members.set(existing.id, member)
        return { member, mode: 'updated' as const }
      }

      const id = `member-${members.size + 1}`
      const member: Member = {
        id,
        orgUnitId: input.orgUnitId,
        sanghaType: input.sanghaType,
        status: 'draft',
        cccd: input.cccd,
        inviteId: input.inviteId,
        currentTempleId: null,
        photoPath: null,
        createdAt: now,
        updatedAt: now,
        lockedAt: null,
        lockedBy: null,
        ...input.patch,
      }
      members.set(id, member)
      index.set(indexId, id)
      return { member, mode: 'created' as const }
    },
    async getByCccd(input: {
      orgUnitId: string
      sanghaType: SanghaType
      cccd: string
    }) {
      const id = index.get(
        memberCccdIndexId(input.orgUnitId, input.sanghaType, input.cccd),
      )
      return id ? members.get(id) ?? null : null
    },
    async getById(memberId: string) {
      return members.get(memberId) ?? null
    },
    async setPhotoPath(memberId: string, photoPath: string) {
      const existing = members.get(memberId)
      if (!existing) throw new DomainError('NOT_FOUND', 'Member not found')
      if (existing.status === 'locked') {
        throw new DomainError('RECORD_LOCKED', 'Member is locked')
      }
      const member = {
        ...existing,
        photoPath,
        updatedAt: '2026-07-19T00:00:00.000Z',
      }
      members.set(memberId, member)
      return member
    },
    async lock(memberId: string, lockedBy: string) {
      const existing = members.get(memberId)
      if (!existing) throw new DomainError('NOT_FOUND', 'Member not found')
      const member: Member = {
        ...existing,
        status: 'locked',
        lockedAt: '2026-07-19T00:00:00.000Z',
        lockedBy,
        updatedAt: '2026-07-19T00:00:00.000Z',
      }
      members.set(memberId, member)
      return member
    },
  }

  return store
}

describe('member draft save, resume, and lock', () => {
  it('requires CCCD before saving a draft', async () => {
    await expect(
      saveMemberDraft(
        { token: 'token-member_tang', cccd: '  ', patch: {} },
        emptyMemberStore(),
        memoryInviteStore([invite('member_tang')]),
      ),
    ).rejects.toMatchObject({ code: 'CCCD_REQUIRED' })
  })

  it('creates a draft and CCCD index using org unit and sangha type from invite', async () => {
    const store = emptyMemberStore()

    const tang = await saveMemberDraft(
      {
        token: 'token-member_tang',
        cccd: '0123 456 78901',
        patch: { orgUnitId: 'forged', phapDanh: 'Minh Tam' } as never,
      },
      store,
      memoryInviteStore([invite('member_tang')]),
    )

    expect(tang.mode).toBe('created')
    expect(tang.member).toMatchObject({
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      cccd: '012345678901',
      phapDanh: 'Minh Tam',
    })
    expect(
      store.index.get(memberCccdIndexId('gd-i', 'tang', '012345678901')),
    ).toBe(tang.member.id)

    const ni = await saveMemberDraft(
      {
        token: 'token-member_ni',
        cccd: '9999 888 777',
        patch: {},
      },
      store,
      memoryInviteStore([invite('member_ni')]),
    )
    expect(ni.member.sanghaType).toBe('ni')
  })

  it('updates the existing draft for the same CCCD', async () => {
    const store = emptyMemberStore()
    const invites = memoryInviteStore([invite('member_tang')])
    const first = await saveMemberDraft(
      {
        token: 'token-member_tang',
        cccd: '012345678901',
        patch: { phapDanh: 'Minh Tam' },
      },
      store,
      invites,
    )

    const second = await saveMemberDraft(
      {
        token: 'token-member_tang',
        cccd: '012345678901',
        patch: { phapDanh: 'Minh Tue' },
      },
      store,
      invites,
    )

    expect(second.mode).toBe('updated')
    expect(second.member.id).toBe(first.member.id)
    expect(second.member.phapDanh).toBe('Minh Tue')
  })

  it('returns view access for locked members and blocks further saves', async () => {
    const store = emptyMemberStore()
    const invites = memoryInviteStore([invite('member_tang')])
    const saved = await saveMemberDraft(
      {
        token: 'token-member_tang',
        cccd: '012345678901',
        patch: {},
      },
      store,
      invites,
    )
    await lockMember({ memberId: saved.member.id, lockedBy: 'admin-1' }, store)

    const resumed = await resumeMemberByCccd(
      { token: 'token-member_tang', cccd: '012345678901' },
      store,
      invites,
    )
    expect(resumed.access).toBe('view')

    await expect(
      saveMemberDraft(
        {
          token: 'token-member_tang',
          cccd: '012345678901',
          patch: { phapDanh: 'Should not write' },
        },
        store,
        invites,
      ),
    ).rejects.toMatchObject({ code: 'RECORD_LOCKED' })
  })

  it('rejects temple invites for member save', async () => {
    await expect(
      saveMemberDraft(
        { token: 'token-temple', cccd: '012345678901', patch: {} },
        emptyMemberStore(),
        memoryInviteStore([invite('temple', 'token-temple')]),
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
