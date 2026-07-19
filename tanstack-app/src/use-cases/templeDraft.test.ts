import { describe, expect, it } from 'vitest'
import type { Invite } from '#/domain/types'
import type { InviteStore } from '#/repositories/inviteRepo'
import { createMemoryTempleStore } from '#/test/memoryStores'
import { lockTemple } from './lockTemple'
import { resumeTemplesByPhone } from './resumeTemplesByPhone'
import { saveTempleDraft } from './saveTempleDraft'

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

function invite(token: string): Invite {
  return {
    id: token,
    token,
    createdAt: '2026-07-19T00:00:00.000Z',
    createdBy: 'admin-1',
  }
}

const PUBLIC_INVITES = memoryInviteStore([invite('public')])

describe('temple draft save, resume, and lock', () => {
  it('requires at least one manager phone after merging explicit and abbot phones', async () => {
    await expect(
      saveTempleDraft(
        { token: 'public', orgUnitId: 'gd-i', patch: {}, explicitPhones: [] },
        createMemoryTempleStore(),
        PUBLIC_INVITES,
      ),
    ).rejects.toMatchObject({ code: 'PHONE_REQUIRED' })
  })

  it('rejects an unknown invite token', async () => {
    await expect(
      saveTempleDraft(
        { token: 'missing', orgUnitId: 'gd-i', explicitPhones: ['0912345678'], patch: {} },
        createMemoryTempleStore(),
        PUBLIC_INVITES,
      ),
    ).rejects.toMatchObject({ code: 'INVITE_NOT_FOUND' })
  })

  it('creates a draft using the org unit the visitor supplied and normalized manager phones', async () => {
    const saved = await saveTempleDraft(
      {
        token: 'public',
        orgUnitId: 'gd-i',
        explicitPhones: [' 0912 345 678 '],
        patch: {
          orgUnitId: 'forged',
          status: 'locked',
          managerPhones: ['forged'],
          danhHieu: 'Tinh Xa Trung Tam',
          truTriHienNay: { phapDanh: 'Minh Tam', dienThoai: '0912.345.678' },
        } as never,
      },
      createMemoryTempleStore(),
      PUBLIC_INVITES,
    )

    expect(saved.mode).toBe('created')
    expect(saved.temple).toMatchObject({
      orgUnitId: 'gd-i',
      status: 'draft',
      managerPhones: ['0912345678'],
      inviteId: 'public',
      danhHieu: 'Tinh Xa Trung Tam',
    })
  })

  it('updates an existing draft by temple id while preserving protected fields', async () => {
    const store = createMemoryTempleStore()
    const first = await saveTempleDraft(
      {
        token: 'public',
        orgUnitId: 'gd-i',
        explicitPhones: ['0912345678'],
        patch: { danhHieu: 'Tinh Xa Trung Tam' },
      },
      store,
      PUBLIC_INVITES,
    )

    const second = await saveTempleDraft(
      {
        token: 'public',
        orgUnitId: 'gd-i',
        templeId: first.temple.id,
        explicitPhones: ['0988 777 666'],
        patch: {
          orgUnitId: 'forged',
          lockedBy: 'forged-admin',
          danhHieu: 'Tinh Xa Ngoc Phuong',
        } as never,
      },
      store,
      PUBLIC_INVITES,
    )

    expect(second.mode).toBe('updated')
    expect(second.temple).toMatchObject({
      id: first.temple.id,
      orgUnitId: 'gd-i',
      status: 'draft',
      managerPhones: ['0912345678', '0988777666'],
      inviteId: 'public',
      lockedAt: null,
      lockedBy: null,
      danhHieu: 'Tinh Xa Ngoc Phuong',
    })
  })

  it('keeps prior manager phones on update when not re-sent', async () => {
    const store = createMemoryTempleStore()
    const created = await saveTempleDraft(
      {
        token: 'public',
        orgUnitId: 'gd-i',
        explicitPhones: ['0912345678'],
        patch: { danhHieu: 'Tinh Xa Trung Tam' },
      },
      store,
      PUBLIC_INVITES,
    )

    const updated = await saveTempleDraft(
      {
        token: 'public',
        orgUnitId: 'gd-i',
        templeId: created.temple.id,
        explicitPhones: [],
        patch: {
          danhHieu: 'Tinh Xa Ngoc Phuong',
          truTriHienNay: { phapDanh: 'Minh Tam', dienThoai: '0988.777.666' },
        },
      },
      store,
      PUBLIC_INVITES,
    )

    expect(updated.mode).toBe('updated')
    expect(updated.temple.managerPhones).toEqual(['0912345678', '0988777666'])
  })

  it('returns edit for drafts, view for locked temples, and blocks further saves', async () => {
    const store = createMemoryTempleStore()
    const draft = await saveTempleDraft(
      {
        token: 'public',
        orgUnitId: 'gd-i',
        explicitPhones: ['0912345678'],
        patch: { danhHieu: 'Draft Temple' },
      },
      store,
      PUBLIC_INVITES,
    )
    const locked = await saveTempleDraft(
      {
        token: 'public',
        orgUnitId: 'gd-i',
        explicitPhones: ['0912345678'],
        patch: { danhHieu: 'Locked Temple' },
      },
      store,
      PUBLIC_INVITES,
    )
    await lockTemple({ templeId: locked.temple.id, lockedBy: 'admin-1' }, store)

    const resumed = await resumeTemplesByPhone(
      { token: 'public', orgUnitId: 'gd-i', phone: '0912.345.678' },
      store,
      PUBLIC_INVITES,
    )
    expect(resumed.temples).toEqual([
      { temple: draft.temple, access: 'edit' },
      { temple: store.temples.get(locked.temple.id), access: 'view' },
    ])

    await expect(
      saveTempleDraft(
        {
          token: 'public',
          orgUnitId: 'gd-i',
          templeId: locked.temple.id,
          explicitPhones: ['0912345678'],
          patch: { danhHieu: 'Should not write' },
        },
        store,
        PUBLIC_INVITES,
      ),
    ).rejects.toMatchObject({ code: 'RECORD_LOCKED' })
  })

  it('rejects cross-org draft updates when the temple belongs to a different org unit', async () => {
    const store = createMemoryTempleStore()
    const created = await saveTempleDraft(
      {
        token: 'public',
        orgUnitId: 'gd-i',
        explicitPhones: ['0912345678'],
        patch: { danhHieu: 'Tinh Xa Trung Tam' },
      },
      store,
      PUBLIC_INVITES,
    )

    await expect(
      saveTempleDraft(
        {
          token: 'public',
          orgUnitId: 'gd-ii',
          templeId: created.temple.id,
          explicitPhones: ['0988777666'],
          patch: { danhHieu: 'Hijacked Temple' },
        },
        store,
        PUBLIC_INVITES,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    expect(store.temples.get(created.temple.id)).toMatchObject({
      orgUnitId: 'gd-i',
      inviteId: 'public',
      danhHieu: 'Tinh Xa Trung Tam',
      managerPhones: ['0912345678'],
    })
  })
})
