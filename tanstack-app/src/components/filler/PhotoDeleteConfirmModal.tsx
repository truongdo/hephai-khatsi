import { Button, Group, Modal, Text } from '@mantine/core'
import { m } from '#/paraglide/messages'

type PhotoDeleteConfirmModalProps = {
  opened: boolean
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function PhotoDeleteConfirmModal({
  opened,
  loading,
  onCancel,
  onConfirm,
}: PhotoDeleteConfirmModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      title={m.filler_photo_delete_confirm_title()}
      closeOnClickOutside={!loading}
      closeOnEscape={!loading}
    >
      <Text>{m.filler_photo_delete_confirm_body()}</Text>
      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onCancel} disabled={loading}>
          {m.filler_photo_delete_cancel()}
        </Button>
        <Button color="red" loading={loading} onClick={onConfirm}>
          {m.filler_photo_delete_confirm_action()}
        </Button>
      </Group>
    </Modal>
  )
}
