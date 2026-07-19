import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
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
