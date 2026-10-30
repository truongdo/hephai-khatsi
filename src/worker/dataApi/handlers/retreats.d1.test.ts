import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  anon,
  gdAdmin,
  hePhaiAdmin,
  kiemSoat,
  retreatDraft,
  secretary,
} from '#/domain/authz/testFixtures'
import type { Retreat } from '#/domain/retreat'
import { retreatToRow } from '../rows/retreat'
import { clearData, insertStatement } from '../test/db'
import { NOW, callData, expectDomainError, fullTableScans, queryPlansOf } from '../test/callData'

type Page = { items: Retreat[]; nextCursor: string | null }

async function seedRetreats(...retreats: Retreat[]): Promise<void> {
  await env.DB.batch(retreats.map((retreat) => insertStatement('retreats', retreatToRow(retreat))))
}

async function versionOf(id: string): Promise<number | null> {
  return env.DB.prepare('SELECT version FROM retreats WHERE id = ?').bind(id).first<number>('version')
}

const FIELDS = {
  name: 'Khóa tu hè',
  diaDiem: 'TX Trung Tâm',
  noiDung: 'Thiền',
  doiTuongThamDu: 'Tăng ni',
  thoiGianBatDau: '2026-08-01T00:00:00.000Z',
  thoiGianKetThuc: '2026-08-07T00:00:00.000Z',
  dangKyMoTu: '2026-07-01T00:00:00.000Z',
  dangKyDongLuc: '2026-07-20T00:00:00.000Z',
  extraFields: [{ key: 'size_ao', label: 'Cỡ áo', required: true }],
  quyenDangKy: 'both',
}

beforeEach(async () => {
  await clearData()
})

describe('retreats/create', () => {
  const body = { orgUnitId: 'gd-i', fields: FIELDS }

  it('creates a draft whose creator is the caller', async () => {
    const retreat = await callData<Retreat>('retreats/create', body, gdAdmin)
    expect(retreat).toMatchObject({
      ...FIELDS,
      type: 'giao_doan',
      orgUnitId: 'gd-i',
      status: 'draft',
      createdBy: 'gd-admin',
      createdAt: NOW,
      updatedAt: NOW,
    })
    expect(await callData('retreats/get', { id: retreat.id })).toEqual(retreat)
    expect(await versionOf(retreat.id)).toBe(1)
  })

  it('ignores a createdBy or status in the body', async () => {
    const retreat = await callData<Retreat>(
      'retreats/create',
      { ...body, createdBy: 'someone', status: 'open', fields: { ...FIELDS, status: 'open', createdBy: 'x' } },
      hePhaiAdmin,
    )
    expect(retreat).toMatchObject({ status: 'draft', createdBy: 'hp-admin' })
  })

  it('lets hệ phái admin and secretary create in any org unit', async () => {
    for (const caller of [hePhaiAdmin, secretary]) {
      const retreat = await callData<Retreat>('retreats/create', { ...body, orgUnitId: 'gd-ii' }, caller)
      expect(retreat.orgUnitId).toBe('gd-ii')
    }
  })

  it('refuses a giáo đoàn admin creating in another org unit', async () => {
    await expectDomainError(callData('retreats/create', { ...body, orgUnitId: 'gd-ii' }, gdAdmin), 'FORBIDDEN')
  })

  it.each([
    ['anon', anon],
    ['kiểm soát', kiemSoat],
  ])('refuses %s', async (_, caller) => {
    await expectDomainError(callData('retreats/create', body, caller), 'FORBIDDEN')
  })

  it.each([
    ['a missing orgUnitId', { fields: FIELDS }],
    ['a missing name', { ...body, fields: { ...FIELDS, name: undefined } }],
    ['a bad quyenDangKy', { ...body, fields: { ...FIELDS, quyenDangKy: 'x' } }],
    ['bad extraFields', { ...body, fields: { ...FIELDS, extraFields: [{ key: 'a' }] } }],
    ['extraFields not a list', { ...body, fields: { ...FIELDS, extraFields: 'a' } }],
    ['no fields', { orgUnitId: 'gd-i' }],
  ])('rejects %s', async (_, invalid) => {
    await expectDomainError(callData('retreats/create', invalid, gdAdmin), 'INVALID_INPUT')
  })
})

describe('retreats/get', () => {
  it('is public and returns null when missing', async () => {
    await seedRetreats(retreatDraft())
    expect(await callData<Retreat>('retreats/get', { id: 'r1' }, anon)).toMatchObject({ id: 'r1', name: 'Khoa' })
    expect(await callData('retreats/get', { id: 'nope' }, anon)).toBeNull()
  })

  it('rejects a missing id', async () => {
    await expectDomainError(callData('retreats/get', {}), 'INVALID_INPUT')
  })
})

