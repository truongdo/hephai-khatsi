import { createFileRoute } from '@tanstack/react-router'
import { RetreatsListPage } from '#/components/admin/RetreatsListPage'

export const Route = createFileRoute('/admin/retreats/')({
  component: RetreatsListPage,
})
