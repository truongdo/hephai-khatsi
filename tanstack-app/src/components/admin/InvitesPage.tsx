import { Button, Group, Loader, Stack, Text, Title } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { m } from '#/paraglide/messages'
import { useAdminClaim } from '#/auth/useAdminClaim'
import { adminKeys } from '#/query/adminKeys'
import { inviteQuery } from '#/query/adminQueries'
import { createInvite } from '#/use-cases/createInvite'

function inviteShareUrl(token: string): string {
  return `${window.location.origin}/f/${token}`
}

export function InvitesPage() {
  const claim = useAdminClaim()
  const queryClient = useQueryClient()
  const [clipboardWarning, setClipboardWarning] = useState<string | null>(null)

  const invite = useQuery({
    ...inviteQuery(),
    enabled: claim.status === 'admin',
  })
  const inviteData = invite.data

  const createMutation = useMutation({
    mutationFn: async () => {
      if (claim.status !== 'admin') throw new Error('Not signed in as admin')
      return createInvite({ createdBy: claim.uid })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.invite() })
    },
  })

  const handleCopyLink = async (token: string) => {
    setClipboardWarning(null)
    try {
      await navigator.clipboard.writeText(inviteShareUrl(token))
    } catch {
      setClipboardWarning(m.admin_invites_copy_failed())
    }
  }

  return (
    <Stack>
      <Title order={2}>{m.admin_nav_invites()}</Title>

      {invite.isPending && <Loader aria-label="loading" />}
      {invite.isError && (
        <Text c="red" role="alert">
          {m.auth_error_unknown()}
        </Text>
      )}

      {!invite.isPending && !invite.isError && inviteData && (
        <Stack maw={480}>
          <Text data-testid="invite-url">{inviteShareUrl(inviteData.token)}</Text>
          <Text size="sm" c="dimmed">
            {new Date(inviteData.createdAt).toLocaleString('vi-VN')}
          </Text>
          {clipboardWarning && (
            <Text c="yellow.8" size="sm" role="status" data-testid="clipboard-warning">
              {clipboardWarning}
            </Text>
          )}
          <Group>
            <Button onClick={() => handleCopyLink(inviteData.token)}>
              {m.admin_invites_copy_link()}
            </Button>
          </Group>
        </Stack>
      )}

      {!invite.isPending && !invite.isError && !inviteData && (
        <Group>
          <Button
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {m.admin_invites_create()}
          </Button>
        </Group>
      )}

      {createMutation.isError && (
        <Text c="red" size="sm" role="alert">
          {createMutation.error.message}
        </Text>
      )}
    </Stack>
  )
}
