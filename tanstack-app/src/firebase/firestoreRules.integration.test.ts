import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  collection as fsCollection,
  query,
  setDoc,
  updateDoc,
  where,
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
    editRequestedAt: null,
    editRequestedBy: null,
    ...overrides,
  }
}

function templeDraft(overrides: Record<string, unknown> = {}) {
  return {
    orgUnitId: 'gd-i',
    status: 'draft',
    managerPhones: ['0912345678'],
    inviteId: INVITE_ID,
    photoPath: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    editRequestedAt: null,
    editRequestedBy: null,
    ...overrides,
  }
}

function memberLocked(overrides: Record<string, unknown> = {}) {
  return memberDraft({
    status: 'locked',
    lockedAt: '2026-01-01T00:00:00.000Z',
    lockedBy: 'filler',
    editRequestedAt: null,
    editRequestedBy: null,
    ...overrides,
  })
}

function templeLocked(overrides: Record<string, unknown> = {}) {
  return templeDraft({
    status: 'locked',
    lockedAt: '2026-01-01T00:00:00.000Z',
    lockedBy: 'filler',
    editRequestedAt: null,
    editRequestedBy: null,
    ...overrides,
  })
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

  it('rejects filler create with draft status', async () => {
    const env = await getTestEnv()
    const anon = env.unauthenticatedContext().firestore()
    await assertFails(setDoc(doc(anon, 'members', memberId), memberDraft()))
    await assertFails(
      setDoc(doc(anon, 'members', 'gd-ii_ni_012345678902'), memberDraft({ orgUnitId: 'gd-ii', sanghaType: 'ni', cccd: '012345678902' })),
    )
  })

  it('allows filler create when status is locked by filler with null edit-request fields', async () => {
    const env = await getTestEnv()
    const anon = env.unauthenticatedContext().firestore()
    await assertSucceeds(setDoc(doc(anon, 'members', memberId), memberLocked()))
    await assertSucceeds(
      setDoc(
        doc(anon, 'members', 'gd-ii_ni_012345678902'),
        memberLocked({ orgUnitId: 'gd-ii', sanghaType: 'ni', cccd: '012345678902' }),
      ),
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

  it('rejects kiem_soat create even with a valid invite', async () => {
    const env = await getTestEnv()
    const ks = env.authenticatedContext('ks', {
      role: 'kiem_soat',
      orgUnitId: 'gd-i',
    }).firestore()
    await assertFails(setDoc(doc(ks, 'members', memberId), memberDraft()))
  })

  it('lets filler read a draft but not persist profile changes without locking', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'members', memberId), memberDraft())
    })
    const anon = env.unauthenticatedContext().firestore()
    await assertSucceeds(getDoc(doc(anon, 'members', memberId)))
    await assertFails(updateDoc(doc(anon, 'members', memberId), { theDanh: 'Nguyen Van A', updatedAt: '2026-01-02T00:00:00.000Z' }))
    await assertFails(updateDoc(doc(anon, 'members', memberId), { status: 'locked' }))
    await assertFails(updateDoc(doc(anon, 'members', memberId), { orgUnitId: 'gd-ii' }))
  })

  it('allows filler draft to locked save-and-lock with profile changes', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'members', memberId), memberDraft())
    })
    const anon = env.unauthenticatedContext().firestore()
    await assertSucceeds(
      updateDoc(doc(anon, 'members', memberId), {
        theDanh: 'Nguyen Van A',
        status: 'locked',
        lockedAt: '2026-01-02T00:00:00.000Z',
        lockedBy: 'filler',
        editRequestedAt: null,
        editRequestedBy: null,
        updatedAt: '2026-01-02T00:00:00.000Z',
      }),
    )
  })

  it('blocks filler profile updates on locked records', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'members', memberId),
        memberLocked({ lockedAt: '2026-01-02T00:00:00.000Z' }),
      )
    })
    const anon = env.unauthenticatedContext().firestore()
    await assertFails(updateDoc(doc(anon, 'members', memberId), { theDanh: 'Should fail', updatedAt: '2026-01-03T00:00:00.000Z' }))
  })

  it('allows filler edit-request on locked record', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'members', memberId),
        memberLocked({ lockedAt: '2026-01-02T00:00:00.000Z' }),
      )
    })
    const anon = env.unauthenticatedContext().firestore()
    await assertSucceeds(
      updateDoc(doc(anon, 'members', memberId), {
        editRequestedAt: '2026-01-03T00:00:00.000Z',
        editRequestedBy: '0912345678',
        updatedAt: '2026-01-03T00:00:00.000Z',
      }),
    )
  })

  it('allows filler photoPath update on locked record', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'members', memberId),
        memberLocked({ lockedAt: '2026-01-02T00:00:00.000Z', photoPath: null }),
      )
    })
    const anon = env.unauthenticatedContext().firestore()
    await assertSucceeds(
      updateDoc(doc(anon, 'members', memberId), {
        photoPath: 'members/gd-i_tang_012345678901/photo.jpg',
        updatedAt: '2026-01-03T00:00:00.000Z',
      }),
    )
  })

  it('denies filler photoPath replace when locked record already has a photo', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'members', memberId),
        memberLocked({
          lockedAt: '2026-01-02T00:00:00.000Z',
          photoPath: 'members/gd-i_tang_012345678901/photo.jpg',
        }),
      )
    })
    const anon = env.unauthenticatedContext().firestore()
    await assertFails(
      updateDoc(doc(anon, 'members', memberId), {
        photoPath: 'members/gd-i_tang_012345678901/photo-replaced.jpg',
        updatedAt: '2026-01-03T00:00:00.000Z',
      }),
    )
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

  it('lets admin unlock clear edit-request fields', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'members', memberId),
        memberLocked({
          lockedAt: '2026-01-02T00:00:00.000Z',
          lockedBy: 'filler',
          editRequestedAt: '2026-01-03T00:00:00.000Z',
          editRequestedBy: '0912345678',
        }),
      )
    })
    const admin = env.authenticatedContext('admin-uid', { admin: true }).firestore()
    await assertSucceeds(
      updateDoc(doc(admin, 'members', memberId), {
        status: 'draft',
        lockedAt: null,
        lockedBy: null,
        editRequestedAt: null,
        editRequestedBy: null,
        updatedAt: '2026-01-04T00:00:00.000Z',
      }),
    )
  })

  it('allows admin to update profile fields on a locked member without unlocking', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'members', memberId),
        memberDraft({
          status: 'locked',
          lockedAt: '2026-01-02T00:00:00.000Z',
          lockedBy: 'admin-uid',
          photoPath: null,
        }),
      )
    })
    const admin = env.authenticatedContext('admin-uid', { admin: true }).firestore()
    await assertSucceeds(
      updateDoc(doc(admin, 'members', memberId), {
        phapDanh: 'Updated',
        photoPath: 'members/gd-i_tang_012345678901/photo.jpg',
        updatedAt: '2026-01-03T00:00:00.000Z',
      }),
    )
    // still cannot change org unit
    await assertFails(updateDoc(doc(admin, 'members', memberId), { orgUnitId: 'gd-ii' }))
    // anon still blocked
    const anon = env.unauthenticatedContext().firestore()
    await assertFails(updateDoc(doc(anon, 'members', memberId), { phapDanh: 'x' }))
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

  it('allows admin delete but denies unauthenticated delete', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'members', memberId), memberDraft())
    })
    const anon = env.unauthenticatedContext().firestore()
    await assertFails(deleteDoc(doc(anon, 'members', memberId)))

    const admin = env.authenticatedContext('admin-uid', { admin: true }).firestore()
    await assertSucceeds(deleteDoc(doc(admin, 'members', memberId)))
  })
})

