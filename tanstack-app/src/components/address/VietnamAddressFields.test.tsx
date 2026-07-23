import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_ADDRESS_DRAFT } from '#/domain/address'
import { m } from '#/paraglide/messages'
import { theme } from '../../theme'
import { VietnamAddressFields } from './VietnamAddressFields'

vi.mock('#/data/vietnam-locations', () => ({
  cities: [
    {
      code: '01',
      name: 'Hà Nội',
      fullName: 'Thành phố Hà Nội',
      slug: 'ha-noi',
      type: 'city',
    },
    {
      code: '48',
      name: 'Đà Nẵng',
      fullName: 'Thành phố Đà Nẵng',
      slug: 'da-nang',
      type: 'city',
    },
  ],
  getWards: vi.fn(async (cityCode: string) => {
    if (cityCode === '01') {
      return [
        {
          code: '00013',
          name: 'Hà Đông',
          fullName: 'Phường Hà Đông, Thành phố Hà Nội',
          slug: 'ha-dong',
          type: 'ward',
        },
      ]
    }
    return []
  }),
}))

import { getWards } from '#/data/vietnam-locations'

const getWardsMock = vi.mocked(getWards)

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver =
    ResizeObserverMock as unknown as typeof ResizeObserver

  Element.prototype.scrollIntoView = vi.fn()

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

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  getWardsMock.mockClear()
})

function renderFields(
  props: Partial<React.ComponentProps<typeof VietnamAddressFields>> = {},
) {
  const onChange = vi.fn()
  const result = render(
    <MantineProvider theme={theme} defaultColorScheme="light">
      <VietnamAddressFields
        label="Địa chỉ cũ"
        value={EMPTY_ADDRESS_DRAFT}
        onChange={onChange}
        {...props}
      />
    </MantineProvider>,
  )
  return { ...result, onChange }
}

describe('VietnamAddressFields', () => {
  it('renders city, ward, and line fields', () => {
    renderFields()
    expect(
      screen.getByRole('combobox', { name: m.filler_field_city() }),
    ).toBeTruthy()
    expect(
      screen.getByRole('combobox', { name: m.filler_field_ward() }),
    ).toBeTruthy()
    expect(
      screen.getByRole('textbox', { name: m.filler_field_address_line() }),
    ).toBeTruthy()
  })

  it('disables ward until city is selected', () => {
    renderFields()
    expect(
      screen.getByRole('combobox', { name: m.filler_field_ward() }),
    ).toBeDisabled()
  })

  it('loads wards when city is present in value', async () => {
    renderFields({
      value: {
        cityCode: '01',
        cityName: 'Hà Nội',
        wardCode: '',
        wardName: '',
        line: '',
      },
    })

    await waitFor(() => expect(getWardsMock).toHaveBeenCalledWith('01'))
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: m.filler_field_ward() }),
      ).not.toBeDisabled(),
    )
  })

  it('clears ward when city selection changes', async () => {
    const user = userEvent.setup()
    const { onChange } = renderFields({
      value: {
        cityCode: '01',
        cityName: 'Hà Nội',
        wardCode: '00013',
        wardName: 'Hà Đông',
        line: '',
      },
    })

    await waitFor(() => expect(getWardsMock).toHaveBeenCalledWith('01'))

    const cityInput = screen.getByRole('combobox', {
      name: m.filler_field_city(),
    })
    await user.click(cityInput)
    await user.clear(cityInput)
    await user.type(cityInput, 'Đà Nẵng')
    await user.click(await screen.findByText('Thành phố Đà Nẵng'))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        cityCode: '48',
        cityName: 'Đà Nẵng',
        wardCode: '',
        wardName: '',
      }),
    )
  })

  it('updates line via onChange', async () => {
    const user = userEvent.setup()
    const { onChange } = renderFields()

    await user.type(
      screen.getByRole('textbox', { name: m.filler_field_address_line() }),
      '15',
    )

    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ line: expect.stringContaining('5') }),
    )
  })

  it('shows field errors', () => {
    renderFields({
      errors: {
        city: m.filler_address_city_required(),
        ward: m.filler_address_ward_required(),
      },
    })
    expect(screen.getByText(m.filler_address_city_required())).toBeTruthy()
    expect(screen.getByText(m.filler_address_ward_required())).toBeTruthy()
  })

  it('uses custom linePlaceholder when provided', () => {
    renderFields({ linePlaceholder: 'vd: Tịnh xá …' })
    expect(screen.getByPlaceholderText('vd: Tịnh xá …')).toBeTruthy()
  })

  it('marks city and ward required when required prop is set', () => {
    renderFields({ required: true })
    expect(
      screen.getByRole('combobox', { name: m.filler_field_city() }),
    ).toBeRequired()
    expect(
      screen.getByRole('combobox', { name: m.filler_field_ward() }),
    ).toBeRequired()
    expect(
      screen.getByRole('textbox', { name: m.filler_field_address_line() }),
    ).not.toBeRequired()
  })
})
