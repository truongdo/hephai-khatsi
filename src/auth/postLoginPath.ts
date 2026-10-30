import { safeRedirectPath } from '#/auth/safeRedirect'
import { parseAuthClaims } from '#/domain/authClaims'

type TokenUser = {
  getIdTokenResult: (
    forceRefresh?: boolean,
  ) => Promise<{ claims: Record<string, unknown> }>
}

/**
 * Destination after login / when an already-signed-in user hits /login.
 * Explicit safe redirect wins; otherwise admins go to /admin, others to /.
 */
export async function postLoginPath(
  user: TokenUser,
  redirect: unknown,
): Promise<string> {
  if (typeof redirect === 'string') {
    const safe = safeRedirectPath(redirect, '')
    // "/" is the non-admin default — do not treat it as an explicit deep link
    if (safe !== '' && safe !== '/') return safe
  }

  try {
    const result = await user.getIdTokenResult()
    if (parseAuthClaims(result.claims)) return '/admin'
  } catch {
    // fall through
  }
  return '/'
}
