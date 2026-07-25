import { Box, Button, FileButton, Image, Stack, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
import { m } from '#/paraglide/messages'
import { uploadTemplePhoto } from '#/use-cases/uploadTemplePhoto'
import { getTemplePhotoDownloadUrl } from './templePhotoUrl'

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/jpg'])

function isAcceptedImageType(type: string): boolean {
  return ACCEPTED_TYPES.has(type)
}

export type TemplePortraitFieldProps = {
  templeId?: string
  inviteToken?: string
  /** Async admin token provider — prefer this over a stale string prop. */
  getIdToken?: () => Promise<string | undefined>
  photoPath: string | null
  disabled?: boolean
  pendingFile: File | null
  onPendingFileChange: (file: File | null) => void
  onPhotoPathChange: (photoPath: string) => void
  onUploadError?: (message: string) => void
}

export function TemplePortraitField({
  templeId,
  inviteToken,
  getIdToken,
  photoPath,
  disabled = false,
  pendingFile,
  onPendingFileChange,
  onPhotoPathChange,
  onUploadError,
}: TemplePortraitFieldProps) {
  const [typeError, setTypeError] = useState<string | null>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!pendingFile) {
      setObjectUrl(null)
      return
    }

    const url = URL.createObjectURL(pendingFile)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [pendingFile])

  useEffect(() => {
    if (pendingFile || !photoPath) {
      setDownloadUrl(null)
      return
    }

    try {
      setDownloadUrl(getTemplePhotoDownloadUrl(photoPath))
    } catch {
      setDownloadUrl(null)
    }
  }, [photoPath, pendingFile])

  const previewUrl = objectUrl ?? downloadUrl
  const hasPhoto = Boolean(previewUrl)

  async function handleFileSelected(file: File | null) {
    if (!file) return

    if (!isAcceptedImageType(file.type)) {
      setTypeError(m.filler_photo_invalid_type())
      return
    }

    setTypeError(null)

    if (templeId) {
      setUploading(true)
      try {
        const bytes = new Uint8Array(await file.arrayBuffer())
        const idToken = (await getIdToken?.()) ?? undefined
        const result = await uploadTemplePhoto({
          templeId,
          bytes,
          contentType: file.type,
          inviteToken,
          idToken,
        })
        onPhotoPathChange(result.photoPath)
      } catch {
        onUploadError?.(m.filler_photo_upload_error())
      } finally {
        setUploading(false)
      }
      return
    }

    onPendingFileChange(file)
  }

  return (
    <Stack gap="xs" align="flex-start">
      <Text size="sm" fw={500}>
        {m.filler_field_anh_tinh_xa()}
      </Text>
      <Box
        style={{
          width: '100%',
          maxWidth: 130,
          aspectRatio: '3 / 4',
          borderRadius: 'var(--mantine-radius-sm)',
          border: '1px dashed var(--mantine-color-gray-4)',
          overflow: 'hidden',
          backgroundColor: 'var(--mantine-color-gray-0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt={m.filler_field_anh_tinh_xa()}
            fit="cover"
            w="100%"
            h="100%"
          />
        ) : null}
      </Box>
      {!disabled ? (
        <FileButton
          onChange={handleFileSelected}
          accept="image/jpeg,image/png"
          disabled={uploading}
        >
          {(props) => (
            <Button {...props} variant="light" size="xs" loading={uploading}>
              {hasPhoto ? m.filler_photo_change() : m.filler_photo_choose()}
            </Button>
          )}
        </FileButton>
      ) : null}
      {typeError ? (
        <Text size="sm" c="red">
          {typeError}
        </Text>
      ) : null}
    </Stack>
  )
}
