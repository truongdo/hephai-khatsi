import { m } from '#/paraglide/messages'

export type FillerOption = { value: string; label: () => string }

export const TANG_RANKS: FillerOption[] = [
  { value: 'hoa_thuong', label: () => m.filler_rank_hoa_thuong() },
  { value: 'thuong_toa', label: () => m.filler_rank_thuong_toa() },
  { value: 'dai_duc', label: () => m.filler_rank_dai_duc() },
  { value: 'ty_kheo', label: () => m.filler_rank_ty_kheo() },
]

export const NI_RANKS: FillerOption[] = [
  { value: 'ni_truong', label: () => m.filler_rank_ni_truong() },
  { value: 'ni_su', label: () => m.filler_rank_ni_su() },
  { value: 'su_co', label: () => m.filler_rank_su_co() },
  { value: 'ty_kheo_ni', label: () => m.filler_rank_ty_kheo_ni() },
  { value: 'ni_co', label: () => m.filler_rank_ni_co() },
]

export const DAC_DIEM_OPTIONS: FillerOption[] = [
  { value: 'tru_so_he_phai', label: () => m.filler_opt_dac_diem_tru_so_hp() },
  { value: 'tru_so_giao_doan', label: () => m.filler_opt_dac_diem_tru_so_gd() },
  { value: 'to_dinh', label: () => m.filler_opt_dac_diem_to_dinh() },
  { value: 'thang_tich', label: () => m.filler_opt_dac_diem_thang_tich() },
  { value: 'di_tich', label: () => m.filler_opt_dac_diem_di_tich() },
]

export const HANG_MUC_XAY_DUNG_OPTIONS: FillerOption[] = [
  { value: 'chinh_dien', label: () => m.filler_opt_hang_muc_chinh_dien() },
  { value: 'tang_xa', label: () => m.filler_opt_hang_muc_tang_xa() },
  { value: 'ni_xa', label: () => m.filler_opt_hang_muc_ni_xa() },
  { value: 'nha_khach', label: () => m.filler_opt_hang_muc_nha_khach() },
  { value: 'nha_bep', label: () => m.filler_opt_hang_muc_nha_bep() },
  { value: 'khac', label: () => m.filler_opt_hang_muc_khac() },
]
