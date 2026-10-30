import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { m } from '#/paraglide/messages'
import { theme } from '../../theme'
import { FillerSaveConfirmModal } from './FillerSaveConfirmModal'

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

function renderModal(
  props: Partial<React.ComponentProps<typeof FillerSaveConfirmModal>> = {},
) {
  const onCancel = vi.fn()
  const onConfirm = vi.fn()
  render(
    <MantineProvider theme={theme} defaultColorScheme="light">
      <FillerSaveConfirmModal
        opened
        loading={false}
        onCancel={onCancel}
        onConfirm={onConfirm}
        {...props}
      />
    </MantineProvider>,
  )
  return { onCancel, onConfirm }
}

describe('FillerSaveConfirmModal', () => {
  it('shows title and body copy', () => {
    renderModal()
    expect(screen.getByText(m.filler_save_confirm_title())).toBeTruthy()
    expect(screen.getByText(m.filler_save_confirm_body())).toBeTruthy()
  })

  it('calls onCancel when cancel is clicked', async () => {
    const user = userEvent.setup()
    const { onCancel } = renderModal()
    await user.click(
      screen.getByRole('button', { name: m.filler_save_confirm_cancel() }),
    )
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls onConfirm when confirm is clicked', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderModal()
    await user.click(
      screen.getByRole('button', { name: m.filler_save_confirm_ok() }),
    )
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('disables cancel while loading', () => {
    renderModal({ loading: true })
    expect(
      screen.getByRole('button', { name: m.filler_save_confirm_cancel() }),
    ).toBeDisabled()
  })
})
