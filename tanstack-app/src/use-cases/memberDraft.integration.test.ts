import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Invite } from '#/domain/types'

const PROJECT_ID = 'demo-khatsi-member-draft-usecase'

let testEnv: RulesTestEnvironment
// See src/repositories/*.integration.test.ts for why this is inferred
// rather than imported from 'firebase/firestore' directly.
let adminDb: ReturnType<ReturnType<RulesTestEnvironment['unauthenticatedContext']>['firestore']>

vi.mock('#/firebase/firestore', () => ({
  getClientFirestore: () => adminDb,
}))

const TOKEN = 'public'
const CCCD = '012345678901'

function publicInvite(): Invite {
  return {
    id: TOKEN,
    token: TOKEN,
    createdAt: '2026-07-19T00:00:00.000Z',
    createdBy: 'integration-test',
  }
}

beforeEach(async () => {
  if (!testEnv) {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: 'service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if true; } } }',
        host: '127.0.0.1',
        port: 8080,
      },
    })
  }
  await testEnv.clearFirestore()
  adminDb = testEnv.unauthenticatedContext().firestore()

  const { inviteRepo } = await import('#/repositories/inviteRepo')
  await inviteRepo.create(publicInvite())
})

afterAll(async () => {
  if (testEnv) await testEnv.cleanup()
})

describe('member draft emulator smoke', () => {
  it('creates draft, resumes for edit, locks, and blocks further saves', async () => {
    const { saveMemberDraft } = await import('./saveMemberDraft')
    const { resumeMemberByCccd } = await import('./resumeMemberByCccd')
    const { lockMember } = await import('./lockMember')

    const saved = await saveMemberDraft({
      token: TOKEN,
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      cccd: CCCD,
      patch: { phapDanh: 'Minh Tam' },
    })

    expect(saved.mode).toBe('created')
    expect(saved.member).toMatchObject({
      id: 'gd-i_tang_012345678901',
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      cccd: CCCD,
      status: 'draft',
      phapDanh: 'Minh Tam',
    })

    const resumed = await resumeMemberByCccd({
      token: TOKEN,
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      cccd: CCCD,
    })
    expect(resumed.access).toBe('edit')
    expect(resumed.member.id).toBe(saved.member.id)

    await lockMember({ memberId: saved.member.id, lockedBy: 'admin-1' })

    await expect(
      saveMemberDraft({
        token: TOKEN,
        orgUnitId: 'gd-i',
        sanghaType: 'tang',
        cccd: CCCD,
        patch: { phapDanh: 'Should not write' },
      }),
    ).rejects.toMatchObject({ code: 'RECORD_LOCKED' })

    const resumedAfterLock = await resumeMemberByCccd({
      token: TOKEN,
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      cccd: CCCD,
    })
    expect(resumedAfterLock.access).toBe('view')
  })
})
