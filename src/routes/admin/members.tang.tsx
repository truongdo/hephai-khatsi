import { createFileRoute } from '@tanstack/react-router'
import { MembersListPage } from '#/components/admin/MembersListPage'

export const Route = createFileRoute('/admin/members/tang')({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === 'string' ? search.tab : undefined,
  }),
  component: MembersTangListPage,
})

function MembersTangListPage() {
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <MembersListPage
      sanghaType="tang"
      activeTab={tab}
      onActiveTabChange={(rankKey) =>
        navigate({ search: (prev) => ({ ...prev, tab: rankKey }), replace: true })
      }
    />
  )
}
