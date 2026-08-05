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
import type { AuditActor } from '#/domain/auditLog'
import { deleteTemplePhoto } from '#/use-cases/deleteTemplePhoto'
import { uploadTemplePhoto } from '#/use-cases/uploadTemplePhoto'
import { PhotoDeleteConfirmModal } from '../filler/PhotoDeleteConfirmModal'
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
  /** Firestore updatedAt — busts CDN/browser cache after replace. */
  photoUpdatedAt?: string | null
  disabled?: boolean
  pendingFile: File | null
  onPendingFileChange: (file: File | null) => void
  onPhotoPathChange: (photoPath: string | null) => void
  onUploadError?: (message: string) => void
  required?: boolean
  error?: string
  audit?: AuditActor
}

export function TemplePortraitField({
  templeId,
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
  audit,
}: TemplePortraitFieldProps) {
  const [typeError, setTypeError] = useState<string | null>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadBust, setUploadBust] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setUploadBust(null)
  }, [templeId])

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
        getTemplePhotoDownloadUrl(photoPath, uploadBust ?? photoUpdatedAt),
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
          audit: audit ?? { actorType: 'filler', actorId: 'filler' },
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

    if (!templeId || !photoPath) {
      setConfirmOpen(false)
      return
    }

    setDeleting(true)
    try {
      const idToken = (await getIdToken?.()) ?? undefined
      await deleteTemplePhoto({
        templeId,
        inviteToken,
        idToken,
        audit: audit ?? { actorType: 'filler', actorId: 'filler' },
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
        {m.filler_field_anh_tinh_xa()}
      </Input.Label>
      <Box
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 240,
          aspectRatio: '4 / 3',
          borderRadius: 'var(--mantine-radius-sm)',
          border: '1px dashed var(--line)',
          overflow: 'hidden',
          backgroundColor: 'var(--parchment)',
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
