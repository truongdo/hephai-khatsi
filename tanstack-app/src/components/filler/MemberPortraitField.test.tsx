import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { m } from '#/paraglide/messages'
import { deleteMemberPhoto } from '#/use-cases/deleteMemberPhoto'
import { uploadMemberPhoto } from '#/use-cases/uploadMemberPhoto'
import { theme } from '../../theme'
import { getMemberPhotoDownloadUrl } from './memberPhotoUrl'
import {
  MemberPortraitField,
  type MemberPortraitFieldProps,
} from './MemberPortraitField'

vi.mock('#/use-cases/uploadMemberPhoto', () => ({
  uploadMemberPhoto: vi.fn(),
}))

vi.mock('#/use-cases/deleteMemberPhoto', () => ({
  deleteMemberPhoto: vi.fn(),
}))

vi.mock('./memberPhotoUrl', () => ({
  getMemberPhotoDownloadUrl: vi.fn(() => 'https://cdn.example/p.jpg'),
}))

const uploadMemberPhotoMock = vi.mocked(uploadMemberPhoto)
const deleteMemberPhotoMock = vi.mocked(deleteMemberPhoto)
const getMemberPhotoDownloadUrlMock = vi.mocked(getMemberPhotoDownloadUrl)

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
  uploadMemberPhotoMock.mockReset()
  deleteMemberPhotoMock.mockReset()
  getMemberPhotoDownloadUrlMock.mockClear()
})

function renderField(
  props: Partial<MemberPortraitFieldProps> = {},
) {
  const onPendingFileChange = vi.fn()
  const onPhotoPathChange = vi.fn()

  const defaultProps: MemberPortraitFieldProps = {
    cccd: '123456789012',
    photoPath: null,
    pendingFile: null,
    onPendingFileChange,
    onPhotoPathChange,
    ...props,
  }

  render(
    <MantineProvider theme={theme} defaultColorScheme="light">
      <MemberPortraitField {...defaultProps} />
    </MantineProvider>,
  )

  return { onPendingFileChange, onPhotoPathChange }
}

function getFileInput() {
  const input = document.querySelector('input[type="file"]')
  if (!input) throw new Error('file input not found')
  return input as HTMLInputElement
}

