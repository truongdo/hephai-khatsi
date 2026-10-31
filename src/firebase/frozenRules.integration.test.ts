import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'

// The read-only rules of the D1 cutover freeze: the app keeps reading
// Firestore, nobody (staff or filler) can write.
const PROJECT_ID = 'demo-khatsi-frozen-rules'
const MEMBER_ID = 'gd-i_tang_012345678901'

const member = {
  orgUnitId: 'gd-i',
  sanghaType: 'tang',
  status: 'locked',
  cccd: '012345678901',
  inviteId: 'public',
  currentTempleId: null,
  photoPath: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  lockedAt: '2026-01-01T00:00:00.000Z',
  lockedBy: 'filler',
  editRequestedAt: null,
  editRequestedBy: null,
}

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(__dirname, '../../firebase/firestore.frozen.rules'), 'utf8'),
      host: '127.0.0.1',
      port: Number(process.env.FIRESTORE_EMULATOR_PORT ?? 8080),
    },
  })
  await testEnv.clearFirestore()
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'orgUnits/gd-i'), { code: 'gd-i', name: 'Giáo đoàn I', kind: 'giao_doan', order: 1, allowsTang: true, allowsNi: true })
    await setDoc(doc(db, 'invites/public'), { token: 'public', createdAt: '2026-01-01T00:00:00.000Z', createdBy: 'admin-uid' })
    await setDoc(doc(db, 'members', MEMBER_ID), member)
    await setDoc(doc(db, 'members', MEMBER_ID, 'auditLogs', 'log-1'), {
      action: 'created', at: '2026-01-01T00:00:00.000Z', actorType: 'filler', actorId: 'public', changes: [],
    })
  })
})

afterAll(async () => {
  await testEnv?.cleanup()
})

describe('frozen rules', () => {
  it('keeps the reads of the live rules', async () => {
    const anon = testEnv.unauthenticatedContext().firestore()
    await assertSucceeds(getDocs(collection(anon, 'orgUnits')))
    await assertSucceeds(getDoc(doc(anon, 'invites/public')))
    await assertSucceeds(getDoc(doc(anon, 'members', MEMBER_ID)))
    await assertFails(getDocs(collection(anon, 'members')))

    const admin = testEnv.authenticatedContext('admin-uid', { role: 'he_phai_admin' }).firestore()
    await assertSucceeds(getDocs(query(collection(admin, 'members'), where('orgUnitId', '==', 'gd-i'))))
    await assertSucceeds(getDocs(collection(admin, 'members', MEMBER_ID, 'auditLogs')))
  })

  it('denies staff writes', async () => {
    const admin = testEnv.authenticatedContext('admin-uid', { role: 'he_phai_admin' }).firestore()
    await assertFails(setDoc(doc(admin, 'orgUnits/gd-x'), { code: 'gd-x' }))
    await assertFails(setDoc(doc(admin, 'members', 'gd-i_tang_099999999999'), {
      ...member, cccd: '099999999999', status: 'draft', inviteId: null, lockedAt: null, lockedBy: null,
    }))
    await assertFails(updateDoc(doc(admin, 'members', MEMBER_ID), { status: 'draft', lockedAt: null, lockedBy: null }))
    await assertFails(deleteDoc(doc(admin, 'members', MEMBER_ID)))
    await assertFails(setDoc(doc(admin, 'retreats/r-1'), {
      type: 'giao_doan', status: 'draft', orgUnitId: 'gd-i', createdBy: 'admin-uid',
    }))
  })

  it('denies filler writes', async () => {
    const anon = testEnv.unauthenticatedContext().firestore()
    await assertFails(setDoc(doc(anon, 'members', 'gd-i_tang_088888888888'), { ...member, cccd: '088888888888' }))
    await assertFails(updateDoc(doc(anon, 'members', MEMBER_ID), {
      editRequestedAt: '2026-01-02T00:00:00.000Z', editRequestedBy: 'filler',
    }))
    await assertFails(setDoc(doc(anon, 'memberPhoneIndex/gd-i_tang_0912345678'), { memberIds: [MEMBER_ID] }))
  })
})
