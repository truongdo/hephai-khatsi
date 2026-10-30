import { Badge } from '@mantine/core'
import type { RecordStatus } from '#/domain/types'

const STATUS_COLOR: Record<RecordStatus, string> = {
  draft: 'jade',
  locked: 'clay',
}

export function RecordStatusBadge({
  status,
  label,
}: {
  status: RecordStatus
  label: string
}) {
  return (
    <Badge color={STATUS_COLOR[status]} variant="light" radius="sm">
      {label}
    </Badge>
  )
}
