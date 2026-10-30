import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { m } from '#/paraglide/messages'
import type { MemberSearchDoc, TempleSearchDoc } from '#/domain/searchDocs'
import { theme } from '../../theme'
import { AdminDirectorySearch } from './AdminDirectorySearch'

const navigateMock = vi.fn()
const getIdTokenMock = vi.fn(async () => 'admin-id-token')
const searchDirectoryMock = vi.fn()
const listOrgUnitsMock = vi.fn(async () => [
  { id: 'gd-i', name: 'Giáo Đoàn I', kind: 'giao_doan' as const },
])

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('#/auth/useAuth', () => ({
  useAuth: () => ({
    user: { getIdToken: getIdTokenMock },
  }),
}))

vi.mock('#/search/searchApiClient', () => ({
  searchDirectory: (...args: unknown[]) => searchDirectoryMock(...args),
}))

vi.mock('#/repositories/orgUnitRepo', () => ({
  listOrgUnits: () => listOrgUnitsMock(),
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

function renderSearch(forceOpened = true) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <MantineProvider theme={theme} defaultColorScheme="light">
          <AdminDirectorySearch forceOpened={forceOpened} />
        </MantineProvider>
      </QueryClientProvider>
    ),
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/admin/temples'] }),
  })
  return render(<RouterProvider router={router} />)
}

describe('AdminDirectorySearch', () => {
  beforeEach(() => {
    vi.useRealTimers()
    navigateMock.mockReset()
    getIdTokenMock.mockClear()
    listOrgUnitsMock.mockClear()
    searchDirectoryMock.mockReset()
    searchDirectoryMock.mockResolvedValue({
      members: [
        {
          id: 'member-1',
          orgUnitId: 'gd-i',
          sanghaType: 'tang',
          status: 'draft',
          phapDanh: 'Thích Minh A',
          theDanh: 'Nguyễn Văn A',
          cccd: '001099012345',
          dienThoai: '',
          updatedAt: 0,
        },
      ],
      temples: [
        {
          id: 'temple-1',
          orgUnitId: 'gd-i',
          status: 'locked',
          danhHieu: 'Chùa Bồ Đề',
          truTriPhapDanh: 'Thích Trụ Trì',
          phones: [],
          updatedAt: 0,
        },
      ],
    })
  })

  it('does not search when query is empty', async () => {
    renderSearch()

    expect(searchDirectoryMock).not.toHaveBeenCalled()
    expect(await screen.findByText(m.admin_search_hint())).toBeTruthy()
  })

  it('shows member and temple row details from search docs', async () => {
    const user = userEvent.setup()
    renderSearch()

    const input = await screen.findByPlaceholderText(m.admin_search_placeholder())
    await user.type(input, 'minh')

    await waitFor(() => {
      expect(searchDirectoryMock).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'minh', idToken: 'admin-id-token' }),
      )
    })

    expect(
      await screen.findByRole('button', { name: /Thích Minh A/ }),
    ).toBeTruthy()
    expect(
      screen.getByText(
        `Nguyễn Văn A · 001099012345 · ${m.admin_members_status_draft()} · Giáo Đoàn I`,
      ),
    ).toBeTruthy()
    expect(
      screen.getByText(
        `Thích Trụ Trì · ${m.admin_temples_status_locked()}`,
      ),
    ).toBeTruthy()
    // Groups render side-by-side in a SimpleGrid when both entity types have hits
    expect(document.querySelector('.mantine-SimpleGrid-root')).toBeTruthy()
    expect(document.querySelectorAll('.mantine-Spotlight-actionsGroup')).toHaveLength(
      2,
    )
  })

  it('ignores stale results when query changes during an in-flight search', async () => {
    let resolveFirst: (value: {
      members: MemberSearchDoc[]
      temples: TempleSearchDoc[]
    }) => void = () => {}

    const staleMember = {
      id: 'stale-member',
      orgUnitId: 'gd-i',
      sanghaType: 'tang' as const,
      status: 'draft' as const,
      phapDanh: 'Stale Result',
      theDanh: '',
      cccd: '',
      dienThoai: '',
      updatedAt: 0,
    }
    const freshMember = {
      id: 'fresh-member',
      orgUnitId: 'gd-i',
      sanghaType: 'tang' as const,
      status: 'draft' as const,
      phapDanh: 'Fresh Result',
      theDanh: '',
      cccd: '',
      dienThoai: '',
      updatedAt: 0,
    }

    searchDirectoryMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve
          }),
      )
      .mockResolvedValueOnce({ members: [freshMember], temples: [] })

    const user = userEvent.setup()
    renderSearch()

    const input = await screen.findByPlaceholderText(m.admin_search_placeholder())
    await user.type(input, 'old')

    await waitFor(() => {
      expect(searchDirectoryMock).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'old', idToken: 'admin-id-token' }),
      )
    })

    await user.type(input, 'er')

    await waitFor(() => {
      expect(searchDirectoryMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: 'older', idToken: 'admin-id-token' }),
      )
    })

    resolveFirst({ members: [staleMember], temples: [] })

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Stale Result/ })).toBeNull()
    })

    expect(
      await screen.findByRole('button', { name: /Fresh Result/ }),
    ).toBeTruthy()
  })

  it('searches and navigates to a member result', async () => {
    const user = userEvent.setup()
    renderSearch()

    const input = await screen.findByPlaceholderText(m.admin_search_placeholder())
    await user.type(input, 'minh')

    await waitFor(
      () => {
        expect(searchDirectoryMock).toHaveBeenCalledWith(
          expect.objectContaining({
            q: 'minh',
            idToken: 'admin-id-token',
          }),
        )
      },
      { timeout: 2000 },
    )

    await user.click(
      await screen.findByRole('button', { name: /Thích Minh A/ }),
    )

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/admin/members/$id',
      params: { id: 'member-1' },
    })
  })
})
