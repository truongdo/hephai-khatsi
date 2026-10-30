import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { m } from '#/paraglide/messages'
import { theme } from '../../theme'
import { RetreatRegistrationGateAlert } from './RetreatRegistrationGateAlert'

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

function renderGate(code: 'closed' | 'window' | 'quyen' | null) {
  return render(
    <MantineProvider theme={theme} defaultColorScheme="light">
      <RetreatRegistrationGateAlert gateCode={code} />
    </MantineProvider>,
  )
}

describe('RetreatRegistrationGateAlert', () => {
  it('shows closed message when retreat is not open', () => {
    renderGate('closed')
    expect(screen.getByText(m.registration_gate_closed())).toBeTruthy()
  })

  it('shows window message when outside registration window', () => {
    renderGate('window')
    expect(screen.getByText(m.registration_gate_window())).toBeTruthy()
  })

  it('shows quyen message when self registration is not allowed', () => {
    renderGate('quyen')
    expect(screen.getByText(m.registration_gate_quyen())).toBeTruthy()
  })

  it('renders nothing when gate is open', () => {
    renderGate(null)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
