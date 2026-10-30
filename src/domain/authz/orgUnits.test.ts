import { describe, expect, it } from 'vitest'
import { canWriteOrgUnit } from './orgUnits'
import { anon, gdAdmin, hePhaiAdmin, kiemSoat, legacyAdmin, secretary } from './testFixtures'

// Ported from firestoreRules.integration.test.ts (orgUnits writes; reads are public).

describe('orgUnits', () => {
  it('anyone can read, only admin can write', () => {
    expect(canWriteOrgUnit(anon)).toBe(false)
    expect(canWriteOrgUnit(legacyAdmin)).toBe(true)
    expect(canWriteOrgUnit(hePhaiAdmin)).toBe(true)
  })

  it('giao_doan_admin cannot write orgUnits', () => {
    expect(canWriteOrgUnit(gdAdmin)).toBe(false)
  })

  it('he_phai_secretary cannot write orgUnits', () => {
    expect(canWriteOrgUnit(secretary)).toBe(false)
  })

  it('kiem_soat cannot write orgUnits', () => {
    expect(canWriteOrgUnit(kiemSoat)).toBe(false)
  })
})
