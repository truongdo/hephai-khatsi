import { createFileRoute } from '@tanstack/react-router'
import { MemberFormPage } from '#/components/admin/MemberFormPage'

export const Route = createFileRoute('/admin/members/$id')({
  component: MemberDetailRoute,
})

function MemberDetailRoute() {
  const { id } = Route.useParams()
  return <MemberFormPage mode="edit" memberId={id} sanghaType="tang" />
}
