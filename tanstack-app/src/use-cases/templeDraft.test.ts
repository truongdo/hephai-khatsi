import { describe, expect, it } from 'vitest'
import { DomainError } from '#/domain/errors'
import type { FormType, Invite, Temple } from '#/domain/types'
import type { InviteStore } from '#/repositories/inviteRepo'
import type {
  CreateOrUpdateTempleDraftInput,
  TempleStore,
} from '#/repositories/templeRepo'
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

function invite(
  formType: FormType,
  token = `token-${formType}`,
  orgUnitId = 'gd-i',
): Invite {
  return {
    id: token,
    token,
    orgUnitId,
    formType,
    createdAt: '2026-07-19T00:00:00.000Z',
    createdBy: 'admin-1',
  }
}

function emptyTempleStore() {
  const temples = new Map<string, Temple>()

  const store: TempleStore & {
    temples: Map<string, Temple>
  } = {
    temples,
    async createOrUpdateDraft(input: CreateOrUpdateTempleDraftInput) {
      const now = '2026-07-19T00:00:00.000Z'

      if (input.templeId) {
        const existing = temples.get(input.templeId)
        if (!existing) throw new DomainError('NOT_FOUND', 'Temple not found')
        if (existing.orgUnitId !== input.orgUnitId) {
          throw new DomainError(
            'FORBIDDEN',
            'Temple does not belong to this invite org unit',
          )
        }
        if (existing.status === 'locked') {
          throw new DomainError('RECORD_LOCKED', 'Temple is locked')
        }
        const temple: Temple = {
          ...existing,
          ...input.patch,
          id: existing.id,
          orgUnitId: existing.orgUnitId,
          status: 'draft',
          managerPhones: input.managerPhones,
          inviteId: existing.inviteId,
          createdAt: existing.createdAt,
          updatedAt: now,
          lockedAt: existing.lockedAt,
          lockedBy: existing.lockedBy,
        }
        temples.set(temple.id, temple)
        return { temple, mode: 'updated' as const }
      }

      const id = `temple-${temples.size + 1}`
      const temple: Temple = {
        ...input.patch,
        id,
        orgUnitId: input.orgUnitId,
        status: 'draft',
        managerPhones: input.managerPhones,
        inviteId: input.inviteId,
        createdAt: now,
        updatedAt: now,
        lockedAt: null,
        lockedBy: null,
      }
      temples.set(id, temple)
      return { temple, mode: 'created' as const }
    },
    async getById(templeId: string) {
      return temples.get(templeId) ?? null
    },
    async listByOrgAndPhone(input: { orgUnitId: string; phone: string }) {
      return [...temples.values()].filter(
        (temple) =>
          temple.orgUnitId === input.orgUnitId &&
          temple.managerPhones.includes(input.phone),
      )
    },
    async lock(templeId: string, lockedBy: string) {
      const existing = temples.get(templeId)
      if (!existing) throw new DomainError('NOT_FOUND', 'Temple not found')
      const temple: Temple = {
        ...existing,
        status: 'locked',
        lockedAt: '2026-07-19T00:00:00.000Z',
        lockedBy,
        updatedAt: '2026-07-19T00:00:00.000Z',
      }
      temples.set(templeId, temple)
      return temple
    },
  }

  return store
}

