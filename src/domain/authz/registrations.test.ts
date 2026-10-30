import { describe, expect, it } from 'vitest'
import { canListDirectory } from './caller'
import { canCreateRegistration, canReviewRegistration } from './registrations'
import {
  anon,
  gdAdmin,
  hePhaiAdmin,
  legacyAdmin,
  MEMBER_ID,
  patch,
  RETREAT_ID,
  registrationDraft,
} from './testFixtures'

// Ported from firestoreRules.integration.test.ts (`retreatRegistrations`).
// Get by id is public, so the get cases have no counterpart.

const APPROVE = {
  status: 'approved',
  approvedAt: '2026-01-02T00:00:00.000Z',
  rejectionReason: null,
  updatedAt: '2026-01-02T00:00:00.000Z',
}

const ownOrg = registrationDraft()
const otherOrg = registrationDraft({ retreatId: 'r-gd-ii', orgUnitId: 'gd-ii' })

describe('retreatRegistrations', () => {
  it('allows anonymous self registration with pending shape', () => {
    expect(canCreateRegistration(anon, registrationDraft())).toBe(true)
  })

  it('allows signed-in staff to create self registration (public /r while logged in)', () => {
    expect(canCreateRegistration(legacyAdmin, registrationDraft({ memberId: 'gd-i_tang_self_staff' }))).toBe(true)
  })

  it('rejects create shapes other than a fresh pending registration', () => {
    expect(canCreateRegistration(anon, registrationDraft({ id: 'wrong-id' }))).toBe(false)
    expect(canCreateRegistration(anon, registrationDraft({ status: 'approved' }))).toBe(false)
    expect(canCreateRegistration(anon, registrationDraft({ approvedBy: 'x' }))).toBe(false)
    expect(canCreateRegistration(anon, registrationDraft({ approvedAt: '2026-01-02T00:00:00.000Z' }))).toBe(false)
    expect(canCreateRegistration(anon, registrationDraft({ rejectionReason: 'x' }))).toBe(false)
    expect(canCreateRegistration(anon, registrationDraft({ registeredBy: 'anon' }))).toBe(false)
  })

  it('denies anonymous list', () => {
    expect(canListDirectory(anon, { orgUnitId: null })).toBe(false)
  })

  it('giao_doan_admin list own org succeeds; public get allows cross-org doc by id', () => {
    expect(canListDirectory(gdAdmin, { orgUnitId: 'gd-i' })).toBe(true)
    expect(canListDirectory(gdAdmin, { orgUnitId: 'gd-ii' })).toBe(false)
  })

  it('allows he_phai_admin to approve own-org registration', () => {
    expect(canReviewRegistration(hePhaiAdmin, ownOrg, patch(ownOrg, { ...APPROVE, approvedBy: 'hp-admin' }))).toBe(true)
  })

  it('allows giao_doan_admin to approve and reject own-org registration', () => {
    const approve = registrationDraft({ memberId: 'gd-i_tang_approve' })
    expect(canReviewRegistration(gdAdmin, approve, patch(approve, { ...APPROVE, approvedBy: 'gd-admin' }))).toBe(true)

    const rejectNoReason = registrationDraft({ memberId: 'gd-i_tang_reject_no_reason' })
    expect(
      canReviewRegistration(
        gdAdmin,
        rejectNoReason,
        patch(rejectNoReason, { ...APPROVE, status: 'rejected', approvedBy: 'gd-admin' }),
      ),
    ).toBe(true)

    const rejectWithReason = registrationDraft({ memberId: 'gd-i_tang_reject_with_reason' })
    expect(
      canReviewRegistration(
        gdAdmin,
        rejectWithReason,
        patch(rejectWithReason, {
          ...APPROVE,
          status: 'rejected',
          approvedBy: 'gd-admin',
          rejectionReason: 'Không đủ điều kiện',
        }),
      ),
    ).toBe(true)
  })

  it('denies an approval with a rejection reason or an empty rejection reason', () => {
    expect(
      canReviewRegistration(gdAdmin, ownOrg, patch(ownOrg, { ...APPROVE, approvedBy: 'gd-admin', rejectionReason: 'x' })),
    ).toBe(false)
    expect(
      canReviewRegistration(
        gdAdmin,
        ownOrg,
        patch(ownOrg, { ...APPROVE, status: 'rejected', approvedBy: 'gd-admin', rejectionReason: '' }),
      ),
    ).toBe(false)
  })

  it('denies a review stamped with another uid', () => {
    expect(canReviewRegistration(gdAdmin, ownOrg, patch(ownOrg, { ...APPROVE, approvedBy: 'someone-else' }))).toBe(false)
  })

  it('denies anonymous update of registration status', () => {
    expect(canReviewRegistration(anon, ownOrg, patch(ownOrg, { ...APPROVE, approvedBy: 'anon' }))).toBe(false)
  })

  it('denies giao_doan_admin cross-org registration update', () => {
    expect(canReviewRegistration(gdAdmin, otherOrg, patch(otherOrg, { ...APPROVE, approvedBy: 'gd-admin' }))).toBe(false)
  })

  it('denies update when registration is already approved', () => {
    const approved = registrationDraft({
      status: 'approved',
      approvedBy: 'admin-uid',
      approvedAt: '2026-01-02T00:00:00.000Z',
    })
    const after = patch(approved, {
      status: 'rejected',
      approvedBy: 'admin-uid',
      approvedAt: '2026-01-03T00:00:00.000Z',
      rejectionReason: 'Too late',
      updatedAt: '2026-01-03T00:00:00.000Z',
    })
    expect(canReviewRegistration(legacyAdmin, approved, after)).toBe(false)
  })

  it('denies changing memberId alongside status review', () => {
    const after = patch(ownOrg, { ...APPROVE, approvedBy: 'admin-uid', memberId: 'gd-i_tang_different' })
    expect(canReviewRegistration(legacyAdmin, ownOrg, after)).toBe(false)
  })

  it('denies changing extra answers alongside status review', () => {
    const after = patch(ownOrg, { ...APPROVE, approvedBy: 'admin-uid', extraAnswers: { a: 'b' } })
    expect(canReviewRegistration(legacyAdmin, ownOrg, after)).toBe(false)
  })

  it('allows giao_doan_admin proxy create in own org', () => {
    const proxy = registrationDraft({
      memberId: 'gd-i_tang_099999999999',
      registeredVia: 'proxy',
      registeredBy: 'gd-admin',
    })
    expect(proxy.id).toBe(`${RETREAT_ID}_gd-i_tang_099999999999`)
    expect(canCreateRegistration(gdAdmin, proxy)).toBe(true)
  })

  it('denies proxy create in another org, by anonymous, or stamped with another uid', () => {
    const proxy = { registeredVia: 'proxy' as const, registeredBy: 'gd-admin' }
    expect(canCreateRegistration(gdAdmin, registrationDraft({ ...proxy, retreatId: 'r-gd-ii', orgUnitId: 'gd-ii' }))).toBe(false)
    expect(canCreateRegistration(anon, registrationDraft(proxy))).toBe(false)
    expect(canCreateRegistration(gdAdmin, registrationDraft({ ...proxy, registeredBy: 'someone-else' }))).toBe(false)
  })
})

it('uses the registration id the rules tests use', () => {
  expect(ownOrg.id).toBe(`${RETREAT_ID}_${MEMBER_ID}`)
})
