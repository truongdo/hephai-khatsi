import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { m } from '#/paraglide/messages'
import { theme } from '../../theme'
import { AdminCopyFormLinkButton } from './AdminCopyFormLinkButton'

const ensureMock = vi.fn(async () => ({
  id: 'public',
  token: 'public',
  createdBy: 'admin-uid',
  createdAt: '2026-07-19T00:00:00.000Z',
}))

vi.mock('#/use-cases/ensurePublicInvite', () => ({
  ensurePublicInvite: (...args: unknown[]) => ensureMock(...args),
}))

vi.mock('#/auth/useAdminClaim', () => ({
  useAdminClaim: () => ({ status: 'admin', uid: 'admin-uid' }),
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

beforeEach(() => {
  ensureMock.mockClear()
})

function renderButton() {
  return render(
    <MantineProvider theme={theme} defaultColorScheme="light">
      <AdminCopyFormLinkButton />
    </MantineProvider>,
  )
}

describe('AdminCopyFormLinkButton', () => {
  it('ensures invite and copies /f/public URL', async () => {
    const user = userEvent.setup()
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue(undefined)
    renderButton()
    await user.click(
      screen.getByRole('button', { name: m.admin_copy_form_link() }),
    )
    expect(ensureMock).toHaveBeenCalledWith({ createdBy: 'admin-uid' })
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/f/public`,
    )
    expect(await screen.findByText(m.admin_copy_form_link_copied())).toBeTruthy()
    writeText.mockRestore()
  })

  it('shows warning when clipboard fails', async () => {
    const user = userEvent.setup()
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockRejectedValueOnce(new Error('denied'))
    renderButton()
    await user.click(
      screen.getByRole('button', { name: m.admin_copy_form_link() }),
    )
    expect(await screen.findByText(m.admin_copy_form_link_failed())).toBeTruthy()
    writeText.mockRestore()
  })
})
