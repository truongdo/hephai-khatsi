import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('#/firebase/admin', async () => {
  const testAdmin = await import('#/firebase/testAdmin')
  return {
    getAdminApp: testAdmin.getTestAdminApp,
    getAdminDb: testAdmin.getTestAdminDb,
    getAdminStorage: () => {
      throw new Error('getAdminStorage is not available in integration tests')
    },
  }
})

import { memberCccdIndexId } from '#/domain/memberCccdIndex'
import type { Invite } from '#/domain/types'
import { COLLECTIONS } from '#/firebase/collections'
import { clearFirestoreEmulator, getTestAdminDb } from '#/firebase/testAdmin'
import { inviteRepo } from '#/repositories/inviteRepo'
import { lockMember } from './lockMember'
import { resumeMemberByCccd } from './resumeMemberByCccd'
import { saveMemberDraft } from './saveMemberDraft'

const TOKEN = 'smoke-member-tang'
const CCCD = '012345678901'

function memberTangInvite(): Invite {
  return {
    id: TOKEN,
    token: TOKEN,
    orgUnitId: 'gd-i',
    formType: 'member_tang',
    createdAt: '2026-07-19T00:00:00.000Z',
    createdBy: 'integration-test',
  }
}

describe('member draft emulator smoke', () => {
  beforeAll(async () => {
    await clearFirestoreEmulator()
  })

  beforeEach(async () => {
    await clearFirestoreEmulator()
    await inviteRepo.create(memberTangInvite())
  })

  it('creates draft, resumes for edit, locks, and blocks further saves', async () => {
    const saved = await saveMemberDraft({
      token: TOKEN,
      cccd: CCCD,
      patch: { phapDanh: 'Minh Tam' },
    })

    expect(saved.mode).toBe('created')
    expect(saved.member).toMatchObject({
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      cccd: CCCD,
      status: 'draft',
      phapDanh: 'Minh Tam',
    })

    const resumed = await resumeMemberByCccd({ token: TOKEN, cccd: CCCD })
    expect(resumed.access).toBe('edit')
    expect(resumed.member.id).toBe(saved.member.id)

    await lockMember({ memberId: saved.member.id, lockedBy: 'admin-1' })

    await expect(
      saveMemberDraft({
        token: TOKEN,
        cccd: CCCD,
        patch: { phapDanh: 'Should not write' },
      }),
    ).rejects.toMatchObject({ code: 'RECORD_LOCKED' })

    const indexId = memberCccdIndexId('gd-i', 'tang', CCCD)
    const indexSnap = await getTestAdminDb()
      .collection(COLLECTIONS.memberCccdIndex)
      .doc(indexId)
      .get()

    expect(indexSnap.exists).toBe(true)
    expect(indexSnap.data()).toMatchObject({
      memberId: saved.member.id,
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      cccd: CCCD,
    })
  })
})
