import { MantineProvider } from '@mantine/core'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { m } from '#/paraglide/messages'
import { theme } from '../../theme'
import { AdminShell } from './AdminShell'

const signOutMock = vi.fn()

vi.mock('#/auth/useAuth', () => ({
  useAuth: () => ({ signOut: signOutMock }),
}))

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

function renderShell() {
  const rootRoute = createRootRoute({
    component: () => (
      <MantineProvider theme={theme} defaultColorScheme="light">
        <AdminShell>
          <div>child</div>
        </AdminShell>
      </MantineProvider>
    ),
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/admin/invites'] }),
  })
  return render(<RouterProvider router={router} />)
}

describe('AdminShell', () => {
  it('renders nav link text from Paraglide', async () => {
    renderShell()
    expect(await screen.findByText(m.admin_nav_invites())).toBeTruthy()
    expect(screen.getByText(m.admin_nav_temples())).toBeTruthy()
    expect(screen.getByText(m.admin_nav_tang())).toBeTruthy()
    expect(screen.getByText(m.admin_nav_ni())).toBeTruthy()
    expect(screen.getByText(m.admin_nav_org_units())).toBeTruthy()
  })
})
