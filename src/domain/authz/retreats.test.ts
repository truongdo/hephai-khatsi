import { describe, expect, it } from 'vitest'
import { canListDirectory } from './caller'
import { canCreateRetreat, canDeleteRetreat, canUpdateRetreat } from './retreats'
import {
  gdAdmin,
  kiemSoat,
  legacyAdmin,
  patch,
  retreatDraft,
  secretary,
} from './testFixtures'

// Ported from firestoreRules.integration.test.ts (`retreats + role claims`).
// Get by id is public, so the get cases have no counterpart.

const rGdI = retreatDraft({ id: 'r-gd-i', createdBy: 'admin-uid' })
const rGdII = retreatDraft({ id: 'r-gd-ii', orgUnitId: 'gd-ii', name: 'Other org', createdBy: 'admin-uid' })
const rOpen = retreatDraft({
  id: 'r-open',
  status: 'open',
  createdBy: 'admin-uid',
  updatedAt: '2026-01-02T00:00:00.000Z',
})

describe('retreats + role claims', () => {
  it('giao_doan_admin can create/get in own org; get by id is public, write to other org denied', () => {
    expect(canCreateRetreat(gdAdmin, retreatDraft({ createdBy: 'gd-admin' }))).toBe(true)
    expect(canCreateRetreat(gdAdmin, retreatDraft({ id: 'r2', orgUnitId: 'gd-ii', createdBy: 'gd-admin' }))).toBe(false)
    expect(canUpdateRetreat(gdAdmin, rGdII, patch(rGdII, { name: 'x' }))).toBe(false)
    expect(canDeleteRetreat(gdAdmin, rGdII)).toBe(false)
    expect(canDeleteRetreat(gdAdmin, rGdI)).toBe(true)
  })

  it('giao_doan_admin list requires orgUnitId filter matching claim', () => {
    expect(canListDirectory(gdAdmin, { orgUnitId: null })).toBe(false)
    expect(canListDirectory(gdAdmin, { orgUnitId: 'gd-i' })).toBe(true)
  })

  it('kiem_soat can get retreat by id but cannot list or write retreats or orgUnits', () => {
    expect(canListDirectory(kiemSoat, { orgUnitId: null })).toBe(false)
    expect(canListDirectory(kiemSoat, { orgUnitId: 'gd-i' })).toBe(false)
    expect(canCreateRetreat(kiemSoat, retreatDraft({ createdBy: 'ks' }))).toBe(false)
    expect(canUpdateRetreat(kiemSoat, rGdI, patch(rGdI, { name: 'x' }))).toBe(false)
    expect(canDeleteRetreat(kiemSoat, rGdI)).toBe(false)
  })

  it('rejects invalid retreat status transitions at the rules layer', () => {
    expect(
      canUpdateRetreat(legacyAdmin, rOpen, patch(rOpen, { status: 'draft', updatedAt: '2026-01-03T00:00:00.000Z' })),
    ).toBe(false)
    const closed = patch(rOpen, { status: 'closed', updatedAt: '2026-01-03T00:00:00.000Z' })
    expect(canUpdateRetreat(legacyAdmin, rOpen, closed)).toBe(true)
    expect(
      canUpdateRetreat(legacyAdmin, closed, patch(closed, { name: 'Updated name', updatedAt: '2026-01-04T00:00:00.000Z' })),
    ).toBe(true)
    expect(canUpdateRetreat(legacyAdmin, closed, patch(closed, { status: 'open' }))).toBe(true)
    expect(canUpdateRetreat(legacyAdmin, rGdI, patch(rGdI, { status: 'open' }))).toBe(true)
    expect(canUpdateRetreat(legacyAdmin, rGdI, patch(rGdI, { status: 'closed' }))).toBe(false)
    expect(canUpdateRetreat(legacyAdmin, closed, patch(closed, { status: 'draft' }))).toBe(false)
  })

  it('denies a status change bundled with other edits', () => {
    expect(canUpdateRetreat(legacyAdmin, rOpen, patch(rOpen, { status: 'closed', name: 'x' }))).toBe(false)
  })

  it('denies changing type, org unit, creator or creation time', () => {
    for (const changes of [
      { type: 'he_phai' },
      { orgUnitId: 'gd-ii' },
      { createdBy: 'someone' },
      { createdAt: '2026-02-01T00:00:00.000Z' },
    ]) {
      expect(canUpdateRetreat(legacyAdmin, rGdI, patch(rGdI, changes))).toBe(false)
    }
  })

  it('only creates giáo đoàn drafts stamped with the caller uid', () => {
    expect(canCreateRetreat(gdAdmin, retreatDraft({ createdBy: 'someone-else' }))).toBe(false)
    expect(canCreateRetreat(legacyAdmin, retreatDraft({ createdBy: 'admin-uid', type: 'he_phai' }))).toBe(false)
    expect(canCreateRetreat(legacyAdmin, retreatDraft({ createdBy: 'admin-uid', status: 'open' }))).toBe(false)
    expect(canCreateRetreat(secretary, retreatDraft({ createdBy: 'hp-sec', orgUnitId: 'gd-ii' }))).toBe(true)
  })

  it('deletes drafts only', () => {
    expect(canDeleteRetreat(legacyAdmin, rOpen)).toBe(false)
    expect(canDeleteRetreat(legacyAdmin, rGdI)).toBe(true)
  })

  it('legacy admin:true can still write orgUnits and retreats', () => {
    expect(canCreateRetreat(legacyAdmin, retreatDraft({ id: 'r3', createdBy: 'admin-uid' }))).toBe(true)
  })
})
