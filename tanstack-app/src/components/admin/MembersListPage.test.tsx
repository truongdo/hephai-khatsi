import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { theme } from '../../theme'
import { MembersListPage } from './MembersListPage'

const memberItems = [
  {
    id: 'm1',
    orgUnitId: 'gd-i',
    sanghaType: 'tang' as const,
    cccd: '001099012345',
    phapDanh: 'HT A',
    theDanh: 'Nguyễn Văn A',
    giaoPhamHePhai: { rank: 'ty_kheo' },
    haLapTabRank: 'ty_kheo',
    sapXepHaLap: 'ty_kheo:2010-01-01::',
    status: 'draft' as const,
    inviteId: null,
    currentTempleId: null,
    photoPath: null,
    createdAt: '2026-07-19T10:00:00.000Z',
    updatedAt: '2026-07-19T10:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    editRequestedAt: null,
    editRequestedBy: null,
  },
  {
    id: 'm2',
    orgUnitId: 'gd-i',
    sanghaType: 'tang' as const,
    cccd: '001099012346',
    phapDanh: 'HT Locked',
    theDanh: 'Nguyễn Văn B',
    giaoPhamHePhai: { rank: 'hoa_thuong' },
    haLapTabRank: 'ty_kheo',
    sapXepHaLap: 'ty_kheo:2008-01-01::',
    status: 'locked' as const,
    inviteId: null,
    currentTempleId: null,
    photoPath: null,
    createdAt: '2026-07-19T10:00:00.000Z',
    updatedAt: '2026-07-19T10:00:00.000Z',
    lockedAt: '2026-07-19T10:00:00.000Z',
    lockedBy: 'admin-uid',
    editRequestedAt: '2026-07-20T00:00:00.000Z',
    editRequestedBy: '0901234567',
  },
]

