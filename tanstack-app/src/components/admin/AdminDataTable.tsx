import { Paper, Skeleton, Stack, Table, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import { m } from '#/paraglide/messages'

export type AdminDataTableProps = {
  children: ReactNode
  empty?: boolean
  emptyMessage?: string
  loading?: boolean
  'aria-label'?: string
}

export function AdminDataTable({
  children,
  empty = false,
  emptyMessage,
  loading = false,
  'aria-label': ariaLabel,
}: AdminDataTableProps) {
  return (
    <Paper>
      {loading ? (
        <Stack gap="sm" p="md" aria-busy="true" aria-label={ariaLabel ?? 'loading'}>
          <Skeleton height={36} />
          <Skeleton height={36} />
          <Skeleton height={36} />
          <Skeleton height={36} />
        </Stack>
      ) : empty ? (
        <Text ta="center" c="dimmed" py="xl" px="md">
          {emptyMessage ?? m.admin_table_empty()}
        </Text>
      ) : (
        <Table aria-label={ariaLabel}>{children}</Table>
      )}
    </Paper>
  )
}
