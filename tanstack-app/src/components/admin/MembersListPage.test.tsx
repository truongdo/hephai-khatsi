import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
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
    status: 'draft' as const,
    inviteId: null,
    currentTempleId: null,
    photoPath: null,
    createdAt: '2026-07-19T10:00:00.000Z',
    updatedAt: '2026-07-19T10:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
  },
]

const deleteMembersMock = vi.fn()

vi.mock('#/auth/useAdminClaim', () => ({
  useAdminClaim: () => ({ status: 'admin', uid: 'admin-uid' }),
}))

vi.mock('#/use-cases/deleteMembers', () => ({
  deleteMembers: (...args: unknown[]) => deleteMembersMock(...args),
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
  membersQuery: () => ({
    queryKey: ['admin', 'members', {}],
    queryFn: async () => ({ items: memberItems, nextCursor: null }),
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
  deleteMembersMock.mockReset()
  deleteMembersMock.mockResolvedValue(undefined)
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

  it('shows bulk delete toolbar when a row is selected', async () => {
    const user = userEvent.setup()
    renderList()
    await screen.findByText('HT A')
    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1])
    expect(screen.getByText('Đã chọn 1')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Xóa' })).toBeTruthy()
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
    expect(deleteMembersMock).toHaveBeenCalledWith({ ids: ['m1'] })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['admin', 'members'],
    })
    expect(screen.queryByText('Đã chọn 1')).toBeNull()
  })
})
