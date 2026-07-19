import { createFileRoute } from '@tanstack/react-router'
import { InvitesPage } from '#/components/admin/InvitesPage'

export const Route = createFileRoute('/admin/invites')({
  component: InvitesPage,
})
