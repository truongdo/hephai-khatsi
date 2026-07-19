import { createFileRoute } from '@tanstack/react-router'
import { FillerEditorShell } from '#/components/filler/FillerEditorShell'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/f/$token/edit/temple/')({
  validateSearch: (search: Record<string, unknown>) => ({
    orgUnitId: typeof search.orgUnitId === 'string' ? search.orgUnitId : '',
    phone: typeof search.phone === 'string' ? search.phone : '',
  }),
  component: TempleNewRoute,
})

function TempleNewRoute() {
  return (
    <FillerEditorShell
      title={m.filler_editor_title_temple_new()}
      status="draft"
    />
  )
}
