import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import type { AuditLogEntry } from '#/domain/auditLog'
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
import { memberToRow } from '../rows/member'
import { auditLogToRow, type AuditLogParent } from '../rows/auditLog'
import { templeToRow } from '../rows/temple'
import { clearData, insertStatement } from '../test/db'
import { callData, expectDomainError, fullTableScans, queryPlansOf } from '../test/callData'
import { auditLog } from '../test/fixtures'

type Result = { entries: AuditLogEntry[]; nextStartAfterAt: string | null }

const gdIiAdmin = signedIn('gd-ii-admin', { role: 'giao_doan_admin', orgUnitId: 'gd-ii' })
const MEMBER_GD_I = memberDraft()
const MEMBER_GD_II = memberDraft({ orgUnitId: 'gd-ii' })
const at = (n: number) => `2026-02-0${n}T00:00:00.000Z`

function entry(n: number): AuditLogEntry {
  return { ...auditLog, id: `log-${n}`, at: at(n) }
}

async function seedLogs(parent: AuditLogParent, ...entries: AuditLogEntry[]): Promise<void> {
  await env.DB.batch(entries.map((e) => insertStatement('audit_logs', auditLogToRow(parent, e))))
}

const memberLogs = (id: string) => ({ parentType: 'members', parentId: id })

beforeEach(async () => {
  await clearData()
  await env.DB.batch([
    insertStatement('members', memberToRow(MEMBER_GD_I)),
    insertStatement('members', memberToRow(MEMBER_GD_II)),
    insertStatement('temples', templeToRow(templeDraft())),
  ])
})

describe('audit-logs/list', () => {
  it('lists newest first', async () => {
    await seedLogs({ type: 'members', id: MEMBER_GD_I.id }, entry(1), entry(3), entry(2))
    const { entries, nextStartAfterAt } = await callData<Result>('audit-logs/list', memberLogs(MEMBER_GD_I.id), hePhaiAdmin)
    expect(entries.map((e) => e.id)).toEqual(['log-3', 'log-2', 'log-1'])
    expect(entries[0]).toEqual(entry(3))
    expect(nextStartAfterAt).toBeNull()
  })

  it('only returns the logs of the requested record', async () => {
    await seedLogs({ type: 'members', id: MEMBER_GD_I.id }, entry(1))
    await seedLogs({ type: 'members', id: MEMBER_GD_II.id }, entry(2))
    await seedLogs({ type: 'temples', id: templeDraft().id }, entry(3))
    const ids = async (body: Record<string, unknown>) =>
      (await callData<Result>('audit-logs/list', body, hePhaiAdmin)).entries.map((e) => e.id)
    expect(await ids(memberLogs(MEMBER_GD_I.id))).toEqual(['log-1'])
    expect(await ids({ parentType: 'temples', parentId: templeDraft().id })).toEqual(['log-3'])
  })

  it('pages with limit and startAfterAt', async () => {
    await seedLogs({ type: 'members', id: MEMBER_GD_I.id }, entry(1), entry(2), entry(3), entry(4), entry(5))
    const body = memberLogs(MEMBER_GD_I.id)
    const first = await callData<Result>('audit-logs/list', { ...body, limit: 2 }, hePhaiAdmin)
    expect(first.entries.map((e) => e.id)).toEqual(['log-5', 'log-4'])
    expect(first.nextStartAfterAt).toBe(at(4))
    await seedLogs({ type: 'members', id: MEMBER_GD_I.id }, entry(9))
    const second = await callData<Result>(
      'audit-logs/list',
      { ...body, limit: 2, startAfterAt: first.nextStartAfterAt },
      hePhaiAdmin,
    )
    expect(second.entries.map((e) => e.id)).toEqual(['log-3', 'log-2'])
    const third = await callData<Result>(
      'audit-logs/list',
      { ...body, limit: 2, startAfterAt: second.nextStartAfterAt },
      hePhaiAdmin,
    )
    expect(third.entries.map((e) => e.id)).toEqual(['log-1'])
    expect(third.nextStartAfterAt).toBeNull()
  })

  it('lets a giáo đoàn admin and a secretary read a member of their scope', async () => {
    await seedLogs({ type: 'members', id: MEMBER_GD_I.id }, entry(1))
    for (const caller of [gdAdmin, secretary]) {
      const { entries } = await callData<Result>('audit-logs/list', memberLogs(MEMBER_GD_I.id), caller)
      expect(entries).toHaveLength(1)
    }
  })

  it('refuses a giáo đoàn admin reading a member of another org unit', async () => {
    await seedLogs({ type: 'members', id: MEMBER_GD_II.id }, entry(1))
    await expectDomainError(callData('audit-logs/list', memberLogs(MEMBER_GD_II.id), gdAdmin), 'FORBIDDEN')
    await expectDomainError(
      callData('audit-logs/list', memberLogs(MEMBER_GD_I.id), gdIiAdmin),
      'FORBIDDEN',
    )
  })

  it('lets only hệ phái scope read the history of a deleted record', async () => {
    const parent = { type: 'members' as const, id: 'gd-i_tang_999999999999' }
    await seedLogs(parent, entry(1))
    const body = memberLogs(parent.id)
    expect((await callData<Result>('audit-logs/list', body, hePhaiAdmin)).entries).toHaveLength(1)
    expect((await callData<Result>('audit-logs/list', body, secretary)).entries).toHaveLength(1)
    await expectDomainError(callData('audit-logs/list', body, gdAdmin), 'FORBIDDEN')
    await expectDomainError(callData('audit-logs/list', body, anon), 'FORBIDDEN')
  })

  it.each([
    ['anon', anon],
    ['kiểm soát', kiemSoat],
  ])('refuses %s', async (_, caller) => {
    await seedLogs({ type: 'members', id: MEMBER_GD_I.id }, entry(1))
    await expectDomainError(callData('audit-logs/list', memberLogs(MEMBER_GD_I.id), caller), 'FORBIDDEN')
  })

  it.each([
    ['an unknown parentType', { parentType: 'retreats', parentId: 'x' }],
    ['a missing parentId', { parentType: 'members' }],
    ['limit 0', { ...memberLogs('x'), limit: 0 }],
    ['limit above the maximum', { ...memberLogs('x'), limit: 101 }],
    ['a non-string startAfterAt', { ...memberLogs('x'), startAfterAt: 5 }],
  ])('rejects %s', async (_, body) => {
    await expectDomainError(callData('audit-logs/list', body, hePhaiAdmin), 'INVALID_INPUT')
  })

  it.each([
    ['first page', {}],
    ['with startAfterAt', { startAfterAt: at(4), limit: 2 }],
  ])('uses an index (%s)', async (_, extra) => {
    await seedLogs({ type: 'members', id: MEMBER_GD_I.id }, entry(1), entry(2), entry(3))
    const plans = await queryPlansOf('audit-logs/list', { ...memberLogs(MEMBER_GD_I.id), ...extra }, hePhaiAdmin)
    expect(plans.length).toBeGreaterThan(0)
    expect(fullTableScans(plans)).toEqual([])
  })
})
