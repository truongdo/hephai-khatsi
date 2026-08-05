import { Box, Button, Loader, Modal, Paper, Stack, Text } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { AuditAction, AuditLogEntry } from '#/domain/auditLog'
import { isoToGmt7Date } from '#/domain/gmt7Date'
import { m } from '#/paraglide/messages'
import { listAuditLogs, type AuditParent } from '#/repositories/auditLogRepo'
import {
  memberAuditLogsQuery,
  templeAuditLogsQuery,
} from '#/query/auditLogQueries'

export type AuditHistoryModalProps = {
  opened: boolean
  onClose: () => void
  title: string
  parent: AuditParent
}

const PAGE_SIZE = 20

function formatAuditDate(iso: string): string {
  const ymd = isoToGmt7Date(iso)
  if (!ymd) return ''
  const [year, month, day] = ymd.split('-')
  return `${day}/${month}/${year}`
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function actionLabel(action: AuditAction): string {
  const labels: Record<AuditAction, () => string> = {
    created: m.admin_audit_action_created,
    updated: m.admin_audit_action_updated,
    locked: m.admin_audit_action_locked,
    unlocked: m.admin_audit_action_unlocked,
    edit_requested: m.admin_audit_action_edit_requested,
    photo_uploaded: m.admin_audit_action_photo_uploaded,
    photo_deleted: m.admin_audit_action_photo_deleted,
    document_uploaded: m.admin_audit_action_document_uploaded,
    document_deleted: m.admin_audit_action_document_deleted,
  }
  return labels[action]()
}

function actorLabel(
  actorType: AuditLogEntry['actorType'],
  actorId: string,
): string {
  const label =
    actorType === 'admin'
      ? m.admin_audit_actor_admin()
      : m.admin_audit_actor_filler()
  return `${label} · ${actorId}`
}

function auditLogsQuery(parent: AuditParent) {
  return parent.collection === 'members'
    ? memberAuditLogsQuery(parent.id, PAGE_SIZE)
    : templeAuditLogsQuery(parent.id, PAGE_SIZE)
}

export function AuditHistoryModal({
  opened,
  onClose,
  title,
  parent,
}: AuditHistoryModalProps) {
  const { data, isLoading, isError } = useQuery({
    ...auditLogsQuery(parent),
    enabled: opened && !!parent.id,
  })

  const [extraEntries, setExtraEntries] = useState<AuditLogEntry[]>([])
  const [nextStartAfterAt, setNextStartAfterAt] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState(false)

  useEffect(() => {
    setExtraEntries([])
    setNextStartAfterAt(null)
    setLoadMoreError(false)
  }, [parent.collection, parent.id])

  useEffect(() => {
    if (data) {
      setNextStartAfterAt(data.nextStartAfterAt)
    }
  }, [data])

  const allEntries = [...(data?.entries ?? []), ...extraEntries]

  async function handleLoadMore() {
    if (!nextStartAfterAt) return
    setLoadingMore(true)
    setLoadMoreError(false)
    try {
      const result = await listAuditLogs(parent, {
        limit: PAGE_SIZE,
        startAfterAt: nextStartAfterAt,
      })
      setExtraEntries((prev) => [...prev, ...result.entries])
      setNextStartAfterAt(result.nextStartAfterAt)
    } catch {
      setLoadMoreError(true)
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`${m.admin_audit_modal_title()} — ${title}`}
    >
      <Stack gap="sm">
        {isLoading && <Loader size="sm" />}
        {isError && (
          <Text c="red" size="sm" role="alert">
            {m.admin_audit_load_error()}
          </Text>
        )}
        {!isLoading && !isError && allEntries.length === 0 && (
          <Text>{m.admin_audit_empty()}</Text>
        )}
        {allEntries.map((entry) => (
          <Paper key={entry.id} p="sm" withBorder radius="sm">
            <Text fw={600} size="sm">
              {actionLabel(entry.action)}
            </Text>
            <Text size="xs" c="dimmed">
              {formatAuditDate(entry.at)} ·{' '}
              {actorLabel(entry.actorType, entry.actorId)}
            </Text>
            {entry.changes.map((change) => (
              <Box key={change.path} mt="xs">
                <Text size="sm" fw={500}>
                  {change.path}
                </Text>
                <Text size="sm">
                  {formatValue(change.before)} → {formatValue(change.after)}
                </Text>
              </Box>
            ))}
          </Paper>
        ))}
        {nextStartAfterAt && (
          <Button
            variant="light"
            onClick={handleLoadMore}
            loading={loadingMore}
          >
            {m.admin_audit_load_more()}
          </Button>
        )}
        {loadMoreError && (
          <Text c="red" size="sm" role="alert">
            {m.admin_audit_load_error()}
          </Text>
        )}
      </Stack>
    </Modal>
  )
}
