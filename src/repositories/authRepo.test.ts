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

  describe('getCurrentUserIdToken', () => {
    it('is null when auth is not configured', async () => {
      getClientAuth.mockReturnValue(null)
      const { getCurrentUserIdToken } = await import('./authRepo')
      expect(await getCurrentUserIdToken()).toBeNull()
    })

    it('is null when signed out', async () => {
      getClientAuth.mockReturnValue({ authStateReady: async () => {}, currentUser: null })
      const { getCurrentUserIdToken } = await import('./authRepo')
      expect(await getCurrentUserIdToken()).toBeNull()
    })

    it('waits for the restored session before reading the user', async () => {
      const auth: { currentUser: { getIdToken: () => Promise<string> } | null; authStateReady: () => Promise<void> } = {
        currentUser: null,
        authStateReady: async () => {
          auth.currentUser = { getIdToken: async () => 'id-token' }
        },
      }
      getClientAuth.mockReturnValue(auth)
      const { getCurrentUserIdToken } = await import('./authRepo')
      expect(await getCurrentUserIdToken()).toBe('id-token')
    })
  })
})
