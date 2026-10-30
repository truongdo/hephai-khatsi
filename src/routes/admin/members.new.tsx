import { createFileRoute } from '@tanstack/react-router'
import type { SanghaType } from '#/domain/types'
import { MemberFormPage } from '#/components/admin/MemberFormPage'

function parseSanghaType(value: unknown): SanghaType {
  return value === 'ni' ? 'ni' : 'tang'
}

export const Route = createFileRoute('/admin/members/new')({
  validateSearch: (search: Record<string, unknown>) => ({
    sanghaType: parseSanghaType(search.sanghaType),
  }),
  component: MemberNewRoute,
})

function MemberNewRoute() {
  const { sanghaType } = Route.useSearch()
  return <MemberFormPage mode="create" sanghaType={sanghaType} />
}
