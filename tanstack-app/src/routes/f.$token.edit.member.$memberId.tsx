import { Loader, Stack, Text } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { MemberEditorForm } from '#/components/filler/MemberEditorForm'
import { m } from '#/paraglide/messages'
import { fillerMemberQuery } from '#/query/fillerQueries'

export const Route = createFileRoute('/f/$token/edit/member/$memberId')({
  validateSearch: (search: Record<string, unknown>) => ({
    phone: typeof search.phone === 'string' ? search.phone : '',
  }),
  component: MemberEditRoute,
})

function MemberEditRoute() {
  const { token, memberId } = Route.useParams()
  const { phone } = Route.useSearch()
  const navigate = Route.useNavigate()
  const memberQuery = useQuery(fillerMemberQuery(memberId))

  if (memberQuery.isPending) {
    return <Loader aria-label="loading" />
  }

  if (memberQuery.isError) {
    return (
      <Stack>
        <Text c="red">{m.filler_error_generic()}</Text>
      </Stack>
    )
  }

  const member = memberQuery.data
  const status = member.status === 'locked' ? 'view' : 'draft'

  return (
    <MemberEditorForm
      key={memberId}
      title={m.filler_editor_title_member()}
      token={token}
      orgUnitId={member.orgUnitId}
      sanghaType={member.sanghaType}
      cccd={member.cccd}
      seedPhone={phone || member.dienThoai}
      memberId={memberId}
      initial={member}
      status={status}
      onCreated={(createdMemberId) =>
        navigate({
          to: '/f/$token/edit/member/$memberId',
          params: { token, memberId: createdMemberId },
        })
      }
    />
  )
}
