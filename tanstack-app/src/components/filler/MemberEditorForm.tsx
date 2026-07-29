import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import type { Member, SanghaType } from '#/domain/types'
import { m } from '#/paraglide/messages'
import { fillerKeys } from '#/query/fillerKeys'
import { saveMemberDraft } from '#/use-cases/saveMemberDraft'
import { uploadMemberPhoto } from '#/use-cases/uploadMemberPhoto'
import {
  FillerEditorShell,
  type FillerEditorStatus,
} from './FillerEditorShell'
import {
  MemberFormFields,
  type MemberFormFieldsApi,
} from './MemberFormFields'
import { buildMemberPatch } from './memberDraft'
import { validateMemberRequiredFields } from './memberRequiredValidation'

export type MemberEditorFormProps = {
  title: string
  token: string
  orgUnitId: string
  sanghaType: SanghaType
  cccd?: string
  seedPhone?: string
  memberId?: string
  initial?: Partial<Member>
  status: FillerEditorStatus
  onCreated: (memberId: string) => void
}

export function MemberEditorForm({
  title,
  token,
  orgUnitId,
  sanghaType,
  cccd,
  seedPhone,
  memberId,
  initial = {},
  status,
  onCreated,
}: MemberEditorFormProps) {
  const queryClient = useQueryClient()
  const fieldsApiRef = useRef<MemberFormFieldsApi | null>(null)
  const isCreate = !memberId
  const [cccdDraft, setCccdDraft] = useState(cccd ?? '')
  const resolvedCccd = isCreate ? cccdDraft : (cccd ?? '')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const disabled = status === 'view'

  const saveMutation = useMutation({
    mutationFn: (patch: Parameters<typeof saveMemberDraft>[0]['patch']) =>
      saveMemberDraft({
        token,
        orgUnitId,
        sanghaType,
        cccd: resolvedCccd,
        patch,
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
    const result = validateMemberRequiredFields({
      theDanh: draft.theDanh,
      phapDanh: draft.phapDanh,
      ngaySinh: draft.ngaySinh,
      noiSinh: draft.noiSinh,
      dienThoai: draft.dienThoai,
      email: draft.email,
      diaChiThuongTru: draft.diaChiThuongTru,
      ngayXuatGia: draft.ngayXuatGia,
      noiXuatGia: draft.noiXuatGia,
      hienTuHoc: draft.hienTuHoc,
      bonSu: draft.bonSu,
    })
    if (!result.valid) {
      api.setFieldErrors(result.errors)
      return
    }
    api.clearFieldErrors()

    const patch = buildMemberPatch(draft)

    try {
      const saveResult = await saveMutation.mutateAsync(patch)
      setSaveError(null)
      if (saveResult.mode === 'created') {
        const pendingPhoto = api.getPendingPhoto()
        if (pendingPhoto) {
          try {
            const bytes = new Uint8Array(await pendingPhoto.arrayBuffer())
            const uploadResult = await uploadMemberPhoto({
              memberId: saveResult.member.id,
              cccd: resolvedCccd,
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
        onCreated(saveResult.member.id)
        return
      }
      setSaveSuccess(m.filler_save_success())
      await queryClient.invalidateQueries({
        queryKey: fillerKeys.member(saveResult.member.id),
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
      <MemberFormFields
        apiRef={fieldsApiRef}
        initial={{
          ...initial,
          dienThoai: initial.dienThoai ?? seedPhone,
        }}
        disabled={disabled}
        memberId={memberId}
        cccd={resolvedCccd}
        onCccdChange={isCreate ? setCccdDraft : undefined}
        sanghaType={sanghaType}
        inviteToken={token}
        onUploadError={setSaveError}
      />
    </FillerEditorShell>
  )
}
