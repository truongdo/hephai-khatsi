import { Alert } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { Temple } from '#/domain/types'
import { useFormLocalDraft } from '#/hooks/useFormLocalDraft'
import { templeDraftStorageKey } from '#/lib/formLocalDraft'
import { scheduleScrollToFirstFieldError } from '#/lib/scrollToFirstFieldError'
import { m } from '#/paraglide/messages'
import { fillerKeys } from '#/query/fillerKeys'
import type { TempleProfilePatch } from '#/repositories/templeRepo'
import { requestTempleEdit } from '#/use-cases/requestTempleEdit'
import { saveAndLockTemple } from '#/use-cases/saveAndLockTemple'
import { uploadTemplePhoto } from '#/use-cases/uploadTemplePhoto'
import {
  TempleFormFields,
  type TempleFormFieldsApi,
} from '../temple/TempleFormFields'
import { FillerSaveConfirmModal } from './FillerSaveConfirmModal'
import {
  FillerEditorShell,
  type FillerEditorStatus,
} from './FillerEditorShell'
import { buildTemplePatch, type TempleDraft } from './templeDraft'
import { validateTempleRequiredFields } from './templeRequiredValidation'

export type TempleEditorFormProps = {
  title: string
  token: string
  orgUnitId: string
  templeId?: string
  initial: Partial<Temple> & { seedPhone?: string }
  status: FillerEditorStatus
  onCreated: (templeId: string) => void | Promise<void>
}

