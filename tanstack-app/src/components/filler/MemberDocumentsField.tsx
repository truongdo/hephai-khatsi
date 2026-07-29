import {
  Anchor,
  Button,
  Divider,
  FileButton,
  Group,
  Paper,
  Select,
  Stack,
  Text,
} from '@mantine/core'
import { useEffect, useMemo, useState } from 'react'
import {
  getDocumentType,
  MEMBER_DOCUMENT_MAX_BYTES,
  MEMBER_DOCUMENT_TYPES,
  pathFieldForSide,
  type DocumentSide,
  type DocumentTypeId,
  type MemberDocumentFiles,
  type MemberDocuments,
} from '#/domain/memberDocumentTypes'
import { m } from '#/paraglide/messages'
import { deleteMemberDocument } from '#/use-cases/deleteMemberDocument'
import { uploadMemberDocument } from '#/use-cases/uploadMemberDocument'
import { documentTypeLabel } from './memberDocumentLabels'
import { getMemberDocumentDownloadUrl } from './memberDocumentUrl'

const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/jpg',
  'application/pdf',
])

const FILE_ACCEPT = 'image/jpeg,image/png,application/pdf'

export type PendingDocumentFiles = Partial<
  Record<DocumentTypeId, Partial<Record<DocumentSide, File>>>
>

export type MemberDocumentsFieldProps = {
  memberId?: string
  cccd: string
  inviteToken?: string
  getIdToken?: () => Promise<string | undefined>
  documents: MemberDocuments
  onDocumentsChange: (next: MemberDocuments) => void
  pendingFiles: PendingDocumentFiles
  onPendingFilesChange: (next: PendingDocumentFiles) => void
  disabled?: boolean
  onUploadError?: (message: string) => void
}

function hasAnyDocumentFiles(files?: MemberDocumentFiles): boolean {
  if (!files) return false
  return Boolean(files.frontPath || files.backPath || files.filePath)
}

function hasAnyPendingFiles(
  files?: Partial<Record<DocumentSide, File>>,
): boolean {
  if (!files) return false
  return Boolean(files.front || files.back || files.file)
}

function isTypeAttached(
  typeId: DocumentTypeId,
  documents: MemberDocuments,
  pendingFiles: PendingDocumentFiles,
): boolean {
  return (
    hasAnyDocumentFiles(documents[typeId]) ||
    hasAnyPendingFiles(pendingFiles[typeId])
  )
}

function sideLabel(side: DocumentSide): string {
  if (side === 'front') return m.filler_doc_side_front()
  if (side === 'back') return m.filler_doc_side_back()
  return m.filler_doc_side_file()
}

function sidesForType(typeId: DocumentTypeId): DocumentSide[] {
  const docType = getDocumentType(typeId)
  if (!docType) return []
  if (docType.sides === 'frontBack') return ['front', 'back']
  return ['file']
}

function isAcceptedFileType(type: string): boolean {
  return ACCEPTED_TYPES.has(type)
}

function basenameFromPath(path: string): string {
  const segment = path.split('/').pop()
  return segment && segment.length > 0 ? segment : path
}

