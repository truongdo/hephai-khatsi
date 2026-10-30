import { describe, expect, it, vi } from 'vitest'
import type { AuthClaims } from '#/domain/authClaims'
import type { Retreat } from '#/domain/retreat'
import {
  retreatRegistrationId,
  type RetreatRegistration,
} from '#/domain/retreatRegistration'
import type { RetreatStore } from '#/repositories/retreatRepo'
import type {
  RegistrationReviewPatch,
  RetreatRegistrationStore,
} from '#/repositories/retreatRegistrationRepo'
import { reviewRetreatRegistrations } from './reviewRetreatRegistrations'

const NOW = '2026-07-20T10:00:00.000Z'

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

function sampleRegistration(
  overrides: Partial<RetreatRegistration> & Pick<RetreatRegistration, 'retreatId' | 'memberId'>,
): RetreatRegistration {
  const id = retreatRegistrationId(overrides.retreatId, overrides.memberId)
  return {
    id,
    retreatId: overrides.retreatId,
    memberId: overrides.memberId,
    orgUnitId: overrides.orgUnitId ?? 'gd-i',
    registeredVia: overrides.registeredVia ?? 'self',
    registeredBy: overrides.registeredBy ?? null,
    extraAnswers: overrides.extraAnswers ?? {},
    status: overrides.status ?? 'pending',
    rejectionReason: overrides.rejectionReason ?? null,
    approvedBy: overrides.approvedBy ?? null,
    approvedAt: overrides.approvedAt ?? null,
    createdAt: overrides.createdAt ?? NOW,
    updatedAt: overrides.updatedAt ?? NOW,
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
): RetreatRegistrationStore & {
  registrations: Map<string, RetreatRegistration>
  updateReview: ReturnType<typeof vi.fn>
} {
  const registrations = new Map(seed.map((reg) => [reg.id, reg]))
  const updateReview = vi.fn(async (ids: string[], patch: RegistrationReviewPatch) => {
    for (const id of ids) {
      const existing = registrations.get(id)
      if (!existing) throw new Error(`Missing registration ${id}`)
      registrations.set(id, { ...existing, ...patch })
    }
  })
  return {
    registrations,
    updateReview,
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

const gdAdminClaims: AuthClaims = { role: 'giao_doan_admin', orgUnitId: 'gd-i' }

describe('reviewRetreatRegistrations', () => {
  it('approves pending registrations and clears rejection reason', async () => {
    const reg = sampleRegistration({ retreatId: 'retreat-1', memberId: 'gd-i_tang_001' })
    const retreatStore = memoryRetreatStore([
      sampleRetreat({ id: 'retreat-1', orgUnitId: 'gd-i' }),
    ])
    const registrationStore = memoryRegistrationStore([reg])

    await reviewRetreatRegistrations(
      {
        claims: gdAdminClaims,
        reviewerUid: 'admin-1',
        retreatId: 'retreat-1',
        ids: [reg.id],
        decision: 'approved',
        nowIso: NOW,
      },
      { retreatStore, registrationStore },
    )

    expect(registrationStore.updateReview).toHaveBeenCalledWith([reg.id], {
      status: 'approved',
      approvedBy: 'admin-1',
      approvedAt: NOW,
      updatedAt: NOW,
      rejectionReason: null,
    })
    expect(await registrationStore.getById(reg.id)).toMatchObject({
      status: 'approved',
      approvedBy: 'admin-1',
      approvedAt: NOW,
      rejectionReason: null,
      updatedAt: NOW,
    })
  })

  it('rejects with trimmed reason or null when blank', async () => {
    const regA = sampleRegistration({ retreatId: 'retreat-1', memberId: 'gd-i_tang_001' })
    const regB = sampleRegistration({ retreatId: 'retreat-1', memberId: 'gd-i_tang_002' })
    const retreatStore = memoryRetreatStore([
      sampleRetreat({ id: 'retreat-1', orgUnitId: 'gd-i' }),
    ])
    const registrationStore = memoryRegistrationStore([regA, regB])

    await reviewRetreatRegistrations(
      {
        claims: gdAdminClaims,
        reviewerUid: 'admin-1',
        retreatId: 'retreat-1',
        ids: [regA.id],
        decision: 'rejected',
        rejectionReason: '  lý do  ',
        nowIso: NOW,
      },
      { retreatStore, registrationStore },
    )

    expect(await registrationStore.getById(regA.id)).toMatchObject({
      status: 'rejected',
      rejectionReason: 'lý do',
    })

    await reviewRetreatRegistrations(
      {
        claims: gdAdminClaims,
        reviewerUid: 'admin-1',
        retreatId: 'retreat-1',
        ids: [regB.id],
        decision: 'rejected',
        rejectionReason: '   ',
        nowIso: NOW,
      },
      { retreatStore, registrationStore },
    )

    expect(await registrationStore.getById(regB.id)).toMatchObject({
      status: 'rejected',
      rejectionReason: null,
    })
  })

  it('does not call updateReview when any registration is not pending', async () => {
    const pending = sampleRegistration({ retreatId: 'retreat-1', memberId: 'gd-i_tang_001' })
    const approved = sampleRegistration({
      retreatId: 'retreat-1',
      memberId: 'gd-i_tang_002',
      status: 'approved',
      approvedBy: 'other-admin',
      approvedAt: NOW,
    })
    const retreatStore = memoryRetreatStore([
      sampleRetreat({ id: 'retreat-1', orgUnitId: 'gd-i' }),
    ])
    const registrationStore = memoryRegistrationStore([pending, approved])

    await expect(
      reviewRetreatRegistrations(
        {
          claims: gdAdminClaims,
          reviewerUid: 'admin-1',
          retreatId: 'retreat-1',
          ids: [pending.id, approved.id],
          decision: 'approved',
          nowIso: NOW,
        },
        { retreatStore, registrationStore },
      ),
    ).rejects.toMatchObject({ code: 'INVALID_STATUS' })

    expect(registrationStore.updateReview).not.toHaveBeenCalled()
    expect(await registrationStore.getById(pending.id)).toMatchObject({ status: 'pending' })
  })

  it('fails when giao_doan_admin cannot access retreat org unit', async () => {
    const reg = sampleRegistration({ retreatId: 'retreat-1', memberId: 'gd-ii_tang_001', orgUnitId: 'gd-ii' })
    const retreatStore = memoryRetreatStore([
      sampleRetreat({ id: 'retreat-1', orgUnitId: 'gd-ii' }),
    ])
    const registrationStore = memoryRegistrationStore([reg])

    await expect(
      reviewRetreatRegistrations(
        {
          claims: gdAdminClaims,
          reviewerUid: 'admin-1',
          retreatId: 'retreat-1',
          ids: [reg.id],
          decision: 'approved',
          nowIso: NOW,
        },
        { retreatStore, registrationStore },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    expect(registrationStore.updateReview).not.toHaveBeenCalled()
  })

  it('succeeds when retreat status is closed', async () => {
    const reg = sampleRegistration({ retreatId: 'retreat-1', memberId: 'gd-i_tang_001' })
    const retreatStore = memoryRetreatStore([
      sampleRetreat({ id: 'retreat-1', orgUnitId: 'gd-i', status: 'closed' }),
    ])
    const registrationStore = memoryRegistrationStore([reg])

    await reviewRetreatRegistrations(
      {
        claims: gdAdminClaims,
        reviewerUid: 'admin-1',
        retreatId: 'retreat-1',
        ids: [reg.id],
        decision: 'approved',
        nowIso: NOW,
      },
      { retreatStore, registrationStore },
    )

    expect(await registrationStore.getById(reg.id)).toMatchObject({ status: 'approved' })
  })

  it('fails when ids is empty', async () => {
    const retreatStore = memoryRetreatStore([
      sampleRetreat({ id: 'retreat-1', orgUnitId: 'gd-i' }),
    ])
    const registrationStore = memoryRegistrationStore()

    await expect(
      reviewRetreatRegistrations(
        {
          claims: gdAdminClaims,
          reviewerUid: 'admin-1',
          retreatId: 'retreat-1',
          ids: [],
          decision: 'approved',
          nowIso: NOW,
        },
        { retreatStore, registrationStore },
      ),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' })

    expect(registrationStore.updateReview).not.toHaveBeenCalled()
  })
})
