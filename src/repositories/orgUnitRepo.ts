import type { OrgUnit } from '#/domain/types'
import { d1ListOrgUnits } from '#/repositories/d1/orgUnitRepo'

export const listOrgUnits: () => Promise<OrgUnit[]> = d1ListOrgUnits
