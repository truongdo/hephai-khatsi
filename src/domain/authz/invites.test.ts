import { describe, expect, it } from 'vitest'
import type { Invite } from '#/domain/types'
import { canCreateInvite, canListInvites } from './invites'
import { anon, gdAdmin, kiemSoat, legacyAdmin } from './testFixtures'

// Ported from firestoreRules.integration.test.ts (`invites`, `invites
// retreat_registration`). Get by id (the token) is public.

function fillerInvite(token: string, createdBy: string): Invite {
  return {
    id: token,
    token,
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy,
    kind: 'filler',
    retreatId: null,
    orgUnitId: null,
    disabled: false,
  }
}

describe('invites', () => {
  it('anyone can get the one invite by id, but not list; only admin can create', () => {
    expect(canListInvites(anon)).toBe(false)
    expect(canListInvites(kiemSoat)).toBe(false)
    expect(canListInvites(legacyAdmin)).toBe(true)
    expect(canCreateInvite(anon, fillerInvite('forged', 'anon'))).toBe(false)
    expect(canCreateInvite(legacyAdmin, fillerInvite('other', 'admin-uid'))).toBe(true)
  })

  it('rejects a create where createdBy does not match the caller uid', () => {
    expect(canCreateInvite(legacyAdmin, fillerInvite('spoofed', 'someone-else'))).toBe(false)
  })

  it('rejects a create whose id is not its token', () => {
    expect(canCreateInvite(legacyAdmin, { ...fillerInvite('a', 'admin-uid'), id: 'b' })).toBe(false)
  })

  it('denies kiem_soat create', () => {
    expect(canCreateInvite(kiemSoat, fillerInvite('ks-invite', 'ks'))).toBe(false)
  })
})

describe('invites retreat_registration', () => {
  const retreatInvite: Invite = {
    ...fillerInvite('retreat_r-open', 'admin-uid'),
    kind: 'retreat_registration',
    retreatId: 'r-open',
    orgUnitId: 'gd-i',
  }

  it('allows admin to create a retreat registration invite', () => {
    expect(canCreateInvite(legacyAdmin, retreatInvite)).toBe(true)
    expect(canCreateInvite(gdAdmin, { ...retreatInvite, createdBy: 'gd-admin' })).toBe(true)
  })

  it('rejects a retreat invite whose id does not match the retreat or lacks an org unit', () => {
    expect(canCreateInvite(legacyAdmin, { ...retreatInvite, retreatId: 'r-other' })).toBe(false)
    expect(canCreateInvite(legacyAdmin, { ...retreatInvite, orgUnitId: null })).toBe(false)
    expect(canCreateInvite(legacyAdmin, { ...retreatInvite, retreatId: null })).toBe(false)
  })
})
