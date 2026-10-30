import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import { ORG_UNIT_SEED } from '#/domain/orgUnitSeed'
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
} from './test/fixtures'
import { auditLogFromRow, auditLogToRow, type AuditLogRow } from './rows/auditLog'
import { inviteFromRow, inviteToRow, type InviteRow } from './rows/invite'
import { memberFromRow, memberToRow, type MemberRow } from './rows/member'
import { orgUnitFromRow, type OrgUnitRow } from './rows/orgUnit'
import {
  registrationFromRow,
  registrationToRow,
  type RegistrationRow,
} from './rows/registration'
import { retreatFromRow, retreatToRow, type RetreatRow } from './rows/retreat'
import {
  templeFromRow,
  templeManagerPhoneRows,
  templeToRow,
  type TempleRow,
} from './rows/temple'
import { clearData, insertRow as insert } from './test/db'

async function selectById<T>(table: string, id: string): Promise<T> {
  const row = await env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first<T>()
  if (!row) throw new Error(`${table}/${id} not found`)
  return row
}

beforeEach(clearData)

describe('migrations', () => {
  it('seeds the org units from orgUnitSeed.ts', async () => {
    const { results } = await env.DB.prepare(
      'SELECT * FROM org_units ORDER BY sort_order',
    ).all<OrgUnitRow>()
    expect(results.map(orgUnitFromRow)).toEqual(ORG_UNIT_SEED)
  })
})

describe('rows round-trip through D1', () => {
  it('members', async () => {
    await env.DB.batch([insert('members', memberToRow(minimalMember)), insert('members', memberToRow(fullMember))])
    for (const member of [minimalMember, fullMember]) {
      const row = await selectById<MemberRow & { version: number }>('members', member.id)
      expect(row.version).toBe(1)
      expect(memberFromRow(row)).toEqual(member)
    }
  })

  it('temples and their manager phones', async () => {
    await env.DB.batch([
      insert('temples', templeToRow(fullTemple)),
      ...templeManagerPhoneRows(fullTemple).map((row) => insert('temple_manager_phones', row)),
      insert('temples', templeToRow(minimalTemple)),
    ])
    expect(templeFromRow(await selectById<TempleRow>('temples', fullTemple.id))).toEqual(fullTemple)
    expect(templeFromRow(await selectById<TempleRow>('temples', minimalTemple.id))).toEqual(minimalTemple)

    const { results } = await env.DB.prepare(
      'SELECT temple_id FROM temple_manager_phones WHERE org_unit_id = ? AND phone = ?',
    )
      .bind('gd-i', '0912345678')
      .all<{ temple_id: string }>()
    expect(results).toEqual([{ temple_id: fullTemple.id }])
  })

  it('invites', async () => {
    await env.DB.batch([insert('invites', inviteToRow(fillerInvite)), insert('invites', inviteToRow(retreatInvite))])
    for (const invite of [fillerInvite, retreatInvite]) {
      expect(inviteFromRow(await selectById<InviteRow>('invites', invite.id))).toEqual(invite)
    }
  })

  it('retreats and registrations', async () => {
    await env.DB.batch([
      insert('retreats', retreatToRow(retreat)),
      insert('retreat_registrations', registrationToRow(pendingSelfRegistration)),
      insert('retreat_registrations', registrationToRow(rejectedProxyRegistration)),
    ])
    expect(retreatFromRow(await selectById<RetreatRow>('retreats', retreat.id))).toEqual(retreat)
    for (const registration of [pendingSelfRegistration, rejectedProxyRegistration]) {
      expect(
        registrationFromRow(await selectById<RegistrationRow>('retreat_registrations', registration.id)),
      ).toEqual(registration)
    }
  })

  it('audit logs with the same id under different parents', async () => {
    await env.DB.batch([
      insert('audit_logs', auditLogToRow({ type: 'members', id: 'old-id' }, auditLog)),
      insert('audit_logs', auditLogToRow({ type: 'members', id: 'new-id' }, auditLog)),
    ])
    const row = await env.DB.prepare(
      'SELECT * FROM audit_logs WHERE parent_type = ? AND parent_id = ?',
    )
      .bind('members', 'new-id')
      .first<AuditLogRow>()
    expect(row && auditLogFromRow(row)).toEqual(auditLog)
  })
})

describe('constraints', () => {
  it('rejects a second member with the same identity', async () => {
    await insert('members', memberToRow(minimalMember)).run()
    await expect(
      insert('members', memberToRow({ ...minimalMember, id: 'other-id' })).run(),
    ).rejects.toThrow(/UNIQUE/)
  })

  it('rejects a member of an unknown org unit', async () => {
    await expect(
      insert('members', memberToRow({ ...minimalMember, orgUnitId: 'missing' })).run(),
    ).rejects.toThrow(/FOREIGN KEY/)
  })

  it('rejects an unknown status', async () => {
    await expect(
      insert('members', { ...memberToRow(minimalMember), status: 'archived' }).run(),
    ).rejects.toThrow(/CHECK/)
  })

  it('removes manager phone rows with their temple', async () => {
    await env.DB.batch([
      insert('temples', templeToRow(fullTemple)),
      ...templeManagerPhoneRows(fullTemple).map((row) => insert('temple_manager_phones', row)),
    ])
    await env.DB.prepare('DELETE FROM temples WHERE id = ?').bind(fullTemple.id).run()
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM temple_manager_phones').first<number>('n')
    expect(count).toBe(0)
  })
})
