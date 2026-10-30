export const TINH_TRANG_VALUES = [
  'SINH HOẠT',
  'ĐI HỌC',
  'GIÀ YẾU',
  'ĐAU BỆNH',
  'VIÊN TỊCH',
  'CHUYỂN HỆ PHÁI',
  'CHUYỂN GIÁO ĐOÀN',
  'HOÀN TỤC',
] as const

export type TinhTrangValue = (typeof TINH_TRANG_VALUES)[number]

export function isTinhTrangValue(value: string): value is TinhTrangValue {
  return (TINH_TRANG_VALUES as readonly string[]).includes(value)
}

export function tinhTrangSelectData(): Array<{ value: string; label: string }> {
  return TINH_TRANG_VALUES.map((value) => ({ value, label: value }))
}
