import { formatAddressDisplay } from '#/domain/address'
import type { Member, SanghaType } from '#/domain/types'
import { rankLabel } from '#/components/filler/fillerFormOptions'
import { m } from '#/paraglide/messages'

export type MembersExcelRowContext = { orgUnitNameById: Record<string, string> }

export type MemberExcelColumnGroup =
  | 'system'
  | 'identity'
  | 'papers'
  | 'contact'
  | 'ordination'
  | 'precepts'
  | 'ranks'
  | 'education'
  | 'other'

export type MemberExcelColumnDef = {
  id: string
  group: MemberExcelColumnGroup
  sangha?: SanghaType
  header: () => string
  cell: (member: Member, ctx: MembersExcelRowContext) => string | number
}

function cellStr(value: string | undefined): string {
  return value ?? ''
}

function preceptGroup(
  prefix: string,
  sangha: SanghaType,
  preceptHeader: () => string,
  get: (
    member: Member,
  ) =>
    | {
        ngayGh?: string
        taiGh?: string
        tonHieuGioiDan?: string
        ngayHePhai?: string
        taiHePhai?: string
      }
    | undefined,
): MemberExcelColumnDef[] {
  const sub: Array<{
    key: 'ngayGh' | 'taiGh' | 'tonHieuGioiDan' | 'ngayHePhai' | 'taiHePhai'
    subHeader: () => string
  }> = [
    { key: 'ngayGh', subHeader: () => m.filler_field_precept_ngay_gh() },
    { key: 'taiGh', subHeader: () => m.filler_field_precept_tai_gh() },
    { key: 'tonHieuGioiDan', subHeader: () => m.filler_field_precept_ton_hieu() },
    { key: 'ngayHePhai', subHeader: () => m.filler_field_precept_ngay_hp() },
    { key: 'taiHePhai', subHeader: () => m.filler_field_precept_tai_hp() },
  ]
  return sub.map(({ key, subHeader }) => ({
    id: `${prefix}_${key}`,
    group: 'precepts' as const,
    sangha,
    header: () => `${preceptHeader()} — ${subHeader()}`,
    cell: (member) => cellStr(get(member)?.[key]),
  }))
}

const TANG_PRECEPTS: MemberExcelColumnDef[] = [
  ...preceptGroup('gioiSaDi', 'tang', () => m.filler_field_gioi_sa_di(), (m) => m.gioiSaDi),
  ...preceptGroup('gioiTyKheo', 'tang', () => m.filler_field_gioi_ty_kheo(), (m) => m.gioiTyKheo),
]

const NI_PRECEPTS: MemberExcelColumnDef[] = [
  ...preceptGroup('gioiSaDiNi', 'ni', () => m.filler_field_gioi_sa_di(), (m) => m.gioiSaDiNi),
  ...preceptGroup(
    'gioiThucXoaMaNa',
    'ni',
    () => m.filler_field_gioi_thuc_xoa(),
    (m) => m.gioiThucXoaMaNa,
  ),
  ...preceptGroup(
    'gioiTyKheoNi',
    'ni',
    () => m.filler_field_gioi_ty_kheo(),
    (m) => m.gioiTyKheoNi,
  ),
]

