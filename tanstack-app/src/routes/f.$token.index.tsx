import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Alert, Center, Loader } from '@mantine/core'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { FillerEntryForm } from '#/components/filler/FillerEntryForm'
import { DomainError, isDomainError } from '#/domain/errors'
import type { FormType, SanghaType, Temple } from '#/domain/types'
import { m } from '#/paraglide/messages'
import { fillerOrgUnitsQuery } from '#/query/fillerQueries'
import { resumeMemberByCccd } from '#/use-cases/resumeMemberByCccd'
import { resumeTemplesByPhone } from '#/use-cases/resumeTemplesByPhone'

type TempleResumeResult = {
  temple: Temple
  access: 'edit' | 'view'
}

export function formTypeToSanghaType(formType: FormType): SanghaType {
  if (formType === 'member_ni') return 'ni'
  if (formType === 'member_tang') return 'tang'
  throw new DomainError('INVALID_INPUT', 'Temple form type has no sangha type')
}

export function templeMatchesFromResume(
  matches: TempleResumeResult[],
): Array<{ id: string; label: string }> {
  return matches.map(({ temple }) => ({
    id: temple.id,
    label: temple.danhHieu || temple.id,
  }))
}

export const Route = createFileRoute('/f/$token/')({
  component: FillerEntryRoute,
})

function FillerEntryRoute() {
  const { token } = Route.useParams()
  const navigate = useNavigate()
  const orgUnitsQuery = useQuery(fillerOrgUnitsQuery())
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastMemberSearch, setLastMemberSearch] = useState<{
    orgUnitId: string
    sanghaType: SanghaType
    cccd: string
  } | null>(null)
  const [lastTempleSearch, setLastTempleSearch] = useState<{
    orgUnitId: string
    phone: string
  } | null>(null)
  const [templeMatches, setTempleMatches] = useState<Array<{ id: string; label: string }>>([])

  const resumeMutation = useMutation({
    mutationFn: async (payload: {
      formType: FormType
      orgUnitId: string
      cccd: string
      phone: string
    }) => {
      if (payload.formType === 'temple') {
        const result = await resumeTemplesByPhone({
          token,
          orgUnitId: payload.orgUnitId,
          phone: payload.phone,
        })
        return { kind: 'temple' as const, payload, result }
      }

      const sanghaType = formTypeToSanghaType(payload.formType)
      const result = await resumeMemberByCccd({
        token,
        orgUnitId: payload.orgUnitId,
        sanghaType,
        cccd: payload.cccd,
      })
      return { kind: 'member' as const, payload, sanghaType, result }
    },
    onMutate: () => {
      setError(null)
      setNotFound(false)
      setTempleMatches([])
    },
    onSuccess: (resume) => {
      if (resume.kind === 'member') {
        void navigate({
          to: '/f/$token/edit/member/$memberId',
          params: { token, memberId: resume.result.member.id },
        })
        return
      }

      const matches = resume.result.temples
      setLastTempleSearch({
        orgUnitId: resume.payload.orgUnitId,
        phone: resume.payload.phone,
      })

      if (matches.length === 0) {
        void navigate({
          to: '/f/$token/edit/temple',
          params: { token },
          search: {
            orgUnitId: resume.payload.orgUnitId,
            phone: resume.payload.phone,
          },
        })
        return
      }

      if (matches.length === 1) {
        void navigate({
          to: '/f/$token/edit/temple/$templeId',
          params: { token, templeId: matches[0]!.temple.id },
        })
        return
      }

      setTempleMatches(templeMatchesFromResume(matches))
    },
    onError: (err, payload) => {
      if (isDomainError(err) && err.code === 'NOT_FOUND') {
        const sanghaType = formTypeToSanghaType(payload.formType)
        setLastMemberSearch({
          orgUnitId: payload.orgUnitId,
          sanghaType,
          cccd: payload.cccd,
        })
        setNotFound(true)
        return
      }
      setError(m.filler_error_generic())
    },
  })

  if (orgUnitsQuery.isPending) {
    return (
      <Center p="xl">
        <Loader aria-label="loading" />
      </Center>
    )
  }

  if (orgUnitsQuery.isError) {
    return <Alert color="red">{m.filler_error_generic()}</Alert>
  }

  return (
    <FillerEntryForm
      orgUnits={orgUnitsQuery.data}
      pending={resumeMutation.isPending}
      templeMatches={templeMatches}
      notFound={notFound}
      error={error}
      onSubmit={(payload) => resumeMutation.mutate(payload)}
      onCreateMember={
        lastMemberSearch
          ? () => {
              void navigate({
                to: '/f/$token/edit/member',
                params: { token },
                search: lastMemberSearch,
              })
            }
          : undefined
      }
      onPickTemple={(templeId) => {
        void navigate({
          to: '/f/$token/edit/temple/$templeId',
          params: { token, templeId },
        })
      }}
      onCreateTemple={
        lastTempleSearch
          ? () => {
              void navigate({
                to: '/f/$token/edit/temple',
                params: { token },
                search: lastTempleSearch,
              })
            }
          : undefined
      }
    />
  )
}
