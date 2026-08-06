import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AddressValue } from '#/domain/address'
import { m } from '#/paraglide/messages'
import { lockTemple } from '#/use-cases/lockTemple'
import { saveAdminTemple } from '#/use-cases/saveAdminTemple'
import { uploadTemplePhoto } from '#/use-cases/uploadTemplePhoto'
import { theme } from '../../theme'
import * as templeRequiredValidation from '../filler/templeRequiredValidation'
import { TempleFormPage } from './TempleFormPage'

const structuredAddress: AddressValue = {
  cityCode: '01',
  cityName: 'Hà Nội',
  wardCode: '00013',
  wardName: 'Hà Đông',
  line: '15 Ngõ 4',
}

const lockedTemple = {
  id: 't1',
  orgUnitId: 'gd-i',
  danhHieu: 'TX A',
  managerPhones: ['0901234567'],
  status: 'locked' as const,
  inviteId: 'inv-1',
  photoPath: null,
  diaChiMoi: '123 Đường A' as string | AddressValue,
  truTriHienNay: { dienThoai: '0901234567' },
  createdAt: '2026-07-19T10:00:00.000Z',
  updatedAt: '2026-07-19T10:00:00.000Z',
  lockedAt: '2026-07-19T11:00:00.000Z',
  lockedBy: 'admin-uid',
  editRequestedAt: null,
  editRequestedBy: null,
}

const draftTemple = {
  ...lockedTemple,
  status: 'draft' as const,
  lockedAt: null,
  lockedBy: null,
  diaChiMoi: structuredAddress as string | AddressValue,
}

const getIdTokenMock = vi.fn(async () => 'admin-id-token')
const navigateMock = vi.fn()

vi.mock('#/auth/useAdminClaim', () => ({
  useAdminClaim: () => ({ status: 'admin', uid: 'admin-uid', role: 'he_phai_admin', orgUnitId: null }),
}))

vi.mock('#/auth/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'admin-uid', getIdToken: getIdTokenMock },
    loading: false,
  }),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    ...props
  }: {
    children: React.ReactNode
    to: string
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => navigateMock,
}))

let templeFixture: typeof lockedTemple | typeof draftTemple = lockedTemple

vi.mock('#/query/adminQueries', () => ({
  templeQuery: (id: string) => ({
    queryKey: ['admin', 'temple', id],
    queryFn: async () => templeFixture,
    staleTime: 0,
  }),
  orgUnitsQuery: () => ({
    queryKey: ['admin', 'orgUnits'],
    queryFn: async () => [
      {
        id: 'gd-i',
        code: 'I',
        name: 'Giáo đoàn I',
        kind: 'giao_doan',
        order: 1,
        allowsTang: true,
        allowsNi: true,
      },
    ],
    staleTime: 0,
  }),
}))

