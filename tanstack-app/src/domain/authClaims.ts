export type AdminRole = 'he_phai_admin' | 'giao_doan_admin' | 'kiem_soat'

export type AuthClaims = {
  role: AdminRole
  orgUnitId: string | null
}

const ADMIN_ROLES: readonly AdminRole[] = [
  'he_phai_admin',
  'giao_doan_admin',
  'kiem_soat',
]

function isAdminRole(value: unknown): value is AdminRole {
  return (
    typeof value === 'string' &&
    (ADMIN_ROLES as readonly string[]).includes(value)
  )
}

export function parseAuthClaims(
  claims: Record<string, unknown>,
): AuthClaims | null {
  if (isAdminRole(claims.role)) {
    return {
      role: claims.role,
      orgUnitId:
        typeof claims.orgUnitId === 'string' && claims.orgUnitId.length > 0
          ? claims.orgUnitId
          : null,
    }
  }
  if (claims.admin === true) {
    return { role: 'he_phai_admin', orgUnitId: null }
  }
  return null
}

export function canAccessOrgUnit(
  claims: AuthClaims,
  orgUnitId: string,
): boolean {
  if (claims.role === 'he_phai_admin') return true
  return claims.orgUnitId === orgUnitId
}

export function canManageDirectory(claims: AuthClaims): boolean {
  return claims.role === 'he_phai_admin' || claims.role === 'giao_doan_admin'
}

export function canGrantDirectoryRole(claims: AuthClaims): boolean {
  return claims.role === 'he_phai_admin'
}

export function canManageRetreats(claims: AuthClaims): boolean {
  return canManageDirectory(claims)
}

/** Blocks grant when overwriting Auth custom claims would strip privileged access. */
export function blocksSecretaryGrantOnAuthClaims(
  rawClaims: Record<string, unknown>,
  targetOrgUnitId: string,
): boolean {
  if (rawClaims.admin === true) return true

  const role = rawClaims.role
  if (role === 'he_phai_admin' || role === 'kiem_soat') return true
  if (role === 'giao_doan_admin') {
    const org =
      typeof rawClaims.orgUnitId === 'string' && rawClaims.orgUnitId.length > 0
        ? rawClaims.orgUnitId
        : null
    return org !== targetOrgUnitId
  }
  return false
}
