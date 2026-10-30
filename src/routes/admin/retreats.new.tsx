import { createFileRoute } from '@tanstack/react-router'
import { RetreatFormPage } from '#/components/admin/RetreatFormPage'

export const Route = createFileRoute('/admin/retreats/new')({
  component: () => <RetreatFormPage mode="create" />,
})
