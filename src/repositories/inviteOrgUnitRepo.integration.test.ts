import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const PROJECT_ID = 'demo-khatsi-invite-orgunit-repo'

let testEnv: RulesTestEnvironment
// Inferred rather than imported from 'firebase/firestore' directly: the
// rules-unit-testing package resolves its own Firestore type identity that
// isn't structurally assignable to the wrapper package's exported type.
let adminDb: ReturnType<ReturnType<RulesTestEnvironment['unauthenticatedContext']>['firestore']>

vi.mock('#/firebase/firestore', () => ({
  getClientFirestore: () => adminDb,
}))

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
})

afterAll(async () => {
  if (testEnv) await testEnv.cleanup()
})

describe('inviteRepo', () => {
  it('creates the one invite and gets it by token/id', async () => {
    const { inviteRepo, PUBLIC_INVITE_ID } = await import('#/repositories/inviteRepo')

    await inviteRepo.create({
      id: PUBLIC_INVITE_ID,
      token: PUBLIC_INVITE_ID,
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'admin-1',
    })

    const byToken = await inviteRepo.getByToken(PUBLIC_INVITE_ID)
    expect(byToken).toMatchObject({ id: PUBLIC_INVITE_ID, createdBy: 'admin-1' })
    expect(await inviteRepo.getByToken('missing')).toBeNull()
  })
})

describe('orgUnitRepo', () => {
  it('seeds via upsertAllOrgUnits and lists ordered by `order`', async () => {
    const { upsertAllOrgUnits, listOrgUnits, getOrgUnitById } = await import('#/repositories/orgUnitRepo')

    await upsertAllOrgUnits()

    const all = await listOrgUnits()
    expect(all.length).toBeGreaterThan(0)
    expect(all).toEqual([...all].sort((a, b) => a.order - b.order))

    const one = await getOrgUnitById(all[0]!.id)
    expect(one?.id).toBe(all[0]!.id)
    expect(await getOrgUnitById('does-not-exist')).toBeNull()
  })
})