export const MEMBER_EXCEL_COLUMNS: MemberExcelColumnDef[] = [
  {
    id: 'orgUnitName',
    group: 'system',
    header: () => m.admin_members_col_giao_doan(),
    cell: (member, ctx) => ctx.orgUnitNameById[member.orgUnitId] || member.orgUnitId,
  },
  {
    id: 'phanDoan',
    group: 'system',
    header: () => m.filler_field_phan_doan(),
    cell: (member) => cellStr(member.phanDoan),
  },
  {
    id: 'status',
    group: 'system',
    header: () => m.admin_members_col_status(),
    cell: (member) =>
      member.status === 'locked'
        ? m.admin_members_status_locked()
        : m.admin_members_status_draft(),
  },
  {
    id: 'theDanh',
    group: 'identity',
    header: () => m.filler_field_the_danh(),
    cell: (member) => cellStr(member.theDanh),
  },
  {
    id: 'phapDanh',
    group: 'identity',
    header: () => m.filler_field_phap_danh(),
    cell: (member) => cellStr(member.phapDanh),
  },
  {
    id: 'ngaySinh',
    group: 'identity',
    header: () => m.filler_field_ngay_sinh(),
    cell: (member) => cellStr(member.ngaySinh),
  },
  {
    id: 'noiSinh',
    group: 'identity',
    header: () => m.filler_field_noi_sinh(),
    cell: (member) => formatAddressDisplay(member.noiSinh),
  },
  {
    id: 'nguyenQuan',
    group: 'identity',
    header: () => m.filler_field_nguyen_quan(),
    cell: (member) => cellStr(member.nguyenQuan),
  },
  {
    id: 'danToc',
    group: 'identity',
    header: () => m.filler_field_dan_toc(),
    cell: (member) => cellStr(member.danToc),
  },
  {
    id: 'cccd',
    group: 'papers',
    header: () => m.filler_field_cccd(),
    cell: (member) => cellStr(member.cccd),
  },
  {
    id: 'cccdNgayCap',
    group: 'papers',
    header: () => m.filler_field_cccd_ngay_cap(),
    cell: (member) => cellStr(member.cccdMeta?.ngayCap),
  },
  {
    id: 'cccdNoiCap',
    group: 'papers',
    header: () => m.filler_field_cccd_noi_cap(),
    cell: (member) => cellStr(member.cccdMeta?.noiCap),
  },
  {
    id: 'cntnSo',
    group: 'papers',
    header: () => m.filler_field_cntn_so(),
    cell: (member) => cellStr(member.cntn?.so),
  },
  {
    id: 'cntnNgayCap',
    group: 'papers',
    header: () => m.filler_field_cntn_ngay_cap(),
    cell: (member) => cellStr(member.cntn?.ngayCap),
  },
  {
    id: 'cntnNoiCap',
    group: 'papers',
    header: () => m.filler_field_cntn_noi_cap(),
    cell: (member) => cellStr(member.cntn?.noiCap),
  },
  {
    id: 'dienThoai',
    group: 'contact',
    header: () => m.filler_field_dien_thoai(),
    cell: (member) => cellStr(member.dienThoai),
  },
  {
    id: 'email',
    group: 'contact',
    header: () => m.filler_field_email(),
    cell: (member) => cellStr(member.email),
  },
  {
    id: 'diaChiThuongTru',
    group: 'contact',
    header: () => m.filler_field_dia_chi_thuong_tru(),
    cell: (member) => formatAddressDisplay(member.diaChiThuongTru),
  },
  {
    id: 'ngayXuatGia',
    group: 'ordination',
    header: () => m.filler_field_ngay_xuat_gia(),
    cell: (member) => cellStr(member.ngayXuatGia),
  },
  {
    id: 'noiXuatGia',
    group: 'ordination',
    header: () => m.filler_field_noi_xuat_gia(),
    cell: (member) => formatAddressDisplay(member.noiXuatGia),
  },
  {
    id: 'hienTuHoc',
    group: 'ordination',
    header: () => m.filler_field_hien_tu_hoc(),
    cell: (member) => cellStr(member.hienTuHoc),
  },
  {
    id: 'bonSu',
    group: 'ordination',
    header: () => m.filler_field_bon_su(),
    cell: (member) => cellStr(member.bonSu),
  },
  {
    id: 'hePhaiGoc',
    group: 'ordination',
    header: () => m.filler_field_he_phai_goc(),
    cell: (member) => cellStr(member.hePhaiGoc),
  },
  {
    id: 'giaoDoanGoc',
    group: 'ordination',
    header: () => m.filler_field_giao_doan_goc(),
    cell: (member) => cellStr(member.giaoDoanGoc),
  },
  {
    id: 'haLap',
    group: 'ordination',
    header: () => m.filler_field_ha_lap(),
    cell: (member) => (member.haLap != null ? String(member.haLap) : ''),
  },
  {
    id: 'ngayHaCapHaLap',
    group: 'ordination',
    header: () => m.filler_field_ngay_ha_cap_ha_lap(),
    cell: (member) => cellStr(member.ngayHaCapHaLap),
  },
  ...TANG_PRECEPTS,
  ...NI_PRECEPTS,
  {
    id: 'giaoPhamGiaoHoiRank',
    group: 'ranks',
    header: () => m.filler_field_gp_giao_hoi(),
    cell: (member) => rankLabel(member.giaoPhamGiaoHoi?.rank, member.sanghaType) ?? '',
  },
  {
    id: 'giaoPhamGiaoHoiNam',
    group: 'ranks',
    header: () =>
      `${m.filler_field_gp_giao_hoi()} — ${m.filler_field_nam_tien_phong()}`,
    cell: (member) =>
      member.giaoPhamGiaoHoi?.namTienPhong != null
        ? String(member.giaoPhamGiaoHoi.namTienPhong)
        : '',
  },
  {
    id: 'giaoPhamHePhaiRank',
    group: 'ranks',
    header: () => m.filler_field_gp_he_phai(),
    cell: (member) => rankLabel(member.giaoPhamHePhai?.rank, member.sanghaType) ?? '',
  },
  {
    id: 'giaoPhamHePhaiNam',
    group: 'ranks',
    header: () =>
      `${m.filler_field_gp_he_phai()} — ${m.filler_field_nam_tien_phong()}`,
    cell: (member) =>
      member.giaoPhamHePhai?.namTienPhong != null
        ? String(member.giaoPhamHePhai.namTienPhong)
        : '',
  },
  {
    id: 'trinhDoTheHoc',
    group: 'education',
    header: () => m.filler_field_trinh_do_the_hoc(),
    cell: (member) => cellStr(member.trinhDoTheHoc),
  },
  {
    id: 'ngoaiNgu',
    group: 'education',
    header: () => m.filler_field_ngoai_ngu(),
    cell: (member) => cellStr(member.ngoaiNgu),
  },
  {
    id: 'trinhDoChuyenMon',
    group: 'education',
    header: () => m.filler_field_trinh_do_chuyen_mon(),
    cell: (member) => cellStr(member.trinhDoChuyenMon),
  },
  {
    id: 'capBac',
    group: 'education',
    header: () => m.filler_field_cap_bac(),
    cell: (member) => cellStr(member.capBac),
  },
  {
    id: 'trinhDoPhatHoc',
    group: 'education',
    header: () => m.filler_field_trinh_do_phat_hoc(),
    cell: (member) => cellStr(member.trinhDoPhatHoc),
  },
  {
    id: 'coNgu',
    group: 'education',
    header: () => m.filler_field_co_ngu(),
    cell: (member) => cellStr(member.coNgu),
  },
  {
    id: 'hocViHocHam',
    group: 'education',
    header: () => m.filler_field_hoc_vi(),
    cell: (member) => cellStr(member.hocViHocHam),
  },
  {
    id: 'chucVuDoanThe',
    group: 'other',
    header: () => m.filler_field_chuc_vu_doan_the(),
    cell: (member) => cellStr(member.chucVuDoanThe),
  },
  {
    id: 'nguyenVong',
    group: 'other',
    header: () => m.filler_field_nguyen_vong(),
    cell: (member) => cellStr(member.nguyenVong),
  },
]

