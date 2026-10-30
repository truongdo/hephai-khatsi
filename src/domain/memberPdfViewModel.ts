import {
  rankLabel,
  rankShowsNamTienPhong,
} from '#/components/filler/fillerFormOptions'
import { documentTypeLabel } from '#/components/filler/memberDocumentLabels'
import { formatAddressDisplay } from '#/domain/address'
import {
  MEMBER_DOCUMENT_TYPES,
  type MemberDocumentFiles,
  type MemberDocumentTypeDef,
} from '#/domain/memberDocumentTypes'
import type { Member, PreceptRecord, RecordStatus, SanghaType } from '#/domain/types'
import { m } from '#/paraglide/messages'

export const MEMBER_PDF_EMPTY = '—'

export type MemberPdfField = { label: string; value: string }
export type MemberPdfBlock = { title: string; fields: MemberPdfField[] }
export type MemberPdfSection = {
  title: string
  fields: MemberPdfField[]
  blocks?: MemberPdfBlock[]
}
export type MemberPdfViewModel = {
  memberId: string
  header: {
    phapDanh: string
    theDanh: string
    sanghaLabel: string
    orgUnitName: string
    statusLabel: string
  }
  sections: MemberPdfSection[]
}
export type MemberPdfViewContext = { orgUnitNameById: Record<string, string> }

function display(value?: string | null): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : MEMBER_PDF_EMPTY
}

/** Display/export date-only values stored as YYYY-MM-DD as DD-MM-YYYY. */
function formatDateDdMmYyyy(value: string | undefined): string {
  if (value == null || value === '') return ''
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return value
  const [, year, month, day] = match
  return `${day}-${month}-${year}`
}

function formatMonthMmYyyy(value: string | undefined): string {
  if (value == null || value === '') return ''
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim())
  if (!match) return value
  const [, year, month] = match
  return `${month}/${year}`
}

function field(label: string, rawValue: string): MemberPdfField {
  return { label, value: display(rawValue) }
}

function orgUnitName(
  orgUnitId: string | undefined,
  ctx: MemberPdfViewContext,
): string {
  if (!orgUnitId) return MEMBER_PDF_EMPTY
  return ctx.orgUnitNameById[orgUnitId] ?? orgUnitId
}

function sanghaLabel(sanghaType: SanghaType): string {
  return sanghaType === 'tang'
    ? m.admin_members_sangha_type_tang()
    : m.admin_members_sangha_type_ni()
}

function statusLabel(status: RecordStatus): string {
  return status === 'locked'
    ? m.admin_members_status_locked()
    : m.admin_members_status_draft()
}

function preceptBlock(title: string, record?: PreceptRecord): MemberPdfBlock {
  const precept = record ?? {}
  return {
    title,
    fields: [
      field(m.filler_field_precept_ngay_gh(), formatDateDdMmYyyy(precept.ngayGh)),
      field(m.filler_field_precept_tai_gh(), precept.taiGh ?? ''),
      field(m.filler_field_precept_ton_hieu(), precept.tonHieuGioiDan ?? ''),
      field(m.filler_field_precept_ngay_hp(), formatDateDdMmYyyy(precept.ngayHePhai)),
      field(m.filler_field_precept_tai_hp(), precept.taiHePhai ?? ''),
    ],
  }
}

function chucVuBlock(
  title: string,
  row: {
    tuThangNam?: string
    denThangNam?: string
    noiDung?: string
    diaChi?: string
  },
): MemberPdfBlock {
  return {
    title,
    fields: [
      field(m.filler_field_tu_thang_nam(), formatMonthMmYyyy(row.tuThangNam)),
      field(m.filler_field_den_thang_nam(), formatMonthMmYyyy(row.denThangNam)),
      field(m.filler_field_noi_dung(), row.noiDung ?? ''),
      field(m.filler_field_dia_chi(), row.diaChi ?? ''),
    ],
  }
}

function familyPersonBlock(
  title: string,
  person?: {
    hoTen?: string
    namSinh?: string
    ngheNghiep?: string
    noiO?: string
  },
): MemberPdfBlock {
  const data = person ?? {}
  return {
    title,
    fields: [
      field(m.filler_field_ho_ten(), data.hoTen ?? ''),
      field(m.filler_field_nam_sinh(), data.namSinh ?? ''),
      field(m.filler_field_nghe_nghiep(), data.ngheNghiep ?? ''),
      field(m.filler_field_noi_o(), data.noiO ?? ''),
    ],
  }
}

function documentAttachmentStatus(
  files: MemberDocumentFiles | undefined,
  type: MemberDocumentTypeDef,
): string {
  if (!files) return ''

  if (type.sides === 'frontBack') {
    const hasFront = Boolean(files.frontPath)
    const hasBack = Boolean(files.backPath)
    if (!hasFront && !hasBack) return ''
    if (hasFront && hasBack) {
      return `${m.filler_doc_side_front()}, ${m.filler_doc_side_back()}`
    }
    if (hasFront) return m.filler_doc_side_front()
    return m.filler_doc_side_back()
  }

  return files.filePath ? m.filler_doc_attached_heading() : ''
}

