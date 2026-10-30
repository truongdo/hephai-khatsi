import { beforeEach, describe, expect, it, vi } from 'vitest'

const getClientAuth = vi.fn()

vi.mock('#/firebase/client', () => ({
  getClientAuth: () => getClientAuth(),
}))

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {},
  signInWithPopup: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
}))

describe('authRepo', () => {
  beforeEach(() => {
    vi.resetModules()
    getClientAuth.mockReset()
  })

  it('signInWithGoogle throws AuthConfigError when auth is null', async () => {
    getClientAuth.mockReturnValue(null)
    const { signInWithGoogle, AuthConfigError } = await import('./authRepo')
    await expect(signInWithGoogle()).rejects.toBeInstanceOf(AuthConfigError)
  })

  it('subscribeAuth calls back null when auth is null', async () => {
    getClientAuth.mockReturnValue(null)
    const { subscribeAuth } = await import('./authRepo')
    const onChange = vi.fn()
    const unsub = subscribeAuth(onChange)
    expect(onChange).toHaveBeenCalledWith(null)
    expect(typeof unsub).toBe('function')
    unsub()
  })
})
