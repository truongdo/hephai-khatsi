import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  doc,
  getDoc,
  getDocs,
  collection as fsCollection,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { afterAll, beforeEach, describe, it } from 'vitest'

const PROJECT_ID = 'demo-khatsi-rules'

let testEnv: RulesTestEnvironment

async function getTestEnv(): Promise<RulesTestEnvironment> {
  if (testEnv) return testEnv
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(__dirname, '../../../firebase/firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
  return testEnv
}

const INVITE_ID = 'public'

async function seed() {
  const env = await getTestEnv()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'orgUnits/gd-i'), { code: 'gd-i', name: 'Giáo đoàn I', kind: 'giao_doan', order: 1, allowsTang: true, allowsNi: true })
    await setDoc(doc(db, 'invites', INVITE_ID), {
      token: INVITE_ID, createdAt: '2026-01-01T00:00:00.000Z', createdBy: 'admin-uid',
    })
  })
}

function memberDraft(overrides: Record<string, unknown> = {}) {
  return {
    orgUnitId: 'gd-i',
    sanghaType: 'tang',
    status: 'draft',
    cccd: '012345678901',
    inviteId: INVITE_ID,
    currentTempleId: null,
    photoPath: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    ...overrides,
  }
}

function templeDraft(overrides: Record<string, unknown> = {}) {
  return {
    orgUnitId: 'gd-i',
    status: 'draft',
    managerPhones: ['0912345678'],
    inviteId: INVITE_ID,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    ...overrides,
  }
}

beforeEach(async () => {
  const env = await getTestEnv()
  await env.clearFirestore()
  await seed()
})

afterAll(async () => {
  if (testEnv) await testEnv.cleanup()
})

describe('orgUnits', () => {
  it('anyone can read, only admin can write', async () => {
    const env = await getTestEnv()
    const anon = env.unauthenticatedContext().firestore()
    await assertSucceeds(getDoc(doc(anon, 'orgUnits/gd-i')))
    await assertFails(setDoc(doc(anon, 'orgUnits/gd-ii'), { code: 'gd-ii', name: 'x', kind: 'giao_doan', order: 2, allowsTang: true, allowsNi: false }))

    const admin = env.authenticatedContext('admin-uid', { admin: true }).firestore()
    await assertSucceeds(setDoc(doc(admin, 'orgUnits/gd-ii'), { code: 'gd-ii', name: 'x', kind: 'giao_doan', order: 2, allowsTang: true, allowsNi: false }))
  })
})

describe('invites', () => {
  it('anyone can get the one invite by id, but not list; only admin can create', async () => {
    const env = await getTestEnv()
    const anon = env.unauthenticatedContext().firestore()
    await assertSucceeds(getDoc(doc(anon, 'invites', INVITE_ID)))
    await assertFails(getDocs(fsCollection(anon, 'invites')))
    await assertFails(
      setDoc(doc(anon, 'invites', 'forged'), { token: 'forged', createdAt: '2026-01-01T00:00:00.000Z', createdBy: 'anon' }),
    )

    const admin = env.authenticatedContext('admin-uid', { admin: true }).firestore()
    await assertSucceeds(
      setDoc(doc(admin, 'invites', 'other'), { token: 'other', createdAt: '2026-01-01T00:00:00.000Z', createdBy: 'admin-uid' }),
    )
  })

  it('rejects a create where createdBy does not match the caller uid', async () => {
    const env = await getTestEnv()
    const admin = env.authenticatedContext('admin-uid', { admin: true }).firestore()
    await assertFails(
      setDoc(doc(admin, 'invites', 'spoofed'), { token: 'spoofed', createdAt: '2026-01-01T00:00:00.000Z', createdBy: 'someone-else' }),
    )
  })
})

describe('members', () => {
  const memberId = 'gd-i_tang_012345678901'

  it('allows a public create for any org unit / sangha type, gated only on a valid invite id', async () => {
    const env = await getTestEnv()
    const anon = env.unauthenticatedContext().firestore()
    await assertSucceeds(setDoc(doc(anon, 'members', memberId), memberDraft()))
    await assertSucceeds(
      setDoc(doc(anon, 'members', 'gd-ii_ni_012345678902'), memberDraft({ orgUnitId: 'gd-ii', sanghaType: 'ni', cccd: '012345678902' })),
    )
  })

  it('rejects create when the doc id does not match orgUnitId_sanghaType_cccd', async () => {
    const env = await getTestEnv()
    const anon = env.unauthenticatedContext().firestore()
    await assertFails(setDoc(doc(anon, 'members', 'wrong-id'), memberDraft()))
  })

  it('rejects create with an invite id that does not exist', async () => {
    const env = await getTestEnv()
    const anon = env.unauthenticatedContext().firestore()
    await assertFails(setDoc(doc(anon, 'members', memberId), memberDraft({ inviteId: 'does-not-exist' })))
  })

  it('lets the public flow read and update a draft, but not change status/lock fields', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'members', memberId), memberDraft())
    })
    const anon = env.unauthenticatedContext().firestore()
    await assertSucceeds(getDoc(doc(anon, 'members', memberId)))
    await assertSucceeds(updateDoc(doc(anon, 'members', memberId), { theDanh: 'Nguyen Van A', updatedAt: '2026-01-02T00:00:00.000Z' }))
    await assertFails(updateDoc(doc(anon, 'members', memberId), { status: 'locked' }))
    await assertFails(updateDoc(doc(anon, 'members', memberId), { orgUnitId: 'gd-ii' }))
  })

  it('blocks public updates once the record is locked', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'members', memberId), memberDraft({ status: 'locked', lockedAt: '2026-01-02T00:00:00.000Z', lockedBy: 'admin-uid' }))
    })
    const anon = env.unauthenticatedContext().firestore()
    await assertFails(updateDoc(doc(anon, 'members', memberId), { theDanh: 'Should fail' }))
  })

  it('lets admin lock and unlock regardless of current status, but not sneak in profile edits during a lock transition', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'members', memberId), memberDraft())
    })
    const admin = env.authenticatedContext('admin-uid', { admin: true }).firestore()
    await assertSucceeds(
      updateDoc(doc(admin, 'members', memberId), { status: 'locked', lockedAt: '2026-01-02T00:00:00.000Z', lockedBy: 'admin-uid', updatedAt: '2026-01-02T00:00:00.000Z' }),
    )
    await assertFails(
      updateDoc(doc(admin, 'members', memberId), { status: 'draft', lockedAt: null, lockedBy: null, theDanh: 'sneaky', updatedAt: '2026-01-02T00:01:00.000Z' }),
    )
  })

  it('restricts listing to admins only', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'members', memberId), memberDraft())
    })
    const anon = env.unauthenticatedContext().firestore()
    await assertFails(getDocs(fsCollection(anon, 'members')))
    const admin = env.authenticatedContext('admin-uid', { admin: true }).firestore()
    await assertSucceeds(getDocs(fsCollection(admin, 'members')))
  })
})

