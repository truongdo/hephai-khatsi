import { Button, Group, Modal, Text } from '@mantine/core'
import { m } from '#/paraglide/messages'

type AdminConfirmDeleteModalProps = {
  opened: boolean
  count: number
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function AdminConfirmDeleteModal({
  opened,
  count,
  loading,
  onCancel,
  onConfirm,
}: AdminConfirmDeleteModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      title={m.admin_bulk_confirm_title({ count })}
      closeOnClickOutside={!loading}
      closeOnEscape={!loading}
    >
      <Text>{m.admin_bulk_confirm_body()}</Text>
      <Group justify="flex-end" mt="md" wrap="wrap" gap="sm">
        <Button variant="default" onClick={onCancel} disabled={loading}>
          Hủy
        </Button>
        <Button color="red" loading={loading} onClick={onConfirm}>
          {m.admin_bulk_confirm_action()}
        </Button>
      </Group>
    </Modal>
  )
}
