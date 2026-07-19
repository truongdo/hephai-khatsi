import { Badge, Box, Group, Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'
import { m } from '#/paraglide/messages'

export type FillerEditorStatus = 'draft' | 'view'

export type FillerEditorShellProps = {
  title: string
  status: FillerEditorStatus
  children?: ReactNode
}

const STATUS_COLOR: Record<FillerEditorStatus, string> = {
  draft: 'jade',
  view: 'clay',
}

function statusLabel(status: FillerEditorStatus): string {
  return status === 'draft' ? m.filler_status_draft() : m.filler_status_view()
}

export function FillerEditorShell({
  title,
  status,
  children,
}: FillerEditorShellProps) {
  return (
    <Stack gap="lg">
      <Box
        component="header"
        data-testid="filler-editor-header"
        py="sm"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          backgroundColor: 'var(--paper)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <Group justify="space-between" align="center" wrap="wrap" gap="sm">
          <Title order={2}>{title}</Title>
          <Badge color={STATUS_COLOR[status]} variant="light" radius="sm">
            {statusLabel(status)}
          </Badge>
        </Group>
      </Box>
      {children ?? (
        <Text c="dimmed">{m.filler_editor_placeholder()}</Text>
      )}
    </Stack>
  )
}
