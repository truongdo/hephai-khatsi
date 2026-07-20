import type { AddressValue } from './address'

export type OrgUnitKind = 'giao_doan' | 'ni_gioi'
export type SanghaType = 'tang' | 'ni'
export type FormType = 'temple' | 'member_tang' | 'member_ni'
export type RecordStatus = 'draft' | 'locked'

export type OrgUnit = {
  id: string
  code: string
  name: string
  kind: OrgUnitKind
  order: number
  allowsTang: boolean
  allowsNi: boolean
}

// There is a single, global invite (see PUBLIC_INVITE_ID in inviteRepo.ts) —
// it only gates access to the public registration form; it no longer scopes
// which org unit or record type a visitor can create (the visitor picks
// those themselves in the form).
export type Invite = {
  id: string
  token: string
  createdAt: string
  createdBy: string
}

export type PreceptRecord = {
  ngayGh?: string
  taiGh?: string
  tonHieuGioiDan?: string
  ngayHePhai?: string
  taiHePhai?: string
}

export type GiaoPham = {
  rank: string
  namTienPhong?: number
}

export type Member = {
  id: string
  orgUnitId: string
  sanghaType: SanghaType
  status: RecordStatus
  cccd: string
  inviteId: string | null
  currentTempleId: string | null
  photoPath: string | null
  theDanh?: string
  phapDanh?: string
  ngaySinh?: string
  noiSinh?: string
  nguyenQuan?: string
  cccdMeta?: { ngayCap?: string; noiCap?: string }
  cntn?: { so?: string; ngayCap?: string; noiCap?: string }
  danToc?: string
  dienThoai?: string
  email?: string
  diaChiThuongTru?: AddressValue | string
  ngayXuatGia?: string
  noiXuatGia?: string
  hienTuHoc?: string
  gioiSaDi?: PreceptRecord
  gioiTyKheo?: PreceptRecord
  gioiSaDiNi?: PreceptRecord
  gioiThucXoaMaNa?: PreceptRecord
  gioiTyKheoNi?: PreceptRecord
  giaoPhamGiaoHoi?: GiaoPham
  giaoPhamHePhai?: GiaoPham
  haLap?: number
  bonSu?: string
  hePhaiGoc?: string
  giaoDoanGoc?: string
  trinhDoTheHoc?: string
  ngoaiNgu?: string
  trinhDoChuyenMon?: string
  capBac?: string
  trinhDoPhatHoc?: string
  coNgu?: string
  hocViHocHam?: string
  chucVuHePhai?: Array<{
    tuThangNam?: string
    denThangNam?: string
    noiDung?: string
    diaChi?: string
  }>
  chucVuGhpgvn?: Array<{
    tuThangNam?: string
    denThangNam?: string
    noiDung?: string
    diaChi?: string
  }>
  chucVuDoanThe?: string
  khoaTu?: Array<{ ten?: string; soLan?: number; ghiChu?: string }>
  giaDinh?: {
    cha?: {
      hoTen?: string
      namSinh?: string
      ngheNghiep?: string
      dienThoai?: string
      noiO?: string
    }
    me?: {
      hoTen?: string
      namSinh?: string
      ngheNghiep?: string
      dienThoai?: string
      noiO?: string
    }
    anhChiEm?: Array<{
      quanHe?: string
      hoTen?: string
      namSinh?: string
      ngheNghiep?: string
      noiO?: string
    }>
  }
  nguyenVong?: string
  createdAt: string
  updatedAt: string
  lockedAt: string | null
  lockedBy: string | null
}

export type Temple = {
  id: string
  orgUnitId: string
  status: RecordStatus
  managerPhones: string[]
  inviteId: string | null
  danhHieu?: string
  phanDoan?: string
  dacDiem?: string[]
  nguoiKhaiSon?: string
  namThanhLap?: string
  tinChuHienCung?: string
  diaChiCu?: AddressValue | string
  diaChiMoi?: AddressValue | string
  truTriHienNay?: { phapDanh?: string; dienThoai?: string; email?: string }
  truTriTienNhiem?: Array<{
    phapDanh?: string
    thoiGian?: string
    ghiChu?: string
  }>
  banQuanTri?: Array<{ ten: string; vaiTro?: string }>
  tangSoHienTru?: {
    tyKheo?: number
    tyKheoNi?: number
    saDi?: number
    tapSu?: number
  }
  soPhatTuQuyY?: number
  soPhatTuThuongXuyen?: number
  hoatDongPhatSu?: Array<{ ten?: string; thoiGian?: string; ghiChu?: string }>
  qdCongNhan?: { so?: string; ngay?: string }
  qdBoNhiemTruTri?: { so?: string; ngay?: string }
  moHinhKienTruc?: string
  hangMucXayDung?: string[]
  trungTu?: Array<{ moTa: string; ghiChu?: string }>
  quyenSuDungDat?: {
    soGiay?: string
    ngayCap?: string
    dienTichKhuonVienM2?: number
    dienTichXayDungM2?: number
    soGiayDatCanhTac?: string
    dienTichDatCanhTacM2?: number
  }
  createdAt: string
  updatedAt: string
  lockedAt: string | null
  lockedBy: string | null
}
