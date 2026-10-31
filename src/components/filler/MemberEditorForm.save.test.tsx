import {
  saveAndLockMemberMock,
  uploadMemberPhotoMock,
  uploadMemberDocumentMock,
  getPortraitFileInput,
  pickPendingDocType,
  getDocumentFileInput,
  confirmSave,
  renderForm,
  member,
  requiredCoreBase,
  requiredCoreInitial,
} from './MemberEditorForm.testHarness'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { m } from '#/paraglide/messages'

describe('MemberEditorForm save', () => {
  it('opens confirm modal before save and calls saveAndLockMember on confirm', async () => {
    const user = userEvent.setup()
    saveAndLockMemberMock.mockResolvedValue({
      member: member({ id: 'created-member', phapDanh: 'Minh Tâm' }),
      mode: 'created',
    })
    const { onCreated } = renderForm({
      cccd: '012345678901',
      initial: requiredCoreInitial,
    })

    await user.click(screen.getByRole('button', { name: m.filler_save() }))
    expect(await screen.findByText(m.filler_save_confirm_body())).toBeTruthy()
    expect(saveAndLockMemberMock).not.toHaveBeenCalled()

    await user.click(
      await screen.findByRole('button', { name: m.filler_save_confirm_ok() }),
    )

    expect(saveAndLockMemberMock).toHaveBeenCalledWith({
      token: 'invite-token',
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      cccd: '012345678901',
      patch: expect.objectContaining({
        phapDanh: 'MINH TÂM',
      }),
    })
    expect(onCreated).toHaveBeenCalledWith('created-member')
    expect(uploadMemberPhotoMock).not.toHaveBeenCalled()
    expect(screen.getByText(m.filler_save_redirecting())).toBeTruthy()
  })

  it('does not save when confirm modal is cancelled', async () => {
    const user = userEvent.setup()
    renderForm({
      cccd: '012345678901',
      initial: requiredCoreInitial,
    })

    await user.click(screen.getByRole('button', { name: m.filler_save() }))
    await user.click(
      await screen.findByRole('button', { name: m.filler_save_confirm_cancel() }),
    )

    expect(saveAndLockMemberMock).not.toHaveBeenCalled()
  })

  it('uploads pending portrait after successful create', async () => {
    const user = userEvent.setup()
    let resolveUpload!: (value: { photoPath: string }) => void
    const uploadPromise = new Promise<{ photoPath: string }>((resolve) => {
      resolveUpload = resolve
    })
    uploadMemberPhotoMock.mockReturnValue(uploadPromise)
    saveAndLockMemberMock.mockResolvedValue({
      member: member({ id: 'created-member', phapDanh: 'Minh Tâm' }),
      mode: 'created',
    })
    const { onCreated } = renderForm({
      cccd: '012345678901',
      initial: {
        ...requiredCoreBase,
        documents: {
          cccd: {
            frontPath: 'members/m1/docs/cccd/front.jpg',
            backPath: 'members/m1/docs/cccd/back.jpg',
          },
        },
      },
    })
    const file = new File(['jpeg'], 'portrait.jpg', { type: 'image/jpeg' })

    await user.upload(getPortraitFileInput(), file)
    await confirmSave(user)

    expect(saveAndLockMemberMock).toHaveBeenCalled()
    expect(uploadMemberPhotoMock).toHaveBeenCalledWith({
      memberId: 'created-member',
      cccd: '012345678901',
      bytes: expect.any(Uint8Array),
      contentType: 'image/jpeg',
      inviteToken: 'invite-token',
      audit: { actorType: 'filler', actorId: '0901234567' },
    })
    expect(onCreated).not.toHaveBeenCalled()
    expect(screen.getByText(m.filler_save_success())).toBeTruthy()
    expect(screen.getByRole('button', { name: m.filler_save() })).toBeDisabled()

    resolveUpload({ photoPath: 'members/created-member/photo.jpg' })
    await vi.waitFor(() =>
      expect(onCreated).toHaveBeenCalledWith('created-member'),
    )
    expect(screen.getByText(m.filler_save_redirecting())).toBeTruthy()
  })

  it('keeps the files of an admin-made draft (no invite yet) for after save-and-lock', async () => {
    const user = userEvent.setup()
    uploadMemberPhotoMock.mockResolvedValue({ photoPath: 'members/m1/photo.jpg' })
    saveAndLockMemberMock.mockResolvedValue({
      member: member({ id: 'm1', status: 'locked' }),
      mode: 'updated',
    })
    const { onCreated } = renderForm({
      memberId: 'm1',
      cccd: '012345678901',
      initial: {
        ...requiredCoreBase,
        id: 'm1',
        status: 'draft',
        inviteId: null,
        documents: requiredCoreInitial.documents,
      },
    })
    const file = new File(['jpeg'], 'portrait.jpg', { type: 'image/jpeg' })

    await user.upload(getPortraitFileInput(), file)
    expect(uploadMemberPhotoMock).not.toHaveBeenCalled()
    await confirmSave(user)

    await vi.waitFor(() =>
      expect(uploadMemberPhotoMock).toHaveBeenCalledWith({
        memberId: 'm1',
        cccd: '012345678901',
        bytes: expect.any(Uint8Array),
        contentType: 'image/jpeg',
        inviteToken: 'invite-token',
        audit: { actorType: 'filler', actorId: '0901234567' },
      }),
    )
    expect(await screen.findByText(m.filler_save_success())).toBeTruthy()
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('keeps form open when portrait upload fails after create', async () => {
    const user = userEvent.setup()
    uploadMemberPhotoMock.mockRejectedValue(new Error('upload failed'))
    saveAndLockMemberMock.mockResolvedValue({
      member: member({ id: 'created-member', phapDanh: 'Minh Tâm' }),
      mode: 'created',
    })
    const { onCreated } = renderForm({
      cccd: '012345678901',
      initial: {
        ...requiredCoreBase,
        documents: {
          cccd: {
            frontPath: 'members/m1/docs/cccd/front.jpg',
            backPath: 'members/m1/docs/cccd/back.jpg',
          },
        },
      },
    })
    const file = new File(['jpeg'], 'portrait.jpg', { type: 'image/jpeg' })

    await user.upload(getPortraitFileInput(), file)
    await confirmSave(user)

    expect(
      await screen.findByText(m.filler_photo_upload_error(), { exact: false }),
    ).toBeTruthy()
    expect(screen.getByText(/Mã lỗi: [A-Z2-9]{6}/)).toBeTruthy()
    expect(onCreated).not.toHaveBeenCalled()
    expect(screen.queryByText(m.filler_save_redirecting())).toBeNull()
    expect(screen.queryByText(m.filler_save_success())).toBeNull()
  })

  it(
    'uploads pending document after successful create',
    async () => {
      const user = userEvent.setup()
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
      saveAndLockMemberMock.mockResolvedValue({
        member: member({ id: 'created-member', phapDanh: 'Minh Tâm' }),
        mode: 'created',
      })
      const { onCreated } = renderForm({
        cccd: '012345678901',
        initial: requiredCoreInitial,
      })
      const file = new File(['pdf'], 'doc.pdf', { type: 'application/pdf' })

      await pickPendingDocType(user)
      await user.upload(getDocumentFileInput(), file)
      await confirmSave(user)

      expect(saveAndLockMemberMock).toHaveBeenCalled()
      expect(uploadMemberDocumentMock).toHaveBeenCalledWith({
        memberId: 'created-member',
        cccd: '012345678901',
        typeId: 'diep_sa_di',
        side: 'file',
        bytes: expect.any(Uint8Array),
        contentType: 'application/pdf',
        inviteToken: 'invite-token',
        current: {
          cccd: {
            frontPath: 'members/m1/docs/cccd/front.jpg',
            backPath: 'members/m1/docs/cccd/back.jpg',
          },
        },
        audit: { actorType: 'filler', actorId: '0901234567' },
      })
      expect(onCreated).not.toHaveBeenCalled()

      resolveUpload({
        filePath: 'members/created-member/docs/diep_sa_di/file.pdf',
        documents: {
          diep_sa_di: {
            filePath: 'members/created-member/docs/diep_sa_di/file.pdf',
          },
        },
      })
      await vi.waitFor(() =>
        expect(onCreated).toHaveBeenCalledWith('created-member'),
      )
    },
    15_000,
  )
})
