import { describe, expect, it } from 'vitest'
import { DomainError } from './errors'
import {
  classifySaveFailure,
  errorCodeOf,
  newReferenceCode,
} from './saveFailure'

const signedOut = { signedInRole: null, online: true }

function firebaseError(code: string) {
  return Object.assign(new Error('Missing or insufficient permissions.'), {
    name: 'FirebaseError',
    code,
  })
}

describe('classifySaveFailure', () => {
  it('maps a locked record to record_locked', () => {
    expect(
      classifySaveFailure(new DomainError('RECORD_LOCKED', 'x'), signedOut),
    ).toEqual({ reason: 'record_locked', code: 'RECORD_LOCKED' })
  })

  it('maps permission-denied with a staff session to signed_in_staff', () => {
    expect(
      classifySaveFailure(firebaseError('permission-denied'), {
        signedInRole: 'giao_doan_admin',
        online: true,
      }),
    ).toEqual({ reason: 'signed_in_staff', code: 'permission-denied' })
  })

  it('maps permission-denied without a session to permission_denied', () => {
    expect(
      classifySaveFailure(firebaseError('permission-denied'), signedOut).reason,
    ).toBe('permission_denied')
  })

  it('maps unavailable and offline to network', () => {
    expect(
      classifySaveFailure(firebaseError('unavailable'), signedOut).reason,
    ).toBe('network')
    expect(
      classifySaveFailure(new Error('boom'), {
        signedInRole: null,
        online: false,
      }).reason,
    ).toBe('network')
    expect(
      classifySaveFailure(new TypeError('Failed to fetch'), signedOut).reason,
    ).toBe('network')
  })

  it('maps bad input and missing invite', () => {
    expect(
      classifySaveFailure(new DomainError('PHONE_INVALID', 'x'), signedOut)
        .reason,
    ).toBe('invalid_input')
    expect(
      classifySaveFailure(new DomainError('INVITE_NOT_FOUND', 'x'), signedOut)
        .reason,
    ).toBe('invite_invalid')
  })

  it('falls back to unknown with the error name as code', () => {
    expect(classifySaveFailure(new RangeError('x'), signedOut)).toEqual({
      reason: 'unknown',
      code: 'RangeError',
    })
  })
})

describe('errorCodeOf', () => {
  it('handles non-objects', () => {
    expect(errorCodeOf('oops')).toBe('unknown')
  })
})

describe('newReferenceCode', () => {
  it('returns 6 unambiguous characters', () => {
    const code = newReferenceCode()
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/)
  })

  it('is deterministic for given bytes', () => {
    expect(newReferenceCode(() => new Uint8Array([0, 1, 2, 3, 4, 5]))).toBe(
      'ABCDEF',
    )
  })
})
