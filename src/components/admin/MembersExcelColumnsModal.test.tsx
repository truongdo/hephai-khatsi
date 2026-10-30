import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { defaultMembersExcelColumnIds } from '#/domain/memberExcelColumns'
import { m } from '#/paraglide/messages'
import { theme } from '../../theme'
import { MembersExcelColumnsModal } from './MembersExcelColumnsModal'

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

function renderModal(overrides: Partial<React.ComponentProps<typeof MembersExcelColumnsModal>> = {}) {
  const onColumnIdsChange = vi.fn()
  const onConfirm = vi.fn()
  const onClose = vi.fn()
  render(
    <MantineProvider theme={theme}>
      <MembersExcelColumnsModal
        opened
        onClose={onClose}
        sanghaType="tang"
        columnIds={defaultMembersExcelColumnIds('tang')}
        onColumnIdsChange={onColumnIdsChange}
        onConfirm={onConfirm}
        {...overrides}
      />
    </MantineProvider>,
  )
  return { onColumnIdsChange, onConfirm, onClose }
}

describe('MembersExcelColumnsModal', () => {
  it('shows catalog checkboxes and disables confirm when none selected', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderModal({ columnIds: [] })
    expect(screen.getByRole('dialog', { name: m.admin_members_export_columns_title() })).toBeTruthy()
    const confirm = screen.getByRole('button', { name: m.admin_members_export_confirm() })
    expect(confirm).toBeDisabled()
    await user.click(confirm)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('hides ni precepts on tang and select-all checks visible columns', async () => {
    const user = userEvent.setup()
    const { onColumnIdsChange } = renderModal({ columnIds: [] })
    expect(screen.queryByRole('checkbox', { name: /Tỳ-kheo-ni/i })).toBeNull()
    await user.click(screen.getByRole('button', { name: m.admin_members_export_select_all() }))
    const ids: string[] = onColumnIdsChange.mock.calls.at(-1)?.[0]
    expect(ids).toContain('gioiTyKheo_ngayGh')
    expect(ids).not.toContain('gioiTyKheoNi_ngayGh')
  })
})
