import { Button, Group, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'

export function RepeatableFieldset({
  label,
  addLabel,
  onAdd,
  disabled,
  children,
}: {
  label: string
  addLabel: string
  onAdd: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <Stack gap="sm">
      <Group justify="space-between" align="center">
        <Text fw={600}>{label}</Text>
        <Button
          type="button"
          variant="light"
          size="sm"
          onClick={onAdd}
          disabled={disabled}
        >
          {addLabel}
        </Button>
      </Group>
      <Stack gap="md">{children}</Stack>
    </Stack>
  )
}
