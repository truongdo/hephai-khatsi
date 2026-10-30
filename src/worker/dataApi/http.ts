import type { Caller } from '#/domain/authz/caller'
import { DomainError, isDomainError, type DomainErrorCode } from '#/domain/errors'
import { isPlainObject, type Body } from './input'

/** Bodies are records plus their profile JSON; a D1 row holds at most 2 MB. */
export const MAX_BODY_BYTES = 1_000_000

const STATUS_BY_CODE: Record<DomainErrorCode, number> = {
  INVALID_INPUT: 400,
  CCCD_REQUIRED: 400,
  CCCD_INVALID: 400,
  PHONE_REQUIRED: 400,
  PHONE_INVALID: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVITE_NOT_FOUND: 404,
  ALREADY_EXISTS: 409,
  RECORD_LOCKED: 409,
  INVALID_STATUS: 409,
  CONFLICT: 409,
}

/**
 * `{ code, message }` with the status of the code, so the client can rethrow
 * the same DomainError; anything else is a 500 without details.
 */
export function errorResponse(error: unknown): Response {
  if (isDomainError(error)) {
    return Response.json(
      { code: error.code, message: error.message },
      { status: STATUS_BY_CODE[error.code] },
    )
  }
  console.error('[data-api]', error)
  return Response.json({ code: 'INTERNAL', message: 'Internal server error' }, { status: 500 })
}

export async function readJsonBody(request: Request): Promise<Body> {
  if (request.method === 'GET') return {}
  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) {
    throw new DomainError('INVALID_INPUT', 'Request body is too large')
  }
  let body: unknown
  try {
    body = text === '' ? {} : JSON.parse(text)
  } catch {
    throw new DomainError('INVALID_INPUT', 'Invalid JSON')
  }
  if (!isPlainObject(body)) throw new DomainError('INVALID_INPUT', 'Body must be an object')
  return body
}

export type VerifyIdToken = (idToken: string) => Promise<NonNullable<Caller> | null>

/**
 * Anonymous without an Authorization header (fillers, public reads); a token
 * that does not verify is rejected rather than treated as anonymous.
 */
export async function resolveCaller(request: Request, verify: VerifyIdToken): Promise<Caller> {
  const header = request.headers.get('Authorization')
  if (!header) return null
  if (!header.startsWith('Bearer ')) throw new DomainError('UNAUTHORIZED', 'Invalid Authorization header')
  const user = await verify(header.slice('Bearer '.length))
  if (!user) throw new DomainError('UNAUTHORIZED', 'Invalid or expired ID token')
  return user
}
