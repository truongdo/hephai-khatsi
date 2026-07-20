import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { ORG_UNIT_SEED } from '#/domain/orgUnitSeed'
import { m } from '#/paraglide/messages'
import { theme } from '../../theme'
import { FillerEntryForm } from './FillerEntryForm'

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

function renderForm(
  props: Partial<React.ComponentProps<typeof FillerEntryForm>> = {},
) {
  const onSubmit = vi.fn()
  const result = render(
    <MantineProvider theme={theme} defaultColorScheme="light">
      <FillerEntryForm
        orgUnits={ORG_UNIT_SEED}
        onSubmit={onSubmit}
        {...props}
      />
    </MantineProvider>,
  )
  return { ...result, onSubmit }
}

async function pickFormType(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole('radio', { name: label }))
}

async function pickOrgUnit(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  const select = screen.getByRole('combobox', { name: m.filler_org_label() })
  await user.click(select)
  await user.click(await screen.findByText(name))
}

describe('FillerEntryForm', () => {
  it('renders type radios, org select, phone, and continue — no CCCD', () => {
    renderForm()
    expect(screen.getByRole('heading', { name: m.filler_entry_title() })).toBeTruthy()
    expect(screen.getByRole('radio', { name: m.filler_type_tang() })).toBeTruthy()
    expect(screen.getByRole('radio', { name: m.filler_type_ni() })).toBeTruthy()
    expect(screen.getByRole('radio', { name: m.filler_type_temple() })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: m.filler_org_label() })).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: m.filler_cccd_label() })).toBeNull()
    expect(screen.getByRole('textbox', { name: m.filler_phone_label() })).toBeTruthy()
    expect(screen.getByRole('button', { name: m.filler_continue() })).toBeTruthy()
    expect(screen.queryByText(m.filler_identity_helper())).toBeNull()
  })

  it('shows type required error and does not call onSubmit without type', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()

    await user.click(screen.getByRole('button', { name: m.filler_continue() }))

    expect(await screen.findByText(m.filler_error_type_required())).toBeTruthy()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows member phone description after selecting tang', async () => {
    const user = userEvent.setup()
    renderForm()
    await pickFormType(user, m.filler_type_tang())
    expect(screen.getByText(m.filler_phone_description_member())).toBeTruthy()
  })

  it('submits member_tang with org and phone', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()

    await pickFormType(user, m.filler_type_tang())
    await pickOrgUnit(user, 'Giáo đoàn I')
    await user.type(
      screen.getByRole('textbox', { name: m.filler_phone_label() }),
      '0901234567',
    )
    await user.click(screen.getByRole('button', { name: m.filler_continue() }))

    expect(onSubmit).toHaveBeenCalledWith({
      formType: 'member_tang',
      orgUnitId: 'gd-i',
      phone: '0901234567',
    })
  })

  it('submits temple with org and phone', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()

    await pickFormType(user, m.filler_type_temple())
    await pickOrgUnit(user, 'Giáo đoàn I')
    await user.type(
      screen.getByRole('textbox', { name: m.filler_phone_label() }),
      '0901234567',
    )
    await user.click(screen.getByRole('button', { name: m.filler_continue() }))

    expect(onSubmit).toHaveBeenCalledWith({
      formType: 'temple',
      orgUnitId: 'gd-i',
      phone: '0901234567',
    })
  })

  it('shows temple pick list and create temple when matches provided', () => {
    renderForm({
      templeMatches: [
        { id: 't1', label: 'Tịnh xá A' },
        { id: 't2', label: 'Tịnh xá B' },
      ],
      onPickTemple: vi.fn(),
      onCreateTemple: vi.fn(),
    })

    expect(screen.getByText(m.filler_identity_pick_temple())).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tịnh xá A' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tịnh xá B' })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: m.filler_identity_create_temple() }),
    ).toBeTruthy()
  })

  it('shows member pick list and create member when matches provided', () => {
    renderForm({
      memberMatches: [
        { id: 'm1', label: 'Minh Tam' },
        { id: 'm2', label: 'Minh Tam 2' },
      ],
      onPickMember: vi.fn(),
      onCreateMember: vi.fn(),
    })

    expect(screen.getByText(m.filler_identity_pick_member())).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Minh Tam' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Minh Tam 2' })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: m.filler_identity_create_member() }),
    ).toBeTruthy()
  })
})
