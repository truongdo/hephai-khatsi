export type DomainErrorCode =
  | 'INVITE_NOT_FOUND'
  | 'CCCD_REQUIRED'
  | 'CCCD_INVALID'
  | 'PHONE_REQUIRED'
  | 'PHONE_INVALID'
  | 'RECORD_LOCKED'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'UNAUTHORIZED'
  | 'INVALID_INPUT'

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
