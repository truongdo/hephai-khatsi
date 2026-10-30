import { createFileRoute } from '@tanstack/react-router'
import { MembersStatsPage } from '#/components/admin/MembersStatsPage'

export const Route = createFileRoute('/admin/members/stats')({
  component: MembersStatsPage,
})
