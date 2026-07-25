import {
  addressDraftToValue,
  hydrateAddress,
  type AddressDraft,
} from '#/domain/address'
import type { GiaoPham, Member, PreceptRecord } from '#/domain/types'
import type { MemberProfilePatch } from '#/repositories/memberRepo'

export type NumericValue = number | ''

export type ChucVuRow = {
  tuThangNam: string
  denThangNam: string
  noiDung: string
  diaChi: string
}

export type KhoaTuRow = {
  ten: string
  soLan: NumericValue
  ghiChu: string
}

export type FamilyPersonDraft = {
  hoTen: string
  namSinh: string
  ngheNghiep: string
  noiO: string
}

export type AnhChiEmRow = {
  quanHe: string
  hoTen: string
  namSinh: string
  ngheNghiep: string
  noiO: string
}

export type GiaoPhamDraft = {
  rank: string
  namTienPhong: NumericValue
}

export type MemberDraft = {
  theDanh: string
  phapDanh: string
  ngaySinh: string
  noiSinh: AddressDraft
  nguyenQuan: string
  cccdMeta: { ngayCap: string; noiCap: string }
  cntn: { so: string; ngayCap: string; noiCap: string }
  danToc: string
  dienThoai: string
  email: string
  diaChiThuongTru: AddressDraft
  ngayXuatGia: string
  noiXuatGia: AddressDraft
  hienTuHoc: string
  bonSu: string
  hePhaiGoc: string
  giaoDoanGoc: string
  haLap: NumericValue
  gioiSaDi: PreceptRecord
  gioiTyKheo: PreceptRecord
  gioiSaDiNi: PreceptRecord
  gioiThucXoaMaNa: PreceptRecord
  gioiTyKheoNi: PreceptRecord
  giaoPhamGiaoHoi: GiaoPhamDraft
  giaoPhamHePhai: GiaoPhamDraft
  trinhDoTheHoc: string
  ngoaiNgu: string
  trinhDoChuyenMon: string
  capBac: string
  trinhDoPhatHoc: string
  coNgu: string
  hocViHocHam: string
  chucVuHePhai: ChucVuRow[]
  chucVuGhpgvn: ChucVuRow[]
  chucVuDoanThe: string
  khoaTu: KhoaTuRow[]
  giaDinh: {
    cha: FamilyPersonDraft
    me: FamilyPersonDraft
    anhChiEm: AnhChiEmRow[]
  }
  nguyenVong: string
}

export const EMPTY_CHUC_VU: ChucVuRow = {
  tuThangNam: '',
  denThangNam: '',
  noiDung: '',
  diaChi: '',
}
export const EMPTY_KHOA_TU: KhoaTuRow = { ten: '', soLan: '', ghiChu: '' }
export const EMPTY_ANH_CHI_EM: AnhChiEmRow = {
  quanHe: '',
  hoTen: '',
  namSinh: '',
  ngheNghiep: '',
  noiO: '',
}

function numberOrBlank(value?: number): NumericValue {
  return typeof value === 'number' ? value : ''
}

function numberOrUndefined(value: NumericValue): number | undefined {
  return typeof value === 'number' ? value : undefined
}

