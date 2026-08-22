import { Group, Table } from '@mantine/core'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { m } from '#/paraglide/messages'

export type AdminSortableThProps<T extends string> = {
  column: T
  label: string
  sortBy: T
  sortDir: 'asc' | 'desc'
  onSort: (column: T) => void
  w?: number | string
}

const SORT_ICON_SIZE = 14

export function AdminSortableTh<T extends string>({
  column,
  label,
  sortBy,
  sortDir,
  onSort,
  w,
}: AdminSortableThProps<T>) {
  const isActive = sortBy === column
  const ariaSort = isActive
    ? sortDir === 'asc'
      ? 'ascending'
      : 'descending'
    : 'none'

  const sortHint = isActive
    ? sortDir === 'asc'
      ? m.admin_table_sort_desc()
      : m.admin_table_sort_none()
    : m.admin_table_sort_asc()

  const SortIcon = isActive
    ? sortDir === 'asc'
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown

  return (
    <Table.Th
      w={w}
      style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
      aria-sort={ariaSort}
      title={sortHint}
      onClick={() => onSort(column)}
    >
      <Group gap={4} wrap="nowrap" justify="flex-start">
        <span>{label}</span>
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: SORT_ICON_SIZE,
            height: SORT_ICON_SIZE,
            flexShrink: 0,
          }}
        >
          <SortIcon
            size={SORT_ICON_SIZE}
            strokeWidth={2}
            style={{
              opacity: isActive ? 1 : 0.55,
            }}
          />
        </span>
      </Group>
    </Table.Th>
  )
}
