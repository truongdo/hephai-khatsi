import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Temple } from '#/domain/types'
import { m } from '#/paraglide/messages'
import { saveTempleDraft } from '#/use-cases/saveTempleDraft'
import { theme } from '../../theme'
import { TempleEditorForm } from './TempleEditorForm'

vi.mock('#/use-cases/saveTempleDraft', () => ({
  saveTempleDraft: vi.fn(),
}))

vi.mock('#/data/vietnam-locations', () => ({
  cities: [
    {
      code: '01',
      name: 'Hà Nội',
      fullName: 'Thành phố Hà Nội',
      slug: 'ha-noi',
      type: 'city',
    },
  ],
  getWards: vi.fn(async () => [
    {
      code: '00013',
      name: 'Hà Đông',
      fullName: 'Phường Hà Đông, Thành phố Hà Nội',
      slug: 'ha-dong',
      type: 'ward',
    },
  ]),
}))

const saveTempleDraftMock = vi.mocked(saveTempleDraft)

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

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  saveTempleDraftMock.mockReset()
})

function renderForm(
  props: Partial<React.ComponentProps<typeof TempleEditorForm>> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const onCreated = vi.fn()
  const result = render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <TempleEditorForm
          title={m.filler_editor_title_temple_new()}
          token="invite-token"
          orgUnitId="gd-i"
          initial={{ seedPhone: '0901234567' }}
          status="draft"
          onCreated={onCreated}
          {...props}
        />
      </MantineProvider>
    </QueryClientProvider>,
  )
  return { ...result, onCreated }
}

function temple(overrides: Partial<Temple> = {}): Temple {
  return {
    id: 't1',
    orgUnitId: 'gd-i',
    status: 'draft',
    managerPhones: [],
    inviteId: 'invite-1',
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    ...overrides,
  }
}

describe('TempleEditorForm', () => {
  it('renders temple section headings and danh hieu field', () => {
    renderForm()

    expect(
      screen.getByRole('heading', { name: m.filler_section_temple_identity() }),
    ).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: m.filler_section_temple_address() }),
    ).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: m.filler_section_temple_tru_tri() }),
    ).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: m.filler_section_temple_ban_qt() }),
    ).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: m.filler_section_temple_tang_so() }),
    ).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: m.filler_section_temple_hoat_dong() }),
    ).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: m.filler_section_temple_quyet_dinh() }),
    ).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: m.filler_section_temple_xay_dung() }),
    ).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: m.filler_section_temple_dat() }),
    ).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: m.filler_section_temple_phones() }),
    ).toBeTruthy()
    expect(screen.getByLabelText(m.filler_field_danh_hieu())).toBeTruthy()
  })

  it('calls saveTempleDraft with patch and navigates on create', async () => {
    const user = userEvent.setup()
    saveTempleDraftMock.mockResolvedValue({
      temple: temple({ id: 'created-temple' }),
      mode: 'created',
    })
    const { onCreated } = renderForm()

    await user.type(
      screen.getByLabelText(m.filler_field_danh_hieu()),
      'Tịnh xá Ngọc Viên',
    )
    await user.type(
      screen.getByLabelText(m.filler_field_manager_phone()),
      '0912345678',
    )
    await user.click(screen.getByRole('button', { name: m.filler_save() }))

    expect(saveTempleDraftMock).toHaveBeenCalledWith({
      token: 'invite-token',
      orgUnitId: 'gd-i',
      templeId: undefined,
      patch: expect.objectContaining({
        danhHieu: 'Tịnh xá Ngọc Viên',
        truTriHienNay: expect.objectContaining({ dienThoai: '0901234567' }),
      }),
      explicitPhones: ['0912345678'],
    })
    expect(onCreated).toHaveBeenCalledWith('created-temple')
  })

  it('blocks save when address line is set without city and ward', async () => {
    const user = userEvent.setup()
    renderForm()

    const lineInputs = screen.getAllByRole('textbox', {
      name: m.filler_field_address_line(),
    })
    await user.type(lineInputs[0]!, '15 Ngõ 4')
    await user.click(screen.getByRole('button', { name: m.filler_save() }))

    expect(saveTempleDraftMock).not.toHaveBeenCalled()
    expect(screen.getByText(m.filler_address_city_required())).toBeTruthy()
  })

  it('saves structured diaChiMoi from hydrated address', async () => {
    const user = userEvent.setup()
    saveTempleDraftMock.mockResolvedValue({
      temple: temple({ id: 'created-temple' }),
      mode: 'created',
    })
    renderForm({
      initial: {
        seedPhone: '0901234567',
        diaChiMoi: {
          cityCode: '01',
          cityName: 'Hà Nội',
          wardCode: '00013',
          wardName: 'Hà Đông',
          line: '15 Ngõ 4',
        },
      },
    })

    await user.click(screen.getByRole('button', { name: m.filler_save() }))

    expect(saveTempleDraftMock).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: expect.objectContaining({
          diaChiMoi: {
            cityCode: '01',
            cityName: 'Hà Nội',
            wardCode: '00013',
            wardName: 'Hà Đông',
            line: '15 Ngõ 4',
          },
        }),
      }),
    )
  })

  it('hydrates legacy string address into line field', () => {
    renderForm({
      initial: {
        seedPhone: '0901234567',
        diaChiCu: '123 Đường Láng' as unknown as Temple['diaChiCu'],
      },
    })
    expect(screen.getByDisplayValue('123 Đường Láng')).toBeTruthy()
  })

  it('hides Save and disables fields when status is view', () => {
    renderForm({ status: 'view' })

    expect(screen.queryByRole('button', { name: m.filler_save() })).toBeNull()
    expect(screen.getByLabelText(m.filler_field_danh_hieu())).toBeDisabled()
  })
})
