import { Button, Group, Select, Stack, Text, Title } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { m } from '#/paraglide/messages'
import { useAdminClaim } from '#/auth/useAdminClaim'
import { useAuth } from '#/auth/useAuth'
import { AdminDenied } from '#/components/admin/AdminDenied'
import { AdminConfirmDeleteModal } from '#/components/admin/AdminConfirmDeleteModal'
import { AdminDataTable } from '#/components/admin/AdminDataTable'
import { MembersExcelColumnsModal } from '#/components/admin/MembersExcelColumnsModal'
import { MembersHaLapTabs } from '#/components/admin/MembersHaLapTabs'
import { QueryErrorAlert } from '#/components/admin/QueryErrorAlert'
import { useAdminListSelection } from '#/components/admin/useAdminListSelection'
import {
  loadMembersExcelColumnIds,
  saveMembersExcelColumnIds,
} from '#/domain/membersExcelColumnSelection'
import {
  loadMembersTableColumnIds,
  saveMembersTableColumnIds,
} from '#/domain/membersTableColumnSelection'
import { canonicalHaLapTabRankKeys } from '#/domain/membersHaLapGroups'
import type { Member, RecordStatus, SanghaType } from '#/domain/types'
import { canManageDirectory, isHePhaiScope } from '#/domain/authClaims'
import { adminKeys } from '#/query/adminKeys'
import { membersByHaLapTabQuery, membersHaLapTabCountsQuery, orgUnitsQuery } from '#/query/adminQueries'
import { deleteMembers } from '#/use-cases/deleteMembers'
import { exportMembersExcel } from '#/use-cases/exportMembersExcel'
import { unlockMember } from '#/use-cases/unlockMember'

type MembersListPageProps = {
  sanghaType: SanghaType
  activeTab?: string
  onActiveTabChange?: (rankKey: string) => void
}

type StatusFilterValue = RecordStatus | 'edit_requested'

type TabLoadState = {
  items: Member[]
  nextCursor: string | null
  cursor: string | undefined
  lastAppendKey: string | null
}

const EMPTY_TAB_STATE: TabLoadState = {
  items: [],
  nextCursor: null,
  cursor: undefined,
  lastAppendKey: null,
}

const STATUS_OPTIONS: { value: StatusFilterValue; label: () => string }[] = [
  { value: 'draft', label: () => m.admin_members_status_draft() },
  { value: 'locked', label: () => m.admin_members_status_locked() },
  { value: 'edit_requested', label: () => m.admin_filter_edit_requested() },
]

function listTitle(sanghaType: SanghaType): string {
  return sanghaType === 'tang' ? m.admin_nav_tang() : m.admin_nav_ni()
}

function filterTabMembers(
  items: Member[],
  statusFilter: StatusFilterValue | null,
): Member[] {
  if (statusFilter === 'edit_requested') {
    return items.filter((member) => member.editRequestedAt != null)
  }
  return items
}

function dedupeMembersById(items: Member[]): Member[] {
  const seen = new Set<string>()
  const result: Member[] = []
  for (const item of items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    result.push(item)
  }
  return result
}

