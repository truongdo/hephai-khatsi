import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { m } from '#/paraglide/messages'
import { theme } from '../../theme'
import { MembersStatsPage } from './MembersStatsPage'

const statsData = {
  totals: { all: 100, tang: 60, ni: 40 },
  byOrgUnit: [{ orgUnitId: 'gd-i', count: 210 }],
  byRankTang: [
    { rank: 'ty_kheo', count: 5 },
    { rank: 'unknown', count: 2 },
  ],
  byRankNi: [
    { rank: 'ni_su', count: 3 },
    { rank: 'unknown', count: 1 },
  ],
}

const useAdminClaimMock = vi.fn(() => ({
  status: 'admin' as const,
  uid: 'admin-uid',
  role: 'he_phai_admin' as const,
  orgUnitId: null,
}))

const memberDirectoryStatsQueryMock = vi.fn(() => ({
  queryKey: ['admin', 'memberDirectoryStats'],
  queryFn: async () => statsData,
  staleTime: 0,
}))

vi.mock('#/auth/useAdminClaim', () => ({
  useAdminClaim: () => useAdminClaimMock(),
}))

vi.mock('#/query/adminQueries', () => ({
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
  memberDirectoryStatsQuery: (scope: unknown) =>
    memberDirectoryStatsQueryMock(scope),
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
  memberDirectoryStatsQueryMock.mockImplementation(() => ({
    queryKey: ['admin', 'memberDirectoryStats'],
    queryFn: async () => statsData,
    staleTime: 0,
  }))
})

function renderStats() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <MembersStatsPage />
      </MantineProvider>
    </QueryClientProvider>,
  )
}

describe('MembersStatsPage', () => {
  it('shows AdminDenied when user cannot manage directory', async () => {
    useAdminClaimMock.mockReturnValue({
      status: 'admin',
      uid: 'admin-uid',
      role: 'temple_admin',
      orgUnitId: 't1',
    })
    renderStats()
    expect(await screen.findByText(m.admin_denied_title())).toBeTruthy()
  })

  it('shows loader while admin claim is loading, not AdminDenied', () => {
    useAdminClaimMock.mockReturnValue({ status: 'loading' })
    renderStats()
    expect(screen.getByLabelText('loading')).toBeTruthy()
    expect(screen.queryByText(m.admin_denied_title())).toBeNull()
  })

  it('hides by-org table for giao_doan_admin', async () => {
    useAdminClaimMock.mockReturnValue({
      status: 'admin',
      uid: 'admin-uid',
      role: 'giao_doan_admin',
      orgUnitId: 'gd-i',
    })
    memberDirectoryStatsQueryMock.mockImplementation(() => ({
      queryKey: ['admin', 'memberDirectoryStats', 'gd-i'],
      queryFn: async () => ({
        ...statsData,
        byOrgUnit: [],
      }),
      staleTime: 0,
    }))
    renderStats()
    expect(await screen.findByText(m.admin_member_stats_title())).toBeTruthy()
    expect(
      screen.queryByText(m.admin_member_stats_by_org_title()),
    ).toBeNull()
    expect(await screen.findByText('100')).toBeTruthy()
    expect(memberDirectoryStatsQueryMock).toHaveBeenCalledWith({
      orgUnitId: 'gd-i',
      orgUnitIdsForBreakdown: [],
    })
  })

  it('shows scoped org unit name for giao_doan_admin', async () => {
    useAdminClaimMock.mockReturnValue({
      status: 'admin',
      uid: 'admin-uid',
      role: 'giao_doan_admin',
      orgUnitId: 'gd-i',
    })
    renderStats()
    expect(await screen.findByText('100')).toBeTruthy()
    expect(screen.getByText(/Phạm vi:\s*Giáo đoàn I/)).toBeTruthy()
  })

  it('shows by-org table for he_phai_admin', async () => {
    renderStats()
    expect(await screen.findByText(m.admin_member_stats_by_org_title())).toBeTruthy()
    expect(screen.getByText('Giáo đoàn I')).toBeTruthy()
    expect(screen.getByText('210')).toBeTruthy()
    expect(memberDirectoryStatsQueryMock).toHaveBeenCalledWith({
      orgUnitId: null,
      orgUnitIdsForBreakdown: ['gd-i'],
    })
  })

  it('renders rank labels and unknown row', async () => {
    renderStats()
    expect(await screen.findByText('Tỳ-kheo')).toBeTruthy()
    expect(screen.getAllByText(m.admin_member_stats_rank_unknown()).length).toBeGreaterThan(0)
    expect(screen.getByText('Ni sư')).toBeTruthy()
  })

  it('shows load error when stats query fails', async () => {
    memberDirectoryStatsQueryMock.mockImplementation(() => ({
      queryKey: ['admin', 'memberDirectoryStats'],
      queryFn: async () => {
        throw new Error('Stats failed')
      },
      staleTime: 0,
    }))
    renderStats()
    expect(
      await screen.findByText(m.admin_member_stats_load_error()),
    ).toBeTruthy()
  })
})
