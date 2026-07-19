import { MantineProvider } from '@mantine/core'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { m } from '#/paraglide/messages'
import { theme } from '../../theme'
import { AdminShell } from './AdminShell'

const signOutMock = vi.fn()

vi.mock('#/auth/useAuth', () => ({
  useAuth: () => ({ signOut: signOutMock }),
}))

vi.mock('#/auth/useAdminClaim', () => ({
  useAdminClaim: () => ({ status: 'admin', uid: 'admin-uid' }),
}))

vi.mock('#/use-cases/ensurePublicInvite', () => ({
  ensurePublicInvite: vi.fn(async () => ({
    id: 'public',
    token: 'public',
    createdBy: 'admin-uid',
    createdAt: '2026-07-19T00:00:00.000Z',
  })),
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

function renderShell(initialPath = '/admin/temples') {
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
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })
  return render(<RouterProvider router={router} />)
}

describe('AdminShell', () => {
  it('renders nav link text from Paraglide', async () => {
    renderShell()
    const nav = await screen.findByRole('navigation')
    expect(within(nav).getByText(m.admin_nav_temples())).toBeTruthy()
    expect(within(nav).getByText(m.admin_nav_tang())).toBeTruthy()
    expect(within(nav).getByText(m.admin_nav_ni())).toBeTruthy()
    expect(within(nav).getByText(m.admin_nav_org_units())).toBeTruthy()
  })

  it('renders breadcrumbs for the current path', async () => {
    renderShell('/admin/temples')
    const header = await screen.findByRole('banner')
    expect(header.parentElement?.getAttribute('data-layout')).toBe('alt')
    expect(within(header).getByText(m.admin_title())).toBeTruthy()
    expect(within(header).getByText(m.admin_nav_temples())).toBeTruthy()
  })

  it('renders copy form link next to notifications', async () => {
    renderShell('/admin/temples')
    const header = await screen.findByRole('banner')
    expect(
      within(header).getByRole('button', { name: m.admin_copy_form_link() }),
    ).toBeTruthy()
    expect(
      within(header).getByRole('button', { name: m.admin_notifications_aria() }),
    ).toBeTruthy()
  })

  it('opens empty notifications popover', async () => {
    const user = userEvent.setup()
    renderShell()
    await user.click(
      await screen.findByRole('button', { name: m.admin_notifications_aria() }),
    )
    expect(await screen.findByText(m.admin_notifications_empty())).toBeTruthy()
  })
})
