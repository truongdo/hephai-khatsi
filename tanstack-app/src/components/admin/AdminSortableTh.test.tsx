import { MantineProvider, Table } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { theme } from '../../theme'
import { AdminSortableTh } from './AdminSortableTh'

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

describe('AdminSortableTh', () => {
  it('calls onSort and sets aria-sort when active', async () => {
    const onSort = vi.fn()
    render(
      <MantineProvider theme={theme}>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <AdminSortableTh
                column="orgUnitName"
                label="Giáo đoàn"
                sortBy="orgUnitName"
                sortDir="asc"
                onSort={onSort}
              />
            </Table.Tr>
          </Table.Thead>
        </Table>
      </MantineProvider>,
    )
    const th = screen.getByRole('columnheader', { name: /Giáo đoàn/i })
    expect(th).toHaveAttribute('aria-sort', 'ascending')
    await userEvent.click(th)
    expect(onSort).toHaveBeenCalledWith('orgUnitName')
  })

  it('shows a sort icon when the column is not active', () => {
    render(
      <MantineProvider theme={theme}>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <AdminSortableTh
                column="orgUnitName"
                label="Giáo đoàn"
                sortBy="updatedAt"
                sortDir="desc"
                onSort={vi.fn()}
              />
            </Table.Tr>
          </Table.Thead>
        </Table>
      </MantineProvider>,
    )

    const th = screen.getByRole('columnheader', { name: /Giáo đoàn/i })
    expect(th.querySelector('svg')).toBeTruthy()
    expect(th).toHaveAttribute('aria-sort', 'none')
  })
})
