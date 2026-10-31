import {
  canManageDirectory,
  isHePhaiAdmin as claimsIsHePhaiAdmin,
  isHePhaiScope as claimsIsHePhaiScope,
  type AuthClaims,
} from '#/domain/authClaims'

/**
 * Who sends a request to the data API: `null` when anonymous, otherwise the
 * Firebase user with the claims `parseAuthClaims` read from the ID token
 * (`claims` null for a signed-in user without a staff role, who is treated as a
 * filler). Legacy `{admin: true}` arrives here as `he_phai_admin`.
 */
export type Caller = { uid: string; claims: AuthClaims | null } | null

/** Whether an invite with this id exists (the rules' `exists(/invites/$(id))`). */
export type InviteExists = (inviteId: string) => boolean

// Role predicates named after the functions in `firebase/firestore.rules`.

export function isHePhaiAdmin(caller: Caller): boolean {
  return caller?.claims != null && claimsIsHePhaiAdmin(caller.claims)
}

export function isHePhaiScope(caller: Caller): boolean {
  return caller?.claims != null && claimsIsHePhaiScope(caller.claims)
}

export function isGiaoDoanAdmin(caller: Caller): boolean {
  return caller?.claims?.role === 'giao_doan_admin'
}

export function isKiemSoat(caller: Caller): boolean {
  return caller?.claims?.role === 'kiem_soat'
}

export function isStaff(caller: Caller): boolean {
  return caller?.claims != null
}

export function canWriteDirectory(caller: Caller): boolean {
  return caller?.claims != null && canManageDirectory(caller.claims)
}

/** The rules' `directoryOrgOk` / `retreatOrgOk` (identical). */
export function directoryOrgOk(caller: Caller, orgUnitId: string): boolean {
  if (isHePhaiScope(caller)) return true
  // A giáo đoàn admin token without an org unit matches nothing (the rules
  // error on the missing claim).
  const claimOrgUnitId = caller?.claims?.orgUnitId ?? null
  return isGiaoDoanAdmin(caller) && claimOrgUnitId !== null && claimOrgUnitId === orgUnitId
}

/**
 * List queries on members, temples, retreats and registrations: directory
 * writers only; a giáo đoàn admin must filter by their own org unit
 * (`orgUnitId` is the query's filter, null when unfiltered).
 */
export function canListDirectory(
  caller: Caller,
  filter: { orgUnitId: string | null },
): boolean {
  if (!canWriteDirectory(caller)) return false
  if (isHePhaiScope(caller)) return true
  return filter.orgUnitId !== null && directoryOrgOk(caller, filter.orgUnitId)
}
