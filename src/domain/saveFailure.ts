import type { AdminRole } from './authClaims'
import { isDomainError } from './errors'

/**
 * Why a public-form save failed, in terms the visitor can act on. The raw
 * error code is kept separately for the error report.
 */
export type SaveFailureReason =
  | 'signed_in_staff'
  | 'record_locked'
  | 'permission_denied'
  | 'network'
  | 'invite_invalid'
  | 'invalid_input'
  | 'not_found'
  | 'unknown'

export type SaveFailureContext = {
  /** Role of the Firebase user signed in in this browser, if any. */
  signedInRole: AdminRole | null
  online: boolean
}

export type ClassifiedSaveFailure = {
  reason: SaveFailureReason
  /** DomainError code, Firebase Auth error code, or error name. */
  code: string
}

const NETWORK_CODES = new Set(['auth/network-request-failed'])

export function errorCodeOf(error: unknown): string {
  if (isDomainError(error)) return error.code
  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: unknown }).code
    if (typeof code === 'string' && code) return code
    const name = (error as { name?: unknown }).name
    if (typeof name === 'string' && name) return name
  }
  return 'unknown'
}

function isFetchFailure(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    /fetch|network|load failed/i.test(error.message)
  )
}

export function classifySaveFailure(
  error: unknown,
  context: SaveFailureContext,
): ClassifiedSaveFailure {
  const code = errorCodeOf(error)

  if (isDomainError(error)) {
    switch (error.code) {
      case 'FORBIDDEN':
        // The Worker refuses public-form writes from signed-in staff
        // accounts, so a denial with a staff session in this browser is
        // almost always that.
        return {
          reason: context.signedInRole ? 'signed_in_staff' : 'permission_denied',
          code,
        }
      case 'RECORD_LOCKED':
        return { reason: 'record_locked', code }
      case 'INVITE_NOT_FOUND':
        return { reason: 'invite_invalid', code }
      case 'NOT_FOUND':
        return { reason: 'not_found', code }
      case 'PHONE_REQUIRED':
      case 'PHONE_INVALID':
      case 'CCCD_REQUIRED':
      case 'CCCD_INVALID':
      case 'INVALID_INPUT':
        return { reason: 'invalid_input', code }
      default:
        return { reason: 'unknown', code }
    }
  }

  if (!context.online || NETWORK_CODES.has(code) || isFetchFailure(error)) {
    return { reason: 'network', code }
  }

  return { reason: 'unknown', code }
}

const REFERENCE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** Short code a visitor can read out over the phone (no 0/O, 1/I/L). */
export function newReferenceCode(
  randomBytes: (length: number) => Uint8Array = (length) =>
    crypto.getRandomValues(new Uint8Array(length)),
): string {
  const bytes = randomBytes(6)
  let out = ''
  for (const byte of bytes) {
    out += REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length]
  }
  return out
}