/** Always appended after user-selected export columns; not shown in the column picker. */
export const MEMBER_EXCEL_APPEND_COLUMNS: MemberExcelColumnDef[] = [
  {
    id: 'sapXepHaLap',
    group: 'system',
    header: () => m.admin_members_col_sap_xep_ha_lap(),
    cell: (member) => cellStr(member.sapXepHaLap),
  },
]

export function membersExcelExportColumns(
  sanghaType: SanghaType,
  columnIds: string[],
): MemberExcelColumnDef[] {
  const selected = new Set(columnIds)
  const columns = catalogMembersExcelColumns(sanghaType).filter((c) => selected.has(c.id))
  return [...columns, ...MEMBER_EXCEL_APPEND_COLUMNS]
}

export function catalogMembersExcelColumns(sanghaType: SanghaType): MemberExcelColumnDef[] {
  return MEMBER_EXCEL_COLUMNS.filter((c) => !c.sangha || c.sangha === sanghaType)
}

export function allowedMembersExcelColumnIdSet(sanghaType: SanghaType): Set<string> {
  return new Set(catalogMembersExcelColumns(sanghaType).map((c) => c.id))
}

export function defaultMembersExcelColumnIds(sanghaType: SanghaType): string[] {
  const precept = sanghaType === 'tang' ? 'gioiTyKheo_ngayGh' : 'gioiTyKheoNi_ngayGh'
  return [
    'theDanh',
    'phapDanh',
    'ngaySinh',
    'cccd',
    'cccdNgayCap',
    'cccdNoiCap',
    precept,
    'hienTuHoc',
  ]
}
