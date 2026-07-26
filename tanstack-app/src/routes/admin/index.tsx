import { Navigate, createFileRoute } from '@tanstack/react-router'
import { Stack, Text, Title } from '@mantine/core'
import { m } from '#/paraglide/messages'
import { useAdminClaim } from '#/auth/useAdminClaim'
import { canManageDirectory, canManageRetreats } from '#/domain/authClaims'

export const Route = createFileRoute('/admin/')({
  component: AdminIndexPage,
})

function AdminIndexPage() {
  const claim = useAdminClaim()

  if (claim.status !== 'admin') return null

  const claims = { role: claim.role, orgUnitId: claim.orgUnitId }

  if (canManageDirectory(claims)) {
    return <Navigate to="/admin/temples" />
  }
  if (canManageRetreats(claims)) {
    return <Navigate to="/admin/retreats" />
  }

  return (
    <Stack maw={480} mx="auto" p="xl" gap="sm">
      <Title order={1}>{m.admin_kiem_soat_empty_title()}</Title>
      <Text>{m.admin_kiem_soat_empty_body()}</Text>
    </Stack>
  )
}
