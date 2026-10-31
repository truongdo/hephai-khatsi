import { env } from 'cloudflare:workers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDataApiClient } from '#/data/apiClient'
import type { Caller } from '#/domain/authz/caller'
import { gdAdmin, hePhaiAdmin } from '#/domain/authz/testFixtures'
import { DomainError } from '#/domain/errors'
import type { RetreatWritableFields } from '#/domain/retreat'
import type { RetreatRegistration } from '#/domain/retreatRegistration'
import { createD1ListAuditLogs } from '#/repositories/d1/auditLogRepo'
import { createD1InviteRepo } from '#/repositories/d1/inviteRepo'
import { createD1MemberRepo } from '#/repositories/d1/memberRepo'
import { createD1ListOrgUnits } from '#/repositories/d1/orgUnitRepo'
import { createD1RetreatRegistrationRepo } from '#/repositories/d1/retreatRegistrationRepo'
import { createD1RetreatRepo } from '#/repositories/d1/retreatRepo'
import { createD1MemberStatsRepo, createD1TempleStatsRepo } from '#/repositories/d1/stats'
import { createD1TempleRepo } from '#/repositories/d1/templeRepo'
import type { Env } from '../env'
import { handleDataApi } from './index'
import { clearData } from './test/db'

// The client D1 repositories end to end: their requests go through `fetch`
// to the Worker's handleDataApi on the test D1, so a request shape the
// handlers do not accept fails here.

const workerEnv = {
  DB: env.DB,
  FIREBASE_PROJECT_ID: 'test-project',
  TYPESENSE_API_KEY: 'test-key',
} as unknown as Env

const CALLERS: Record<string, Caller> = { 'hp-admin': hePhaiAdmin, 'gd-admin': gdAdmin }

/** The signed-in user's token (null = filler). */
let idToken: string | null = null

const api = createDataApiClient(async () => idToken)
const memberRepo = createD1MemberRepo(api)
const templeRepo = createD1TempleRepo(api)
const inviteRepo = createD1InviteRepo(api)
const retreatRepo = createD1RetreatRepo(api)
const registrationRepo = createD1RetreatRegistrationRepo(api)
const listAuditLogs = createD1ListAuditLogs(api)
const listOrgUnits = createD1ListOrgUnits(api)

const adminAudit = { actorType: 'admin', actorId: 'hp-admin' } as const
const fillerAudit = { actorType: 'filler', actorId: '0912345678' } as const

function signInAs(token: string | null): void {
  idToken = token
}

