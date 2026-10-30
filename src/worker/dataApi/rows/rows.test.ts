import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ORG_UNIT_SEED } from '#/domain/orgUnitSeed'
import type { Member, Temple } from '#/domain/types'
import {
  auditLog,
  fillerInvite,
  fullMember,
  fullTemple,
  minimalMember,
  minimalTemple,
  pendingSelfRegistration,
  rejectedProxyRegistration,
  retreat,
  retreatInvite,
} from '../test/fixtures'
import { auditLogFromRow, auditLogToRow } from './auditLog'
import { inviteFromRow, inviteToRow } from './invite'
import { memberFromRow, memberToRow } from './member'
import { orgUnitFromRow, orgUnitSeedSql, orgUnitToRow } from './orgUnit'
import { registrationFromRow, registrationToRow } from './registration'
import { retreatFromRow, retreatToRow } from './retreat'
import { templeFromRow, templeManagerPhoneRows, templeToRow } from './temple'

describe('member rows', () => {
  it.each([
    ['minimal', minimalMember],
    ['full', fullMember],
  ])('round-trips a %s member', (_, member) => {
    expect(memberFromRow(memberToRow(member))).toEqual(member)
  })

  it('keeps the same keys after a round trip', () => {
    expect(Object.keys(memberFromRow(memberToRow(minimalMember))).sort()).toEqual(
      Object.keys(minimalMember).sort(),
    )
  })

  it('fills the filter and sort columns', () => {
    const row = memberToRow(fullMember)
    expect(row).toMatchObject({
      org_unit_id: 'ni-gd-i',
      sangha_type: 'ni',
      status: 'locked',
      phone: '0912345678',
      giao_pham_he_phai_rank: 'ni_su',
      giao_pham_he_phai_rank_order: 3,
      ha_lap_tab_rank: 'ni_su',
      tinh_trang: 'sinh_hoat',
      directory_role: 'giao_doan_admin',
    })
  })

  it('keeps column fields out of the data JSON', () => {
    const data = JSON.parse(memberToRow(fullMember).data) as Record<string, unknown>
    expect(data).not.toHaveProperty('id')
    expect(data).not.toHaveProperty('status')
    expect(data).not.toHaveProperty('tinhTrang')
    expect(data).toHaveProperty('dienThoai', '+84 912 345 678')
    expect(data).toHaveProperty('giaoPhamHePhai')
  })

  it('leaves an invalid or missing phone unindexed', () => {
    expect(memberToRow({ ...minimalMember, dienThoai: '123' }).phone).toBeNull()
    expect(memberToRow(minimalMember).phone).toBeNull()
  })

  it('reads a cleared tinhTrang back as absent', () => {
    const cleared: Member = { ...fullMember, tinhTrang: null }
    expect(memberToRow(cleared).tinh_trang).toBeNull()
    expect(memberFromRow(memberToRow(cleared))).not.toHaveProperty('tinhTrang')
  })
})

describe('temple rows', () => {
  it.each([
    ['minimal', minimalTemple],
    ['full', fullTemple],
  ])('round-trips a %s temple', (_, temple) => {
    expect(templeFromRow(templeToRow(temple))).toEqual(temple)
  })

  it('defaults a missing photoPath to null', () => {
    const { photoPath: _photoPath, ...legacy } = minimalTemple
    const row = templeToRow(legacy as Temple)
    expect(templeFromRow(row).photoPath).toBeNull()
  })

  it('builds one phone row per distinct manager phone', () => {
    expect(
      templeManagerPhoneRows({ ...fullTemple, managerPhones: ['0901234567', '0901234567', '0912345678'] }),
    ).toEqual([
      { temple_id: 'temple-1', org_unit_id: 'gd-i', phone: '0901234567' },
      { temple_id: 'temple-1', org_unit_id: 'gd-i', phone: '0912345678' },
    ])
  })
})

describe('invite rows', () => {
  it.each([
    ['filler', fillerInvite],
    ['retreat registration', retreatInvite],
  ])('round-trips a %s invite', (_, invite) => {
    expect(inviteFromRow(inviteToRow(invite))).toEqual(invite)
  })

  it('rejects an invite whose token is not its id', () => {
    expect(() => inviteToRow({ ...fillerInvite, token: 'other' })).toThrow('Invite token must equal its id')
  })
})

describe('org unit rows', () => {
  it.each(ORG_UNIT_SEED.map((unit) => [unit.id, unit] as const))('round-trips %s', (_, unit) => {
    expect(orgUnitFromRow(orgUnitToRow(unit))).toEqual(unit)
  })

  it('escapes quotes in the seed SQL', () => {
    expect(orgUnitSeedSql([{ ...ORG_UNIT_SEED[0]!, name: "Giáo đoàn 'I'" }])).toContain(
      "'Giáo đoàn ''I'''",
    )
  })

  it('matches the committed seed migration (run pnpm db:seed-sql:org-units)', () => {
    const migration = readFileSync(
      new URL('../../../../migrations/0002_seed_org_units.sql', import.meta.url),
      'utf8',
    )
    expect(migration).toBe(orgUnitSeedSql(ORG_UNIT_SEED))
  })
})

describe('audit log rows', () => {
  it('round-trips an entry with its parent', () => {
    const row = auditLogToRow({ type: 'members', id: fullMember.id }, auditLog)
    expect(row).toMatchObject({ parent_type: 'members', parent_id: fullMember.id, id: 'log-1' })
    expect(auditLogFromRow(row)).toEqual(auditLog)
  })

  it('keeps a null summary', () => {
    const entry = { ...auditLog, action: 'locked' as const, changes: [], summary: null }
    expect(auditLogFromRow(auditLogToRow({ type: 'temples', id: 't' }, entry))).toEqual(entry)
  })
})

describe('retreat rows', () => {
  it('round-trips a retreat', () => {
    expect(retreatFromRow(retreatToRow(retreat))).toEqual(retreat)
  })
})

describe('registration rows', () => {
  it.each([
    ['pending self', pendingSelfRegistration],
    ['rejected proxy', rejectedProxyRegistration],
  ])('round-trips a %s registration', (_, registration) => {
    expect(registrationFromRow(registrationToRow(registration))).toEqual(registration)
  })
})
