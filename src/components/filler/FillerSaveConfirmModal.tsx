import { Button, Group, Modal, Text } from '@mantine/core'
import { m } from '#/paraglide/messages'

type FillerSaveConfirmModalProps = {
  opened: boolean
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function FillerSaveConfirmModal({
  opened,
  loading,
  onCancel,
  onConfirm,
}: FillerSaveConfirmModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      title={m.filler_save_confirm_title()}
      closeOnClickOutside={!loading}
      closeOnEscape={!loading}
    >
      <Text>{m.filler_save_confirm_body()}</Text>
      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onCancel} disabled={loading}>
          {m.filler_save_confirm_cancel()}
        </Button>
        <Button loading={loading} onClick={onConfirm}>
          {m.filler_save_confirm_ok()}
        </Button>
      </Group>
    </Modal>
  )
}
