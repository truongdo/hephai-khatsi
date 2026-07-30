import { createFileRoute } from '@tanstack/react-router'
import { RetreatFormPage } from '#/components/admin/RetreatFormPage'

export const Route = createFileRoute('/admin/retreats/$id/')({
  component: RetreatDetailRoute,
})

function RetreatDetailRoute() {
  const { id } = Route.useParams()
  return <RetreatFormPage mode="edit" retreatId={id} />
}
