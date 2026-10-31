import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  MEMBER_ID,
  RETREAT_ID,
  anon,
  gdAdmin,
  hePhaiAdmin,
  kiemSoat,
  memberDraft,
  registrationDraft,
  retreatDraft,
  secretary,
  signedIn,
} from '#/domain/authz/testFixtures'
import type { Member } from '#/domain/types'
import type { Retreat } from '#/domain/retreat'
import type { RetreatRegistration } from '#/domain/retreatRegistration'
import { memberToRow } from '../rows/member'
import { registrationToRow } from '../rows/registration'
import { retreatToRow } from '../rows/retreat'
import { clearData, insertStatement } from '../test/db'
import { NOW, callData, expectDomainError, fullTableScans, queryPlansOf } from '../test/callData'

type Page = { items: RetreatRegistration[]; nextCursor: string | null }

/** Inside the retreat's registration window (dangKyMoTu..dangKyDongLuc). */
const IN_WINDOW = '2026-07-10T00:00:00.000Z'
const gdIiAdmin = signedIn('gd-ii-admin', { role: 'giao_doan_admin', orgUnitId: 'gd-ii' })

const openRetreat = (overrides: Partial<Retreat> = {}) =>
  retreatDraft({ id: RETREAT_ID, status: 'open', ...overrides })

async function seed(table: string, rows: Record<string, never>[]): Promise<void> {
  await env.DB.batch(rows.map((row) => insertStatement(table, row)))
}
const seedRetreats = (...retreats: Retreat[]) => seed('retreats', retreats.map(retreatToRow) as never)
const seedMembers = (...members: Member[]) => seed('members', members.map(memberToRow) as never)
const seedRegistrations = (...registrations: RetreatRegistration[]) =>
  seed('retreat_registrations', registrations.map(registrationToRow) as never)

async function versionOf(id: string): Promise<number | null> {
  return env.DB.prepare('SELECT version FROM retreat_registrations WHERE id = ?').bind(id).first<number>('version')
}

const pending = (overrides: Partial<RetreatRegistration> = {}) => registrationDraft(overrides)

beforeEach(async () => {
  await clearData()
})

