import { describe, expect, it } from 'vitest'
import { m } from '#/paraglide/messages'
import { authErrorMessage } from './authErrors'

describe('authErrorMessage', () => {
  it('maps invalid-credential', () => {
    expect(authErrorMessage({ code: 'auth/invalid-credential' })).toBe(
      m.auth_error_invalid_credential(),
    )
  })

  it('maps too-many-requests', () => {
    expect(authErrorMessage({ code: 'auth/too-many-requests' })).toBe(
      m.auth_error_too_many_requests(),
    )
  })

  it('maps popup-closed-by-user', () => {
    expect(authErrorMessage({ code: 'auth/popup-closed-by-user' })).toBe(
      m.auth_error_popup_closed(),
    )
  })

  it('maps AuthConfigError', () => {
    expect(
      authErrorMessage(Object.assign(new Error('x'), { name: 'AuthConfigError' })),
    ).toBe(m.auth_error_config())
  })

  it('falls back for unknown', () => {
    expect(authErrorMessage({ code: 'auth/something-else' })).toBe(
      m.auth_error_unknown(),
    )
  })
})
