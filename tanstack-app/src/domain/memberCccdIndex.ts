import type { SanghaType } from './types'

export function memberCccdIndexId(
  orgUnitId: string,
  sanghaType: SanghaType,
  cccd: string,
): string {
  return `${orgUnitId}_${sanghaType}_${cccd}`
}
