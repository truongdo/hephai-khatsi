import { MantineProvider } from '@mantine/core'
import { DatesProvider } from '@mantine/dates'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Member } from '#/domain/types'
import { m } from '#/paraglide/messages'
import {
  grantDirectoryRole,
  revokeDirectoryRole,
} from '#/directoryRole/directoryRoleApiClient'
import { lockMember } from '#/use-cases/lockMember'
import { saveAdminMember } from '#/use-cases/saveAdminMember'
import { uploadMemberPhoto } from '#/use-cases/uploadMemberPhoto'
import { uploadMemberDocument } from '#/use-cases/uploadMemberDocument'
import { theme } from '../../theme'
import { documentTypeLabel } from '../filler/memberDocumentLabels'
import * as memberRequiredValidation from '../filler/memberRequiredValidation'
import { MemberFormPage } from './MemberFormPage'

const draftMember: Member = {
  id: 'm1',
  orgUnitId: 'gd-i',
  sanghaType: 'tang',
  cccd: '001099012345',
  phapDanh: 'HT A',
  theDanh: 'Nguyễn Văn A',
  dienThoai: '0901234567',
  status: 'draft',
  inviteId: null,
  currentTempleId: null,
  photoPath: null,
  createdAt: '2026-07-19T10:00:00.000Z',
  updatedAt: '2026-07-19T10:00:00.000Z',
  lockedAt: null,
  lockedBy: null,
  editRequestedAt: null,
  editRequestedBy: null,
}

