import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Text } from '@mantine/core'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { theme } from '../../theme'
import { RepeatableFieldset } from './RepeatableFieldset'

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

describe('RepeatableFieldset', () => {
  it('calls onAdd when Thêm is clicked', async () => {
    const onAdd = vi.fn()
    render(
      <MantineProvider theme={theme}>
        <RepeatableFieldset label="Rows" addLabel="Thêm" onAdd={onAdd}>
          <Text>row</Text>
        </RepeatableFieldset>
      </MantineProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Thêm' }))
    expect(onAdd).toHaveBeenCalledOnce()
  })
})
