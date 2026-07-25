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
      orgUnitId: typeof claims.orgUnitId === 'string' ? claims.orgUnitId : null,
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
