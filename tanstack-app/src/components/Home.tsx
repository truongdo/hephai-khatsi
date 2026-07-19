import { Stack, Text, Title } from '@mantine/core'

export function Home() {
  return (
    <Stack p="xl" gap="md">
      <Title order={1}>Welcome to TanStack Start</Title>
      <Text size="lg">
        Edit <code>src/routes/index.tsx</code> to get started.
      </Text>
    </Stack>
  )
}
