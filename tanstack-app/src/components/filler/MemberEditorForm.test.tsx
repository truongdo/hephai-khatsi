import { MantineProvider } from '@mantine/core'
import { DatesProvider } from '@mantine/dates'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import 'dayjs/locale/vi'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Member } from '#/domain/types'
import { m } from '#/paraglide/messages'
import { saveAndLockMember } from '#/use-cases/saveAndLockMember'
import { requestMemberEdit } from '#/use-cases/requestMemberEdit'
import { uploadMemberPhoto } from '#/use-cases/uploadMemberPhoto'
import { uploadMemberDocument } from '#/use-cases/uploadMemberDocument'
import { theme } from '../../theme'
import { documentTypeLabel } from './memberDocumentLabels'
import { MemberEditorForm } from './MemberEditorForm'

dayjs.extend(customParseFormat)
dayjs.locale('vi')

vi.mock('#/use-cases/saveAndLockMember', () => ({
  saveAndLockMember: vi.fn(),
}))

vi.mock('#/use-cases/requestMemberEdit', () => ({
  requestMemberEdit: vi.fn(),
}))

vi.mock('#/use-cases/uploadMemberPhoto', () => ({
  uploadMemberPhoto: vi.fn(async () => ({
    photoPath: 'members/created-member/photo.jpg',
  })),
}))

vi.mock('#/use-cases/uploadMemberDocument', () => ({
  uploadMemberDocument: vi.fn(async () => ({
    filePath: 'members/created-member/docs/diep_sa_di/file.pdf',
    documents: {
      diep_sa_di: { filePath: 'members/created-member/docs/diep_sa_di/file.pdf' },
    },
  })),
}))

vi.mock('#/query/fillerQueries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#/query/fillerQueries')>()
  return {
    ...actual,
    fillerOrgUnitsQuery: () => ({
      queryKey: ['filler', 'orgUnits'],
      queryFn: async () => [
        {
          id: 'gd-i',
          code: 'gd-i',
          name: 'Giáo đoàn I',
          kind: 'giao_doan' as const,
          order: 1,
          allowsTang: true,
          allowsNi: true,
        },
        {
          id: 'ni-gioi',
          code: 'ni-gioi',
          name: 'Ni giới Hệ phái Khất sĩ',
          kind: 'ni_gioi' as const,
          order: 7,
          allowsTang: false,
          allowsNi: true,
        },
      ],
      staleTime: 0,
    }),
  }
})

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

const saveAndLockMemberMock = vi.mocked(saveAndLockMember)
const requestMemberEditMock = vi.mocked(requestMemberEdit)
const uploadMemberPhotoMock = vi.mocked(uploadMemberPhoto)
const uploadMemberDocumentMock = vi.mocked(uploadMemberDocument)

function getPortraitFileInput(): HTMLInputElement {
  const choose = screen.queryByRole('button', { name: m.filler_photo_choose() })
  const change = screen.queryByRole('button', { name: m.filler_photo_change() })
  const button = choose ?? change
  if (!button) {
    throw new Error('Portrait file button not found')
  }
  return button.parentElement?.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement
}

async function pickPendingDocType(
  user: ReturnType<typeof userEvent.setup>,
) {
  const select = screen.getByRole('combobox', {
    name: m.filler_doc_select_label(),
  })
  await user.click(select)
  await user.click(await screen.findByText(documentTypeLabel('diep_sa_di')))
}

function getDocumentFileInput(): HTMLInputElement {
  const portrait = getPortraitFileInput()
  const inputs = Array.from(
    document.querySelectorAll('input[type="file"]'),
  ) as HTMLInputElement[]
  const docs = inputs.filter((input) => input !== portrait)
  return docs[docs.length - 1]!
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

beforeEach(() => {
  saveAndLockMemberMock.mockReset()
  requestMemberEditMock.mockReset()
  uploadMemberPhotoMock.mockReset()
  uploadMemberDocumentMock.mockReset()
  uploadMemberPhotoMock.mockResolvedValue({
    photoPath: 'members/created-member/photo.jpg',
  })
  uploadMemberDocumentMock.mockResolvedValue({
    filePath: 'members/created-member/docs/diep_sa_di/file.pdf',
    documents: {
      diep_sa_di: { filePath: 'members/created-member/docs/diep_sa_di/file.pdf' },
    },
  })
  localStorage.clear()
})

async function confirmSave(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: m.filler_save() }))
  await user.click(
    await screen.findByRole('button', { name: m.filler_save_confirm_ok() }),
  )
}

