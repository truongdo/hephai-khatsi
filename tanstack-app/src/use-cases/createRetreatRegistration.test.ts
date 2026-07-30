import { describe, expect, it } from 'vitest'
import type { AuthClaims } from '#/domain/authClaims'
import type { Retreat } from '#/domain/retreat'
import {
  retreatRegistrationId,
  type RetreatRegistration,
} from '#/domain/retreatRegistration'
import type { Member } from '#/domain/types'
import type { MemberStore } from '#/repositories/memberRepo'
import type { RetreatStore } from '#/repositories/retreatRepo'
import type { RetreatRegistrationStore } from '#/repositories/retreatRegistrationRepo'
import { createMemoryMemberStore } from '#/test/memoryStores'
import { createRetreatRegistration } from './createRetreatRegistration'

const NOW = '2026-07-15T12:00:00.000Z'

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

function sampleMember(overrides: Partial<Member> & Pick<Member, 'id'>): Member {
  return {
    orgUnitId: 'gd-i',
    sanghaType: 'tang',
    status: 'draft',
    cccd: '123456789012',
    inviteId: null,
    currentTempleId: null,
    photoPath: null,
    createdAt: '2026-07-19T00:00:00.000Z',
    updatedAt: '2026-07-19T00:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    ...overrides,
  }
}

function memoryRetreatStore(retreats: Retreat[]): Pick<RetreatStore, 'getById'> {
  const map = new Map(retreats.map((retreat) => [retreat.id, retreat]))
  return {
    async getById(id: string) {
      return map.get(id) ?? null
    },
  }
}

function memoryRegistrationStore(
  seed: RetreatRegistration[] = [],
): RetreatRegistrationStore & { registrations: Map<string, RetreatRegistration> } {
  const registrations = new Map(seed.map((reg) => [reg.id, reg]))
  return {
    registrations,
    async create(reg: RetreatRegistration) {
      registrations.set(reg.id, reg)
    },
    async getById(id: string) {
      return registrations.get(id) ?? null
    },
    async listByRetreat() {
      return { items: [], nextCursor: null }
    },
  }
}

function setupDeps(options: {
  retreat?: Retreat
  member?: Member
  registrations?: RetreatRegistration[]
}) {
  const retreatStore = memoryRetreatStore(
    options.retreat ? [options.retreat] : [],
  )
  const memberStore = createMemoryMemberStore(
    options.member ? [options.member] : [],
  )
  const registrationStore = memoryRegistrationStore(options.registrations ?? [])
  return { retreatStore, memberStore, registrationStore }
}

