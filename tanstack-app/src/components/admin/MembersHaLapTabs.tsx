import {
  Badge,
  Button,
  Checkbox,
  Group,
  Stack,
  Table,
  Tabs,
  Text,
} from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { m } from '#/paraglide/messages'
import { AdminDataTable } from '#/components/admin/AdminDataTable'
import { emptyCell } from '#/components/admin/emptyCell'
import { RecordStatusBadge } from '#/components/admin/RecordStatusBadge'
import { haLapTabLabel } from '#/domain/membersHaLapGroups'
import type { Member, RecordStatus, SanghaType } from '#/domain/types'

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

function statusLabel(status: RecordStatus): string {
  switch (status) {
    case 'draft':
      return m.admin_members_status_draft()
    case 'locked':
      return m.admin_members_status_locked()
  }
}

function memberDisplayName(member: Member): string {
  return member.phapDanh ?? member.theDanh ?? member.id
}

type HaLapMemberTableProps = {
  members: Member[]
  orgUnitNameById: Map<string, string>
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
  members,
  orgUnitNameById,
  tabMemberIds,
  selectedIds,
  onToggle,
  onToggleAllInTab,
  onUnlock,
  unlockingMemberId,
  ariaLabel,
  isLoading,
}: HaLapMemberTableProps) {
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
          <Table.Th>{m.admin_members_col_phap_danh()}</Table.Th>
          <Table.Th>{m.admin_members_col_the_danh()}</Table.Th>
          <Table.Th>{m.admin_members_col_giao_doan()}</Table.Th>
          <Table.Th>{m.admin_members_col_cccd()}</Table.Th>
          <Table.Th>{m.admin_members_col_status()}</Table.Th>
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
            <Table.Td>
              {member.phapDanh ? (
                <Text
                  component={Link}
                  to="/admin/members/$id"
                  params={{ id: member.id }}
                  c="teal.7"
                  fw={600}
                >
                  {member.phapDanh}
                </Text>
              ) : (
                emptyCell(member.phapDanh)
              )}
            </Table.Td>
            <Table.Td>{emptyCell(member.theDanh)}</Table.Td>
            <Table.Td>
              {emptyCell(
                orgUnitNameById.get(member.orgUnitId) ?? member.orgUnitId,
              )}
            </Table.Td>
            <Table.Td>{member.cccd}</Table.Td>
            <Table.Td>
              <Group gap="xs">
                <RecordStatusBadge
                  status={member.status}
                  label={statusLabel(member.status)}
                />
                {member.editRequestedAt != null && (
                  <Badge color="orange" variant="light" radius="sm">
                    {m.admin_edit_requested_badge()}
                  </Badge>
                )}
              </Group>
            </Table.Td>
            <Table.Td>
              {member.status === 'locked' && (
                <Button
                  size="compact-xs"
                  variant={
                    member.editRequestedAt != null ? 'filled' : 'light'
                  }
                  loading={unlockingMemberId === member.id}
                  onClick={() => onUnlock(member.id)}
                >
                  {m.admin_members_unlock_row()}
                </Button>
              )}
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
            members={activeTabMembers}
            orgUnitNameById={orgUnitNameById}
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
