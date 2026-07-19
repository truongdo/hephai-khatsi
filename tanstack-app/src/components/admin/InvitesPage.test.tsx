import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { theme } from '../../theme'
import { InvitesPage } from './InvitesPage'

vi.mock('#/auth/useAdminClaim', () => ({
  useAdminClaim: () => ({ status: 'admin', uid: 'admin-uid' }),
}))

const inviteState = vi.hoisted(() => ({
  data: null as null | { id: string; token: string; createdAt: string; createdBy: string },
}))

const createInviteMock = vi.fn(async (..._args: unknown[]) => {
  inviteState.data = {
    id: 'public',
    token: 'public',
    createdAt: '2026-07-19T12:00:00.000Z',
    createdBy: 'admin-uid',
  }
  return inviteState.data
})

vi.mock('#/use-cases/createInvite', () => ({
  createInvite: (...args: unknown[]) => createInviteMock(...args),
}))

vi.mock('#/query/adminQueries', () => ({
  inviteQuery: () => ({
    queryKey: ['admin', 'invite'],
    queryFn: async () => inviteState.data,
    staleTime: 0,
  }),
}))

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
  inviteState.data = null
  createInviteMock.mockClear()
})

function renderInvitesPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <InvitesPage />
      </MantineProvider>
    </QueryClientProvider>,
  )
}

describe('InvitesPage', () => {
  it('shows a create button when no invite exists yet, then the link after creating one', async () => {
    const user = userEvent.setup()
    renderInvitesPage()

    const createButton = await screen.findByRole('button', { name: /tạo lời mời/i })
    await user.click(createButton)

    expect(createInviteMock).toHaveBeenCalledWith({ createdBy: 'admin-uid' })
    await waitFor(() => {
      expect(screen.getByTestId('invite-url').textContent).toContain(`${window.location.origin}/f/public`)
    })
  })

  it('shows the existing link directly when an invite already exists', async () => {
    inviteState.data = {
      id: 'public',
      token: 'public',
      createdAt: '2026-07-19T10:00:00.000Z',
      createdBy: 'admin-uid',
    }
    renderInvitesPage()

    const url = await screen.findByTestId('invite-url')
    expect(url.textContent).toContain(`${window.location.origin}/f/public`)
  })

  it('shows a clipboard warning when copying fails', async () => {
    const user = userEvent.setup()
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockRejectedValue(new Error('denied'))
    inviteState.data = {
      id: 'public',
      token: 'public',
      createdAt: '2026-07-19T10:00:00.000Z',
      createdBy: 'admin-uid',
    }

    renderInvitesPage()
    await user.click(await screen.findByRole('button', { name: 'Sao chép liên kết' }))

    expect(await screen.findByTestId('clipboard-warning')).toBeTruthy()
    writeText.mockRestore()
  })
})
