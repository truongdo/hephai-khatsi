import type { SanghaType } from './types'

export function memberPhoneIndexId(
  orgUnitId: string,
  sanghaType: SanghaType,
  phone: string,
): string {
  return `${orgUnitId}_${sanghaType}_${phone}`
}