export function TempleEditorForm({
  title,
  token,
  orgUnitId,
  templeId,
  initial,
  status,
  onCreated,
}: TempleEditorFormProps) {
  const queryClient = useQueryClient()
  const fieldsApiRef = useRef<TempleFormFieldsApi | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [postSavePending, setPostSavePending] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [editRequestedAt, setEditRequestedAt] = useState<string | null>(
    initial.editRequestedAt ?? null,
  )
  const [requestEditSuccess, setRequestEditSuccess] = useState<string | null>(
    null,
  )
  const [requestEditError, setRequestEditError] = useState<string | null>(null)
  const disabled = status === 'view'
  const requestPhone =
    initial.seedPhone ?? initial.truTriHienNay?.dienThoai ?? ''

  const storageKey = useMemo(() => {
    if (templeId) {
      return templeDraftStorageKey({ kind: 'existing', templeId })
    }
    return templeDraftStorageKey({
      kind: 'new',
      orgUnitId,
      actorId: requestPhone,
    })
  }, [templeId, orgUnitId, requestPhone])

  const handleLocalDraftRestore = useCallback((fields: TempleDraft) => {
    fieldsApiRef.current?.restoreDraft(fields)
  }, [])

  const { persist, clear, restored } = useFormLocalDraft<TempleDraft>({
    storageKey,
    enabled: status === 'draft',
    hasServerData: !!templeId,
    onRestore: handleLocalDraftRestore,
  })

  const handleDraftChange = useCallback(
    (draft: TempleDraft) => {
      setValidationError(null)
      persist(draft)
    },
    [persist],
  )

  const saveMutation = useMutation({
    mutationFn: ({
      patch,
      explicitPhones,
    }: {
      patch: TempleProfilePatch
      explicitPhones: string[]
    }) =>
      saveAndLockTemple({
        token,
        orgUnitId,
        templeId,
        patch,
        explicitPhones,
      }),
    onError: () => {
      setSaveSuccess(null)
      setValidationError(null)
      setSaveError(m.filler_save_error())
    },
  })

  const requestEditMutation = useMutation({
    mutationFn: () => {
      if (!templeId) {
        throw new Error('templeId required')
      }
      return requestTempleEdit({ templeId, phone: requestPhone })
    },
    onSuccess: (temple) => {
      setRequestEditError(null)
      setEditRequestedAt(temple.editRequestedAt)
      setRequestEditSuccess(m.filler_request_edit_done())
      queryClient.setQueryData(fillerKeys.temple(temple.id), temple)
    },
    onError: () => {
      setRequestEditSuccess(null)
      setRequestEditError(m.filler_request_edit_error())
    },
  })

  const performSave = async () => {
    const api = fieldsApiRef.current
    if (!api) return

    const draft = api.getDraft()
    const patch = buildTemplePatch(draft)
    const explicitPhones = api.getExtraManagerPhone().trim()
      ? [api.getExtraManagerPhone().trim()]
      : []

    setPostSavePending(true)
    try {
      const saveResult = await saveMutation.mutateAsync({ patch, explicitPhones })
      setSaveError(null)
      setValidationError(null)
      clear()
      let savedTemple = saveResult.temple

      if (saveResult.mode === 'created') {
        setSaveSuccess(m.filler_save_success())
        const pendingPhoto = api.getPendingPhoto()
        if (pendingPhoto) {
          try {
            const bytes = new Uint8Array(await pendingPhoto.arrayBuffer())
            const uploadResult = await uploadTemplePhoto({
              templeId: saveResult.temple.id,
              bytes,
              contentType: pendingPhoto.type,
              inviteToken: token,
            })
            api.setPhotoPath(uploadResult.photoPath)
            api.clearPendingPhoto()
            savedTemple = { ...savedTemple, photoPath: uploadResult.photoPath }
          } catch {
            setValidationError(null)
            setSaveError(m.filler_photo_upload_error())
          }
        }
        setSaveSuccess(m.filler_save_redirecting())
        queryClient.setQueryData(fillerKeys.temple(savedTemple.id), savedTemple)
        await onCreated(savedTemple.id)
        return
      }

      setSaveSuccess(m.filler_save_success())
      queryClient.setQueryData(fillerKeys.temple(savedTemple.id), savedTemple)
    } catch {
      // onError handles save failure
    } finally {
      setPostSavePending(false)
      setConfirmOpen(false)
    }
  }

  const handleSave = () => {
    const api = fieldsApiRef.current
    if (!api) return

    const draft = api.getDraft()
    const result = validateTempleRequiredFields({
      danhHieu: draft.danhHieu,
      nguoiKhaiSon: draft.nguoiKhaiSon,
      namThanhLap: draft.namThanhLap,
      diaChiCu: draft.diaChiCu,
      diaChiMoi: draft.diaChiMoi,
      truTriHienNay: draft.truTriHienNay,
      truTriTienNhiem: draft.truTriTienNhiem,
      tangSoHienTru: draft.tangSoHienTru,
      soPhatTuQuyY: draft.soPhatTuQuyY,
      soPhatTuThuongXuyen: draft.soPhatTuThuongXuyen,
      hasPhoto: !!(api.getPhotoPath() || api.getPendingPhoto()),
    })
    if (!result.valid) {
      api.setFieldErrors(result.errors)
      setSaveError(null)
      setSaveSuccess(null)
      setValidationError(m.filler_validation_incomplete())
      scheduleScrollToFirstFieldError()
      return
    }
    api.clearFieldErrors()
    setValidationError(null)
    setConfirmOpen(true)
  }

  const handleConfirmSave = () => {
    void performSave()
  }

  const handleRequestEdit = () => {
    if (!templeId || editRequestedAt) return
    requestEditMutation.mutate()
  }

  return (
    <>
      <FillerEditorShell
        title={title}
        status={status}
        onSave={status === 'draft' ? handleSave : undefined}
        savePending={saveMutation.isPending || postSavePending}
        saveError={saveError}
        saveSuccess={saveSuccess}
        validationError={validationError}
        onRequestEdit={status === 'view' && templeId ? handleRequestEdit : undefined}
        requestEditPending={requestEditMutation.isPending}
        editRequestedAt={editRequestedAt}
        requestEditSuccess={requestEditSuccess}
        requestEditError={requestEditError}
      >
        {restored ? (
          <Alert color="blue" variant="light">
            {m.filler_local_draft_restored()}
          </Alert>
        ) : null}
        <TempleFormFields
          apiRef={fieldsApiRef}
          initial={initial}
          disabled={disabled}
          templeId={templeId}
          inviteToken={token}
          onUploadError={setSaveError}
          onDraftChange={handleDraftChange}
        />
      </FillerEditorShell>
      <FillerSaveConfirmModal
        opened={confirmOpen}
        loading={saveMutation.isPending || postSavePending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirmSave}
      />
    </>
  )
}
