import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  anon,
  gdAdmin,
  hePhaiAdmin,
  templeDraft,
  templeLocked,
} from '#/domain/authz/testFixtures'
import type { Temple } from '#/domain/types'
import type { AdminListPage } from '#/repositories/adminListTypes'
import { inviteToRow } from '../rows/invite'
import { templeManagerPhoneRows, templeToRow } from '../rows/temple'
import { clearData, insertStatement } from '../test/db'
import { fillerInvite } from '../test/fixtures'
import {
  NOW,
  callData,
  expectDomainError,
  fileCalls,
  fullTableScans,
  queryPlansOf,
  searchCalls,
} from '../test/callData'

const ADMIN_ACTOR = { actorType: 'admin', actorId: 'gd-admin' }
const FILLER_ACTOR = { actorType: 'filler', actorId: '0912345678' }

async function seedTemples(...temples: Temple[]): Promise<void> {
  await env.DB.batch(
    temples.flatMap((temple) => [
      insertStatement('temples', templeToRow(temple)),
      ...templeManagerPhoneRows(temple).map((row) => insertStatement('temple_manager_phones', row)),
    ]),
  )
}

async function seedInvite(): Promise<void> {
  await insertStatement('invites', inviteToRow(fillerInvite)).run()
}

async function managerPhonesOf(templeId: string): Promise<string[]> {
  const { results } = await env.DB.prepare(
    'SELECT phone FROM temple_manager_phones WHERE temple_id = ? ORDER BY phone',
  )
    .bind(templeId)
    .all<{ phone: string }>()
  return results.map((row) => row.phone)
}

beforeEach(async () => {
  await clearData()
  searchCalls.length = 0
  fileCalls.length = 0
})

describe('temples/save-draft and save-and-lock', () => {
  const create = {
    orgUnitId: 'gd-i',
    inviteId: null,
    managerPhones: ['0912345678'],
    patch: {
      danhHieu: 'Tịnh xá Ngọc A',
      diaChiMoi: { cityCode: '79', cityName: 'TP Hồ Chí Minh', wardCode: '1', wardName: 'P1' },
    },
    audit: ADMIN_ACTOR,
  }

  it('creates an admin draft with a new id, sort keys and phone rows', async () => {
    const { temple, mode } = await callData<{ temple: Temple; mode: string }>(
      'temples/save-draft',
      create,
      gdAdmin,
    )
    expect(mode).toBe('created')
    expect(temple.id).toMatch(/^[A-Za-z0-9]{20}$/)
    expect(temple).toMatchObject({
      status: 'draft',
      createdAt: NOW,
      listCityName: 'TP Hồ Chí Minh',
      orgUnitName: 'Giáo đoàn I',
      photoPath: null,
    })
    expect(await callData('temples/get', { id: temple.id })).toEqual(temple)
    expect(await managerPhonesOf(temple.id)).toEqual(['0912345678'])
    expect(searchCalls).toEqual([{ action: 'upsertTemple', id: temple.id }])
  })

  it('replaces the manager phone rows on update', async () => {
    await seedTemples(templeDraft({ inviteId: null }))
    await callData(
      'temples/save-draft',
      { ...create, templeId: templeDraft().id, managerPhones: ['0900000001', '0900000002'] },
      gdAdmin,
    )
    expect(await managerPhonesOf(templeDraft().id)).toEqual(['0900000001', '0900000002'])
  })

  it('keeps the original invite on an admin save', async () => {
    await seedTemples(templeDraft())
    const { temple } = await callData<{ temple: Temple }>(
      'temples/save-draft',
      { ...create, templeId: templeDraft().id },
      gdAdmin,
    )
    expect(temple.inviteId).toBe('public')
  })

  it('refuses a temple without manager phones', async () => {
    await expectDomainError(
      callData('temples/save-draft', { ...create, managerPhones: [] }, gdAdmin),
      'FORBIDDEN',
    )
  })

  it('lets a filler create a locked temple with an invite, not without', async () => {
    const filler = { ...create, inviteId: 'public', audit: FILLER_ACTOR }
    await expectDomainError(callData('temples/save-and-lock', filler, anon), 'FORBIDDEN')
    await seedInvite()
    const { temple } = await callData<{ temple: Temple }>('temples/save-and-lock', filler, anon)
    expect(temple).toMatchObject({ status: 'locked', lockedBy: 'filler', inviteId: 'public' })
  })

  it('refuses a signed-in admin filling as a visitor', async () => {
    await seedInvite()
    await expectDomainError(
      callData('temples/save-and-lock', { ...create, orgUnitId: 'gd-ii', inviteId: 'public', audit: FILLER_ACTOR }, gdAdmin),
      'FORBIDDEN',
    )
  })

  it('needs allowOrgUnitChange to move, and only a hệ phái admin may', async () => {
    await seedTemples(templeDraft({ inviteId: null }))
    const move = { ...create, orgUnitId: 'gd-ii', templeId: templeDraft().id }
    await expectDomainError(callData('temples/save-draft', move, hePhaiAdmin), 'FORBIDDEN')
    await expectDomainError(
      callData('temples/save-draft', { ...move, allowOrgUnitChange: true }, gdAdmin),
      'FORBIDDEN',
    )
    const { temple } = await callData<{ temple: Temple }>(
      'temples/save-draft',
      { ...move, allowOrgUnitChange: true },
      hePhaiAdmin,
    )
    expect(temple).toMatchObject({ orgUnitId: 'gd-ii', orgUnitName: 'Giáo đoàn II' })
  })

  it('refuses to save over a locked temple unless allowed', async () => {
    await seedTemples(templeLocked())
    await expectDomainError(
      callData('temples/save-draft', { ...create, templeId: templeLocked().id }, gdAdmin),
      'RECORD_LOCKED',
    )
  })

  it('returns NOT_FOUND for an unknown temple id', async () => {
    await expectDomainError(
      callData('temples/save-draft', { ...create, templeId: 'missing' }, gdAdmin),
      'NOT_FOUND',
    )
  })
})

