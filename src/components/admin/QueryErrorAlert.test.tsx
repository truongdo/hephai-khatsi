import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { theme } from '../../theme'
import { QueryErrorAlert } from './QueryErrorAlert'

beforeAll(() => {
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

describe('QueryErrorAlert', () => {
  it('shows load failure copy and the underlying error message', () => {
    render(
      <MantineProvider theme={theme} defaultColorScheme="light">
        <QueryErrorAlert
          error={new Error('The query requires an index. You can create it here: https://example.com')}
        />
      </MantineProvider>,
    )

    expect(screen.getByRole('alert').textContent).toMatch(/Không tải được dữ liệu/)
    expect(
      screen.getByText(/The query requires an index/, { exact: false }),
    ).toBeTruthy()
  })
})
