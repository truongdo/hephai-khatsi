import {
  fixtures,
  draftMember,
  lockedMember,
  exportMembersPdfMock,
  renderForm,
} from './MemberFormPage.testHarness'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { memberPdfFilename } from '#/domain/memberPdfNames'
import { m } from '#/paraglide/messages'

describe('MemberFormPage', () => {
  it('shows Xuất PDF in edit mode and exports merged PDF on click', async () => {
    const user = userEvent.setup()
    renderForm({ mode: 'edit' })
    const exportBtn = await screen.findByRole('button', {
      name: m.admin_members_export_pdf(),
    })
    await user.click(exportBtn)
    await vi.waitFor(() => expect(exportMembersPdfMock).toHaveBeenCalledOnce())
    expect(exportMembersPdfMock).toHaveBeenCalledWith({
      members: [lockedMember],
      format: 'merged_pdf',
      orgUnitNameById: { 'gd-i': 'Giáo đoàn I', 'ni-gd-i': 'Ni giới Giáo đoàn I' },
      filenameOverride: memberPdfFilename(lockedMember),
    })
  })

  it('does not show Xuất PDF in create mode', async () => {
    renderForm({ mode: 'create' })
    await screen.findByRole('button', { name: m.admin_members_complete() })
    expect(
      screen.queryByRole('button', { name: m.admin_members_export_pdf() }),
    ).toBeNull()
  })

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
    fixtures.member = draftMember
    renderForm({ mode: 'edit' })
    const cccd = (await screen.findByLabelText(m.filler_field_cccd())) as HTMLInputElement
    expect(cccd.disabled).toBe(true)
  })

  it('renders full member sections', async () => {
    fixtures.member = draftMember
    renderForm({ mode: 'edit' })
    expect(
      await screen.findByRole('heading', { name: m.filler_section_identity() }),
    ).toBeTruthy()
    expect(screen.getByText(m.filler_section_contact())).toBeTruthy()
    expect(screen.getByText(m.filler_field_anh_chan_dung())).toBeTruthy()
  })

  it('enables org unit select for he_phai_admin when member is draft', async () => {
    fixtures.member = draftMember
    renderForm({ mode: 'edit' })
    const select = await screen.findByRole('combobox', {
      name: new RegExp(`^${m.admin_members_form_org_unit()}$`),
    })
    expect(select).not.toBeDisabled()
  })

  it('disables org unit select when member is locked', async () => {
    renderForm({ mode: 'edit' })
    const select = await screen.findByRole('combobox', {
      name: new RegExp(`^${m.admin_members_form_org_unit()}$`),
    })
    expect(select).toBeDisabled()
  })

  it('disables org unit select for giao_doan_admin on edit', async () => {
    fixtures.adminClaim = {
      status: 'admin',
      uid: 'admin-uid',
      role: 'giao_doan_admin',
      orgUnitId: 'gd-i',
    }
    fixtures.member = draftMember
    renderForm({ mode: 'edit' })
    const select = await screen.findByRole('combobox', {
      name: new RegExp(`^${m.admin_members_form_org_unit()}$`),
    })
    expect(select).toBeDisabled()
  })

  it('shows Phân đoàn when editing member under ni giới org unit', async () => {
    fixtures.member = { ...draftMember, orgUnitId: 'ni-gd-i', sanghaType: 'ni' }
    renderForm({ mode: 'edit' })
    expect(
      await screen.findByRole('combobox', { name: m.filler_field_phan_doan() }),
    ).toBeTruthy()
  })
})
