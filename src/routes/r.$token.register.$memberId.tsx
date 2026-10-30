import { createFileRoute } from '@tanstack/react-router'
import { Center, Loader } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { RetreatRegistrationConfirm } from '#/components/registration/RetreatRegistrationConfirm'
import { useRegistrationRouteContext } from '#/components/registration/registrationRouteContext'
import { fillerMemberQuery } from '#/query/fillerQueries'

export const Route = createFileRoute('/r/$token/register/$memberId')({
  component: RegistrationConfirmRoute,
})

function RegistrationConfirmRoute() {
  const { retreat } = useRegistrationRouteContext()
  const { memberId } = Route.useParams()
  const memberQuery = useQuery(fillerMemberQuery(memberId))

  if (memberQuery.isPending) {
    return (
      <Center p="xl">
        <Loader aria-label="loading" />
      </Center>
    )
  }

  if (memberQuery.isError || !memberQuery.data) {
    return null
  }

  return <RetreatRegistrationConfirm retreat={retreat} member={memberQuery.data} />
}
