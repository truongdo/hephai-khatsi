import type { OrgUnit } from './types'

const GIAO_DOAN: Array<{
  id: string
  code: string
  name: string
  order: number
}> = [
  { id: 'gd-i', code: 'gd-i', name: 'Giáo đoàn I', order: 1 },
  { id: 'gd-ii', code: 'gd-ii', name: 'Giáo đoàn II', order: 2 },
  { id: 'gd-iii', code: 'gd-iii', name: 'Giáo đoàn III', order: 3 },
  { id: 'gd-iv', code: 'gd-iv', name: 'Giáo đoàn IV', order: 4 },
  { id: 'gd-v', code: 'gd-v', name: 'Giáo đoàn V', order: 5 },
  { id: 'gd-vi', code: 'gd-vi', name: 'Giáo đoàn VI', order: 6 },
]

const NI_GIOI_GIAO_DOAN: Array<{
  id: string
  code: string
  name: string
  order: number
}> = [
  {
    id: 'ni-gd-i',
    code: 'ni-gd-i',
    name: 'Ni giới Giáo đoàn I',
    order: 7,
  },
  {
    id: 'ni-gd-iii',
    code: 'ni-gd-iii',
    name: 'Ni giới Giáo đoàn III',
    order: 8,
  },
  {
    id: 'ni-gd-iv',
    code: 'ni-gd-iv',
    name: 'Ni giới Giáo đoàn IV',
    order: 9,
  },
  {
    id: 'ni-gd-vi',
    code: 'ni-gd-vi',
    name: 'Ni giới Giáo đoàn VI',
    order: 10,
  },
]

export const ORG_UNIT_SEED: OrgUnit[] = [
  ...GIAO_DOAN.map(
    (unit): OrgUnit => ({
      ...unit,
      kind: 'giao_doan',
      allowsTang: true,
      allowsNi: false,
    }),
  ),
  ...NI_GIOI_GIAO_DOAN.map(
    (unit): OrgUnit => ({
      ...unit,
      kind: 'ni_gioi',
      allowsTang: false,
      allowsNi: true,
    }),
  ),
  {
    id: 'ni-gioi',
    code: 'ni-gioi',
    name: 'Ni giới Hệ phái Khất sĩ',
    kind: 'ni_gioi',
    order: 11,
    allowsTang: false,
    allowsNi: true,
  },
]
