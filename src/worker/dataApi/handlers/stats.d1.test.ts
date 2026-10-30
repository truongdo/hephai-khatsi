import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  anon,
  gdAdmin,
  hePhaiAdmin,
  kiemSoat,
  memberDraft,
  secretary,
  signedIn,
  templeDraft,
} from '#/domain/authz/testFixtures'
import type { MemberDirectoryStats } from '#/domain/memberDirectoryStats'
import type { TempleDirectoryStats } from '#/domain/templeDirectoryStats'
import type { Member, Temple } from '#/domain/types'
import { memberToRow } from '../rows/member'
import { templeToRow } from '../rows/temple'
import { clearData, insertStatement } from '../test/db'
import { callData, expectDomainError, fullTableScans, queryPlansOf } from '../test/callData'

const gdIiAdmin = signedIn('gd-ii-admin', { role: 'giao_doan_admin', orgUnitId: 'gd-ii' })
const gdNoOrg = signedIn('gd-none', { role: 'giao_doan_admin' })

let counter = 0
function member(orgUnitId: string, sanghaType: 'tang' | 'ni', rank?: string): Member {
  counter += 1
  return memberDraft({
    orgUnitId,
    sanghaType,
    cccd: String(100000000000 + counter),
    ...(rank ? { giaoPhamHePhai: { rank } } : {}),
  })
}

function temple(orgUnitId: string, city?: string): Temple {
  counter += 1
  return templeDraft({ id: `temple-${counter}`, orgUnitId, listCityName: city })
}

async function seedMembers(...members: Member[]): Promise<void> {
  await env.DB.batch(members.map((m) => insertStatement('members', memberToRow(m))))
}
async function seedTemples(...temples: Temple[]): Promise<void> {
  await env.DB.batch(temples.map((t) => insertStatement('temples', templeToRow(t))))
}

beforeEach(async () => {
  counter = 0
  await clearData()
})

