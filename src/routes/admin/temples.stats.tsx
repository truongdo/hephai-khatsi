import { createFileRoute } from '@tanstack/react-router'
import { TemplesStatsPage } from '#/components/admin/TemplesStatsPage'

export const Route = createFileRoute('/admin/temples/stats')({
  component: TemplesStatsPage,
})
