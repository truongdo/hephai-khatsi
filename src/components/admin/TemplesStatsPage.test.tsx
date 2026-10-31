import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cities } from '#/data/vietnam-locations'
import { m } from '#/paraglide/messages'
import { theme } from '../../theme'
import { TemplesStatsPage } from './TemplesStatsPage'
import type { AdminClaimState } from '#/auth/useAdminClaim'

const statsData = {
  totals: { all: 100 },
  byOrgUnit: [
    { orgUnitId: 'gd-i', count: 20 },
    { orgUnitId: 'gd-ii', count: 40 },
  ],
  byCity: [
    { cityName: 'Huế', count: 10 },
    { cityName: 'Hà Nội', count: 30 },
    { cityName: 'unknown', count: 5 },
  ],
}

const useAdminClaimMock = vi.fn<() => AdminClaimState>(() => ({
  status: 'admin' as const,
  uid: 'admin-uid',
  role: 'he_phai_admin' as const,
  orgUnitId: null,
}))

const templeDirectoryStatsQueryMock = vi.fn((_scope: unknown) => ({
  queryKey: ['admin', 'templeDirectoryStats'],
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
      {
        id: 'gd-ii',
        code: 'II',
        name: 'Giáo đoàn II',
        kind: 'giao_doan',
        order: 2,
        allowsTang: true,
        allowsNi: true,
      },
    ],
    staleTime: 0,
  }),
  templeDirectoryStatsQuery: (scope: unknown) =>
    templeDirectoryStatsQueryMock(scope),
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
  templeDirectoryStatsQueryMock.mockImplementation(() => ({
    queryKey: ['admin', 'templeDirectoryStats'],
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
        <TemplesStatsPage />
      </MantineProvider>
    </QueryClientProvider>,
  )
}

describe('TemplesStatsPage', () => {
  it('shows AdminDenied when user cannot manage directory', async () => {
    useAdminClaimMock.mockReturnValue({
      status: 'admin',
      uid: 'admin-uid',
      role: 'kiem_soat',
      orgUnitId: null,
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
    templeDirectoryStatsQueryMock.mockImplementation(() => ({
      queryKey: ['admin', 'templeDirectoryStats', 'gd-i'],
      queryFn: async () => ({
        ...statsData,
        byOrgUnit: [],
      }),
      staleTime: 0,
    }))
    renderStats()
    expect(await screen.findByText(m.admin_temple_stats_title())).toBeTruthy()
    expect(
      screen.queryByText(m.admin_temple_stats_by_org_title()),
    ).toBeNull()
    expect(await screen.findByText('100')).toBeTruthy()
    expect(screen.getByText(m.admin_temple_stats_by_city_title())).toBeTruthy()
    expect(templeDirectoryStatsQueryMock).toHaveBeenCalledWith({
      orgUnitId: 'gd-i',
      orgUnitIdsForBreakdown: [],
      cityNamesForBreakdown: cities.map((c) => c.name),
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
    expect(
      await screen.findByText(m.admin_temple_stats_by_org_title()),
    ).toBeTruthy()
    expect(screen.getByText('Giáo đoàn I')).toBeTruthy()
    expect(screen.getByText('Giáo đoàn II')).toBeTruthy()
    expect(templeDirectoryStatsQueryMock).toHaveBeenCalledWith({
      orgUnitId: null,
      orgUnitIdsForBreakdown: ['gd-i', 'gd-ii'],
      cityNamesForBreakdown: cities.map((c) => c.name),
    })
  })

  it('sorts org and city rows by count descending with unknown last', async () => {
    renderStats()
    expect(await screen.findByText('Giáo đoàn II')).toBeTruthy()

    const orgTable = screen.getByText(m.admin_temple_stats_by_org_title())
      .parentElement!
    const orgNames = Array.from(orgTable.querySelectorAll('tbody td:first-child')).map(
      (el) => el.textContent,
    )
    expect(orgNames).toEqual(['Giáo đoàn II', 'Giáo đoàn I'])

    const cityTable = screen.getByText(m.admin_temple_stats_by_city_title())
      .parentElement!
    const cityNames = Array.from(
      cityTable.querySelectorAll('tbody td:first-child'),
    ).map((el) => el.textContent)
    expect(cityNames).toEqual([
      'Hà Nội',
      'Huế',
      m.admin_temple_stats_city_unknown(),
    ])
  })

  it('renders city labels and unknown row', async () => {
    renderStats()
    expect(await screen.findByText('Hà Nội')).toBeTruthy()
    expect(screen.getByText(m.admin_temple_stats_city_unknown())).toBeTruthy()
    expect(screen.getByText('30')).toBeTruthy()
    expect(screen.getByText('5')).toBeTruthy()
  })

  it('shows load error when stats query fails', async () => {
    templeDirectoryStatsQueryMock.mockImplementation(() => ({
      queryKey: ['admin', 'templeDirectoryStats'],
      queryFn: async () => {
        throw new Error('Stats failed')
      },
      staleTime: 0,
    }))
    renderStats()
    expect(
      await screen.findByText(m.admin_temple_stats_load_error()),
    ).toBeTruthy()
  })
})
