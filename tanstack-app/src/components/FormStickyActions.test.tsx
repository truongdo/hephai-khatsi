import { Button, MantineProvider, Text } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { theme } from '../theme'
import { FormStickyActions } from './FormStickyActions'

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

describe('FormStickyActions', () => {
  it('renders fixed footer with actions and spacer', () => {
    render(
      <MantineProvider theme={theme} defaultColorScheme="light">
        <FormStickyActions status={<Text>Đã lưu</Text>}>
          <Button type="button">Lưu</Button>
        </FormStickyActions>
      </MantineProvider>,
    )

    const footer = screen.getByTestId('form-sticky-actions')
    expect(footer.style.position).toBe('fixed')
    expect(footer.style.bottom).toBe('0px')
    expect(screen.getByTestId('form-sticky-actions-spacer')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeTruthy()
    expect(screen.getByText('Đã lưu')).toBeTruthy()
  })
})
