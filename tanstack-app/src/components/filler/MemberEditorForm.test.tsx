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
import { saveMemberDraft } from '#/use-cases/saveMemberDraft'
import { theme } from '../../theme'
import { MemberEditorForm } from './MemberEditorForm'

dayjs.extend(customParseFormat)
dayjs.locale('vi')

vi.mock('#/use-cases/saveMemberDraft', () => ({
  saveMemberDraft: vi.fn(),
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

const saveMemberDraftMock = vi.mocked(saveMemberDraft)

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
  saveMemberDraftMock.mockReset()
})

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
    status: 'draft',
    cccd: '012345678901',
    inviteId: 'invite-1',
    currentTempleId: null,
    photoPath: null,
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    ...overrides,
  }
}

const completeAddress = {
  cityCode: '01',
  cityName: 'Hà Nội',
  wardCode: '00013',
  wardName: 'Hà Đông',
} as const

const requiredCoreInitial = {
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
  noiXuatGia: { ...completeAddress },
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

  it('calls saveMemberDraft on save and navigates on create', async () => {
    const user = userEvent.setup()
    saveMemberDraftMock.mockResolvedValue({
      member: member({ id: 'created-member', phapDanh: 'Minh Tâm' }),
      mode: 'created',
    })
    const { onCreated } = renderForm({
      cccd: '012345678901',
      initial: requiredCoreInitial,
    })

    await user.click(screen.getByRole('button', { name: m.filler_save() }))

    expect(saveMemberDraftMock).toHaveBeenCalledWith({
      token: 'invite-token',
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      cccd: '012345678901',
      patch: expect.objectContaining({
        phapDanh: 'Minh Tâm',
      }),
    })
    expect(onCreated).toHaveBeenCalledWith('created-member')
  })

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

    expect(saveMemberDraftMock).not.toHaveBeenCalled()
    expect(
      within(permanent).getByText(m.filler_address_city_required()),
    ).toBeTruthy()
  })

  it('hydrates legacy noiSinh string into line field', () => {
    renderForm({
      initial: {
        noiSinh: 'Cũ nơi sinh' as unknown as Member['noiSinh'],
      },
    })
    expect(screen.getByDisplayValue('Cũ nơi sinh')).toBeTruthy()
  })

  it('blocks save when required core fields are empty', async () => {
    const user = userEvent.setup()
    renderForm({ cccd: '012345678901' })

    await user.click(screen.getByRole('button', { name: m.filler_save() }))

    expect(saveMemberDraftMock).not.toHaveBeenCalled()
    expect(
      screen.getAllByText(m.filler_error_field_required()).length,
    ).toBeGreaterThanOrEqual(1)
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

    expect(saveMemberDraftMock).not.toHaveBeenCalled()
    expect(screen.getByText(m.filler_error_email_invalid())).toBeTruthy()
  })
})
