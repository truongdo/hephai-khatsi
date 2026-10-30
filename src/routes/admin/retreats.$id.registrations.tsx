import { createFileRoute } from '@tanstack/react-router'
import { RetreatRegistrationsPage } from '#/components/admin/RetreatRegistrationsPage'

export const Route = createFileRoute('/admin/retreats/$id/registrations')({
  component: RetreatRegistrationsRoute,
})

function RetreatRegistrationsRoute() {
  const { id } = Route.useParams()
  return <RetreatRegistrationsPage retreatId={id} />
}
