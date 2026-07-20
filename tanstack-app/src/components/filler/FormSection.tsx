import { Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'

export function FormSection({
  title,
  helper,
  children,
}: {
  title: string
  helper?: string
  children: ReactNode
}) {
  return (
    <Stack gap="sm" component="section">
      <Title order={3}>{title}</Title>
      {helper ? (
        <Text size="sm" c="dimmed">
          {helper}
        </Text>
      ) : null}
      <Stack gap="md">{children}</Stack>
    </Stack>
  )
}
