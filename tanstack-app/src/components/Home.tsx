import { Stack, Text, Title } from '@mantine/core'
import { m } from '#/paraglide/messages'

export function Home() {
  return (
    <Stack p="xl" gap="md">
      <Title order={1}>{m.home_welcome()}</Title>
      <Text size="lg">{m.home_get_started()}</Text>
    </Stack>
  )
}
