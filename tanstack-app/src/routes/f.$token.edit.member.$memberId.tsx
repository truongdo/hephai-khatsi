import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { FillerEditorShell } from '#/components/filler/FillerEditorShell'
import { m } from '#/paraglide/messages'
import { memberRepo } from '#/repositories/memberRepo'

export const Route = createFileRoute('/f/$token/edit/member/$memberId')({
  component: MemberEditRoute,
})

function MemberEditRoute() {
  const { memberId } = Route.useParams()
  const memberQuery = useQuery({
    queryKey: ['filler', 'member', memberId],
    queryFn: () => memberRepo.getById(memberId),
    staleTime: 5 * 60_000,
  })
  const status = memberQuery.data?.status === 'locked' ? 'view' : 'draft'

  return (
    <FillerEditorShell
      title={m.filler_editor_title_member()}
      status={status}
    />
  )
}
