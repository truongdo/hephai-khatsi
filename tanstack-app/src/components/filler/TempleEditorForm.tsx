import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import type { Temple } from '#/domain/types'
import { m } from '#/paraglide/messages'
import { fillerKeys } from '#/query/fillerKeys'
import type { TempleProfilePatch } from '#/repositories/templeRepo'
import { saveTempleDraft } from '#/use-cases/saveTempleDraft'
import { uploadTemplePhoto } from '#/use-cases/uploadTemplePhoto'
import {
  TempleFormFields,
  type TempleFormFieldsApi,
} from '../temple/TempleFormFields'
import {
  FillerEditorShell,
  type FillerEditorStatus,
} from './FillerEditorShell'
import { buildTemplePatch } from './templeDraft'
import { validateTempleRequiredFields } from './templeRequiredValidation'

export type TempleEditorFormProps = {
  title: string
  token: string
  orgUnitId: string
  templeId?: string
  initial: Partial<Temple> & { seedPhone?: string }
  status: FillerEditorStatus
  onCreated: (templeId: string) => void
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
  const disabled = status === 'view'

  const saveMutation = useMutation({
    mutationFn: ({
      patch,
      explicitPhones,
    }: {
      patch: TempleProfilePatch
      explicitPhones: string[]
    }) =>
      saveTempleDraft({
        token,
        orgUnitId,
        templeId,
        patch,
        explicitPhones,
      }),
    onError: () => {
      setSaveSuccess(null)
      setSaveError(m.filler_save_error())
    },
  })

  const handleSave = async () => {
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
    })
    if (!result.valid) {
      api.setFieldErrors(result.errors)
      return
    }
    api.clearFieldErrors()

    const patch = buildTemplePatch(draft)
    const explicitPhones = api.getExtraManagerPhone().trim()
      ? [api.getExtraManagerPhone().trim()]
      : []

    try {
      const saveResult = await saveMutation.mutateAsync({ patch, explicitPhones })
      setSaveError(null)
      if (saveResult.mode === 'created') {
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
          } catch {
            setSaveError(m.filler_photo_upload_error())
          }
        }
        onCreated(saveResult.temple.id)
        return
      }
      setSaveSuccess(m.filler_save_success())
      await queryClient.invalidateQueries({
        queryKey: fillerKeys.temple(saveResult.temple.id),
      })
    } catch {
      // onError handles save failure
    }
  }

  return (
    <FillerEditorShell
      title={title}
      status={status}
      onSave={status === 'draft' ? handleSave : undefined}
      savePending={saveMutation.isPending}
      saveError={saveError}
      saveSuccess={saveSuccess}
    >
      <TempleFormFields
        apiRef={fieldsApiRef}
        initial={initial}
        disabled={disabled}
        templeId={templeId}
        inviteToken={token}
      />
    </FillerEditorShell>
  )
}
