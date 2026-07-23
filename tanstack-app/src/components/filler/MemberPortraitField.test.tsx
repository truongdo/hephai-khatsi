import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { m } from '#/paraglide/messages'
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

vi.mock('./memberPhotoUrl', () => ({
  getMemberPhotoDownloadUrl: vi.fn(async () => 'https://cdn.example/p.jpg'),
}))

const uploadMemberPhotoMock = vi.mocked(uploadMemberPhoto)
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
  getMemberPhotoDownloadUrlMock.mockClear()
})

function renderField(
  props: Partial<MemberPortraitFieldProps> = {},
) {
  const onPendingFileChange = vi.fn()
  const onPhotoPathChange = vi.fn()

  const defaultProps: MemberPortraitFieldProps = {
    cccd: '123456789012',
    inviteToken: 'invite-token',
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

  it('with memberId: selecting a file calls uploadMemberPhoto and onPhotoPathChange', async () => {
    uploadMemberPhotoMock.mockResolvedValue({
      photoPath: 'members/m1/photo.jpg',
    })
    const { onPhotoPathChange, onPendingFileChange } = renderField({
      memberId: 'm1',
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
    })
    expect(onPhotoPathChange).toHaveBeenCalledWith('members/m1/photo.jpg')
    expect(onPendingFileChange).not.toHaveBeenCalled()
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
})
