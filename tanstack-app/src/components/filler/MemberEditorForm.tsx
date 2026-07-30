import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import type { Member, SanghaType } from '#/domain/types'
import { m } from '#/paraglide/messages'
import { fillerKeys } from '#/query/fillerKeys'
import { saveMemberDraft } from '#/use-cases/saveMemberDraft'
import { uploadMemberPhoto } from '#/use-cases/uploadMemberPhoto'
import { uploadMemberDocument } from '#/use-cases/uploadMemberDocument'
import type { DocumentSide, DocumentTypeId } from '#/domain/memberDocumentTypes'
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
  onCreated: (memberId: string) => void | Promise<void>
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
  const [postSavePending, setPostSavePending] = useState(false)
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

    setPostSavePending(true)
    try {
      const saveResult = await saveMutation.mutateAsync(patch)
      setSaveError(null)
      if (saveResult.mode === 'created') {
        setSaveSuccess(m.filler_save_success())
        let createdMember = saveResult.member
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
            createdMember = { ...createdMember, photoPath: uploadResult.photoPath }
          } catch {
            setSaveError(m.filler_photo_upload_error())
          }
        }

        const pendingDocs = api.getPendingDocuments()
        if (Object.keys(pendingDocs).length > 0) {
          try {
            for (const typeId of Object.keys(pendingDocs) as DocumentTypeId[]) {
              const sides = pendingDocs[typeId] ?? {}
              for (const side of Object.keys(sides) as DocumentSide[]) {
                const file = sides[side]
                if (!file) continue
                const bytes = new Uint8Array(await file.arrayBuffer())
                const uploadResult = await uploadMemberDocument({
                  memberId: saveResult.member.id,
                  cccd: resolvedCccd,
                  typeId,
                  side,
                  bytes,
                  contentType: file.type,
                  inviteToken: token,
                  current: api.getDocuments(),
                })
                api.setDocuments(uploadResult.documents)
                createdMember = {
                  ...createdMember,
                  documents: uploadResult.documents,
                }
              }
            }
            api.clearPendingDocuments()
          } catch {
            setSaveError(m.filler_doc_upload_error())
          }
        }

        setSaveSuccess(m.filler_save_redirecting())
        queryClient.setQueryData(
          fillerKeys.member(createdMember.id),
          createdMember,
        )
        await onCreated(createdMember.id)
        return
      }
      setSaveSuccess(m.filler_save_success())
      await queryClient.invalidateQueries({
        queryKey: fillerKeys.member(saveResult.member.id),
      })
    } catch {
      // onError handles save failure
    } finally {
      setPostSavePending(false)
    }
  }

  return (
    <FillerEditorShell
      title={title}
      status={status}
      onSave={status === 'draft' ? handleSave : undefined}
      savePending={saveMutation.isPending || postSavePending}
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
