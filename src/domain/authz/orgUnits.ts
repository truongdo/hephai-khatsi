import { isHePhaiAdmin, type Caller } from './caller'

// match /orgUnits/{id}: get and list are public.

export function canWriteOrgUnit(caller: Caller): boolean {
  return isHePhaiAdmin(caller)
}
