import { createFileRoute } from '@tanstack/react-router'
import { OrgUnitsPage } from '#/components/admin/OrgUnitsPage'

export const Route = createFileRoute('/admin/org-units')({
  component: OrgUnitsPage,
})
