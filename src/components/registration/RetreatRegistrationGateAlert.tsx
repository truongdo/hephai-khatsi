import { Alert, Text } from '@mantine/core'
import type { RetreatSelfRegistrationGateCode } from '#/domain/retreatRegistrationGate'
import { m } from '#/paraglide/messages'

export type RetreatRegistrationGateAlertProps = {
  gateCode: RetreatSelfRegistrationGateCode | null
}

function gateMessage(code: RetreatSelfRegistrationGateCode): string {
  switch (code) {
    case 'closed':
      return m.registration_gate_closed()
    case 'window':
      return m.registration_gate_window()
    case 'quyen':
      return m.registration_gate_quyen()
  }
}

export function RetreatRegistrationGateAlert({
  gateCode,
}: RetreatRegistrationGateAlertProps) {
  if (!gateCode) return null
  return (
    <Alert color="orange" role="alert">
      <Text>{gateMessage(gateCode)}</Text>
    </Alert>
  )
}
