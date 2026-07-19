import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { FillerEditorShell } from '#/components/filler/FillerEditorShell'
import { m } from '#/paraglide/messages'
import { templeRepo } from '#/repositories/templeRepo'

export const Route = createFileRoute('/f/$token/edit/temple/$templeId')({
  component: TempleEditRoute,
})

function TempleEditRoute() {
  const { templeId } = Route.useParams()
  const templeQuery = useQuery({
    queryKey: ['filler', 'temple', templeId],
    queryFn: () => templeRepo.getById(templeId),
    staleTime: 5 * 60_000,
  })
  const status = templeQuery.data?.status === 'locked' ? 'view' : 'draft'

  return (
    <FillerEditorShell
      title={m.filler_editor_title_temple()}
      status={status}
    />
  )
}