describe('registrations/create', () => {
  const self = { retreatId: RETREAT_ID, memberId: MEMBER_ID, registeredVia: 'self', extraAnswers: {} }
  const proxy = { ...self, registeredVia: 'proxy' }

  beforeEach(async () => {
    await seedRetreats(openRetreat())
    await seedMembers(memberDraft())
  })

  it('lets anon register themselves inside the window', async () => {
    const registration = await callData<RetreatRegistration>('registrations/create', self, anon, IN_WINDOW)
    expect(registration).toEqual({
      id: `${RETREAT_ID}_${MEMBER_ID}`,
      retreatId: RETREAT_ID,
      memberId: MEMBER_ID,
      orgUnitId: 'gd-i',
      registeredVia: 'self',
      registeredBy: null,
      extraAnswers: {},
      status: 'pending',
      rejectionReason: null,
      approvedBy: null,
      approvedAt: null,
      createdAt: IN_WINDOW,
      updatedAt: IN_WINDOW,
    })
    expect(await callData('registrations/get', { id: registration.id })).toEqual(registration)
    expect(await versionOf(registration.id)).toBe(1)
  })

  it('does not record the caller of a self registration', async () => {
    const registration = await callData<RetreatRegistration>('registrations/create', self, gdAdmin, IN_WINDOW)
    expect(registration.registeredBy).toBeNull()
  })

  it('lets a giáo đoàn admin register a member by proxy, recording the caller', async () => {
    const registration = await callData<RetreatRegistration>(
      'registrations/create',
      { ...proxy, registeredBy: 'someone-else' },
      gdAdmin,
      IN_WINDOW,
    )
    expect(registration).toMatchObject({ registeredVia: 'proxy', registeredBy: 'gd-admin' })
  })

  it('lets hệ phái admin and secretary register by proxy', async () => {
    const registration = await callData<RetreatRegistration>('registrations/create', proxy, secretary, IN_WINDOW)
    expect(registration.registeredBy).toBe('hp-sec')
    await clearData()
    await seedRetreats(openRetreat())
    await seedMembers(memberDraft())
    expect(
      (await callData<RetreatRegistration>('registrations/create', proxy, hePhaiAdmin, IN_WINDOW)).registeredBy,
    ).toBe('hp-admin')
  })

  it('refuses a proxy registration by anon', async () => {
    await expectDomainError(callData('registrations/create', proxy, anon, IN_WINDOW), 'UNAUTHORIZED')
  })

  it('refuses a proxy registration by kiểm soát or a giáo đoàn admin of another org unit', async () => {
    await expectDomainError(callData('registrations/create', proxy, kiemSoat, IN_WINDOW), 'FORBIDDEN')
    await expectDomainError(callData('registrations/create', proxy, gdIiAdmin, IN_WINDOW), 'FORBIDDEN')
  })

  it.each(['draft', 'closed'] as const)('refuses a %s retreat with INVALID_STATUS', async (status) => {
    await clearData()
    await seedRetreats(openRetreat({ status }))
    await seedMembers(memberDraft())
    await expectDomainError(callData('registrations/create', self, anon, IN_WINDOW), 'INVALID_STATUS')
  })

  it.each([
    ['before', '2026-06-30T23:59:59.000Z'],
    ['after', '2026-07-20T00:00:01.000Z'],
    ['after (the default now)', NOW],
  ])('refuses a registration %s the window with INVALID_INPUT', async (_, now) => {
    await expectDomainError(callData('registrations/create', self, anon, now), 'INVALID_INPUT')
  })

  it('accepts the window bounds', async () => {
    await callData('registrations/create', self, anon, '2026-07-01T00:00:00.000Z')
    await clearData()
    await seedRetreats(openRetreat())
    await seedMembers(memberDraft())
    await callData('registrations/create', self, anon, '2026-07-20T00:00:00.000Z')
  })

  it('refuses a registration kind the retreat does not allow', async () => {
    await clearData()
    await seedRetreats(openRetreat({ quyenDangKy: 'proxy_only' }))
    await seedMembers(memberDraft())
    await expectDomainError(callData('registrations/create', self, anon, IN_WINDOW), 'INVALID_INPUT')
    await clearData()
    await seedRetreats(openRetreat({ quyenDangKy: 'tu_dang_ky' }))
    await seedMembers(memberDraft())
    await expectDomainError(callData('registrations/create', proxy, gdAdmin, IN_WINDOW), 'INVALID_INPUT')
  })

  it('refuses a member of another org unit', async () => {
    await seedMembers(memberDraft({ orgUnitId: 'gd-ii' }))
    const other = memberDraft({ orgUnitId: 'gd-ii' })
    await expectDomainError(
      callData('registrations/create', { ...self, memberId: other.id }, anon, IN_WINDOW),
      'FORBIDDEN',
    )
  })

  it('refuses a duplicate registration', async () => {
    await callData('registrations/create', self, anon, IN_WINDOW)
    await expectDomainError(callData('registrations/create', self, anon, IN_WINDOW), 'ALREADY_EXISTS')
    await expectDomainError(callData('registrations/create', proxy, gdAdmin, IN_WINDOW), 'ALREADY_EXISTS')
  })

  it('is NOT_FOUND for a missing retreat or member', async () => {
    await expectDomainError(
      callData('registrations/create', { ...self, retreatId: 'nope' }, anon, IN_WINDOW),
      'NOT_FOUND',
    )
    await expectDomainError(
      callData('registrations/create', { ...self, memberId: 'gd-i_tang_999999999999' }, anon, IN_WINDOW),
      'NOT_FOUND',
    )
  })

  it('requires the retreat’s extra answers', async () => {
    await clearData()
    await seedRetreats(openRetreat({ extraFields: [{ key: 'size_ao', label: 'Cỡ áo', required: true }] }))
    await seedMembers(memberDraft())
    await expectDomainError(callData('registrations/create', self, anon, IN_WINDOW), 'INVALID_INPUT')
    await expectDomainError(
      callData('registrations/create', { ...self, extraAnswers: { size_ao: '  ' } }, anon, IN_WINDOW),
      'INVALID_INPUT',
    )
    const registration = await callData<RetreatRegistration>(
      'registrations/create',
      { ...self, extraAnswers: { size_ao: 'M' } },
      anon,
      IN_WINDOW,
    )
    expect(registration.extraAnswers).toEqual({ size_ao: 'M' })
  })

  it.each([
    ['a missing retreatId', { ...self, retreatId: undefined }],
    ['a missing memberId', { ...self, memberId: undefined }],
    ['an unknown registeredVia', { ...self, registeredVia: 'other' }],
    ['no extraAnswers', { ...self, extraAnswers: undefined }],
    ['non-string answers', { ...self, extraAnswers: { a: 1 } }],
  ])('rejects %s', async (_, body) => {
    await expectDomainError(callData('registrations/create', body, anon, IN_WINDOW), 'INVALID_INPUT')
  })
})

