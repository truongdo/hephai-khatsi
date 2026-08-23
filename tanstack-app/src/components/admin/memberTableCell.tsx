import { Badge, Button, Group, Text } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { emptyCell } from '#/components/admin/emptyCell'
import { RecordStatusBadge } from '#/components/admin/RecordStatusBadge'
import {
  catalogMembersExcelColumns,
  type MembersExcelRowContext,
} from '#/domain/memberExcelColumns'
import type { Member, RecordStatus } from '#/domain/types'
import { m } from '#/paraglide/messages'

export type MemberTableCellContext = {
  orgUnitNameById: Map<string, string>
  onUnlock: (memberId: string) => void
  unlockingMemberId?: string
}

function statusLabel(status: RecordStatus): string {
  switch (status) {
    case 'draft':
      return m.admin_members_status_draft()
    case 'locked':
      return m.admin_members_status_locked()
  }
}

function excelRowContext(ctx: MemberTableCellContext): MembersExcelRowContext {
  return { orgUnitNameById: Object.fromEntries(ctx.orgUnitNameById) }
}

export function renderMemberTableCell(
  columnId: string,
  member: Member,
  ctx: MemberTableCellContext,
): ReactNode {
  if (columnId === 'phapDanh') {
    return member.phapDanh ? (
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
    )
  }

  if (columnId === 'status') {
    return (
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
    )
  }

  const column = catalogMembersExcelColumns(member.sanghaType).find(
    (c) => c.id === columnId,
  )
  if (!column) return null

  const value = column.cell(member, excelRowContext(ctx))
  return emptyCell(value === '' ? undefined : String(value))
}

export function renderMemberTableActions(
  member: Member,
  ctx: Pick<MemberTableCellContext, 'onUnlock' | 'unlockingMemberId'>,
): ReactNode {
  if (member.status !== 'locked') return null
  return (
    <Button
      size="compact-xs"
      variant={member.editRequestedAt != null ? 'filled' : 'light'}
      loading={ctx.unlockingMemberId === member.id}
      onClick={() => ctx.onUnlock(member.id)}
    >
      {m.admin_members_unlock_row()}
    </Button>
  )
}
