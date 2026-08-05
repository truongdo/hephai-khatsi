import {
  Button,
  Group,
  Loader,
  Paper,
  Select,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { m } from '#/paraglide/messages'
import { useAdminClaim } from '#/auth/useAdminClaim'
import { useAuth } from '#/auth/useAuth'
import { AdminDenied } from '#/components/admin/AdminDenied'
import { QueryErrorAlert } from '#/components/admin/QueryErrorAlert'
import { FormStickyActions } from '#/components/FormStickyActions'
import {
  MemberFormFields,
  type MemberFormFieldsApi,
} from '#/components/filler/MemberFormFields'
import { buildMemberPatch, type MemberDraft } from '#/components/filler/memberDraft'
import { useFormLocalDraft } from '#/hooks/useFormLocalDraft'
import { memberDraftStorageKey } from '#/lib/formLocalDraft'
import { validateMemberRequiredFields } from '#/components/filler/memberRequiredValidation'
import type { SanghaType } from '#/domain/types'
import { canManageDirectory } from '#/domain/authClaims'
import { adminKeys } from '#/query/adminKeys'
import { memberQuery, orgUnitsQuery } from '#/query/adminQueries'
import { lockMember } from '#/use-cases/lockMember'
import { saveAdminMember } from '#/use-cases/saveAdminMember'
import { unlockMember } from '#/use-cases/unlockMember'
import { uploadMemberPhoto } from '#/use-cases/uploadMemberPhoto'
import { uploadMemberDocument } from '#/use-cases/uploadMemberDocument'
import type { DocumentSide, DocumentTypeId } from '#/domain/memberDocumentTypes'

type MemberFormPageProps = {
  mode: 'create' | 'edit'
  memberId?: string
  sanghaType: SanghaType
}

const SANGHA_TYPE_OPTIONS: { value: SanghaType; label: () => string }[] = [
  { value: 'tang', label: () => m.admin_members_sangha_type_tang() },
  { value: 'ni', label: () => m.admin_members_sangha_type_ni() },
]

function listPath(
  sanghaType: SanghaType,
): '/admin/members/tang' | '/admin/members/ni' {
  return sanghaType === 'tang' ? '/admin/members/tang' : '/admin/members/ni'
}

export function MemberFormPage({
  mode,
  memberId,
  sanghaType: initialSanghaType,
}: MemberFormPageProps) {
  const claim = useAdminClaim()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fieldsApiRef = useRef<MemberFormFieldsApi | null>(null)

  const manageDirectory =
    claim.status === 'admin' &&
    canManageDirectory({ role: claim.role, orgUnitId: claim.orgUnitId })

  const [orgUnitId, setOrgUnitId] = useState<string | null>(null)
  const [sanghaType, setSanghaType] = useState<SanghaType>(initialSanghaType)
  const [cccd, setCccd] = useState('')
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)

  const orgUnits = useQuery({
    ...orgUnitsQuery(),
    enabled: manageDirectory,
  })

  const member = useQuery({
    ...memberQuery(memberId ?? ''),
    enabled: manageDirectory && mode === 'edit' && !!memberId,
  })

  useEffect(() => {
    if (!member.data) return
    setOrgUnitId(member.data.orgUnitId)
    setSanghaType(member.data.sanghaType)
    setCccd(member.data.cccd)
  }, [member.data])

  const orgUnitSelectData = useMemo(
    () =>
      (orgUnits.data ?? []).map((unit) => ({
        value: unit.id,
        label: unit.name,
      })),
    [orgUnits.data],
  )

  const sanghaTypeSelectData = useMemo(
    () =>
      SANGHA_TYPE_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label(),
      })),
    [],
  )

  const actorId = user?.uid ?? 'admin'
  const formReady = mode === 'create' || !!member.data

  const storageKey = useMemo(() => {
    if (mode === 'edit' && memberId) {
      return memberDraftStorageKey({ kind: 'existing', memberId })
    }
    return memberDraftStorageKey({
      kind: 'new',
      orgUnitId: orgUnitId ?? '',
      sanghaType,
      actorId,
    })
  }, [actorId, memberId, mode, orgUnitId, sanghaType])

  const handleLocalDraftRestore = useCallback((fields: MemberDraft) => {
    fieldsApiRef.current?.restoreDraft(fields)
  }, [])

  const { persist, clear } = useFormLocalDraft<MemberDraft>({
    storageKey,
    enabled: manageDirectory && formReady,
    hasServerData: mode === 'edit' && !!member.data,
    onRestore: handleLocalDraftRestore,
  })

  const handleDraftChange = useCallback(
    (draft: MemberDraft) => {
      persist(draft)
    },
    [persist],
  )

  const isLocked = mode === 'edit' && member.data?.status === 'locked'
  const effectiveSanghaType =
    mode === 'edit' ? (member.data?.sanghaType ?? sanghaType) : sanghaType
  const resolvedCccd =
    mode === 'edit' ? (member.data?.cccd ?? cccd) : cccd

  async function performSave() {
    const api = fieldsApiRef.current
    if (!api || !orgUnitId) throw new Error('Missing org unit')
    if (mode === 'create' && !cccd.trim()) throw new Error('Missing CCCD')

    const draft = api.getDraft()
    const result = await saveAdminMember(
      mode === 'edit' && memberId
        ? {
            memberId,
            orgUnitId,
            sanghaType: effectiveSanghaType,
            patch: buildMemberPatch(draft),
          }
        : {
            orgUnitId,
            sanghaType,
            cccd,
            patch: buildMemberPatch(draft),
          },
    )

    const pending = api.getPendingPhoto()
    if (pending && result.member.id && user) {
      const idToken = await user.getIdToken()
      const bytes = new Uint8Array(await pending.arrayBuffer())
      try {
        const uploaded = await uploadMemberPhoto({
          memberId: result.member.id,
          cccd: resolvedCccd,
          bytes,
          contentType: pending.type,
          idToken,
        })
        api.setPhotoPath(uploaded.photoPath)
        api.clearPendingPhoto()
      } catch {
        setPhotoError(m.filler_photo_upload_error())
      }
    }

    const pendingDocs = api.getPendingDocuments()
    if (result.member.id && user && Object.keys(pendingDocs).length > 0) {
      const idToken = await user.getIdToken()
      try {
        for (const typeId of Object.keys(pendingDocs) as DocumentTypeId[]) {
          const sides = pendingDocs[typeId] ?? {}
          for (const side of Object.keys(sides) as DocumentSide[]) {
            const file = sides[side]
            if (!file) continue
            const bytes = new Uint8Array(await file.arrayBuffer())
            const uploadResult = await uploadMemberDocument({
              memberId: result.member.id,
              cccd: resolvedCccd,
              typeId,
              side,
              bytes,
              contentType: file.type,
              idToken,
              current: api.getDocuments(),
            })
            api.setDocuments(uploadResult.documents)
          }
        }
        api.clearPendingDocuments()
      } catch {
        setPhotoError(m.filler_doc_upload_error())
      }
    }

    return result
  }

  const saveMutation = useMutation({
    mutationFn: performSave,
    onSuccess: async (result) => {
      setSaveSuccess(m.filler_save_success())
      clear()
      await queryClient.invalidateQueries({
        queryKey: [...adminKeys.all, 'members'],
      })
      if (mode === 'create') {
        await navigate({
          to: '/admin/members/$id',
          params: { id: result.member.id },
        })
      } else if (memberId) {
        await queryClient.invalidateQueries({
          queryKey: adminKeys.member(memberId),
        })
      }
    },
    onError: () => {
      setSaveSuccess(null)
    },
  })

  const lockMutation = useMutation({
    mutationFn: async () => {
      if (!memberId) throw new Error('Missing member id')
      if (claim.status !== 'admin') throw new Error('Not signed in as admin')
      return lockMember({ memberId, lockedBy: claim.uid })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [...adminKeys.all, 'members'],
      })
      if (memberId) {
        await queryClient.invalidateQueries({
          queryKey: adminKeys.member(memberId),
        })
      }
    },
  })

  const unlockMutation = useMutation({
    mutationFn: async () => {
      if (!memberId) throw new Error('Missing member id')
      return unlockMember({ memberId })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [...adminKeys.all, 'members'],
      })
      if (memberId) {
        await queryClient.invalidateQueries({
          queryKey: adminKeys.member(memberId),
        })
      }
    },
  })

  const complete = () => {
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
      return
    }
    api.clearFieldErrors()
    setPhotoError(null)
    setSaveSuccess(null)
    saveMutation.mutate()
  }

  const mutationError =
    saveMutation.error?.message ??
    lockMutation.error?.message ??
    unlockMutation.error?.message

  const isLoading = mode === 'edit' && member.isPending
  const canSaveCreate = !!orgUnitId && !!cccd.trim()
  const saveDisabled = mode === 'create' ? !canSaveCreate : !orgUnitId

  const formInitial =
    mode === 'edit' && member.data
      ? { ...member.data, photoPath: member.data.photoPath ?? null }
      : {}

  if (claim.status === 'admin' && !manageDirectory) {
    return <AdminDenied />
  }

  return (
    <Stack>
      <Group justify="space-between" align="center">
        <Title order={2}>
          {mode === 'create'
            ? m.admin_members_form_title_create()
            : m.admin_members_form_title_edit()}
        </Title>
        <Button
          component={Link}
          to={listPath(effectiveSanghaType)}
          variant="subtle"
        >
          {m.admin_members_back()}
        </Button>
      </Group>

      {isLoading && <Loader aria-label="loading" />}
      {member.isError && member.error && (
        <QueryErrorAlert error={member.error} />
      )}
      {(mode === 'create' || member.data) && !member.isError && (
        <Paper p="xl" radius="md" maw={760} w="100%">
          <Stack gap="lg">
            {mode === 'edit' && member.data && (
              <Text size="sm" c="dimmed">
                {member.data.inviteId
                  ? `${m.admin_members_invite_label()}: ${member.data.inviteId}`
                  : m.admin_members_created_by_admin()}
              </Text>
            )}

            <Select
              label={m.admin_members_form_org_unit()}
              data={orgUnitSelectData}
              value={orgUnitId}
              onChange={setOrgUnitId}
              searchable
              required
              disabled={mode === 'edit'}
            />
            <Select
              label={m.admin_members_form_sangha_type()}
              data={sanghaTypeSelectData}
              value={effectiveSanghaType}
              onChange={(value) => setSanghaType(value as SanghaType)}
              required
              disabled={mode === 'edit'}
            />
            <MemberFormFields
              key={mode === 'edit' ? memberId : 'create'}
              apiRef={fieldsApiRef}
              initial={formInitial}
              disabled={false}
              memberId={memberId}
              cccd={resolvedCccd}
              onCccdChange={
                mode === 'create'
                  ? (value) => setCccd(value)
                  : undefined
              }
              sanghaType={effectiveSanghaType}
              getIdToken={async () => (user ? user.getIdToken() : undefined)}
              onUploadError={setPhotoError}
              onDraftChange={handleDraftChange}
            />

            <FormStickyActions
              status={
                <>
                  {mutationError && (
                    <Text c="red" size="sm" role="alert">
                      {mutationError}
                    </Text>
                  )}
                  {photoError && (
                    <Text c="red" size="sm" role="alert">
                      {photoError}
                    </Text>
                  )}
                  {saveSuccess && (
                    <Text c="green" size="sm">
                      {saveSuccess}
                    </Text>
                  )}
                </>
              }
            >
              <Button
                loading={saveMutation.isPending}
                disabled={saveDisabled}
                onClick={() => void complete()}
              >
                {m.admin_members_complete()}
              </Button>
              {mode === 'edit' && member.data?.status === 'draft' && (
                <Button
                  variant="outline"
                  color="red"
                  loading={lockMutation.isPending}
                  onClick={() => lockMutation.mutate()}
                >
                  {m.admin_members_lock()}
                </Button>
              )}
              {isLocked && (
                <Button
                  variant="outline"
                  loading={unlockMutation.isPending}
                  onClick={() => unlockMutation.mutate()}
                >
                  {m.admin_members_unlock()}
                </Button>
              )}
            </FormStickyActions>
          </Stack>
        </Paper>
      )}
    </Stack>
  )
}
