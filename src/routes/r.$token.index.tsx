import { createFileRoute } from '@tanstack/react-router'
import { Center, Loader } from '@mantine/core'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { RetreatRegistrationEntry } from '#/components/registration/RetreatRegistrationEntry'
import { useRegistrationRouteContext } from '#/components/registration/registrationRouteContext'
import { getRetreatSelfRegistrationGate } from '#/domain/retreatRegistrationGate'
import { m } from '#/paraglide/messages'
import { fillerOrgUnitsQuery } from '#/query/fillerQueries'
import { resumeMemberByPhone } from '#/use-cases/resumeMemberByPhone'

export const Route = createFileRoute('/r/$token/')({
  component: RegistrationEntryRoute,
})

function RegistrationEntryRoute() {
  const { token, invite, retreat } = useRegistrationRouteContext()
  const navigate = Route.useNavigate()
  const orgUnitsQuery = useQuery(fillerOrgUnitsQuery())
  const [error, setError] = useState<string | null>(null)
  const [lastSearchPhone, setLastSearchPhone] = useState<string | null>(null)
  const [memberMatches, setMemberMatches] = useState<Array<{ id: string; label: string }>>([])
  const [newMemberBlocked, setNewMemberBlocked] = useState(false)

  const orgUnitName =
    orgUnitsQuery.data?.find((unit) => unit.id === invite.orgUnitId)?.name ??
    invite.orgUnitId ??
    ''

  const gateCode = getRetreatSelfRegistrationGate(retreat)

  const resumeMutation = useMutation({
    mutationFn: async (payload: { phone: string }) => {
      return resumeMemberByPhone({
        token,
        orgUnitId: invite.orgUnitId!,
        phone: payload.phone,
      })
    },
    onMutate: () => {
      setError(null)
      setMemberMatches([])
      setNewMemberBlocked(false)
    },
    onSuccess: (result, payload) => {
      const matches = result.members
      setLastSearchPhone(payload.phone)

      if (matches.length === 0) {
        if (gateCode) {
          setNewMemberBlocked(true)
          return
        }
        void navigate({
            to: '/r/$token/member/new',
            params: { token },
            search: { phone: payload.phone },
        })
        return
      }

      if (matches.length === 1) {
        void navigate({
          to: '/r/$token/register/$memberId',
          params: { token, memberId: matches[0]!.member.id },
        })
        return
      }

      setMemberMatches(
        matches.map(({ member }) => ({
          id: member.id,
          label: member.phapDanh || member.theDanh || member.cccd || member.id,
        })),
      )
    },
    onError: () => {
      setError(m.registration_error_generic())
    },
  })

  if (orgUnitsQuery.isPending) {
    return (
      <Center p="xl">
        <Loader aria-label="loading" />
      </Center>
    )
  }

  return (
    <RetreatRegistrationEntry
      retreatName={retreat.name}
      orgUnitName={orgUnitName}
      gateCode={gateCode}
      newMemberBlocked={newMemberBlocked}
      pending={resumeMutation.isPending}
      memberMatches={memberMatches}
      error={error}
      onSubmit={(payload) => resumeMutation.mutate(payload)}
      onCreateMember={
        lastSearchPhone
          ? () => {
              void navigate({
                to: '/r/$token/member/new',
                params: { token },
                search: { phone: lastSearchPhone },
              })
            }
          : undefined
      }
      onPickMember={(memberId) => {
        void navigate({
          to: '/r/$token/register/$memberId',
          params: { token, memberId },
        })
      }}
    />
  )
}
