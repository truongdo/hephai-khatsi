import { describe, expect, it } from 'vitest'
import {
  canAccessOrgUnit,
  canGrantDirectoryRole,
  canManageDirectory,
  canManageRetreats,
  blocksSecretaryGrantOnAuthClaims,
  isHePhaiAdmin,
  isHePhaiScope,
  parseAuthClaims,
} from './authClaims'

describe('parseAuthClaims', () => {
  it('returns he_phai_admin with null orgUnitId when role is he_phai_admin', () => {
    expect(parseAuthClaims({ role: 'he_phai_admin' })).toEqual({
      role: 'he_phai_admin',
      orgUnitId: null,
    })
  })

  it('returns he_phai_secretary with null orgUnitId', () => {
    expect(parseAuthClaims({ role: 'he_phai_secretary' })).toEqual({
      role: 'he_phai_secretary',
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

describe('blocksSecretaryGrantOnAuthClaims', () => {
  it('blocks he_phai_admin and legacy admin claims', () => {
    expect(
      blocksSecretaryGrantOnAuthClaims({ role: 'he_phai_admin' }, 'gd-i'),
    ).toBe(true)
    expect(blocksSecretaryGrantOnAuthClaims({ admin: true }, 'gd-i')).toBe(true)
  })

  it('blocks kiem_soat and cross-org giao_doan_admin', () => {
    expect(
      blocksSecretaryGrantOnAuthClaims(
        { role: 'kiem_soat', orgUnitId: 'gd-i' },
        'gd-i',
      ),
    ).toBe(true)
    expect(
      blocksSecretaryGrantOnAuthClaims(
        { role: 'giao_doan_admin', orgUnitId: 'gd-ii' },
        'gd-i',
      ),
    ).toBe(true)
  })

  it('allows same-org giao_doan_admin and empty claims', () => {
    expect(
      blocksSecretaryGrantOnAuthClaims(
        { role: 'giao_doan_admin', orgUnitId: 'gd-i' },
        'gd-i',
      ),
    ).toBe(false)
    expect(blocksSecretaryGrantOnAuthClaims({}, 'gd-i')).toBe(false)
  })

  it('blocks he_phai_secretary on Auth claims', () => {
    expect(
      blocksSecretaryGrantOnAuthClaims({ role: 'he_phai_secretary' }, 'gd-i'),
    ).toBe(true)
  })

  it('blocks any giao_doan_admin when granting he_phai_secretary', () => {
    expect(
      blocksSecretaryGrantOnAuthClaims(
        { role: 'giao_doan_admin', orgUnitId: 'gd-i' },
        'gd-i',
        'he_phai_secretary',
      ),
    ).toBe(true)
  })
})

describe('canAccessOrgUnit', () => {
  it('always allows he_phai_admin regardless of orgUnitId', () => {
    expect(
      canAccessOrgUnit({ role: 'he_phai_admin', orgUnitId: null }, 'gd-i'),
    ).toBe(true)
  })

  it('always allows he_phai_secretary for any org', () => {
    expect(
      canAccessOrgUnit({ role: 'he_phai_secretary', orgUnitId: null }, 'gd-i'),
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

describe('isHePhaiAdmin', () => {
  it('allows he_phai_admin only', () => {
    expect(isHePhaiAdmin({ role: 'he_phai_admin', orgUnitId: null })).toBe(true)
    expect(isHePhaiAdmin({ role: 'he_phai_secretary', orgUnitId: null })).toBe(
      false,
    )
    expect(isHePhaiAdmin({ role: 'giao_doan_admin', orgUnitId: 'gd-i' })).toBe(
      false,
    )
    expect(isHePhaiAdmin({ role: 'kiem_soat', orgUnitId: null })).toBe(false)
  })
})

describe('isHePhaiScope', () => {
  it('isHePhaiScope true for he_phai_admin and he_phai_secretary only', () => {
    expect(isHePhaiScope({ role: 'he_phai_admin', orgUnitId: null })).toBe(true)
    expect(isHePhaiScope({ role: 'he_phai_secretary', orgUnitId: null })).toBe(
      true,
    )
    expect(
      isHePhaiScope({ role: 'giao_doan_admin', orgUnitId: 'gd-i' }),
    ).toBe(false)
  })
})

describe('canGrantDirectoryRole', () => {
  it('allows only he_phai_admin', () => {
    expect(
      canGrantDirectoryRole({ role: 'he_phai_admin', orgUnitId: null }),
    ).toBe(true)
    expect(
      canGrantDirectoryRole({ role: 'giao_doan_admin', orgUnitId: 'gd-i' }),
    ).toBe(false)
    expect(
      canGrantDirectoryRole({ role: 'kiem_soat', orgUnitId: 'gd-i' }),
    ).toBe(false)
  })
})

describe('canManageDirectory / canManageRetreats', () => {
  it('allows he_phai_admin', () => {
    const c = { role: 'he_phai_admin' as const, orgUnitId: null }
    expect(canManageDirectory(c)).toBe(true)
    expect(canManageRetreats(c)).toBe(true)
  })

  it('allows giao_doan_admin', () => {
    const c = { role: 'giao_doan_admin' as const, orgUnitId: 'gd-i' }
    expect(canManageDirectory(c)).toBe(true)
    expect(canManageRetreats(c)).toBe(true)
  })

  it('denies kiem_soat', () => {
    const c = { role: 'kiem_soat' as const, orgUnitId: 'gd-i' }
    expect(canManageDirectory(c)).toBe(false)
    expect(canManageRetreats(c)).toBe(false)
  })

  it('canManageDirectory allows he_phai_secretary; canGrantDirectoryRole denies it', () => {
    const c = { role: 'he_phai_secretary' as const, orgUnitId: null }
    expect(canManageDirectory(c)).toBe(true)
    expect(canManageRetreats(c)).toBe(true)
    expect(canGrantDirectoryRole(c)).toBe(false)
  })
})
