import { Button, Group, Loader, Select, Stack, Text, Title } from '@mantine/core'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { m } from '#/paraglide/messages'
import { useAdminClaim } from '#/auth/useAdminClaim'
import { useAuth } from '#/auth/useAuth'
import { QueryErrorAlert } from '#/components/admin/QueryErrorAlert'
import { buildTemplePatch } from '#/components/filler/templeDraft'
import { validateTempleRequiredFields } from '#/components/filler/templeRequiredValidation'
import {
  TempleFormFields,
  type TempleFormFieldsApi,
} from '#/components/temple/TempleFormFields'
import { adminKeys } from '#/query/adminKeys'
import { orgUnitsQuery, templeQuery } from '#/query/adminQueries'
import { lockTemple } from '#/use-cases/lockTemple'
import { saveAdminTemple } from '#/use-cases/saveAdminTemple'
import { unlockTemple } from '#/use-cases/unlockTemple'
import { uploadTemplePhoto } from '#/use-cases/uploadTemplePhoto'

type TempleFormPageProps = {
  mode: 'create' | 'edit'
  templeId?: string
}

export function TempleFormPage({ mode, templeId }: TempleFormPageProps) {
  const claim = useAdminClaim()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fieldsApiRef = useRef<TempleFormFieldsApi | null>(null)

  const [orgUnitId, setOrgUnitId] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)

  const orgUnits = useQuery({
    ...orgUnitsQuery(),
    enabled: claim.status === 'admin',
  })

  const temple = useQuery({
    ...templeQuery(templeId ?? ''),
    enabled: claim.status === 'admin' && mode === 'edit' && !!templeId,
  })

  useEffect(() => {
    if (!temple.data) return
    setOrgUnitId(temple.data.orgUnitId)
  }, [temple.data])

  const orgUnitSelectData = useMemo(
    () =>
      (orgUnits.data ?? []).map((unit) => ({
        value: unit.id,
        label: unit.name,
      })),
    [orgUnits.data],
  )

  const isLocked = mode === 'edit' && temple.data?.status === 'locked'

  async function persist() {
    const api = fieldsApiRef.current
    if (!api || !orgUnitId) throw new Error('Missing org unit')

    const draft = api.getDraft()
    const result = await saveAdminTemple({
      orgUnitId,
      templeId: mode === 'edit' ? templeId : undefined,
      patch: buildTemplePatch(draft),
      explicitPhones: api.getExtraManagerPhone().trim()
        ? [api.getExtraManagerPhone().trim()]
        : [],
    })

    const pending = api.getPendingPhoto()
    if (pending && result.temple.id && user) {
      const idToken = await user.getIdToken()
      const bytes = new Uint8Array(await pending.arrayBuffer())
      try {
        const uploaded = await uploadTemplePhoto({
          templeId: result.temple.id,
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

    return result
  }

  const saveMutation = useMutation({
    mutationFn: persist,
    onSuccess: async (result) => {
      setSaveSuccess(m.filler_save_success())
      await queryClient.invalidateQueries({
        queryKey: [...adminKeys.all, 'temples'],
      })
      if (mode === 'create') {
        await navigate({
          to: '/admin/temples/$id',
          params: { id: result.temple.id },
        })
      } else if (templeId) {
        await queryClient.invalidateQueries({
          queryKey: adminKeys.temple(templeId),
        })
      }
    },
    onError: () => {
      setSaveSuccess(null)
    },
  })

  const lockMutation = useMutation({
    mutationFn: async () => {
      if (!templeId) throw new Error('Missing temple id')
      if (claim.status !== 'admin') throw new Error('Not signed in as admin')
      return lockTemple({ templeId, lockedBy: claim.uid })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [...adminKeys.all, 'temples'],
      })
      if (templeId) {
        await queryClient.invalidateQueries({
          queryKey: adminKeys.temple(templeId),
        })
      }
    },
  })

  const unlockMutation = useMutation({
    mutationFn: async () => {
      if (!templeId) throw new Error('Missing temple id')
      return unlockTemple({ templeId })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [...adminKeys.all, 'temples'],
      })
      if (templeId) {
        await queryClient.invalidateQueries({
          queryKey: adminKeys.temple(templeId),
        })
      }
    },
  })

  const saveDraft = () => {
    setPhotoError(null)
    setSaveSuccess(null)
    saveMutation.mutate()
  }

  const complete = () => {
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
    setPhotoError(null)
    setSaveSuccess(null)
    saveMutation.mutate()
  }

  const mutationError =
    saveMutation.error?.message ??
    lockMutation.error?.message ??
    unlockMutation.error?.message

  const isLoading = mode === 'edit' && temple.isPending

  const formInitial =
    mode === 'edit' && temple.data
      ? { ...temple.data, photoPath: temple.data.photoPath ?? null }
      : {}

  return (
    <Stack>
      <Group justify="space-between" align="center">
        <Title order={2}>
          {mode === 'create'
            ? m.admin_temples_form_title_create()
            : m.admin_temples_form_title_edit()}
        </Title>
        <Button component={Link} to="/admin/temples" variant="subtle">
          {m.admin_temples_back()}
        </Button>
      </Group>

      {isLoading && <Loader aria-label="loading" />}
      {temple.isError && temple.error && (
        <QueryErrorAlert error={temple.error} />
      )}
      {(mode === 'create' || temple.data) && !temple.isError && (
        <Stack maw={760}>
          {mode === 'edit' && temple.data && (
            <Text size="sm" c="dimmed">
              {temple.data.inviteId
                ? `${m.admin_temples_invite_label()}: ${temple.data.inviteId}`
                : m.admin_temples_created_by_admin()}
            </Text>
          )}

          <Select
            label={m.admin_temples_form_org_unit()}
            data={orgUnitSelectData}
            value={orgUnitId}
            onChange={setOrgUnitId}
            searchable
            required
            disabled={mode === 'edit'}
          />

          <TempleFormFields
            key={mode === 'edit' ? templeId : 'create'}
            apiRef={fieldsApiRef}
            initial={formInitial}
            disabled={false}
            templeId={templeId}
            getIdToken={async () => (user ? user.getIdToken() : undefined)}
          />

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

          <Group>
            <Button
              loading={saveMutation.isPending}
              disabled={!orgUnitId}
              onClick={() => void saveDraft()}
            >
              {m.admin_temples_save_draft()}
            </Button>
            <Button
              loading={saveMutation.isPending}
              disabled={!orgUnitId}
              onClick={() => void complete()}
            >
              {m.admin_temples_complete()}
            </Button>
            {mode === 'edit' && temple.data?.status === 'draft' && (
              <Button
                variant="outline"
                color="red"
                loading={lockMutation.isPending}
                onClick={() => lockMutation.mutate()}
              >
                {m.admin_temples_lock()}
              </Button>
            )}
            {isLocked && (
              <Button
                variant="outline"
                loading={unlockMutation.isPending}
                onClick={() => unlockMutation.mutate()}
              >
                {m.admin_temples_unlock()}
              </Button>
            )}
          </Group>
        </Stack>
      )}
    </Stack>
  )
}