describe('registrations/get', () => {
  it('is public and returns null when missing', async () => {
    await seedRegistrations(pending())
    expect(await callData<RetreatRegistration>('registrations/get', { id: pending().id }, anon)).toEqual(pending())
    expect(await callData('registrations/get', { id: 'nope' }, anon)).toBeNull()
  })

  it('rejects a missing id', async () => {
    await expectDomainError(callData('registrations/get', {}), 'INVALID_INPUT')
  })
})

describe('registrations/review', () => {
  const other = memberDraft({ cccd: '012345678902' })
  const second = () => pending({ memberId: other.id })

  it('approves a pending registration as the caller, with no rejection reason', async () => {
    await seedRegistrations(pending())
    const [reviewed] = await callData<RetreatRegistration[]>(
      'registrations/review',
      { ids: [pending().id], status: 'approved', rejectionReason: 'ignored' },
      gdAdmin,
    )
    expect(reviewed).toMatchObject({
      status: 'approved',
      approvedBy: 'gd-admin',
      approvedAt: NOW,
      rejectionReason: null,
      updatedAt: NOW,
    })
    expect(await callData('registrations/get', { id: pending().id })).toEqual(reviewed)
    expect(await versionOf(pending().id)).toBe(2)
  })

  it('rejects with a trimmed reason', async () => {
    await seedRegistrations(pending())
    const [reviewed] = await callData<RetreatRegistration[]>(
      'registrations/review',
      { ids: [pending().id], status: 'rejected', rejectionReason: '  Không đúng đối tượng ' },
      hePhaiAdmin,
    )
    expect(reviewed).toMatchObject({ status: 'rejected', approvedBy: 'hp-admin', rejectionReason: 'Không đúng đối tượng' })
  })

  it.each([
    ['blank', '   '],
    ['empty', ''],
    ['null', null],
    ['absent', undefined],
  ])('stores no reason when the rejection reason is %s', async (_, rejectionReason) => {
    await seedRegistrations(pending())
    const [reviewed] = await callData<RetreatRegistration[]>(
      'registrations/review',
      { ids: [pending().id], status: 'rejected', rejectionReason },
      gdAdmin,
    )
    expect(reviewed).toMatchObject({ status: 'rejected', rejectionReason: null })
  })

  it('reviews several registrations at once', async () => {
    await seedRegistrations(pending(), second())
    const reviewed = await callData<RetreatRegistration[]>(
      'registrations/review',
      { ids: [pending().id, second().id], status: 'approved' },
      secretary,
    )
    expect(reviewed.map((registration) => registration.approvedBy)).toEqual(['hp-sec', 'hp-sec'])
  })

  it('refuses reviewing a registration that is not pending', async () => {
    await seedRegistrations(pending({ status: 'approved', approvedBy: 'x', approvedAt: NOW }))
    await expectDomainError(
      callData('registrations/review', { ids: [pending().id], status: 'rejected' }, gdAdmin),
      'FORBIDDEN',
    )
  })

  it('reviews nothing when one of several is not pending', async () => {
    await seedRegistrations(pending(), { ...second(), status: 'approved', approvedBy: 'x', approvedAt: NOW })
    await expectDomainError(
      callData('registrations/review', { ids: [pending().id, second().id], status: 'approved' }, gdAdmin),
      'FORBIDDEN',
    )
    expect(await versionOf(pending().id)).toBe(1)
  })

  it('refuses a giáo đoàn admin of another org unit, anon and kiểm soát', async () => {
    await seedRegistrations(pending())
    for (const caller of [gdIiAdmin, anon, kiemSoat]) {
      await expectDomainError(
        callData('registrations/review', { ids: [pending().id], status: 'approved' }, caller),
        'FORBIDDEN',
      )
    }
    expect(await versionOf(pending().id)).toBe(1)
  })

  it('is NOT_FOUND when an id is missing', async () => {
    await seedRegistrations(pending())
    await expectDomainError(
      callData('registrations/review', { ids: [pending().id, 'nope'], status: 'approved' }, gdAdmin),
      'NOT_FOUND',
    )
    expect(await versionOf(pending().id)).toBe(1)
  })

  it.each([
    ['an unknown status', { ids: ['a'], status: 'pending' }],
    ['a missing status', { ids: ['a'] }],
    ['ids that are not a list', { ids: 'a', status: 'approved' }],
    ['a non-string reason', { ids: ['a'], status: 'rejected', rejectionReason: 5 }],
  ])('rejects %s', async (_, body) => {
    await expectDomainError(callData('registrations/review', body, gdAdmin), 'INVALID_INPUT')
  })
})

