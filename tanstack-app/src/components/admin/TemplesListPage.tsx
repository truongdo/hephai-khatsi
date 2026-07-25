import {
  Button,
  Checkbox,
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
import { AdminConfirmDeleteModal } from '#/components/admin/AdminConfirmDeleteModal'
import { AdminDataTable } from '#/components/admin/AdminDataTable'
import { emptyCell } from '#/components/admin/emptyCell'
import { QueryErrorAlert } from '#/components/admin/QueryErrorAlert'
import { RecordStatusBadge } from '#/components/admin/RecordStatusBadge'
import { TempleDeleteBlockedModal } from '#/components/admin/TempleDeleteBlockedModal'
import { useAdminListSelection } from '#/components/admin/useAdminListSelection'
import type { RecordStatus, Temple } from '#/domain/types'
import { adminKeys } from '#/query/adminKeys'
import { templesQuery, orgUnitsQuery } from '#/query/adminQueries'
import {
  deleteTemples,
  type TempleDeleteBlocker,
} from '#/use-cases/deleteTemples'

function statusLabel(status: RecordStatus): string {
  switch (status) {
    case 'draft':
      return m.admin_temples_status_draft()
    case 'locked':
      return m.admin_temples_status_locked()
  }
}

const STATUS_OPTIONS: { value: RecordStatus; label: () => string }[] = [
  { value: 'draft', label: () => m.admin_temples_status_draft() },
  { value: 'locked', label: () => m.admin_temples_status_locked() },
]

export function TemplesListPage() {
  const claim = useAdminClaim()
  const queryClient = useQueryClient()

  const [orgUnitFilter, setOrgUnitFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<RecordStatus | null>(null)
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [allItems, setAllItems] = useState<Temple[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const lastAppendedKeyRef = useRef<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [blockedOpen, setBlockedOpen] = useState(false)
  const [blockers, setBlockers] = useState<TempleDeleteBlocker[]>([])

  const filterKey = `${orgUnitFilter ?? ''}:${statusFilter ?? ''}`

  useEffect(() => {
    setCursor(undefined)
    setAllItems([])
    setNextCursor(null)
    lastAppendedKeyRef.current = null
  }, [filterKey])

  const orgUnits = useQuery({
    ...orgUnitsQuery(),
    enabled: claim.status === 'admin',
  })

  const temples = useQuery({
    ...templesQuery({
      orgUnitId: orgUnitFilter ?? undefined,
      status: statusFilter ?? undefined,
      cursor,
    }),
    enabled: claim.status === 'admin',
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    if (!temples.data) return
    const appendKey = `${cursor ?? 'start'}:${temples.dataUpdatedAt}`
    if (lastAppendedKeyRef.current === appendKey) return
    lastAppendedKeyRef.current = appendKey
    if (cursor) {
      setAllItems((prev) => [...prev, ...temples.data.items])
    } else {
      setAllItems(temples.data.items)
    }
    setNextCursor(temples.data.nextCursor)
  }, [temples.data, temples.dataUpdatedAt, cursor])

  const itemIds = useMemo(() => allItems.map((temple) => temple.id), [allItems])
  const selection = useAdminListSelection(itemIds)

  const deleteMutation = useMutation({
    mutationFn: () => deleteTemples({ ids: [...selection.selectedIds] }),
    onSuccess: (result) => {
      if (!result.ok) {
        setBlockers(result.blockers)
        setBlockedOpen(true)
        setConfirmOpen(false)
        return
      }
      selection.clear()
      setConfirmOpen(false)
      setCursor(undefined)
      setAllItems([])
      setNextCursor(null)
      lastAppendedKeyRef.current = null
      void queryClient.invalidateQueries({
        queryKey: [...adminKeys.all, 'temples'],
      })
    },
  })

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

  const isLoading = temples.isPending && allItems.length === 0

  return (
    <Stack>
      <Group justify="space-between" align="center">
        <Title order={2}>{m.admin_nav_temples()}</Title>
        <Button component={Link} to="/admin/temples/new">
          {m.admin_temples_create()}
        </Button>
      </Group>

      <Group>
        <Select
          label={m.admin_temples_filter_org_unit()}
          placeholder={m.admin_filter_all()}
          data={orgUnitSelectData}
          value={orgUnitFilter}
          onChange={setOrgUnitFilter}
          clearable
          searchable
        />
        <Select
          label={m.admin_temples_filter_status()}
          placeholder={m.admin_filter_all()}
          data={statusSelectData}
          value={statusFilter}
          onChange={(value) => setStatusFilter(value as RecordStatus | null)}
          clearable
        />
      </Group>

      {selection.selectedCount > 0 && (
        <Group>
          <Text>{m.admin_bulk_selected({ count: selection.selectedCount })}</Text>
          <Button color="red" onClick={() => setConfirmOpen(true)}>
            {m.admin_bulk_delete()}
          </Button>
        </Group>
      )}

      {temples.isError && temples.error && (
        <QueryErrorAlert error={temples.error} />
      )}
      {!temples.isError && (
        <>
          <AdminDataTable
            loading={isLoading}
            empty={!isLoading && allItems.length === 0}
            aria-label={m.admin_nav_temples()}
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={40}>
                  <Checkbox
                    checked={selection.allLoadedSelected}
                    indeterminate={selection.someSelected}
                    onChange={selection.toggleAllLoaded}
                    aria-label={m.admin_bulk_selected({
                      count: selection.selectedCount,
                    })}
                  />
                </Table.Th>
                <Table.Th>{m.admin_temples_col_danh_hieu()}</Table.Th>
                <Table.Th>{m.admin_temples_col_phone()}</Table.Th>
                <Table.Th>{m.admin_temples_col_status()}</Table.Th>
                <Table.Th>{m.admin_temples_col_updated_at()}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {allItems.map((temple) => (
                <Table.Tr key={temple.id}>
                  <Table.Td>
                    <Checkbox
                      checked={selection.selectedIds.has(temple.id)}
                      onChange={() => selection.toggle(temple.id)}
                      aria-label={temple.danhHieu ?? temple.id}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Text
                      component={Link}
                      to="/admin/temples/$id"
                      params={{ id: temple.id }}
                      c="teal.7"
                      fw={600}
                    >
                      {temple.danhHieu ?? temple.id}
                    </Text>
                  </Table.Td>
                  <Table.Td>{emptyCell(temple.managerPhones[0])}</Table.Td>
                  <Table.Td>
                    <RecordStatusBadge
                      status={temple.status}
                      label={statusLabel(temple.status)}
                    />
                  </Table.Td>
                  <Table.Td>
                    {new Date(temple.updatedAt).toLocaleString('vi-VN')}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </AdminDataTable>
          {nextCursor && (
            <Button
              variant="light"
              loading={temples.isFetching}
              onClick={() => setCursor(nextCursor)}
            >
              {m.admin_temples_load_more()}
            </Button>
          )}
        </>
      )}

      <AdminConfirmDeleteModal
        opened={confirmOpen}
        count={selection.selectedCount}
        loading={deleteMutation.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
      />

      <TempleDeleteBlockedModal
        opened={blockedOpen}
        blockers={blockers}
        onClose={() => setBlockedOpen(false)}
      />
    </Stack>
  )
}
