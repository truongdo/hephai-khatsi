import type { OrgUnit } from './types'

const GIAO_DOAN: Array<{
  id: string
  code: string
  name: string
  order: number
  allowsNi: boolean
}> = [
  { id: 'gd-i', code: 'gd-i', name: 'Giáo đoàn I', order: 1, allowsNi: true },
  { id: 'gd-ii', code: 'gd-ii', name: 'Giáo đoàn II', order: 2, allowsNi: false },
  {
    id: 'gd-iii',
    code: 'gd-iii',
    name: 'Giáo đoàn III',
    order: 3,
    allowsNi: true,
  },
  { id: 'gd-iv', code: 'gd-iv', name: 'Giáo đoàn IV', order: 4, allowsNi: true },
  { id: 'gd-v', code: 'gd-v', name: 'Giáo đoàn V', order: 5, allowsNi: false },
  { id: 'gd-vi', code: 'gd-vi', name: 'Giáo đoàn VI', order: 6, allowsNi: true },
]

export const ORG_UNIT_SEED: OrgUnit[] = [
  ...GIAO_DOAN.map(
    (unit): OrgUnit => ({
      ...unit,
      kind: 'giao_doan',
      allowsTang: true,
      allowsNi: unit.allowsNi,
    }),
  ),
  {
    id: 'ni-gioi',
    code: 'ni-gioi',
    name: 'Ni giới Hệ phái Khất sĩ',
    kind: 'ni_gioi',
    order: 7,
    allowsTang: false,
    allowsNi: true,
  },
]
