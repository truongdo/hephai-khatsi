import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AddressValue } from '#/domain/address'
import { m } from '#/paraglide/messages'
import { saveAdminTemple } from '#/use-cases/saveAdminTemple'
import { theme } from '../../theme'
import { TempleFormPage } from './TempleFormPage'

const structuredAddress: AddressValue = {
  cityCode: '01',
  cityName: 'Hà Nội',
  wardCode: '00013',
  wardName: 'Hà Đông',
  line: '15 Ngõ 4',
}

const lockedTemple = {
  id: 't1',
  orgUnitId: 'gd-i',
  danhHieu: 'TX A',
  managerPhones: ['0901234567'],
  status: 'locked' as const,
  inviteId: 'inv-1',
  diaChiMoi: '123 Đường A' as string | AddressValue,
  truTriHienNay: { dienThoai: '0901234567' },
  createdAt: '2026-07-19T10:00:00.000Z',
  updatedAt: '2026-07-19T10:00:00.000Z',
  lockedAt: '2026-07-19T11:00:00.000Z',
  lockedBy: 'admin-uid',
}

const draftTemple = {
  ...lockedTemple,
  status: 'draft' as const,
  lockedAt: null,
  lockedBy: null,
  diaChiMoi: structuredAddress as string | AddressValue,
}

vi.mock('#/auth/useAdminClaim', () => ({
  useAdminClaim: () => ({ status: 'admin', uid: 'admin-uid' }),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    ...props
  }: {
    children: React.ReactNode
    to: string
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}))

let templeFixture: typeof lockedTemple | typeof draftTemple = lockedTemple

vi.mock('#/query/adminQueries', () => ({
  templeQuery: (id: string) => ({
    queryKey: ['admin', 'temple', id],
    queryFn: async () => templeFixture,
    staleTime: 0,
  }),
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
}))

vi.mock('#/use-cases/saveAdminTemple', () => ({
  saveAdminTemple: vi.fn(),
}))
vi.mock('#/use-cases/lockTemple', () => ({
  lockTemple: vi.fn(),
}))
vi.mock('#/use-cases/unlockTemple', () => ({
  unlockTemple: vi.fn(),
}))

const saveAdminTempleMock = vi.mocked(saveAdminTemple)

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

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  templeFixture = lockedTemple
  lockedTemple.diaChiMoi = '123 Đường A'
  saveAdminTempleMock.mockReset()
})

function renderForm({ mode }: { mode: 'create' | 'edit' }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <TempleFormPage mode={mode} templeId={mode === 'edit' ? 't1' : undefined} />
      </MantineProvider>
    </QueryClientProvider>,
  )
}

describe('TempleFormPage', () => {
  it('shows unlock when locked', async () => {
    renderForm({ mode: 'edit' })
    expect(
      await screen.findByRole('button', { name: /mở khóa|unlock/i }),
    ).toBeTruthy()
  })

  it('displays formatted structured address as read-only', async () => {
    templeFixture = draftTemple
    renderForm({ mode: 'edit' })
    const input = await screen.findByDisplayValue('15 Ngõ 4, Hà Đông, Hà Nội')
    expect(input).toHaveAttribute('readonly')
    expect(
      screen.getByText(m.admin_temples_form_dia_chi_structured_readonly()),
    ).toBeTruthy()
  })

  it('omits structured diaChiMoi from admin save patch', async () => {
    const user = userEvent.setup()
    templeFixture = draftTemple
    saveAdminTempleMock.mockResolvedValue({
      temple: { ...draftTemple, id: 't1' },
      mode: 'updated',
    } as never)

    renderForm({ mode: 'edit' })
    await screen.findByDisplayValue('15 Ngõ 4, Hà Đông, Hà Nội')

    await user.type(
      screen.getByLabelText(m.admin_temples_form_danh_hieu()),
      ' updated',
    )
    await user.click(screen.getByRole('button', { name: m.admin_temples_save() }))

    expect(saveAdminTempleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: expect.not.objectContaining({
          diaChiMoi: expect.anything(),
        }),
      }),
    )
    expect(saveAdminTempleMock.mock.calls[0]?.[0].patch).not.toHaveProperty(
      'diaChiMoi',
    )
  })
})
