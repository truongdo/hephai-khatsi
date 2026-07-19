import { createFileRoute } from '@tanstack/react-router'
import { MembersListPage } from '#/components/admin/MembersListPage'

export const Route = createFileRoute('/admin/members/tang')({
  component: () => <MembersListPage sanghaType="tang" />,
})
