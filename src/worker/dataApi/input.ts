import { DomainError } from '#/domain/errors'

// Request body validation: each helper reads one field and throws
// INVALID_INPUT (400) naming it when the shape is wrong. Handlers trust what
// these return.

export type Body = Record<string, unknown>

function invalid(key: string, expected: string): DomainError {
  return new DomainError('INVALID_INPUT', `${key} must be ${expected}`)
}

export function isPlainObject(value: unknown): value is Body {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function objectField(body: Body, key: string): Body {
  const value = body[key]
  if (!isPlainObject(value)) throw invalid(key, 'an object')
  return value
}

export function optionalObjectField(body: Body, key: string): Body | undefined {
  return body[key] === undefined ? undefined : objectField(body, key)
}

export function stringField(body: Body, key: string): string {
  const value = body[key]
  if (typeof value !== 'string' || value.length === 0) throw invalid(key, 'a non-empty string')
  return value
}

export function optionalStringField(body: Body, key: string): string | undefined {
  return body[key] == null ? undefined : stringField(body, key)
}

/** A string or null (an absent field reads as null). */
export function nullableStringField(body: Body, key: string): string | null {
  return optionalStringField(body, key) ?? null
}

export function enumField<T extends string>(body: Body, key: string, values: readonly T[]): T {
  const value = body[key]
  if (!values.includes(value as T)) throw invalid(key, `one of ${values.join(', ')}`)
  return value as T
}

export function optionalEnumField<T extends string>(
  body: Body,
  key: string,
  values: readonly T[],
): T | undefined {
  return body[key] == null ? undefined : enumField(body, key, values)
}

export function optionalIntField(
  body: Body,
  key: string,
  range: { min: number; max: number },
): number | undefined {
  const value = body[key]
  if (value == null) return undefined
  if (!Number.isInteger(value) || (value as number) < range.min || (value as number) > range.max) {
    throw invalid(key, `an integer from ${range.min} to ${range.max}`)
  }
  return value as number
}

export function optionalBooleanField(body: Body, key: string): boolean | undefined {
  const value = body[key]
  if (value == null) return undefined
  if (typeof value !== 'boolean') throw invalid(key, 'a boolean')
  return value
}

export function stringArrayField(body: Body, key: string, maxItems: number): string[] {
  const value = body[key]
  if (
    !Array.isArray(value) ||
    value.length > maxItems ||
    !value.every((item) => typeof item === 'string' && item.length > 0)
  ) {
    throw invalid(key, `a list of at most ${maxItems} non-empty strings`)
  }
  return value as string[]
}
