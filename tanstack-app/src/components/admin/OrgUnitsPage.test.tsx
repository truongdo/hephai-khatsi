import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { m } from '#/paraglide/messages'
import { theme } from '../../theme'
import { OrgUnitsPage } from './OrgUnitsPage'

vi.mock('#/auth/useAdminClaim', () => ({
  useAdminClaim: () => ({
    status: 'admin',
    uid: 'admin-uid',
    role: 'he_phai_admin',
    orgUnitId: null,
  }),
}))

vi.mock('#/auth/useAuth', () => ({
  useAuth: () => ({
    user: { getIdToken: vi.fn(async () => 'admin-id-token') },
  }),
}))

vi.mock('#/directoryRole/directoryRoleApiClient', () => ({
  revokeDirectoryRole: vi.fn(),
}))

vi.mock('#/query/adminQueries', () => ({
  orgUnitsQuery: () => ({
    queryKey: ['admin', 'orgUnits'],
    queryFn: async () => [
      {
        id: 'gd-i',
        code: 'I',
        name: 'Giáo đoàn I',
        kind: 'giao_doan',
        order: 1,
        allowsTang: true,
        allowsNi: true,
      },
    ],
    staleTime: 0,
  }),
  directorySecretariesQuery: () => ({
    queryKey: ['admin', 'directorySecretaries'],
    queryFn: async () => [
      {
        id: 'sec-1',
        orgUnitId: 'gd-i',
        sanghaType: 'tang',
        status: 'locked',
        cccd: '001099012345',
        inviteId: null,
        currentTempleId: null,
        photoPath: null,
        phapDanh: 'Thích Minh A',
        email: 'sec@gmail.com',
        directoryRole: 'giao_doan_admin',
        directoryRoleGrantedAt: '2026-08-05T12:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        lockedAt: null,
        lockedBy: null,
        editRequestedAt: null,
        editRequestedBy: null,
      },
    ],
    staleTime: 60_000,
  }),
}))

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver =
    ResizeObserverMock as unknown as typeof ResizeObserver

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

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <OrgUnitsPage />
      </MantineProvider>
    </QueryClientProvider>,
  )
}

describe('OrgUnitsPage', () => {
  it('renders org unit rows', async () => {
    renderPage()
    expect(await screen.findByText('Giáo đoàn I')).toBeTruthy()
  })

  it('shows secretary names and opens modal on click', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(
      await screen.findByRole('columnheader', {
        name: m.admin_org_units_col_secretaries(),
      }),
    ).toBeTruthy()

    const secretaryLink = await screen.findByRole('button', {
      name: 'Thích Minh A',
    })
    await user.click(secretaryLink)

    expect(
      await screen.findByRole('dialog', {
        name: `${m.admin_org_units_secretaries_modal_title()} — Giáo đoàn I`,
      }),
    ).toBeTruthy()
    expect(screen.getByText('sec@gmail.com')).toBeTruthy()
  })
})
