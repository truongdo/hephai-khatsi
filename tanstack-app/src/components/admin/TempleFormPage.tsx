import {
  Button,
  Group,
  Loader,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { m } from '#/paraglide/messages'
import { useAdminClaim } from '#/auth/useAdminClaim'
import { QueryErrorAlert } from '#/components/admin/QueryErrorAlert'
import { adminKeys } from '#/query/adminKeys'
import { orgUnitsQuery, templeQuery } from '#/query/adminQueries'
import { lockTemple } from '#/use-cases/lockTemple'
import { saveAdminTemple } from '#/use-cases/saveAdminTemple'
import { unlockTemple } from '#/use-cases/unlockTemple'

type TempleFormPageProps = {
  mode: 'create' | 'edit'
  templeId?: string
}

export function TempleFormPage({ mode, templeId }: TempleFormPageProps) {
  const claim = useAdminClaim()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [orgUnitId, setOrgUnitId] = useState<string | null>(null)
  const [danhHieu, setDanhHieu] = useState('')
  const [truTriPhone, setTruTriPhone] = useState('')
  const [diaChiMoi, setDiaChiMoi] = useState('')

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
    setDanhHieu(temple.data.danhHieu ?? '')
    setTruTriPhone(temple.data.truTriHienNay?.dienThoai ?? '')
    setDiaChiMoi(temple.data.diaChiMoi ?? '')
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
  const isReadOnly = isLocked

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!orgUnitId) throw new Error('Missing org unit')
      return saveAdminTemple({
        orgUnitId,
        templeId: mode === 'edit' ? templeId : undefined,
        patch: {
          danhHieu: danhHieu || undefined,
          diaChiMoi: diaChiMoi || undefined,
          truTriHienNay: { dienThoai: truTriPhone || undefined },
        },
      })
    },
    onSuccess: async (result) => {
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

  const mutationError =
    saveMutation.error?.message ??
    lockMutation.error?.message ??
    unlockMutation.error?.message

  const isLoading = mode === 'edit' && temple.isPending

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
        <Stack maw={480}>
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
            disabled={mode === 'edit' || isReadOnly}
          />
          <TextInput
            label={m.admin_temples_form_danh_hieu()}
            value={danhHieu}
            onChange={(event) => setDanhHieu(event.currentTarget.value)}
            readOnly={isReadOnly}
          />
          <TextInput
            label={m.admin_temples_form_tru_tri_phone()}
            value={truTriPhone}
            onChange={(event) => setTruTriPhone(event.currentTarget.value)}
            readOnly={isReadOnly}
          />
          <TextInput
            label={m.admin_temples_form_dia_chi_moi()}
            value={diaChiMoi}
            onChange={(event) => setDiaChiMoi(event.currentTarget.value)}
            readOnly={isReadOnly}
          />

          {mutationError && (
            <Text c="red" size="sm" role="alert">
              {mutationError}
            </Text>
          )}

          <Group>
            {!isLocked && (
              <Button
                loading={saveMutation.isPending}
                disabled={!orgUnitId}
                onClick={() => saveMutation.mutate()}
              >
                {m.admin_temples_save()}
              </Button>
            )}
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
