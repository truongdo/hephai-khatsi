import { isDomainError } from '#/domain/errors'

export type ErrorPayload = {
  ok: false
  code: string
  message: string
}

export function toErrorPayload(err: unknown): ErrorPayload {
  if (isDomainError(err)) {
    return { ok: false, code: err.code, message: err.message }
  }
  console.error(err)
  return { ok: false, code: 'INTERNAL', message: 'Internal error' }
}