function renderForm(
  props: Partial<React.ComponentProps<typeof MemberEditorForm>> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const onCreated = vi.fn()
  const result = render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <DatesProvider settings={{ locale: 'vi', firstDayOfWeek: 1 }}>
          <MemberEditorForm
            title={m.filler_editor_title_member_new()}
            token="invite-token"
            orgUnitId="gd-i"
            sanghaType="tang"
            initial={{}}
            status="draft"
            onCreated={onCreated}
            {...props}
          />
        </DatesProvider>
      </MantineProvider>
    </QueryClientProvider>,
  )
  return { ...result, onCreated }
}

function member(overrides: Partial<Member> = {}): Member {
  return {
    id: 'm1',
    orgUnitId: 'gd-i',
    sanghaType: 'tang',
    status: 'locked',
    cccd: '012345678901',
    inviteId: 'invite-1',
    currentTempleId: null,
    photoPath: null,
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    editRequestedAt: null,
    editRequestedBy: null,
    ...overrides,
  }
}

const completeAddress = {
  cityCode: '01',
  cityName: 'Hà Nội',
  wardCode: '00013',
  wardName: 'Hà Đông',
} as const

const completeFamily = {
  cha: { hoTen: 'A', namSinh: '1960', ngheNghiep: 'X', noiO: 'Y' },
  me: { hoTen: 'B', namSinh: '1962', ngheNghiep: 'Z', noiO: 'Y' },
} as const

const requiredCoreBase = {
  theDanh: 'Nguyễn Văn A',
  phapDanh: 'Minh Tâm',
  ngaySinh: '1990-01-01',
  ngayXuatGia: '2010-01-01',
  dienThoai: '0901234567',
  email: 'a@b.co',
  hienTuHoc: 'Tịnh xá X',
  bonSu: 'TT. Minh',
  noiSinh: { ...completeAddress },
  diaChiThuongTru: { ...completeAddress },
  noiXuatGia: { ...completeAddress, line: 'Tịnh xá A' },
  giaDinh: completeFamily,
}

const requiredCoreInitial = {
  ...requiredCoreBase,
  photoPath: 'members/m1/photo.jpg',
  documents: {
    cccd: {
      frontPath: 'members/m1/docs/cccd/front.jpg',
      backPath: 'members/m1/docs/cccd/back.jpg',
    },
  },
}

