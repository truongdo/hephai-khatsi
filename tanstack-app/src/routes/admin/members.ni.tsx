import { createFileRoute } from '@tanstack/react-router'
import { MembersListPage } from '#/components/admin/MembersListPage'

export const Route = createFileRoute('/admin/members/ni')({
  component: () => <MembersListPage sanghaType="ni" />,
})
