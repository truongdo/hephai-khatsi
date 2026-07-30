import {
  Button,
  Checkbox,
  Group,
  Loader,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { m } from '#/paraglide/messages'
import { useAdminClaim } from '#/auth/useAdminClaim'
import { AdminDenied } from '#/components/admin/AdminDenied'
import { AdminConfirmDeleteModal } from '#/components/admin/AdminConfirmDeleteModal'
import { QueryErrorAlert } from '#/components/admin/QueryErrorAlert'
import { FormStickyActions } from '#/components/FormStickyActions'
import { RepeatableFieldset } from '#/components/filler/RepeatableFieldset'
import { canManageRetreats } from '#/domain/authClaims'
import type {
  QuyenDangKy,
  RetreatExtraField,
  RetreatWritableFields,
} from '#/domain/retreat'
import { gmt7DateToIso, isoToGmt7Date } from '#/domain/gmt7Date'
import { adminKeys } from '#/query/adminKeys'
import { orgUnitsQuery, retreatQuery } from '#/query/adminQueries'
import { closeRetreat } from '#/use-cases/closeRetreat'
import { createRetreat } from '#/use-cases/createRetreat'
import { deleteRetreat } from '#/use-cases/deleteRetreat'
import { openRetreat } from '#/use-cases/openRetreat'
import { updateRetreat } from '#/use-cases/updateRetreat'

type RetreatFormPageProps = {
  mode: 'create' | 'edit'
  retreatId?: string
}

const QUYEN_DANG_KY_OPTIONS: { value: QuyenDangKy; label: () => string }[] = [
  { value: 'tu_dang_ky', label: () => m.admin_retreats_quyen_dang_ky_tu_dang_ky() },
  { value: 'proxy_only', label: () => m.admin_retreats_quyen_dang_ky_proxy_only() },
  { value: 'both', label: () => m.admin_retreats_quyen_dang_ky_both() },
]

const EMPTY_EXTRA_FIELD: RetreatExtraField = {
  key: '',
  label: '',
  required: false,
}

function emptyFields(): RetreatWritableFields {
  return {
    name: '',
    diaDiem: '',
    noiDung: '',
    doiTuongThamDu: '',
    thoiGianBatDau: '',
    thoiGianKetThuc: '',
    dangKyMoTu: '',
    dangKyDongLuc: '',
    extraFields: [],
    quyenDangKy: 'both',
  }
}

function fieldsFromRetreat(
  retreat: RetreatWritableFields,
): RetreatWritableFields {
  return {
    ...retreat,
    extraFields: retreat.extraFields.map((field) => ({ ...field })),
  }
}

export function RetreatFormPage({ mode, retreatId }: RetreatFormPageProps) {
  const claim = useAdminClaim()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const manageRetreats =
    claim.status === 'admin' &&
    canManageRetreats({ role: claim.role, orgUnitId: claim.orgUnitId })

  const isHePhaiAdmin =
    claim.status === 'admin' && claim.role === 'he_phai_admin'

  const [orgUnitId, setOrgUnitId] = useState<string | null>(null)
  const [fields, setFields] = useState<RetreatWritableFields>(emptyFields)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const orgUnits = useQuery({
    ...orgUnitsQuery(),
    enabled: manageRetreats,
  })

  const retreat = useQuery({
    ...retreatQuery(retreatId ?? ''),
    enabled: manageRetreats && mode === 'edit' && !!retreatId,
  })

  useEffect(() => {
    if (mode === 'create') {
      if (claim.status === 'admin' && claim.role === 'giao_doan_admin') {
        setOrgUnitId(claim.orgUnitId)
      }
      return
    }
    if (!retreat.data) return
    setOrgUnitId(retreat.data.orgUnitId)
    setFields(fieldsFromRetreat(retreat.data))
  }, [
    mode,
    retreat.data,
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

  const quyenDangKySelectData = useMemo(
    () =>
      QUYEN_DANG_KY_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label(),
      })),
    [],
  )

  const claims =
    claim.status === 'admin'
      ? { role: claim.role, orgUnitId: claim.orgUnitId }
      : null

  const invalidateRetreatLists = async () => {
    await queryClient.invalidateQueries({
      queryKey: [...adminKeys.all, 'retreats'],
    })
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!claims) throw new Error('Not signed in as admin')
      if (mode === 'create') {
        return createRetreat(claims, {
          orgUnitId: orgUnitId ?? undefined,
          createdBy: claim.uid,
          fields,
        })
      }
      if (!retreatId) throw new Error('Missing retreat id')
      return updateRetreat(claims, { retreatId, fields })
    },
    onSuccess: async (result) => {
      setSaveSuccess(m.admin_retreats_save_success())
      await invalidateRetreatLists()
      if (mode === 'create') {
        await navigate({
          to: '/admin/retreats/$id',
          params: { id: result.id },
        })
      } else if (retreatId) {
        await queryClient.invalidateQueries({
          queryKey: adminKeys.retreat(retreatId),
        })
      }
    },
    onError: () => {
      setSaveSuccess(null)
    },
  })

  const openMutation = useMutation({
    mutationFn: async () => {
      if (!claims || !retreatId) throw new Error('Missing retreat id')
      return openRetreat(claims, retreatId)
    },
    onSuccess: async () => {
      await invalidateRetreatLists()
      if (retreatId) {
        await queryClient.invalidateQueries({
          queryKey: adminKeys.retreat(retreatId),
        })
      }
    },
  })

  const closeMutation = useMutation({
    mutationFn: async () => {
      if (!claims || !retreatId) throw new Error('Missing retreat id')
      return closeRetreat(claims, retreatId)
    },
    onSuccess: async () => {
      await invalidateRetreatLists()
      if (retreatId) {
        await queryClient.invalidateQueries({
          queryKey: adminKeys.retreat(retreatId),
        })
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!claims || !retreatId) throw new Error('Missing retreat id')
      await deleteRetreat(claims, retreatId)
    },
    onSuccess: async () => {
      setConfirmDeleteOpen(false)
      await invalidateRetreatLists()
      await navigate({ to: '/admin/retreats' })
    },
    onError: () => {
      setConfirmDeleteOpen(false)
    },
  })

  const updateField = <K extends keyof RetreatWritableFields>(
    key: K,
    value: RetreatWritableFields[K],
  ) => {
    setSaveSuccess(null)
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  const updateExtraField = (
    index: number,
    patch: Partial<RetreatExtraField>,
  ) => {
    setSaveSuccess(null)
    setFields((prev) => ({
      ...prev,
      extraFields: prev.extraFields.map((field, i) =>
        i === index ? { ...field, ...patch } : field,
      ),
    }))
  }

  const addExtraField = () => {
    setSaveSuccess(null)
    setFields((prev) => ({
      ...prev,
      extraFields: [...prev.extraFields, { ...EMPTY_EXTRA_FIELD }],
    }))
  }

  const removeExtraField = (index: number) => {
    setSaveSuccess(null)
    setFields((prev) => ({
      ...prev,
      extraFields: prev.extraFields.filter((_, i) => i !== index),
    }))
  }

  const mutationError =
    saveMutation.error?.message ??
    openMutation.error?.message ??
    closeMutation.error?.message ??
    deleteMutation.error?.message

  const isLoading = mode === 'edit' && retreat.isPending
  const status = mode === 'edit' ? retreat.data?.status : 'draft'
  const canOpen = status === 'draft' || status === 'closed'
  const canClose = status === 'open'
  const canDelete = status === 'draft'

  if (claim.status === 'admin' && !manageRetreats) {
    return <AdminDenied />
  }

  return (
    <Stack>
      <Group justify="space-between" align="center">
        <Title order={2}>
          {mode === 'create'
            ? m.admin_retreats_form_title_create()
            : m.admin_retreats_form_title_edit()}
        </Title>
        <Button component={Link} to="/admin/retreats" variant="subtle">
          {m.admin_retreats_back()}
        </Button>
      </Group>

      {isLoading && <Loader aria-label="loading" />}
      {retreat.isError && retreat.error && (
        <QueryErrorAlert error={retreat.error} />
      )}
      {(mode === 'create' || retreat.data) && !retreat.isError && (
        <Paper p="xl" radius="md" maw={760} w="100%">
          <Stack gap="lg">
            {(isHePhaiAdmin || mode === 'edit') && (
              <Select
                label={m.admin_retreats_form_org_unit()}
                data={orgUnitSelectData}
                value={orgUnitId}
                onChange={setOrgUnitId}
                searchable
                required
                disabled={mode === 'edit'}
              />
            )}

            <TextInput
              label={m.admin_retreats_form_name()}
              value={fields.name}
              onChange={(event) =>
                updateField('name', event.currentTarget.value)
              }
              required
            />

            <TextInput
              label={m.admin_retreats_form_dia_diem()}
              value={fields.diaDiem}
              onChange={(event) =>
                updateField('diaDiem', event.currentTarget.value)
              }
              required
            />

            <Textarea
              label={m.admin_retreats_form_noi_dung()}
              value={fields.noiDung}
              onChange={(event) =>
                updateField('noiDung', event.currentTarget.value)
              }
              minRows={4}
              required
            />

            <TextInput
              label={m.admin_retreats_form_doi_tuong_tham_du()}
              value={fields.doiTuongThamDu}
              onChange={(event) =>
                updateField('doiTuongThamDu', event.currentTarget.value)
              }
              required
            />

            <TextInput
              label={m.admin_retreats_form_thoi_gian_bat_dau()}
              type="date"
              value={isoToGmt7Date(fields.thoiGianBatDau)}
              onChange={(event) =>
                updateField(
                  'thoiGianBatDau',
                  gmt7DateToIso(event.currentTarget.value, 'start'),
                )
              }
              required
            />

            <TextInput
              label={m.admin_retreats_form_thoi_gian_ket_thuc()}
              type="date"
              value={isoToGmt7Date(fields.thoiGianKetThuc)}
              onChange={(event) =>
                updateField(
                  'thoiGianKetThuc',
                  gmt7DateToIso(event.currentTarget.value, 'end'),
                )
              }
              required
            />

            <TextInput
              label={m.admin_retreats_form_dang_ky_mo_tu()}
              type="date"
              value={isoToGmt7Date(fields.dangKyMoTu)}
              onChange={(event) =>
                updateField(
                  'dangKyMoTu',
                  gmt7DateToIso(event.currentTarget.value, 'start'),
                )
              }
              required
            />

            <TextInput
              label={m.admin_retreats_form_dang_ky_dong_luc()}
              type="date"
              value={isoToGmt7Date(fields.dangKyDongLuc)}
              onChange={(event) =>
                updateField(
                  'dangKyDongLuc',
                  gmt7DateToIso(event.currentTarget.value, 'end'),
                )
              }
              required
            />

            <Select
              label={m.admin_retreats_form_quyen_dang_ky()}
              data={quyenDangKySelectData}
              value={fields.quyenDangKy}
              onChange={(value) =>
                updateField('quyenDangKy', (value ?? 'both') as QuyenDangKy)
              }
              required
            />

            <RepeatableFieldset
              label={m.admin_retreats_form_extra_fields()}
              addLabel={m.admin_retreats_form_extra_fields_add()}
              onAdd={addExtraField}
            >
              {fields.extraFields.map((field, index) => (
                <Stack key={index} gap="sm">
                  <Group align="flex-end" wrap="wrap">
                    <TextInput
                      label={m.admin_retreats_form_extra_field_key()}
                      value={field.key}
                      onChange={(event) =>
                        updateExtraField(index, {
                          key: event.currentTarget.value,
                        })
                      }
                      style={{ flex: 1 }}
                    />
                    <TextInput
                      label={m.admin_retreats_form_extra_field_label()}
                      value={field.label}
                      onChange={(event) =>
                        updateExtraField(index, {
                          label: event.currentTarget.value,
                        })
                      }
                      style={{ flex: 1 }}
                    />
                    <Checkbox
                      label={m.admin_retreats_form_extra_field_required()}
                      checked={field.required}
                      onChange={(event) =>
                        updateExtraField(index, {
                          required: event.currentTarget.checked,
                        })
                      }
                    />
                    <Button
                      variant="subtle"
                      color="red"
                      onClick={() => removeExtraField(index)}
                    >
                      {m.admin_retreats_form_extra_field_remove()}
                    </Button>
                  </Group>
                </Stack>
              ))}
            </RepeatableFieldset>

            <FormStickyActions
              status={
                <>
                  {mutationError && (
                    <Text c="red" size="sm" role="alert">
                      {mutationError}
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
                disabled={!orgUnitId}
                onClick={() => {
                  setSaveSuccess(null)
                  saveMutation.mutate()
                }}
              >
                {m.admin_retreats_save()}
              </Button>
              {mode === 'edit' && canOpen && (
                <Button
                  variant="outline"
                  loading={openMutation.isPending}
                  onClick={() => openMutation.mutate()}
                >
                  {m.admin_retreats_open()}
                </Button>
              )}
              {mode === 'edit' && canClose && (
                <Button
                  variant="outline"
                  loading={closeMutation.isPending}
                  onClick={() => closeMutation.mutate()}
                >
                  {m.admin_retreats_close()}
                </Button>
              )}
              {mode === 'edit' && canDelete && (
                <Button
                  variant="outline"
                  color="red"
                  onClick={() => setConfirmDeleteOpen(true)}
                >
                  {m.admin_retreats_delete()}
                </Button>
              )}
            </FormStickyActions>
          </Stack>
        </Paper>
      )}

      <AdminConfirmDeleteModal
        opened={confirmDeleteOpen}
        count={1}
        loading={deleteMutation.isPending}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
      />
    </Stack>
  )
}
