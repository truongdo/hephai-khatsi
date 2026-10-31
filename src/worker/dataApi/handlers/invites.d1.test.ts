import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import { anon, gdAdmin, hePhaiAdmin, kiemSoat, retreatDraft, secretary } from '#/domain/authz/testFixtures'
import { ORG_UNIT_SEED } from '#/domain/orgUnitSeed'
import type { Invite, OrgUnit } from '#/domain/types'
import { inviteToRow } from '../rows/invite'
import { retreatToRow } from '../rows/retreat'
import { clearData, insertStatement } from '../test/db'
import { NOW, callData, expectDomainError } from '../test/callData'
import { fillerInvite } from '../test/fixtures'

async function seedRetreat(orgUnitId = 'gd-i'): Promise<void> {
  await insertStatement('retreats', retreatToRow(retreatDraft({ id: 'r1', orgUnitId }))).run()
}

async function inviteCount(): Promise<number> {
  return (await env.DB.prepare('SELECT COUNT(*) AS n FROM invites').first<number>('n')) ?? 0
}

beforeEach(async () => {
  await clearData()
})

describe('invites/create', () => {
  it('creates the public filler invite for hệ phái admin and secretary', async () => {
    const invite = await callData<Invite>('invites/create', { kind: 'filler' }, hePhaiAdmin)
    expect(invite).toEqual({
      id: 'public',
      token: 'public',
      kind: 'filler',
      retreatId: null,
      orgUnitId: null,
      disabled: false,
      createdBy: 'hp-admin',
      createdAt: NOW,
    })
    expect(await callData('invites/get', { token: 'public' })).toEqual(invite)
    await clearData()
    expect((await callData<Invite>('invites/create', { kind: 'filler' }, secretary)).createdBy).toBe('hp-sec')
  })

  it('creates the retreat invite with the retreat’s org unit', async () => {
    await seedRetreat('gd-ii')
    const invite = await callData<Invite>(
      'invites/create',
      { kind: 'retreat_registration', retreatId: 'r1' },
      hePhaiAdmin,
    )
    expect(invite).toEqual({
      id: 'retreat_r1',
      token: 'retreat_r1',
      kind: 'retreat_registration',
      retreatId: 'r1',
      orgUnitId: 'gd-ii',
      disabled: false,
      createdBy: 'hp-admin',
      createdAt: NOW,
    })
    expect(await callData('invites/get', { token: 'retreat_r1' })).toEqual(invite)
  })

  it('lets a giáo đoàn admin create the invite of a retreat of their org unit', async () => {
    await seedRetreat('gd-i')
    const invite = await callData<Invite>('invites/create', { kind: 'retreat_registration', retreatId: 'r1' }, gdAdmin)
    expect(invite).toMatchObject({ id: 'retreat_r1', orgUnitId: 'gd-i', createdBy: 'gd-admin' })
  })

  it('refuses a giáo đoàn admin for a retreat of another org unit', async () => {
    await seedRetreat('gd-ii')
    await expectDomainError(
      callData('invites/create', { kind: 'retreat_registration', retreatId: 'r1' }, gdAdmin),
      'FORBIDDEN',
    )
    expect(await inviteCount()).toBe(0)
  })

  it('refuses a second create of either kind', async () => {
    await seedRetreat()
    await callData('invites/create', { kind: 'filler' }, hePhaiAdmin)
    await callData('invites/create', { kind: 'retreat_registration', retreatId: 'r1' }, hePhaiAdmin)
    await expectDomainError(callData('invites/create', { kind: 'filler' }, hePhaiAdmin), 'ALREADY_EXISTS')
    await expectDomainError(
      callData('invites/create', { kind: 'retreat_registration', retreatId: 'r1' }, gdAdmin),
      'ALREADY_EXISTS',
    )
    expect(await inviteCount()).toBe(2)
  })

  it.each([
    ['anon', anon],
    ['kiểm soát', kiemSoat],
  ])('refuses %s', async (_, caller) => {
    await seedRetreat()
    await expectDomainError(callData('invites/create', { kind: 'filler' }, caller), 'FORBIDDEN')
    await expectDomainError(
      callData('invites/create', { kind: 'retreat_registration', retreatId: 'r1' }, caller),
      'FORBIDDEN',
    )
    expect(await inviteCount()).toBe(0)
  })

  it('is NOT_FOUND for a missing retreat', async () => {
    await expectDomainError(
      callData('invites/create', { kind: 'retreat_registration', retreatId: 'nope' }, hePhaiAdmin),
      'NOT_FOUND',
    )
  })

  it.each([
    ['an unknown kind', { kind: 'other' }],
    ['no kind', {}],
    ['a retreat invite without retreatId', { kind: 'retreat_registration' }],
  ])('rejects %s', async (_, body) => {
    await expectDomainError(callData('invites/create', body, hePhaiAdmin), 'INVALID_INPUT')
  })
})

describe('invites/get', () => {
  it('is public and returns null when missing', async () => {
    await insertStatement('invites', inviteToRow(fillerInvite)).run()
    expect(await callData('invites/get', { token: 'public' }, anon)).toEqual(fillerInvite)
    expect(await callData('invites/get', { token: 'nope' }, anon)).toBeNull()
  })

  it('rejects a missing token', async () => {
    await expectDomainError(callData('invites/get', {}), 'INVALID_INPUT')
  })
})

describe('org-units', () => {
  it('lists the seeded org units ordered by sort_order', async () => {
    const units = await callData<OrgUnit[]>('org-units/list', {}, anon)
    expect(units).toEqual(ORG_UNIT_SEED)
    expect(units.map((unit) => unit.order)).toEqual([...units.map((unit) => unit.order)].sort((a, b) => a - b))
    expect(units.length).toBeGreaterThan(0)
  })

  it('gets an org unit by id, null when missing', async () => {
    expect(await callData('org-units/get', { id: 'gd-i' }, anon)).toEqual(
      ORG_UNIT_SEED.find((unit) => unit.id === 'gd-i'),
    )
    expect(await callData('org-units/get', { id: 'nope' }, anon)).toBeNull()
  })

  it('rejects a missing id', async () => {
    await expectDomainError(callData('org-units/get', {}), 'INVALID_INPUT')
  })
})
