import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { m } from '#/paraglide/messages'
import { theme } from '../../theme'
import { RetreatRegistrationEntry } from './RetreatRegistrationEntry'

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

function renderEntry(
  props: Partial<React.ComponentProps<typeof RetreatRegistrationEntry>> = {},
) {
  const onSubmit = vi.fn()
  const result = render(
    <MantineProvider theme={theme} defaultColorScheme="light">
      <RetreatRegistrationEntry
        retreatName="Khóa tu mùa hè"
        orgUnitName="Giáo đoàn I"
        pending={false}
        onSubmit={onSubmit}
        {...props}
      />
    </MantineProvider>,
  )
  return { ...result, onSubmit }
}

describe('RetreatRegistrationEntry', () => {
  it('renders retreat name, locked org, phone, and continue without sangha radios', () => {
    renderEntry()
    expect(
      screen.getByRole('heading', { name: m.registration_entry_title() }),
    ).toBeTruthy()
    expect(screen.getByText('Khóa tu mùa hè')).toBeTruthy()
    expect(screen.getByText('Giáo đoàn I')).toBeTruthy()
    expect(screen.queryByRole('radio', { name: m.filler_type_tang() })).toBeNull()
    expect(screen.queryByRole('radio', { name: m.filler_type_ni() })).toBeNull()
    expect(screen.getByRole('textbox', { name: m.filler_phone_label() })).toBeTruthy()
    expect(screen.getByRole('button', { name: m.filler_continue() })).toBeTruthy()
  })

  it('submits phone only', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEntry()

    await user.type(
      screen.getByRole('textbox', { name: m.filler_phone_label() }),
      '0901234567',
    )
    await user.click(screen.getByRole('button', { name: m.filler_continue() }))

    expect(onSubmit).toHaveBeenCalledWith({
      phone: '0901234567',
    })
  })

  it('shows member pick list when matches provided', () => {
    renderEntry({
      memberMatches: [
        { id: 'm1', label: 'Minh Tam' },
        { id: 'm2', label: 'Minh Tam 2' },
      ],
      onPickMember: vi.fn(),
      onCreateMember: vi.fn(),
    })

    expect(screen.getByText(m.filler_identity_pick_member())).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Minh Tam' })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: m.filler_identity_create_member() }),
    ).toBeTruthy()
  })
})
