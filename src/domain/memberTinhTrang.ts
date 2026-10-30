import { m } from '#/paraglide/messages'

/** Tình trạng (current situation) of a member; set from the admin list only. */
export const MEMBER_TINH_TRANG_VALUES = [
  'sinh_hoat',
  'di_hoc',
  'gia_yeu',
  'dau_benh',
  'vien_tich',
  'chuyen_he_phai',
  'chuyen_giao_doan',
  'hoan_tuc',
] as const

export type MemberTinhTrang = (typeof MEMBER_TINH_TRANG_VALUES)[number]

export function isMemberTinhTrang(value: unknown): value is MemberTinhTrang {
  return (
    typeof value === 'string' &&
    (MEMBER_TINH_TRANG_VALUES as readonly string[]).includes(value)
  )
}

export function memberTinhTrangLabel(value: MemberTinhTrang): string {
  switch (value) {
    case 'sinh_hoat':
      return m.member_tinh_trang_sinh_hoat()
    case 'di_hoc':
      return m.member_tinh_trang_di_hoc()
    case 'gia_yeu':
      return m.member_tinh_trang_gia_yeu()
    case 'dau_benh':
      return m.member_tinh_trang_dau_benh()
    case 'vien_tich':
      return m.member_tinh_trang_vien_tich()
    case 'chuyen_he_phai':
      return m.member_tinh_trang_chuyen_he_phai()
    case 'chuyen_giao_doan':
      return m.member_tinh_trang_chuyen_giao_doan()
    case 'hoan_tuc':
      return m.member_tinh_trang_hoan_tuc()
  }
}

/** Label for a stored value; unknown/legacy values are shown as-is. */
export function formatMemberTinhTrang(value: string | null | undefined): string {
  if (value == null || value === '') return ''
  return isMemberTinhTrang(value) ? memberTinhTrangLabel(value) : value
}
