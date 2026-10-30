import { createFileRoute } from '@tanstack/react-router'
import { TempleEditorForm } from '#/components/filler/TempleEditorForm'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/f/$token/edit/temple/')({
  validateSearch: (search: Record<string, unknown>) => ({
    orgUnitId: typeof search.orgUnitId === 'string' ? search.orgUnitId : '',
    phone: typeof search.phone === 'string' ? search.phone : '',
  }),
  component: TempleNewRoute,
})

function TempleNewRoute() {
  const { token } = Route.useParams()
  const { orgUnitId, phone } = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <TempleEditorForm
      key={`new-${orgUnitId}-${phone}`}
      title={m.filler_editor_title_temple_new()}
      token={token}
      orgUnitId={orgUnitId}
      status="draft"
      initial={{ seedPhone: phone }}
      onCreated={(templeId) =>
        navigate({
          to: '/f/$token/edit/temple/$templeId',
          params: { token, templeId },
        })
      }
    />
  )
}
