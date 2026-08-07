import {
  Badge,
  Button,
  Group,
  Select,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { m } from '#/paraglide/messages'
import { useAdminClaim } from '#/auth/useAdminClaim'
import { AdminDenied } from '#/components/admin/AdminDenied'
import { AdminConfirmDeleteModal } from '#/components/admin/AdminConfirmDeleteModal'
import { AdminDataTable } from '#/components/admin/AdminDataTable'
import { emptyCell } from '#/components/admin/emptyCell'
import { QueryErrorAlert } from '#/components/admin/QueryErrorAlert'
import { canManageRetreats, isHePhaiScope } from '#/domain/authClaims'
import { isoToGmt7Date } from '#/domain/gmt7Date'
import type { Retreat, RetreatStatus } from '#/domain/retreat'
import { adminKeys } from '#/query/adminKeys'
import { orgUnitsQuery, retreatsQuery } from '#/query/adminQueries'
import { deleteRetreat } from '#/use-cases/deleteRetreat'

const STATUS_OPTIONS: { value: RetreatStatus; label: () => string }[] = [
  { value: 'draft', label: () => m.admin_retreats_status_draft() },
  { value: 'open', label: () => m.admin_retreats_status_open() },
  { value: 'closed', label: () => m.admin_retreats_status_closed() },
]

const STATUS_COLOR: Record<RetreatStatus, string> = {
  draft: 'jade',
  open: 'teal',
  closed: 'clay',
}

function statusLabel(status: RetreatStatus): string {
  switch (status) {
    case 'draft':
      return m.admin_retreats_status_draft()
    case 'open':
      return m.admin_retreats_status_open()
    case 'closed':
      return m.admin_retreats_status_closed()
  }
}

function formatGmt7Date(iso: string): string {
  const ymd = isoToGmt7Date(iso)
  if (!ymd) return ''
  const [year, month, day] = ymd.split('-')
  return `${day}/${month}/${year}`
}

function formatDateRange(start: string, end: string): string {
  return `${formatGmt7Date(start)} – ${formatGmt7Date(end)}`
}

export function RetreatsListPage() {
  const claim = useAdminClaim()
  const queryClient = useQueryClient()

  const manageRetreats =
    claim.status === 'admin' &&
    canManageRetreats({ role: claim.role, orgUnitId: claim.orgUnitId })

  const isHePhaiScoped =
    claim.status === 'admin' &&
    isHePhaiScope({ role: claim.role, orgUnitId: claim.orgUnitId })

  const [orgUnitFilter, setOrgUnitFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<RetreatStatus | null>(null)
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [allItems, setAllItems] = useState<Retreat[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const lastAppendedKeyRef = useRef<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const claims =
    claim.status === 'admin'
      ? { role: claim.role, orgUnitId: claim.orgUnitId }
      : null

  const scopedOrgUnitId =
    claim.status === 'admin' && claim.role === 'giao_doan_admin'
      ? (claim.orgUnitId ?? undefined)
      : (orgUnitFilter ?? undefined)

  const filterKey = `${scopedOrgUnitId ?? ''}:${statusFilter ?? ''}`

  useEffect(() => {
    setCursor(undefined)
    setAllItems([])
    setNextCursor(null)
    lastAppendedKeyRef.current = null
  }, [filterKey])

  const orgUnits = useQuery({
    ...orgUnitsQuery(),
    enabled: manageRetreats,
  })

  const retreats = useQuery({
    ...retreatsQuery({
      orgUnitId: scopedOrgUnitId,
      status: statusFilter ?? undefined,
      cursor,
    }),
    enabled: manageRetreats,
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    if (!retreats.data) return
    const appendKey = `${cursor ?? 'start'}:${retreats.dataUpdatedAt}`
    if (lastAppendedKeyRef.current === appendKey) return
    lastAppendedKeyRef.current = appendKey
    if (cursor) {
      setAllItems((prev) => [...prev, ...retreats.data.items])
    } else {
      setAllItems(retreats.data.items)
    }
    setNextCursor(retreats.data.nextCursor)
  }, [retreats.data, retreats.dataUpdatedAt, cursor])

  const orgUnitNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const unit of orgUnits.data ?? []) {
      map.set(unit.id, unit.name)
    }
    return map
  }, [orgUnits.data])

  const orgUnitSelectData = useMemo(
    () =>
      (orgUnits.data ?? []).map((unit) => ({
        value: unit.id,
        label: unit.name,
      })),
    [orgUnits.data],
  )

  const statusSelectData = useMemo(
    () =>
      STATUS_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label(),
      })),
    [],
  )

  const isLoading = retreats.isPending && allItems.length === 0

  const deleteMutation = useMutation({
    mutationFn: async (retreatId: string) => {
      if (!claims) throw new Error('Not signed in as admin')
      await deleteRetreat(claims, retreatId)
    },
    onSuccess: async () => {
      setPendingDeleteId(null)
      setCursor(undefined)
      setAllItems([])
      setNextCursor(null)
      lastAppendedKeyRef.current = null
      await queryClient.invalidateQueries({
        queryKey: [...adminKeys.all, 'retreats'],
      })
    },
    onError: () => {
      setPendingDeleteId(null)
      void queryClient.invalidateQueries({
        queryKey: [...adminKeys.all, 'retreats'],
      })
    },
  })

  if (claim.status === 'admin' && !manageRetreats) {
    return <AdminDenied />
  }

  return (
    <Stack>
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <Title order={2}>{m.admin_nav_retreats()}</Title>
        <Button component={Link} to="/admin/retreats/new">
          {m.admin_retreats_create()}
        </Button>
      </Group>

      <Group wrap="wrap" gap="sm" align="flex-end">
        {isHePhaiScoped && (
          <Select
            label={m.admin_retreats_filter_org_unit()}
            placeholder={m.admin_filter_all()}
            data={orgUnitSelectData}
            value={orgUnitFilter}
            onChange={setOrgUnitFilter}
            clearable
            searchable
            w={{ base: '100%', sm: 220 }}
          />
        )}
        <Select
          label={m.admin_retreats_filter_status()}
          placeholder={m.admin_filter_all()}
          data={statusSelectData}
          value={statusFilter}
          onChange={(value) => setStatusFilter(value as RetreatStatus | null)}
          clearable
          w={{ base: '100%', sm: 220 }}
        />
      </Group>

      {deleteMutation.error && (
        <Text c="red" size="sm" role="alert">
          {deleteMutation.error.message}
        </Text>
      )}

      {retreats.isError && retreats.error && (
        <QueryErrorAlert error={retreats.error} />
      )}
      {!retreats.isError && (
        <>
          <AdminDataTable
            loading={isLoading}
            empty={!isLoading && allItems.length === 0}
            aria-label={m.admin_nav_retreats()}
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{m.admin_retreats_col_name()}</Table.Th>
                <Table.Th>{m.admin_retreats_col_org_unit()}</Table.Th>
                <Table.Th>{m.admin_retreats_col_course_dates()}</Table.Th>
                <Table.Th>{m.admin_retreats_col_status()}</Table.Th>
                <Table.Th>{m.admin_retreats_col_registration_window()}</Table.Th>
                <Table.Th w={80} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {allItems.map((retreat) => (
                <Table.Tr key={retreat.id}>
                  <Table.Td>
                    <Text
                      component={Link}
                      to="/admin/retreats/$id"
                      params={{ id: retreat.id }}
                      c="teal.7"
                      fw={600}
                    >
                      {retreat.name}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {emptyCell(orgUnitNameById.get(retreat.orgUnitId))}
                  </Table.Td>
                  <Table.Td>
                    {formatDateRange(
                      retreat.thoiGianBatDau,
                      retreat.thoiGianKetThuc,
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={STATUS_COLOR[retreat.status]}
                      variant="light"
                      radius="sm"
                    >
                      {statusLabel(retreat.status)}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {formatDateRange(retreat.dangKyMoTu, retreat.dangKyDongLuc)}
                  </Table.Td>
                  <Table.Td>
                    {retreat.status === 'draft' && (
                      <Button
                        variant="subtle"
                        color="red"
                        size="compact-sm"
                        aria-label={`${m.admin_retreats_delete()} ${retreat.name}`}
                        onClick={() => setPendingDeleteId(retreat.id)}
                      >
                        {m.admin_retreats_delete()}
                      </Button>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </AdminDataTable>
          {nextCursor && (
            <Button
              variant="light"
              loading={retreats.isFetching}
              onClick={() => setCursor(nextCursor)}
            >
              {m.admin_retreats_load_more()}
            </Button>
          )}
        </>
      )}

      <AdminConfirmDeleteModal
        opened={pendingDeleteId !== null}
        count={1}
        loading={deleteMutation.isPending}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) deleteMutation.mutate(pendingDeleteId)
        }}
      />
    </Stack>
  )
}
