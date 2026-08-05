import {
  ActionIcon,
  Box,
  Button,
  FileButton,
  Image,
  Input,
  Stack,
  Text,
} from '@mantine/core'
import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { m } from '#/paraglide/messages'
import { deleteMemberPhoto } from '#/use-cases/deleteMemberPhoto'
import { uploadMemberPhoto } from '#/use-cases/uploadMemberPhoto'
import { getMemberPhotoDownloadUrl } from './memberPhotoUrl'
import { PhotoDeleteConfirmModal } from './PhotoDeleteConfirmModal'

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/jpg'])

function isAcceptedImageType(type: string): boolean {
  return ACCEPTED_TYPES.has(type)
}

export type MemberPortraitFieldProps = {
  memberId?: string
  cccd: string
  inviteToken?: string
  /** Async admin token provider — prefer this over a stale string prop. */
  getIdToken?: () => Promise<string | undefined>
  photoPath: string | null
  /** Firestore updatedAt — busts CDN/browser cache after replace. */
  photoUpdatedAt?: string | null
  disabled?: boolean
  pendingFile: File | null
  onPendingFileChange: (file: File | null) => void
  onPhotoPathChange: (photoPath: string | null) => void
  onUploadError?: (message: string) => void
  required?: boolean
  error?: string
}

export function MemberPortraitField({
  memberId,
  cccd,
  inviteToken,
  getIdToken,
  photoPath,
  photoUpdatedAt = null,
  disabled = false,
  pendingFile,
  onPendingFileChange,
  onPhotoPathChange,
  onUploadError,
  required = false,
  error,
}: MemberPortraitFieldProps) {
  const [typeError, setTypeError] = useState<string | null>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadBust, setUploadBust] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setUploadBust(null)
  }, [memberId])

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
      setDownloadUrl(
        getMemberPhotoDownloadUrl(photoPath, uploadBust ?? photoUpdatedAt),
      )
    } catch {
      setDownloadUrl(null)
    }
  }, [photoPath, pendingFile, uploadBust, photoUpdatedAt])

  const previewUrl = objectUrl ?? downloadUrl
  const hasPhoto = Boolean(previewUrl)

  async function handleFileSelected(file: File | null) {
    if (!file) return

    if (!isAcceptedImageType(file.type)) {
      setTypeError(m.filler_photo_invalid_type())
      return
    }

    setTypeError(null)

    if (memberId && cccd) {
      setUploading(true)
      try {
        const bytes = new Uint8Array(await file.arrayBuffer())
        const idToken = (await getIdToken?.()) ?? undefined
        const result = await uploadMemberPhoto({
          memberId,
          cccd,
          bytes,
          contentType: file.type,
          inviteToken,
          idToken,
        })
        setUploadBust(String(Date.now()))
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

  async function handleConfirmDelete() {
    if (pendingFile) {
      onPendingFileChange(null)
      setConfirmOpen(false)
      return
    }

    if (!memberId || !photoPath) {
      setConfirmOpen(false)
      return
    }

    setDeleting(true)
    try {
      const idToken = (await getIdToken?.()) ?? undefined
      await deleteMemberPhoto({
        memberId,
        cccd,
        inviteToken,
        idToken,
      })
      onPhotoPathChange(null)
      setConfirmOpen(false)
    } catch {
      onUploadError?.(m.filler_photo_delete_error())
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Stack gap="xs" align="flex-start">
      <Input.Label required={required}>
        {m.filler_field_anh_chan_dung()}
      </Input.Label>
      <Text size="xs" c="dimmed">
        {m.filler_desc_anh_chan_dung()}
      </Text>
      <Box
        style={{
          position: 'relative',
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
            alt={m.filler_field_anh_chan_dung()}
            fit="cover"
            w="100%"
            h="100%"
          />
        ) : null}
        {hasPhoto && !disabled ? (
          <ActionIcon
            aria-label={m.filler_photo_delete()}
            color="red"
            variant="filled"
            size="sm"
            radius="xl"
            disabled={uploading || deleting}
            onClick={() => setConfirmOpen(true)}
            style={{ position: 'absolute', top: 6, right: 6 }}
          >
            <Trash2 size={14} />
          </ActionIcon>
        ) : null}
      </Box>
      {!disabled ? (
        <FileButton
          onChange={handleFileSelected}
          accept="image/jpeg,image/png"
          disabled={uploading || deleting}
        >
          {(props) => (
            <Button {...props} variant="light" size="xs" loading={uploading}>
              {hasPhoto ? m.filler_photo_change() : m.filler_photo_choose()}
            </Button>
          )}
        </FileButton>
      ) : null}
      {error ? (
        <Text size="sm" c="red" data-field-error="true">
          {error}
        </Text>
      ) : null}
      {typeError ? (
        <Text size="sm" c="red">
          {typeError}
        </Text>
      ) : null}
      <PhotoDeleteConfirmModal
        opened={confirmOpen}
        loading={deleting}
        onCancel={() => {
          if (!deleting) setConfirmOpen(false)
        }}
        onConfirm={() => {
          void handleConfirmDelete()
        }}
      />
    </Stack>
  )
}