describe('retreats/update', () => {
  it('updates the fields, keeps the status and bumps the version', async () => {
    await seedRetreats(retreatDraft({ status: 'open' }))
    const updated = await callData<Retreat>(
      'retreats/update',
      { id: 'r1', fields: { ...FIELDS, name: 'Tên mới' }, orgUnitId: 'gd-ii', status: 'closed' },
      gdAdmin,
    )
    expect(updated).toMatchObject({
      name: 'Tên mới',
      status: 'open',
      orgUnitId: 'gd-i',
      createdBy: 'gd-admin',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: NOW,
    })
    expect(await versionOf('r1')).toBe(2)
    await callData('retreats/update', { id: 'r1', fields: FIELDS }, gdAdmin)
    expect(await versionOf('r1')).toBe(3)
  })

  it('refuses a giáo đoàn admin of another org unit', async () => {
    await seedRetreats(retreatDraft({ orgUnitId: 'gd-ii' }))
    await expectDomainError(callData('retreats/update', { id: 'r1', fields: FIELDS }, gdAdmin), 'FORBIDDEN')
    expect(await versionOf('r1')).toBe(1)
  })

  it.each([
    ['anon', anon],
    ['kiểm soát', kiemSoat],
  ])('refuses %s', async (_, caller) => {
    await seedRetreats(retreatDraft())
    await expectDomainError(callData('retreats/update', { id: 'r1', fields: FIELDS }, caller), 'FORBIDDEN')
  })

  it('is NOT_FOUND for a missing retreat', async () => {
    await expectDomainError(callData('retreats/update', { id: 'nope', fields: FIELDS }, gdAdmin), 'NOT_FOUND')
  })

  it('rejects an invalid body', async () => {
    await seedRetreats(retreatDraft())
    await expectDomainError(
      callData('retreats/update', { id: 'r1', fields: { ...FIELDS, dangKyMoTu: 5 } }, gdAdmin),
      'INVALID_INPUT',
    )
  })
})

describe('retreats/set-status', () => {
  it.each([
    ['draft', 'open'],
    ['open', 'closed'],
    ['closed', 'open'],
  ] as const)('moves %s to %s', async (from, to) => {
    await seedRetreats(retreatDraft({ status: from }))
    const retreat = await callData<Retreat>('retreats/set-status', { id: 'r1', status: to }, gdAdmin)
    expect(retreat).toMatchObject({ status: to, updatedAt: NOW })
    expect(await versionOf('r1')).toBe(2)
  })

  it.each([
    ['draft', 'closed'],
    ['open', 'draft'],
    ['closed', 'draft'],
  ] as const)('refuses %s to %s', async (from, to) => {
    await seedRetreats(retreatDraft({ status: from }))
    await expectDomainError(callData('retreats/set-status', { id: 'r1', status: to }, gdAdmin), 'FORBIDDEN')
    expect(await versionOf('r1')).toBe(1)
  })

  it('refuses a giáo đoàn admin of another org unit, anon and kiểm soát', async () => {
    await seedRetreats(retreatDraft({ orgUnitId: 'gd-ii' }))
    for (const caller of [gdAdmin, anon, kiemSoat]) {
      await expectDomainError(callData('retreats/set-status', { id: 'r1', status: 'open' }, caller), 'FORBIDDEN')
    }
  })

  it('is NOT_FOUND for a missing retreat and rejects an unknown status', async () => {
    await expectDomainError(callData('retreats/set-status', { id: 'nope', status: 'open' }, gdAdmin), 'NOT_FOUND')
    await expectDomainError(callData('retreats/set-status', { id: 'r1', status: 'x' }, gdAdmin), 'INVALID_INPUT')
  })
})

describe('retreats/delete', () => {
  it('deletes a draft', async () => {
    await seedRetreats(retreatDraft())
    await callData('retreats/delete', { id: 'r1' }, gdAdmin)
    expect(await callData('retreats/get', { id: 'r1' })).toBeNull()
  })

  it.each(['open', 'closed'] as const)('refuses a %s retreat', async (status) => {
    await seedRetreats(retreatDraft({ status }))
    await expectDomainError(callData('retreats/delete', { id: 'r1' }, gdAdmin), 'FORBIDDEN')
    expect(await versionOf('r1')).toBe(1)
  })

  it('refuses other org units, anon and kiểm soát', async () => {
    await seedRetreats(retreatDraft({ orgUnitId: 'gd-ii' }))
    for (const caller of [gdAdmin, anon, kiemSoat]) {
      await expectDomainError(callData('retreats/delete', { id: 'r1' }, caller), 'FORBIDDEN')
    }
    await seedRetreats(retreatDraft({ id: 'r2' }))
    for (const caller of [anon, kiemSoat]) {
      await expectDomainError(callData('retreats/delete', { id: 'r2' }, caller), 'FORBIDDEN')
    }
  })

  it('is a no-op for a missing retreat', async () => {
    expect(await callData('retreats/delete', { id: 'nope' }, gdAdmin)).toEqual({ ok: true })
  })

  it('rejects a missing id', async () => {
    await expectDomainError(callData('retreats/delete', {}, gdAdmin), 'INVALID_INPUT')
  })
})

