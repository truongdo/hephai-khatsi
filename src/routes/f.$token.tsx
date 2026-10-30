import { Outlet, createFileRoute } from '@tanstack/react-router'
import { Alert, Center, Loader, Text, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { FillerPageFrame } from '#/components/filler/FillerPageFrame'
import { inviteByTokenQuery } from '#/query/fillerQueries'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/f/$token')({
  component: FillerLayoutRoute,
})

function FillerLayoutRoute() {
  const { token } = Route.useParams()
  const inviteQuery = useQuery(inviteByTokenQuery(token))

  if (inviteQuery.isPending) {
    return (
      <FillerPageFrame>
        <Center p="xl">
          <Loader aria-label="loading" />
        </Center>
      </FillerPageFrame>
    )
  }

  if (inviteQuery.isError) {
    return (
      <FillerPageFrame>
        <Alert color="red">
          <Title order={1}>{m.filler_invite_invalid_title()}</Title>
          <Text mt="sm">{m.filler_invite_invalid_body()}</Text>
        </Alert>
      </FillerPageFrame>
    )
  }

  return (
    <FillerPageFrame>
      <Outlet />
    </FillerPageFrame>
  )
}
