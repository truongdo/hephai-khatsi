import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { theme } from '../../theme'
import { TemplesListPage } from './TemplesListPage'

const templeItems = [
  {
    id: 't1',
    orgUnitId: 'gd-i',
    danhHieu: 'TX A',
    diaChiMoi: {
      cityCode: '01',
      cityName: 'Hà Nội',
      wardCode: '00001',
      wardName: 'Phường Test',
    },
    managerPhones: ['0901234567'],
    status: 'draft' as const,
    inviteId: null,
    photoPath: null,
    createdAt: '2026-07-19T10:00:00.000Z',
    updatedAt: '2026-07-19T10:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    editRequestedAt: null,
    editRequestedBy: null,
  },
]

const deleteTemplesMock = vi.fn()
const getIdTokenMock = vi.fn(async () => 'admin-id-token')
const templesQueryMock = vi.fn((filters: unknown = {}) => ({
  queryKey: ['admin', 'temples', filters],
  queryFn: async () => ({ items: templeItems, nextCursor: null }),
  staleTime: 0,
}))

const useAdminClaimMock = vi.fn(() => ({
  status: 'admin' as const,
  uid: 'admin-uid',
  role: 'he_phai_admin' as const,
  orgUnitId: null,
}))

vi.mock('#/auth/useAdminClaim', () => ({
  useAdminClaim: () => useAdminClaimMock(),
}))

vi.mock('#/auth/useAuth', () => ({
  useAuth: () => ({
    user: { getIdToken: getIdTokenMock },
    loading: false,
    signOut: vi.fn(),
  }),
}))

vi.mock('#/use-cases/deleteTemples', () => ({
  deleteTemples: (...args: unknown[]) => deleteTemplesMock(...args),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    target,
    rel,
    ...props
  }: {
    children: React.ReactNode
    to: string
    params?: { id: string }
    target?: string
    rel?: string
  }) => {
    const href =
      params?.id && to.includes('$id')
        ? to.replace('$id', params.id)
        : to
    return (
      <a href={href} target={target} rel={rel} {...props}>
        {children}
      </a>
    )
  },
}))

vi.mock('#/query/adminQueries', () => ({
  templesQuery: (filters: unknown) => templesQueryMock(filters),
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
    role: 'he_phai_admin',
    orgUnitId: null,
  })
  templesQueryMock.mockImplementation((filters: unknown = {}) => ({
    queryKey: ['admin', 'temples', filters],
    queryFn: async () => ({ items: templeItems, nextCursor: null }),
    staleTime: 0,
  }))
  deleteTemplesMock.mockReset()
  deleteTemplesMock.mockResolvedValue({ ok: true })
  getIdTokenMock.mockReset()
  getIdTokenMock.mockResolvedValue('admin-id-token')
})

function renderList() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <TemplesListPage />
      </MantineProvider>
    </QueryClientProvider>,
  )
  return { ...view, queryClient, invalidateSpy }
}