describe('temples', () => {
  it('rejects filler create with draft status', async () => {
    const env = await getTestEnv()
    const anon = env.unauthenticatedContext().firestore()
    await assertFails(setDoc(doc(anon, 'temples', 'temple-1'), templeDraft()))
    await assertFails(setDoc(doc(anon, 'temples', 'temple-2'), templeDraft({ orgUnitId: 'gd-ii' })))
  })

  it('allows filler create when status is locked by filler with null edit-request fields', async () => {
    const env = await getTestEnv()
    const anon = env.unauthenticatedContext().firestore()
    await assertSucceeds(setDoc(doc(anon, 'temples', 'temple-1'), templeLocked()))
    await assertSucceeds(setDoc(doc(anon, 'temples', 'temple-2'), templeLocked({ orgUnitId: 'gd-ii' })))
  })

  it('rejects create with an invite id that does not exist', async () => {
    const env = await getTestEnv()
    const anon = env.unauthenticatedContext().firestore()
    await assertFails(setDoc(doc(anon, 'temples', 'temple-1'), templeDraft({ inviteId: 'does-not-exist' })))
  })

  it('blocks filler profile updates on draft without locking', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'temples', 'temple-1'), templeDraft())
    })
    const anon = env.unauthenticatedContext().firestore()
    await assertFails(
      updateDoc(doc(anon, 'temples', 'temple-1'), { danhHieu: 'Chua ABC', updatedAt: '2026-01-02T00:00:00.000Z' }),
    )
  })

  it('allows filler draft to locked save-and-lock with profile changes', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'temples', 'temple-1'), templeDraft())
    })
    const anon = env.unauthenticatedContext().firestore()
    await assertSucceeds(
      updateDoc(doc(anon, 'temples', 'temple-1'), {
        danhHieu: 'Chua ABC',
        status: 'locked',
        lockedAt: '2026-01-02T00:00:00.000Z',
        lockedBy: 'filler',
        editRequestedAt: null,
        editRequestedBy: null,
        updatedAt: '2026-01-02T00:00:00.000Z',
      }),
    )
  })

  it('blocks filler profile updates on locked temples', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'temples', 'temple-1'),
        templeLocked({ lockedAt: '2026-01-02T00:00:00.000Z' }),
      )
    })
    const anon = env.unauthenticatedContext().firestore()
    await assertFails(updateDoc(doc(anon, 'temples', 'temple-1'), { danhHieu: 'x', updatedAt: '2026-01-03T00:00:00.000Z' }))

    const admin = env.authenticatedContext('admin-uid', { admin: true }).firestore()
    await assertFails(updateDoc(doc(admin, 'temples', 'temple-1'), { orgUnitId: 'gd-ii' }))
  })

  it('allows filler edit-request and photoPath update on locked temple', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'temples', 'temple-1'),
        templeLocked({ lockedAt: '2026-01-02T00:00:00.000Z', photoPath: null }),
      )
    })
    const anon = env.unauthenticatedContext().firestore()
    await assertSucceeds(
      updateDoc(doc(anon, 'temples', 'temple-1'), {
        editRequestedAt: '2026-01-03T00:00:00.000Z',
        editRequestedBy: '0912345678',
        updatedAt: '2026-01-03T00:00:00.000Z',
      }),
    )
    await assertSucceeds(
      updateDoc(doc(anon, 'temples', 'temple-1'), {
        photoPath: 'temples/temple-1/photo.jpg',
        updatedAt: '2026-01-04T00:00:00.000Z',
      }),
    )
  })

  it('denies filler photoPath replace when locked temple already has a photo', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'temples', 'temple-1'),
        templeLocked({
          lockedAt: '2026-01-02T00:00:00.000Z',
          photoPath: 'temples/temple-1/photo.jpg',
        }),
      )
    })
    const anon = env.unauthenticatedContext().firestore()
    await assertFails(
      updateDoc(doc(anon, 'temples', 'temple-1'), {
        photoPath: 'temples/temple-1/photo-replaced.jpg',
        updatedAt: '2026-01-04T00:00:00.000Z',
      }),
    )
  })

  it('allows admin to update profile fields on a locked temple without unlocking', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'temples', 'temple-1'),
        templeDraft({
          status: 'locked',
          lockedAt: '2026-01-02T00:00:00.000Z',
          lockedBy: 'admin-uid',
          photoPath: null,
        }),
      )
    })
    const admin = env.authenticatedContext('admin-uid', { admin: true }).firestore()
    await assertSucceeds(
      updateDoc(doc(admin, 'temples', 'temple-1'), {
        danhHieu: 'Updated',
        photoPath: 'temples/temple-1/photo.jpg',
        updatedAt: '2026-01-03T00:00:00.000Z',
      }),
    )
    // still cannot change org unit
    await assertFails(updateDoc(doc(admin, 'temples', 'temple-1'), { orgUnitId: 'gd-ii' }))
    // anon still blocked
    const anon = env.unauthenticatedContext().firestore()
    await assertFails(updateDoc(doc(anon, 'temples', 'temple-1'), { danhHieu: 'x' }))
  })

  it('allows admin delete but denies unauthenticated delete', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'temples', 'temple-1'), templeDraft())
    })
    const anon = env.unauthenticatedContext().firestore()
    await assertFails(deleteDoc(doc(anon, 'temples', 'temple-1')))

    const admin = env.authenticatedContext('admin-uid', { admin: true }).firestore()
    await assertSucceeds(deleteDoc(doc(admin, 'temples', 'temple-1')))
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

  it('allows admin to shrink or delete index docs; anon cannot shrink or delete', async () => {
    const env = await getTestEnv()
    const indexId = 'gd-i_0912345678'
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'templeManagerPhoneIndex', indexId), { templeIds: ['temple-1', 'temple-2'] })
    })
    const anon = env.unauthenticatedContext().firestore()
    await assertFails(updateDoc(doc(anon, 'templeManagerPhoneIndex', indexId), { templeIds: ['temple-1'] }))
    await assertFails(deleteDoc(doc(anon, 'templeManagerPhoneIndex', indexId)))

    const admin = env.authenticatedContext('admin-uid', { admin: true }).firestore()
    await assertSucceeds(updateDoc(doc(admin, 'templeManagerPhoneIndex', indexId), { templeIds: ['temple-1'] }))
    await assertSucceeds(deleteDoc(doc(admin, 'templeManagerPhoneIndex', indexId)))
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

  it('allows admin to shrink or delete index docs; anon cannot shrink or delete', async () => {
    const env = await getTestEnv()
    const indexId = 'gd-i_tang_0912345678'
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'memberPhoneIndex', indexId), { memberIds: ['member-1', 'member-2'] })
    })
    const anon = env.unauthenticatedContext().firestore()
    await assertFails(updateDoc(doc(anon, 'memberPhoneIndex', indexId), { memberIds: ['member-1'] }))
    await assertFails(deleteDoc(doc(anon, 'memberPhoneIndex', indexId)))

    const admin = env.authenticatedContext('admin-uid', { admin: true }).firestore()
    await assertSucceeds(updateDoc(doc(admin, 'memberPhoneIndex', indexId), { memberIds: ['member-1'] }))
    await assertSucceeds(deleteDoc(doc(admin, 'memberPhoneIndex', indexId)))
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

