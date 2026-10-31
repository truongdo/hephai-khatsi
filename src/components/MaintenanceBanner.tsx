import { Alert } from '@mantine/core'
import { m } from '#/paraglide/messages'

// Build flag for a maintenance window: the build deployed during the window
// shows this banner on every page. It does not block writes by itself.

/** Only the exact value `true` turns the banner on. */
export function parseMaintenanceMode(value: string | undefined): boolean {
  return value === 'true'
}

export const MAINTENANCE_MODE = parseMaintenanceMode(import.meta.env.VITE_MAINTENANCE_MODE)

export function MaintenanceBanner() {
  return (
    <Alert color="yellow" radius={0} title={m.maintenance_banner_title()}>
      {m.maintenance_banner_body()}
    </Alert>
  )
}