describe('MemberPortraitField', () => {
  it('without memberId: selecting a jpeg file calls onPendingFileChange with the File', async () => {
    const { onPendingFileChange } = renderField()
    const file = new File(['jpeg'], 'portrait.jpg', { type: 'image/jpeg' })

    await userEvent.upload(getFileInput(), file)

    expect(onPendingFileChange).toHaveBeenCalledOnce()
    expect(onPendingFileChange).toHaveBeenCalledWith(file)
    expect(uploadMemberPhotoMock).not.toHaveBeenCalled()
  })

  it('with memberId + inviteToken: selecting a file calls uploadMemberPhoto with inviteToken', async () => {
    uploadMemberPhotoMock.mockResolvedValue({
      photoPath: 'members/m1/photo.jpg',
    })
    const { onPhotoPathChange, onPendingFileChange } = renderField({
      memberId: 'm1',
      inviteToken: 'invite-token',
    })
    const file = new File(['jpeg'], 'portrait.jpg', { type: 'image/jpeg' })

    await userEvent.upload(getFileInput(), file)

    expect(uploadMemberPhotoMock).toHaveBeenCalledOnce()
    expect(uploadMemberPhotoMock).toHaveBeenCalledWith({
      memberId: 'm1',
      cccd: '123456789012',
      bytes: expect.any(Uint8Array),
      contentType: 'image/jpeg',
      inviteToken: 'invite-token',
      idToken: undefined,
    })
    expect(onPhotoPathChange).toHaveBeenCalledWith('members/m1/photo.jpg')
    expect(onPendingFileChange).not.toHaveBeenCalled()
  })

  it('with memberId + getIdToken: awaits token and passes idToken to uploadMemberPhoto', async () => {
    uploadMemberPhotoMock.mockResolvedValue({
      photoPath: 'members/m1/photo.jpg',
    })
    const getIdToken = vi.fn().mockResolvedValue('admin-id-token')
    const { onPhotoPathChange } = renderField({
      memberId: 'm1',
      getIdToken,
    })
    const file = new File(['jpeg'], 'portrait.jpg', { type: 'image/jpeg' })

    await userEvent.upload(getFileInput(), file)

    expect(getIdToken).toHaveBeenCalledOnce()
    expect(uploadMemberPhotoMock).toHaveBeenCalledWith({
      memberId: 'm1',
      cccd: '123456789012',
      bytes: expect.any(Uint8Array),
      contentType: 'image/jpeg',
      inviteToken: undefined,
      idToken: 'admin-id-token',
    })
    expect(onPhotoPathChange).toHaveBeenCalledWith('members/m1/photo.jpg')
  })

  it('rejecting .gif shows filler_photo_invalid_type', () => {
    const { onPendingFileChange } = renderField()
    const file = new File(['gif'], 'portrait.gif', { type: 'image/gif' })

    // userEvent.upload skips files that do not match accept; fire change directly.
    fireEvent.change(getFileInput(), { target: { files: [file] } })

    expect(screen.getByText(m.filler_photo_invalid_type())).toBeTruthy()
    expect(onPendingFileChange).not.toHaveBeenCalled()
    expect(uploadMemberPhotoMock).not.toHaveBeenCalled()
  })

  it('passes photoUpdatedAt as cache bust when loading an existing photo', () => {
    renderField({
      photoPath: 'members/m1/photo.jpg',
      photoUpdatedAt: '2026-07-25T12:00:00.000Z',
    })

    expect(getMemberPhotoDownloadUrlMock).toHaveBeenCalledWith(
      'members/m1/photo.jpg',
      '2026-07-25T12:00:00.000Z',
    )
  })

  it('after replace upload, rebuilds download URL with a fresh cache bust', async () => {
    uploadMemberPhotoMock.mockResolvedValue({
      photoPath: 'members/m1/photo.jpg',
    })
    renderField({
      memberId: 'm1',
      photoPath: 'members/m1/photo.jpg',
      photoUpdatedAt: '2026-07-25T12:00:00.000Z',
    })
    getMemberPhotoDownloadUrlMock.mockClear()

    const file = new File(['jpeg'], 'portrait.jpg', { type: 'image/jpeg' })
    await userEvent.upload(getFileInput(), file)

    expect(getMemberPhotoDownloadUrlMock).toHaveBeenCalled()
    const [, cacheBust] = getMemberPhotoDownloadUrlMock.mock.calls.at(-1)!
    expect(cacheBust).not.toBe('2026-07-25T12:00:00.000Z')
    expect(String(cacheBust)).toMatch(/^\d+$/)
  })

  it('clears pending file after confirm delete without calling API', async () => {
    const user = userEvent.setup()
    const file = new File(['jpeg'], 'portrait.jpg', { type: 'image/jpeg' })
    const { onPendingFileChange } = renderField({ pendingFile: file })

    await user.click(screen.getByRole('button', { name: m.filler_photo_delete() }))
    const dialog = await screen.findByRole('dialog')
    await user.click(
      within(dialog).getByRole('button', {
        name: m.filler_photo_delete_confirm_action(),
      }),
    )

    expect(onPendingFileChange).toHaveBeenCalledWith(null)
    expect(deleteMemberPhotoMock).not.toHaveBeenCalled()
  })

  it('deletes uploaded photo after confirm', async () => {
    const user = userEvent.setup()
    deleteMemberPhotoMock.mockResolvedValue(undefined)
    const { onPhotoPathChange } = renderField({
      memberId: 'm1',
      inviteToken: 'invite-token',
      photoPath: 'members/m1/photo.jpg',
    })

    await user.click(screen.getByRole('button', { name: m.filler_photo_delete() }))
    const dialog = await screen.findByRole('dialog')
    await user.click(
      within(dialog).getByRole('button', {
        name: m.filler_photo_delete_confirm_action(),
      }),
    )

    expect(deleteMemberPhotoMock).toHaveBeenCalledWith({
      memberId: 'm1',
      cccd: '123456789012',
      inviteToken: 'invite-token',
      idToken: undefined,
    })
    expect(onPhotoPathChange).toHaveBeenCalledWith(null)
  })
})