describe('temple lifecycle writes', () => {
  it('locks, unlocks and records a filler edit request', async () => {
    await seedInvite()
    await seedTemples(templeDraft())
    const id = templeDraft().id
    const locked = await callData<Temple>(
      'temples/lock',
      { templeId: id, lockedBy: 'gd-admin', audit: ADMIN_ACTOR },
      gdAdmin,
    )
    expect(locked).toMatchObject({ status: 'locked', lockedAt: NOW })
    const requested = await callData<Temple>('temples/request-edit', { templeId: id, phone: '0912345678' }, anon)
    expect(requested).toMatchObject({ editRequestedAt: NOW, editRequestedBy: '0912345678' })
    const unlocked = await callData<Temple>('temples/unlock', { templeId: id, audit: ADMIN_ACTOR }, gdAdmin)
    expect(unlocked).toMatchObject({ status: 'draft', editRequestedAt: null })
  })

  it('lets a filler set a first photo on a locked temple, not replace it', async () => {
    await seedInvite()
    await seedTemples(templeLocked())
    const id = templeLocked().id
    await callData('temples/set-photo', { templeId: id, photoPath: 'temples/x.jpg', audit: FILLER_ACTOR }, anon)
    await expectDomainError(
      callData('temples/set-photo', { templeId: id, photoPath: 'temples/y.jpg', audit: FILLER_ACTOR }, anon),
      'FORBIDDEN',
    )
  })

  it('deletes temples with their phone rows', async () => {
    await seedTemples(templeDraft())
    await callData('temples/delete-many', { ids: [templeDraft().id] }, gdAdmin)
    expect(await callData('temples/get', { id: templeDraft().id })).toBeNull()
    expect(await managerPhonesOf(templeDraft().id)).toEqual([])
    expect(searchCalls).toEqual([{ action: 'deleteTemple', id: templeDraft().id }])
  })

  it('deletes the photo a temple drops or is deleted with', async () => {
    const photoPath = `temples/${templeDraft().id}/photo.jpg`
    await seedTemples(templeDraft({ photoPath }))
    await callData('temples/set-photo', { templeId: templeDraft().id, photoPath: null, audit: ADMIN_ACTOR }, gdAdmin)
    expect(fileCalls).toEqual([{ action: 'delete', paths: [photoPath] }])

    await clearData()
    fileCalls.length = 0
    await seedTemples(templeDraft({ photoPath }))
    await callData('temples/delete-many', { ids: [templeDraft().id] }, gdAdmin)
    expect(fileCalls).toEqual([{ action: 'delete', paths: [photoPath] }])
  })

  it('refuses deleting another org unit’s temple', async () => {
    await seedTemples(templeDraft({ orgUnitId: 'gd-ii' }))
    await expectDomainError(callData('temples/delete-many', { ids: [templeDraft().id] }, gdAdmin), 'FORBIDDEN')
  })
})

