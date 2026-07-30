import { Outlet, createFileRoute } from '@tanstack/react-router'
import { Alert, Center, Loader, Text, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { FillerPageFrame } from '#/components/filler/FillerPageFrame'
import { RetreatRegistrationGateAlert } from '#/components/registration/RetreatRegistrationGateAlert'
import { RegistrationRouteProvider } from '#/components/registration/registrationRouteContext'
import { getRetreatSelfRegistrationGate } from '#/domain/retreatRegistrationGate'
import { m } from '#/paraglide/messages'
import {
  publicRetreatQuery,
  retreatInviteByTokenQuery,
} from '#/query/registrationQueries'

export const Route = createFileRoute('/r/$token')({
  component: RegistrationLayoutRoute,
})

function RegistrationLayoutRoute() {
  const { token } = Route.useParams()
  const inviteQuery = useQuery(retreatInviteByTokenQuery(token))

  const invite = inviteQuery.data
  const retreatId =
    invite?.kind === 'retreat_registration' && invite.retreatId
      ? invite.retreatId
      : null

  const retreatQuery = useQuery({
    ...publicRetreatQuery(retreatId ?? ''),
    enabled: Boolean(retreatId) && invite?.kind === 'retreat_registration' && !invite.disabled,
  })

  if (inviteQuery.isPending) {
    return (
      <FillerPageFrame>
        <Center p="xl">
          <Loader aria-label="loading" />
        </Center>
      </FillerPageFrame>
    )
  }

  if (inviteQuery.isError || !invite) {
    return (
      <FillerPageFrame>
        <Alert color="red">
          <Title order={1}>{m.registration_invite_invalid_title()}</Title>
          <Text mt="sm">{m.registration_invite_invalid_body()}</Text>
        </Alert>
      </FillerPageFrame>
    )
  }

  if (invite.kind !== 'retreat_registration' || invite.disabled) {
    return (
      <FillerPageFrame>
        <Alert color="red">
          <Title order={1}>{m.registration_invite_invalid_title()}</Title>
          <Text mt="sm">{m.registration_invite_invalid_body()}</Text>
        </Alert>
      </FillerPageFrame>
    )
  }

  if (!invite.retreatId || !invite.orgUnitId) {
    return (
      <FillerPageFrame>
        <Alert color="red">
          <Title order={1}>{m.registration_invite_invalid_title()}</Title>
          <Text mt="sm">{m.registration_invite_invalid_body()}</Text>
        </Alert>
      </FillerPageFrame>
    )
  }

  if (retreatQuery.isPending) {
    return (
      <FillerPageFrame>
        <Center p="xl">
          <Loader aria-label="loading" />
        </Center>
      </FillerPageFrame>
    )
  }

  if (retreatQuery.isError || !retreatQuery.data) {
    return (
      <FillerPageFrame>
        <Alert color="red">
          <Title order={1}>{m.registration_invite_invalid_title()}</Title>
          <Text mt="sm">{m.registration_invite_invalid_body()}</Text>
        </Alert>
      </FillerPageFrame>
    )
  }

  const gateCode = getRetreatSelfRegistrationGate(retreatQuery.data)

  return (
    <FillerPageFrame>
      <RetreatRegistrationGateAlert gateCode={gateCode} />
      {gateCode ? null : (
        <RegistrationRouteProvider
          value={{ token, invite, retreat: retreatQuery.data }}
        >
          <Outlet />
        </RegistrationRouteProvider>
      )}
    </FillerPageFrame>
  )
}
