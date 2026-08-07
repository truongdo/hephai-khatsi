import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { revokeDirectoryRole } from '#/directoryRole/directoryRoleApiClient'
import { m } from '#/paraglide/messages'
import { theme } from '../../theme'
import { OrgUnitsPage } from './OrgUnitsPage'

const revokeDirectoryRoleMock = vi.mocked(revokeDirectoryRole)

let adminClaimFixture: {
  status: 'admin'
  uid: string
  role: 'he_phai_admin' | 'he_phai_secretary'
  orgUnitId: string | null
} = {
  status: 'admin',
  uid: 'admin-uid',
  role: 'he_phai_admin',
  orgUnitId: null,
}

vi.mock('#/auth/useAdminClaim', () => ({
  useAdminClaim: () => adminClaimFixture,
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
  hePhaiSecretariesQuery: () => ({
    queryKey: ['admin', 'hePhaiSecretaries'],
    queryFn: async () => [
      {
        id: 'hp-sec-1',
        orgUnitId: 'gd-i',
        sanghaType: 'tang',
        status: 'locked',
        cccd: '001099012346',
        inviteId: null,
        currentTempleId: null,
        photoPath: null,
        phapDanh: 'Thích Hệ Phái',
        email: 'hpsec@gmail.com',
        directoryRole: 'he_phai_secretary',
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

beforeEach(() => {
  adminClaimFixture = {
    status: 'admin',
    uid: 'admin-uid',
    role: 'he_phai_admin',
    orgUnitId: null,
  }
  revokeDirectoryRoleMock.mockReset()
})

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

  it('shows Thư ký hệ phái section with secretary name and email', async () => {
    renderPage()

    expect(
      await screen.findByRole('heading', {
        name: m.admin_org_units_he_phai_secretaries_title(),
      }),
    ).toBeTruthy()
    expect(await screen.findByText('Thích Hệ Phái')).toBeTruthy()
    expect(screen.getByText('hpsec@gmail.com')).toBeTruthy()
  })

  it('revokes he phai secretary after confirm', async () => {
    const user = userEvent.setup()
    revokeDirectoryRoleMock.mockResolvedValue({ memberId: 'hp-sec-1' })
    renderPage()

    await user.click(
      await screen.findByRole('button', {
        name: m.admin_org_units_he_phai_secretaries_revoke(),
      }),
    )

    const confirmDialog = await screen.findByRole('dialog', {
      name: m.admin_org_units_he_phai_secretaries_revoke(),
    })
    expect(
      within(confirmDialog).getByText(
        m.admin_org_units_he_phai_secretaries_revoke_confirm(),
      ),
    ).toBeTruthy()
    await user.click(
      within(confirmDialog).getByRole('button', {
        name: m.admin_org_units_he_phai_secretaries_revoke(),
      }),
    )

    await waitFor(() => {
      expect(revokeDirectoryRoleMock).toHaveBeenCalledWith({
        memberId: 'hp-sec-1',
        idToken: 'admin-id-token',
      })
    })
  })

  it('hides grant UI for he_phai_secretary claim', async () => {
    adminClaimFixture = {
      status: 'admin',
      uid: 'hp-sec-uid',
      role: 'he_phai_secretary',
      orgUnitId: null,
    }
    renderPage()

    expect(await screen.findByText('Giáo đoàn I')).toBeTruthy()
    expect(
      screen.queryByRole('columnheader', {
        name: m.admin_org_units_col_secretaries(),
      }),
    ).toBeNull()
    expect(
      screen.queryByRole('heading', {
        name: m.admin_org_units_he_phai_secretaries_title(),
      }),
    ).toBeNull()
  })
})
