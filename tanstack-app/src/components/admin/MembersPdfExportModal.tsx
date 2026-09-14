import { Button, Group, Modal, Radio, Stack, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
import { m } from '#/paraglide/messages'
import type { MembersPdfFormat } from '#/use-cases/exportMembersPdf'

export type MembersPdfExportChoice = {
  source: 'selected' | 'filter'
  format: MembersPdfFormat
}

export type MembersPdfExportModalProps = {
  opened: boolean
  onClose: () => void
  selectedCount: number
  progress: { done: number; total: number } | null
  loading: boolean
  errorMessage?: string | null
  warningMessage?: string | null
  onConfirm: (choice: MembersPdfExportChoice) => void
}

export function MembersPdfExportModal({
  opened,
  onClose,
  selectedCount,
  progress,
  loading,
  errorMessage,
  warningMessage,
  onConfirm,
}: MembersPdfExportModalProps) {
  const [source, setSource] = useState<'selected' | 'filter'>('filter')
  const [format, setFormat] = useState<MembersPdfFormat>('merged_pdf')

  useEffect(() => {
    if (!opened) return
    setSource(selectedCount > 0 ? 'selected' : 'filter')
    setFormat('merged_pdf')
  }, [opened, selectedCount])

  const confirmDisabled =
    loading || (source === 'selected' && selectedCount === 0)

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={m.admin_members_export_pdf_title()}
      closeOnClickOutside={!loading}
      closeOnEscape={!loading}
    >
      <Stack gap="md">
        <Radio.Group
          label={m.admin_members_export_pdf_source()}
          value={source}
          onChange={(value) => setSource(value as 'selected' | 'filter')}
        >
          <Stack gap="xs" mt="xs">
            <Radio
              value="selected"
              label={
                selectedCount > 0
                  ? m.admin_members_export_pdf_source_selected()
                  : m.admin_members_export_pdf_source_selected_disabled()
              }
            />
            <Radio
              value="filter"
              label={m.admin_members_export_pdf_source_filter()}
            />
          </Stack>
        </Radio.Group>

        <Radio.Group
          label={m.admin_members_export_pdf_format()}
          value={format}
          onChange={(value) => setFormat(value as MembersPdfFormat)}
        >
          <Stack gap="xs" mt="xs">
            <Radio
              value="merged_pdf"
              label={m.admin_members_export_pdf_format_merged()}
            />
            <Radio
              value="zip"
              label={m.admin_members_export_pdf_format_zip()}
            />
          </Stack>
        </Radio.Group>

        {progress && (
          <Text size="sm">
            {m.admin_members_export_pdf_progress({
              done: progress.done,
              total: progress.total,
            })}
          </Text>
        )}

        {errorMessage && (
          <Text c="red" size="sm" role="alert">
            {errorMessage}
          </Text>
        )}

        {warningMessage && (
          <Text c="yellow" size="sm" role="status">
            {warningMessage}
          </Text>
        )}

        <Group justify="flex-end" wrap="wrap" gap="sm">
          <Button
            onClick={() => onConfirm({ source, format })}
            disabled={confirmDisabled}
            loading={loading}
          >
            {m.admin_members_export_pdf_confirm()}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
