import { describe, expect, it } from 'vitest'
import { canAccessOrgUnit, parseAuthClaims } from './authClaims'

describe('parseAuthClaims', () => {
  it('returns he_phai_admin with null orgUnitId when role is he_phai_admin', () => {
    expect(parseAuthClaims({ role: 'he_phai_admin' })).toEqual({
      role: 'he_phai_admin',
      orgUnitId: null,
    })
  })

  it('returns giao_doan_admin scoped to orgUnitId when both are present', () => {
    expect(
      parseAuthClaims({ role: 'giao_doan_admin', orgUnitId: 'gd-i' }),
    ).toEqual({ role: 'giao_doan_admin', orgUnitId: 'gd-i' })
  })

  it('returns kiem_soat scoped to orgUnitId when both are present', () => {
    expect(
      parseAuthClaims({ role: 'kiem_soat', orgUnitId: 'gd-ii' }),
    ).toEqual({ role: 'kiem_soat', orgUnitId: 'gd-ii' })
  })

  it('defaults orgUnitId to null when role is present but orgUnitId is not a string', () => {
    expect(
      parseAuthClaims({ role: 'giao_doan_admin', orgUnitId: 123 }),
    ).toEqual({ role: 'giao_doan_admin', orgUnitId: null })
  })

  it('defaults orgUnitId to null when role is present but orgUnitId is an empty string', () => {
    expect(
      parseAuthClaims({ role: 'giao_doan_admin', orgUnitId: '' }),
    ).toEqual({ role: 'giao_doan_admin', orgUnitId: null })
  })

  it('falls back to he_phai_admin for the legacy admin:true claim', () => {
    expect(parseAuthClaims({ admin: true })).toEqual({
      role: 'he_phai_admin',
      orgUnitId: null,
    })
  })

  it('prefers an explicit role over the legacy admin boolean', () => {
    expect(
      parseAuthClaims({ admin: true, role: 'giao_doan_admin', orgUnitId: 'gd-iii' }),
    ).toEqual({ role: 'giao_doan_admin', orgUnitId: 'gd-iii' })
  })

  it('returns null when role is an unrecognized string and admin is not true', () => {
    expect(parseAuthClaims({ role: 'super_admin' })).toBeNull()
  })

  it('returns null for empty claims', () => {
    expect(parseAuthClaims({})).toBeNull()
  })
})

describe('canAccessOrgUnit', () => {
  it('always allows he_phai_admin regardless of orgUnitId', () => {
    expect(
      canAccessOrgUnit({ role: 'he_phai_admin', orgUnitId: null }, 'gd-i'),
    ).toBe(true)
  })

  it('allows giao_doan_admin when orgUnitId matches', () => {
    expect(
      canAccessOrgUnit({ role: 'giao_doan_admin', orgUnitId: 'gd-i' }, 'gd-i'),
    ).toBe(true)
  })

  it('denies giao_doan_admin when orgUnitId differs', () => {
    expect(
      canAccessOrgUnit({ role: 'giao_doan_admin', orgUnitId: 'gd-i' }, 'gd-ii'),
    ).toBe(false)
  })

  it('denies kiem_soat when orgUnitId is null', () => {
    expect(
      canAccessOrgUnit({ role: 'kiem_soat', orgUnitId: null }, 'gd-i'),
    ).toBe(false)
  })

  it('allows he_phai_admin even when its own claim carries a non-null orgUnitId', () => {
    expect(
      canAccessOrgUnit({ role: 'he_phai_admin', orgUnitId: 'gd-i' }, 'gd-ii'),
    ).toBe(true)
  })
})
