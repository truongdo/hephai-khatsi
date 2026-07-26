import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { m } from '#/paraglide/messages'
import { createRetreat } from '#/use-cases/createRetreat'
import { deleteRetreat } from '#/use-cases/deleteRetreat'
import { openRetreat } from '#/use-cases/openRetreat'
import { updateRetreat } from '#/use-cases/updateRetreat'
import { theme } from '../../theme'
import { RetreatFormPage } from './RetreatFormPage'

const baseRetreat = {
  id: 'r1',
  type: 'giao_doan' as const,
  orgUnitId: 'gd-i',
  name: 'Khóa tu mùa hè',
  diaDiem: 'Chùa A',
  noiDung: 'Nội dung khóa tu',
  doiTuongThamDu: 'Tăng ni',
  thoiGianBatDau: '2026-08-01T08:00:00.000Z',
  thoiGianKetThuc: '2026-08-10T18:00:00.000Z',
  dangKyMoTu: '2026-07-01T00:00:00.000Z',
  dangKyDongLuc: '2026-07-31T23:59:00.000Z',
  extraFields: [{ key: 'phong', label: 'Phòng', required: false }],
  quyenDangKy: 'both' as const,
  status: 'draft' as const,
  createdBy: 'admin-uid',
  createdAt: '2026-07-19T10:00:00.000Z',
  updatedAt: '2026-07-19T10:00:00.000Z',
}

const navigateMock = vi.fn()

vi.mock('#/auth/useAdminClaim', () => ({
  useAdminClaim: () => ({
    status: 'admin',
    uid: 'admin-uid',
    role: 'giao_doan_admin',
    orgUnitId: 'gd-i',
  }),
}))

vi.mock('#/auth/useAuth', () => ({
  useAuth: () => ({
    user: { getIdToken: vi.fn(async () => 'admin-id-token') },
    loading: false,
  }),
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
  useNavigate: () => navigateMock,
}))

let retreatFixture = baseRetreat

vi.mock('#/query/adminQueries', () => ({
  retreatQuery: (id: string) => ({
    queryKey: ['admin', 'retreat', id],
    queryFn: async () => retreatFixture,
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

vi.mock('#/use-cases/createRetreat', () => ({ createRetreat: vi.fn() }))
vi.mock('#/use-cases/updateRetreat', () => ({ updateRetreat: vi.fn() }))
vi.mock('#/use-cases/openRetreat', () => ({ openRetreat: vi.fn() }))
vi.mock('#/use-cases/closeRetreat', () => ({ closeRetreat: vi.fn() }))
vi.mock('#/use-cases/deleteRetreat', () => ({ deleteRetreat: vi.fn() }))

const createRetreatMock = vi.mocked(createRetreat)
const updateRetreatMock = vi.mocked(updateRetreat)
const openRetreatMock = vi.mocked(openRetreat)
const deleteRetreatMock = vi.mocked(deleteRetreat)

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
  retreatFixture = { ...baseRetreat }
  createRetreatMock.mockReset()
  updateRetreatMock.mockReset()
  openRetreatMock.mockReset()
  deleteRetreatMock.mockReset()
  navigateMock.mockReset()
  updateRetreatMock.mockResolvedValue(baseRetreat)
  createRetreatMock.mockResolvedValue({ ...baseRetreat, id: 'created-r' })
  openRetreatMock.mockResolvedValue({ ...baseRetreat, status: 'open' })
  deleteRetreatMock.mockResolvedValue(undefined)
})

function renderForm({ mode }: { mode: 'create' | 'edit' }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <RetreatFormPage
          mode={mode}
          retreatId={mode === 'edit' ? 'r1' : undefined}
        />
      </MantineProvider>
    </QueryClientProvider>,
  )
}

describe('RetreatFormPage', () => {
  it('renders key fields on edit', async () => {
    renderForm({ mode: 'edit' })
    expect(
      await screen.findByRole('heading', {
        name: m.admin_retreats_form_title_edit(),
      }),
    ).toBeTruthy()
    expect(await screen.findByDisplayValue('Khóa tu mùa hè')).toBeTruthy()
    expect(screen.getByDisplayValue('Chùa A')).toBeTruthy()
    expect(screen.getByDisplayValue('Phòng')).toBeTruthy()
  })

  it('shows open and delete for draft retreat', async () => {
    renderForm({ mode: 'edit' })
    expect(
      await screen.findByRole('button', { name: m.admin_retreats_open() }),
    ).toBeTruthy()
    expect(
      await screen.findByRole('button', { name: m.admin_retreats_delete() }),
    ).toBeTruthy()
  })

  it('saves via updateRetreat on edit', async () => {
    const user = userEvent.setup()
    renderForm({ mode: 'edit' })
    await screen.findByRole('button', { name: m.admin_retreats_save() })
    await user.click(screen.getByRole('button', { name: m.admin_retreats_save() }))
    await vi.waitFor(() => expect(updateRetreatMock).toHaveBeenCalled())
    expect(updateRetreatMock).toHaveBeenCalledWith(
      { role: 'giao_doan_admin', orgUnitId: 'gd-i' },
      expect.objectContaining({ retreatId: 'r1' }),
    )
  })
})
