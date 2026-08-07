import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Member } from '#/domain/types'
import { m } from '#/paraglide/messages'
import { revokeDirectoryRole } from '#/directoryRole/directoryRoleApiClient'
import { theme } from '../../theme'
import {
  OrgUnitSecretariesModal,
  type OrgUnitSecretariesModalProps,
} from './OrgUnitSecretariesModal'

const revokeDirectoryRoleMock = vi.mocked(revokeDirectoryRole)
const getIdTokenMock = vi.fn(async () => 'admin-id-token')

vi.mock('#/directoryRole/directoryRoleApiClient', () => ({
  revokeDirectoryRole: vi.fn(),
}))

vi.mock('#/auth/useAuth', () => ({
  useAuth: () => ({
    user: { getIdToken: getIdTokenMock },
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

beforeEach(() => {
  revokeDirectoryRoleMock.mockReset()
  getIdTokenMock.mockReset()
  getIdTokenMock.mockResolvedValue('admin-id-token')
})

const secretary: Member = {
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
}

function renderModal(overrides: Partial<OrgUnitSecretariesModalProps> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  const props: OrgUnitSecretariesModalProps = {
    opened: true,
    onClose: () => {},
    orgUnitName: 'Giáo đoàn I',
    secretaries: [secretary],
    ...overrides,
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <OrgUnitSecretariesModal {...props} />
      </MantineProvider>
    </QueryClientProvider>,
  )
}

describe('OrgUnitSecretariesModal', () => {
  it('renders secretary rows', async () => {
    renderModal()
    expect(await screen.findByText('Thích Minh A')).toBeTruthy()
    expect(screen.getByText('sec@gmail.com')).toBeTruthy()
    expect(screen.getByText('05/08/2026')).toBeTruthy()
    expect(
      screen.getByRole('button', {
        name: m.admin_org_units_secretaries_revoke(),
      }),
    ).toBeTruthy()
  })

  it('revokes after confirm', async () => {
    const user = userEvent.setup()
    revokeDirectoryRoleMock.mockResolvedValue({ memberId: 'sec-1' })
    renderModal()

    await user.click(
      screen.getByRole('button', {
        name: m.admin_org_units_secretaries_revoke(),
      }),
    )

    const confirmDialog = await screen.findByRole('dialog', {
      name: m.admin_org_units_secretaries_revoke(),
    })
    await user.click(
      within(confirmDialog).getByRole('button', {
        name: m.admin_org_units_secretaries_revoke(),
      }),
    )

    await waitFor(() => {
      expect(revokeDirectoryRoleMock).toHaveBeenCalledWith({
        memberId: 'sec-1',
        idToken: 'admin-id-token',
      })
    })
  })
})