function retreatDraft(overrides: Record<string, unknown> = {}) {
  return {
    type: 'giao_doan',
    orgUnitId: 'gd-i',
    name: 'Khoa',
    diaDiem: 'TX',
    noiDung: 'n',
    doiTuongThamDu: 't',
    thoiGianBatDau: '2026-08-01T00:00:00.000Z',
    thoiGianKetThuc: '2026-08-07T00:00:00.000Z',
    dangKyMoTu: '2026-07-01T00:00:00.000Z',
    dangKyDongLuc: '2026-07-20T00:00:00.000Z',
    extraFields: [],
    quyenDangKy: 'both',
    status: 'draft',
    createdBy: 'gd-admin',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

async function seedRetreatsAcrossOrgs(env: RulesTestEnvironment) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'orgUnits/gd-ii'), {
      code: 'gd-ii',
      name: 'Giáo đoàn II',
      kind: 'giao_doan',
      order: 2,
      allowsTang: true,
      allowsNi: true,
    })
    await setDoc(doc(db, 'retreats/r-gd-i'), retreatDraft({ orgUnitId: 'gd-i', createdBy: 'admin-uid' }))
    await setDoc(
      doc(db, 'retreats/r-gd-ii'),
      retreatDraft({ orgUnitId: 'gd-ii', name: 'Other org', createdBy: 'admin-uid' }),
    )
    await setDoc(
      doc(db, 'retreats/r-open'),
      retreatDraft({
        orgUnitId: 'gd-i',
        status: 'open',
        createdBy: 'admin-uid',
        updatedAt: '2026-01-02T00:00:00.000Z',
      }),
    )
  })
}