describe('stats/members', () => {
  const body = { orgUnitId: null, orgUnitIdsForBreakdown: ['gd-i', 'gd-ii', 'gd-iii'] }

  async function seedSample(): Promise<void> {
    await seedMembers(
      member('gd-i', 'tang', 'hoa_thuong'),
      member('gd-i', 'tang', 'ty_kheo'),
      member('gd-i', 'tang', 'ty_kheo'),
      member('gd-i', 'tang'),
      member('gd-ii', 'tang', 'dai_duc'),
      member('gd-ii', 'tang', 'not_a_rank'),
      member('ni-gd-i', 'ni', 'ni_su'),
      member('ni-gd-i', 'ni', 'ty_kheo_ni'),
      member('ni-gd-i', 'ni'),
      member('gd-ii', 'ni', 'ni_su'),
    )
  }

  it('is all zero for an empty directory', async () => {
    const stats = await callData<MemberDirectoryStats>('stats/members', body, hePhaiAdmin)
    expect(stats.totals).toEqual({ all: 0, tang: 0, ni: 0 })
    expect(stats.byOrgUnit).toEqual([
      { orgUnitId: 'gd-i', count: 0 },
      { orgUnitId: 'gd-ii', count: 0 },
      { orgUnitId: 'gd-iii', count: 0 },
    ])
    expect(stats.byRankTang.every((row) => row.count === 0)).toBe(true)
    expect(stats.byRankTang.at(-1)).toEqual({ rank: 'unknown', count: 0 })
  })

  it('counts totals, org units and ranks like memberStatsRepo', async () => {
    await seedSample()
    const stats = await callData<MemberDirectoryStats>('stats/members', body, hePhaiAdmin)
    expect(stats.totals).toEqual({ all: 10, tang: 6, ni: 4 })
    expect(stats.byOrgUnit).toEqual([
      { orgUnitId: 'gd-i', count: 4 },
      { orgUnitId: 'gd-ii', count: 3 },
      { orgUnitId: 'gd-iii', count: 0 },
    ])
    expect(stats.byRankTang).toEqual([
      { rank: 'hoa_thuong', count: 1 },
      { rank: 'thuong_toa', count: 0 },
      { rank: 'dai_duc', count: 1 },
      { rank: 'ty_kheo', count: 2 },
      { rank: 'sa_di', count: 0 },
      { rank: 'tap_su', count: 0 },
      { rank: 'unknown', count: 2 },
    ])
    expect(stats.byRankNi).toEqual([
      { rank: 'ni_truong', count: 0 },
      { rank: 'ni_su', count: 2 },
      { rank: 'ty_kheo_ni', count: 1 },
      { rank: 'thuc_xoa_ma_na', count: 0 },
      { rank: 'sa_di_ni', count: 0 },
      { rank: 'tap_su', count: 0 },
      { rank: 'unknown', count: 1 },
    ])
  })

  it('allows a secretary', async () => {
    await seedSample()
    expect((await callData<MemberDirectoryStats>('stats/members', body, secretary)).totals.all).toBe(10)
  })

  it('scopes the totals and ranks to one org unit but not the breakdown', async () => {
    await seedSample()
    const stats = await callData<MemberDirectoryStats>(
      'stats/members',
      { orgUnitId: 'gd-i', orgUnitIdsForBreakdown: ['gd-i'] },
      gdAdmin,
    )
    expect(stats.totals).toEqual({ all: 4, tang: 4, ni: 0 })
    expect(stats.byOrgUnit).toEqual([{ orgUnitId: 'gd-i', count: 4 }])
    expect(stats.byRankTang.find((row) => row.rank === 'ty_kheo')?.count).toBe(2)
    expect(stats.byRankTang.at(-1)).toEqual({ rank: 'unknown', count: 1 })
    expect(stats.byRankNi.every((row) => row.count === 0)).toBe(true)
  })

  it('allows a giáo đoàn admin an empty breakdown', async () => {
    await seedSample()
    const stats = await callData<MemberDirectoryStats>(
      'stats/members',
      { orgUnitId: 'gd-i', orgUnitIdsForBreakdown: [] },
      gdAdmin,
    )
    expect(stats.byOrgUnit).toEqual([])
  })

  it.each([
    ['an unscoped query by a giáo đoàn admin', gdAdmin, { orgUnitId: null, orgUnitIdsForBreakdown: [] }],
    ['another org unit', gdAdmin, { orgUnitId: 'gd-ii', orgUnitIdsForBreakdown: [] }],
    ['a breakdown containing another org unit', gdAdmin, { orgUnitId: 'gd-i', orgUnitIdsForBreakdown: ['gd-i', 'gd-ii'] }],
    ['a giáo đoàn admin without an org unit', gdNoOrg, { orgUnitId: null, orgUnitIdsForBreakdown: [] }],
    ['a giáo đoàn admin without an org unit asking for gd-i', gdNoOrg, { orgUnitId: 'gd-i', orgUnitIdsForBreakdown: [] }],
    ['gd-ii admin on gd-i', gdIiAdmin, { orgUnitId: 'gd-i', orgUnitIdsForBreakdown: [] }],
    ['anon', anon, body],
    ['kiểm soát', kiemSoat, body],
  ])('refuses %s', async (_, caller, request) => {
    await seedSample()
    await expectDomainError(callData('stats/members', request, caller), 'FORBIDDEN')
  })

  it.each([
    ['a missing orgUnitId', { orgUnitIdsForBreakdown: [] }],
    ['an empty orgUnitId', { orgUnitId: '', orgUnitIdsForBreakdown: [] }],
    ['a numeric orgUnitId', { orgUnitId: 5, orgUnitIdsForBreakdown: [] }],
    ['a missing breakdown', { orgUnitId: null }],
    ['a breakdown with non-strings', { orgUnitId: null, orgUnitIdsForBreakdown: [1] }],
    ['a too large breakdown', { orgUnitId: null, orgUnitIdsForBreakdown: Array.from({ length: 201 }, (_, i) => `u${i}`) }],
  ])('rejects %s', async (_, request) => {
    await expectDomainError(callData('stats/members', request, hePhaiAdmin), 'INVALID_INPUT')
  })

  it.each([
    ['unscoped', body, hePhaiAdmin],
    ['scoped', { orgUnitId: 'gd-i', orgUnitIdsForBreakdown: ['gd-i'] }, gdAdmin],
  ])('uses indexes (%s)', async (_, request, caller) => {
    await seedSample()
    const plans = await queryPlansOf('stats/members', request, caller)
    expect(plans.length).toBeGreaterThan(0)
    expect(fullTableScans(plans)).toEqual([])
  })
})

