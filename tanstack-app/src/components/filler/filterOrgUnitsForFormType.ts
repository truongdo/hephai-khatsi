import type { FormType, OrgUnit } from '#/domain/types'

export function filterOrgUnitsForFormType(
  units: OrgUnit[],
  formType: FormType,
): OrgUnit[] {
  switch (formType) {
    case 'member_tang':
      return units.filter((u) => u.allowsTang)
    case 'member_ni':
      return units.filter((u) => u.allowsNi)
    case 'temple':
      return units
  }
}