beforeEach(async () => {
  await clearData()
  signInAs(null)
  vi.stubGlobal('fetch', async (input: string, init?: RequestInit) => {
    const response = await handleDataApi(
      new Request(new URL(input, 'https://app.test'), init),
      workerEnv,
      { waitUntil: () => {} },
      async (token) => CALLERS[token] ?? null,
    )
    return response ?? new Response('Not found', { status: 404 })
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function createPublicInvite(): Promise<void> {
  signInAs('hp-admin')
  await inviteRepo.create({
    id: 'public',
    token: 'public',
    kind: 'filler',
    retreatId: null,
    orgUnitId: null,
    createdBy: 'ignored',
    createdAt: 'ignored',
    disabled: false,
  })
  signInAs(null)
}

describe('filler journey', () => {
  it('saves and locks a member, finds it by phone and requests an edit', async () => {
    await createPublicInvite()
    expect(await inviteRepo.getByToken('public')).toMatchObject({ kind: 'filler', createdBy: 'hp-admin' })

    const saved = await memberRepo.createOrUpdateAndLock({
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      inviteId: 'public',
      cccd: '012345678901',
      patch: { phapDanh: 'Minh Tâm', dienThoai: '0912345678' },
      audit: fillerAudit,
    })
    expect(saved.mode).toBe('created')
    expect(saved.member).toMatchObject({ status: 'locked', lockedBy: 'filler', phapDanh: 'Minh Tâm' })

    expect(
      await memberRepo.getByCccd({ orgUnitId: 'gd-i', sanghaType: 'tang', cccd: '012345678901' }),
    ).toEqual(saved.member)
    const byPhone = { orgUnitId: 'gd-i', sanghaType: 'tang', phone: '0912345678' } as const
    expect(await memberRepo.listByOrgSanghaAndPhone({ ...byPhone, inviteToken: 'public' })).toEqual([
      saved.member,
    ])

    const requested = await memberRepo.requestEdit(saved.member.id, '0912345678')
    expect(requested.editRequestedBy).toBe('0912345678')
  })

  it('rethrows the Worker error as the same DomainError', async () => {
    const lookup = memberRepo.listByOrgSanghaAndPhone({
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      phone: '0912345678',
    })
    await expect(lookup).rejects.toBeInstanceOf(DomainError)
    await expect(lookup).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('saves a temple, finds it by manager phone and requests an edit', async () => {
    await createPublicInvite()
    const { temple } = await templeRepo.createOrUpdateAndLock({
      orgUnitId: 'gd-i',
      inviteId: 'public',
      managerPhones: ['0912345678'],
      patch: { danhHieu: 'Tịnh xá Ngọc Viên' },
      audit: fillerAudit,
    })
    expect(temple.status).toBe('locked')
    expect(
      await templeRepo.listByOrgAndPhone({ orgUnitId: 'gd-i', phone: '0912345678', inviteToken: 'public' }),
    ).toEqual([temple])
    expect((await templeRepo.requestEdit(temple.id, '0912345678')).editRequestedBy).toBe('0912345678')
  })
})

describe('admin members', () => {
  async function saveDraft(cccd: string) {
    const { member } = await memberRepo.createOrUpdateDraft({
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      inviteId: null,
      cccd,
      patch: { phapDanh: `Pháp danh ${cccd}`, giaoPhamHePhai: { rank: 'dai_duc' } },
      audit: adminAudit,
    })
    return member
  }

  it('lists, updates, locks, unlocks and deletes', async () => {
    signInAs('hp-admin')
    const first = await saveDraft('012345678901')
    const second = await saveDraft('012345678902')

    const page = await memberRepo.list({ sanghaType: 'tang', orgUnitId: 'gd-i', limit: 1 })
    expect(page.items).toHaveLength(1)
    expect(page.nextCursor).not.toBeNull()
    const exported = await memberRepo.listAllForExport({ sanghaType: 'tang', orgUnitId: 'gd-i' })
    expect(exported.map((member) => member.id).sort()).toEqual([first.id, second.id].sort())

    const updated = await memberRepo.updateDraftById(first.id, { phapDanh: 'Đổi tên' }, { audit: adminAudit })
    expect(updated.phapDanh).toBe('Đổi tên')

    const locked = await memberRepo.lock(first.id, 'hp-admin', adminAudit)
    expect(locked).toMatchObject({ status: 'locked', lockedBy: 'hp-admin' })
    expect((await memberRepo.unlock(first.id, adminAudit)).status).toBe('draft')

    const withTinhTrang = await memberRepo.setTinhTrang(first.id, 'vien_tich', adminAudit)
    expect(withTinhTrang.tinhTrang).toBe('vien_tich')

    const { entries } = await listAuditLogs({ collection: 'members', id: first.id }, { limit: 20 })
    expect(entries.map((entry) => entry.action)).toContain('locked')

    await memberRepo.deleteMany([first.id, second.id, 'missing'])
    expect(await memberRepo.getById(first.id)).toBeNull()
    expect(await memberRepo.getById(second.id)).toBeNull()
  })

  it('counts the hạ lạp tab and loads the stats in one request each', async () => {
    signInAs('hp-admin')
    const member = await saveDraft('012345678901')
    const haLapTabRank = member.haLapTabRank!
    expect(await memberRepo.countByHaLapTab({ sanghaType: 'tang', haLapTabRank })).toBe(1)
    expect((await memberRepo.listByHaLapTab({ sanghaType: 'tang', haLapTabRank })).items).toEqual([member])

    const stats = await createD1MemberStatsRepo(api).loadDashboardStats({
      orgUnitId: null,
      orgUnitIdsForBreakdown: ['gd-i'],
    })
    expect(stats.totals).toEqual({ all: 1, tang: 1, ni: 0 })
    expect(stats.byOrgUnit).toEqual([{ orgUnitId: 'gd-i', count: 1 }])

    const templeStats = await createD1TempleStatsRepo(api).loadDashboardStats({
      orgUnitId: null,
      orgUnitIdsForBreakdown: [],
      cityNamesForBreakdown: [],
    })
    expect(templeStats.totals).toEqual({ all: 0 })
  })

  it('sets the portrait and the documents', async () => {
    signInAs('hp-admin')
    const member = await saveDraft('012345678901')

    const withPhoto = await memberRepo.setPhotoPath(member.id, `members/${member.id}/portrait.jpg`, adminAudit)
    expect(withPhoto.photoPath).toBe(`members/${member.id}/portrait.jpg`)

    const front = `members/${member.id}/docs/cccd/front.jpg`
    const merged = await memberRepo.mergeDocumentSide(member.id, 'cccd', 'front', front, adminAudit)
    expect(merged.member.documents).toEqual({ cccd: { frontPath: front } })
    expect(merged.previousPath).toBeUndefined()
    const replaced = await memberRepo.mergeDocumentSide(member.id, 'cccd', 'front', `${front}?v2`, adminAudit)
    expect(replaced.previousPath).toBe(front)

    const removed = await memberRepo.removeDocumentPaths(member.id, 'cccd', undefined, adminAudit)
    expect(removed.removedPaths).toEqual([`${front}?v2`])

    const diep = { diep_sa_di: { filePath: `members/${member.id}/docs/diep_sa_di/file.pdf` } }
    expect((await memberRepo.setDocumentPaths(member.id, diep)).documents).toEqual(diep)
  })

  it('lists members of temples and secretaries', async () => {
    signInAs('hp-admin')
    expect(await memberRepo.listByCurrentTempleIds([])).toEqual([])
    expect(await memberRepo.listByCurrentTempleIds(['temple-1', 'temple-1'])).toEqual([])
    expect(await memberRepo.listDirectorySecretaries()).toEqual([])
    expect(await memberRepo.listHePhaiSecretaries()).toEqual([])
  })
})

describe('admin temples', () => {
  it('saves a draft, sets the photo, locks, unlocks and deletes', async () => {
    signInAs('gd-admin')
    const { temple, mode } = await templeRepo.createOrUpdateDraft({
      orgUnitId: 'gd-i',
      inviteId: null,
      managerPhones: ['0912345678'],
      patch: { danhHieu: 'Tịnh xá A' },
    })
    expect(mode).toBe('created')
    const gdAudit = { actorType: 'admin', actorId: 'gd-admin' } as const
    expect(await templeRepo.lock(temple.id, 'gd-admin', gdAudit)).toMatchObject({ status: 'locked' })
    expect((await templeRepo.unlock(temple.id, gdAudit)).status).toBe('draft')
    const sorted = await templeRepo.list({ orgUnitId: 'gd-i', sortBy: 'orgUnitName', sortDir: 'asc' })
    expect(sorted.items.map((t) => t.id)).toEqual([temple.id])

    const withPhoto = await templeRepo.setPhotoPath(temple.id, `temples/${temple.id}/portrait.jpg`, {
      actorType: 'admin',
      actorId: 'gd-admin',
    })
    expect(withPhoto.photoPath).toBe(`temples/${temple.id}/portrait.jpg`)
    expect((await templeRepo.listAllForExport({ orgUnitId: 'gd-i' })).map((t) => t.id)).toEqual([temple.id])

    await templeRepo.deleteMany([temple.id])
    expect(await templeRepo.getById(temple.id)).toBeNull()
  })
})

describe('retreats and registrations', () => {
  const day = 24 * 60 * 60 * 1000
  const fields: RetreatWritableFields = {
    name: 'Khóa tu',
    diaDiem: 'TX Trung Tâm',
    noiDung: 'Thiền',
    doiTuongThamDu: 'Tăng ni',
    thoiGianBatDau: new Date(Date.now() + 10 * day).toISOString(),
    thoiGianKetThuc: new Date(Date.now() + 12 * day).toISOString(),
    dangKyMoTu: new Date(Date.now() - day).toISOString(),
    dangKyDongLuc: new Date(Date.now() + 5 * day).toISOString(),
    extraFields: [],
    quyenDangKy: 'both',
  }

  it('creates, opens, registers and reviews; only drafts can be deleted', async () => {
    signInAs('gd-admin')
    const retreat = await retreatRepo.create({ orgUnitId: 'gd-i', createdBy: 'ignored', fields })
    expect(retreat).toMatchObject({ status: 'draft', createdBy: 'gd-admin' })
    expect((await retreatRepo.update(retreat.id, { ...fields, name: 'Khóa tu hè' })).name).toBe('Khóa tu hè')
    expect((await retreatRepo.setStatus(retreat.id, 'open')).status).toBe('open')
    expect((await retreatRepo.list({ orgUnitId: 'gd-i' })).items.map((r) => r.id)).toEqual([retreat.id])

    const { member } = await memberRepo.createOrUpdateDraft({
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      inviteId: null,
      cccd: '012345678901',
      patch: {},
    })
    signInAs(null)
    const registration = {
      id: `${retreat.id}_${member.id}`,
      retreatId: retreat.id,
      memberId: member.id,
      registeredVia: 'self',
      extraAnswers: {},
    } as RetreatRegistration
    await registrationRepo.create(registration)
    expect(await registrationRepo.getById(registration.id)).toMatchObject({ status: 'pending' })

    signInAs('gd-admin')
    expect((await registrationRepo.listByRetreat({ retreatId: retreat.id })).items).toHaveLength(1)
    await registrationRepo.updateReview([registration.id], {
      status: 'rejected',
      approvedBy: 'ignored',
      approvedAt: 'ignored',
      rejectionReason: 'Hết chỗ',
      updatedAt: 'ignored',
    })
    expect(await registrationRepo.getById(registration.id)).toMatchObject({
      status: 'rejected',
      approvedBy: 'gd-admin',
      rejectionReason: 'Hết chỗ',
    })

    expect((await retreatRepo.setStatus(retreat.id, 'closed')).status).toBe('closed')
    await expect(retreatRepo.delete(retreat.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const draft = await retreatRepo.create({ orgUnitId: 'gd-i', createdBy: 'ignored', fields })
    await retreatRepo.delete(draft.id)
    expect(await retreatRepo.getById(draft.id)).toBeNull()
  })
})

describe('org units', () => {
  it('lists the seeded org units over GET', async () => {
    const units = await listOrgUnits()
    expect(units.length).toBeGreaterThan(0)
    expect(units.map((unit) => unit.id)).toContain('gd-i')
  })
})