vi.mock('#/use-cases/saveAdminTemple', () => ({
  saveAdminTemple: vi.fn(),
}))
vi.mock('#/use-cases/lockTemple', () => ({
  lockTemple: vi.fn(),
}))
vi.mock('#/use-cases/unlockTemple', () => ({
  unlockTemple: vi.fn(),
}))
vi.mock('#/use-cases/uploadTemplePhoto', () => ({
  uploadTemplePhoto: vi.fn(async () => ({
    photoPath: 'temples/created-temple/photo.jpg',
  })),
}))
vi.mock('#/repositories/auditLogRepo', () => ({
  listAuditLogs: vi.fn(async () => ({ entries: [], nextStartAfterAt: null })),
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

const saveAdminTempleMock = vi.mocked(saveAdminTemple)
const lockTempleMock = vi.mocked(lockTemple)
const uploadTemplePhotoMock = vi.mocked(uploadTemplePhoto)

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

function completeDraftTemple() {
  return {
    ...draftTemple,
    danhHieu: 'Tịnh xá Ngọc Viên',
    nguoiKhaiSon: 'HT. Minh',
    namThanhLap: '1954',
    diaChiCu: '123 Đường Láng',
    diaChiMoi: structuredAddress,
    truTriHienNay: {
      phapDanh: 'Thích A',
      dienThoai: '0901234567',
      email: 'a@b.co',
    },
    truTriTienNhiem: [{ phapDanh: 'Thích B', thoiGian: '', ghiChu: '' }],
    tangSoHienTru: { tyKheo: 0, thucXoaMaNa: 0, saDi: 0, tapSu: 0 },
    soPhatTuQuyY: 0,
    soPhatTuThuongXuyen: 0,
    qdCongNhan: { trangThai: 'chinh_thuc' },
    photoPath: 'temples/seed/photo.jpg',
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
  localStorage.clear()
  templeFixture = lockedTemple
  lockedTemple.diaChiMoi = '123 Đường A'
  saveAdminTempleMock.mockReset()
  lockTempleMock.mockReset()
  uploadTemplePhotoMock.mockReset()
  navigateMock.mockReset()
  getIdTokenMock.mockClear()
  uploadTemplePhotoMock.mockResolvedValue({
    photoPath: 'temples/created-temple/photo.jpg',
  })
  saveAdminTempleMock.mockResolvedValue({
    temple: { ...draftTemple, id: 'created-temple' },
    mode: 'created',
  } as never)
})

function renderForm({ mode }: { mode: 'create' | 'edit' }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(['admin', 'orgUnits'], [
    {
      id: 'gd-i',
      code: 'I',
      name: 'Giáo đoàn I',
      kind: 'giao_doan',
      order: 1,
      allowsTang: true,
      allowsNi: true,
    },
  ])
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <TempleFormPage mode={mode} templeId={mode === 'edit' ? 't1' : undefined} />
      </MantineProvider>
    </QueryClientProvider>,
  )
}

async function selectOrgUnit(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('button', { name: m.admin_temples_complete() })
  const select = await screen.findByRole('combobox', {
    name: new RegExp(`^${m.admin_temples_form_org_unit()}`),
  })
  await user.click(select)
  await user.click(await screen.findByText('Giáo đoàn I'))
}

describe('TempleFormPage', () => {
  it('shows unlock when locked', async () => {
    renderForm({ mode: 'edit' })
    expect(
      await screen.findByRole('button', { name: /mở khóa|unlock/i }),
    ).toBeTruthy()
  })

  it('shows audit history button in edit mode and opens modal', async () => {
    const user = userEvent.setup()
    renderForm({ mode: 'edit' })
    const historyBtn = await screen.findByRole('button', {
      name: m.admin_audit_history(),
    })
    await user.click(historyBtn)
    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(
      screen.getByText(new RegExp(m.admin_audit_modal_title())),
    ).toBeTruthy()
  })

  it('does not show audit history button in create mode', async () => {
    renderForm({ mode: 'create' })
    await screen.findByRole('button', { name: m.admin_temples_complete() })
    expect(
      screen.queryByRole('button', { name: m.admin_audit_history() }),
    ).toBeNull()
  })

  it('renders full temple sections', async () => {
    templeFixture = draftTemple
    renderForm({ mode: 'edit' })
    expect(
      await screen.findByText(m.filler_section_temple_identity()),
    ).toBeTruthy()
    expect(screen.getByText(m.filler_section_temple_address())).toBeTruthy()
    expect(screen.getByText(m.filler_field_anh_tinh_xa())).toBeTruthy()
  })

  it('Hoàn thành does not save when required fields missing', async () => {
    const user = userEvent.setup()
    renderForm({ mode: 'create' })
    await selectOrgUnit(user)
    await user.type(
      screen.getByLabelText(m.filler_field_manager_phone()),
      '0901234567',
    )
    await user.click(
      screen.getByRole('button', { name: m.admin_temples_complete() }),
    )

    expect(saveAdminTempleMock).not.toHaveBeenCalled()
    expect(
      screen.getAllByText(m.filler_error_field_required()).length,
    ).toBeGreaterThan(0)
  })

  it('Hoàn thành blocks when photo missing on otherwise complete draft', async () => {
    const user = userEvent.setup()
    templeFixture = { ...completeDraftTemple(), photoPath: null }
    renderForm({ mode: 'edit' })
    await screen.findByRole('button', { name: m.admin_temples_complete() })
    await user.click(
      screen.getByRole('button', { name: m.admin_temples_complete() }),
    )
    expect(saveAdminTempleMock).not.toHaveBeenCalled()
    expect(screen.getByText(m.filler_error_field_required())).toBeTruthy()
  })

  it('keeps fields editable when locked and shows complete button', async () => {
    templeFixture = lockedTemple
    renderForm({ mode: 'edit' })
    const input = await screen.findByLabelText(
      new RegExp(`^${m.filler_field_danh_hieu()}`),
    )
    expect(input).not.toBeDisabled()
    expect(
      screen.queryByRole('button', { name: m.admin_temples_save_draft() }),
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: m.admin_temples_complete() }),
    ).toBeTruthy()
  })

  it('uploads pending portrait after successful create and navigates to edit', async () => {
    const user = userEvent.setup()
    vi.spyOn(
      templeRequiredValidation,
      'validateTempleRequiredFields',
    ).mockReturnValue({ valid: true, errors: {} })
    let resolveUpload!: (value: { photoPath: string }) => void
    const uploadPromise = new Promise<{ photoPath: string }>((resolve) => {
      resolveUpload = resolve
    })
    uploadTemplePhotoMock.mockReturnValue(uploadPromise)
    renderForm({ mode: 'create' })
    await selectOrgUnit(user)
    await user.type(
      screen.getByLabelText(m.filler_field_manager_phone()),
      '0901234567',
    )
    const file = new File(['jpeg'], 'portrait.jpg', { type: 'image/jpeg' })
    await user.upload(getPortraitFileInput(), file)
    await user.click(
      screen.getByRole('button', { name: m.admin_temples_complete() }),
    )

    await vi.waitFor(() => expect(saveAdminTempleMock).toHaveBeenCalled())
    expect(uploadTemplePhotoMock).toHaveBeenCalledWith({
      templeId: 'created-temple',
      bytes: expect.any(Uint8Array),
      contentType: 'image/jpeg',
      idToken: 'admin-id-token',
      audit: { actorType: 'admin', actorId: 'admin-uid' },
    })
    expect(navigateMock).not.toHaveBeenCalled()

    resolveUpload({ photoPath: 'temples/created-temple/photo.jpg' })
    await vi.waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/admin/temples/$id',
        params: { id: 'created-temple' },
      }),
    )
  })

  it('Hoàn thành saves a fully-valid draft without locking', async () => {
    const user = userEvent.setup()
    templeFixture = completeDraftTemple()
    saveAdminTempleMock.mockResolvedValue({
      temple: { ...completeDraftTemple(), id: 't1' },
      mode: 'updated',
    } as never)
    renderForm({ mode: 'edit' })

    await screen.findByRole('button', { name: m.admin_temples_complete() })
    await user.click(
      screen.getByRole('button', { name: m.admin_temples_complete() }),
    )

    await vi.waitFor(() => expect(saveAdminTempleMock).toHaveBeenCalledOnce())
    expect(lockTempleMock).not.toHaveBeenCalled()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('surfaces upload error on immediate portrait upload when editing', async () => {
    const user = userEvent.setup()
    templeFixture = completeDraftTemple()
    uploadTemplePhotoMock.mockRejectedValue(new Error('upload failed'))
    renderForm({ mode: 'edit' })
    await screen.findByRole('button', { name: m.admin_temples_complete() })
    const file = new File(['jpeg'], 'portrait.jpg', { type: 'image/jpeg' })

    await user.upload(getPortraitFileInput(), file)

    expect(uploadTemplePhotoMock).toHaveBeenCalledOnce()
    expect(screen.getByText(m.filler_photo_upload_error())).toBeTruthy()
  })
})
