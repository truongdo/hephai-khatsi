import { createFileRoute } from '@tanstack/react-router'
import { MemberEditorForm } from '#/components/filler/MemberEditorForm'
import type { SanghaType } from '#/domain/types'
import { m } from '#/paraglide/messages'

function parseSanghaType(value: unknown): SanghaType {
  return value === 'ni' ? 'ni' : 'tang'
}

export const Route = createFileRoute('/f/$token/edit/member/')({
  validateSearch: (search: Record<string, unknown>) => ({
    orgUnitId: typeof search.orgUnitId === 'string' ? search.orgUnitId : '',
    sanghaType: parseSanghaType(search.sanghaType),
    phone: typeof search.phone === 'string' ? search.phone : '',
  }),
  component: MemberNewRoute,
})

function MemberNewRoute() {
  const { token } = Route.useParams()
  const { orgUnitId, sanghaType, phone } = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <MemberEditorForm
      key={`new-${orgUnitId}-${sanghaType}-${phone}`}
      title={m.filler_editor_title_member_new()}
      token={token}
      orgUnitId={orgUnitId}
      sanghaType={sanghaType}
      seedPhone={phone}
      status="draft"
      onCreated={(memberId) =>
        navigate({
          to: '/f/$token/edit/member/$memberId',
          params: { token, memberId },
        })
      }
    />
  )
}
