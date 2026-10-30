import {
  saveAndLockMemberMock,
  renderForm,
  completeAddress,
  requiredCoreBase,
  requiredCoreInitial,
} from './MemberEditorForm.testHarness'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { m } from '#/paraglide/messages'

describe('MemberEditorForm validation', () => {
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
})