describe('temple reads', () => {
  it('finds temples by manager phone with an invite token', async () => {
    await seedInvite()
    await seedTemples(templeDraft(), templeDraft({ id: 'temple-2', managerPhones: ['0900000000'] }))
    const lookup = { orgUnitId: 'gd-i', phone: '0912345678' }
    await expectDomainError(callData('temples/list-by-phone', lookup, anon), 'FORBIDDEN')
    const found = await callData<Temple[]>('temples/list-by-phone', { ...lookup, inviteToken: 'public' }, anon)
    expect(found.map((temple) => temple.id)).toEqual([templeDraft().id])
  })

  it('pages by city name', async () => {
    await seedTemples(
      templeDraft({ id: 't-a', listCityName: 'An Giang' }),
      templeDraft({ id: 't-b', listCityName: 'Bến Tre' }),
      templeDraft({ id: 't-c', listCityName: 'Cà Mau' }),
    )
    const body = { orgUnitId: 'gd-i', sortBy: 'listCityName', sortDir: 'asc', limit: 2 }
    const first = await callData<AdminListPage<Temple>>('temples/list', body, gdAdmin)
    expect(first.items.map((t) => t.id)).toEqual(['t-a', 't-b'])
    const second = await callData<AdminListPage<Temple>>(
      'temples/list',
      { ...body, cursor: first.nextCursor },
      gdAdmin,
    )
    expect(second.items.map((t) => t.id)).toEqual(['t-c'])
    expect(second.nextCursor).toBeNull()
  })

  it('refuses an unscoped list by a giáo đoàn admin', async () => {
    await expectDomainError(callData('temples/list', {}, gdAdmin), 'FORBIDDEN')
  })

  it('rejects a tampered cursor', async () => {
    await expectDomainError(callData('temples/list', { cursor: 'not-a-cursor' }, hePhaiAdmin), 'INVALID_INPUT')
  })

  it.each([
    ['temples/list', {}],
    ['temples/list', { status: 'locked' }],
    ['temples/list', { orgUnitId: 'gd-i' }],
    ['temples/list', { orgUnitId: 'gd-i', status: 'draft' }],
    ['temples/list', { sortBy: 'listCityName' }],
    ['temples/list', { orgUnitId: 'gd-i', sortBy: 'listCityName' }],
    ['temples/list', { sortBy: 'orgUnitName' }],
    ['temples/list', { orgUnitId: 'gd-i', sortBy: 'orgUnitName' }],
    ['temples/list-by-phone', { orgUnitId: 'gd-i', phone: '0912345678' }],
  ])('%s %o uses an index', async (name, body) => {
    const plans = await queryPlansOf(name, body, hePhaiAdmin)
    expect(plans.length).toBeGreaterThan(0)
    expect(fullTableScans(plans)).toEqual([])
  })
})
