import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Temple } from '#/domain/types'
import { m } from '#/paraglide/messages'
import { saveTempleDraft } from '#/use-cases/saveTempleDraft'
import { uploadTemplePhoto } from '#/use-cases/uploadTemplePhoto'
import { theme } from '../../theme'
import { TempleEditorForm } from './TempleEditorForm'

vi.mock('#/use-cases/saveTempleDraft', () => ({
  saveTempleDraft: vi.fn(),
}))

vi.mock('#/use-cases/uploadTemplePhoto', () => ({
  uploadTemplePhoto: vi.fn(async () => ({
    photoPath: 'temples/created-temple/photo.jpg',
  })),
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
const uploadTemplePhotoMock = vi.mocked(uploadTemplePhoto)

function getPortraitFileInput(): HTMLInputElement {
  const button = screen.getByRole('button', { name: m.filler_photo_choose() })
  return button.parentElement?.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement
}

const completeAddress = {
  cityCode: '01',
  cityName: 'Hà Nội',
  wardCode: '00013',
  wardName: 'Hà Đông',
  line: '15 Ngõ 4',
}

function requiredTempleInitial(
  overrides: Partial<Temple> & { seedPhone?: string } = {},
): Partial<Temple> & { seedPhone?: string } {
  return {
    seedPhone: '0901234567',
    danhHieu: 'Tịnh xá Ngọc Viên',
    nguoiKhaiSon: 'HT. Minh',
    namThanhLap: '1954',
    diaChiCu: completeAddress,
    diaChiMoi: completeAddress,
    truTriHienNay: {
      phapDanh: 'Thích A',
      dienThoai: '0901234567',
      email: 'a@b.co',
    },
    truTriTienNhiem: [{ phapDanh: 'Thích B' }],
    tangSoHienTru: { tyKheo: 0, thucXoaMaNa: 0, saDi: 0, tapSu: 0 },
    soPhatTuQuyY: 0,
    soPhatTuThuongXuyen: 0,
    ...overrides,
  }
}

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

  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  saveTempleDraftMock.mockReset()
  uploadTemplePhotoMock.mockReset()
  uploadTemplePhotoMock.mockResolvedValue({
    photoPath: 'temples/created-temple/photo.jpg',
  })
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
    photoPath: null,
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
    expect(
      screen.getByLabelText(new RegExp(`^${m.filler_field_danh_hieu()}`)),
    ).toBeTruthy()
  })

  it('calls saveTempleDraft with patch and navigates on create', async () => {
    const user = userEvent.setup()
    saveTempleDraftMock.mockResolvedValue({
      temple: temple({ id: 'created-temple' }),
      mode: 'created',
    })
    const { onCreated } = renderForm({
      initial: requiredTempleInitial(),
    })

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
    expect(uploadTemplePhotoMock).not.toHaveBeenCalled()
  })

  it('uploads pending portrait after successful create', async () => {
    const user = userEvent.setup()
    let resolveUpload!: (value: { photoPath: string }) => void
    const uploadPromise = new Promise<{ photoPath: string }>((resolve) => {
      resolveUpload = resolve
    })
    uploadTemplePhotoMock.mockReturnValue(uploadPromise)
    saveTempleDraftMock.mockResolvedValue({
      temple: temple({ id: 'created-temple' }),
      mode: 'created',
    })
    const { onCreated } = renderForm({
      initial: requiredTempleInitial(),
    })
    const file = new File(['jpeg'], 'portrait.jpg', { type: 'image/jpeg' })

    await user.upload(getPortraitFileInput(), file)
    await user.click(screen.getByRole('button', { name: m.filler_save() }))

    expect(saveTempleDraftMock).toHaveBeenCalled()
    expect(uploadTemplePhotoMock).toHaveBeenCalledWith({
      templeId: 'created-temple',
      bytes: expect.any(Uint8Array),
      contentType: 'image/jpeg',
      inviteToken: 'invite-token',
    })
    expect(onCreated).not.toHaveBeenCalled()

    resolveUpload({ photoPath: 'temples/created-temple/photo.jpg' })
    await vi.waitFor(() =>
      expect(onCreated).toHaveBeenCalledWith('created-temple'),
    )
  })

  it('blocks save when required temple fields are empty', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('button', { name: m.filler_save() }))
    expect(saveTempleDraftMock).not.toHaveBeenCalled()
    expect(
      screen.getAllByText(m.filler_error_field_required()).length,
    ).toBeGreaterThan(0)
  })

  it('blocks save when address line is set without city and ward', async () => {
    const user = userEvent.setup()
    renderForm({
      initial: requiredTempleInitial({
        diaChiCu: {
          cityCode: '',
          cityName: '',
          wardCode: '',
          wardName: '',
          line: '15 Ngõ 4',
        } as unknown as Temple['diaChiCu'],
      }),
    })

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
      initial: requiredTempleInitial({
        diaChiMoi: {
          cityCode: '01',
          cityName: 'Hà Nội',
          wardCode: '00013',
          wardName: 'Hà Đông',
          line: '15 Ngõ 4',
        },
      }),
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
    expect(
      screen.getByLabelText(new RegExp(`^${m.filler_field_danh_hieu()}`)),
    ).toBeDisabled()
  })
})
