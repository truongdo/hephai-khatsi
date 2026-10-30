import { Button, Group, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'

export function RepeatableFieldset({
  label,
  description,
  addLabel,
  onAdd,
  disabled,
  children,
}: {
  label: string
  description?: string
  addLabel: string
  onAdd: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-start">
        <Stack gap={2}>
          <Text fw={600}>{label}</Text>
          {description ? (
            <Text size="xs" c="dimmed">
              {description}
            </Text>
          ) : null}
        </Stack>
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