describe('TemplesListPage', () => {
  it('renders temple name and links to detail', async () => {
    renderList()
    expect(await screen.findByText('TX A')).toBeTruthy()
    const link = screen.getByRole('link', { name: 'TX A' })
    expect(link.getAttribute('href')).toBe('/admin/temples/t1')
  })

  it('sorts by org unit when Giáo đoàn header is clicked', async () => {
    const user = userEvent.setup()
    renderList()
    await screen.findByText('TX A')
    templesQueryMock.mockClear()

    await user.click(
      screen.getByRole('columnheader', { name: /Giáo đoàn/i }),
    )

    await waitFor(() => {
      expect(templesQueryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'orgUnitName',
          sortDir: 'asc',
        }),
      )
    })
  })

  it('resets accumulated rows when sort changes', async () => {
    const page1 = [templeItems[0]]
    const page2 = [
      {
        ...templeItems[0],
        id: 't2',
        danhHieu: 'TX B',
      },
    ]

    templesQueryMock.mockImplementation(
      (filters: { cursor?: string; sortBy?: string } = {}) => ({
        queryKey: ['admin', 'temples', filters],
        queryFn: async () => {
          if (filters.cursor) {
            return { items: page2, nextCursor: null }
          }
          return { items: page1, nextCursor: 'cursor-2' }
        },
        staleTime: 0,
      }),
    )

    const user = userEvent.setup()
    renderList()
    await screen.findByText('TX A')
    await user.click(screen.getByRole('button', { name: 'Tải thêm' }))
    await screen.findByText('TX B')
    templesQueryMock.mockClear()

    await user.click(
      screen.getByRole('columnheader', { name: /Giáo đoàn/i }),
    )

    await waitFor(() => {
      expect(templesQueryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'orgUnitName',
          sortDir: 'asc',
          cursor: undefined,
        }),
      )
    })
    await waitFor(() => {
      expect(screen.queryByText('TX B')).toBeNull()
    })
  })

  it('shows province and giao doan after danh hieu', async () => {
    renderList()
    await screen.findByText('TX A')
    expect(
      screen.getByRole('columnheader', { name: 'Tỉnh/thành phố' }),
    ).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Giáo đoàn' })).toBeTruthy()
    const headers = screen
      .getAllByRole('columnheader')
      .map((th) => th.textContent)
    const danhHieuIdx = headers.indexOf('Danh hiệu')
    expect(headers[danhHieuIdx + 1]).toBe('Tỉnh/thành phố')
    expect(headers[danhHieuIdx + 2]).toBe('Giáo đoàn')
    expect(screen.getByText('Hà Nội')).toBeTruthy()
    expect(screen.getAllByText('Giáo đoàn I').length).toBeGreaterThan(0)
  })

  it('shows bulk delete toolbar when a row is selected', async () => {
    const user = userEvent.setup()
    renderList()
    await screen.findByText('TX A')
    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1])
    expect(screen.getByText('Đã chọn 1')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Xóa' })).toBeTruthy()
  })

  it('deletes selected temples after confirm', async () => {
    const user = userEvent.setup()
    const { invalidateSpy } = renderList()
    await screen.findByText('TX A')
    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1])
    await user.click(screen.getByRole('button', { name: 'Xóa' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Xóa' }))
    expect(deleteTemplesMock).toHaveBeenCalledWith(
      { role: 'he_phai_admin', orgUnitId: null },
      {
        ids: ['t1'],
        idToken: 'admin-id-token',
      },
    )
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['admin', 'temples'],
    })
    expect(screen.queryByText('Đã chọn 1')).toBeNull()
  })

  it('invalidates list and shows error when delete fails', async () => {
    deleteTemplesMock.mockRejectedValue(new Error('Delete failed'))
    const user = userEvent.setup()
    const { invalidateSpy } = renderList()
    await screen.findByText('TX A')
    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1])
    await user.click(screen.getByRole('button', { name: 'Xóa' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Xóa' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Delete failed')
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['admin', 'temples'],
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('shows blocker modal when delete is blocked', async () => {
    deleteTemplesMock.mockResolvedValue({
      ok: false,
      blockers: [
        {
          templeId: 't1',
          templeLabel: 'TX A',
          members: [{ id: 'm1', label: 'HT Blocked' }],
        },
      ],
    })
    const user = userEvent.setup()
    renderList()
    await screen.findByText('TX A')
    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1])
    await user.click(screen.getByRole('button', { name: 'Xóa' }))
    const confirmDialog = await screen.findByRole('dialog')
    await user.click(within(confirmDialog).getByRole('button', { name: 'Xóa' }))
    expect(
      await screen.findByText('Không thể xóa tịnh xá'),
    ).toBeTruthy()
    const memberLink = screen.getByRole('link', { name: 'HT Blocked' })
    expect(memberLink.getAttribute('href')).toBe('/admin/members/m1')
    expect(memberLink.getAttribute('target')).toBe('_blank')
    expect(memberLink.getAttribute('rel')).toBe('noopener noreferrer')
  })

  describe('giao_doan_admin', () => {
    beforeEach(() => {
      useAdminClaimMock.mockReturnValue({
        status: 'admin',
        uid: 'admin-uid',
        role: 'giao_doan_admin',
        orgUnitId: 'gd-i',
      })
    })

    it('scopes list query to giao doan org unit', async () => {
      renderList()
      await screen.findByText('TX A')
      expect(templesQueryMock).toHaveBeenCalledWith(
        expect.objectContaining({ orgUnitId: 'gd-i' }),
      )
    })

    it('hides org unit filter select', async () => {
      renderList()
      await screen.findByText('TX A')
      expect(
        screen.queryByRole('combobox', { name: 'Giáo đoàn' }),
      ).toBeNull()
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
    })

    it('shows org unit filter select', async () => {
      renderList()
      await screen.findByText('TX A')
      expect(
        screen.getByRole('combobox', { name: 'Giáo đoàn' }),
      ).toBeTruthy()
    })
  })
})
