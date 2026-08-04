import { describe, expect, it } from 'vitest'
import type { Invite } from '#/domain/types'
import type { InviteStore } from '#/repositories/inviteRepo'
import { createMemoryMemberStore } from '#/test/memoryStores'
import { saveAndLockMember } from './saveAndLockMember'

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
  token: 't',
  createdAt: '2026-07-19T00:00:00.000Z',
  createdBy: 'admin-1',
  kind: 'filler',
  retreatId: null,
  orgUnitId: null,
  disabled: false,
}

describe('saveAndLockMember', () => {
  it('saveAndLockMember returns locked member', async () => {
    const memberStore = createMemoryMemberStore()
    const inviteStore = memoryInviteStore([PUBLIC_INVITE])

    const result = await saveAndLockMember(
      {
        token: 't',
        orgUnitId: 'gd-i',
        sanghaType: 'tang',
        cccd: '001099012345',
        patch: { theDanh: 'A', dienThoai: '0901' },
      },
      memberStore,
      inviteStore,
    )

    expect(result.member.status).toBe('locked')
    expect(result.member.lockedBy).toBe('filler')
    expect(result.mode).toBe('created')
  })

  it('strips protected patch keys including edit request fields', async () => {
    const memberStore = createMemoryMemberStore()
    const inviteStore = memoryInviteStore([PUBLIC_INVITE])

    const result = await saveAndLockMember(
      {
        token: 't',
        orgUnitId: 'gd-i',
        sanghaType: 'tang',
        cccd: '001099012345',
        patch: {
          orgUnitId: 'forged',
          status: 'draft',
          editRequestedAt: '2026-01-01T00:00:00.000Z',
          editRequestedBy: '0909999999',
          phapDanh: 'Minh Tam',
        } as never,
      },
      memberStore,
      inviteStore,
    )

    expect(result.member).toMatchObject({
      orgUnitId: 'gd-i',
      status: 'locked',
      phapDanh: 'Minh Tam',
      editRequestedAt: null,
      editRequestedBy: null,
    })
  })

  it('rejects an unknown invite token', async () => {
    await expect(
      saveAndLockMember(
        {
          token: 'missing',
          orgUnitId: 'gd-i',
          sanghaType: 'tang',
          cccd: '001099012345',
          patch: {},
        },
        createMemoryMemberStore(),
        memoryInviteStore([PUBLIC_INVITE]),
      ),
    ).rejects.toMatchObject({ code: 'INVITE_NOT_FOUND' })
  })
})
