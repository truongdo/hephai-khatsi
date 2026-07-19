import { m } from '#/paraglide/messages'

function getCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code
    return typeof code === 'string' ? code : undefined
  }
  return undefined
}

export function authErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: string }).name === 'AuthConfigError'
  ) {
    return m.auth_error_config()
  }

  const code = getCode(error)
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return m.auth_error_invalid_credential()
    case 'auth/too-many-requests':
      return m.auth_error_too_many_requests()
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return m.auth_error_popup_closed()
    default:
      return m.auth_error_unknown()
  }
}