describe('registrations/list-by-retreat', () => {
  const at = (n: number) => `2026-07-0${n}T00:00:00.000Z`
  const registrationOf = (n: number, orgUnitId = 'gd-i') =>
    pending({ memberId: `${orgUnitId}_tang_00000000000${n}`, orgUnitId, createdAt: at(n) })

  async function seedFive(): Promise<void> {
    await seedRegistrations(
      registrationOf(1),
      registrationOf(2, 'gd-ii'),
      registrationOf(3),
      registrationOf(4, 'gd-ii'),
      registrationOf(5),
      pending({ retreatId: 'other', memberId: 'x', createdAt: at(6) }),
    )
  }

  const ids = async (body: Record<string, unknown>, caller = hePhaiAdmin) =>
    (await callData<Page>('registrations/list-by-retreat', body, caller)).items.map((item) => item.memberId)

  it('lists the retreat’s registrations newest first for hệ phái scope', async () => {
    await seedFive()
    expect(await ids({ retreatId: RETREAT_ID })).toEqual([
      'gd-i_tang_000000000005',
      'gd-ii_tang_000000000004',
      'gd-i_tang_000000000003',
      'gd-ii_tang_000000000002',
      'gd-i_tang_000000000001',
    ])
    expect(await ids({ retreatId: RETREAT_ID }, secretary)).toHaveLength(5)
  })

  it('shows a giáo đoàn admin only their org unit’s registrations', async () => {
    await seedFive()
    expect(await ids({ retreatId: RETREAT_ID }, gdAdmin)).toEqual([
      'gd-i_tang_000000000005',
      'gd-i_tang_000000000003',
      'gd-i_tang_000000000001',
    ])
    expect(await ids({ retreatId: RETREAT_ID }, gdIiAdmin)).toEqual([
      'gd-ii_tang_000000000004',
      'gd-ii_tang_000000000002',
    ])
  })

  it('refuses anon and kiểm soát, and rejects a missing retreatId', async () => {
    await seedFive()
    await expectDomainError(callData('registrations/list-by-retreat', { retreatId: RETREAT_ID }, anon), 'FORBIDDEN')
    await expectDomainError(callData('registrations/list-by-retreat', { retreatId: RETREAT_ID }, kiemSoat), 'FORBIDDEN')
    await expectDomainError(callData('registrations/list-by-retreat', {}, hePhaiAdmin), 'INVALID_INPUT')
    await expectDomainError(
      callData('registrations/list-by-retreat', { retreatId: RETREAT_ID, limit: 0 }, hePhaiAdmin),
      'INVALID_INPUT',
    )
  })

  it('pages with a stable cursor while rows are added', async () => {
    await seedFive()
    const first = await callData<Page>('registrations/list-by-retreat', { retreatId: RETREAT_ID, limit: 2 }, hePhaiAdmin)
    expect(first.items.map((item) => item.createdAt)).toEqual([at(5), at(4)])
    await seedRegistrations(registrationOf(9))
    const secondPage = await callData<Page>(
      'registrations/list-by-retreat',
      { retreatId: RETREAT_ID, limit: 2, cursor: first.nextCursor },
      hePhaiAdmin,
    )
    expect(secondPage.items.map((item) => item.createdAt)).toEqual([at(3), at(2)])
    const third = await callData<Page>(
      'registrations/list-by-retreat',
      { retreatId: RETREAT_ID, limit: 2, cursor: secondPage.nextCursor },
      hePhaiAdmin,
    )
    expect(third.items.map((item) => item.createdAt)).toEqual([at(1)])
    expect(third.nextCursor).toBeNull()
  })

  it.each([
    ['hệ phái', hePhaiAdmin],
    ['giáo đoàn admin', gdAdmin],
  ])('uses an index for %s', async (_, caller) => {
    await seedFive()
    const plans = await queryPlansOf('registrations/list-by-retreat', { retreatId: RETREAT_ID, limit: 2 }, caller)
    expect(plans.length).toBeGreaterThan(0)
    expect(fullTableScans(plans)).toEqual([])
  })
})
