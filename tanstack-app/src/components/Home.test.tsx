import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { m } from '#/paraglide/messages'
import { theme } from '../theme'
import { Home } from './Home'

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

describe('Home', () => {
  it('renders the welcome heading with Mantine', () => {
    render(
      <MantineProvider theme={theme} defaultColorScheme="light">
        <Home />
      </MantineProvider>,
    )

    expect(
      screen.getByRole('heading', { name: m.home_welcome() }),
    ).toBeTruthy()
  })
})
