import {
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  Paper,
  Select,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { m } from '#/paraglide/messages'
import { useAdminClaim } from '#/auth/useAdminClaim'
import { useAuth } from '#/auth/useAuth'
import { AdminDenied } from '#/components/admin/AdminDenied'
import { AuditHistoryModal } from '#/components/admin/AuditHistoryModal'
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
import {
  canGrantDirectoryRole,
  canManageDirectory,
  isHePhaiAdmin,
  isHePhaiScope,
} from '#/domain/authClaims'
import { isGmailEmail } from '#/domain/gmail'
import {
  grantDirectoryRole,
  revokeDirectoryRole,
} from '#/directoryRole/directoryRoleApiClient'
import { adminKeys } from '#/query/adminKeys'
import { memberQuery, orgUnitsQuery } from '#/query/adminQueries'
import { notifyMemberUpsert } from '#/search/notifySearchIndex'
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

  const isHePhaiScoped =
    claim.status === 'admin' &&
    isHePhaiScope({ role: claim.role, orgUnitId: claim.orgUnitId })

  const claims =
    claim.status === 'admin'
      ? { role: claim.role, orgUnitId: claim.orgUnitId }
      : null

  const canGrant =
    claim.status === 'admin' &&
    canGrantDirectoryRole({ role: claim.role, orgUnitId: claim.orgUnitId })

  const [orgUnitId, setOrgUnitId] = useState<string | null>(null)
  const [sanghaType, setSanghaType] = useState<SanghaType>(initialSanghaType)
  const [cccd, setCccd] = useState('')
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [auditHistoryOpen, setAuditHistoryOpen] = useState(false)
  const [revokeDirectoryRoleOpen, setRevokeDirectoryRoleOpen] = useState(false)
  const [directoryRoleSuccess, setDirectoryRoleSuccess] = useState<string | null>(
    null,
  )

  const orgUnits = useQuery({
    ...orgUnitsQuery(),
    enabled: manageDirectory,
  })

  const member = useQuery({
    ...memberQuery(memberId ?? ''),
    enabled: manageDirectory && mode === 'edit' && !!memberId,
  })

  const canEditOrgUnitOnDetail =
    claim.status === 'admin' &&
    isHePhaiAdmin({ role: claim.role, orgUnitId: claim.orgUnitId }) &&
    mode === 'edit' &&
    member.data?.status === 'draft'

  useEffect(() => {
    if (mode === 'create') {
      if (claim.status === 'admin' && claim.role === 'giao_doan_admin') {
        setOrgUnitId(claim.orgUnitId)
      }
      return
    }
    if (!member.data) return
    setOrgUnitId(member.data.orgUnitId)
    setSanghaType(member.data.sanghaType)
    setCccd(member.data.cccd)
  }, [
    mode,
    member.data,
    claim.status,
    claim.role,
    claim.status === 'admin' ? claim.orgUnitId : null,
  ])

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
    if (!claims) throw new Error('Not signed in as admin')
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
      { actorType: 'admin', actorId: claim.status === 'admin' ? claim.uid : actorId },
      claims,
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
          audit: { actorType: 'admin', actorId: user.uid },
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
              audit: { actorType: 'admin', actorId: user.uid },
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
      if (user) {
        const idToken = await user.getIdToken()
        void notifyMemberUpsert(result.member, { idToken })
      }
      setSaveSuccess(m.filler_save_success())
      clear()
      await queryClient.invalidateQueries({
        queryKey: [...adminKeys.all, 'members'],
      })
      if (mode === 'create' || (memberId && result.member.id !== memberId)) {
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
      return lockMember({
        memberId,
        lockedBy: claim.uid,
        audit: { actorType: 'admin', actorId: claim.uid },
      })
    },
    onSuccess: async (member) => {
      if (user) {
        const idToken = await user.getIdToken()
        void notifyMemberUpsert(member, { idToken })
      }
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
      if (claim.status !== 'admin') throw new Error('Not signed in as admin')
      return unlockMember({
        memberId,
        audit: { actorType: 'admin', actorId: claim.uid },
      })
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

  const invalidateMemberAndSecretaries = async () => {
    await queryClient.invalidateQueries({
      queryKey: adminKeys.directorySecretaries(),
    })
    await queryClient.invalidateQueries({
      queryKey: adminKeys.hePhaiSecretaries(),
    })
    if (memberId) {
      await queryClient.invalidateQueries({
        queryKey: adminKeys.member(memberId),
      })
    }
  }

  const grantDirectoryRoleMutation = useMutation({
    mutationFn: async (role: 'giao_doan_admin' | 'he_phai_secretary') => {
      if (!memberId) throw new Error('Missing member id')
      if (!user) throw new Error('Not signed in')
      const idToken = await user.getIdToken()
      return grantDirectoryRole({ memberId, role, idToken })
    },
    onSuccess: async (_data, role) => {
      setDirectoryRoleSuccess(
        role === 'he_phai_secretary'
          ? m.admin_member_directory_role_grant_success_he_phai()
          : m.admin_member_directory_role_grant_success(),
      )
      await invalidateMemberAndSecretaries()
    },
    onError: () => {
      setDirectoryRoleSuccess(null)
    },
  })

  const revokeDirectoryRoleMutation = useMutation({
    mutationFn: async () => {
      if (!memberId) throw new Error('Missing member id')
      if (!user) throw new Error('Not signed in')
      const idToken = await user.getIdToken()
      return revokeDirectoryRole({ memberId, idToken })
    },
    onSuccess: async () => {
      const revokedRole = member.data?.directoryRole
      setRevokeDirectoryRoleOpen(false)
      setDirectoryRoleSuccess(
        revokedRole === 'he_phai_secretary'
          ? m.admin_member_directory_role_revoke_success_he_phai()
          : m.admin_member_directory_role_revoke_success(),
      )
      await invalidateMemberAndSecretaries()
    },
    onError: () => {
      setDirectoryRoleSuccess(null)
    },
  })

  const complete = () => {
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
      giaoPhamGiaoHoi: { rank: draft.giaoPhamGiaoHoi.rank },
      giaoPhamHePhai: { rank: draft.giaoPhamHePhai.rank },
      orgUnitKind:
        (orgUnits.data ?? []).find((unit) => unit.id === orgUnitId)?.kind ??
        null,
      phanDoan: draft.phanDoan,
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
    unlockMutation.error?.message ??
    grantDirectoryRoleMutation.error?.message ??
    revokeDirectoryRoleMutation.error?.message

  const isLoading = mode === 'edit' && member.isPending
  const canSaveCreate = !!orgUnitId && !!cccd.trim()
  const saveDisabled = mode === 'create' ? !canSaveCreate : !orgUnitId

  const formInitial =
    mode === 'edit' && member.data
      ? { ...member.data, photoPath: member.data.photoPath ?? null }
      : {}

  const auditTitle =
    mode === 'edit' && member.data
      ? member.data.phapDanh?.trim() ||
        member.data.theDanh?.trim() ||
        memberId ||
        ''
      : ''

  if (claim.status === 'admin' && !manageDirectory) {
    return <AdminDenied />
  }

  return (
    <Stack>
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <Group gap="sm" wrap="wrap">
          <Title order={2}>
            {mode === 'create'
              ? m.admin_members_form_title_create()
              : m.admin_members_form_title_edit()}
          </Title>
          {mode === 'edit' &&
            member.data?.directoryRole === 'giao_doan_admin' && (
              <Badge>{m.admin_member_directory_role_badge()}</Badge>
            )}
          {mode === 'edit' &&
            member.data?.directoryRole === 'he_phai_secretary' && (
              <Badge>{m.admin_member_directory_role_badge_he_phai()}</Badge>
            )}
        </Group>
        <Group gap="sm" wrap="wrap">
          {canGrant && mode === 'edit' && member.data && (
            member.data.directoryRole === 'giao_doan_admin' ? (
              <Button
                variant="outline"
                color="red"
                onClick={() => setRevokeDirectoryRoleOpen(true)}
              >
                {m.admin_member_directory_role_revoke()}
              </Button>
            ) : member.data.directoryRole === 'he_phai_secretary' ? (
              <Button
                variant="outline"
                color="red"
                onClick={() => setRevokeDirectoryRoleOpen(true)}
              >
                {m.admin_member_directory_role_revoke_he_phai()}
              </Button>
            ) : (
              <>
                <Tooltip
                  label={m.admin_member_directory_role_need_gmail()}
                  disabled={isGmailEmail(member.data.email)}
                >
                  <span>
                    <Button
                      variant="outline"
                      disabled={!isGmailEmail(member.data.email)}
                      loading={grantDirectoryRoleMutation.isPending}
                      onClick={() =>
                        grantDirectoryRoleMutation.mutate('giao_doan_admin')
                      }
                    >
                      {m.admin_member_directory_role_grant()}
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip
                  label={m.admin_member_directory_role_need_gmail()}
                  disabled={isGmailEmail(member.data.email)}
                >
                  <span>
                    <Button
                      variant="outline"
                      disabled={!isGmailEmail(member.data.email)}
                      loading={grantDirectoryRoleMutation.isPending}
                      onClick={() =>
                        grantDirectoryRoleMutation.mutate('he_phai_secretary')
                      }
                    >
                      {m.admin_member_directory_role_grant_he_phai()}
                    </Button>
                  </span>
                </Tooltip>
              </>
            )
          )}
          <Button
            component={Link}
            to={listPath(effectiveSanghaType)}
            variant="subtle"
          >
            {m.admin_members_back()}
          </Button>
        </Group>
      </Group>

      {directoryRoleSuccess && (
        <Text c="green" size="sm">{directoryRoleSuccess}</Text>
      )}

      {isLoading && <Loader aria-label="loading" />}
      {member.isError && member.error && (
        <QueryErrorAlert error={member.error} />
      )}
      {(mode === 'create' || member.data) && !member.isError && (
        <Paper p={{ base: 'md', sm: 'xl' }} radius="md" maw={760} w="100%">
          <Stack gap="lg">
            {mode === 'edit' && member.data && (
              <Text size="sm" c="dimmed">
                {member.data.inviteId
                  ? `${m.admin_members_invite_label()}: ${member.data.inviteId}`
                  : m.admin_members_created_by_admin()}
              </Text>
            )}

            {(isHePhaiScoped || mode === 'edit') && (
              <Select
                label={m.admin_members_form_org_unit()}
                data={orgUnitSelectData}
                value={orgUnitId}
                onChange={setOrgUnitId}
                searchable
                required
                disabled={mode === 'edit' && !canEditOrgUnitOnDetail}
              />
            )}
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
              orgUnitId={orgUnitId ?? ''}
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
              audit={
                user
                  ? { actorType: 'admin', actorId: user.uid }
                  : undefined
              }
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
              {mode === 'edit' && memberId && (
                <Button
                  variant="subtle"
                  onClick={() => setAuditHistoryOpen(true)}
                >
                  {m.admin_audit_history()}
                </Button>
              )}
            </FormStickyActions>
          </Stack>
        </Paper>
      )}
      {mode === 'edit' && memberId && (
        <AuditHistoryModal
          opened={auditHistoryOpen}
          onClose={() => setAuditHistoryOpen(false)}
          title={auditTitle}
          parent={{ collection: 'members', id: memberId }}
        />
      )}
      <Modal
        opened={revokeDirectoryRoleOpen}
        onClose={() => setRevokeDirectoryRoleOpen(false)}
        title={
          member.data?.directoryRole === 'he_phai_secretary'
            ? m.admin_member_directory_role_revoke_he_phai()
            : m.admin_member_directory_role_revoke()
        }
        closeOnClickOutside={!revokeDirectoryRoleMutation.isPending}
        closeOnEscape={!revokeDirectoryRoleMutation.isPending}
      >
        <Text>
          {member.data?.directoryRole === 'he_phai_secretary'
            ? m.admin_org_units_he_phai_secretaries_revoke_confirm()
            : m.admin_org_units_secretaries_revoke_confirm()}
        </Text>
        <Group justify="flex-end" mt="md" wrap="wrap" gap="sm">
          <Button
            variant="default"
            onClick={() => setRevokeDirectoryRoleOpen(false)}
            disabled={revokeDirectoryRoleMutation.isPending}
          >
            Hủy
          </Button>
          <Button
            color="red"
            loading={revokeDirectoryRoleMutation.isPending}
            onClick={() => revokeDirectoryRoleMutation.mutate()}
          >
            {member.data?.directoryRole === 'he_phai_secretary'
              ? m.admin_member_directory_role_revoke_he_phai()
              : m.admin_member_directory_role_revoke()}
          </Button>
        </Group>
      </Modal>
    </Stack>
  )
}
