import { Alert, Badge, Box, Button, Group, Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'
import { FormStickyActions } from '#/components/FormStickyActions'
import { m } from '#/paraglide/messages'

export type FillerEditorStatus = 'draft' | 'view'

export type FillerEditorShellProps = {
  title: string
  status: FillerEditorStatus
  children?: ReactNode
  onSave?: () => void
  savePending?: boolean
  saveLabel?: string
  saveSuccess?: string | null
  saveError?: string | null
  validationError?: string | null
  onRequestEdit?: () => void
  requestEditPending?: boolean
  editRequestedAt?: string | null
  requestEditSuccess?: string | null
  requestEditError?: string | null
}

const STATUS_COLOR: Record<FillerEditorStatus, string> = {
  draft: 'jade',
  view: 'clay',
}

function statusLabel(status: FillerEditorStatus): string {
  return status === 'draft' ? m.filler_status_draft() : m.filler_status_view()
}

export function FillerEditorShell({
  title,
  status,
  children,
  onSave,
  savePending,
  saveLabel,
  saveSuccess,
  saveError,
  validationError,
  onRequestEdit,
  requestEditPending,
  editRequestedAt,
  requestEditSuccess,
  requestEditError,
}: FillerEditorShellProps) {
  const showSave = status === 'draft' && onSave
  const showRequestEdit = status === 'view' && onRequestEdit
  const showStickyActions = showSave || showRequestEdit

  return (
    <Stack gap="lg">
      <Box
        component="header"
        data-testid="filler-editor-header"
        py="sm"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          backgroundColor: 'var(--paper)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <Group justify="space-between" align="center" wrap="wrap" gap="sm">
          <Title order={2}>{title}</Title>
          <Badge color={STATUS_COLOR[status]} variant="light" radius="sm">
            {statusLabel(status)}
          </Badge>
        </Group>
      </Box>
      {children ?? (
        <Text c="dimmed">{m.filler_editor_placeholder()}</Text>
      )}
      {showStickyActions ? (
        <FormStickyActions
          status={
            <>
              {validationError ? (
                <Alert color="red">{validationError}</Alert>
              ) : null}
              {saveError ? <Alert color="red">{saveError}</Alert> : null}
              {requestEditError ? (
                <Alert color="red">{requestEditError}</Alert>
              ) : null}
              {saveSuccess ? (
                <Alert color="teal" variant="light">
                  {saveSuccess}
                </Alert>
              ) : null}
              {requestEditSuccess ? (
                <Alert color="teal" variant="light">
                  {requestEditSuccess}
                </Alert>
              ) : null}
            </>
          }
        >
          {showSave ? (
            <Button
              type="button"
              onClick={onSave}
              loading={savePending}
              disabled={savePending}
            >
              {saveLabel ?? m.filler_save()}
            </Button>
          ) : null}
          {showRequestEdit ? (
            editRequestedAt ? (
              <Button type="button" variant="light" disabled>
                {m.filler_request_edit_pending()}
              </Button>
            ) : (
              <Button
                type="button"
                variant="light"
                onClick={onRequestEdit}
                loading={requestEditPending}
                disabled={requestEditPending}
              >
                {m.filler_request_edit()}
              </Button>
            )
          ) : null}
        </FormStickyActions>
      ) : null}
    </Stack>
  )
}
