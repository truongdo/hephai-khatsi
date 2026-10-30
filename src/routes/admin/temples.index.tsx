import { createFileRoute } from '@tanstack/react-router'
import { TemplesListPage } from '#/components/admin/TemplesListPage'

export const Route = createFileRoute('/admin/temples/')({
  component: TemplesListPage,
})