describe('temples', () => {
  it('allows a public create for any org unit, gated only on a valid invite id', async () => {
    const env = await getTestEnv()
    const anon = env.unauthenticatedContext().firestore()
    await assertSucceeds(setDoc(doc(anon, 'temples', 'temple-1'), templeDraft()))
    await assertSucceeds(setDoc(doc(anon, 'temples', 'temple-2'), templeDraft({ orgUnitId: 'gd-ii' })))
  })

  it('rejects create with an invite id that does not exist', async () => {
    const env = await getTestEnv()
    const anon = env.unauthenticatedContext().firestore()
    await assertFails(setDoc(doc(anon, 'temples', 'temple-1'), templeDraft({ inviteId: 'does-not-exist' })))
  })

  it('lets anyone holding the invite update an unlocked temple', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'temples', 'temple-1'), templeDraft())
    })
    const anon = env.unauthenticatedContext().firestore()
    await assertSucceeds(
      updateDoc(doc(anon, 'temples', 'temple-1'), { danhHieu: 'Chua ABC', updatedAt: '2026-01-02T00:00:00.000Z' }),
    )
  })

  it('blocks updates once locked, and blocks changing orgUnitId', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'temples', 'temple-1'), templeDraft({ status: 'locked', lockedAt: '2026-01-02T00:00:00.000Z', lockedBy: 'admin-uid' }))
    })
    const anon = env.unauthenticatedContext().firestore()
    await assertFails(updateDoc(doc(anon, 'temples', 'temple-1'), { danhHieu: 'x' }))

    const admin = env.authenticatedContext('admin-uid', { admin: true }).firestore()
    await assertFails(updateDoc(doc(admin, 'temples', 'temple-1'), { orgUnitId: 'gd-ii' }))
  })
})

describe('templeManagerPhoneIndex', () => {
  it('anyone can get, only admin can list, and the id list can only grow up to the cap', async () => {
    const env = await getTestEnv()
    const anon = env.unauthenticatedContext().firestore()
    await assertSucceeds(setDoc(doc(anon, 'templeManagerPhoneIndex', 'gd-i_0912345678'), { templeIds: ['temple-1'] }))
    await assertSucceeds(getDoc(doc(anon, 'templeManagerPhoneIndex', 'gd-i_0912345678')))
    await assertFails(getDocs(fsCollection(anon, 'templeManagerPhoneIndex')))
    await assertFails(updateDoc(doc(anon, 'templeManagerPhoneIndex', 'gd-i_0912345678'), { templeIds: [] }))
  })
})

describe('memberPhoneIndex', () => {
  it('anyone can get, only admin can list, and the id list can only grow up to the cap', async () => {
    const env = await getTestEnv()
    const anon = env.unauthenticatedContext().firestore()
    await assertSucceeds(
      setDoc(doc(anon, 'memberPhoneIndex', 'gd-i_tang_0912345678'), {
        memberIds: ['member-1'],
      }),
    )
    await assertSucceeds(getDoc(doc(anon, 'memberPhoneIndex', 'gd-i_tang_0912345678')))
    await assertFails(getDocs(fsCollection(anon, 'memberPhoneIndex')))
    await assertFails(
      updateDoc(doc(anon, 'memberPhoneIndex', 'gd-i_tang_0912345678'), {
        memberIds: [],
      }),
    )
  })
})

describe('memberCccdIndex (retired collection)', () => {
  it('has no rules matched, so it defaults to fully denied', async () => {
    const env = await getTestEnv()
    const anon = env.unauthenticatedContext().firestore()
    await assertFails(setDoc(doc(anon, 'memberCccdIndex', 'anything'), { a: 1 }))
    await assertFails(getDoc(doc(anon, 'memberCccdIndex', 'anything')))
  })
})