function giaoPhamBlock(
  title: string,
  giaoPham: { rank?: string; namTienPhong?: number } | undefined,
  sanghaType: SanghaType,
): MemberPdfBlock {
  const rank = giaoPham?.rank
  const fields: MemberPdfField[] = [
    field(m.filler_field_rank(), rankLabel(rank, sanghaType) ?? ''),
  ]
  if (rank && rankShowsNamTienPhong(rank)) {
    fields.push(
      field(
        m.filler_field_nam_tien_phong(),
        giaoPham?.namTienPhong != null ? String(giaoPham.namTienPhong) : '',
      ),
    )
  }
  return { title, fields }
}

function identitySection(member: Member): MemberPdfSection {
  return {
    title: m.filler_section_identity(),
    fields: [
      field(m.filler_field_the_danh(), member.theDanh ?? ''),
      field(m.filler_field_phap_danh(), member.phapDanh ?? ''),
      field(m.filler_field_phan_doan(), member.phanDoan ?? ''),
      field(m.filler_field_ngay_sinh(), formatDateDdMmYyyy(member.ngaySinh)),
      field(m.filler_field_noi_sinh(), formatAddressDisplay(member.noiSinh)),
      field(m.filler_field_nguyen_quan(), member.nguyenQuan ?? ''),
      field(m.filler_field_dan_toc(), member.danToc ?? ''),
      field(m.filler_field_cccd(), member.cccd),
      field(
        m.filler_field_cccd_ngay_cap(),
        formatDateDdMmYyyy(member.cccdMeta?.ngayCap),
      ),
      field(m.filler_field_cccd_noi_cap(), member.cccdMeta?.noiCap ?? ''),
      field(m.filler_field_cntn_so(), member.cntn?.so ?? ''),
      field(
        m.filler_field_cntn_ngay_cap(),
        formatDateDdMmYyyy(member.cntn?.ngayCap),
      ),
      field(m.filler_field_cntn_noi_cap(), member.cntn?.noiCap ?? ''),
    ],
  }
}

function contactSection(member: Member): MemberPdfSection {
  return {
    title: m.filler_section_contact(),
    fields: [
      field(m.filler_field_dien_thoai(), member.dienThoai ?? ''),
      field(m.filler_field_email(), member.email ?? ''),
      field(
        m.filler_field_dia_chi_thuong_tru(),
        formatAddressDisplay(member.diaChiThuongTru),
      ),
    ],
  }
}

function xuatGiaSection(member: Member, ctx: MemberPdfViewContext): MemberPdfSection {
  return {
    title: m.filler_section_xuat_gia(),
    fields: [
      field(m.filler_field_ngay_xuat_gia(), formatDateDdMmYyyy(member.ngayXuatGia)),
      field(m.filler_field_noi_xuat_gia(), formatAddressDisplay(member.noiXuatGia)),
      field(m.filler_field_bon_su(), member.bonSu ?? ''),
      field(m.filler_field_he_phai_goc(), member.hePhaiGoc ?? ''),
      field(
        m.filler_field_giao_doan_goc(),
        orgUnitName(member.giaoDoanGoc, ctx),
      ),
      field(
        m.filler_field_ha_lap(),
        member.haLap != null ? String(member.haLap) : '',
      ),
      field(
        m.filler_field_ngay_ha_cap_ha_lap(),
        formatDateDdMmYyyy(member.ngayHaCapHaLap),
      ),
      field(m.filler_field_hien_tu_hoc(), member.hienTuHoc ?? ''),
    ],
  }
}

function gioiSection(member: Member): MemberPdfSection {
  const blocks =
    member.sanghaType === 'tang'
      ? [
          preceptBlock(m.filler_field_gioi_sa_di(), member.gioiSaDi),
          preceptBlock(m.filler_field_gioi_ty_kheo(), member.gioiTyKheo),
        ]
      : [
          preceptBlock(m.filler_field_gioi_sa_di_ni(), member.gioiSaDiNi),
          preceptBlock(m.filler_field_gioi_thuc_xoa(), member.gioiThucXoaMaNa),
          preceptBlock(m.filler_field_gioi_ty_kheo_ni(), member.gioiTyKheoNi),
        ]

  return {
    title: m.filler_section_gioi(),
    fields: [],
    blocks,
  }
}

