import { MantineProvider, Table } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { theme } from '../../theme'
import { AdminDataTable } from './AdminDataTable'

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

function renderTable(ui: React.ReactElement) {
  return render(
    <MantineProvider theme={theme} defaultColorScheme="light">
      {ui}
    </MantineProvider>,
  )
}

const sampleChildren = (
  <>
    <Table.Thead>
      <Table.Tr>
        <Table.Th>Name</Table.Th>
      </Table.Tr>
    </Table.Thead>
    <Table.Tbody>
      <Table.Tr>
        <Table.Td>Row A</Table.Td>
      </Table.Tr>
    </Table.Tbody>
  </>
)

describe('AdminDataTable', () => {
  it('renders row children when not loading or empty', () => {
    renderTable(
      <AdminDataTable aria-label="demo">{sampleChildren}</AdminDataTable>,
    )
    expect(screen.getByText('Row A')).toBeTruthy()
    expect(screen.getByRole('table', { name: 'demo' })).toBeTruthy()
  })

  it('shows default empty message and hides children when empty', () => {
    renderTable(
      <AdminDataTable empty>{sampleChildren}</AdminDataTable>,
    )
    expect(screen.getByText('Chưa có dữ liệu')).toBeTruthy()
    expect(screen.queryByText('Row A')).toBeNull()
  })

  it('shows custom empty message when provided', () => {
    renderTable(
      <AdminDataTable empty emptyMessage="Không có dòng">
        {sampleChildren}
      </AdminDataTable>,
    )
    expect(screen.getByText('Không có dòng')).toBeTruthy()
  })

  it('shows loading skeleton and hides children when loading', () => {
    renderTable(
      <AdminDataTable loading aria-label="loading">
        {sampleChildren}
      </AdminDataTable>,
    )
    expect(screen.getByLabelText('loading')).toBeTruthy()
    expect(screen.queryByText('Row A')).toBeNull()
  })
})
