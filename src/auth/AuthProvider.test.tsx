import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { User } from 'firebase/auth'

const subscribeAuth = vi.fn()
const signOutUser = vi.fn()
const readFirebaseWebConfig = vi.fn()

vi.mock('#/firebase/client', () => ({
  readFirebaseWebConfig: () => readFirebaseWebConfig(),
}))

vi.mock('#/repositories/authRepo', () => ({
  subscribeAuth: (cb: (user: User | null) => void) => subscribeAuth(cb),
  signOutUser: () => signOutUser(),
}))

describe('AuthProvider', () => {
  afterEach(() => {
    vi.resetModules()
    subscribeAuth.mockReset()
    readFirebaseWebConfig.mockReset()
  })

  it('shows loading then user when Firebase is configured', async () => {
    readFirebaseWebConfig.mockReturnValue({
      apiKey: 'key',
      authDomain: 'demo.firebaseapp.com',
      projectId: 'demo',
      appId: '1:123:web:abc',
    })

    let authCallback: ((user: User | null) => void) | undefined
    subscribeAuth.mockImplementation((cb: (user: User | null) => void) => {
      authCallback = cb
      return () => {}
    })

    const { AuthProvider } = await import('./AuthProvider')
    const { useAuth } = await import('./useAuth')

    function Probe() {
      const { user, loading } = useAuth()
      if (loading) return <div>loading</div>
      return <div>{user?.email ?? 'none'}</div>
    }

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    expect(screen.getByText('loading')).toBeTruthy()

    authCallback?.({ uid: 'u1', email: 'a@b.c' } as User)

    await waitFor(() => {
      expect(screen.getByText('a@b.c')).toBeTruthy()
    })
  })

  it('skips loading when Firebase is not configured', async () => {
    readFirebaseWebConfig.mockReturnValue(null)

    subscribeAuth.mockImplementation((cb: (user: User | null) => void) => {
      cb(null)
      return () => {}
    })

    const { AuthProvider } = await import('./AuthProvider')
    const { useAuth } = await import('./useAuth')

    function Probe() {
      const { user, loading } = useAuth()
      if (loading) return <div>loading</div>
      return <div>{user?.email ?? 'none'}</div>
    }

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    expect(screen.queryByText('loading')).toBeNull()
    expect(screen.getByText('none')).toBeTruthy()
  })
})
