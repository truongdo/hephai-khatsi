import { createFileRoute } from '@tanstack/react-router'
import { FillerEditorShell } from '#/components/filler/FillerEditorShell'
import type { SanghaType } from '#/domain/types'
import { m } from '#/paraglide/messages'

function parseSanghaType(value: unknown): SanghaType {
  return value === 'ni' ? 'ni' : 'tang'
}

export const Route = createFileRoute('/f/$token/edit/member/')({
  validateSearch: (search: Record<string, unknown>) => ({
    orgUnitId: typeof search.orgUnitId === 'string' ? search.orgUnitId : '',
    sanghaType: parseSanghaType(search.sanghaType),
    cccd: typeof search.cccd === 'string' ? search.cccd : '',
  }),
  component: MemberNewRoute,
})

function MemberNewRoute() {
  return (
    <FillerEditorShell
      title={m.filler_editor_title_member_new()}
      status="draft"
    />
  )
}
