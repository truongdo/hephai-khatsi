import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { Member, RecordStatus } from '#/domain/types'
import { theme } from '../../theme'
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
}

const lockedMember: Member = {
  ...draftMember,
  status: 'locked',
  inviteId: 'inv-1',
  lockedAt: '2026-07-19T11:00:00.000Z',
  lockedBy: 'admin-uid',
}

vi.mock('#/auth/useAdminClaim', () => ({
  useAdminClaim: () => ({ status: 'admin', uid: 'admin-uid' }),
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
  useNavigate: () => vi.fn(),
}))

let memberQueryResult: Member = draftMember

vi.mock('#/query/adminQueries', () => ({
  memberQuery: (id: string) => ({
    queryKey: ['admin', 'member', id],
    queryFn: async () => memberQueryResult,
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

vi.mock('#/use-cases/saveAdminMember', () => ({
  saveAdminMember: vi.fn(),
}))
vi.mock('#/use-cases/lockMember', () => ({
  lockMember: vi.fn(),
}))
vi.mock('#/use-cases/unlockMember', () => ({
  unlockMember: vi.fn(),
}))

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

function renderMemberForm({
  mode,
  member,
  sanghaType = 'tang',
}: {
  mode: 'create' | 'edit'
  member?: Partial<Member> & { cccd?: string; status?: RecordStatus }
  sanghaType?: 'tang' | 'ni'
}) {
  if (mode === 'edit' && member) {
    memberQueryResult = { ...draftMember, ...member }
  } else if (mode === 'edit') {
    memberQueryResult = lockedMember
  }

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <MemberFormPage
          mode={mode}
          memberId={mode === 'edit' ? 'm1' : undefined}
          sanghaType={sanghaType}
        />
      </MantineProvider>
    </QueryClientProvider>,
  )
}

describe('MemberFormPage', () => {
  it('shows unlock when locked', async () => {
    renderMemberForm({ mode: 'edit' })
    expect(
      await screen.findByRole('button', { name: /mở khóa|unlock/i }),
    ).toBeTruthy()
  })

  it('does not allow editing cccd on existing member', async () => {
    renderMemberForm({
      mode: 'edit',
      member: { cccd: '001099012345', status: 'draft' },
    })
    const cccd = (await screen.findByLabelText(/cccd/i)) as HTMLInputElement
    expect(cccd.disabled).toBe(true)
  })
})