function phamViSection(member: Member): MemberPdfSection {
  return {
    title: m.filler_section_pham_vi(),
    fields: [],
    blocks: [
      giaoPhamBlock(
        m.filler_field_gp_giao_hoi(),
        member.giaoPhamGiaoHoi,
        member.sanghaType,
      ),
      giaoPhamBlock(
        m.filler_field_gp_he_phai(),
        member.giaoPhamHePhai,
        member.sanghaType,
      ),
    ],
  }
}

function hocVanSection(member: Member): MemberPdfSection {
  return {
    title: m.filler_section_hoc_van(),
    fields: [
      field(m.filler_field_trinh_do_the_hoc(), member.trinhDoTheHoc ?? ''),
      field(m.filler_field_ngoai_ngu(), member.ngoaiNgu ?? ''),
      field(m.filler_field_trinh_do_chuyen_mon(), member.trinhDoChuyenMon ?? ''),
      field(m.filler_field_cap_bac(), member.capBac ?? ''),
      field(m.filler_field_trinh_do_phat_hoc(), member.trinhDoPhatHoc ?? ''),
      field(m.filler_field_co_ngu(), member.coNgu ?? ''),
      field(m.filler_field_hoc_vi(), member.hocViHocHam ?? ''),
    ],
  }
}

function chucVuSection(member: Member): MemberPdfSection {
  const hePhaiBlocks = (member.chucVuHePhai ?? []).map((row, index) =>
    chucVuBlock(`${m.filler_field_chuc_vu_he_phai()} ${index + 1}`, row),
  )
  const ghpgvnBlocks = (member.chucVuGhpgvn ?? []).map((row, index) =>
    chucVuBlock(`${m.filler_field_chuc_vu_ghpgvn()} ${index + 1}`, row),
  )

  return {
    title: m.filler_section_chuc_vu(),
    fields: [field(m.filler_field_chuc_vu_doan_the(), member.chucVuDoanThe ?? '')],
    blocks: [...hePhaiBlocks, ...ghpgvnBlocks],
  }
}

function khoaTuSection(member: Member): MemberPdfSection {
  const blocks = (member.khoaTu ?? []).map((row, index) => ({
    title: `${m.filler_section_khoa_tu()} ${index + 1}`,
    fields: [
      field(m.filler_field_khoa_tu_ten(), row.ten ?? ''),
      field(
        m.filler_field_khoa_tu_so_lan(),
        row.soLan != null ? String(row.soLan) : '',
      ),
      field(m.filler_field_ghi_chu(), row.ghiChu ?? ''),
    ],
  }))

  return {
    title: m.filler_section_khoa_tu(),
    fields: [],
    blocks,
  }
}

function giaDinhSection(member: Member): MemberPdfSection {
  const anhChiEmBlocks = (member.giaDinh?.anhChiEm ?? []).map((row, index) => ({
    title: `${m.filler_field_anh_chi_em()} ${index + 1}`,
    fields: [
      field(m.filler_field_quan_he(), row.quanHe ?? ''),
      field(m.filler_field_ho_ten(), row.hoTen ?? ''),
      field(m.filler_field_nam_sinh(), row.namSinh ?? ''),
      field(m.filler_field_nghe_nghiep(), row.ngheNghiep ?? ''),
      field(m.filler_field_noi_o(), row.noiO ?? ''),
    ],
  }))

  return {
    title: m.filler_section_gia_dinh(),
    fields: [],
    blocks: [
      familyPersonBlock(m.filler_field_cha(), member.giaDinh?.cha),
      familyPersonBlock(m.filler_field_me(), member.giaDinh?.me),
      ...anhChiEmBlocks,
    ],
  }
}

function nguyenVongSection(member: Member): MemberPdfSection {
  return {
    title: m.filler_section_nguyen_vong(),
    fields: [field(m.filler_field_nguyen_vong(), member.nguyenVong ?? '')],
  }
}

function giayToSection(member: Member): MemberPdfSection {
  const documents = member.documents ?? {}
  return {
    title: m.filler_section_giay_to(),
    fields: MEMBER_DOCUMENT_TYPES.map((type) =>
      field(
        documentTypeLabel(type.id),
        documentAttachmentStatus(documents[type.id], type),
      ),
    ),
  }
}

export function buildMemberPdfViewModel(
  member: Member,
  ctx: MemberPdfViewContext,
): MemberPdfViewModel {
  return {
    memberId: member.id,
    header: {
      phapDanh: display(member.phapDanh),
      theDanh: display(member.theDanh),
      sanghaLabel: sanghaLabel(member.sanghaType),
      orgUnitName: orgUnitName(member.orgUnitId, ctx),
      statusLabel: statusLabel(member.status),
    },
    sections: [
      identitySection(member),
      contactSection(member),
      xuatGiaSection(member, ctx),
      gioiSection(member),
      phamViSection(member),
      hocVanSection(member),
      chucVuSection(member),
      khoaTuSection(member),
      giaDinhSection(member),
      nguyenVongSection(member),
      giayToSection(member),
    ],
  }
}
