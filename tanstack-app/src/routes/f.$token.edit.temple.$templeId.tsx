import { Loader, Stack, Text } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { TempleEditorForm } from '#/components/filler/TempleEditorForm'
import { m } from '#/paraglide/messages'
import { fillerTempleQuery } from '#/query/fillerQueries'

export const Route = createFileRoute('/f/$token/edit/temple/$templeId')({
  component: TempleEditRoute,
})

function TempleEditRoute() {
  const { token, templeId } = Route.useParams()
  const navigate = Route.useNavigate()
  const templeQuery = useQuery(fillerTempleQuery(templeId))

  if (templeQuery.isPending) {
    return <Loader aria-label="loading" />
  }

  if (templeQuery.isError) {
    return (
      <Stack>
        <Text c="red">{m.filler_error_generic()}</Text>
      </Stack>
    )
  }

  const temple = templeQuery.data
  const status = temple.status === 'locked' ? 'view' : 'draft'

  return (
    <TempleEditorForm
      key={templeId}
      title={m.filler_editor_title_temple()}
      token={token}
      orgUnitId={temple.orgUnitId}
      templeId={templeId}
      initial={temple}
      status={status}
      onCreated={(createdTempleId) =>
        navigate({
          to: '/f/$token/edit/temple/$templeId',
          params: { token, templeId: createdTempleId },
        })
      }
    />
  )
}
