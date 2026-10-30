import { Stack, Text, Title } from '@mantine/core'
import { m } from '#/paraglide/messages'

export function AdminDenied() {
  return (
    <Stack maw={480} mx="auto" p="xl" gap="sm">
      <Title order={1}>{m.admin_denied_title()}</Title>
      <Text>{m.admin_denied_body()}</Text>
    </Stack>
  )
}
