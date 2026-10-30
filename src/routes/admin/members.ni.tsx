import { createFileRoute } from '@tanstack/react-router'
import { MembersListPage } from '#/components/admin/MembersListPage'

export const Route = createFileRoute('/admin/members/ni')({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === 'string' ? search.tab : undefined,
  }),
  component: MembersNiListPage,
})

function MembersNiListPage() {
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <MembersListPage
      sanghaType="ni"
      activeTab={tab}
      onActiveTabChange={(rankKey) =>
        navigate({ search: (prev) => ({ ...prev, tab: rankKey }), replace: true })
      }
    />
  )
}
