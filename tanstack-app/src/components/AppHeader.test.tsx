import { MantineProvider } from '@mantine/core'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import type { User } from 'firebase/auth'
import { m } from '#/paraglide/messages'
import { AuthContext, type AuthContextValue } from '#/auth/AuthProvider'
import { theme } from '../theme'
import { AppHeader } from './AppHeader'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
})

function renderHeader(auth: AuthContextValue) {
  const rootRoute = createRootRoute({
    component: () => (
      <MantineProvider theme={theme} defaultColorScheme="light">
        <AuthContext.Provider value={auth}>
          <AppHeader />
        </AuthContext.Provider>
      </MantineProvider>
    ),
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(<RouterProvider router={router} />)
}

describe('AppHeader', () => {
  it('shows neutral placeholder while loading', async () => {
    renderHeader({ user: null, loading: true, signOut: async () => {} })
    expect(screen.queryByRole('link', { name: m.auth_login_link() })).toBeNull()
    expect(screen.queryByRole('button', { name: m.auth_logout() })).toBeNull()
    expect(await screen.findByTestId('auth-header-loading')).toBeTruthy()
  })

  it('shows login link when signed out', async () => {
    renderHeader({ user: null, loading: false, signOut: async () => {} })
    expect(
      await screen.findByRole('link', { name: m.auth_login_link() }),
    ).toBeTruthy()
  })

  it('shows email and logout when signed in', async () => {
    renderHeader({
      user: { uid: 'u1', email: 'user@example.com', displayName: null } as User,
      loading: false,
      signOut: async () => {},
    })
    expect(await screen.findByText('user@example.com')).toBeTruthy()
    expect(
      await screen.findByRole('button', { name: m.auth_logout() }),
    ).toBeTruthy()
  })
})
