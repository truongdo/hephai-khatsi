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
import type { SanghaType } from '#/domain/types'
import { adminKeys } from '#/query/adminKeys'
import { memberQuery, orgUnitsQuery } from '#/query/adminQueries'
import { lockMember } from '#/use-cases/lockMember'
import { saveAdminMember } from '#/use-cases/saveAdminMember'
import { unlockMember } from '#/use-cases/unlockMember'

type MemberFormPageProps = {
  mode: 'create' | 'edit'
  memberId?: string
  sanghaType: SanghaType
}

const SANGHA_TYPE_OPTIONS: { value: SanghaType; label: () => string }[] = [
  { value: 'tang', label: () => m.admin_members_sangha_type_tang() },
  { value: 'ni', label: () => m.admin_members_sangha_type_ni() },
]

function listPath(sanghaType: SanghaType): '/admin/members/tang' | '/admin/members/ni' {
  return sanghaType === 'tang' ? '/admin/members/tang' : '/admin/members/ni'
}

export function MemberFormPage({
  mode,
  memberId,
  sanghaType: initialSanghaType,
}: MemberFormPageProps) {
  const claim = useAdminClaim()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [orgUnitId, setOrgUnitId] = useState<string | null>(null)
  const [sanghaType, setSanghaType] = useState<SanghaType>(initialSanghaType)
  const [cccd, setCccd] = useState('')
  const [phapDanh, setPhapDanh] = useState('')
  const [theDanh, setTheDanh] = useState('')
  const [dienThoai, setDienThoai] = useState('')

  const orgUnits = useQuery({
    ...orgUnitsQuery(),
    enabled: claim.status === 'admin',
  })

  const member = useQuery({
    ...memberQuery(memberId ?? ''),
    enabled: claim.status === 'admin' && mode === 'edit' && !!memberId,
  })

  useEffect(() => {
    if (!member.data) return
    setOrgUnitId(member.data.orgUnitId)
    setSanghaType(member.data.sanghaType)
    setCccd(member.data.cccd)
    setPhapDanh(member.data.phapDanh ?? '')
    setTheDanh(member.data.theDanh ?? '')
    setDienThoai(member.data.dienThoai ?? '')
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

  const isLocked = mode === 'edit' && member.data?.status === 'locked'
  const isReadOnly = isLocked
  const effectiveSanghaType =
    mode === 'edit' ? (member.data?.sanghaType ?? sanghaType) : sanghaType

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!orgUnitId) throw new Error('Missing org unit')
      const patch = {
        phapDanh: phapDanh || undefined,
        theDanh: theDanh || undefined,
        dienThoai: dienThoai || undefined,
      }
      return saveAdminMember(
        mode === 'edit' && memberId
          ? { memberId, orgUnitId, sanghaType: effectiveSanghaType, patch }
          : { orgUnitId, sanghaType: effectiveSanghaType, cccd, patch },
      )
    },
    onSuccess: async (result) => {
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

  const mutationError =
    saveMutation.error?.message ??
    lockMutation.error?.message ??
    unlockMutation.error?.message

  const isLoading = mode === 'edit' && member.isPending

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
        <Stack maw={480}>
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
            disabled={mode === 'edit' || isReadOnly}
          />
          <Select
            label={m.admin_members_form_sangha_type()}
            data={sanghaTypeSelectData}
            value={effectiveSanghaType}
            onChange={(value) => setSanghaType(value as SanghaType)}
            required
            disabled={mode === 'edit' || isReadOnly}
          />
          {(mode === 'create' || member.data) && (
            <TextInput
              label={m.admin_members_form_cccd()}
              value={cccd}
              onChange={(event) => setCccd(event.currentTarget.value)}
              required={mode === 'create'}
              disabled={mode === 'edit'}
              readOnly={isReadOnly}
            />
          )}
          <TextInput
            label={m.admin_members_form_phap_danh()}
            value={phapDanh}
            onChange={(event) => setPhapDanh(event.currentTarget.value)}
            readOnly={isReadOnly}
          />
          <TextInput
            label={m.admin_members_form_the_danh()}
            value={theDanh}
            onChange={(event) => setTheDanh(event.currentTarget.value)}
            readOnly={isReadOnly}
          />
          <TextInput
            label={m.admin_members_form_dien_thoai()}
            value={dienThoai}
            onChange={(event) => setDienThoai(event.currentTarget.value)}
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
                disabled={!orgUnitId || (mode === 'create' && !cccd)}
                onClick={() => saveMutation.mutate()}
              >
                {m.admin_members_save()}
              </Button>
            )}
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
          </Group>
        </Stack>
      )}
    </Stack>
  )
}
