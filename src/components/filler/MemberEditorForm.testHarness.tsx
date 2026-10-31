/**
 * Shared mocks, fixtures and hooks for the MemberEditorForm*.test.tsx files.
 * Import it before anything else so its vi.mock calls apply to the form.
 */
import { MantineProvider } from '@mantine/core'
import { DatesProvider } from '@mantine/dates'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import 'dayjs/locale/vi'
import { beforeAll, beforeEach, vi } from 'vitest'
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
          allowsNi: false,
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

export const saveAndLockMemberMock = vi.mocked(saveAndLockMember)
export const requestMemberEditMock = vi.mocked(requestMemberEdit)
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

export async function confirmSave(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: m.filler_save() }))
  await user.click(
    await screen.findByRole('button', { name: m.filler_save_confirm_ok() }),
  )
}

export function renderForm(
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

export function member(overrides: Partial<Member> = {}): Member {
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

export const completeAddress = {
  cityCode: '01',
  cityName: 'Hà Nội',
  wardCode: '00013',
  wardName: 'Hà Đông',
} as const

const completeFamily = {
  cha: { hoTen: 'A', namSinh: '1960', ngheNghiep: 'X', noiO: 'Y' },
  me: { hoTen: 'B', namSinh: '1962', ngheNghiep: 'Z', noiO: 'Y' },
} as const

export const requiredCoreBase = {
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
  giaoPhamGiaoHoi: { rank: 'ty_kheo' },
  giaoPhamHePhai: { rank: 'ty_kheo' },
}

export const requiredCoreInitial = {
  ...requiredCoreBase,
  photoPath: 'members/m1/photo.jpg',
  documents: {
    cccd: {
      frontPath: 'members/m1/docs/cccd/front.jpg',
      backPath: 'members/m1/docs/cccd/back.jpg',
    },
  },
}
