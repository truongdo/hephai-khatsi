export const DOMAIN_ERROR_CODES = [
  'INVITE_NOT_FOUND',
  'CCCD_REQUIRED',
  'CCCD_INVALID',
  'PHONE_REQUIRED',
  'PHONE_INVALID',
  'RECORD_LOCKED',
  'NOT_FOUND',
  'FORBIDDEN',
  'UNAUTHORIZED',
  'INVALID_INPUT',
  'INVALID_STATUS',
  'ALREADY_EXISTS',
  /** The record changed between read and write (D1 `version` guard); retry. */
  'CONFLICT',
] as const

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number]

export class DomainError extends Error {
  readonly code: DomainErrorCode
  constructor(code: DomainErrorCode, message: string) {
    super(message)
    this.name = 'DomainError'
    this.code = code
  }
}

export function isDomainError(err: unknown): err is DomainError {
  return err instanceof DomainError
}

export function isDomainErrorCode(value: unknown): value is DomainErrorCode {
  return (DOMAIN_ERROR_CODES as readonly unknown[]).includes(value)
}