describe('retreats/list', () => {
  const at = (n: number) => `2026-03-0${n}T00:00:00.000Z`

  async function seedFive(): Promise<void> {
    await seedRetreats(
      retreatDraft({ id: 'a', updatedAt: at(1) }),
      retreatDraft({ id: 'b', updatedAt: at(2), status: 'open' }),
      retreatDraft({ id: 'c', updatedAt: at(3), orgUnitId: 'gd-ii' }),
      retreatDraft({ id: 'd', updatedAt: at(4), orgUnitId: 'gd-ii', status: 'open' }),
      retreatDraft({ id: 'e', updatedAt: at(5) }),
    )
  }

  it('lists newest first and filters by org unit and status', async () => {
    await seedFive()
    const ids = async (body: Record<string, unknown>, caller = hePhaiAdmin) =>
      (await callData<Page>('retreats/list', body, caller)).items.map((retreat) => retreat.id)
    expect(await ids({})).toEqual(['e', 'd', 'c', 'b', 'a'])
    expect(await ids({ orgUnitId: 'gd-ii' })).toEqual(['d', 'c'])
    expect(await ids({ status: 'open' })).toEqual(['d', 'b'])
    expect(await ids({ orgUnitId: 'gd-i', status: 'open' })).toEqual(['b'])
    expect(await ids({ orgUnitId: 'gd-i' }, gdAdmin)).toEqual(['e', 'b', 'a'])
    expect(await ids({}, secretary)).toEqual(['e', 'd', 'c', 'b', 'a'])
  })

  it('refuses a giáo đoàn admin without or with another org unit, anon and kiểm soát', async () => {
    await seedFive()
    await expectDomainError(callData('retreats/list', {}, gdAdmin), 'FORBIDDEN')
    await expectDomainError(callData('retreats/list', { orgUnitId: 'gd-ii' }, gdAdmin), 'FORBIDDEN')
    await expectDomainError(callData('retreats/list', {}, anon), 'FORBIDDEN')
    await expectDomainError(callData('retreats/list', { orgUnitId: 'gd-i' }, kiemSoat), 'FORBIDDEN')
  })

  it('pages with a stable cursor while rows are added', async () => {
    await seedFive()
    const first = await callData<Page>('retreats/list', { limit: 2 }, hePhaiAdmin)
    expect(first.items.map((retreat) => retreat.id)).toEqual(['e', 'd'])
    expect(first.nextCursor).not.toBeNull()
    await seedRetreats(retreatDraft({ id: 'new', updatedAt: at(9) }))
    const second = await callData<Page>('retreats/list', { limit: 2, cursor: first.nextCursor }, hePhaiAdmin)
    expect(second.items.map((retreat) => retreat.id)).toEqual(['c', 'b'])
    const third = await callData<Page>('retreats/list', { limit: 2, cursor: second.nextCursor }, hePhaiAdmin)
    expect(third.items.map((retreat) => retreat.id)).toEqual(['a'])
    expect(third.nextCursor).toBeNull()
  })

  it('rejects an invalid limit, status or cursor', async () => {
    await expectDomainError(callData('retreats/list', { limit: 0 }, hePhaiAdmin), 'INVALID_INPUT')
    await expectDomainError(callData('retreats/list', { limit: 1000 }, hePhaiAdmin), 'INVALID_INPUT')
    await expectDomainError(callData('retreats/list', { status: 'x' }, hePhaiAdmin), 'INVALID_INPUT')
    await expectDomainError(callData('retreats/list', { cursor: 'not-a-cursor' }, hePhaiAdmin), 'INVALID_INPUT')
  })

  it.each([
    ['unfiltered', {}],
    ['by org unit', { orgUnitId: 'gd-i' }],
    ['by status', { status: 'open' }],
    ['by org unit and status', { orgUnitId: 'gd-i', status: 'open', limit: 2 }],
  ])('uses an index %s', async (_, body) => {
    await seedFive()
    const plans = await queryPlansOf('retreats/list', body, hePhaiAdmin)
    expect(plans.length).toBeGreaterThan(0)
    expect(fullTableScans(plans)).toEqual([])
  })
})
