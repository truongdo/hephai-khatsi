import { describe, expect, it } from 'vitest'
import { memberCccdIndexId } from '#/domain/memberCccdIndex'
import type { Invite } from '#/domain/types'
import type { InviteStore } from '#/repositories/inviteRepo'
import { createMemoryMemberStore } from '#/test/memoryStores'
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

const PUBLIC_INVITE: Invite = {
  id: 'public',
  token: 'public',
  createdAt: '2026-07-19T00:00:00.000Z',
  createdBy: 'admin-1',
}

describe('member draft save, resume, and lock', () => {
  it('requires CCCD before saving a draft', async () => {
    await expect(
      saveMemberDraft(
        { token: 'public', orgUnitId: 'gd-i', sanghaType: 'tang', cccd: '  ', patch: {} },
        createMemoryMemberStore(),
        memoryInviteStore([PUBLIC_INVITE]),
      ),
    ).rejects.toMatchObject({ code: 'CCCD_REQUIRED' })
  })

  it('rejects an unknown invite token', async () => {
    await expect(
      saveMemberDraft(
        { token: 'missing', orgUnitId: 'gd-i', sanghaType: 'tang', cccd: '012345678901', patch: {} },
        createMemoryMemberStore(),
        memoryInviteStore([PUBLIC_INVITE]),
      ),
    ).rejects.toMatchObject({ code: 'INVITE_NOT_FOUND' })
  })

  it('creates a draft using the org unit and sangha type the visitor supplied', async () => {
    const store = createMemoryMemberStore()
    const invites = memoryInviteStore([PUBLIC_INVITE])

    const tang = await saveMemberDraft(
      {
        token: 'public',
        orgUnitId: 'gd-i',
        sanghaType: 'tang',
        cccd: '0123 456 78901',
        patch: { orgUnitId: 'forged', phapDanh: 'Minh Tam' } as never,
      },
      store,
      invites,
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
      { token: 'public', orgUnitId: 'gd-i', sanghaType: 'ni', cccd: '9999 888 777', patch: {} },
      store,
      invites,
    )
    expect(ni.member.sanghaType).toBe('ni')
  })

  it('updates the existing draft for the same CCCD', async () => {
    const store = createMemoryMemberStore()
    const invites = memoryInviteStore([PUBLIC_INVITE])
    const first = await saveMemberDraft(
      { token: 'public', orgUnitId: 'gd-i', sanghaType: 'tang', cccd: '012345678901', patch: { phapDanh: 'Minh Tam' } },
      store,
      invites,
    )

    const second = await saveMemberDraft(
      { token: 'public', orgUnitId: 'gd-i', sanghaType: 'tang', cccd: '012345678901', patch: { phapDanh: 'Minh Tue' } },
      store,
      invites,
    )

    expect(second.mode).toBe('updated')
    expect(second.member.id).toBe(first.member.id)
    expect(second.member.phapDanh).toBe('Minh Tue')
  })

  it('returns view access for locked members and blocks further saves', async () => {
    const store = createMemoryMemberStore()
    const invites = memoryInviteStore([PUBLIC_INVITE])
    const saved = await saveMemberDraft(
      { token: 'public', orgUnitId: 'gd-i', sanghaType: 'tang', cccd: '012345678901', patch: {} },
      store,
      invites,
    )
    await lockMember({ memberId: saved.member.id, lockedBy: 'admin-1' }, store)

    const resumed = await resumeMemberByCccd(
      { token: 'public', orgUnitId: 'gd-i', sanghaType: 'tang', cccd: '012345678901' },
      store,
      invites,
    )
    expect(resumed.access).toBe('view')

    await expect(
      saveMemberDraft(
        { token: 'public', orgUnitId: 'gd-i', sanghaType: 'tang', cccd: '012345678901', patch: { phapDanh: 'Should not write' } },
        store,
        invites,
      ),
    ).rejects.toMatchObject({ code: 'RECORD_LOCKED' })
  })
})
