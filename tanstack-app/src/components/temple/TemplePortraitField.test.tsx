import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { m } from '#/paraglide/messages'
import { uploadTemplePhoto } from '#/use-cases/uploadTemplePhoto'
import { theme } from '../../theme'
import { getTemplePhotoDownloadUrl } from './templePhotoUrl'
import {
  TemplePortraitField,
  type TemplePortraitFieldProps,
} from './TemplePortraitField'

vi.mock('#/use-cases/uploadTemplePhoto', () => ({
  uploadTemplePhoto: vi.fn(),
}))

vi.mock('./templePhotoUrl', () => ({
  getTemplePhotoDownloadUrl: vi.fn(() => 'https://cdn.example/p.jpg'),
}))

const uploadTemplePhotoMock = vi.mocked(uploadTemplePhoto)
const getTemplePhotoDownloadUrlMock = vi.mocked(getTemplePhotoDownloadUrl)

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
  uploadTemplePhotoMock.mockReset()
  getTemplePhotoDownloadUrlMock.mockClear()
})

function renderField(props: Partial<TemplePortraitFieldProps> = {}) {
  const onPendingFileChange = vi.fn()
  const onPhotoPathChange = vi.fn()

  const defaultProps: TemplePortraitFieldProps = {
    photoPath: null,
    pendingFile: null,
    onPendingFileChange,
    onPhotoPathChange,
    ...props,
  }

  render(
    <MantineProvider theme={theme} defaultColorScheme="light">
      <TemplePortraitField {...defaultProps} />
    </MantineProvider>,
  )

  return { onPendingFileChange, onPhotoPathChange }
}

function getFileInput() {
  const input = document.querySelector('input[type="file"]')
  if (!input) throw new Error('file input not found')
  return input as HTMLInputElement
}

describe('TemplePortraitField', () => {
  it('without templeId: selecting a jpeg file calls onPendingFileChange with the File', async () => {
    const { onPendingFileChange } = renderField()
    const file = new File(['jpeg'], 'portrait.jpg', { type: 'image/jpeg' })

    await userEvent.upload(getFileInput(), file)

    expect(onPendingFileChange).toHaveBeenCalledOnce()
    expect(onPendingFileChange).toHaveBeenCalledWith(file)
    expect(uploadTemplePhotoMock).not.toHaveBeenCalled()
  })

  it('with templeId + inviteToken: selecting a file calls uploadTemplePhoto with inviteToken', async () => {
    uploadTemplePhotoMock.mockResolvedValue({
      photoPath: 'temples/t1/photo.jpg',
    })
    const { onPhotoPathChange, onPendingFileChange } = renderField({
      templeId: 't1',
      inviteToken: 'invite-token',
    })
    const file = new File(['jpeg'], 'portrait.jpg', { type: 'image/jpeg' })

    await userEvent.upload(getFileInput(), file)

    expect(uploadTemplePhotoMock).toHaveBeenCalledOnce()
    expect(uploadTemplePhotoMock).toHaveBeenCalledWith({
      templeId: 't1',
      bytes: expect.any(Uint8Array),
      contentType: 'image/jpeg',
      inviteToken: 'invite-token',
      idToken: undefined,
      audit: { actorType: 'filler', actorId: 'filler' },
    })
    expect(onPhotoPathChange).toHaveBeenCalledWith('temples/t1/photo.jpg')
    expect(onPendingFileChange).not.toHaveBeenCalled()
  })

  it('with templeId + getIdToken: awaits token and passes idToken to uploadTemplePhoto', async () => {
    uploadTemplePhotoMock.mockResolvedValue({
      photoPath: 'temples/t1/photo.jpg',
    })
    const getIdToken = vi.fn().mockResolvedValue('admin-id-token')
    const { onPhotoPathChange } = renderField({
      templeId: 't1',
      getIdToken,
    })
    const file = new File(['jpeg'], 'portrait.jpg', { type: 'image/jpeg' })

    await userEvent.upload(getFileInput(), file)

    expect(getIdToken).toHaveBeenCalledOnce()
    expect(uploadTemplePhotoMock).toHaveBeenCalledWith({
      templeId: 't1',
      bytes: expect.any(Uint8Array),
      contentType: 'image/jpeg',
      inviteToken: undefined,
      idToken: 'admin-id-token',
      audit: { actorType: 'filler', actorId: 'filler' },
    })
    expect(onPhotoPathChange).toHaveBeenCalledWith('temples/t1/photo.jpg')
  })

  it('rejecting .gif shows filler_photo_invalid_type', () => {
    const { onPendingFileChange } = renderField()
    const file = new File(['gif'], 'portrait.gif', { type: 'image/gif' })

    fireEvent.change(getFileInput(), { target: { files: [file] } })

    expect(screen.getByText(m.filler_photo_invalid_type())).toBeTruthy()
    expect(onPendingFileChange).not.toHaveBeenCalled()
    expect(uploadTemplePhotoMock).not.toHaveBeenCalled()
  })

  it('with templeId: upload failure calls onUploadError', async () => {
    uploadTemplePhotoMock.mockRejectedValue(new Error('upload failed'))
    const onUploadError = vi.fn()
    renderField({
      templeId: 't1',
      inviteToken: 'invite-token',
      onUploadError,
    })
    const file = new File(['jpeg'], 'portrait.jpg', { type: 'image/jpeg' })

    await userEvent.upload(getFileInput(), file)

    expect(onUploadError).toHaveBeenCalledOnce()
    expect(onUploadError).toHaveBeenCalledWith(m.filler_photo_upload_error())
  })

  it('shows required label and validation error', () => {
    renderField({
      required: true,
      error: m.filler_error_field_required(),
    })
    expect(screen.getByText(m.filler_field_anh_tinh_xa())).toBeTruthy()
    expect(screen.getByText(m.filler_error_field_required())).toBeTruthy()
  })
})