describe('retreats + role claims', () => {
  it('giao_doan_admin can create/get in own org; get by id is public, write to other org denied', async () => {
    const env = await getTestEnv()
    await seedRetreatsAcrossOrgs(env)
    const gd = env.authenticatedContext('gd-admin', {
      role: 'giao_doan_admin',
      orgUnitId: 'gd-i',
    }).firestore()
    await assertSucceeds(setDoc(doc(gd, 'retreats/r1'), retreatDraft({ createdBy: 'gd-admin' })))
    await assertSucceeds(getDoc(doc(gd, 'retreats/r-gd-i')))
    await assertSucceeds(getDoc(doc(gd, 'retreats/r-gd-ii')))
    await assertFails(
      setDoc(doc(gd, 'retreats/r2'), retreatDraft({ orgUnitId: 'gd-ii', createdBy: 'gd-admin' })),
    )
  })

  it('anonymous user can get a retreat by id', async () => {
    const env = await getTestEnv()
    await seedRetreatsAcrossOrgs(env)
    const anon = env.unauthenticatedContext().firestore()
    await assertSucceeds(getDoc(doc(anon, 'retreats/r-open')))
  })

  it('giao_doan_admin list requires orgUnitId filter matching claim', async () => {
    const env = await getTestEnv()
    await seedRetreatsAcrossOrgs(env)
    const gd = env.authenticatedContext('gd-admin', {
      role: 'giao_doan_admin',
      orgUnitId: 'gd-i',
    }).firestore()
    await assertFails(getDocs(fsCollection(gd, 'retreats')))
    await assertSucceeds(
      getDocs(query(fsCollection(gd, 'retreats'), where('orgUnitId', '==', 'gd-i'))),
    )
  })

  it('kiem_soat can get retreat by id but cannot list or write retreats or orgUnits', async () => {
    const env = await getTestEnv()
    await seedRetreatsAcrossOrgs(env)
    const ks = env.authenticatedContext('ks', {
      role: 'kiem_soat',
      orgUnitId: 'gd-i',
    }).firestore()
    await assertSucceeds(getDoc(doc(ks, 'retreats/r-gd-i')))
    await assertFails(getDocs(fsCollection(ks, 'retreats')))
    await assertFails(
      getDocs(query(fsCollection(ks, 'retreats'), where('orgUnitId', '==', 'gd-i'))),
    )
    await assertFails(setDoc(doc(ks, 'retreats/r1'), retreatDraft({ createdBy: 'ks' })))
    await assertFails(
      setDoc(doc(ks, 'orgUnits/gd-x'), {
        code: 'gd-x',
        name: 'x',
        kind: 'giao_doan',
        order: 9,
        allowsTang: true,
        allowsNi: true,
      }),
    )
  })

  it('rejects invalid retreat status transitions at the rules layer', async () => {
    const env = await getTestEnv()
    await seedRetreatsAcrossOrgs(env)
    const admin = env.authenticatedContext('admin-uid', { admin: true }).firestore()
    await assertFails(
      updateDoc(doc(admin, 'retreats/r-open'), {
        status: 'draft',
        updatedAt: '2026-01-03T00:00:00.000Z',
      }),
    )
    await assertSucceeds(
      updateDoc(doc(admin, 'retreats/r-open'), {
        status: 'closed',
        updatedAt: '2026-01-03T00:00:00.000Z',
      }),
    )
    await assertSucceeds(
      updateDoc(doc(admin, 'retreats/r-open'), {
        name: 'Updated name',
        updatedAt: '2026-01-04T00:00:00.000Z',
      }),
    )
  })

  it('legacy admin:true can still write orgUnits and retreats', async () => {
    const env = await getTestEnv()
    const admin = env.authenticatedContext('admin-uid', { admin: true }).firestore()
    await assertSucceeds(
      setDoc(doc(admin, 'retreats/r3'), retreatDraft({ createdBy: 'admin-uid' })),
    )
  })
})