function PendingFileLink({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  if (!url) return null

  return (
    <Anchor href={url} target="_blank" rel="noopener noreferrer" size="sm">
      {file.name}
    </Anchor>
  )
}

export function MemberDocumentsField({
  memberId,
  cccd,
  inviteToken,
  getIdToken,
  documents,
  onDocumentsChange,
  pendingFiles,
  onPendingFilesChange,
  disabled = false,
  onUploadError,
}: MemberDocumentsFieldProps) {
  const [selectedTypeId, setSelectedTypeId] = useState<DocumentTypeId | null>(
    null,
  )
  const [validationError, setValidationError] = useState<string | null>(null)
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const [removingTypeId, setRemovingTypeId] = useState<DocumentTypeId | null>(
    null,
  )

  const availableOptions = useMemo(
    () =>
      MEMBER_DOCUMENT_TYPES.filter(
        (type) => !isTypeAttached(type.id, documents, pendingFiles),
      ).map((type) => ({
        value: type.id,
        label: documentTypeLabel(type.id),
      })),
    [documents, pendingFiles],
  )

  const attachedTypeIds = useMemo(
    () =>
      MEMBER_DOCUMENT_TYPES.map((type) => type.id).filter((typeId) =>
        isTypeAttached(typeId, documents, pendingFiles),
      ),
    [documents, pendingFiles],
  )

  const selectedType = selectedTypeId ? getDocumentType(selectedTypeId) : null

  async function handleFileSelected(
    typeId: DocumentTypeId,
    side: DocumentSide,
    file: File | null,
    options?: { clearSelect?: boolean },
  ) {
    if (!file) return

    if (!isAcceptedFileType(file.type)) {
      setValidationError(m.filler_doc_invalid_type())
      return
    }

    if (file.size > MEMBER_DOCUMENT_MAX_BYTES) {
      setValidationError(m.filler_doc_too_large())
      return
    }

    setValidationError(null)
    const uploadKey = `${typeId}:${side}`

    if (memberId && cccd) {
      setUploadingKey(uploadKey)
      try {
        const bytes = new Uint8Array(await file.arrayBuffer())
        const idToken = (await getIdToken?.()) ?? undefined
        const result = await uploadMemberDocument({
          memberId,
          cccd,
          typeId,
          side,
          bytes,
          contentType: file.type,
          inviteToken,
          idToken,
          current: documents,
        })
        onDocumentsChange(result.documents)
        if (options?.clearSelect) setSelectedTypeId(null)
      } catch {
        onUploadError?.(m.filler_doc_upload_error())
      } finally {
        setUploadingKey(null)
      }
      return
    }

    onPendingFilesChange({
      ...pendingFiles,
      [typeId]: {
        ...pendingFiles[typeId],
        [side]: file,
      },
    })
    if (options?.clearSelect) setSelectedTypeId(null)
  }

  async function handleRemoveType(typeId: DocumentTypeId) {
    if (memberId && hasAnyDocumentFiles(documents[typeId])) {
      setRemovingTypeId(typeId)
      try {
        const idToken = (await getIdToken?.()) ?? undefined
        const result = await deleteMemberDocument({
          memberId,
          cccd,
          typeId,
          current: documents,
          inviteToken,
          idToken,
        })
        onDocumentsChange(result.documents)
      } catch {
        onUploadError?.(m.filler_doc_upload_error())
      } finally {
        setRemovingTypeId(null)
      }
    }

    if (pendingFiles[typeId]) {
      const { [typeId]: _removed, ...rest } = pendingFiles
      onPendingFilesChange(rest)
    }
  }

  function pathForSide(typeId: DocumentTypeId, side: DocumentSide): string | undefined {
    const pathField = pathFieldForSide(side)
    return documents[typeId]?.[pathField]
  }

  function renderUploadSlot(
    typeId: DocumentTypeId,
    side: DocumentSide,
    options?: { clearSelect?: boolean; buttonLabel?: string; hideLabel?: boolean },
  ) {
    const uploadKey = `${typeId}:${side}`
    const loading = uploadingKey === uploadKey

    return (
      <Group key={side} gap="sm" align="center" wrap="nowrap">
        {!options?.hideLabel ? (
          <Text size="sm" style={{ minWidth: 88 }}>
            {sideLabel(side)}
          </Text>
        ) : null}
        {!disabled ? (
          <FileButton
            onChange={(file) => {
              void handleFileSelected(typeId, side, file, options)
            }}
            accept={FILE_ACCEPT}
            disabled={loading || removingTypeId === typeId}
          >
            {(props) => (
              <Button
                {...props}
                variant="light"
                size="xs"
                loading={loading}
              >
                {options?.buttonLabel ?? m.filler_doc_choose_file()}
              </Button>
            )}
          </FileButton>
        ) : null}
      </Group>
    )
  }

  return (
    <Stack gap="md" align="stretch">
      {!disabled ? (
        <Select
          label={m.filler_doc_select_label()}
          placeholder={m.filler_doc_select_placeholder()}
          data={availableOptions}
          value={selectedTypeId}
          onChange={(value) => setSelectedTypeId(value as DocumentTypeId | null)}
          searchable
          clearable
          disabled={disabled || availableOptions.length === 0}
        />
      ) : null}

      {selectedType ? (
        <Stack gap="xs">
          {sidesForType(selectedType.id).map((side) =>
            renderUploadSlot(selectedType.id, side, { clearSelect: true }),
          )}
        </Stack>
      ) : null}

      {validationError ? (
        <Text size="sm" c="red">
          {validationError}
        </Text>
      ) : null}

      {attachedTypeIds.length > 0 ? (
        <Stack gap="sm">
          <Text size="sm" fw={500}>
            {m.filler_doc_attached_heading()}
          </Text>
          {attachedTypeIds.map((typeId) => (
            <Paper key={typeId} withBorder p="sm" radius="md">
              <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
                <Text size="sm" fw={500} style={{ flex: 1, minWidth: 0 }}>
                  {documentTypeLabel(typeId)}
                </Text>
                {!disabled ? (
                  <Button
                    variant="subtle"
                    color="red"
                    size="xs"
                    loading={removingTypeId === typeId}
                    onClick={() => {
                      void handleRemoveType(typeId)
                    }}
                  >
                    {m.filler_doc_remove()}
                  </Button>
                ) : null}
              </Group>
              <Divider my="xs" />
              <Stack gap="xs">
                {sidesForType(typeId).map((side) => {
                  const path = pathForSide(typeId, side)
                  const pendingFile = pendingFiles[typeId]?.[side]
                  const hasFile = Boolean(path || pendingFile)

                  if (!hasFile) {
                    if (disabled) return null
                    return (
                      <Group
                        key={side}
                        gap="sm"
                        align="center"
                        justify="space-between"
                        wrap="wrap"
                      >
                        <Group gap="sm" align="center" wrap="wrap" style={{ flex: 1, minWidth: 0 }}>
                          <Text size="sm" c="dimmed" style={{ minWidth: 88 }}>
                            {sideLabel(side)}
                          </Text>
                          <Text size="sm" c="dimmed">
                            {m.filler_doc_missing()}
                          </Text>
                        </Group>
                        {renderUploadSlot(typeId, side, {
                          buttonLabel: m.filler_doc_choose_file(),
                          hideLabel: true,
                        })}
                      </Group>
                    )
                  }

                  const fileLink = path ? (
                    <Anchor
                      href={getMemberDocumentDownloadUrl(path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      style={{ wordBreak: 'break-all' }}
                    >
                      {basenameFromPath(path)}
                    </Anchor>
                  ) : pendingFile ? (
                    <PendingFileLink file={pendingFile} />
                  ) : null

                  return (
                    <Group
                      key={side}
                      gap="sm"
                      align="center"
                      justify="space-between"
                      wrap="wrap"
                    >
                      <Group gap="sm" align="center" wrap="wrap" style={{ flex: 1, minWidth: 0 }}>
                        <Text size="sm" c="dimmed" style={{ minWidth: 88 }}>
                          {sideLabel(side)}
                        </Text>
                        {fileLink}
                      </Group>
                      {!disabled
                        ? renderUploadSlot(typeId, side, {
                            buttonLabel: m.filler_doc_replace(),
                            hideLabel: true,
                          })
                        : null}
                    </Group>
                  )
                })}
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : null}
    </Stack>
  )
}
