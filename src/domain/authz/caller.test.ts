import { describe, expect, it } from 'vitest'
import { canListDirectory, canWriteDirectory, directoryOrgOk, isHePhaiAdmin } from './caller'
import { canCreateRegistration } from './registrations'
import { canCreateTemple } from './temples'
import { invites, registrationDraft, signedIn, templeDraft } from './testFixtures'

describe('giao_doan_admin without an org unit claim', () => {
  const noOrg = signedIn('gd-admin', { role: 'giao_doan_admin' })
  const emptyOrg = signedIn('gd-admin', { role: 'giao_doan_admin', orgUnitId: '' })

  it.each([
    ['missing', noOrg],
    ['empty', emptyOrg],
  ])('matches no org unit when the claim is %s', (_label, caller) => {
    expect(directoryOrgOk(caller, 'gd-i')).toBe(false)
    expect(canListDirectory(caller, { orgUnitId: null })).toBe(false)
    // Records with a missing org unit must not match a missing claim.
    const temple = templeDraft({ inviteId: null, orgUnitId: null as unknown as string })
    expect(canCreateTemple(caller, temple, invites())).toBe(false)
    const proxy = registrationDraft({
      registeredVia: 'proxy',
      registeredBy: 'gd-admin',
      orgUnitId: null as unknown as string,
    })
    expect(canCreateRegistration(caller, proxy)).toBe(false)
  })
})

describe('legacy admin:true combined with a role claim', () => {
  // parseAuthClaims lets the role win; the app never mints this combination.
  it('is scoped by the role, not promoted to hệ phái admin', () => {
    const gd = signedIn('x', { admin: true, role: 'giao_doan_admin', orgUnitId: 'gd-i' })
    expect(isHePhaiAdmin(gd)).toBe(false)
    expect(directoryOrgOk(gd, 'gd-ii')).toBe(false)

    const ks = signedIn('x', { admin: true, role: 'kiem_soat' })
    expect(canWriteDirectory(ks)).toBe(false)
  })
})