const RETREAT_ID = 'r-open'
const MEMBER_ID = 'gd-i_tang_012345678901'
const REGISTRATION_ID = `${RETREAT_ID}_${MEMBER_ID}`

function registrationDraft(overrides: Record<string, unknown> = {}) {
  return {
    retreatId: RETREAT_ID,
    memberId: MEMBER_ID,
    orgUnitId: 'gd-i',
    registeredVia: 'self',
    registeredBy: null,
    extraAnswers: {},
    status: 'pending',
    approvedBy: null,
    approvedAt: null,
    rejectionReason: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

async function seedRegistrationsAcrossOrgs(env: RulesTestEnvironment) {
  await seedRetreatsAcrossOrgs(env)
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(
      doc(db, 'retreatRegistrations', REGISTRATION_ID),
      registrationDraft(),
    )
    await setDoc(
      doc(db, 'retreatRegistrations', `r-gd-ii_${MEMBER_ID}`),
      registrationDraft({
        retreatId: 'r-gd-ii',
        orgUnitId: 'gd-ii',
      }),
    )
  })
}

describe('invites retreat_registration', () => {
  it('allows admin to create a retreat registration invite', async () => {
    const env = await getTestEnv()
    await seedRetreatsAcrossOrgs(env)
    const admin = env.authenticatedContext('admin-uid', { admin: true }).firestore()
    await assertSucceeds(
      setDoc(doc(admin, 'invites', 'retreat_r-open'), {
        token: 'retreat_r-open',
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: 'admin-uid',
        kind: 'retreat_registration',
        retreatId: 'r-open',
        orgUnitId: 'gd-i',
      }),
    )
  })
})

