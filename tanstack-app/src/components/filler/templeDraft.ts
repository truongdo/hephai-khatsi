import {
  addressDraftToValue,
  hydrateAddress,
  type AddressDraft,
} from '#/domain/address'
import type { Temple } from '#/domain/types'
import type { TempleProfilePatch } from '#/repositories/templeRepo'

export type NumericValue = number | ''

export type TempleDraft = {
  danhHieu: string
  dacDiem: string[]
  nguoiKhaiSon: string
  namThanhLap: string
  tinChuHienCung: string
  diaChiCu: AddressDraft
  diaChiMoi: AddressDraft
  truTriHienNay: { phapDanh: string; dienThoai: string; email: string }
  truTriTienNhiem: Array<{ phapDanh: string; thoiGian: string; ghiChu: string }>
  banQuanTri: Array<{ ten: string; vaiTro: string }>
  tangSoHienTru: {
    tyKheo: NumericValue
    tyKheoNi: NumericValue
    saDi: NumericValue
    tapSu: NumericValue
  }
  soPhatTuQuyY: NumericValue
  soPhatTuThuongXuyen: NumericValue
  hoatDongPhatSu: Array<{ ten: string; thoiGian: string; ghiChu: string }>
  qdCongNhan: { so: string; ngay: string }
  qdBoNhiemTruTri: { so: string; ngay: string }
  moHinhKienTruc: string
  hangMucXayDung: string[]
  trungTu: Array<{ moTa: string; ghiChu: string }>
  quyenSuDungDat: {
    soGiay: string
    ngayCap: string
    dienTichKhuonVienM2: NumericValue
    dienTichXayDungM2: NumericValue
    soGiayDatCanhTac: string
    dienTichDatCanhTacM2: NumericValue
  }
}

const EMPTY_TRU_TRI_TIEN_NHIEM = { phapDanh: '', thoiGian: '', ghiChu: '' }
const EMPTY_BAN_QUAN_TRI = { ten: '', vaiTro: '' }
const EMPTY_HOAT_DONG = { ten: '', thoiGian: '', ghiChu: '' }
const EMPTY_TRUNG_TU = { moTa: '', ghiChu: '' }

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

export function emptyTempleDraft(
  initial: Partial<Temple> & { seedPhone?: string },
): TempleDraft {
  const seededPhone =
    initial.truTriHienNay?.dienThoai || initial.seedPhone || ''

  return {
    danhHieu: initial.danhHieu ?? '',
    dacDiem: initial.dacDiem ?? [],
    nguoiKhaiSon: initial.nguoiKhaiSon ?? '',
    namThanhLap: initial.namThanhLap ?? '',
    tinChuHienCung: initial.tinChuHienCung ?? '',
    diaChiCu: hydrateAddress(initial.diaChiCu),
    diaChiMoi: hydrateAddress(initial.diaChiMoi),
    truTriHienNay: {
      phapDanh: initial.truTriHienNay?.phapDanh ?? '',
      dienThoai: seededPhone,
      email: initial.truTriHienNay?.email ?? '',
    },
    truTriTienNhiem: withAtLeastOne(
      initial.truTriTienNhiem?.map((row) => ({
        phapDanh: row.phapDanh ?? '',
        thoiGian: row.thoiGian ?? '',
        ghiChu: row.ghiChu ?? '',
      })),
      EMPTY_TRU_TRI_TIEN_NHIEM,
    ),
    banQuanTri: withAtLeastOne(
      initial.banQuanTri?.map((row) => ({
        ten: row.ten ?? '',
        vaiTro: row.vaiTro ?? '',
      })),
      EMPTY_BAN_QUAN_TRI,
    ),
    tangSoHienTru: {
      tyKheo: numberOrBlank(initial.tangSoHienTru?.tyKheo),
      tyKheoNi: numberOrBlank(initial.tangSoHienTru?.tyKheoNi),
      saDi: numberOrBlank(initial.tangSoHienTru?.saDi),
      tapSu: numberOrBlank(initial.tangSoHienTru?.tapSu),
    },
    soPhatTuQuyY: numberOrBlank(initial.soPhatTuQuyY),
    soPhatTuThuongXuyen: numberOrBlank(initial.soPhatTuThuongXuyen),
    hoatDongPhatSu: withAtLeastOne(
      initial.hoatDongPhatSu?.map((row) => ({
        ten: row.ten ?? '',
        thoiGian: row.thoiGian ?? '',
        ghiChu: row.ghiChu ?? '',
      })),
      EMPTY_HOAT_DONG,
    ),
    qdCongNhan: {
      so: initial.qdCongNhan?.so ?? '',
      ngay: initial.qdCongNhan?.ngay ?? '',
    },
    qdBoNhiemTruTri: {
      so: initial.qdBoNhiemTruTri?.so ?? '',
      ngay: initial.qdBoNhiemTruTri?.ngay ?? '',
    },
    moHinhKienTruc: initial.moHinhKienTruc ?? '',
    hangMucXayDung: initial.hangMucXayDung ?? [],
    trungTu: withAtLeastOne(
      initial.trungTu?.map((row) => ({
        moTa: row.moTa ?? '',
        ghiChu: row.ghiChu ?? '',
      })),
      EMPTY_TRUNG_TU,
    ),
    quyenSuDungDat: {
      soGiay: initial.quyenSuDungDat?.soGiay ?? '',
      ngayCap: initial.quyenSuDungDat?.ngayCap ?? '',
      dienTichKhuonVienM2: numberOrBlank(
        initial.quyenSuDungDat?.dienTichKhuonVienM2,
      ),
      dienTichXayDungM2: numberOrBlank(
        initial.quyenSuDungDat?.dienTichXayDungM2,
      ),
      soGiayDatCanhTac: initial.quyenSuDungDat?.soGiayDatCanhTac ?? '',
      dienTichDatCanhTacM2: numberOrBlank(
        initial.quyenSuDungDat?.dienTichDatCanhTacM2,
      ),
    },
  }
}

