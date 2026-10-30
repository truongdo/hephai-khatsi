import {
  requestMemberEditMock,
  renderForm,
  member,
} from './MemberEditorForm.testHarness'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Member } from '#/domain/types'
import { m } from '#/paraglide/messages'

describe('MemberEditorForm fields', () => {
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

  it('hydrates legacy noiSinh string into city-only field', () => {
    renderForm({
      initial: {
        noiSinh: 'Cũ nơi sinh' as unknown as Member['noiSinh'],
      },
    })
    expect(
      screen.getByRole('combobox', { name: m.filler_field_noi_sinh() }),
    ).toHaveValue('Cũ nơi sinh')
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
