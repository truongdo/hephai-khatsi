import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { theme } from '../../theme'
import { TemplesListPage } from './TemplesListPage'

const templeItems = [
  {
    id: 't1',
    orgUnitId: 'gd-i',
    danhHieu: 'TX A',
    managerPhones: ['0901234567'],
    status: 'draft' as const,
    inviteId: null,
    createdAt: '2026-07-19T10:00:00.000Z',
    updatedAt: '2026-07-19T10:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
  },
]

const deleteTemplesMock = vi.fn()

vi.mock('#/auth/useAdminClaim', () => ({
  useAdminClaim: () => ({ status: 'admin', uid: 'admin-uid' }),
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
  templesQuery: () => ({
    queryKey: ['admin', 'temples', {}],
    queryFn: async () => ({ items: templeItems, nextCursor: null }),
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
  deleteTemplesMock.mockReset()
  deleteTemplesMock.mockResolvedValue({ ok: true })
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
    expect(deleteTemplesMock).toHaveBeenCalledWith({ ids: ['t1'] })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['admin', 'temples'],
    })
    expect(screen.queryByText('Đã chọn 1')).toBeNull()
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
})
