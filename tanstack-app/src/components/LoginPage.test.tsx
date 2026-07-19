import { MantineProvider } from '@mantine/core'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { m } from '#/paraglide/messages'
import { AuthContext } from '#/auth/AuthProvider'
import { theme } from '../theme'
import { LoginPage } from './LoginPage'

const signInWithGoogle = vi.fn()
const signInWithEmailPassword = vi.fn()
const navigateMock = vi.fn()
const useSearchMock = vi.fn(() => ({ redirect: undefined as string | undefined }))

vi.mock('#/routes/login', () => ({
  Route: {
    useSearch: () => useSearchMock(),
  },
}))

vi.mock('#/repositories/authRepo', () => ({
  signInWithGoogle: (...args: unknown[]) => signInWithGoogle(...args),
  signInWithEmailPassword: (...args: unknown[]) =>
    signInWithEmailPassword(...args),
}))

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>(
    '@tanstack/react-router',
  )
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

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

beforeEach(() => {
  navigateMock.mockReset()
  signInWithGoogle.mockReset()
  signInWithEmailPassword.mockReset()
  useSearchMock.mockReset()
  useSearchMock.mockReturnValue({ redirect: undefined })
})

function renderLogin(
  auth: { user: unknown; loading: boolean } = {
    user: null,
    loading: false,
  },
) {
  return render(
    <MantineProvider theme={theme} defaultColorScheme="light">
      <AuthContext.Provider
        value={{
          user: auth.user as never,
          loading: auth.loading,
          signOut: async () => {},
        }}
      >
        <LoginPage />
      </AuthContext.Provider>
    </MantineProvider>,
  )
}

describe('LoginPage', () => {
  it('renders Google and email/password controls', () => {
    renderLogin()
    expect(screen.getByText(m.app_title())).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: m.auth_login_title() }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: m.auth_login_google() }),
    ).toBeTruthy()
    expect(screen.getByLabelText(m.auth_login_email())).toBeTruthy()
    expect(screen.getByLabelText(m.auth_login_password())).toBeTruthy()
    expect(
      screen.getByRole('button', { name: m.auth_login_submit() }),
    ).toBeTruthy()
  })

  it('shows mapped error when email sign-in fails', async () => {
    signInWithEmailPassword.mockRejectedValueOnce({
      code: 'auth/invalid-credential',
    })
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByLabelText(m.auth_login_email()), 'a@b.c')
    await user.type(screen.getByLabelText(m.auth_login_password()), 'bad')
    await user.click(screen.getByRole('button', { name: m.auth_login_submit() }))
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(
        m.auth_error_invalid_credential(),
      )
    })
  })

  it('navigates home when already signed in', async () => {
    renderLogin({
      user: { uid: 'u1', email: 'a@b.c' },
      loading: false,
    })
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: '/' })
    })
  })

  it('navigates to redirect path after Google sign-in', async () => {
    useSearchMock.mockReturnValue({ redirect: '/admin/invites' })
    signInWithGoogle.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    renderLogin()
    await user.click(
      screen.getByRole('button', { name: m.auth_login_google() }),
    )
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: '/admin/invites' })
    })
  })
})
