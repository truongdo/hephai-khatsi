import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { m } from '#/paraglide/messages'
import { theme } from '../../theme'
import { RetreatsListPage } from './RetreatsListPage'

const draftRetreat = {
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
  extraFields: [],
  quyenDangKy: 'both' as const,
  status: 'draft' as const,
  createdBy: 'admin-uid',
  createdAt: '2026-07-19T10:00:00.000Z',
  updatedAt: '2026-07-19T10:00:00.000Z',
}

const openRetreat = {
  ...draftRetreat,
  id: 'r2',
  name: 'Khóa tu thu',
  status: 'open' as const,
}

let retreatItems = [draftRetreat, openRetreat]

const deleteRetreatMock = vi.fn()

const retreatsQueryMock = vi.fn(() => ({
  queryKey: ['admin', 'retreats', { orgUnitId: 'gd-i' }],
  queryFn: async () => ({ items: retreatItems, nextCursor: null }),
  staleTime: 0,
}))

const useAdminClaimMock = vi.fn(() => ({
  status: 'admin' as const,
  uid: 'admin-uid',
  role: 'giao_doan_admin' as const,
  orgUnitId: 'gd-i',
}))

vi.mock('#/auth/useAdminClaim', () => ({
  useAdminClaim: () => useAdminClaimMock(),
}))

vi.mock('#/auth/useAuth', () => ({
  useAuth: () => ({
    user: { getIdToken: vi.fn(async () => 'admin-id-token') },
    loading: false,
    signOut: vi.fn(),
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
  retreatsQuery: (filters: unknown) => retreatsQueryMock(filters),
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

vi.mock('#/use-cases/deleteRetreat', () => ({
  deleteRetreat: (...args: unknown[]) => deleteRetreatMock(...args),
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
  useAdminClaimMock.mockReturnValue({
    status: 'admin',
    uid: 'admin-uid',
    role: 'giao_doan_admin',
    orgUnitId: 'gd-i',
  })
  retreatItems = [draftRetreat, openRetreat]
  deleteRetreatMock.mockReset()
  deleteRetreatMock.mockResolvedValue(undefined)
})

function renderList() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <RetreatsListPage />
      </MantineProvider>
    </QueryClientProvider>,
  )
  return { ...view, queryClient }
}

describe('RetreatsListPage', () => {
  it('renders heading, create link, and retreat row', async () => {
    renderList()
    expect(
      await screen.findByRole('heading', { name: m.admin_nav_retreats() }),
    ).toBeTruthy()
    const createLink = screen.getByRole('link', { name: m.admin_retreats_create() })
    expect(createLink.getAttribute('href')).toBe('/admin/retreats/new')
    expect(await screen.findByText('Khóa tu mùa hè')).toBeTruthy()
    const detailLink = screen.getByRole('link', { name: 'Khóa tu mùa hè' })
    expect(detailLink.getAttribute('href')).toBe('/admin/retreats/r1')
  })

  it('shows schedule columns as GMT+7 dates without time', async () => {
    renderList()
    await screen.findByText('Khóa tu mùa hè')
    // 2026-08-01T08:00Z → 15:00 +07 → 01/08/2026; 2026-08-10T18:00Z → 01:00 +07 next day
    expect(screen.getAllByText('01/08/2026 – 11/08/2026').length).toBeGreaterThan(0)
    // 2026-07-01T00:00Z → 07:00 +07; 2026-07-31T23:59Z → 06:59 +07 on 01/08
    expect(screen.getAllByText('01/07/2026 – 01/08/2026').length).toBeGreaterThan(0)
    expect(screen.queryByText(/\d{1,2}:\d{2}/)).toBeNull()
  })

  it('scopes list query to giao doan org unit', async () => {
    renderList()
    await screen.findByText('Khóa tu mùa hè')
    expect(retreatsQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({ orgUnitId: 'gd-i' }),
    )
  })

  it('shows delete only for draft rows', async () => {
    renderList()
    await screen.findByText('Khóa tu mùa hè')
    expect(
      screen.getByRole('button', {
        name: `${m.admin_retreats_delete()} Khóa tu mùa hè`,
      }),
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', {
        name: `${m.admin_retreats_delete()} Khóa tu thu`,
      }),
    ).toBeNull()
  })

  it('deletes draft retreat after confirm', async () => {
    const user = userEvent.setup()
    const { queryClient } = renderList()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    await screen.findByText('Khóa tu mùa hè')
    await user.click(
      screen.getByRole('button', {
        name: `${m.admin_retreats_delete()} Khóa tu mùa hè`,
      }),
    )
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Xóa' }))
    expect(deleteRetreatMock).toHaveBeenCalledWith(
      { role: 'giao_doan_admin', orgUnitId: 'gd-i' },
      'r1',
    )
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['admin', 'retreats'],
    })
  })

  describe('he_phai_secretary', () => {
    beforeEach(() => {
      useAdminClaimMock.mockReturnValue({
        status: 'admin',
        uid: 'admin-uid',
        role: 'he_phai_secretary',
        orgUnitId: null,
      })
      retreatsQueryMock.mockImplementation(() => ({
        queryKey: ['admin', 'retreats', {}],
        queryFn: async () => ({ items: retreatItems, nextCursor: null }),
        staleTime: 0,
      }))
    })

    it('shows org unit filter select', async () => {
      renderList()
      await screen.findByText('Khóa tu mùa hè')
      expect(
        screen.getByRole('combobox', {
          name: m.admin_retreats_filter_org_unit(),
        }),
      ).toBeTruthy()
    })
  })
})
