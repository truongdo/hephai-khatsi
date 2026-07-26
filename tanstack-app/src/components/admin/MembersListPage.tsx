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
import { useAuth } from '#/auth/useAuth'
import { AdminDenied } from '#/components/admin/AdminDenied'
import { AdminConfirmDeleteModal } from '#/components/admin/AdminConfirmDeleteModal'
import { AdminDataTable } from '#/components/admin/AdminDataTable'
import { emptyCell } from '#/components/admin/emptyCell'
import { QueryErrorAlert } from '#/components/admin/QueryErrorAlert'
import { RecordStatusBadge } from '#/components/admin/RecordStatusBadge'
import { useAdminListSelection } from '#/components/admin/useAdminListSelection'
import type { Member, RecordStatus, SanghaType } from '#/domain/types'
import { canManageDirectory } from '#/domain/authClaims'
import { adminKeys } from '#/query/adminKeys'
import { membersQuery, orgUnitsQuery } from '#/query/adminQueries'
import { deleteMembers } from '#/use-cases/deleteMembers'

type MembersListPageProps = {
  sanghaType: SanghaType
}

function statusLabel(status: RecordStatus): string {
  switch (status) {
    case 'draft':
      return m.admin_members_status_draft()
    case 'locked':
      return m.admin_members_status_locked()
  }
}

const STATUS_OPTIONS: { value: RecordStatus; label: () => string }[] = [
  { value: 'draft', label: () => m.admin_members_status_draft() },
  { value: 'locked', label: () => m.admin_members_status_locked() },
]

function memberDisplayName(member: Member): string {
  return member.phapDanh ?? member.theDanh ?? member.id
}

function listTitle(sanghaType: SanghaType): string {
  return sanghaType === 'tang' ? m.admin_nav_tang() : m.admin_nav_ni()
}

export function MembersListPage({ sanghaType }: MembersListPageProps) {
  const claim = useAdminClaim()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const manageDirectory =
    claim.status === 'admin' &&
    canManageDirectory({ role: claim.role, orgUnitId: claim.orgUnitId })

  const [orgUnitFilter, setOrgUnitFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<RecordStatus | null>(null)
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [allItems, setAllItems] = useState<Member[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const lastAppendedKeyRef = useRef<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const filterKey = `${sanghaType}:${orgUnitFilter ?? ''}:${statusFilter ?? ''}`

  useEffect(() => {
    setCursor(undefined)
    setAllItems([])
    setNextCursor(null)
    lastAppendedKeyRef.current = null
  }, [filterKey])

  const orgUnits = useQuery({
    ...orgUnitsQuery(),
    enabled: manageDirectory,
  })

  const members = useQuery({
    ...membersQuery({
      sanghaType,
      orgUnitId: orgUnitFilter ?? undefined,
      status: statusFilter ?? undefined,
      cursor,
    }),
    enabled: manageDirectory,
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    if (!members.data) return
    const appendKey = `${cursor ?? 'start'}:${members.dataUpdatedAt}`
    if (lastAppendedKeyRef.current === appendKey) return
    lastAppendedKeyRef.current = appendKey
    if (cursor) {
      setAllItems((prev) => [...prev, ...members.data.items])
    } else {
      setAllItems(members.data.items)
    }
    setNextCursor(members.data.nextCursor)
  }, [members.data, members.dataUpdatedAt, cursor])

  const itemIds = useMemo(() => allItems.map((member) => member.id), [allItems])
  const selection = useAdminListSelection(itemIds)

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const idToken = await user!.getIdToken()
      await deleteMembers({ ids: [...selection.selectedIds], idToken })
    },
    onSuccess: () => {
      selection.clear()
      setConfirmOpen(false)
      setCursor(undefined)
      setAllItems([])
      setNextCursor(null)
      lastAppendedKeyRef.current = null
      void queryClient.invalidateQueries({
        queryKey: [...adminKeys.all, 'members'],
      })
    },
    onError: () => {
      setConfirmOpen(false)
      void queryClient.invalidateQueries({
        queryKey: [...adminKeys.all, 'members'],
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

  const isLoading = members.isPending && allItems.length === 0

  if (claim.status === 'admin' && !manageDirectory) {
    return <AdminDenied />
  }

  return (
    <Stack>
      <Group justify="space-between" align="center">
        <Title order={2}>{listTitle(sanghaType)}</Title>
        <Button
          component={Link}
          to="/admin/members/new"
          search={{ sanghaType }}
        >
          {m.admin_members_create()}
        </Button>
      </Group>

      <Group>
        <Select
          label={m.admin_members_filter_org_unit()}
          placeholder={m.admin_filter_all()}
          data={orgUnitSelectData}
          value={orgUnitFilter}
          onChange={setOrgUnitFilter}
          clearable
          searchable
        />
        <Select
          label={m.admin_members_filter_status()}
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

      {deleteMutation.error && (
        <Text c="red" size="sm" role="alert">
          {deleteMutation.error.message}
        </Text>
      )}

      {members.isError && members.error && (
        <QueryErrorAlert error={members.error} />
      )}
      {!members.isError && (
        <>
          <AdminDataTable
            loading={isLoading}
            empty={!isLoading && allItems.length === 0}
            aria-label={listTitle(sanghaType)}
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
                <Table.Th>{m.admin_members_col_phap_danh()}</Table.Th>
                <Table.Th>{m.admin_members_col_the_danh()}</Table.Th>
                <Table.Th>{m.admin_members_col_cccd()}</Table.Th>
                <Table.Th>{m.admin_members_col_status()}</Table.Th>
                <Table.Th>{m.admin_members_col_updated_at()}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {allItems.map((member) => (
                <Table.Tr key={member.id}>
                  <Table.Td>
                    <Checkbox
                      checked={selection.selectedIds.has(member.id)}
                      onChange={() => selection.toggle(member.id)}
                      aria-label={memberDisplayName(member)}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Text
                      component={Link}
                      to="/admin/members/$id"
                      params={{ id: member.id }}
                      c="teal.7"
                      fw={600}
                    >
                      {memberDisplayName(member)}
                    </Text>
                  </Table.Td>
                  <Table.Td>{emptyCell(member.theDanh)}</Table.Td>
                  <Table.Td>{member.cccd}</Table.Td>
                  <Table.Td>
                    <RecordStatusBadge
                      status={member.status}
                      label={statusLabel(member.status)}
                    />
                  </Table.Td>
                  <Table.Td>
                    {new Date(member.updatedAt).toLocaleString('vi-VN')}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </AdminDataTable>
          {nextCursor && (
            <Button
              variant="light"
              loading={members.isFetching}
              onClick={() => setCursor(nextCursor)}
            >
              {m.admin_members_load_more()}
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
    </Stack>
  )
}
