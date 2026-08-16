import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { DatesProvider } from '@mantine/dates'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { m } from '#/paraglide/messages'
import { MemberFormFields } from './MemberFormFields'

const mockOrgUnits = [
  {
    id: 'gd-i',
    code: 'gd-i',
    name: 'Giáo đoàn I',
    kind: 'giao_doan' as const,
    order: 1,
    allowsTang: true,
    allowsNi: false,
  },
  {
    id: 'ni-gd-i',
    code: 'ni-gd-i',
    name: 'Ni giới Giáo đoàn I',
    kind: 'ni_gioi' as const,
    order: 7,
    allowsTang: false,
    allowsNi: true,
  },
  {
    id: 'ni-gioi',
    code: 'ni-gioi',
    name: 'Ni giới Hệ phái Khất sĩ',
    kind: 'ni_gioi' as const,
    order: 11,
    allowsTang: false,
    allowsNi: true,
  },
]

vi.mock('#/repositories/orgUnitRepo', () => ({
  listOrgUnits: vi.fn(async () => mockOrgUnits),
}))

vi.mock('#/data/vietnam-locations', () => ({
  cities: [
    {
      code: '01',
      name: 'Hà Nội',
      fullName: 'Thành phố Hà Nội',
      slug: 'ha-noi',
      type: 'city',
    },
  ],
  getWards: vi.fn(async () => [
    {
      code: '00013',
      name: 'Hà Đông',
      fullName: 'Phường Hà Đông, Thành phố Hà Nội',
      slug: 'ha-dong',
      type: 'ward',
    },
  ]),
}))

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver =
    ResizeObserverMock as unknown as typeof ResizeObserver

  Element.prototype.scrollIntoView = vi.fn()

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

afterEach(() => {
  cleanup()
})

async function renderFields(orgUnitId: string) {
  const apiRef = { current: null }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MantineProvider>
        <DatesProvider settings={{ locale: 'vi' }}>
          <MemberFormFields
            apiRef={apiRef}
            initial={{}}
            cccd="012345678901"
            sanghaType="ni"
            orgUnitId={orgUnitId}
          />
        </DatesProvider>
      </MantineProvider>
    </QueryClientProvider>,
  )
}

describe('MemberFormFields phanDoan', () => {
  it('shows Phân đoàn for ni_gioi org units', async () => {
    await renderFields('ni-gd-i')
    await waitFor(() => {
      expect(
        screen.getByRole('combobox', { name: m.filler_field_phan_doan() }),
      ).toBeTruthy()
    })
  })

  it('shows Phân đoàn for Ni giới Hệ phái', async () => {
    await renderFields('ni-gioi')
    await waitFor(() => {
      expect(
        screen.getByRole('combobox', { name: m.filler_field_phan_doan() }),
      ).toBeTruthy()
    })
  })

  it('hides Phân đoàn for giao_doan org units', async () => {
    await renderFields('gd-i')
    await waitFor(() => {
      expect(
        screen.getByRole('textbox', { name: m.filler_field_the_danh() }),
      ).toBeTruthy()
    })
    expect(
      screen.queryByRole('combobox', { name: m.filler_field_phan_doan() }),
    ).toBeNull()
  })
})
