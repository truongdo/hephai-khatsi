import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { m } from '#/paraglide/messages'
import { theme } from '../../theme'
import { RetreatRegistrationsPage } from './RetreatRegistrationsPage'

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
  extraFields: [{ key: 'note', label: 'Ghi chú', required: false }],
  quyenDangKy: 'both' as const,
  status: 'open' as const,
  createdBy: 'admin-uid',
  createdAt: '2026-07-19T10:00:00.000Z',
  updatedAt: '2026-07-19T10:00:00.000Z',
}

const ensureInviteMock = vi.fn(async () => ({
  id: 'retreat_r1',
  token: 'retreat_r1',
  kind: 'retreat_registration' as const,
  retreatId: 'r1',
  orgUnitId: 'gd-i',
  disabled: false,
  createdBy: 'admin-uid',
  createdAt: '2026-07-19T00:00:00.000Z',
}))

vi.mock('#/use-cases/ensureRetreatRegistrationInvite', () => ({
  ensureRetreatRegistrationInvite: (...args: unknown[]) => ensureInviteMock(...args),
}))

vi.mock('#/auth/useAdminClaim', () => ({
  useAdminClaim: () => ({
    status: 'admin',
    uid: 'admin-uid',
    role: 'giao_doan_admin',
    orgUnitId: 'gd-i',
  }),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    ...props
  }: {
    children: React.ReactNode
    to: string
    params?: { id: string }
  }) => {
    const href =
      params?.id && to.includes('$id') ? to.replace('$id', params.id) : to
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  },
}))

vi.mock('#/query/adminQueries', () => ({
  retreatQuery: (id: string) => ({
    queryKey: ['admin', 'retreat', id],
    queryFn: async () => retreat,
    staleTime: 0,
  }),
  retreatRegistrationsQuery: (retreatId: string) => ({
    queryKey: ['admin', 'retreatRegistrations', retreatId],
    queryFn: async () => ({ items: [], nextCursor: null }),
    staleTime: 0,
  }),
  memberQuery: (id: string) => ({
    queryKey: ['admin', 'member', id],
    queryFn: async () => ({
      id,
      phapDanh: 'Pháp A',
      theDanh: 'Thế A',
    }),
    staleTime: 0,
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
  ensureInviteMock.mockClear()
})

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <RetreatRegistrationsPage retreatId="r1" />
      </MantineProvider>
    </QueryClientProvider>,
  )
}

describe('RetreatRegistrationsPage', () => {
  it('renders empty list, proxy controls, and copy link button', async () => {
    renderPage()
    expect(await screen.findByText(m.admin_table_empty())).toBeTruthy()
    expect(
      screen.getByRole('button', { name: m.admin_retreat_registrations_copy_link() }),
    ).toBeTruthy()
    expect(screen.queryByText(m.admin_members_form_sangha_type())).toBeNull()
    expect(screen.getByLabelText(m.filler_phone_label())).toBeTruthy()
    expect(
      screen.getByRole('button', { name: m.admin_retreat_registrations_proxy_search() }),
    ).toBeTruthy()
  })
})
