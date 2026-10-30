import { Stack, Text } from '@mantine/core'
import { m } from '#/paraglide/messages'

type QueryErrorAlertProps = {
  error: Error
}

export function QueryErrorAlert({ error }: QueryErrorAlertProps) {
  return (
    <Stack gap={4}>
      <Text c="red" role="alert">
        {m.admin_error_load()}
      </Text>
      <Text c="red" size="sm" style={{ wordBreak: 'break-word' }}>
        {error.message}
      </Text>
    </Stack>
  )
}