describe('retreatRegistrations', () => {
  it('allows anonymous self registration with pending shape', async () => {
    const env = await getTestEnv()
    await seedRetreatsAcrossOrgs(env)
    const anon = env.unauthenticatedContext().firestore()
    await assertSucceeds(
      setDoc(doc(anon, 'retreatRegistrations', REGISTRATION_ID), registrationDraft()),
    )
  })

  it('allows anonymous getById (duplicate check before create)', async () => {
    const env = await getTestEnv()
    await seedRegistrationsAcrossOrgs(env)
    const anon = env.unauthenticatedContext().firestore()
    await assertSucceeds(getDoc(doc(anon, 'retreatRegistrations', REGISTRATION_ID)))
    await assertSucceeds(
      getDoc(doc(anon, 'retreatRegistrations', `${RETREAT_ID}_missing_member`)),
    )
  })

  it('allows signed-in staff to create self registration (public /r while logged in)', async () => {
    const env = await getTestEnv()
    await seedRetreatsAcrossOrgs(env)
    const admin = env.authenticatedContext('admin-uid', { admin: true }).firestore()
    const id = `${RETREAT_ID}_gd-i_tang_self_staff`
    await assertSucceeds(
      setDoc(
        doc(admin, 'retreatRegistrations', id),
        registrationDraft({
          memberId: 'gd-i_tang_self_staff',
          registeredVia: 'self',
          registeredBy: null,
        }),
      ),
    )
  })

  it('denies anonymous list', async () => {
    const env = await getTestEnv()
    await seedRegistrationsAcrossOrgs(env)
    const anon = env.unauthenticatedContext().firestore()
    await assertFails(getDocs(fsCollection(anon, 'retreatRegistrations')))
  })

  it('giao_doan_admin list own org succeeds; public get allows cross-org doc by id', async () => {
    const env = await getTestEnv()
    await seedRegistrationsAcrossOrgs(env)
    const gd = env.authenticatedContext('gd-admin', {
      role: 'giao_doan_admin',
      orgUnitId: 'gd-i',
    }).firestore()
    await assertSucceeds(
      getDocs(
        query(
          fsCollection(gd, 'retreatRegistrations'),
          where('retreatId', '==', RETREAT_ID),
          where('orgUnitId', '==', 'gd-i'),
        ),
      ),
    )
    await assertSucceeds(getDoc(doc(gd, 'retreatRegistrations', `r-gd-ii_${MEMBER_ID}`)))
  })

  it('allows he_phai_admin to approve own-org registration', async () => {
    const env = await getTestEnv()
    await seedRegistrationsAcrossOrgs(env)
    const hp = env.authenticatedContext('hp-admin', { role: 'he_phai_admin' }).firestore()
    await assertSucceeds(
      updateDoc(doc(hp, 'retreatRegistrations', REGISTRATION_ID), {
        status: 'approved',
        approvedBy: 'hp-admin',
        approvedAt: '2026-01-02T00:00:00.000Z',
        rejectionReason: null,
        updatedAt: '2026-01-02T00:00:00.000Z',
      }),
    )
  })

  it('allows giao_doan_admin to approve and reject own-org registration', async () => {
    const env = await getTestEnv()
    await seedRegistrationsAcrossOrgs(env)
    const gd = env.authenticatedContext('gd-admin', {
      role: 'giao_doan_admin',
      orgUnitId: 'gd-i',
    }).firestore()

    const approveId = `${RETREAT_ID}_gd-i_tang_approve`
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'retreatRegistrations', approveId),
        registrationDraft({ memberId: 'gd-i_tang_approve' }),
      )
    })
    await assertSucceeds(
      updateDoc(doc(gd, 'retreatRegistrations', approveId), {
        status: 'approved',
        approvedBy: 'gd-admin',
        approvedAt: '2026-01-02T00:00:00.000Z',
        rejectionReason: null,
        updatedAt: '2026-01-02T00:00:00.000Z',
      }),
    )

    const rejectNoReasonId = `${RETREAT_ID}_gd-i_tang_reject_no_reason`
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'retreatRegistrations', rejectNoReasonId),
        registrationDraft({ memberId: 'gd-i_tang_reject_no_reason' }),
      )
    })
    await assertSucceeds(
      updateDoc(doc(gd, 'retreatRegistrations', rejectNoReasonId), {
        status: 'rejected',
        approvedBy: 'gd-admin',
        approvedAt: '2026-01-02T00:00:00.000Z',
        rejectionReason: null,
        updatedAt: '2026-01-02T00:00:00.000Z',
      }),
    )

    const rejectWithReasonId = `${RETREAT_ID}_gd-i_tang_reject_with_reason`
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'retreatRegistrations', rejectWithReasonId),
        registrationDraft({ memberId: 'gd-i_tang_reject_with_reason' }),
      )
    })
    await assertSucceeds(
      updateDoc(doc(gd, 'retreatRegistrations', rejectWithReasonId), {
        status: 'rejected',
        approvedBy: 'gd-admin',
        approvedAt: '2026-01-02T00:00:00.000Z',
        rejectionReason: 'Không đủ điều kiện',
        updatedAt: '2026-01-02T00:00:00.000Z',
      }),
    )
  })

  it('denies anonymous update of registration status', async () => {
    const env = await getTestEnv()
    await seedRegistrationsAcrossOrgs(env)
    const anon = env.unauthenticatedContext().firestore()
    await assertFails(
      updateDoc(doc(anon, 'retreatRegistrations', REGISTRATION_ID), {
        status: 'approved',
        approvedBy: 'anon',
        approvedAt: '2026-01-02T00:00:00.000Z',
        rejectionReason: null,
        updatedAt: '2026-01-02T00:00:00.000Z',
      }),
    )
  })

  it('denies giao_doan_admin cross-org registration update', async () => {
    const env = await getTestEnv()
    await seedRegistrationsAcrossOrgs(env)
    const gd = env.authenticatedContext('gd-admin', {
      role: 'giao_doan_admin',
      orgUnitId: 'gd-i',
    }).firestore()
    await assertFails(
      updateDoc(doc(gd, 'retreatRegistrations', `r-gd-ii_${MEMBER_ID}`), {
        status: 'approved',
        approvedBy: 'gd-admin',
        approvedAt: '2026-01-02T00:00:00.000Z',
        rejectionReason: null,
        updatedAt: '2026-01-02T00:00:00.000Z',
      }),
    )
  })

  it('denies update when registration is already approved', async () => {
    const env = await getTestEnv()
    await seedRegistrationsAcrossOrgs(env)
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'retreatRegistrations', REGISTRATION_ID),
        registrationDraft({
          status: 'approved',
          approvedBy: 'admin-uid',
          approvedAt: '2026-01-02T00:00:00.000Z',
        }),
      )
    })
    const admin = env.authenticatedContext('admin-uid', { admin: true }).firestore()
    await assertFails(
      updateDoc(doc(admin, 'retreatRegistrations', REGISTRATION_ID), {
        status: 'rejected',
        approvedBy: 'admin-uid',
        approvedAt: '2026-01-03T00:00:00.000Z',
        rejectionReason: 'Too late',
        updatedAt: '2026-01-03T00:00:00.000Z',
      }),
    )
  })

  it('denies changing memberId alongside status review', async () => {
    const env = await getTestEnv()
    await seedRegistrationsAcrossOrgs(env)
    const admin = env.authenticatedContext('admin-uid', { admin: true }).firestore()
    await assertFails(
      updateDoc(doc(admin, 'retreatRegistrations', REGISTRATION_ID), {
        status: 'approved',
        memberId: 'gd-i_tang_different',
        approvedBy: 'admin-uid',
        approvedAt: '2026-01-02T00:00:00.000Z',
        rejectionReason: null,
        updatedAt: '2026-01-02T00:00:00.000Z',
      }),
    )
  })

  it('allows giao_doan_admin proxy create in own org', async () => {
    const env = await getTestEnv()
    await seedRetreatsAcrossOrgs(env)
    const gd = env.authenticatedContext('gd-admin', {
      role: 'giao_doan_admin',
      orgUnitId: 'gd-i',
    }).firestore()
    const proxyId = `${RETREAT_ID}_gd-i_tang_099999999999`
    await assertSucceeds(
      setDoc(
        doc(gd, 'retreatRegistrations', proxyId),
        registrationDraft({
          memberId: 'gd-i_tang_099999999999',
          registeredVia: 'proxy',
          registeredBy: 'gd-admin',
        }),
      ),
    )
  })
})