const lockedMember: Member = {
  ...draftMember,
  status: 'locked',
  inviteId: 'inv-1',
  lockedAt: '2026-07-19T11:00:00.000Z',
  lockedBy: 'admin-uid',
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

function completeDraftMember(): Member {
  return {
    ...draftMember,
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
    photoPath: 'members/m1/photo.jpg',
    giaDinh: completeFamily,
    giaoPhamGiaoHoi: { rank: 'ty_kheo' },
    giaoPhamHePhai: { rank: 'ty_kheo' },
    documents: {
      cccd: {
        frontPath: 'members/m1/docs/cccd/front.jpg',
        backPath: 'members/m1/docs/cccd/back.jpg',
      },
    },
  }
}

const getIdTokenMock = vi.fn(async () => 'admin-id-token')
const navigateMock = vi.fn()

let adminClaimFixture: {
  status: 'admin'
  uid: string
  role: 'he_phai_admin' | 'he_phai_secretary' | 'giao_doan_admin'
  orgUnitId: string | null
} = { status: 'admin', uid: 'admin-uid', role: 'he_phai_admin', orgUnitId: null }

vi.mock('#/auth/useAdminClaim', () => ({
  useAdminClaim: () => adminClaimFixture,
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

let memberFixture: Member = draftMember

const mockOrgUnits = [
  {
    id: 'gd-i',
    code: 'I',
    name: 'Giáo đoàn I',
    kind: 'giao_doan' as const,
    order: 1,
    allowsTang: true,
    allowsNi: true,
  },
  {
    id: 'ni-gd-i',
    code: 'ni-gd-i',
    name: 'Ni giới Giáo đoàn I',
    kind: 'ni_gioi' as const,
    order: 7,
    allowsTang: false,
    allowsNi: true,
  },
]

vi.mock('#/repositories/orgUnitRepo', () => ({
  listOrgUnits: vi.fn(async () => mockOrgUnits),
}))

vi.mock('#/query/adminQueries', () => ({
  memberQuery: (id: string) => ({
    queryKey: ['admin', 'member', id],
    queryFn: async () => memberFixture,
    staleTime: 0,
  }),
  orgUnitsQuery: () => ({
    queryKey: ['admin', 'orgUnits'],
    queryFn: async () => mockOrgUnits,
    staleTime: 0,
  }),
}))

vi.mock('#/directoryRole/directoryRoleApiClient', () => ({
  grantDirectoryRole: vi.fn(),
  revokeDirectoryRole: vi.fn(),
}))
vi.mock('#/use-cases/saveAdminMember', () => ({
  saveAdminMember: vi.fn(),
}))
vi.mock('#/use-cases/lockMember', () => ({
  lockMember: vi.fn(),
}))
vi.mock('#/use-cases/unlockMember', () => ({
  unlockMember: vi.fn(),
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

const grantDirectoryRoleMock = vi.mocked(grantDirectoryRole)
const revokeDirectoryRoleMock = vi.mocked(revokeDirectoryRole)
const saveAdminMemberMock = vi.mocked(saveAdminMember)
const lockMemberMock = vi.mocked(lockMember)
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

  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

beforeEach(() => {
  localStorage.clear()
  adminClaimFixture = {
    status: 'admin',
    uid: 'admin-uid',
    role: 'he_phai_admin',
    orgUnitId: null,
  }
  memberFixture = lockedMember
  grantDirectoryRoleMock.mockReset()
  revokeDirectoryRoleMock.mockReset()
  saveAdminMemberMock.mockReset()
  lockMemberMock.mockReset()
  uploadMemberPhotoMock.mockReset()
  uploadMemberDocumentMock.mockReset()
  navigateMock.mockReset()
  getIdTokenMock.mockClear()
  uploadMemberPhotoMock.mockResolvedValue({
    photoPath: 'members/created-member/photo.jpg',
  })
  uploadMemberDocumentMock.mockResolvedValue({
    filePath: 'members/created-member/docs/diep_sa_di/file.pdf',
    documents: {
      diep_sa_di: { filePath: 'members/created-member/docs/diep_sa_di/file.pdf' },
    },
  })
  saveAdminMemberMock.mockResolvedValue({
    member: { ...draftMember, id: 'created-member' },
    mode: 'created',
  } as never)
})

function renderForm({ mode }: { mode: 'create' | 'edit' }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(['admin', 'orgUnits'], mockOrgUnits)
  queryClient.setQueryData(['filler', 'orgUnits'], mockOrgUnits)
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <DatesProvider settings={{ locale: 'vi', firstDayOfWeek: 1 }}>
          <MemberFormPage
            mode={mode}
            memberId={mode === 'edit' ? 'm1' : undefined}
            sanghaType="tang"
          />
        </DatesProvider>
      </MantineProvider>
    </QueryClientProvider>,
  )
}

async function selectOrgUnit(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('button', { name: m.admin_members_complete() })
  const select = await screen.findByRole('combobox', {
    name: new RegExp(`^${m.admin_members_form_org_unit()}$`),
  })
  await user.click(select)
  await user.keyboard('{ArrowDown}{Enter}')
}

describe('MemberFormPage', () => {
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
    await screen.findByRole('button', { name: m.admin_members_complete() })
    expect(
      screen.queryByRole('button', { name: m.admin_audit_history() }),
    ).toBeNull()
  })

  it('does not allow editing cccd on existing member', async () => {
    memberFixture = draftMember
    renderForm({ mode: 'edit' })
    const cccd = (await screen.findByLabelText(m.filler_field_cccd())) as HTMLInputElement
    expect(cccd.disabled).toBe(true)
  })

  it('renders full member sections', async () => {
    memberFixture = draftMember
    renderForm({ mode: 'edit' })
    expect(
      await screen.findByRole('heading', { name: m.filler_section_identity() }),
    ).toBeTruthy()
    expect(screen.getByText(m.filler_section_contact())).toBeTruthy()
    expect(screen.getByText(m.filler_field_anh_chan_dung())).toBeTruthy()
  })

  it('Hoàn thành does not save when required fields missing', async () => {
    const user = userEvent.setup()
    renderForm({ mode: 'create' })
    await selectOrgUnit(user)
    await user.type(
      screen.getByLabelText(new RegExp(`^${m.admin_members_form_cccd()}`)),
      '001099012345',
    )
    await user.click(
      screen.getByRole('button', { name: m.admin_members_complete() }),
    )

    expect(saveAdminMemberMock).not.toHaveBeenCalled()
    expect(
      screen.getAllByText(m.filler_error_field_required()).length,
    ).toBeGreaterThan(0)
  })

  it('keeps fields editable when locked and shows complete button', async () => {
    memberFixture = lockedMember
    renderForm({ mode: 'edit' })
    const input = await screen.findByLabelText(
      new RegExp(`^${m.filler_field_the_danh()}`),
    )
    expect(input).not.toBeDisabled()
    expect(
      screen.queryByRole('button', { name: m.admin_members_save_draft() }),
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: m.admin_members_complete() }),
    ).toBeTruthy()
  })

  it('uploads pending portrait after successful create and navigates to edit', async () => {
    const user = userEvent.setup()
    vi.spyOn(
      memberRequiredValidation,
      'validateMemberRequiredFields',
    ).mockReturnValue({ valid: true, errors: {} })
    let resolveUpload!: (value: { photoPath: string }) => void
    const uploadPromise = new Promise<{ photoPath: string }>((resolve) => {
      resolveUpload = resolve
    })
    uploadMemberPhotoMock.mockReturnValue(uploadPromise)
    renderForm({ mode: 'create' })
    await selectOrgUnit(user)
    await user.type(
      screen.getByLabelText(new RegExp(`^${m.admin_members_form_cccd()}`)),
      '001099012345',
    )
    const file = new File(['jpeg'], 'portrait.jpg', { type: 'image/jpeg' })
    await user.upload(getPortraitFileInput(), file)
    await user.click(
      screen.getByRole('button', { name: m.admin_members_complete() }),
    )

    await vi.waitFor(() => expect(saveAdminMemberMock).toHaveBeenCalled())
    expect(uploadMemberPhotoMock).toHaveBeenCalledWith({
      memberId: 'created-member',
      cccd: '001099012345',
      bytes: expect.any(Uint8Array),
      contentType: 'image/jpeg',
      idToken: 'admin-id-token',
      audit: { actorType: 'admin', actorId: 'admin-uid' },
    })
    expect(navigateMock).not.toHaveBeenCalled()

    resolveUpload({ photoPath: 'members/created-member/photo.jpg' })
    await vi.waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/admin/members/$id',
        params: { id: 'created-member' },
      }),
    )
  })

  it(
    'uploads pending document after successful create and navigates to edit',
    async () => {
      const user = userEvent.setup()
      vi.spyOn(
        memberRequiredValidation,
        'validateMemberRequiredFields',
      ).mockReturnValue({ valid: true, errors: {} })
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
      renderForm({ mode: 'create' })
      await selectOrgUnit(user)
      await user.type(
        screen.getByLabelText(new RegExp(`^${m.admin_members_form_cccd()}`)),
        '001099012345',
      )
      const file = new File(['pdf'], 'doc.pdf', { type: 'application/pdf' })
      await pickPendingDocType(user)
      await user.upload(getDocumentFileInput(), file)
      await user.click(
        screen.getByRole('button', { name: m.admin_members_complete() }),
      )

      await vi.waitFor(() => expect(saveAdminMemberMock).toHaveBeenCalled())
      expect(uploadMemberDocumentMock).toHaveBeenCalledWith({
        memberId: 'created-member',
        cccd: '001099012345',
        typeId: 'diep_sa_di',
        side: 'file',
        bytes: expect.any(Uint8Array),
        contentType: 'application/pdf',
        idToken: 'admin-id-token',
        current: {},
        audit: { actorType: 'admin', actorId: 'admin-uid' },
      })
      expect(navigateMock).not.toHaveBeenCalled()

      resolveUpload({
        filePath: 'members/created-member/docs/diep_sa_di/file.pdf',
        documents: {
          diep_sa_di: {
            filePath: 'members/created-member/docs/diep_sa_di/file.pdf',
          },
        },
      })
      await vi.waitFor(() =>
        expect(navigateMock).toHaveBeenCalledWith({
          to: '/admin/members/$id',
          params: { id: 'created-member' },
        }),
      )
    },
    15_000,
  )

  it(
    'Hoàn thành does not save when CCCD document is missing',
    async () => {
      const user = userEvent.setup()
      const { documents: _documents, ...withoutCccd } = completeDraftMember()
      memberFixture = withoutCccd
      renderForm({ mode: 'edit' })

      await screen.findByRole('button', { name: m.admin_members_complete() })
      await user.click(
        screen.getByRole('button', { name: m.admin_members_complete() }),
      )

      expect(saveAdminMemberMock).not.toHaveBeenCalled()
      expect(
        screen.getAllByText(m.filler_error_field_required()).length,
      ).toBeGreaterThan(0)
    },
    15_000,
  )

  it('disables grant Thư ký when member email is not gmail', async () => {
    memberFixture = { ...lockedMember, email: 'a@hephai.org' }
    renderForm({ mode: 'edit' })
    const grantBtn = await screen.findByRole('button', {
      name: m.admin_member_directory_role_grant(),
    })
    expect(grantBtn).toBeDisabled()
  })

  it('enables grant Thư ký when member email is gmail', async () => {
    memberFixture = { ...lockedMember, email: 'user@gmail.com' }
    renderForm({ mode: 'edit' })
    const grantBtn = await screen.findByRole('button', {
      name: m.admin_member_directory_role_grant(),
    })
    expect(grantBtn).not.toBeDisabled()
  })

  it('shows both grant buttons when canGrant and no directoryRole', async () => {
    memberFixture = { ...lockedMember, email: 'user@gmail.com' }
    renderForm({ mode: 'edit' })
    expect(
      await screen.findByRole('button', {
        name: m.admin_member_directory_role_grant(),
      }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', {
        name: m.admin_member_directory_role_grant_he_phai(),
      }),
    ).toBeTruthy()
  })

  it('grants he_phai_secretary via API when he phai grant clicked', async () => {
    const user = userEvent.setup()
    memberFixture = { ...lockedMember, email: 'user@gmail.com' }
    grantDirectoryRoleMock.mockResolvedValue({ ok: true } as never)
    renderForm({ mode: 'edit' })
    await user.click(
      await screen.findByRole('button', {
        name: m.admin_member_directory_role_grant_he_phai(),
      }),
    )
    await vi.waitFor(() =>
      expect(grantDirectoryRoleMock).toHaveBeenCalledWith({
        memberId: 'm1',
        role: 'he_phai_secretary',
        idToken: 'admin-id-token',
      }),
    )
  })

  it('shows Thư ký giáo đoàn badge and revoke when member has giao_doan_admin role', async () => {
    memberFixture = {
      ...lockedMember,
      email: 'sec@gmail.com',
      directoryRole: 'giao_doan_admin',
    }
    renderForm({ mode: 'edit' })
    expect(
      await screen.findByText(m.admin_member_directory_role_badge()),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', {
        name: m.admin_member_directory_role_revoke(),
      }),
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', {
        name: m.admin_member_directory_role_grant(),
      }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', {
        name: m.admin_member_directory_role_grant_he_phai(),
      }),
    ).toBeNull()
  })

  it('shows Thư ký hệ phái badge and revoke when member has he_phai_secretary role', async () => {
    memberFixture = {
      ...lockedMember,
      email: 'sec@gmail.com',
      directoryRole: 'he_phai_secretary',
    }
    renderForm({ mode: 'edit' })
    expect(
      await screen.findByText(m.admin_member_directory_role_badge_he_phai()),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', {
        name: m.admin_member_directory_role_revoke_he_phai(),
      }),
    ).toBeTruthy()
    const user = userEvent.setup()
    await user.click(
      screen.getByRole('button', {
        name: m.admin_member_directory_role_revoke_he_phai(),
      }),
    )
    const confirmDialog = await screen.findByRole('dialog', {
      name: m.admin_member_directory_role_revoke_he_phai(),
    })
    expect(
      within(confirmDialog).getByText(
        m.admin_org_units_he_phai_secretaries_revoke_confirm(),
      ),
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', {
        name: m.admin_member_directory_role_grant(),
      }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', {
        name: m.admin_member_directory_role_grant_he_phai(),
      }),
    ).toBeNull()
  })

  it('shows read-only badge without grant/revoke when viewer is he_phai_secretary', async () => {
    adminClaimFixture = {
      status: 'admin',
      uid: 'sec-uid',
      role: 'he_phai_secretary',
      orgUnitId: null,
    }
    memberFixture = {
      ...lockedMember,
      email: 'sec@gmail.com',
      directoryRole: 'he_phai_secretary',
    }
    renderForm({ mode: 'edit' })
    expect(
      await screen.findByText(m.admin_member_directory_role_badge_he_phai()),
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', {
        name: m.admin_member_directory_role_revoke_he_phai(),
      }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', {
        name: m.admin_member_directory_role_grant_he_phai(),
      }),
    ).toBeNull()
  })

  it('shows Phân đoàn when editing member under ni giới org unit', async () => {
    memberFixture = { ...draftMember, orgUnitId: 'ni-gd-i', sanghaType: 'ni' }
    renderForm({ mode: 'edit' })
    expect(
      await screen.findByRole('combobox', { name: m.filler_field_phan_doan() }),
    ).toBeTruthy()
  })

  it('Hoàn thành saves a fully-valid draft without locking', async () => {
    const user = userEvent.setup()
    memberFixture = completeDraftMember()
    saveAdminMemberMock.mockResolvedValue({
      member: { ...completeDraftMember(), id: 'm1' },
      mode: 'updated',
    } as never)
    renderForm({ mode: 'edit' })

    await screen.findByRole('button', { name: m.admin_members_complete() })
    await user.click(
      screen.getByRole('button', { name: m.admin_members_complete() }),
    )

    await vi.waitFor(() => expect(saveAdminMemberMock).toHaveBeenCalledOnce())
    expect(lockMemberMock).not.toHaveBeenCalled()
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
