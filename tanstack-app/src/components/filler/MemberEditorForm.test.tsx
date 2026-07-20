import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Member } from '#/domain/types'
import { m } from '#/paraglide/messages'
import { saveMemberDraft } from '#/use-cases/saveMemberDraft'
import { theme } from '../../theme'
import { MemberEditorForm } from './MemberEditorForm'

vi.mock('#/use-cases/saveMemberDraft', () => ({
  saveMemberDraft: vi.fn(),
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
        screen.getAllByLabelText(m.filler_field_dien_thoai())[0] as HTMLInputElement
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
    const { onCreated } = renderForm()

    await user.type(
      screen.getByLabelText(/^CCCD/),
      '012345678901',
    )
    await user.type(screen.getByLabelText(m.filler_field_phap_danh()), 'Minh Tâm')
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

  it('blocks save when permanent address line lacks city and ward', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(
      screen.getByRole('textbox', { name: m.filler_field_address_line() }),
      '15 Ngõ 4',
    )
    await user.click(screen.getByRole('button', { name: m.filler_save() }))

    expect(saveMemberDraftMock).not.toHaveBeenCalled()
    expect(screen.getByText(m.filler_address_city_required())).toBeTruthy()
  })
})
