import { Alert, Stack, Text, Title } from '@mantine/core'
import type { RetreatRegistration } from '#/domain/retreatRegistration'
import type { Member } from '#/domain/types'
import { m } from '#/paraglide/messages'

export type RetreatRegistrationStatusProps = {
  registration: RetreatRegistration
  member: Member
}

function memberSummaryLabel(member: Member): string {
  const parts = [member.phapDanh, member.theDanh].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : member.id
}

function statusCopy(status: RetreatRegistration['status']): {
  title: string
  body: string
  color: string
} {
  switch (status) {
    case 'pending':
      return {
        title: m.registration_status_pending_title(),
        body: m.registration_status_pending_body(),
        color: 'jade',
      }
    case 'approved':
      return {
        title: m.registration_status_approved_title(),
        body: m.registration_status_approved_body(),
        color: 'teal',
      }
    case 'rejected':
      return {
        title: m.registration_status_rejected_title(),
        body: m.registration_status_rejected_body(),
        color: 'clay',
      }
  }
}

export function RetreatRegistrationStatus({
  registration,
  member,
}: RetreatRegistrationStatusProps) {
  const copy = statusCopy(registration.status)

  return (
    <Stack gap="lg">
      <Title order={1}>{copy.title}</Title>

      <Stack gap="xs">
        <Text fw={600}>{m.registration_confirm_member_section()}</Text>
        <Text>{memberSummaryLabel(member)}</Text>
        <Text size="sm" c="dimmed">
          {member.dienThoai}
        </Text>
      </Stack>

      <Alert color={copy.color} title={copy.title}>
        <Text>{copy.body}</Text>
        {registration.status === 'rejected' && registration.rejectionReason ? (
          <Text mt="sm">
            <Text component="span" fw={600}>
              {m.registration_status_rejection_reason_label()}:{' '}
            </Text>
            {registration.rejectionReason}
          </Text>
        ) : null}
      </Alert>
    </Stack>
  )
}
