import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { m } from '#/paraglide/messages'
import { theme } from '../theme'
import { MaintenanceBanner, parseMaintenanceMode } from './MaintenanceBanner'

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

describe('parseMaintenanceMode', () => {
  it('is on only for the exact value true', () => {
    expect(parseMaintenanceMode('true')).toBe(true)
    expect(parseMaintenanceMode(undefined)).toBe(false)
    expect(parseMaintenanceMode('')).toBe(false)
    expect(parseMaintenanceMode('false')).toBe(false)
    expect(parseMaintenanceMode('1')).toBe(false)
  })
})

describe('MaintenanceBanner', () => {
  it('tells users that saving is paused', () => {
    render(
      <MantineProvider theme={theme} defaultColorScheme="light">
        <MaintenanceBanner />
      </MantineProvider>,
    )
    expect(screen.getByText(m.maintenance_banner_title())).toBeTruthy()
    expect(screen.getByText(m.maintenance_banner_body())).toBeTruthy()
  })
})
