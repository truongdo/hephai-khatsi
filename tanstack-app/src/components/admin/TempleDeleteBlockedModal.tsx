import { List, Modal, Stack, Text } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { m } from '#/paraglide/messages'
import type { TempleDeleteBlocker } from '#/use-cases/deleteTemples'

type TempleDeleteBlockedModalProps = {
  opened: boolean
  blockers: TempleDeleteBlocker[]
  onClose: () => void
}

export function TempleDeleteBlockedModal({
  opened,
  blockers,
  onClose,
}: TempleDeleteBlockedModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={m.admin_bulk_temple_blocked_title()}
    >
      <Stack gap="md">
        <Text>{m.admin_bulk_temple_blocked_body()}</Text>
        {blockers.map((blocker) => (
          <Stack key={blocker.templeId} gap="xs">
            <Text fw={600}>{blocker.templeLabel}</Text>
            <List>
              {blocker.members.map((member) => (
                <List.Item key={member.id}>
                  <Text
                    component={Link}
                    to="/admin/members/$id"
                    params={{ id: member.id }}
                    target="_blank"
                    rel="noopener noreferrer"
                    c="teal.7"
                  >
                    {member.label}
                  </Text>
                </List.Item>
              ))}
            </List>
          </Stack>
        ))}
      </Stack>
    </Modal>
  )
}
