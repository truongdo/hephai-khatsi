import { describe, expect, it } from 'vitest'
import type { Invite } from '#/domain/types'
import { auditParentKey } from '#/repositories/auditLogRepo'
import type { InviteStore } from '#/repositories/inviteRepo'
import { createMemoryTempleStore } from '#/test/memoryStores'
import { saveAndLockTemple } from './saveAndLockTemple'

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

describe('saveAndLockTemple', () => {
  it('saveAndLockTemple returns locked temple', async () => {
    const templeStore = createMemoryTempleStore()
    const inviteStore = memoryInviteStore([PUBLIC_INVITE])

    const result = await saveAndLockTemple(
      {
        token: 't',
        orgUnitId: 'gd-i',
        explicitPhones: ['0912345678'],
        patch: { danhHieu: 'Tinh Xa Trung Tam' },
      },
      templeStore,
      inviteStore,
    )

    expect(result.temple.status).toBe('locked')
    expect(result.temple.lockedBy).toBe('filler')
    expect(result.mode).toBe('created')
  })

  it('writes a created audit log with filler actor from phone', async () => {
    const templeStore = createMemoryTempleStore()
    const inviteStore = memoryInviteStore([PUBLIC_INVITE])

    const result = await saveAndLockTemple(
      {
        token: 't',
        orgUnitId: 'gd-i',
        explicitPhones: ['0912345678'],
        patch: {
          danhHieu: 'Tinh Xa Trung Tam',
          truTriHienNay: { phapDanh: 'Minh Tam', dienThoai: '0901234567' },
        },
      },
      templeStore,
      inviteStore,
    )

    const parentKey = auditParentKey({
      collection: 'temples',
      id: result.temple.id,
    })
    const { entries } = templeStore.memoryListAudit(parentKey, 10)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      action: 'created',
      actorType: 'filler',
      actorId: '0901234567',
    })
  })

  it('strips protected patch keys including edit request fields', async () => {
    const templeStore = createMemoryTempleStore()
    const inviteStore = memoryInviteStore([PUBLIC_INVITE])

    const result = await saveAndLockTemple(
      {
        token: 't',
        orgUnitId: 'gd-i',
        explicitPhones: ['0912345678'],
        patch: {
          orgUnitId: 'forged',
          status: 'draft',
          editRequestedAt: '2026-01-01T00:00:00.000Z',
          editRequestedBy: '0909999999',
          danhHieu: 'Tinh Xa Ngoc Phuong',
        } as never,
      },
      templeStore,
      inviteStore,
    )

    expect(result.temple).toMatchObject({
      orgUnitId: 'gd-i',
      status: 'locked',
      danhHieu: 'Tinh Xa Ngoc Phuong',
      editRequestedAt: null,
      editRequestedBy: null,
    })
  })

  it('merges explicit and abbot phones like saveTempleDraft', async () => {
    const templeStore = createMemoryTempleStore()
    const inviteStore = memoryInviteStore([PUBLIC_INVITE])

    const result = await saveAndLockTemple(
      {
        token: 't',
        orgUnitId: 'gd-i',
        explicitPhones: ['0912345678'],
        patch: {
          danhHieu: 'Tinh Xa Trung Tam',
          truTriHienNay: { phapDanh: 'Minh Tam', dienThoai: '0988.777.666' },
        },
      },
      templeStore,
      inviteStore,
    )

    expect(result.temple.managerPhones).toEqual(['0912345678', '0988777666'])
  })
})
