import { describe, expect, it } from 'vitest'
import type { AuditLogWrite } from '#/domain/auditLog'
import { canCreateAuditLog, canReadAuditLogs, type AuditLogParent } from './auditLogs'
import {
  anon,
  auditLogEntry,
  invites,
  kiemSoat,
  legacyAdmin,
  memberDraft,
  memberLocked,
  signedIn,
  templeDraft,
  templeLocked,
} from './testFixtures'

// Ported from firestoreRules.integration.test.ts (`member auditLogs`,
// `temple auditLogs`). Update and delete have no counterpart: the data API
// only ever inserts audit logs.

const seeded = invites()

const parents: Array<{ name: string; draft: AuditLogParent; locked: AuditLogParent }> = [
  {
    name: 'member',
    draft: { type: 'members', record: memberDraft() },
    locked: { type: 'members', record: memberLocked() },
  },
  {
    name: 'temple',
    draft: { type: 'temples', record: templeDraft() },
    locked: { type: 'temples', record: templeLocked() },
  },
]

describe.each(parents)('$name auditLogs', ({ name, draft, locked }) => {
  it('allows admin get and list; denies unauthenticated get and list', () => {
    expect(canReadAuditLogs(legacyAdmin)).toBe(true)
    expect(canReadAuditLogs(anon)).toBe(false)
    expect(canReadAuditLogs(kiemSoat)).toBe(false)
  })

  it('allows admin to create a valid-shaped audit log', () => {
    expect(canCreateAuditLog(legacyAdmin, draft, auditLogEntry(), seeded)).toBe(true)
  })

  it('allows filler with valid invite on parent to create a valid-shaped audit log', () => {
    const entry = auditLogEntry({ actorType: 'filler', actorId: '0912345678', action: 'locked' })
    expect(canCreateAuditLog(anon, draft, entry, seeded)).toBe(true)
  })

  it(`allows filler to create ${name} and audit log in the same batch`, () => {
    const entry = auditLogEntry({ actorType: 'filler', actorId: '0912345678', action: 'created' })
    expect(canCreateAuditLog(anon, locked, entry, seeded)).toBe(true)
  })

  it('denies filler when the parent has no valid invite', () => {
    const entry = auditLogEntry({ actorType: 'filler', actorId: '0912345678' })
    const noInvite = { ...draft, record: { ...draft.record, inviteId: null } } as AuditLogParent
    const unknownInvite = { ...draft, record: { ...draft.record, inviteId: 'gone' } } as AuditLogParent
    expect(canCreateAuditLog(anon, noInvite, entry, seeded)).toBe(false)
    expect(canCreateAuditLog(anon, unknownInvite, entry, seeded)).toBe(false)
  })

  it('rejects filler invite create when actorType is admin', () => {
    const entry = auditLogEntry({ actorType: 'admin', actorId: 'admin-uid' })
    expect(canCreateAuditLog(anon, draft, entry, seeded)).toBe(false)
  })

  it('rejects create when action, actorId, or changes are missing', () => {
    const { action: _action, ...noAction } = auditLogEntry()
    const { actorId: _actorId, ...noActorId } = auditLogEntry()
    const { changes: _changes, ...noChanges } = auditLogEntry()
    for (const entry of [noAction, noActorId, noChanges, auditLogEntry({ actorId: '' })]) {
      expect(canCreateAuditLog(legacyAdmin, draft, entry as AuditLogWrite, seeded)).toBe(false)
    }
  })
})

describe('auditLogs filler caller', () => {
  const entry = auditLogEntry({ actorType: 'filler', actorId: '0912345678' })

  it('denies kiem_soat on both parents', () => {
    expect(canCreateAuditLog(kiemSoat, parents[0].draft, entry, seeded)).toBe(false)
    expect(canCreateAuditLog(kiemSoat, parents[1].draft, entry, seeded)).toBe(false)
  })

  it('allows a signed-in user without a staff role on both parents', () => {
    const user = signedIn('someone')
    expect(canCreateAuditLog(user, parents[0].draft, entry, seeded)).toBe(true)
    expect(canCreateAuditLog(user, parents[1].draft, entry, seeded)).toBe(true)
  })
})
