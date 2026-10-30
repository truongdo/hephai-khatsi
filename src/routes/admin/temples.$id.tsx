import { createFileRoute } from '@tanstack/react-router'
import { TempleFormPage } from '#/components/admin/TempleFormPage'

export const Route = createFileRoute('/admin/temples/$id')({
  component: TempleDetailRoute,
})

function TempleDetailRoute() {
  const { id } = Route.useParams()
  return <TempleFormPage mode="edit" templeId={id} />
}
