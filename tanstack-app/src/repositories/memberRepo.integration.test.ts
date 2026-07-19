import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, setDoc } from 'firebase/firestore'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const PROJECT_ID = 'demo-khatsi-member-repo'
const INVITE_ID = 'invite-member-1'

let testEnv: RulesTestEnvironment
// Inferred rather than imported from 'firebase/firestore' directly: the
// rules-unit-testing package resolves its own Firestore type identity that
// isn't structurally assignable to the wrapper package's exported type.
let adminDb: ReturnType<ReturnType<RulesTestEnvironment['unauthenticatedContext']>['firestore']>

vi.mock('#/firebase/firestore', () => ({
  getClientFirestore: () => adminDb,
}))

async function seedInvite() {
  await setDoc(doc(adminDb, 'invites', INVITE_ID), {
    token: INVITE_ID,
    orgUnitId: 'gd-i',
    formType: 'member_tang',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'admin-uid',
  })
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
  await seedInvite()
})

afterAll(async () => {
  if (testEnv) await testEnv.cleanup()
})

describe('memberRepo.createOrUpdateDraft', () => {
  it('creates a member with a deterministic id and ignores forged identity fields in the patch', async () => {
    const { memberRepo } = await import('#/repositories/memberRepo')

    const { member, mode } = await memberRepo.createOrUpdateDraft({
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      inviteId: INVITE_ID,
      cccd: '012345678901',
      patch: { orgUnitId: 'forged-org', status: 'locked', phapDanh: 'Minh Tam' } as never,
    })

    expect(mode).toBe('created')
    expect(member).toMatchObject({
      id: 'gd-i_tang_012345678901',
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      status: 'draft',
      cccd: '012345678901',
      inviteId: INVITE_ID,
      phapDanh: 'Minh Tam',
    })
  })

  it('finds and updates the same member again via CCCD, refreshing inviteId to the current one', async () => {
    const { memberRepo } = await import('#/repositories/memberRepo')

    const created = await memberRepo.createOrUpdateDraft({
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      inviteId: INVITE_ID,
      cccd: '012345678901',
      patch: { phapDanh: 'Minh Tam' },
    })

    const otherInvite = 'invite-member-2'
    await setDoc(doc(adminDb, 'invites', otherInvite), {
      token: otherInvite,
      orgUnitId: 'gd-i',
      formType: 'member_tang',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'admin-uid',
    })

    const updated = await memberRepo.createOrUpdateDraft({
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      inviteId: otherInvite,
      cccd: '012345678901',
      patch: { orgUnitId: 'forged-org', status: 'locked', phapDanh: 'Minh Tue' } as never,
    })

    expect(updated.mode).toBe('updated')
    expect(updated.member).toMatchObject({
      id: created.member.id,
      orgUnitId: 'gd-i',
      status: 'draft',
      phapDanh: 'Minh Tue',
      inviteId: otherInvite,
    })
  })

  it('rejects further saves once the member is locked', async () => {
    const { memberRepo } = await import('#/repositories/memberRepo')

    const created = await memberRepo.createOrUpdateDraft({
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      inviteId: INVITE_ID,
      cccd: '012345678901',
      patch: {},
    })
    await memberRepo.lock(created.member.id, 'admin-1')

    await expect(
      memberRepo.createOrUpdateDraft({
        orgUnitId: 'gd-i',
        sanghaType: 'tang',
        inviteId: INVITE_ID,
        cccd: '012345678901',
        patch: { phapDanh: 'Should not write' },
      }),
    ).rejects.toMatchObject({ code: 'RECORD_LOCKED' })
  })
})

describe('memberRepo.updateDraftById / getByCccd / lock / unlock', () => {
  it('updates by id without touching identity fields, and getByCccd resolves the same doc', async () => {
    const { memberRepo } = await import('#/repositories/memberRepo')

    const created = await memberRepo.createOrUpdateDraft({
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      inviteId: INVITE_ID,
      cccd: '012345678901',
      patch: { phapDanh: 'Minh Tam' },
    })

    const updated = await memberRepo.updateDraftById(created.member.id, {
      phapDanh: 'Minh Tue',
      orgUnitId: 'forged-org',
      status: 'locked',
    } as never)

    expect(updated).toMatchObject({
      id: created.member.id,
      orgUnitId: 'gd-i',
      status: 'draft',
      phapDanh: 'Minh Tue',
      inviteId: INVITE_ID,
    })

    const byCccd = await memberRepo.getByCccd({ orgUnitId: 'gd-i', sanghaType: 'tang', cccd: '012345678901' })
    expect(byCccd?.id).toBe(created.member.id)
    expect(byCccd?.phapDanh).toBe('Minh Tue')
  })

  it('unlock is idempotent and lock/unlock round-trip correctly', async () => {
    const { memberRepo } = await import('#/repositories/memberRepo')

    const created = await memberRepo.createOrUpdateDraft({
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      inviteId: INVITE_ID,
      cccd: '012345678901',
      patch: {},
    })

    const stillDraft = await memberRepo.unlock(created.member.id)
    expect(stillDraft.status).toBe('draft')

    const locked = await memberRepo.lock(created.member.id, 'admin-1')
    expect(locked.status).toBe('locked')
    expect(locked.lockedBy).toBe('admin-1')

    const unlocked = await memberRepo.unlock(created.member.id)
    expect(unlocked.status).toBe('draft')
    expect(unlocked.lockedAt).toBeNull()
    expect(unlocked.lockedBy).toBeNull()
  })

  it('throws NOT_FOUND for a missing member id', async () => {
    const { memberRepo } = await import('#/repositories/memberRepo')
    await expect(
      memberRepo.updateDraftById('missing', { phapDanh: 'X' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('memberRepo.list', () => {
  it('filters by sanghaType/orgUnitId/status and paginates', async () => {
    const { memberRepo } = await import('#/repositories/memberRepo')

    for (const cccd of ['012345678901', '012345678902', '012345678903']) {
      await memberRepo.createOrUpdateDraft({
        orgUnitId: 'gd-i',
        sanghaType: 'tang',
        inviteId: INVITE_ID,
        cccd,
        patch: {},
      })
    }

    const page1 = await memberRepo.list({ sanghaType: 'tang', orgUnitId: 'gd-i', limit: 2 })
    expect(page1.items).toHaveLength(2)
    expect(page1.nextCursor).not.toBeNull()

    const page2 = await memberRepo.list({
      sanghaType: 'tang',
      orgUnitId: 'gd-i',
      limit: 2,
      cursor: page1.nextCursor!,
    })
    expect(page2.items).toHaveLength(1)
    expect(page2.nextCursor).toBeNull()
  })
})