describe('MemberEditorForm', () => {
  it('renders identity section and locked CCCD', () => {
    renderForm({
      sanghaType: 'tang',
      cccd: '012345678901',
      memberId: 'm1',
    })

    expect(
      screen.getByRole('heading', { name: m.filler_section_identity() }),
    ).toBeTruthy()
    expect(screen.getByLabelText(m.filler_field_cccd())).toBeDisabled()
  })

  it('shows paper descriptions and placeholders on key fields', () => {
    renderForm({ sanghaType: 'tang', cccd: '012345678901', memberId: 'm1' })

    expect(screen.getByText(m.filler_desc_dia_chi_thuong_tru())).toBeTruthy()
    expect(screen.getByText(m.filler_desc_ha_lap())).toBeTruthy()
    expect(screen.getByText(m.filler_desc_anh_chi_em())).toBeTruthy()
    expect(screen.getByText(m.filler_desc_anh_chan_dung())).toBeTruthy()
    expect(screen.getByText(m.filler_desc_he_phai_goc())).toBeTruthy()
    expect(
      screen.getByRole('textbox', { name: m.filler_field_noi_xuat_gia_line() }),
    ).toBeTruthy()

    expect(screen.getByPlaceholderText(m.filler_ph_the_danh())).toBeTruthy()
    expect(
      screen.getAllByPlaceholderText(m.filler_ph_phone()).length,
    ).toBeGreaterThan(0)
  })

  it('uses date inputs for calendar dates and giáo đoàn select', async () => {
    const user = userEvent.setup()
    renderForm({ sanghaType: 'tang', cccd: '012345678901', memberId: 'm1' })

    expect(screen.getByLabelText(new RegExp(`^${m.filler_field_ngay_sinh()}`))).toBeTruthy()
    expect(
      screen.getByLabelText(new RegExp(`^${m.filler_field_ngay_xuat_gia()}`)),
    ).toBeTruthy()

    const giaoDoan = await screen.findByRole('combobox', {
      name: m.filler_field_giao_doan_goc(),
    })
    await user.click(giaoDoan)
    expect(await screen.findByText('Giáo đoàn I')).toBeTruthy()
    expect(screen.queryByText('Ni giới Hệ phái Khất sĩ')).toBeNull()
  })

  it('allows editing CCCD on create and seeds phone', () => {
    renderForm({
      cccd: undefined,
      seedPhone: '0901234567',
      memberId: undefined,
    })
    const cccd = screen.getByLabelText(/^CCCD/) as HTMLInputElement
    expect(cccd.disabled).toBe(false)
    expect(
      (
        screen.getAllByLabelText(
          new RegExp(`^${m.filler_field_dien_thoai()}`),
        )[0] as HTMLInputElement
      ).value,
    ).toBe('0901234567')
  })

  it('keeps CCCD locked when editing existing (cccd prop set, treat as existing via initial id path)', () => {
    renderForm({
      cccd: '012345678901',
      memberId: 'm1',
      initial: member(),
    })
    expect(screen.getByLabelText(m.filler_field_cccd())).toBeDisabled()
  })

  it('shows tang precepts not ni precepts', () => {
    renderForm({ sanghaType: 'tang' })

    expect(screen.getByText(m.filler_field_gioi_sa_di())).toBeTruthy()
    expect(screen.getByText(m.filler_field_gioi_ty_kheo())).toBeTruthy()
    expect(screen.queryByText(m.filler_field_gioi_sa_di_ni())).toBeNull()
  })

  it('shows ni precepts for ni', () => {
    renderForm({ sanghaType: 'ni' })

    expect(screen.getByText(m.filler_field_gioi_sa_di_ni())).toBeTruthy()
    expect(screen.getByText(m.filler_field_gioi_thuc_xoa())).toBeTruthy()
    expect(screen.getByText(m.filler_field_gioi_ty_kheo_ni())).toBeTruthy()
  })

  it('opens confirm modal before save and calls saveAndLockMember on confirm', async () => {
    const user = userEvent.setup()
    saveAndLockMemberMock.mockResolvedValue({
      member: member({ id: 'created-member', phapDanh: 'Minh Tâm' }),
      mode: 'created',
    })
    const { onCreated } = renderForm({
      cccd: '012345678901',
      initial: requiredCoreInitial,
    })

    await user.click(screen.getByRole('button', { name: m.filler_save() }))
    expect(await screen.findByText(m.filler_save_confirm_body())).toBeTruthy()
    expect(saveAndLockMemberMock).not.toHaveBeenCalled()

    await user.click(
      await screen.findByRole('button', { name: m.filler_save_confirm_ok() }),
    )

    expect(saveAndLockMemberMock).toHaveBeenCalledWith({
      token: 'invite-token',
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      cccd: '012345678901',
      patch: expect.objectContaining({
        phapDanh: 'Minh Tâm',
      }),
    })
    expect(onCreated).toHaveBeenCalledWith('created-member')
    expect(uploadMemberPhotoMock).not.toHaveBeenCalled()
    expect(screen.getByText(m.filler_save_redirecting())).toBeTruthy()
  })

  it('does not save when confirm modal is cancelled', async () => {
    const user = userEvent.setup()
    renderForm({
      cccd: '012345678901',
      initial: requiredCoreInitial,
    })

    await user.click(screen.getByRole('button', { name: m.filler_save() }))
    await user.click(
      await screen.findByRole('button', { name: m.filler_save_confirm_cancel() }),
    )

    expect(saveAndLockMemberMock).not.toHaveBeenCalled()
  })

  it('uploads pending portrait after successful create', async () => {
    const user = userEvent.setup()
    let resolveUpload!: (value: { photoPath: string }) => void
    const uploadPromise = new Promise<{ photoPath: string }>((resolve) => {
      resolveUpload = resolve
    })
    uploadMemberPhotoMock.mockReturnValue(uploadPromise)
    saveAndLockMemberMock.mockResolvedValue({
      member: member({ id: 'created-member', phapDanh: 'Minh Tâm' }),
      mode: 'created',
    })
    const { onCreated } = renderForm({
      cccd: '012345678901',
      initial: {
        ...requiredCoreBase,
        documents: {
          cccd: {
            frontPath: 'members/m1/docs/cccd/front.jpg',
            backPath: 'members/m1/docs/cccd/back.jpg',
          },
        },
      },
    })
    const file = new File(['jpeg'], 'portrait.jpg', { type: 'image/jpeg' })

    await user.upload(getPortraitFileInput(), file)
    await confirmSave(user)

    expect(saveAndLockMemberMock).toHaveBeenCalled()
    expect(uploadMemberPhotoMock).toHaveBeenCalledWith({
      memberId: 'created-member',
      cccd: '012345678901',
      bytes: expect.any(Uint8Array),
      contentType: 'image/jpeg',
      inviteToken: 'invite-token',
    })
    expect(onCreated).not.toHaveBeenCalled()
    expect(screen.getByText(m.filler_save_success())).toBeTruthy()
    expect(screen.getByRole('button', { name: m.filler_save() })).toBeDisabled()

    resolveUpload({ photoPath: 'members/created-member/photo.jpg' })
    await vi.waitFor(() =>
      expect(onCreated).toHaveBeenCalledWith('created-member'),
    )
    expect(screen.getByText(m.filler_save_redirecting())).toBeTruthy()
  })

  it('keeps form open when portrait upload fails after create', async () => {
    const user = userEvent.setup()
    uploadMemberPhotoMock.mockRejectedValue(new Error('upload failed'))
    saveAndLockMemberMock.mockResolvedValue({
      member: member({ id: 'created-member', phapDanh: 'Minh Tâm' }),
      mode: 'created',
    })
    const { onCreated } = renderForm({
      cccd: '012345678901',
      initial: {
        ...requiredCoreBase,
        documents: {
          cccd: {
            frontPath: 'members/m1/docs/cccd/front.jpg',
            backPath: 'members/m1/docs/cccd/back.jpg',
          },
        },
      },
    })
    const file = new File(['jpeg'], 'portrait.jpg', { type: 'image/jpeg' })

    await user.upload(getPortraitFileInput(), file)
    await confirmSave(user)

    expect(await screen.findByText(m.filler_photo_upload_error())).toBeTruthy()
    expect(onCreated).not.toHaveBeenCalled()
    expect(screen.queryByText(m.filler_save_redirecting())).toBeNull()
    expect(screen.queryByText(m.filler_save_success())).toBeNull()
  })

  it(
    'uploads pending document after successful create',
    async () => {
      const user = userEvent.setup()
      let resolveUpload!: (value: {
        filePath: string
        documents: { diep_sa_di: { filePath: string } }
      }) => void
      const uploadPromise = new Promise<{
        filePath: string
        documents: { diep_sa_di: { filePath: string } }
      }>((resolve) => {
        resolveUpload = resolve
      })
      uploadMemberDocumentMock.mockReturnValue(uploadPromise)
      saveAndLockMemberMock.mockResolvedValue({
        member: member({ id: 'created-member', phapDanh: 'Minh Tâm' }),
        mode: 'created',
      })
      const { onCreated } = renderForm({
        cccd: '012345678901',
        initial: requiredCoreInitial,
      })
      const file = new File(['pdf'], 'doc.pdf', { type: 'application/pdf' })

      await pickPendingDocType(user)
      await user.upload(getDocumentFileInput(), file)
      await confirmSave(user)

      expect(saveAndLockMemberMock).toHaveBeenCalled()
      expect(uploadMemberDocumentMock).toHaveBeenCalledWith({
        memberId: 'created-member',
        cccd: '012345678901',
        typeId: 'diep_sa_di',
        side: 'file',
        bytes: expect.any(Uint8Array),
        contentType: 'application/pdf',
        inviteToken: 'invite-token',
        current: {
          cccd: {
            frontPath: 'members/m1/docs/cccd/front.jpg',
            backPath: 'members/m1/docs/cccd/back.jpg',
          },
        },
      })
      expect(onCreated).not.toHaveBeenCalled()

      resolveUpload({
        filePath: 'members/created-member/docs/diep_sa_di/file.pdf',
        documents: {
          diep_sa_di: {
            filePath: 'members/created-member/docs/diep_sa_di/file.pdf',
          },
        },
      })
      await vi.waitFor(() =>
        expect(onCreated).toHaveBeenCalledWith('created-member'),
      )
    },
    15_000,
  )

  it('adds and removes chuc vu rows', async () => {
    const user = userEvent.setup()
    renderForm()

    expect(screen.getAllByLabelText(m.filler_field_noi_dung())).toHaveLength(2)
    expect(screen.getAllByLabelText(m.filler_field_tu_thang_nam())).toHaveLength(
      2,
    )
    expect(
      screen.getAllByLabelText(m.filler_field_den_thang_nam()),
    ).toHaveLength(2)

    await user.click(screen.getAllByRole('button', { name: m.filler_add_row() })[0]!)
    expect(screen.getAllByLabelText(m.filler_field_noi_dung())).toHaveLength(3)

    await user.click(
      screen.getAllByRole('button', { name: m.filler_remove_row() })[0]!,
    )
    expect(screen.getAllByLabelText(m.filler_field_noi_dung())).toHaveLength(2)
  })

  it('hydrates legacy diaChiThuongTru string into line field', () => {
    renderForm({
      initial: {
        diaChiThuongTru: '123 Đường A' as unknown as Member['diaChiThuongTru'],
      },
    })
    expect(screen.getByDisplayValue('123 Đường A')).toBeTruthy()
  })

  it('blocks save when permanent address lacks city and ward', async () => {
    const user = userEvent.setup()
    renderForm({
      cccd: '012345678901',
      initial: {
        ...requiredCoreInitial,
        diaChiThuongTru: undefined,
      },
    })

    const permanent = screen.getByLabelText(m.filler_field_dia_chi_thuong_tru())
    await user.type(
      within(permanent).getByRole('textbox', {
        name: m.filler_field_address_line(),
      }),
      '15 Ngõ 4',
    )
    await user.click(screen.getByRole('button', { name: m.filler_save() }))

    expect(saveAndLockMemberMock).not.toHaveBeenCalled()
    expect(
      within(permanent).getByText(m.filler_address_city_required()),
    ).toBeTruthy()
  })

  it('hydrates legacy noiSinh string without showing line field in city-only UI', () => {
    renderForm({
      initial: {
        noiSinh: 'Cũ nơi sinh' as unknown as Member['noiSinh'],
      },
    })
    expect(
      screen.getByRole('combobox', { name: m.filler_field_noi_sinh() }),
    ).toBeTruthy()
    expect(screen.queryByDisplayValue('Cũ nơi sinh')).toBeNull()
  })

  it('blocks save when portrait, family, or nơi xuất gia line missing', async () => {
    const user = userEvent.setup()
    renderForm({
      cccd: '012345678901',
      initial: {
        ...requiredCoreBase,
        noiXuatGia: { ...completeAddress },
        giaDinh: {
          cha: { hoTen: '', namSinh: '', ngheNghiep: '', noiO: '' },
          me: { hoTen: '', namSinh: '', ngheNghiep: '', noiO: '' },
        },
      },
    })

    await user.click(screen.getByRole('button', { name: m.filler_save() }))

    expect(saveAndLockMemberMock).not.toHaveBeenCalled()
    expect(
      screen.getAllByText(m.filler_error_field_required()).length,
    ).toBeGreaterThanOrEqual(1)
  })

  it('blocks save when CCCD document is missing', async () => {
    const user = userEvent.setup()
    const { documents: _documents, ...withoutCccd } = requiredCoreInitial
    renderForm({
      cccd: '012345678901',
      initial: withoutCccd,
    })

    await user.click(screen.getByRole('button', { name: m.filler_save() }))

    expect(saveAndLockMemberMock).not.toHaveBeenCalled()
    expect(screen.queryByText(m.filler_save_confirm_body())).toBeNull()
    expect(screen.getByText(m.filler_error_field_required())).toBeTruthy()
  })

  it('blocks save when required core fields are empty', async () => {
    const user = userEvent.setup()
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView

    renderForm({ cccd: '012345678901' })

    await user.click(screen.getByRole('button', { name: m.filler_save() }))

    expect(saveAndLockMemberMock).not.toHaveBeenCalled()
    expect(screen.queryByText(m.filler_save_confirm_body())).toBeNull()
    expect(
      screen.getAllByText(m.filler_error_field_required()).length,
    ).toBeGreaterThanOrEqual(1)
    expect(
      within(screen.getByTestId('form-sticky-actions-status')).getByText(
        m.filler_validation_incomplete(),
      ),
    ).toBeTruthy()

    await vi.waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled()
    })
  })

  it('blocks save when CCCD number is empty on create', async () => {
    const user = userEvent.setup()
    renderForm({
      cccd: undefined,
      initial: requiredCoreInitial,
    })

    await user.click(screen.getByRole('button', { name: m.filler_save() }))

    expect(saveAndLockMemberMock).not.toHaveBeenCalled()
    expect(screen.queryByText(m.filler_save_confirm_body())).toBeNull()
    expect(
      within(screen.getByTestId('form-sticky-actions-status')).getByText(
        m.filler_validation_incomplete(),
      ),
    ).toBeTruthy()
    expect(screen.getByLabelText(/^CCCD/)).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(screen.getByText(m.filler_error_field_required())).toBeTruthy()
  })

  it('does not show phone fields for father or mother', () => {
    renderForm({ cccd: '012345678901', memberId: 'm1' })

    const cha = screen.getByRole('group', { name: m.filler_field_cha() })
    const me = screen.getByRole('group', { name: m.filler_field_me() })

    expect(
      within(cha).queryByLabelText(m.filler_field_dien_thoai()),
    ).toBeNull()
    expect(within(me).queryByLabelText(m.filler_field_dien_thoai())).toBeNull()

    expect(
      screen.getByLabelText(new RegExp(`^${m.filler_field_dien_thoai()}`)),
    ).toBeTruthy()
  })

  it('blocks save when email format is invalid', async () => {
    const user = userEvent.setup()
    renderForm({
      cccd: '012345678901',
      initial: {
        ...requiredCoreInitial,
        email: 'not-an-email',
      },
    })

    await user.click(screen.getByRole('button', { name: m.filler_save() }))

    expect(saveAndLockMemberMock).not.toHaveBeenCalled()
    expect(screen.getByText(m.filler_error_email_invalid())).toBeTruthy()
  })

  it('hides save and shows request edit when locked', () => {
    renderForm({
      memberId: 'm1',
      cccd: '012345678901',
      seedPhone: '0901234567',
      status: 'view',
      initial: member({ status: 'locked' }),
    })

    expect(screen.queryByRole('button', { name: m.filler_save() })).toBeNull()
    expect(
      screen.getByRole('button', { name: m.filler_request_edit() }),
    ).toBeTruthy()
  })

  it('shows pending label when edit already requested', () => {
    renderForm({
      memberId: 'm1',
      cccd: '012345678901',
      status: 'view',
      initial: member({
        status: 'locked',
        editRequestedAt: '2026-07-20T00:00:00.000Z',
      }),
    })

    expect(
      screen.getByRole('button', { name: m.filler_request_edit_pending() }),
    ).toBeDisabled()
    expect(
      screen.queryByRole('button', { name: m.filler_request_edit() }),
    ).toBeNull()
  })

  it('calls requestMemberEdit with filler phone', async () => {
    const user = userEvent.setup()
    requestMemberEditMock.mockResolvedValue(
      member({
        status: 'locked',
        editRequestedAt: '2026-07-20T12:00:00.000Z',
        editRequestedBy: '0901234567',
      }),
    )
    renderForm({
      memberId: 'm1',
      cccd: '012345678901',
      seedPhone: '0901234567',
      status: 'view',
      initial: member({ status: 'locked' }),
    })

    await user.click(
      screen.getByRole('button', { name: m.filler_request_edit() }),
    )

    expect(requestMemberEditMock).toHaveBeenCalledWith({
      memberId: 'm1',
      phone: '0901234567',
    })
    expect(screen.getByText(m.filler_request_edit_done())).toBeTruthy()
  })
})
