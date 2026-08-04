import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { m } from '#/paraglide/messages'
import { theme } from '../../theme'
import { RetreatRegistrationConfirm } from './RetreatRegistrationConfirm'

const member = {
  id: 'm1',
  orgUnitId: 'gd-i',
  sanghaType: 'tang' as const,
  status: 'draft' as const,
  theDanh: 'Thế A',
  phapDanh: 'Pháp A',
  ngaySinh: '1990-01-01',
  noiSinh: 'Hà Nội',
  cccd: '001234567890',
  dienThoai: '0901234567',
  email: '',
  diaChiThuongTru: 'Hà Nội',
  ngayXuatGia: '2010-01-01',
  noiXuatGia: 'Chùa A',
  hienTuHoc: '',
  bonSu: '',
  inviteId: 'retreat_r1',
  currentTempleId: null,
  photoPath: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  lockedAt: null,
  lockedBy: null,
  editRequestedAt: null,
  editRequestedBy: null,
}

const retreat = {
  id: 'r1',
  type: 'giao_doan' as const,
  orgUnitId: 'gd-i',
  name: 'Khóa tu mùa hè',
  diaDiem: 'Chùa A',
  noiDung: 'Nội dung',
  doiTuongThamDu: 'Tăng ni',
  thoiGianBatDau: '2026-08-01T08:00:00.000Z',
  thoiGianKetThuc: '2026-08-10T18:00:00.000Z',
  dangKyMoTu: '2026-07-01T00:00:00.000Z',
  dangKyDongLuc: '2026-07-31T23:59:00.000Z',
  extraFields: [{ key: 'note', label: 'Ghi chú', required: true }],
  quyenDangKy: 'both' as const,
  status: 'open' as const,
  createdBy: 'admin-uid',
  createdAt: '2026-07-19T10:00:00.000Z',
  updatedAt: '2026-07-19T10:00:00.000Z',
}

const getRegistrationMock = vi.fn<() => Promise<unknown>>(async () => null)

const createRegistrationMock = vi.fn(async () => ({
  id: 'r1_m1',
  retreatId: 'r1',
  memberId: 'm1',
  orgUnitId: 'gd-i',
  registeredVia: 'self' as const,
  registeredBy: null,
  extraAnswers: { note: 'hello' },
  status: 'pending' as const,
  approvedBy: null,
  approvedAt: null,
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
}))

vi.mock('#/repositories/retreatRegistrationRepo', () => ({
  retreatRegistrationRepo: {
    getById: (...args: unknown[]) => getRegistrationMock(...args),
  },
}))

vi.mock('#/use-cases/createRetreatRegistration', () => ({
  createRetreatRegistration: (...args: unknown[]) => createRegistrationMock(...args),
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
  createRegistrationMock.mockClear()
  getRegistrationMock.mockReset()
  getRegistrationMock.mockResolvedValue(null)
})

function renderConfirm() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <RetreatRegistrationConfirm retreat={retreat} member={member} />
      </MantineProvider>
    </QueryClientProvider>,
  )
}

describe('RetreatRegistrationConfirm', () => {
  it('shows read-only member summary and extra fields', async () => {
    renderConfirm()
    expect(
      await screen.findByRole('heading', { name: m.registration_confirm_title() }),
    ).toBeTruthy()
    expect(screen.getByText('Pháp A · Thế A')).toBeTruthy()
    expect(screen.getByText('0901234567')).toBeTruthy()
    expect(screen.getByRole('textbox', { name: /Ghi chú/ })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: m.registration_submit() }),
    ).toBeTruthy()
  })

  it('submits self registration with extra answers', async () => {
    const user = userEvent.setup()
    renderConfirm()

    await user.type(
      await screen.findByRole('textbox', { name: /Ghi chú/ }),
      'hello',
    )
    await user.click(screen.getByRole('button', { name: m.registration_submit() }))

    await waitFor(() => {
      expect(createRegistrationMock).toHaveBeenCalledWith({
        claims: null,
        retreatId: 'r1',
        memberId: 'm1',
        registeredVia: 'self',
        registeredBy: null,
        extraAnswers: { note: 'hello' },
      })
    })

    expect(await screen.findByText(m.registration_success_title())).toBeTruthy()
  })

  it('shows approved status when registration already exists', async () => {
    getRegistrationMock.mockResolvedValue({
      id: 'r1_m1',
      retreatId: 'r1',
      memberId: 'm1',
      orgUnitId: 'gd-i',
      registeredVia: 'self',
      registeredBy: null,
      extraAnswers: { note: 'hello' },
      status: 'approved',
      rejectionReason: null,
      approvedBy: 'admin-1',
      approvedAt: '2026-07-21T00:00:00.000Z',
      createdAt: '2026-07-20T00:00:00.000Z',
      updatedAt: '2026-07-21T00:00:00.000Z',
    })

    renderConfirm()

    expect(
      await screen.findByRole('heading', {
        name: m.registration_status_approved_title(),
      }),
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: m.registration_submit() }),
    ).toBeNull()
  })

  it('shows error alert when registration lookup fails', async () => {
    getRegistrationMock.mockRejectedValue(new Error('network'))

    renderConfirm()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      m.registration_error_generic(),
    )
    expect(
      screen.queryByRole('button', { name: m.registration_submit() }),
    ).toBeNull()
    expect(
      screen.queryByRole('heading', { name: m.registration_confirm_title() }),
    ).toBeNull()
  })

  it('shows gate instead of form when no registration and retreat closed', async () => {
    const closedRetreat = { ...retreat, status: 'closed' as const }
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={client}>
        <MantineProvider theme={theme} defaultColorScheme="light">
          <RetreatRegistrationConfirm retreat={closedRetreat} member={member} />
        </MantineProvider>
      </QueryClientProvider>,
    )

    expect(await screen.findByText(m.registration_gate_closed())).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: m.registration_submit() }),
    ).toBeNull()
  })
})
