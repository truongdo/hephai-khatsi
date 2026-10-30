import { Button, Group, Text } from '@mantine/core'
import { Link2 } from 'lucide-react'
import { useState } from 'react'
import { m } from '#/paraglide/messages'
import { useAdminClaim } from '#/auth/useAdminClaim'
import { ensureRetreatRegistrationInvite } from '#/use-cases/ensureRetreatRegistrationInvite'

function registrationShareUrl(token: string): string {
  return `${window.location.origin}/r/${token}`
}

export function CopyRetreatRegistrationLinkButton({
  retreatId,
}: {
  retreatId: string
}) {
  const claim = useAdminClaim()
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')

  const handleClick = async () => {
    if (claim.status !== 'admin' || pending) return
    setPending(true)
    setStatus('idle')
    try {
      const invite = await ensureRetreatRegistrationInvite(
        { role: claim.role, orgUnitId: claim.orgUnitId },
        { retreatId, createdBy: claim.uid },
      )
      try {
        await navigator.clipboard.writeText(registrationShareUrl(invite.token))
        setStatus('copied')
      } catch {
        setStatus('failed')
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <Group gap="xs" wrap="nowrap">
      <Button
        size="sm"
        variant="default"
        leftSection={<Link2 size={16} />}
        loading={pending}
        disabled={claim.status !== 'admin'}
        onClick={() => void handleClick()}
        aria-label={m.admin_retreat_registrations_copy_link()}
      >
        {m.admin_retreat_registrations_copy_link()}
      </Button>
      {status === 'copied' && (
        <Text size="sm" c="teal.7" role="status">
          {m.admin_retreat_registrations_copy_link_copied()}
        </Text>
      )}
      {status === 'failed' && (
        <Text size="sm" c="yellow.8" role="status">
          {m.admin_retreat_registrations_copy_link_failed()}
        </Text>
      )}
    </Group>
  )
}
