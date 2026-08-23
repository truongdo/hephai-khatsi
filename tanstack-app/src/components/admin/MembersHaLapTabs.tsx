import {
  Button,
  Checkbox,
  Stack,
  Table,
  Tabs,
} from '@mantine/core'
import { useMemo } from 'react'
import { AdminDataTable } from '#/components/admin/AdminDataTable'
import {
  renderMemberTableActions,
  renderMemberTableCell,
} from '#/components/admin/memberTableCell'
import { membersTableDisplayColumns } from '#/domain/memberExcelColumns'
import { haLapTabLabel } from '#/domain/membersHaLapGroups'
import type { Member, SanghaType } from '#/domain/types'
import { m } from '#/paraglide/messages'

export type HaLapTabSummary = {
  rankKey: string
  loadedCount: number
  totalCount?: number
}

export type MembersHaLapTabsProps = {
  sanghaType: SanghaType
  tabs: HaLapTabSummary[]
  activeTabMembers: Member[]
  orgUnitNameById: Map<string, string>
  displayColumnIds: string[]
  activeTab: string
  onActiveTabChange: (rankKey: string) => void
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onToggleAllInTab: (ids: string[], select: boolean) => void
  onUnlock: (memberId: string) => void
  unlockingMemberId?: string
  isLoading?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
  isFetchingMore?: boolean
}

function memberDisplayName(member: Member): string {
  return member.phapDanh ?? member.theDanh ?? member.id
}

type HaLapMemberTableProps = {
  sanghaType: SanghaType
  members: Member[]
  orgUnitNameById: Map<string, string>
  displayColumnIds: string[]
  tabMemberIds: string[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onToggleAllInTab: (ids: string[], select: boolean) => void
  onUnlock: (memberId: string) => void
  unlockingMemberId?: string
  ariaLabel: string
  isLoading?: boolean
}

function HaLapMemberTable({
  sanghaType,
  members,
  orgUnitNameById,
  displayColumnIds,
  tabMemberIds,
  selectedIds,
  onToggle,
  onToggleAllInTab,
  onUnlock,
  unlockingMemberId,
  ariaLabel,
  isLoading,
}: HaLapMemberTableProps) {
  const displayColumns = useMemo(
    () => membersTableDisplayColumns(sanghaType, displayColumnIds),
    [sanghaType, displayColumnIds],
  )

  const selectedInTabCount = useMemo(() => {
    let count = 0
    for (const id of tabMemberIds) {
      if (selectedIds.has(id)) count += 1
    }
    return count
  }, [tabMemberIds, selectedIds])

  const allTabSelected =
    tabMemberIds.length > 0 && selectedInTabCount === tabMemberIds.length
  const someTabSelected = selectedInTabCount > 0 && !allTabSelected

  const cellCtx = useMemo(
    () => ({
      orgUnitNameById,
      onUnlock,
      unlockingMemberId,
    }),
    [orgUnitNameById, onUnlock, unlockingMemberId],
  )

  return (
    <AdminDataTable
      loading={isLoading}
      empty={!isLoading && members.length === 0}
      aria-label={ariaLabel}
    >
      <Table.Thead>
        <Table.Tr>
          <Table.Th w={40}>
            <Checkbox
              checked={allTabSelected}
              indeterminate={someTabSelected}
              onChange={() =>
                onToggleAllInTab(tabMemberIds, !allTabSelected)
              }
              aria-label={m.admin_bulk_selected({ count: selectedInTabCount })}
            />
          </Table.Th>
          <Table.Th w={48}>STT</Table.Th>
          {displayColumns.map((column) => (
            <Table.Th key={column.id}>{column.header()}</Table.Th>
          ))}
          <Table.Th w={100} />
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {members.map((member, index) => (
          <Table.Tr key={member.id}>
            <Table.Td>
              <Checkbox
                checked={selectedIds.has(member.id)}
                onChange={() => onToggle(member.id)}
                aria-label={memberDisplayName(member)}
              />
            </Table.Td>
            <Table.Td>{index + 1}</Table.Td>
            {displayColumns.map((column) => (
              <Table.Td key={column.id}>
                {renderMemberTableCell(column.id, member, cellCtx)}
              </Table.Td>
            ))}
            <Table.Td>
              {renderMemberTableActions(member, cellCtx)}
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </AdminDataTable>
  )
}

export function MembersHaLapTabs({
  sanghaType,
  tabs,
  activeTabMembers,
  orgUnitNameById,
  displayColumnIds,
  activeTab,
  onActiveTabChange,
  selectedIds,
  onToggle,
  onToggleAllInTab,
  onUnlock,
  unlockingMemberId,
  isLoading,
  hasMore,
  onLoadMore,
  isFetchingMore,
}: MembersHaLapTabsProps) {
  const activeTabMemberIds = activeTabMembers.map((member) => member.id)
  const activeTabSummary = tabs.find((tab) => tab.rankKey === activeTab)
  const activeTabLabel = haLapTabLabel(
    activeTab,
    sanghaType,
    activeTabMembers.length,
    activeTabSummary?.totalCount,
  )

  return (
    <Stack gap="sm">
      <Tabs
        value={activeTab}
        onChange={(value) => value && onActiveTabChange(value)}
        keepMounted={false}
      >
        <Tabs.List>
          {tabs.map((tab) => (
            <Tabs.Tab key={tab.rankKey} value={tab.rankKey}>
              {haLapTabLabel(
                tab.rankKey,
                sanghaType,
                tab.loadedCount,
                tab.totalCount,
              )}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panel value={activeTab}>
          <HaLapMemberTable
            sanghaType={sanghaType}
            members={activeTabMembers}
            orgUnitNameById={orgUnitNameById}
            displayColumnIds={displayColumnIds}
            tabMemberIds={activeTabMemberIds}
            selectedIds={selectedIds}
            onToggle={onToggle}
            onToggleAllInTab={onToggleAllInTab}
            onUnlock={onUnlock}
            unlockingMemberId={unlockingMemberId}
            ariaLabel={activeTabLabel}
            isLoading={isLoading}
          />
        </Tabs.Panel>
      </Tabs>
      {hasMore && onLoadMore && (
        <Button variant="light" loading={isFetchingMore} onClick={onLoadMore}>
          {m.admin_members_load_more()}
        </Button>
      )}
    </Stack>
  )
}
