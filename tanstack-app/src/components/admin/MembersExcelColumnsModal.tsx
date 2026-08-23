import { Button, Checkbox, Group, Modal, ScrollArea, SimpleGrid, Stack, Text } from '@mantine/core'
import {
  catalogMembersExcelColumns,
  type MemberExcelColumnDef,
  type MemberExcelColumnGroup,
} from '#/domain/memberExcelColumns'
import type { SanghaType } from '#/domain/types'
import { m } from '#/paraglide/messages'

export type MembersExcelColumnsModalProps = {
  opened: boolean
  onClose: () => void
  sanghaType: SanghaType
  columnIds: string[]
  onColumnIdsChange: (ids: string[]) => void
  onConfirm: () => void
  confirmLoading?: boolean
  title?: () => string
  confirmLabel?: () => string
}

const GROUP_ORDER: MemberExcelColumnGroup[] = [
  'system',
  'identity',
  'papers',
  'contact',
  'ordination',
  'precepts',
  'ranks',
  'education',
  'other',
]

function groupLabel(group: MemberExcelColumnGroup): string {
  switch (group) {
    case 'system':
      return m.admin_members_export_group_system()
    case 'identity':
      return m.admin_members_export_group_identity()
    case 'papers':
      return m.admin_members_export_group_papers()
    case 'contact':
      return m.admin_members_export_group_contact()
    case 'ordination':
      return m.admin_members_export_group_ordination()
    case 'precepts':
      return m.admin_members_export_group_precepts()
    case 'ranks':
      return m.admin_members_export_group_ranks()
    case 'education':
      return m.admin_members_export_group_education()
    case 'other':
      return m.admin_members_export_group_other()
  }
}

function groupColumns(columns: MemberExcelColumnDef[]): Map<MemberExcelColumnGroup, MemberExcelColumnDef[]> {
  const grouped = new Map<MemberExcelColumnGroup, MemberExcelColumnDef[]>()
  for (const column of columns) {
    const list = grouped.get(column.group) ?? []
    list.push(column)
    grouped.set(column.group, list)
  }
  return grouped
}

export function MembersExcelColumnsModal({
  opened,
  onClose,
  sanghaType,
  columnIds,
  onColumnIdsChange,
  onConfirm,
  confirmLoading = false,
  title = m.admin_members_export_columns_title,
  confirmLabel = m.admin_members_export_confirm,
}: MembersExcelColumnsModalProps) {
  const catalog = catalogMembersExcelColumns(sanghaType)
  const grouped = groupColumns(catalog)

  function toggleColumn(id: string, checked: boolean) {
    if (checked) {
      onColumnIdsChange([...columnIds, id])
    } else {
      onColumnIdsChange(columnIds.filter((columnId) => columnId !== id))
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title()}
      size="960px"
      closeOnClickOutside={!confirmLoading}
      closeOnEscape={!confirmLoading}
    >
      <Group mb="md" gap="sm">
        <Button
          variant="light"
          size="compact-sm"
          onClick={() => onColumnIdsChange(catalog.map((column) => column.id))}
        >
          {m.admin_members_export_select_all()}
        </Button>
        <Button variant="light" size="compact-sm" onClick={() => onColumnIdsChange([])}>
          {m.admin_members_export_deselect()}
        </Button>
      </Group>

      <ScrollArea.Autosize mah="65vh" type="auto" offsetScrollbars>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {GROUP_ORDER.map((group) => {
            const columns = grouped.get(group)
            if (!columns?.length) return null
            return (
              <Stack key={group} gap="xs">
                <Text fw={600} size="sm">
                  {groupLabel(group)}
                </Text>
                {columns.map((column) => (
                  <Checkbox
                    key={column.id}
                    label={column.header()}
                    checked={columnIds.includes(column.id)}
                    onChange={(event) => toggleColumn(column.id, event.currentTarget.checked)}
                  />
                ))}
              </Stack>
            )
          })}
        </SimpleGrid>
      </ScrollArea.Autosize>

      <Group justify="flex-end" mt="md" wrap="wrap" gap="sm">
        <Button
          onClick={onConfirm}
          disabled={columnIds.length === 0 || confirmLoading}
          loading={confirmLoading}
        >
          {confirmLabel()}
        </Button>
      </Group>
    </Modal>
  )
}
