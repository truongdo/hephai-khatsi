import { describe, expect, it } from 'vitest'
import type { AuthClaims } from '#/domain/authClaims'
import { retreatRegistrationInviteId } from '#/domain/invite'
import type { Retreat } from '#/domain/retreat'
import type { Invite } from '#/domain/types'
import type { InviteStore } from '#/repositories/inviteRepo'
import type { RetreatStore } from '#/repositories/retreatRepo'
import { ensureRetreatRegistrationInvite } from './ensureRetreatRegistrationInvite'

function sampleRetreat(overrides: Partial<Retreat> & Pick<Retreat, 'id' | 'orgUnitId'>): Retreat {
  return {
    type: 'giao_doan',
    name: 'Khóa tu hè',
    diaDiem: 'TX Trung Tâm',
    noiDung: 'Thiền',
    doiTuongThamDu: 'Tăng ni',
    thoiGianBatDau: '2026-08-01T00:00:00.000Z',
    thoiGianKetThuc: '2026-08-07T00:00:00.000Z',
    dangKyMoTu: '2026-07-01T00:00:00.000Z',
    dangKyDongLuc: '2026-07-20T00:00:00.000Z',
    extraFields: [],
    quyenDangKy: 'both',
    status: 'open',
    createdBy: 'admin-1',
    createdAt: '2026-07-19T10:00:00.000Z',
    updatedAt: '2026-07-19T10:00:00.000Z',
    ...overrides,
  }
}

function memoryInviteStore() {
  const map = new Map<string, Invite>()
  const store: InviteStore = {
    async create(invite: Invite) {
      map.set(invite.token, invite)
    },
    async getByToken(token: string) {
      return map.get(token) ?? null
    },
  }
  return { store, map }
}

function memoryRetreatStore(retreats: Retreat[]): Pick<RetreatStore, 'getById'> {
  const map = new Map(retreats.map((retreat) => [retreat.id, retreat]))
  return {
    async getById(id: string) {
      return map.get(id) ?? null
    },
  }
}

describe('ensureRetreatRegistrationInvite', () => {
  it('giao_doan_admin cannot ensure invite for other org retreat', async () => {
    const { store: inviteStore } = memoryInviteStore()
    const retreatStore = memoryRetreatStore([
      sampleRetreat({ id: 'retreat-1', orgUnitId: 'gd-ii' }),
    ])
    const claims: AuthClaims = { role: 'giao_doan_admin', orgUnitId: 'gd-i' }

    await expect(
      ensureRetreatRegistrationInvite(
        claims,
        { retreatId: 'retreat-1', createdBy: 'admin-1' },
        inviteStore,
        retreatStore,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('creates retreat registration invite with stable id', async () => {
    const { store: inviteStore } = memoryInviteStore()
    const retreatStore = memoryRetreatStore([
      sampleRetreat({ id: 'retreat-1', orgUnitId: 'gd-i' }),
    ])
    const claims: AuthClaims = { role: 'giao_doan_admin', orgUnitId: 'gd-i' }

    const invite = await ensureRetreatRegistrationInvite(
      claims,
      { retreatId: 'retreat-1', createdBy: 'admin-1' },
      inviteStore,
      retreatStore,
    )

    expect(invite).toMatchObject({
      id: retreatRegistrationInviteId('retreat-1'),
      token: retreatRegistrationInviteId('retreat-1'),
      kind: 'retreat_registration',
      retreatId: 'retreat-1',
      orgUnitId: 'gd-i',
      disabled: false,
      createdBy: 'admin-1',
    })
  })

  it('ensure is idempotent when invite already exists', async () => {
    const { store: inviteStore } = memoryInviteStore()
    const retreatStore = memoryRetreatStore([
      sampleRetreat({ id: 'retreat-1', orgUnitId: 'gd-i' }),
    ])
    const claims: AuthClaims = { role: 'he_phai_admin', orgUnitId: null }

    const first = await ensureRetreatRegistrationInvite(
      claims,
      { retreatId: 'retreat-1', createdBy: 'admin-1' },
      inviteStore,
      retreatStore,
    )
    const second = await ensureRetreatRegistrationInvite(
      claims,
      { retreatId: 'retreat-1', createdBy: 'admin-2' },
      inviteStore,
      retreatStore,
    )

    expect(second).toEqual(first)
    expect(second.createdBy).toBe('admin-1')
  })
})
