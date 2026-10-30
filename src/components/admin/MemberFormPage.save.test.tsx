import {
  fixtures,
  lockedMember,
  completeDraftMember,
  navigateMock,
  saveAdminMemberMock,
  lockMemberMock,
  uploadMemberPhotoMock,
  uploadMemberDocumentMock,
  getPortraitFileInput,
  pickPendingDocType,
  getDocumentFileInput,
  renderForm,
  selectOrgUnit,
} from './MemberFormPage.testHarness'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { m } from '#/paraglide/messages'
import * as memberRequiredValidation from '../filler/memberRequiredValidation'

describe('MemberFormPage save', () => {
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
    fixtures.member = lockedMember
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
      fixtures.member = withoutCccd
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

  it('Hoàn thành saves a fully-valid draft without locking', async () => {
    const user = userEvent.setup()
    fixtures.member = completeDraftMember()
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

  it('navigates to the new member id after org unit reassignment', async () => {
    const user = userEvent.setup()
    fixtures.member = completeDraftMember()
    saveAdminMemberMock.mockResolvedValue({
      member: { ...completeDraftMember(), id: 'gd-ii_tang_001099012345' },
      mode: 'updated',
    } as never)
    renderForm({ mode: 'edit' })

    await screen.findByRole('button', { name: m.admin_members_complete() })
    await user.click(
      screen.getByRole('button', { name: m.admin_members_complete() }),
    )

    await vi.waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/admin/members/$id',
        params: { id: 'gd-ii_tang_001099012345' },
      }),
    )
  })
})