const deleteMembersMock = vi.fn()
const exportMembersExcelMock = vi.fn(async () => {})
const unlockMemberMock = vi.fn()
const getIdTokenMock = vi.fn(async () => 'admin-id-token')
const membersByHaLapTabQueryMock = vi.fn((filters: unknown = {}) => ({
  queryKey: ['admin', 'membersByHaLapTab', filters],
  queryFn: async () => ({ items: memberItems, nextCursor: null }),
  staleTime: 0,
}))
const membersHaLapTabCountsQueryMock = vi.fn((filters: unknown = {}) => ({
  queryKey: ['admin', 'membersHaLapTabCounts', filters],
  queryFn: async () => ({ ty_kheo: 2, sa_di: 0, __empty__: 0 }),
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

vi.mock('#/use-cases/deleteMembers', () => ({
  deleteMembers: (...args: unknown[]) => deleteMembersMock(...args),
}))

vi.mock('#/use-cases/exportMembersExcel', () => ({
  exportMembersExcel: (...args: unknown[]) => exportMembersExcelMock(...args),
}))

vi.mock('#/use-cases/unlockMember', () => ({
  unlockMember: (...args: unknown[]) => unlockMemberMock(...args),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    search,
    ...props
  }: {
    children: React.ReactNode
    to: string
    params?: { id: string }
    search?: { sanghaType?: string }
  }) => {
    let href = params?.id && to.includes('$id') ? to.replace('$id', params.id) : to
    if (search?.sanghaType) {
      href += `?sanghaType=${search.sanghaType}`
    }
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  },
}))

vi.mock('#/query/adminQueries', () => ({
  membersByHaLapTabQuery: (filters: unknown) =>
    membersByHaLapTabQueryMock(filters),
  membersHaLapTabCountsQuery: (filters: unknown) =>
    membersHaLapTabCountsQueryMock(filters),
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
  localStorage.clear()
  exportMembersExcelMock.mockClear()
  useAdminClaimMock.mockReturnValue({
    status: 'admin',
    uid: 'admin-uid',
    role: 'he_phai_admin',
    orgUnitId: null,
  })
  membersByHaLapTabQueryMock.mockImplementation((filters: unknown = {}) => ({
    queryKey: ['admin', 'membersByHaLapTab', filters],
    queryFn: async () => ({ items: memberItems, nextCursor: null }),
    staleTime: 0,
  }))
  deleteMembersMock.mockReset()
  deleteMembersMock.mockResolvedValue(undefined)
  unlockMemberMock.mockReset()
  unlockMemberMock.mockResolvedValue({
    ...memberItems[1],
    status: 'draft',
    editRequestedAt: null,
    editRequestedBy: null,
  })
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
        <MembersListPage sanghaType="tang" />
      </MantineProvider>
    </QueryClientProvider>,
  )
  return { ...view, queryClient, invalidateSpy }
}

describe('MembersListPage', () => {
  it('renders member name and links to detail', async () => {
    renderList()
    expect(await screen.findByText('HT A')).toBeTruthy()
    const link = screen.getByRole('link', { name: 'HT A' })
    expect(link.getAttribute('href')).toBe('/admin/members/m1')
  })

  it('renders hạ-lạp tab and table columns', async () => {
    renderList()
    await screen.findByText('HT A')
    expect(screen.getByRole('tab', { name: /Tỳ-kheo/i })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'STT' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Pháp danh' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Thế danh' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Giáo đoàn' })).toBeTruthy()
    expect(screen.getByText('Nguyễn Văn A')).toBeTruthy()
    expect(screen.getAllByText('Giáo đoàn I').length).toBeGreaterThan(0)
    expect(screen.getByText('001099012345')).toBeTruthy()
  })

  it('loads active tab via membersByHaLapTab query', async () => {
    renderList()
    await screen.findByText('HT A')
    expect(membersByHaLapTabQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sanghaType: 'tang',
        haLapTabRank: 'ty_kheo',
      }),
    )
  })

  it('shows bulk delete toolbar when a row is selected', async () => {
    const user = userEvent.setup()
    renderList()
    await screen.findByText('HT A')
    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1])
    expect(screen.getByText('Đã chọn 1')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Xóa' })).toBeTruthy()
  })

  it('invalidates list and shows error when delete fails', async () => {
    deleteMembersMock.mockRejectedValue(new Error('Delete failed'))
    const user = userEvent.setup()
    const { invalidateSpy } = renderList()
    await screen.findByText('HT A')
    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1])
    await user.click(screen.getByRole('button', { name: 'Xóa' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Xóa' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Delete failed')
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['admin', 'membersByHaLapTab'],
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('deletes selected members after confirm', async () => {
    const user = userEvent.setup()
    const { invalidateSpy } = renderList()
    await screen.findByText('HT A')
    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1])
    await user.click(screen.getByRole('button', { name: 'Xóa' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Xóa' }))
    expect(deleteMembersMock).toHaveBeenCalledWith(
      { role: 'he_phai_admin', orgUnitId: null },
      {
        ids: ['m1'],
        idToken: 'admin-id-token',
      },
    )
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['admin', 'membersByHaLapTab'],
    })
    expect(screen.queryByText('Đã chọn 1')).toBeNull()
  })

  it('shows edit-request badge and unlock for locked row with edit request', async () => {
    const user = userEvent.setup()
    const { invalidateSpy } = renderList()
    expect(await screen.findByText('HT Locked')).toBeTruthy()
    expect(screen.getByText('Yêu cầu chỉnh sửa')).toBeTruthy()
    const unlockButton = screen.getByRole('button', { name: 'Mở khóa' })
    await user.click(unlockButton)
    expect(unlockMemberMock).toHaveBeenCalledWith({
      memberId: 'm2',
      audit: { actorType: 'admin', actorId: 'admin-uid' },
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['admin', 'membersByHaLapTab'],
    })
  })

  it('opens column modal on export and exports selected columns on confirm', async () => {
    const user = userEvent.setup()
    renderList()
    await screen.findByText('HT A')
    await user.click(screen.getByRole('button', { name: 'Xuất Excel' }))
    expect(exportMembersExcelMock).not.toHaveBeenCalled()
    const dialog = await screen.findByRole('dialog', { name: 'Chọn cột xuất Excel' })
    await user.click(within(dialog).getByRole('button', { name: 'Xuất' }))
    await waitFor(() => expect(exportMembersExcelMock).toHaveBeenCalled())
    const input = exportMembersExcelMock.mock.calls[0]?.[0] as {
      columnIds: string[]
      orgUnitNameById: Record<string, string>
      sanghaType: string
    }
    expect(input.sanghaType).toBe('tang')
    expect(input.columnIds[0]).toBe('theDanh')
    expect(input.orgUnitNameById['gd-i']).toBe('Giáo đoàn I')
  })

  it('filters to edit-requested rows client-side', async () => {
    const user = userEvent.setup()
    renderList()
    expect(await screen.findByText('HT Locked')).toBeTruthy()
    expect(screen.getByText('HT A')).toBeTruthy()
    const statusSelect = screen.getByRole('combobox', { name: 'Trạng thái' })
    await user.click(statusSelect)
    await user.click(await screen.findByText('Có yêu cầu chỉnh sửa'))
    await waitFor(() => {
      expect(screen.queryByText('HT A')).toBeNull()
    })
    expect(screen.getByText('HT Locked')).toBeTruthy()
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
      await screen.findByText('HT A')
      expect(membersByHaLapTabQueryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          orgUnitId: 'gd-i',
          sanghaType: 'tang',
          haLapTabRank: 'ty_kheo',
        }),
      )
    })

    it('hides org unit filter select', async () => {
      renderList()
      await screen.findByText('HT A')
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
      await screen.findByText('HT A')
      expect(
        screen.getByRole('combobox', { name: 'Giáo đoàn' }),
      ).toBeTruthy()
    })
  })
})
