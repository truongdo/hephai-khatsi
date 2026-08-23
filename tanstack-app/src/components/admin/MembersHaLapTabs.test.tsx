import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { Member } from '#/domain/types'
import { theme } from '../../theme'
import { MembersHaLapTabs } from './MembersHaLapTabs'

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

const activeTabMembers = [
  {
    id: 'm2',
    phapDanh: 'B',
    theDanh: 'B',
    orgUnitId: 'gd-i',
    cccd: '2',
    status: 'draft',
  },
  {
    id: 'm1',
    phapDanh: 'A',
    theDanh: 'A',
    orgUnitId: 'gd-i',
    cccd: '1',
    status: 'draft',
  },
] as Member[]

const orgUnitNameById = new Map([['gd-i', 'Giáo đoàn I']])

function renderTabs(
  props: Partial<React.ComponentProps<typeof MembersHaLapTabs>> = {},
) {
  const onToggle = vi.fn()
  const onToggleAllInTab = vi.fn()
  const onActiveTabChange = vi.fn()
  const onUnlock = vi.fn()

  const view = render(
    <MantineProvider theme={theme} defaultColorScheme="light">
      <MembersHaLapTabs
        sanghaType="tang"
        tabs={[
          { rankKey: 'ty_kheo', loadedCount: 2, totalCount: 5 },
          { rankKey: 'sa_di', loadedCount: 0, totalCount: 0 },
        ]}
        activeTabMembers={activeTabMembers}
        orgUnitNameById={orgUnitNameById}
        activeTab="ty_kheo"
        onActiveTabChange={onActiveTabChange}
        selectedIds={new Set()}
        onToggle={onToggle}
        onToggleAllInTab={onToggleAllInTab}
        onUnlock={onUnlock}
        {...props}
      />
    </MantineProvider>,
  )

  return { ...view, onToggle, onToggleAllInTab, onActiveTabChange, onUnlock }
}

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

describe('MembersHaLapTabs', () => {
  it('renders tabs with count labels and STT within active tab', async () => {
    renderTabs()
    expect(screen.getByRole('tab', { name: /Tỳ-kheo \(2\/5\)/ })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Sa-di \(0\)/ })).toBeTruthy()
    const firstRow = screen.getByRole('link', { name: 'B' }).closest('tr')
    expect(firstRow).toBeTruthy()
    expect(within(firstRow!).getByText('1')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'A' })).toBeTruthy()
  })

  it('select-all checkbox selects only active tab rows', async () => {
    const onToggleAllInTab = vi.fn()
    const user = userEvent.setup()
    renderTabs({ onToggleAllInTab })

    const table = screen.getByRole('table')
    const headerCheckbox = within(table).getAllByRole('checkbox')[0]
    await user.click(headerCheckbox)

    expect(onToggleAllInTab).toHaveBeenCalledWith(['m2', 'm1'], true)
  })
})