describe('temple draft save, resume, and lock', () => {
  it('requires at least one manager phone after merging explicit and abbot phones', async () => {
    await expect(
      saveTempleDraft(
        { token: 'token-temple', patch: {}, explicitPhones: [] },
        emptyTempleStore(),
        memoryInviteStore([invite('temple')]),
      ),
    ).rejects.toMatchObject({ code: 'PHONE_REQUIRED' })
  })

  it('creates a draft using invite org unit and normalized manager phones', async () => {
    const saved = await saveTempleDraft(
      {
        token: 'token-temple',
        explicitPhones: [' 0912 345 678 '],
        patch: {
          orgUnitId: 'forged',
          status: 'locked',
          managerPhones: ['forged'],
          danhHieu: 'Tinh Xa Trung Tam',
          truTriHienNay: { phapDanh: 'Minh Tam', dienThoai: '0912.345.678' },
        } as never,
      },
      emptyTempleStore(),
      memoryInviteStore([invite('temple')]),
    )

    expect(saved.mode).toBe('created')
    expect(saved.temple).toMatchObject({
      orgUnitId: 'gd-i',
      status: 'draft',
      managerPhones: ['0912345678'],
      inviteId: 'token-temple',
      danhHieu: 'Tinh Xa Trung Tam',
    })
  })

  it('updates an existing draft by temple id while preserving protected fields', async () => {
    const store = emptyTempleStore()
    const invites = memoryInviteStore([invite('temple')])
    const first = await saveTempleDraft(
      {
        token: 'token-temple',
        explicitPhones: ['0912345678'],
        patch: { danhHieu: 'Tinh Xa Trung Tam' },
      },
      store,
      invites,
    )

    const second = await saveTempleDraft(
      {
        token: 'token-temple',
        templeId: first.temple.id,
        explicitPhones: ['0988 777 666'],
        patch: {
          orgUnitId: 'forged',
          lockedBy: 'forged-admin',
          danhHieu: 'Tinh Xa Ngoc Phuong',
        } as never,
      },
      store,
      invites,
    )

    expect(second.mode).toBe('updated')
    expect(second.temple).toMatchObject({
      id: first.temple.id,
      orgUnitId: 'gd-i',
      status: 'draft',
      managerPhones: ['0912345678', '0988777666'],
      inviteId: 'token-temple',
      lockedAt: null,
      lockedBy: null,
      danhHieu: 'Tinh Xa Ngoc Phuong',
    })
  })

  it('keeps prior manager phones on update when not re-sent', async () => {
    const store = emptyTempleStore()
    const invites = memoryInviteStore([invite('temple')])
    const created = await saveTempleDraft(
      {
        token: 'token-temple',
        explicitPhones: ['0912345678'],
        patch: { danhHieu: 'Tinh Xa Trung Tam' },
      },
      store,
      invites,
    )

    const updated = await saveTempleDraft(
      {
        token: 'token-temple',
        templeId: created.temple.id,
        explicitPhones: [],
        patch: {
          danhHieu: 'Tinh Xa Ngoc Phuong',
          truTriHienNay: { phapDanh: 'Minh Tam', dienThoai: '0988.777.666' },
        },
      },
      store,
      invites,
    )

    expect(updated.mode).toBe('updated')
    expect(updated.temple.managerPhones).toEqual(['0912345678', '0988777666'])
  })

  it('returns edit for drafts, view for locked temples, and blocks further saves', async () => {
    const store = emptyTempleStore()
    const invites = memoryInviteStore([invite('temple')])
    const draft = await saveTempleDraft(
      {
        token: 'token-temple',
        explicitPhones: ['0912345678'],
        patch: { danhHieu: 'Draft Temple' },
      },
      store,
      invites,
    )
    const locked = await saveTempleDraft(
      {
        token: 'token-temple',
        explicitPhones: ['0912345678'],
        patch: { danhHieu: 'Locked Temple' },
      },
      store,
      invites,
    )
    await lockTemple({ templeId: locked.temple.id, lockedBy: 'admin-1' }, store)

    const resumed = await resumeTemplesByPhone(
      { token: 'token-temple', phone: '0912.345.678' },
      store,
      invites,
    )
    expect(resumed.temples).toEqual([
      { temple: draft.temple, access: 'edit' },
      { temple: store.temples.get(locked.temple.id), access: 'view' },
    ])

    await expect(
      saveTempleDraft(
        {
          token: 'token-temple',
          templeId: locked.temple.id,
          explicitPhones: ['0912345678'],
          patch: { danhHieu: 'Should not write' },
        },
        store,
        invites,
      ),
    ).rejects.toMatchObject({ code: 'RECORD_LOCKED' })
  })

  it('rejects cross-org draft updates when temple id belongs to another org unit', async () => {
    const store = emptyTempleStore()
    const created = await saveTempleDraft(
      {
        token: 'token-temple',
        explicitPhones: ['0912345678'],
        patch: { danhHieu: 'Tinh Xa Trung Tam' },
      },
      store,
      memoryInviteStore([invite('temple', 'token-temple', 'gd-i')]),
    )

    const otherOrgInvites = memoryInviteStore([
      invite('temple', 'token-temple-other', 'gd-ii'),
    ])

    await expect(
      saveTempleDraft(
        {
          token: 'token-temple-other',
          templeId: created.temple.id,
          explicitPhones: ['0988777666'],
          patch: { danhHieu: 'Hijacked Temple' },
        },
        store,
        otherOrgInvites,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    expect(store.temples.get(created.temple.id)).toMatchObject({
      orgUnitId: 'gd-i',
      inviteId: 'token-temple',
      danhHieu: 'Tinh Xa Trung Tam',
      managerPhones: ['0912345678'],
    })
  })

  it('preserves original invite id when updating a draft with a different invite in the same org', async () => {
    const store = emptyTempleStore()
    const invites = memoryInviteStore([
      invite('temple', 'token-temple-a', 'gd-i'),
      invite('temple', 'token-temple-b', 'gd-i'),
    ])
    const created = await saveTempleDraft(
      {
        token: 'token-temple-a',
        explicitPhones: ['0912345678'],
        patch: { danhHieu: 'Tinh Xa Trung Tam' },
      },
      store,
      invites,
    )

    const updated = await saveTempleDraft(
      {
        token: 'token-temple-b',
        templeId: created.temple.id,
        explicitPhones: ['0988777666'],
        patch: { danhHieu: 'Tinh Xa Ngoc Phuong' },
      },
      store,
      invites,
    )

    expect(updated.temple).toMatchObject({
      orgUnitId: 'gd-i',
      inviteId: 'token-temple-a',
      danhHieu: 'Tinh Xa Ngoc Phuong',
      managerPhones: ['0912345678', '0988777666'],
    })
  })

  it('rejects member invites for temple flows', async () => {
    const invites = memoryInviteStore([invite('member_tang', 'token-member')])

    await expect(
      saveTempleDraft(
        {
          token: 'token-member',
          explicitPhones: ['0912345678'],
          patch: {},
        },
        emptyTempleStore(),
        invites,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    await expect(
      resumeTemplesByPhone(
        { token: 'token-member', phone: '0912345678' },
        emptyTempleStore(),
        invites,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
