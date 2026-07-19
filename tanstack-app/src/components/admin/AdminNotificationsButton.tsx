import { ActionIcon, Popover, Stack, Text } from '@mantine/core'
import { Bell } from 'lucide-react'
import { m } from '#/paraglide/messages'

export function AdminNotificationsButton() {
  return (
    <Popover width={280} position="bottom-end" shadow="md" withArrow>
      <Popover.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="lg"
          aria-label={m.admin_notifications_aria()}
        >
          <Bell size={20} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <Text fw={600} size="sm">
            {m.admin_notifications_title()}
          </Text>
          <Text size="sm" c="dimmed">
            {m.admin_notifications_empty()}
          </Text>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  )
}
