/**
 * Shared mocks, fixtures and hooks for the MemberFormPage*.test.tsx files.
 * Import it before anything else so its vi.mock calls apply to the page.
 */
import { MantineProvider } from '@mantine/core'
import { DatesProvider } from '@mantine/dates'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, vi } from 'vitest'
import type { Member } from '#/domain/types'
import { m } from '#/paraglide/messages'
import {
  grantDirectoryRole,
  revokeDirectoryRole,
} from '#/directoryRole/directoryRoleApiClient'
import { lockMember } from '#/use-cases/lockMember'
import { saveAdminMember } from '#/use-cases/saveAdminMember'
import { exportMembersPdf } from '#/use-cases/exportMembersPdf'
import { uploadMemberPhoto } from '#/use-cases/uploadMemberPhoto'
import { uploadMemberDocument } from '#/use-cases/uploadMemberDocument'
import { theme } from '../../theme'
import { documentTypeLabel } from '../filler/memberDocumentLabels'
import { MemberFormPage } from './MemberFormPage'

export const draftMember: Member = {
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

export const lockedMember: Member = {
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

export function completeDraftMember(): Member {
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
export const navigateMock = vi.fn()

type AdminClaimFixture = {
  status: 'admin'
  uid: string
  role: 'he_phai_admin' | 'he_phai_secretary' | 'giao_doan_admin'
  orgUnitId: string | null
}

vi.mock('#/auth/useAdminClaim', () => ({
  useAdminClaim: () => fixtures.adminClaim,
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

/** Reassign per test; reset in beforeEach. */
export const fixtures: { adminClaim: AdminClaimFixture; member: Member } = {
  adminClaim: { status: 'admin', uid: 'admin-uid', role: 'he_phai_admin', orgUnitId: null },
  member: draftMember,
}

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
    queryFn: async () => fixtures.member,
    staleTime: 0,
  }),
  orgUnitsQuery: () => ({
    queryKey: ['admin', 'orgUnits'],
    queryFn: async () => mockOrgUnits,
    staleTime: 0,
  }),
  directorySecretariesQuery: () => ({
    queryKey: ['admin', 'directorySecretaries'],
    queryFn: async () => [],
    staleTime: 60_000,
  }),
  hePhaiSecretariesQuery: () => ({
    queryKey: ['admin', 'hePhaiSecretaries'],
    queryFn: async () => [],
    staleTime: 60_000,
  }),
}))

vi.mock('#/directoryRole/directoryRoleApiClient', () => ({
  grantDirectoryRole: vi.fn(),
  revokeDirectoryRole: vi.fn(),
}))
vi.mock('#/use-cases/saveAdminMember', () => ({
  saveAdminMember: vi.fn(),
}))
vi.mock('#/use-cases/exportMembersPdf', () => ({
  exportMembersPdf: vi.fn(),
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
vi.mock('#/search/notifySearchIndex', () => ({
  notifyMemberUpsert: vi.fn().mockResolvedValue(undefined),
  notifyMemberDelete: vi.fn().mockResolvedValue(undefined),
  notifyTempleUpsert: vi.fn().mockResolvedValue(undefined),
  notifyTempleDelete: vi.fn().mockResolvedValue(undefined),
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

export const grantDirectoryRoleMock = vi.mocked(grantDirectoryRole)
const revokeDirectoryRoleMock = vi.mocked(revokeDirectoryRole)
export const saveAdminMemberMock = vi.mocked(saveAdminMember)
export const exportMembersPdfMock = vi.mocked(exportMembersPdf)
export const lockMemberMock = vi.mocked(lockMember)
export const uploadMemberPhotoMock = vi.mocked(uploadMemberPhoto)
export const uploadMemberDocumentMock = vi.mocked(uploadMemberDocument)

export function getPortraitFileInput(): HTMLInputElement {
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

export async function pickPendingDocType(
  user: ReturnType<typeof userEvent.setup>,
) {
  const select = screen.getByRole('combobox', {
    name: m.filler_doc_select_label(),
  })
  await user.click(select)
  await user.click(await screen.findByText(documentTypeLabel('diep_sa_di')))
}

export function getDocumentFileInput(): HTMLInputElement {
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
  fixtures.adminClaim = {
    status: 'admin',
    uid: 'admin-uid',
    role: 'he_phai_admin',
    orgUnitId: null,
  }
  fixtures.member = lockedMember
  grantDirectoryRoleMock.mockReset()
  revokeDirectoryRoleMock.mockReset()
  saveAdminMemberMock.mockReset()
  exportMembersPdfMock.mockReset()
  exportMembersPdfMock.mockResolvedValue({
    filename: 'HoSo_HT_A_m1.pdf',
    failedDocumentCount: 0,
  })
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

export function renderForm({ mode }: { mode: 'create' | 'edit' }) {
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

export async function selectOrgUnit(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('button', { name: m.admin_members_complete() })
  const select = await screen.findByRole('combobox', {
    name: new RegExp(`^${m.admin_members_form_org_unit()}$`),
  })
  await user.click(select)
  await user.keyboard('{ArrowDown}{Enter}')
}
