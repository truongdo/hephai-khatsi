import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { parseAuthClaims, type AuthClaims } from '#/domain/authClaims'
import { getClientAuth } from '#/firebase/client'

export class AuthConfigError extends Error {
  override name = 'AuthConfigError'
  constructor(message = 'Firebase Auth is not configured') {
    super(message)
  }
}

function requireAuth() {
  const auth = getClientAuth()
  if (!auth) throw new AuthConfigError()
  return auth
}

export function subscribeAuth(onChange: (user: User | null) => void): () => void {
  const auth = getClientAuth()
  if (!auth) {
    onChange(null)
    return () => {}
  }
  return onAuthStateChanged(auth, onChange)
}

export async function signInWithGoogle(): Promise<User> {
  const auth = requireAuth()
  const result = await signInWithPopup(auth, new GoogleAuthProvider())
  return result.user
}

export async function signInWithEmailPassword(
  email: string,
  password: string,
): Promise<User> {
  const auth = requireAuth()
  const result = await signInWithEmailAndPassword(auth, email, password)
  return result.user
}

export async function signOutUser(): Promise<void> {
  const auth = requireAuth()
  await signOut(auth)
}

/**
 * ID token of the signed-in user, or null when signed out. Waits for Firebase
 * to restore the session, so a request made on page load is not anonymous.
 */
export async function getCurrentUserIdToken(): Promise<string | null> {
  const auth = getClientAuth()
  if (!auth) return null
  await auth.authStateReady()
  return auth.currentUser ? auth.currentUser.getIdToken() : null
}

/** Claims of the user signed in in this browser, or null when signed out. */
export async function getCurrentUserClaims(): Promise<AuthClaims | null> {
  const user = getClientAuth()?.currentUser
  if (!user) return null
  const result = await user.getIdTokenResult()
  return parseAuthClaims(result.claims)
}