describe('createRetreatRegistration', () => {
  it('creates self registration with pending status', async () => {
    const retreat = sampleRetreat({ id: 'retreat-1', orgUnitId: 'gd-i' })
    const member = sampleMember({ id: 'gd-i_tang_001', orgUnitId: 'gd-i' })
    const { retreatStore, memberStore, registrationStore } = setupDeps({
      retreat,
      member,
    })

    const result = await createRetreatRegistration(
      {
        claims: null,
        retreatId: 'retreat-1',
        memberId: 'gd-i_tang_001',
        registeredVia: 'self',
        registeredBy: null,
        extraAnswers: {},
        nowIso: NOW,
      },
      { retreatStore, memberStore, registrationStore },
    )

    expect(result).toMatchObject({
      id: retreatRegistrationId('retreat-1', 'gd-i_tang_001'),
      retreatId: 'retreat-1',
      memberId: 'gd-i_tang_001',
      orgUnitId: 'gd-i',
      registeredVia: 'self',
      registeredBy: null,
      extraAnswers: {},
      status: 'pending',
      approvedBy: null,
      approvedAt: null,
      createdAt: NOW,
      updatedAt: NOW,
    })
    expect(
      await registrationStore.getById(
        retreatRegistrationId('retreat-1', 'gd-i_tang_001'),
      ),
    ).toEqual(result)
  })

  it('creates proxy registration when admin has access', async () => {
    const retreat = sampleRetreat({ id: 'retreat-1', orgUnitId: 'gd-i' })
    const member = sampleMember({ id: 'gd-i_tang_001', orgUnitId: 'gd-i' })
    const { retreatStore, memberStore, registrationStore } = setupDeps({
      retreat,
      member,
    })
    const claims: AuthClaims = { role: 'giao_doan_admin', orgUnitId: 'gd-i' }

    const result = await createRetreatRegistration(
      {
        claims,
        retreatId: 'retreat-1',
        memberId: 'gd-i_tang_001',
        registeredVia: 'proxy',
        registeredBy: 'admin-1',
        extraAnswers: { room: 'A1' },
        nowIso: NOW,
      },
      { retreatStore, memberStore, registrationStore },
    )

    expect(result).toMatchObject({
      registeredVia: 'proxy',
      registeredBy: 'admin-1',
      extraAnswers: { room: 'A1' },
      status: 'pending',
      approvedBy: null,
      approvedAt: null,
    })
  })

  it('rejects when registration window is closed', async () => {
    const retreat = sampleRetreat({ id: 'retreat-1', orgUnitId: 'gd-i' })
    const member = sampleMember({ id: 'gd-i_tang_001', orgUnitId: 'gd-i' })
    const { retreatStore, memberStore, registrationStore } = setupDeps({
      retreat,
      member,
    })

    await expect(
      createRetreatRegistration(
        {
          claims: null,
          retreatId: 'retreat-1',
          memberId: 'gd-i_tang_001',
          registeredVia: 'self',
          registeredBy: null,
          extraAnswers: {},
          nowIso: '2026-07-25T00:00:00.000Z',
        },
        { retreatStore, memberStore, registrationStore },
      ),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })

  it('rejects self registration when quyen is proxy_only', async () => {
    const retreat = sampleRetreat({
      id: 'retreat-1',
      orgUnitId: 'gd-i',
      quyenDangKy: 'proxy_only',
    })
    const member = sampleMember({ id: 'gd-i_tang_001', orgUnitId: 'gd-i' })
    const { retreatStore, memberStore, registrationStore } = setupDeps({
      retreat,
      member,
    })

    await expect(
      createRetreatRegistration(
        {
          claims: null,
          retreatId: 'retreat-1',
          memberId: 'gd-i_tang_001',
          registeredVia: 'self',
          registeredBy: null,
          extraAnswers: {},
          nowIso: NOW,
        },
        { retreatStore, memberStore, registrationStore },
      ),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })

  it('rejects when member org unit does not match retreat', async () => {
    const retreat = sampleRetreat({ id: 'retreat-1', orgUnitId: 'gd-i' })
    const member = sampleMember({ id: 'gd-ii_tang_001', orgUnitId: 'gd-ii' })
    const { retreatStore, memberStore, registrationStore } = setupDeps({
      retreat,
      member,
    })

    await expect(
      createRetreatRegistration(
        {
          claims: null,
          retreatId: 'retreat-1',
          memberId: 'gd-ii_tang_001',
          registeredVia: 'self',
          registeredBy: null,
          extraAnswers: {},
          nowIso: NOW,
        },
        { retreatStore, memberStore, registrationStore },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects duplicate registration', async () => {
    const retreat = sampleRetreat({ id: 'retreat-1', orgUnitId: 'gd-i' })
    const member = sampleMember({ id: 'gd-i_tang_001', orgUnitId: 'gd-i' })
    const existingId = retreatRegistrationId('retreat-1', 'gd-i_tang_001')
    const { retreatStore, memberStore, registrationStore } = setupDeps({
      retreat,
      member,
      registrations: [
        {
          id: existingId,
          retreatId: 'retreat-1',
          memberId: 'gd-i_tang_001',
          orgUnitId: 'gd-i',
          registeredVia: 'self',
          registeredBy: null,
          extraAnswers: {},
          status: 'pending',
          approvedBy: null,
          approvedAt: null,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    })

    await expect(
      createRetreatRegistration(
        {
          claims: null,
          retreatId: 'retreat-1',
          memberId: 'gd-i_tang_001',
          registeredVia: 'self',
          registeredBy: null,
          extraAnswers: {},
          nowIso: NOW,
        },
        { retreatStore, memberStore, registrationStore },
      ),
    ).rejects.toMatchObject({ code: 'ALREADY_EXISTS' })
  })

  it('rejects proxy registration without claims', async () => {
    const retreat = sampleRetreat({ id: 'retreat-1', orgUnitId: 'gd-i' })
    const member = sampleMember({ id: 'gd-i_tang_001', orgUnitId: 'gd-i' })
    const { retreatStore, memberStore, registrationStore } = setupDeps({
      retreat,
      member,
    })

    await expect(
      createRetreatRegistration(
        {
          claims: null,
          retreatId: 'retreat-1',
          memberId: 'gd-i_tang_001',
          registeredVia: 'proxy',
          registeredBy: 'admin-1',
          extraAnswers: {},
          nowIso: NOW,
        },
        { retreatStore, memberStore, registrationStore },
      ),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})