function textOrUndefined(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

function hasText(values: string[]): boolean {
  return values.some((value) => value.trim().length > 0)
}

function withAtLeastOne<T>(rows: T[] | undefined, emptyRow: T): T[] {
  return rows && rows.length > 0 ? rows : [emptyRow]
}

function emptyPrecept(value?: PreceptRecord): PreceptRecord {
  return {
    ngayGh: value?.ngayGh ?? '',
    taiGh: value?.taiGh ?? '',
    tonHieuGioiDan: value?.tonHieuGioiDan ?? '',
    ngayHePhai: value?.ngayHePhai ?? '',
    taiHePhai: value?.taiHePhai ?? '',
  }
}

function emptyGiaoPham(value?: GiaoPham): GiaoPhamDraft {
  return {
    rank: value?.rank ?? '',
    namTienPhong: numberOrBlank(value?.namTienPhong),
  }
}

function emptyFamilyPerson(
  value?: Partial<FamilyPersonDraft>,
): FamilyPersonDraft {
  return {
    hoTen: value?.hoTen ?? '',
    namSinh: value?.namSinh ?? '',
    ngheNghiep: value?.ngheNghiep ?? '',
    noiO: value?.noiO ?? '',
  }
}

export function emptyMemberDraft(initial: Partial<Member> = {}): MemberDraft {
  return {
    theDanh: initial.theDanh ?? '',
    phapDanh: initial.phapDanh ?? '',
    ngaySinh: initial.ngaySinh ?? '',
    noiSinh: hydrateAddress(initial.noiSinh),
    nguyenQuan: initial.nguyenQuan ?? '',
    cccdMeta: {
      ngayCap: initial.cccdMeta?.ngayCap ?? '',
      noiCap: initial.cccdMeta?.noiCap ?? '',
    },
    cntn: {
      so: initial.cntn?.so ?? '',
      ngayCap: initial.cntn?.ngayCap ?? '',
      noiCap: initial.cntn?.noiCap ?? '',
    },
    danToc: initial.danToc ?? '',
    dienThoai: initial.dienThoai ?? '',
    email: initial.email ?? '',
    diaChiThuongTru: hydrateAddress(initial.diaChiThuongTru),
    ngayXuatGia: initial.ngayXuatGia ?? '',
    noiXuatGia: hydrateAddress(initial.noiXuatGia),
    hienTuHoc: initial.hienTuHoc ?? '',
    bonSu: initial.bonSu ?? '',
    hePhaiGoc: initial.hePhaiGoc ?? '',
    giaoDoanGoc: initial.giaoDoanGoc ?? '',
    haLap: numberOrBlank(initial.haLap),
    gioiSaDi: emptyPrecept(initial.gioiSaDi),
    gioiTyKheo: emptyPrecept(initial.gioiTyKheo),
    gioiSaDiNi: emptyPrecept(initial.gioiSaDiNi),
    gioiThucXoaMaNa: emptyPrecept(initial.gioiThucXoaMaNa),
    gioiTyKheoNi: emptyPrecept(initial.gioiTyKheoNi),
    giaoPhamGiaoHoi: emptyGiaoPham(initial.giaoPhamGiaoHoi),
    giaoPhamHePhai: emptyGiaoPham(initial.giaoPhamHePhai),
    trinhDoTheHoc: initial.trinhDoTheHoc ?? '',
    ngoaiNgu: initial.ngoaiNgu ?? '',
    trinhDoChuyenMon: initial.trinhDoChuyenMon ?? '',
    capBac: initial.capBac ?? '',
    trinhDoPhatHoc: initial.trinhDoPhatHoc ?? '',
    coNgu: initial.coNgu ?? '',
    hocViHocHam: initial.hocViHocHam ?? '',
    chucVuHePhai: withAtLeastOne(
      initial.chucVuHePhai?.map((row) => ({
        tuThangNam: row.tuThangNam ?? '',
        denThangNam: row.denThangNam ?? '',
        noiDung: row.noiDung ?? '',
        diaChi: row.diaChi ?? '',
      })),
      EMPTY_CHUC_VU,
    ),
    chucVuGhpgvn: withAtLeastOne(
      initial.chucVuGhpgvn?.map((row) => ({
        tuThangNam: row.tuThangNam ?? '',
        denThangNam: row.denThangNam ?? '',
        noiDung: row.noiDung ?? '',
        diaChi: row.diaChi ?? '',
      })),
      EMPTY_CHUC_VU,
    ),
    chucVuDoanThe: initial.chucVuDoanThe ?? '',
    khoaTu: withAtLeastOne(
      initial.khoaTu?.map((row) => ({
        ten: row.ten ?? '',
        soLan: numberOrBlank(row.soLan),
        ghiChu: row.ghiChu ?? '',
      })),
      EMPTY_KHOA_TU,
    ),
    giaDinh: {
      cha: emptyFamilyPerson(initial.giaDinh?.cha),
      me: emptyFamilyPerson(initial.giaDinh?.me),
      anhChiEm: withAtLeastOne(
        initial.giaDinh?.anhChiEm?.map((row) => ({
          quanHe: row.quanHe ?? '',
          hoTen: row.hoTen ?? '',
          namSinh: row.namSinh ?? '',
          ngheNghiep: row.ngheNghiep ?? '',
          noiO: row.noiO ?? '',
        })),
        EMPTY_ANH_CHI_EM,
      ),
    },
    nguyenVong: initial.nguyenVong ?? '',
  }
}

function buildPrecept(value: PreceptRecord): PreceptRecord | undefined {
  if (
    !hasText([
      value.ngayGh ?? '',
      value.taiGh ?? '',
      value.tonHieuGioiDan ?? '',
      value.ngayHePhai ?? '',
      value.taiHePhai ?? '',
    ])
  ) {
    return undefined
  }

  return {
    ngayGh: textOrUndefined(value.ngayGh ?? ''),
    taiGh: textOrUndefined(value.taiGh ?? ''),
    tonHieuGioiDan: textOrUndefined(value.tonHieuGioiDan ?? ''),
    ngayHePhai: textOrUndefined(value.ngayHePhai ?? ''),
    taiHePhai: textOrUndefined(value.taiHePhai ?? ''),
  }
}

function buildGiaoPham(value: GiaoPhamDraft): GiaoPham | undefined {
  if (!value.rank && typeof value.namTienPhong !== 'number') return undefined
  return {
    rank: value.rank,
    namTienPhong: numberOrUndefined(value.namTienPhong),
  }
}

function buildFamilyPerson(
  value: FamilyPersonDraft,
): Member['giaDinh'] extends { cha?: infer T } ? T | undefined : never {
  if (
    !hasText([value.hoTen, value.namSinh, value.ngheNghiep, value.noiO])
  ) {
    return undefined as never
  }

  return {
    hoTen: textOrUndefined(value.hoTen),
    namSinh: textOrUndefined(value.namSinh),
    ngheNghiep: textOrUndefined(value.ngheNghiep),
    noiO: textOrUndefined(value.noiO),
  } as never
}

export function buildMemberPatch(draft: MemberDraft): MemberProfilePatch {
  return {
    theDanh: textOrUndefined(draft.theDanh),
    phapDanh: textOrUndefined(draft.phapDanh),
    ngaySinh: textOrUndefined(draft.ngaySinh),
    noiSinh: addressDraftToValue(draft.noiSinh),
    nguyenQuan: textOrUndefined(draft.nguyenQuan),
    cccdMeta: {
      ngayCap: textOrUndefined(draft.cccdMeta.ngayCap),
      noiCap: textOrUndefined(draft.cccdMeta.noiCap),
    },
    cntn: {
      so: textOrUndefined(draft.cntn.so),
      ngayCap: textOrUndefined(draft.cntn.ngayCap),
      noiCap: textOrUndefined(draft.cntn.noiCap),
    },
    danToc: textOrUndefined(draft.danToc),
    dienThoai: textOrUndefined(draft.dienThoai),
    email: textOrUndefined(draft.email),
    diaChiThuongTru: addressDraftToValue(draft.diaChiThuongTru),
    ngayXuatGia: textOrUndefined(draft.ngayXuatGia),
    noiXuatGia: addressDraftToValue(draft.noiXuatGia),
    hienTuHoc: textOrUndefined(draft.hienTuHoc),
    bonSu: textOrUndefined(draft.bonSu),
    hePhaiGoc: textOrUndefined(draft.hePhaiGoc),
    giaoDoanGoc: textOrUndefined(draft.giaoDoanGoc),
    haLap: numberOrUndefined(draft.haLap),
    gioiSaDi: buildPrecept(draft.gioiSaDi),
    gioiTyKheo: buildPrecept(draft.gioiTyKheo),
    gioiSaDiNi: buildPrecept(draft.gioiSaDiNi),
    gioiThucXoaMaNa: buildPrecept(draft.gioiThucXoaMaNa),
    gioiTyKheoNi: buildPrecept(draft.gioiTyKheoNi),
    giaoPhamGiaoHoi: buildGiaoPham(draft.giaoPhamGiaoHoi),
    giaoPhamHePhai: buildGiaoPham(draft.giaoPhamHePhai),
    trinhDoTheHoc: textOrUndefined(draft.trinhDoTheHoc),
    ngoaiNgu: textOrUndefined(draft.ngoaiNgu),
    trinhDoChuyenMon: textOrUndefined(draft.trinhDoChuyenMon),
    capBac: textOrUndefined(draft.capBac),
    trinhDoPhatHoc: textOrUndefined(draft.trinhDoPhatHoc),
    coNgu: textOrUndefined(draft.coNgu),
    hocViHocHam: textOrUndefined(draft.hocViHocHam),
    chucVuHePhai: draft.chucVuHePhai
      .filter((row) =>
        hasText([row.tuThangNam, row.denThangNam, row.noiDung, row.diaChi]),
      )
      .map((row) => ({
        tuThangNam: textOrUndefined(row.tuThangNam),
        denThangNam: textOrUndefined(row.denThangNam),
        noiDung: textOrUndefined(row.noiDung),
        diaChi: textOrUndefined(row.diaChi),
      })),
    chucVuGhpgvn: draft.chucVuGhpgvn
      .filter((row) =>
        hasText([row.tuThangNam, row.denThangNam, row.noiDung, row.diaChi]),
      )
      .map((row) => ({
        tuThangNam: textOrUndefined(row.tuThangNam),
        denThangNam: textOrUndefined(row.denThangNam),
        noiDung: textOrUndefined(row.noiDung),
        diaChi: textOrUndefined(row.diaChi),
      })),
    chucVuDoanThe: textOrUndefined(draft.chucVuDoanThe),
    khoaTu: draft.khoaTu
      .filter(
        (row) =>
          hasText([row.ten, row.ghiChu]) || typeof row.soLan === 'number',
      )
      .map((row) => ({
        ten: textOrUndefined(row.ten),
        soLan: numberOrUndefined(row.soLan),
        ghiChu: textOrUndefined(row.ghiChu),
      })),
    giaDinh: {
      cha: buildFamilyPerson(draft.giaDinh.cha),
      me: buildFamilyPerson(draft.giaDinh.me),
      anhChiEm: draft.giaDinh.anhChiEm
        .filter((row) =>
          hasText([
            row.quanHe,
            row.hoTen,
            row.namSinh,
            row.ngheNghiep,
            row.noiO,
          ]),
        )
        .map((row) => ({
          quanHe: textOrUndefined(row.quanHe),
          hoTen: textOrUndefined(row.hoTen),
          namSinh: textOrUndefined(row.namSinh),
          ngheNghiep: textOrUndefined(row.ngheNghiep),
          noiO: textOrUndefined(row.noiO),
        })),
    },
    nguyenVong: textOrUndefined(draft.nguyenVong),
  }
}
