import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, setDoc } from 'firebase/firestore'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const PROJECT_ID = 'demo-khatsi-temple-repo'
const INVITE_ID = 'invite-temple-1'

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
    formType: 'temple',
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

describe('templeRepo.createOrUpdateDraft', () => {
  it('creates a temple and indexes it by each manager phone', async () => {
    const { templeRepo } = await import('#/repositories/templeRepo')

    const { temple, mode } = await templeRepo.createOrUpdateDraft({
      orgUnitId: 'gd-i',
      inviteId: INVITE_ID,
      managerPhones: ['0912345678', '0987654321'],
      patch: { danhHieu: 'Chua ABC' },
    })

    expect(mode).toBe('created')
    expect(temple).toMatchObject({ orgUnitId: 'gd-i', status: 'draft', danhHieu: 'Chua ABC' })

    const found = await templeRepo.listByOrgAndPhone({ orgUnitId: 'gd-i', phone: '0912345678' })
    expect(found.map((t) => t.id)).toEqual([temple.id])
    const foundOther = await templeRepo.listByOrgAndPhone({ orgUnitId: 'gd-i', phone: '0987654321' })
    expect(foundOther.map((t) => t.id)).toEqual([temple.id])
  })

  it('rejects updating a temple from a different org unit, and rejects when locked', async () => {
    const { templeRepo } = await import('#/repositories/templeRepo')
    const { temple } = await templeRepo.createOrUpdateDraft({
      orgUnitId: 'gd-i',
      inviteId: INVITE_ID,
      managerPhones: ['0912345678'],
      patch: {},
    })

    await expect(
      templeRepo.createOrUpdateDraft({
        orgUnitId: 'gd-ii',
        inviteId: INVITE_ID,
        managerPhones: ['0912345678'],
        templeId: temple.id,
        patch: {},
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    await templeRepo.lock(temple.id, 'admin-1')
    await expect(
      templeRepo.createOrUpdateDraft({
        orgUnitId: 'gd-i',
        inviteId: INVITE_ID,
        managerPhones: ['0912345678'],
        templeId: temple.id,
        patch: {},
      }),
    ).rejects.toMatchObject({ code: 'RECORD_LOCKED' })
  })

  it('refreshes inviteId to the current one on update', async () => {
    const { templeRepo } = await import('#/repositories/templeRepo')
    const { temple } = await templeRepo.createOrUpdateDraft({
      orgUnitId: 'gd-i',
      inviteId: INVITE_ID,
      managerPhones: ['0912345678'],
      patch: {},
    })

    const otherInvite = 'invite-temple-2'
    await setDoc(doc(adminDb, 'invites', otherInvite), {
      token: otherInvite,
      orgUnitId: 'gd-i',
      formType: 'temple',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'admin-uid',
    })

    const updated = await templeRepo.createOrUpdateDraft({
      orgUnitId: 'gd-i',
      inviteId: otherInvite,
      managerPhones: ['0912345678'],
      templeId: temple.id,
      patch: { danhHieu: 'Updated' },
    })

    expect(updated.temple.inviteId).toBe(otherInvite)
    expect(updated.temple.danhHieu).toBe('Updated')
  })

  it('does not duplicate a temple id in the phone index on repeated saves', async () => {
    const { templeRepo } = await import('#/repositories/templeRepo')
    const { temple } = await templeRepo.createOrUpdateDraft({
      orgUnitId: 'gd-i',
      inviteId: INVITE_ID,
      managerPhones: ['0912345678'],
      patch: {},
    })
    await templeRepo.createOrUpdateDraft({
      orgUnitId: 'gd-i',
      inviteId: INVITE_ID,
      managerPhones: ['0912345678'],
      templeId: temple.id,
      patch: { danhHieu: 'again' },
    })

    const found = await templeRepo.listByOrgAndPhone({ orgUnitId: 'gd-i', phone: '0912345678' })
    expect(found.map((t) => t.id)).toEqual([temple.id])
  })
})

describe('templeRepo.list / lock / unlock', () => {
  it('filters by orgUnitId/status and paginates', async () => {
    const { templeRepo } = await import('#/repositories/templeRepo')
    for (const phone of ['0911111111', '0922222222', '0933333333']) {
      await templeRepo.createOrUpdateDraft({
        orgUnitId: 'gd-i',
        inviteId: INVITE_ID,
        managerPhones: [phone],
        patch: {},
      })
    }

    const page1 = await templeRepo.list({ orgUnitId: 'gd-i', limit: 2 })
    expect(page1.items).toHaveLength(2)
    expect(page1.nextCursor).not.toBeNull()
    const page2 = await templeRepo.list({ orgUnitId: 'gd-i', limit: 2, cursor: page1.nextCursor! })
    expect(page2.items).toHaveLength(1)
  })

  it('lock/unlock round-trip, unlock is idempotent while draft', async () => {
    const { templeRepo } = await import('#/repositories/templeRepo')
    const { temple } = await templeRepo.createOrUpdateDraft({
      orgUnitId: 'gd-i',
      inviteId: INVITE_ID,
      managerPhones: ['0912345678'],
      patch: {},
    })

    const stillDraft = await templeRepo.unlock(temple.id)
    expect(stillDraft.status).toBe('draft')

    const locked = await templeRepo.lock(temple.id, 'admin-1')
    expect(locked.status).toBe('locked')

    const unlocked = await templeRepo.unlock(temple.id)
    expect(unlocked.status).toBe('draft')
    expect(unlocked.lockedAt).toBeNull()
  })
})
