import { createFileRoute } from '@tanstack/react-router'
import { TempleFormPage } from '#/components/admin/TempleFormPage'

export const Route = createFileRoute('/admin/temples/new')({
  component: () => <TempleFormPage mode="create" />,
})