export function MembersListPage({
  sanghaType,
  activeTab,
  onActiveTabChange,
}: MembersListPageProps) {
  const claim = useAdminClaim()
  const { user } = useAuth()
  const queryClient = useQueryClient()

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

  const [orgUnitFilter, setOrgUnitFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue | null>(
    null,
  )
  const [tabStateByRank, setTabStateByRank] = useState<
    Record<string, TabLoadState>
  >({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportColumnIds, setExportColumnIds] = useState<string[]>([])
  const [displayColumnsOpen, setDisplayColumnsOpen] = useState(false)
  const [displayColumnIds, setDisplayColumnIds] = useState<string[]>(() =>
    loadMembersTableColumnIds(sanghaType),
  )
  const lastFilterKeyRef = useRef<string | null>(null)

  useEffect(() => {
    setDisplayColumnIds(loadMembersTableColumnIds(sanghaType))
  }, [sanghaType])

  const isGiaoDoanAdmin =
    claim.status === 'admin' && claim.role === 'giao_doan_admin'

  const scopedOrgUnitId = isGiaoDoanAdmin
    ? (claim.orgUnitId ?? undefined)
    : (orgUnitFilter ?? undefined)

  const serverStatusFilter =
    statusFilter === 'edit_requested' ? undefined : (statusFilter ?? undefined)

  const exportStatusFilter =
    statusFilter === 'draft' || statusFilter === 'locked'
      ? statusFilter
      : undefined

  const serverFilterKey = `${sanghaType}:${scopedOrgUnitId ?? ''}:${serverStatusFilter ?? ''}`

  const canonicalTabs = useMemo(
    () => canonicalHaLapTabRankKeys(sanghaType),
    [sanghaType],
  )

  const resolvedActiveTab = useMemo(() => {
    if (activeTab && canonicalTabs.includes(activeTab)) {
      return activeTab
    }
    if (activeTab) return activeTab
    return canonicalTabs[0] ?? ''
  }, [activeTab, canonicalTabs])

  const activeTabState = tabStateByRank[resolvedActiveTab] ?? EMPTY_TAB_STATE

  useEffect(() => {
    if (lastFilterKeyRef.current === serverFilterKey) return
    lastFilterKeyRef.current = serverFilterKey
    setTabStateByRank({})
  }, [serverFilterKey])

  const orgUnits = useQuery({
    ...orgUnitsQuery(),
    enabled: manageDirectory,
  })

  const members = useQuery({
    ...membersByHaLapTabQuery({
      sanghaType,
      haLapTabRank: resolvedActiveTab,
      orgUnitId: scopedOrgUnitId,
      status: serverStatusFilter,
      cursor: activeTabState.cursor,
    }),
    enabled: manageDirectory && !!resolvedActiveTab,
    staleTime: 5 * 60_000,
  })

  const tabCounts = useQuery({
    ...membersHaLapTabCountsQuery({
      sanghaType,
      orgUnitId: scopedOrgUnitId,
      status: serverStatusFilter,
      tabRanks: canonicalTabs,
    }),
    enabled: manageDirectory && statusFilter !== 'edit_requested',
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    if (!members.data || !resolvedActiveTab) return
    setTabStateByRank((prev) => {
      const current = prev[resolvedActiveTab] ?? EMPTY_TAB_STATE
      const appendKey = `${current.cursor ?? 'start'}:${members.dataUpdatedAt}`
      if (current.lastAppendKey === appendKey) return prev
      const nextItems = dedupeMembersById(
        current.cursor
          ? [...current.items, ...members.data!.items]
          : members.data!.items,
      )
      return {
        ...prev,
        [resolvedActiveTab]: {
          items: nextItems,
          nextCursor: members.data!.nextCursor,
          cursor: current.cursor,
          lastAppendKey: appendKey,
        },
      }
    })
  }, [members.data, members.dataUpdatedAt, resolvedActiveTab])

  const activeTabMembers = useMemo(
    () =>
      filterTabMembers(
        tabStateByRank[resolvedActiveTab]?.items ?? [],
        statusFilter,
      ),
    [tabStateByRank, resolvedActiveTab, statusFilter],
  )

  const tabSummaries = useMemo(() => {
    const rankKeys = new Set(canonicalTabs)
    if (resolvedActiveTab) rankKeys.add(resolvedActiveTab)

    const ordered = [
      ...canonicalTabs,
      ...[...rankKeys].filter((key) => !canonicalTabs.includes(key)).sort(),
    ]

    return ordered.map((rankKey) => ({
      rankKey,
      loadedCount: filterTabMembers(
        tabStateByRank[rankKey]?.items ?? [],
        statusFilter,
      ).length,
      totalCount: tabCounts.data?.[rankKey],
    }))
  }, [canonicalTabs, resolvedActiveTab, tabStateByRank, statusFilter, tabCounts.data])

  const itemIds = useMemo(() => {
    const ids: string[] = []
    for (const state of Object.values(tabStateByRank)) {
      for (const member of filterTabMembers(state.items, statusFilter)) {
        ids.push(member.id)
      }
    }
    return ids
  }, [tabStateByRank, statusFilter])

  const selection = useAdminListSelection(itemIds)

  function resetTabState() {
    setTabStateByRank({})
    lastFilterKeyRef.current = null
  }

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!claims) throw new Error('Not signed in as admin')
      const idToken = await user!.getIdToken()
      await deleteMembers(claims, {
        ids: [...selection.selectedIds],
        idToken,
      })
    },
    onSuccess: () => {
      selection.clear()
      setConfirmOpen(false)
      resetTabState()
      void queryClient.invalidateQueries({
        queryKey: [...adminKeys.all, 'membersByHaLapTab'],
      })
      void queryClient.invalidateQueries({
        queryKey: [...adminKeys.all, 'membersHaLapTabCounts'],
      })
      void queryClient.invalidateQueries({
        queryKey: [...adminKeys.all, 'members'],
      })
    },
    onError: () => {
      setConfirmOpen(false)
      void queryClient.invalidateQueries({
        queryKey: [...adminKeys.all, 'membersByHaLapTab'],
      })
      void queryClient.invalidateQueries({
        queryKey: [...adminKeys.all, 'membersHaLapTabCounts'],
      })
      void queryClient.invalidateQueries({
        queryKey: [...adminKeys.all, 'members'],
      })
    },
  })

  const orgUnitNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const unit of orgUnits.data ?? []) {
      map.set(unit.id, unit.name)
    }
    return map
  }, [orgUnits.data])

  const exportMutation = useMutation({
    mutationFn: (columnIds: string[]) =>
      exportMembersExcel({
        sanghaType,
        orgUnitId: scopedOrgUnitId,
        status: exportStatusFilter,
        columnIds,
        orgUnitNameById: Object.fromEntries(orgUnitNameById),
      }),
  })

  const unlockMutation = useMutation({
    mutationFn: async (memberId: string) => {
      if (claim.status !== 'admin') throw new Error('Not signed in as admin')
      return unlockMember({
        memberId,
        audit: { actorType: 'admin', actorId: claim.uid },
      })
    },
    onSuccess: () => {
      resetTabState()
      void queryClient.invalidateQueries({
        queryKey: [...adminKeys.all, 'membersByHaLapTab'],
      })
      void queryClient.invalidateQueries({
        queryKey: [...adminKeys.all, 'membersHaLapTabCounts'],
      })
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

  const isInitialLoading =
    members.isPending && activeTabState.items.length === 0

  function handleLoadMore() {
    const nextCursor = tabStateByRank[resolvedActiveTab]?.nextCursor
    if (!nextCursor) return
    setTabStateByRank((prev) => ({
      ...prev,
      [resolvedActiveTab]: {
        ...(prev[resolvedActiveTab] ?? EMPTY_TAB_STATE),
        cursor: nextCursor,
      },
    }))
  }

  if (claim.status === 'admin' && !manageDirectory) {
    return <AdminDenied />
  }

  return (
    <Stack>
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <Title order={2}>{listTitle(sanghaType)}</Title>
        <Group wrap="wrap">
          <Button
            variant="default"
            onClick={() => {
              setDisplayColumnIds(loadMembersTableColumnIds(sanghaType))
              setDisplayColumnsOpen(true)
            }}
          >
            {m.admin_members_table_columns()}
          </Button>
          <Button
            variant="default"
            loading={exportMutation.isPending}
            disabled={exportMutation.isPending}
            onClick={() => {
              setExportColumnIds(loadMembersExcelColumnIds(sanghaType))
              setExportOpen(true)
            }}
          >
            {m.admin_members_export_excel()}
          </Button>
          <Button
            component={Link}
            to="/admin/members/new"
            search={{ sanghaType }}
          >
            {m.admin_members_create()}
          </Button>
        </Group>
      </Group>

      {exportMutation.error && (
        <Text c="red" size="sm" role="alert">
          {exportMutation.error.message}
        </Text>
      )}

      <Group wrap="wrap" gap="sm" align="flex-end">
        {isHePhaiScoped && (
          <Select
            label={m.admin_members_filter_org_unit()}
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
          label={m.admin_members_filter_status()}
          placeholder={m.admin_filter_all()}
          data={statusSelectData}
          value={statusFilter}
          onChange={(value) => setStatusFilter(value as StatusFilterValue | null)}
          clearable
          w={{ base: '100%', sm: 220 }}
        />
      </Group>

      {selection.selectedCount > 0 && (
        <Group wrap="wrap">
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

      {unlockMutation.error && (
        <Text c="red" size="sm" role="alert">
          {unlockMutation.error.message}
        </Text>
      )}

      {members.isError && members.error && (
        <QueryErrorAlert error={members.error} />
      )}
      {!members.isError && (
        <>
          {isInitialLoading ? (
            <AdminDataTable loading aria-label={listTitle(sanghaType)}>
              <></>
            </AdminDataTable>
          ) : (
            <MembersHaLapTabs
              sanghaType={sanghaType}
              tabs={tabSummaries}
              activeTabMembers={activeTabMembers}
              orgUnitNameById={orgUnitNameById}
              displayColumnIds={displayColumnIds}
              activeTab={resolvedActiveTab}
              onActiveTabChange={(rankKey) => onActiveTabChange?.(rankKey)}
              selectedIds={selection.selectedIds}
              onToggle={selection.toggle}
              onToggleAllInTab={selection.toggleAllInTab}
              onUnlock={(memberId) => unlockMutation.mutate(memberId)}
              unlockingMemberId={
                unlockMutation.isPending ? unlockMutation.variables : undefined
              }
              isLoading={members.isFetching && activeTabState.items.length === 0}
              hasMore={!!tabStateByRank[resolvedActiveTab]?.nextCursor}
              onLoadMore={handleLoadMore}
              isFetchingMore={
                members.isFetching && activeTabState.items.length > 0
              }
            />
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

      <MembersExcelColumnsModal
        opened={exportOpen}
        onClose={() => setExportOpen(false)}
        sanghaType={sanghaType}
        columnIds={exportColumnIds}
        onColumnIdsChange={setExportColumnIds}
        confirmLoading={exportMutation.isPending}
        onConfirm={() => {
          if (exportColumnIds.length === 0) return
          saveMembersExcelColumnIds(sanghaType, exportColumnIds)
          setExportOpen(false)
          exportMutation.mutate(exportColumnIds)
        }}
      />

      <MembersExcelColumnsModal
        opened={displayColumnsOpen}
        onClose={() => setDisplayColumnsOpen(false)}
        sanghaType={sanghaType}
        columnIds={displayColumnIds}
        onColumnIdsChange={setDisplayColumnIds}
        title={m.admin_members_table_columns_title}
        confirmLabel={m.admin_members_table_columns_save}
        onConfirm={() => {
          if (displayColumnIds.length === 0) return
          saveMembersTableColumnIds(sanghaType, displayColumnIds)
          setDisplayColumnsOpen(false)
        }}
      />
    </Stack>
  )
}