describe('stats/temples', () => {
  const body = {
    orgUnitId: null,
    orgUnitIdsForBreakdown: ['gd-i', 'gd-ii', 'gd-iii'],
    cityNamesForBreakdown: ['Hà Nội', 'TP Hồ Chí Minh', 'Đà Nẵng'],
  }

  async function seedSample(): Promise<void> {
    await seedTemples(
      temple('gd-i', 'TP Hồ Chí Minh'),
      temple('gd-i', 'TP Hồ Chí Minh'),
      temple('gd-i', 'Hà Nội'),
      temple('gd-i'),
      temple('gd-ii', 'Hà Nội'),
      temple('gd-ii', 'Cần Thơ'),
    )
  }

  it('is all zero for an empty directory', async () => {
    const stats = await callData<TempleDirectoryStats>('stats/temples', body, hePhaiAdmin)
    expect(stats).toEqual({
      totals: { all: 0 },
      byOrgUnit: [
        { orgUnitId: 'gd-i', count: 0 },
        { orgUnitId: 'gd-ii', count: 0 },
        { orgUnitId: 'gd-iii', count: 0 },
      ],
      byCity: [
        { cityName: 'Hà Nội', count: 0 },
        { cityName: 'TP Hồ Chí Minh', count: 0 },
        { cityName: 'Đà Nẵng', count: 0 },
        { cityName: 'unknown', count: 0 },
      ],
    })
  })

  it('counts totals, org units and cities like templeStatsRepo', async () => {
    await seedSample()
    const stats = await callData<TempleDirectoryStats>('stats/temples', body, secretary)
    expect(stats).toEqual({
      totals: { all: 6 },
      byOrgUnit: [
        { orgUnitId: 'gd-i', count: 4 },
        { orgUnitId: 'gd-ii', count: 2 },
        { orgUnitId: 'gd-iii', count: 0 },
      ],
      byCity: [
        { cityName: 'Hà Nội', count: 2 },
        { cityName: 'TP Hồ Chí Minh', count: 2 },
        { cityName: 'Đà Nẵng', count: 0 },
        { cityName: 'unknown', count: 2 },
      ],
    })
  })

  it('scopes the totals and cities to one org unit', async () => {
    await seedSample()
    const stats = await callData<TempleDirectoryStats>(
      'stats/temples',
      { orgUnitId: 'gd-i', orgUnitIdsForBreakdown: ['gd-i'], cityNamesForBreakdown: ['Hà Nội', 'Cần Thơ'] },
      gdAdmin,
    )
    expect(stats).toEqual({
      totals: { all: 4 },
      byOrgUnit: [{ orgUnitId: 'gd-i', count: 4 }],
      byCity: [
        { cityName: 'Hà Nội', count: 1 },
        { cityName: 'Cần Thơ', count: 0 },
        { cityName: 'unknown', count: 3 },
      ],
    })
  })

  it.each([
    ['an unscoped query by a giáo đoàn admin', gdAdmin, { ...body, orgUnitIdsForBreakdown: [] }],
    ['another org unit', gdAdmin, { ...body, orgUnitId: 'gd-ii', orgUnitIdsForBreakdown: [] }],
    ['a breakdown containing another org unit', gdAdmin, { ...body, orgUnitId: 'gd-i', orgUnitIdsForBreakdown: ['gd-i', 'gd-ii'] }],
    ['a giáo đoàn admin without an org unit', gdNoOrg, { ...body, orgUnitIdsForBreakdown: [] }],
    ['anon', anon, body],
    ['kiểm soát', kiemSoat, body],
  ])('refuses %s', async (_, caller, request) => {
    await seedSample()
    await expectDomainError(callData('stats/temples', request, caller), 'FORBIDDEN')
  })

  it.each([
    ['a missing cityNamesForBreakdown', { orgUnitId: null, orgUnitIdsForBreakdown: [] }],
    ['non-string city names', { ...body, cityNamesForBreakdown: [1] }],
    ['a missing orgUnitId', { orgUnitIdsForBreakdown: [], cityNamesForBreakdown: [] }],
  ])('rejects %s', async (_, request) => {
    await expectDomainError(callData('stats/temples', request, hePhaiAdmin), 'INVALID_INPUT')
  })

  it.each([
    ['unscoped', body, hePhaiAdmin],
    ['scoped', { ...body, orgUnitId: 'gd-i', orgUnitIdsForBreakdown: ['gd-i'] }, gdAdmin],
  ])('uses indexes (%s)', async (_, request, caller) => {
    await seedSample()
    const plans = await queryPlansOf('stats/temples', request, caller)
    expect(plans.length).toBeGreaterThan(0)
    expect(fullTableScans(plans)).toEqual([])
  })
})