export function buildTemplePatch(draft: TempleDraft): TempleProfilePatch {
  return {
    danhHieu: textOrUndefined(draft.danhHieu),
    dacDiem: draft.dacDiem,
    nguoiKhaiSon: textOrUndefined(draft.nguoiKhaiSon),
    namThanhLap: textOrUndefined(draft.namThanhLap),
    tinChuHienCung: textOrUndefined(draft.tinChuHienCung),
    diaChiCu: addressDraftToValue(draft.diaChiCu),
    diaChiMoi: addressDraftToValue(draft.diaChiMoi),
    truTriHienNay: {
      phapDanh: textOrUndefined(draft.truTriHienNay.phapDanh),
      dienThoai: textOrUndefined(draft.truTriHienNay.dienThoai),
      email: textOrUndefined(draft.truTriHienNay.email),
    },
    truTriTienNhiem: draft.truTriTienNhiem
      .filter((row) => hasText([row.phapDanh, row.thoiGian, row.ghiChu]))
      .map((row) => ({
        phapDanh: textOrUndefined(row.phapDanh),
        thoiGian: textOrUndefined(row.thoiGian),
        ghiChu: textOrUndefined(row.ghiChu),
      })),
    banQuanTri: draft.banQuanTri
      .filter((row) => row.ten.trim())
      .map((row) => ({
        ten: row.ten.trim(),
        vaiTro: textOrUndefined(row.vaiTro),
      })),
    tangSoHienTru: {
      tyKheo: numberOrUndefined(draft.tangSoHienTru.tyKheo),
      tyKheoNi: numberOrUndefined(draft.tangSoHienTru.tyKheoNi),
      saDi: numberOrUndefined(draft.tangSoHienTru.saDi),
      tapSu: numberOrUndefined(draft.tangSoHienTru.tapSu),
    },
    soPhatTuQuyY: numberOrUndefined(draft.soPhatTuQuyY),
    soPhatTuThuongXuyen: numberOrUndefined(draft.soPhatTuThuongXuyen),
    hoatDongPhatSu: draft.hoatDongPhatSu
      .filter((row) => hasText([row.ten, row.thoiGian, row.ghiChu]))
      .map((row) => ({
        ten: textOrUndefined(row.ten),
        thoiGian: textOrUndefined(row.thoiGian),
        ghiChu: textOrUndefined(row.ghiChu),
      })),
    qdCongNhan: {
      so: textOrUndefined(draft.qdCongNhan.so),
      ngay: textOrUndefined(draft.qdCongNhan.ngay),
    },
    qdBoNhiemTruTri: {
      so: textOrUndefined(draft.qdBoNhiemTruTri.so),
      ngay: textOrUndefined(draft.qdBoNhiemTruTri.ngay),
    },
    moHinhKienTruc: textOrUndefined(draft.moHinhKienTruc),
    hangMucXayDung: draft.hangMucXayDung,
    trungTu: draft.trungTu
      .filter((row) => hasText([row.moTa, row.ghiChu]))
      .map((row) => ({
        moTa: row.moTa.trim(),
        ghiChu: row.ghiChu.trim(),
      })),
    quyenSuDungDat: {
      soGiay: textOrUndefined(draft.quyenSuDungDat.soGiay),
      ngayCap: textOrUndefined(draft.quyenSuDungDat.ngayCap),
      dienTichKhuonVienM2: numberOrUndefined(
        draft.quyenSuDungDat.dienTichKhuonVienM2,
      ),
      dienTichXayDungM2: numberOrUndefined(
        draft.quyenSuDungDat.dienTichXayDungM2,
      ),
      soGiayDatCanhTac: textOrUndefined(
        draft.quyenSuDungDat.soGiayDatCanhTac,
      ),
      dienTichDatCanhTacM2: numberOrUndefined(
        draft.quyenSuDungDat.dienTichDatCanhTacM2,
      ),
    },
  }
}
