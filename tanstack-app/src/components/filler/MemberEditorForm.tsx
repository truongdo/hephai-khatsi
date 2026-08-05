import { Alert } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { Member, SanghaType } from '#/domain/types'
import { useFormLocalDraft } from '#/hooks/useFormLocalDraft'
import { memberDraftStorageKey } from '#/lib/formLocalDraft'
import { scheduleScrollToFirstFieldError } from '#/lib/scrollToFirstFieldError'
import { m } from '#/paraglide/messages'
import { fillerKeys } from '#/query/fillerKeys'
import type { DocumentSide, DocumentTypeId } from '#/domain/memberDocumentTypes'
import { requestMemberEdit } from '#/use-cases/requestMemberEdit'
import { saveAndLockMember } from '#/use-cases/saveAndLockMember'
import { uploadMemberDocument } from '#/use-cases/uploadMemberDocument'
import { uploadMemberPhoto } from '#/use-cases/uploadMemberPhoto'
import { FillerSaveConfirmModal } from './FillerSaveConfirmModal'
import {
  FillerEditorShell,
  type FillerEditorStatus,
} from './FillerEditorShell'
import {
  MemberFormFields,
  type MemberFormFieldsApi,
} from './MemberFormFields'
import { buildMemberPatch, type MemberDraft } from './memberDraft'
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
  const requestPhone = seedPhone ?? initial.dienThoai ?? ''

  const storageKey = useMemo(() => {
    if (memberId) {
      return memberDraftStorageKey({ kind: 'existing', memberId })
    }
    return memberDraftStorageKey({
      kind: 'new',
      orgUnitId,
      sanghaType,
      actorId: requestPhone,
    })
  }, [memberId, orgUnitId, sanghaType, requestPhone])

  const handleLocalDraftRestore = useCallback((fields: MemberDraft) => {
    fieldsApiRef.current?.restoreDraft(fields)
  }, [])

  const { persist, clear, restored } = useFormLocalDraft<MemberDraft>({
    storageKey,
    enabled: status === 'draft',
    hasServerData: !!memberId,
    onRestore: handleLocalDraftRestore,
  })

  const handleDraftChange = useCallback(
    (draft: MemberDraft) => {
      setValidationError(null)
      persist(draft)
    },
    [persist],
  )

  const saveMutation = useMutation({
    mutationFn: (patch: Parameters<typeof saveAndLockMember>[0]['patch']) =>
      saveAndLockMember({
        token,
        orgUnitId,
        sanghaType,
        cccd: resolvedCccd,
        patch,
      }),
    onError: () => {
      setSaveSuccess(null)
      setValidationError(null)
      setSaveError(m.filler_save_error())
    },
  })

  const requestEditMutation = useMutation({
    mutationFn: () => {
      if (!memberId) {
        throw new Error('memberId required')
      }
      return requestMemberEdit({ memberId, phone: requestPhone })
    },
    onSuccess: (member) => {
      setRequestEditError(null)
      setEditRequestedAt(member.editRequestedAt)
      setRequestEditSuccess(m.filler_request_edit_done())
      queryClient.setQueryData(fillerKeys.member(member.id), member)
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
    const patch = buildMemberPatch(draft)

    setPostSavePending(true)
    try {
      const saveResult = await saveMutation.mutateAsync(patch)
      setSaveError(null)
      setValidationError(null)
      clear()
      let savedMember = saveResult.member

      if (saveResult.mode === 'created') {
        setSaveSuccess(m.filler_save_success())
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
            savedMember = { ...savedMember, photoPath: uploadResult.photoPath }
          } catch {
            setValidationError(null)
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
                savedMember = {
                  ...savedMember,
                  documents: uploadResult.documents,
                }
              }
            }
            api.clearPendingDocuments()
          } catch {
            setValidationError(null)
            setSaveError(m.filler_doc_upload_error())
          }
        }

        setSaveSuccess(m.filler_save_redirecting())
        queryClient.setQueryData(fillerKeys.member(savedMember.id), savedMember)
        await onCreated(savedMember.id)
        return
      }

      setSaveSuccess(m.filler_save_success())
      queryClient.setQueryData(fillerKeys.member(savedMember.id), savedMember)
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
    const result = validateMemberRequiredFields({
      cccd: resolvedCccd,
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
      photoPath: api.getPhotoPath(),
      pendingPhoto: api.getPendingPhoto(),
      giaDinh: {
        cha: draft.giaDinh.cha,
        me: draft.giaDinh.me,
      },
      documents: api.getDocuments(),
      pendingDocuments: api.getPendingDocuments(),
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
    if (!memberId || editRequestedAt) return
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
        onRequestEdit={status === 'view' && memberId ? handleRequestEdit : undefined}
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
        <MemberFormFields
          apiRef={fieldsApiRef}
          initial={{
            ...initial,
            dienThoai: initial.dienThoai ?? seedPhone,
          }}
          disabled={disabled}
          memberId={memberId}
          cccd={resolvedCccd}
          onCccdChange={
            isCreate
              ? (value) => {
                  setValidationError(null)
                  setCccdDraft(value)
                }
              : undefined
          }
          sanghaType={sanghaType}
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
