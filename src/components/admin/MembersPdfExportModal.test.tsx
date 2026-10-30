import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { m } from '#/paraglide/messages'
import { theme } from '../../theme'
import { MembersPdfExportModal } from './MembersPdfExportModal'

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

function renderModal(
  overrides: Partial<React.ComponentProps<typeof MembersPdfExportModal>> = {},
) {
  const onConfirm = vi.fn()
  const onClose = vi.fn()
  render(
    <MantineProvider theme={theme}>
      <MembersPdfExportModal
        opened
        onClose={onClose}
        selectedCount={0}
        progress={null}
        loading={false}
        onConfirm={onConfirm}
        {...overrides}
      />
    </MantineProvider>,
  )
  return { onConfirm, onClose }
}

describe('MembersPdfExportModal', () => {
  it('defaults source to filter when selectedCount is 0', () => {
    renderModal({ selectedCount: 0 })
    expect(
      screen.getByRole('radio', {
        name: m.admin_members_export_pdf_source_filter(),
        checked: true,
      }),
    ).toBeTruthy()
  })

  it('defaults source to selected when selectedCount > 0', () => {
    renderModal({ selectedCount: 2 })
    expect(
      screen.getByRole('radio', {
        name: m.admin_members_export_pdf_source_selected(),
        checked: true,
      }),
    ).toBeTruthy()
  })

  it('disables confirm when selected source and zero selection', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderModal({ selectedCount: 0 })
    const selectedRadio = screen.getByRole('radio', {
      name: m.admin_members_export_pdf_source_selected_disabled(),
    })
    await user.click(selectedRadio)
    const confirm = screen.getByRole('button', {
      name: m.admin_members_export_pdf_confirm(),
    })
    expect(confirm).toBeDisabled()
    await user.click(confirm)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
