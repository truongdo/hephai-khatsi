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
  photoPath: null,
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

const getIdTokenMock = vi.fn(async () => 'admin-id-token')

vi.mock('#/auth/useAdminClaim', () => ({
  useAdminClaim: () => ({ status: 'admin', uid: 'admin-uid' }),
}))

vi.mock('#/auth/useAuth', () => ({
  useAuth: () => ({
    user: { getIdToken: getIdTokenMock },
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
vi.mock('#/use-cases/uploadTemplePhoto', () => ({
  uploadTemplePhoto: vi.fn(async () => ({
    photoPath: 'temples/created-temple/photo.jpg',
  })),
}))
vi.mock('#/data/vietnam-locations', () => ({
  cities: [
    {
      code: '01',
      name: 'Hà Nội',
      fullName: 'Thành phố Hà Nội',
      slug: 'ha-noi',
      type: 'city',
    },
  ],
  getWards: vi.fn(async () => [
    {
      code: '00013',
      name: 'Hà Đông',
      fullName: 'Phường Hà Đông, Thành phố Hà Nội',
      slug: 'ha-dong',
      type: 'ward',
    },
  ]),
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

  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  templeFixture = lockedTemple
  lockedTemple.diaChiMoi = '123 Đường A'
  saveAdminTempleMock.mockReset()
  getIdTokenMock.mockClear()
  saveAdminTempleMock.mockResolvedValue({
    temple: { ...draftTemple, id: 'created-temple' },
    mode: 'created',
  } as never)
})

function renderForm({ mode }: { mode: 'create' | 'edit' }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(['admin', 'orgUnits'], [
    {
      id: 'gd-i',
      code: 'I',
      name: 'Giáo đoàn I',
      kind: 'giao_doan',
      order: 1,
      allowsTang: true,
      allowsNi: true,
    },
  ])
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <TempleFormPage mode={mode} templeId={mode === 'edit' ? 't1' : undefined} />
      </MantineProvider>
    </QueryClientProvider>,
  )
}

async function selectOrgUnit(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('button', { name: m.admin_temples_save_draft() })
  const select = await screen.findByRole('combobox', {
    name: new RegExp(`^${m.admin_temples_form_org_unit()}`),
  })
  await user.click(select)
  await user.click(await screen.findByText('Giáo đoàn I'))
}

describe('TempleFormPage', () => {
  it('shows unlock when locked', async () => {
    renderForm({ mode: 'edit' })
    expect(
      await screen.findByRole('button', { name: /mở khóa|unlock/i }),
    ).toBeTruthy()
  })

  it('renders full temple sections', async () => {
    templeFixture = draftTemple
    renderForm({ mode: 'edit' })
    expect(
      await screen.findByText(m.filler_section_temple_identity()),
    ).toBeTruthy()
    expect(screen.getByText(m.filler_section_temple_address())).toBeTruthy()
    expect(screen.getByText(m.filler_field_anh_tinh_xa())).toBeTruthy()
  })

  it('Lưu nháp saves without temple required-field validation when a manager phone is present', async () => {
    const user = userEvent.setup()
    renderForm({ mode: 'create' })
    await selectOrgUnit(user)
    await user.type(
      screen.getByLabelText(m.filler_field_manager_phone()),
      '0901234567',
    )
    await user.click(
      screen.getByRole('button', { name: m.admin_temples_save_draft() }),
    )

    await vi.waitFor(() => expect(saveAdminTempleMock).toHaveBeenCalled())
    expect(saveAdminTempleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orgUnitId: 'gd-i',
        explicitPhones: ['0901234567'],
      }),
    )
  })

  it('Hoàn thành does not save when required fields missing', async () => {
    const user = userEvent.setup()
    renderForm({ mode: 'create' })
    await selectOrgUnit(user)
    await user.type(
      screen.getByLabelText(m.filler_field_manager_phone()),
      '0901234567',
    )
    await user.click(
      screen.getByRole('button', { name: m.admin_temples_complete() }),
    )

    expect(saveAdminTempleMock).not.toHaveBeenCalled()
    expect(
      screen.getAllByText(m.filler_error_field_required()).length,
    ).toBeGreaterThan(0)
  })

  it('keeps fields editable when locked', async () => {
    templeFixture = lockedTemple
    renderForm({ mode: 'edit' })
    const input = await screen.findByLabelText(
      new RegExp(`^${m.filler_field_danh_hieu()}`),
    )
    expect(input).not.toBeDisabled()
    expect(
      screen.getByRole('button', { name: m.admin_temples_save_draft() }),
    ).toBeTruthy()
  })
})
