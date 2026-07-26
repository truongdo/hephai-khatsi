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

  it('rejects kiem_soat create even with a valid invite', async () => {
    const env = await getTestEnv()
    const ks = env.authenticatedContext('ks', {
      role: 'kiem_soat',
      orgUnitId: 'gd-i',
    }).firestore()
    await assertFails(setDoc(doc(ks, 'members', memberId), memberDraft()))
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
  it('giao_doan_admin can create/get in own org, not other org', async () => {
    const env = await getTestEnv()
    await seedRetreatsAcrossOrgs(env)
    const gd = env.authenticatedContext('gd-admin', {
      role: 'giao_doan_admin',
      orgUnitId: 'gd-i',
    }).firestore()
    await assertSucceeds(setDoc(doc(gd, 'retreats/r1'), retreatDraft({ createdBy: 'gd-admin' })))
    await assertSucceeds(getDoc(doc(gd, 'retreats/r-gd-i')))
    await assertFails(getDoc(doc(gd, 'retreats/r-gd-ii')))
    await assertFails(
      setDoc(doc(gd, 'retreats/r2'), retreatDraft({ orgUnitId: 'gd-ii', createdBy: 'gd-admin' })),
    )
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

  it('kiem_soat cannot read or write retreats or orgUnits', async () => {
    const env = await getTestEnv()
    await seedRetreatsAcrossOrgs(env)
    const ks = env.authenticatedContext('ks', {
      role: 'kiem_soat',
      orgUnitId: 'gd-i',
    }).firestore()
    await assertFails(getDoc(doc(ks, 'retreats/r-gd-i')))
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
