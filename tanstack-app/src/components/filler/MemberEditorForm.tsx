import {
  Button,
  Fieldset,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { DateInput, MonthPickerInput } from '@mantine/dates'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { VietnamAddressFields } from '#/components/address/VietnamAddressFields'
import type { AddressDraft } from '#/domain/address'
import { addressDraftToValue, hydrateAddress } from '#/domain/address'
import type { GiaoPham, Member, PreceptRecord, SanghaType } from '#/domain/types'
import { m } from '#/paraglide/messages'
import { fillerKeys } from '#/query/fillerKeys'
import { fillerOrgUnitsQuery } from '#/query/fillerQueries'
import type { MemberProfilePatch } from '#/repositories/memberRepo'
import { saveMemberDraft } from '#/use-cases/saveMemberDraft'
import { uploadMemberPhoto } from '#/use-cases/uploadMemberPhoto'
import type { FillerOption } from './fillerFormOptions'
import { NI_RANKS, TANG_RANKS } from './fillerFormOptions'
import {
  FillerEditorShell,
  type FillerEditorStatus,
} from './FillerEditorShell'
import { FormSection } from './FormSection'
import { MemberPortraitField } from './MemberPortraitField'
import {
  validateMemberRequiredFields,
  type MemberRequiredFieldErrors,
} from './memberRequiredValidation'
import { PreceptFields } from './PreceptFields'
import { RepeatableFieldset } from './RepeatableFieldset'

export type MemberEditorFormProps = {
  title: string
  token: string
  orgUnitId: string
  sanghaType: SanghaType
  cccd?: string
  seedPhone?: string
  memberId?: string
  initial?: Partial<Member>
  status: FillerEditorStatus
  onCreated: (memberId: string) => void
}

type NumericValue = number | ''

type ChucVuRow = {
  tuThangNam: string
  denThangNam: string
  noiDung: string
  diaChi: string
}

type KhoaTuRow = {
  ten: string
  soLan: NumericValue
  ghiChu: string
}

type FamilyPersonDraft = {
  hoTen: string
  namSinh: string
  ngheNghiep: string
  dienThoai: string
  noiO: string
}

type AnhChiEmRow = {
  quanHe: string
  hoTen: string
  namSinh: string
  ngheNghiep: string
  noiO: string
}

type GiaoPhamDraft = {
  rank: string
  namTienPhong: NumericValue
}

type MemberDraft = {
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

const EMPTY_CHUC_VU: ChucVuRow = {
  tuThangNam: '',
  denThangNam: '',
  noiDung: '',
  diaChi: '',
}
const EMPTY_KHOA_TU: KhoaTuRow = { ten: '', soLan: '', ghiChu: '' }
const EMPTY_ANH_CHI_EM: AnhChiEmRow = {
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

function numberInputValue(value: string | number): NumericValue {
  return typeof value === 'number' ? value : ''
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
    dienThoai: value?.dienThoai ?? '',
    noiO: value?.noiO ?? '',
  }
}

function emptyMemberDraft(initial: Partial<Member> = {}): MemberDraft {
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

function mapAddressErrors(errors?: { city?: 'REQUIRED'; ward?: 'REQUIRED' }) {
  return {
    city:
      errors?.city === 'REQUIRED'
        ? m.filler_address_city_required()
        : undefined,
    ward:
      errors?.ward === 'REQUIRED'
        ? m.filler_address_ward_required()
        : undefined,
  }
}

function mapRequiredError(code: 'REQUIRED' | undefined): string | undefined {
  return code === 'REQUIRED' ? m.filler_error_field_required() : undefined
}

function mapEmailError(
  code: 'REQUIRED' | 'INVALID' | undefined,
): string | undefined {
  if (code === 'REQUIRED') return m.filler_error_field_required()
  if (code === 'INVALID') return m.filler_error_email_invalid()
  return undefined
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
    !hasText([
      value.hoTen,
      value.namSinh,
      value.ngheNghiep,
      value.dienThoai,
      value.noiO,
    ])
  ) {
    return undefined as never
  }

  return {
    hoTen: textOrUndefined(value.hoTen),
    namSinh: textOrUndefined(value.namSinh),
    ngheNghiep: textOrUndefined(value.ngheNghiep),
    dienThoai: textOrUndefined(value.dienThoai),
    noiO: textOrUndefined(value.noiO),
  } as never
}

function buildPatch(draft: MemberDraft): MemberProfilePatch {
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

function optionData(options: FillerOption[]) {
  return options.map((option) => ({
    value: option.value,
    label: option.label(),
  }))
}

function rankOptions(sanghaType: SanghaType) {
  return optionData(sanghaType === 'tang' ? TANG_RANKS : NI_RANKS)
}

const MONTH_YEAR_RE = /^\d{4}-\d{2}$/

function toMonthPickerValue(value: string): string | null {
  if (MONTH_YEAR_RE.test(value)) return `${value}-01`
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value.slice(0, 7)}-01`
  return null
}

function fromMonthPickerValue(value: string | null): string {
  return value ? value.slice(0, 7) : ''
}

export function MemberEditorForm({
  title,
  token,
  orgUnitId,
  sanghaType,
  cccd,
  seedPhone,
  memberId,
  initial = {},
  status,
  onCreated,
}: MemberEditorFormProps) {
  const queryClient = useQueryClient()
  const isCreate = !memberId
  const [cccdDraft, setCccdDraft] = useState(cccd ?? '')
  const resolvedCccd = isCreate ? cccdDraft : (cccd ?? '')
  const [draft, setDraft] = useState(() =>
    emptyMemberDraft({
      ...initial,
      dienThoai: initial.dienThoai ?? seedPhone,
    }),
  )
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [photoPath, setPhotoPath] = useState<string | null>(
    initial.photoPath ?? null,
  )
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null)
  const [fieldErrors, setFieldErrors] = useState<MemberRequiredFieldErrors>({})
  const disabled = status === 'view'
  const ranks = useMemo(() => rankOptions(sanghaType), [sanghaType])
  const orgUnitsQuery = useQuery(fillerOrgUnitsQuery())
  const giaoDoanOptions = useMemo(
    () =>
      (orgUnitsQuery.data ?? [])
        .filter((unit) => unit.kind === 'giao_doan')
        .map((unit) => ({ value: unit.id, label: unit.name })),
    [orgUnitsQuery.data],
  )

  const saveMutation = useMutation({
    mutationFn: () =>
      saveMemberDraft({
        token,
        orgUnitId,
        sanghaType,
        cccd: resolvedCccd,
        patch: buildPatch(draft),
      }),
    onError: () => {
      setSaveSuccess(null)
      setSaveError(m.filler_save_error())
    },
  })

  const handleSave = useCallback(async () => {
    const result = validateMemberRequiredFields({
      theDanh: draft.theDanh,
      phapDanh: draft.phapDanh,
      ngaySinh: draft.ngaySinh,
      noiSinh: draft.noiSinh,
      dienThoai: draft.dienThoai,
      email: draft.email,
      diaChiThuongTru: draft.diaChiThuongTru,
      ngayXuatGia: draft.ngayXuatGia,
      noiXuatGia: draft.noiXuatGia,
      hienTuHoc: draft.hienTuHoc,
      bonSu: draft.bonSu,
    })
    if (!result.valid) {
      setFieldErrors(result.errors)
      return
    }
    setFieldErrors({})
    try {
      const saveResult = await saveMutation.mutateAsync()
      setSaveError(null)
      if (saveResult.mode === 'created') {
        if (pendingPhoto) {
          try {
            const bytes = new Uint8Array(await pendingPhoto.arrayBuffer())
            const uploadResult = await uploadMemberPhoto({
              memberId: saveResult.member.id,
              cccd: resolvedCccd,
              bytes,
              contentType: pendingPhoto.type,
              inviteToken: token,
            })
            setPhotoPath(uploadResult.photoPath)
            setPendingPhoto(null)
          } catch {
            setSaveError(m.filler_photo_upload_error())
          }
        }
        onCreated(saveResult.member.id)
        return
      }
      setSaveSuccess(m.filler_save_success())
      await queryClient.invalidateQueries({
        queryKey: fillerKeys.member(saveResult.member.id),
      })
    } catch {
      // onError handles save failure
    }
  }, [
    draft,
    pendingPhoto,
    queryClient,
    resolvedCccd,
    saveMutation,
    token,
    onCreated,
  ])

  const updateDraft = <K extends keyof MemberDraft>(
    key: K,
    value: MemberDraft[K],
  ) => setDraft((current) => ({ ...current, [key]: value }))

  const updateNested = <
    K extends keyof MemberDraft,
    F extends keyof MemberDraft[K],
  >(
    key: K,
    field: F,
    value: MemberDraft[K][F],
  ) =>
    setDraft((current) => ({
      ...current,
      [key]: { ...(current[key] as object), [field]: value },
    }))

  const updateFamilyPerson = (
    person: 'cha' | 'me',
    field: keyof FamilyPersonDraft,
    value: string,
  ) =>
    setDraft((current) => ({
      ...current,
      giaDinh: {
        ...current.giaDinh,
        [person]: { ...current.giaDinh[person], [field]: value },
      },
    }))

  const updateChucVuRow = (
    key: 'chucVuHePhai' | 'chucVuGhpgvn',
    index: number,
    row: ChucVuRow,
  ) =>
    setDraft((current) => ({
      ...current,
      [key]: current[key].map((item, itemIndex) =>
        itemIndex === index ? row : item,
      ),
    }))

  const addChucVuRow = (key: 'chucVuHePhai' | 'chucVuGhpgvn') =>
    setDraft((current) => ({
      ...current,
      [key]: [...current[key], EMPTY_CHUC_VU],
    }))

  const removeChucVuRow = (
    key: 'chucVuHePhai' | 'chucVuGhpgvn',
    index: number,
  ) =>
    setDraft((current) => {
      const nextRows = current[key].filter((_, itemIndex) => itemIndex !== index)
      return {
        ...current,
        [key]: nextRows.length > 0 ? nextRows : [EMPTY_CHUC_VU],
      }
    })

  const updateKhoaTuRow = (index: number, row: KhoaTuRow) =>
    setDraft((current) => ({
      ...current,
      khoaTu: current.khoaTu.map((item, itemIndex) =>
        itemIndex === index ? row : item,
      ),
    }))

  const addKhoaTuRow = () =>
    setDraft((current) => ({
      ...current,
      khoaTu: [...current.khoaTu, EMPTY_KHOA_TU],
    }))

  const removeKhoaTuRow = (index: number) =>
    setDraft((current) => {
      const nextRows = current.khoaTu.filter((_, itemIndex) => itemIndex !== index)
      return {
        ...current,
        khoaTu: nextRows.length > 0 ? nextRows : [EMPTY_KHOA_TU],
      }
    })

  const updateAnhChiEmRow = (index: number, row: AnhChiEmRow) =>
    setDraft((current) => ({
      ...current,
      giaDinh: {
        ...current.giaDinh,
        anhChiEm: current.giaDinh.anhChiEm.map((item, itemIndex) =>
          itemIndex === index ? row : item,
        ),
      },
    }))

  const addAnhChiEmRow = () =>
    setDraft((current) => {
      return {
        ...current,
        giaDinh: {
          ...current.giaDinh,
          anhChiEm: [...current.giaDinh.anhChiEm, EMPTY_ANH_CHI_EM],
        },
      }
    })

  const removeAnhChiEmRow = (index: number) =>
    setDraft((current) => {
      const nextRows = current.giaDinh.anhChiEm.filter(
        (_, itemIndex) => itemIndex !== index,
      )
      return {
        ...current,
        giaDinh: {
          ...current.giaDinh,
          anhChiEm: nextRows.length > 0 ? nextRows : [EMPTY_ANH_CHI_EM],
        },
      }
    })

  const onDiaChiThuongTruChange = useCallback(
    (value: AddressDraft) =>
      setDraft((current) => ({ ...current, diaChiThuongTru: value })),
    [],
  )

  const onNoiSinhChange = useCallback(
    (value: AddressDraft) =>
      setDraft((current) => ({ ...current, noiSinh: value })),
    [],
  )

  const onNoiXuatGiaChange = useCallback(
    (value: AddressDraft) =>
      setDraft((current) => ({ ...current, noiXuatGia: value })),
    [],
  )

  const identitySection = useMemo(
    () => (
      <FormSection title={m.filler_section_identity()}>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput
            label={m.filler_field_the_danh()}
            placeholder={m.filler_ph_the_danh()}
            value={draft.theDanh}
            onChange={(event) =>
              updateDraft('theDanh', event.currentTarget.value)
            }
            disabled={disabled}
            required
            error={mapRequiredError(fieldErrors.theDanh)}
          />
          <TextInput
            label={m.filler_field_phap_danh()}
            placeholder={m.filler_ph_phap_danh_member()}
            value={draft.phapDanh}
            onChange={(event) =>
              updateDraft('phapDanh', event.currentTarget.value)
            }
            disabled={disabled}
            required
            error={mapRequiredError(fieldErrors.phapDanh)}
          />
          <DateInput
            label={m.filler_field_ngay_sinh()}
            valueFormat="YYYY-MM-DD"
            clearable
            value={draft.ngaySinh || null}
            onChange={(value) => updateDraft('ngaySinh', value ?? '')}
            disabled={disabled}
            required
            error={mapRequiredError(fieldErrors.ngaySinh)}
          />
          <TextInput
            label={m.filler_field_nguyen_quan()}
            placeholder={m.filler_ph_nguyen_quan()}
            value={draft.nguyenQuan}
            onChange={(event) =>
              updateDraft('nguyenQuan', event.currentTarget.value)
            }
            disabled={disabled}
          />
          <TextInput
            label={m.filler_field_cccd()}
            placeholder={m.filler_ph_cccd()}
            value={resolvedCccd}
            disabled={!isCreate || disabled}
            onChange={(event) => setCccdDraft(event.currentTarget.value)}
            required={isCreate}
          />
          <DateInput
            label={m.filler_field_cccd_ngay_cap()}
            valueFormat="YYYY-MM-DD"
            clearable
            value={draft.cccdMeta.ngayCap || null}
            onChange={(value) =>
              updateNested('cccdMeta', 'ngayCap', value ?? '')
            }
            disabled={disabled}
          />
          <TextInput
            label={m.filler_field_cccd_noi_cap()}
            placeholder={m.filler_ph_noi_cap()}
            value={draft.cccdMeta.noiCap}
            onChange={(event) =>
              updateNested('cccdMeta', 'noiCap', event.currentTarget.value)
            }
            disabled={disabled}
          />
          <TextInput
            label={m.filler_field_cntn_so()}
            placeholder={m.filler_ph_cntn_so()}
            value={draft.cntn.so}
            onChange={(event) =>
              updateNested('cntn', 'so', event.currentTarget.value)
            }
            disabled={disabled}
          />
          <DateInput
            label={m.filler_field_cntn_ngay_cap()}
            valueFormat="YYYY-MM-DD"
            clearable
            value={draft.cntn.ngayCap || null}
            onChange={(value) => updateNested('cntn', 'ngayCap', value ?? '')}
            disabled={disabled}
          />
          <TextInput
            label={m.filler_field_cntn_noi_cap()}
            placeholder={m.filler_ph_noi_cap_cntn()}
            value={draft.cntn.noiCap}
            onChange={(event) =>
              updateNested('cntn', 'noiCap', event.currentTarget.value)
            }
            disabled={disabled}
          />
          <TextInput
            label={m.filler_field_dan_toc()}
            placeholder={m.filler_ph_dan_toc()}
            value={draft.danToc}
            onChange={(event) =>
              updateDraft('danToc', event.currentTarget.value)
            }
            disabled={disabled}
          />
        </SimpleGrid>
        <Stack gap="xs">
          <Text fw={600}>{m.filler_field_noi_sinh()}</Text>
          <VietnamAddressFields
            label={m.filler_field_noi_sinh()}
            value={draft.noiSinh}
            onChange={onNoiSinhChange}
            disabled={disabled}
            required
            errors={mapAddressErrors(fieldErrors.noiSinh)}
          />
        </Stack>
      </FormSection>
    ),
    [
      draft.theDanh,
      draft.phapDanh,
      draft.ngaySinh,
      draft.noiSinh,
      draft.nguyenQuan,
      draft.cccdMeta,
      draft.cntn,
      draft.danToc,
      resolvedCccd,
      isCreate,
      disabled,
      onNoiSinhChange,
      fieldErrors.theDanh,
      fieldErrors.phapDanh,
      fieldErrors.ngaySinh,
      fieldErrors.noiSinh,
    ],
  )

  const contactSection = useMemo(
    () => (
      <FormSection title={m.filler_section_contact()}>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput
            label={m.filler_field_dien_thoai()}
            placeholder={m.filler_ph_phone()}
            value={draft.dienThoai}
            onChange={(event) =>
              updateDraft('dienThoai', event.currentTarget.value)
            }
            disabled={disabled}
            required
            error={mapRequiredError(fieldErrors.dienThoai)}
          />
          <TextInput
            label={m.filler_field_email()}
            placeholder={m.filler_ph_email()}
            value={draft.email}
            onChange={(event) =>
              updateDraft('email', event.currentTarget.value)
            }
            disabled={disabled}
            required
            error={mapEmailError(fieldErrors.email)}
          />
        </SimpleGrid>
        <Stack gap="xs">
          <Stack gap={2}>
            <Text fw={600}>{m.filler_field_dia_chi_thuong_tru()}</Text>
            <Text size="xs" c="dimmed">
              {m.filler_desc_dia_chi_thuong_tru()}
            </Text>
          </Stack>
          <VietnamAddressFields
            label={m.filler_field_dia_chi_thuong_tru()}
            value={draft.diaChiThuongTru}
            onChange={onDiaChiThuongTruChange}
            disabled={disabled}
            required
            errors={mapAddressErrors(fieldErrors.diaChiThuongTru)}
          />
        </Stack>
      </FormSection>
    ),
    [
      draft.dienThoai,
      draft.email,
      draft.diaChiThuongTru,
      onDiaChiThuongTruChange,
      fieldErrors.dienThoai,
      fieldErrors.email,
      fieldErrors.diaChiThuongTru,
      disabled,
    ],
  )

  const renderChucVuRows = (key: 'chucVuHePhai' | 'chucVuGhpgvn') =>
    draft[key].map((row, index) => (
      <Fieldset
        key={index}
        legend={`${key === 'chucVuHePhai' ? m.filler_field_chuc_vu_he_phai() : m.filler_field_chuc_vu_ghpgvn()} ${index + 1}`}
        disabled={disabled}
      >
        <Stack>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <MonthPickerInput
              label={m.filler_field_tu_thang_nam()}
              valueFormat="MM/YYYY"
              clearable
              value={toMonthPickerValue(row.tuThangNam)}
              onChange={(value) =>
                updateChucVuRow(key, index, {
                  ...row,
                  tuThangNam: fromMonthPickerValue(value),
                })
              }
            />
            <MonthPickerInput
              label={m.filler_field_den_thang_nam()}
              valueFormat="MM/YYYY"
              clearable
              value={toMonthPickerValue(row.denThangNam)}
              onChange={(value) =>
                updateChucVuRow(key, index, {
                  ...row,
                  denThangNam: fromMonthPickerValue(value),
                })
              }
            />
            <TextInput
              label={m.filler_field_noi_dung()}
              description={
                key === 'chucVuHePhai'
                  ? m.filler_desc_noi_dung()
                  : m.filler_desc_noi_dung_ghpgvn()
              }
              placeholder={
                key === 'chucVuHePhai'
                  ? m.filler_ph_noi_dung_he_phai()
                  : m.filler_ph_noi_dung_ghpgvn()
              }
              value={row.noiDung}
              onChange={(event) =>
                updateChucVuRow(key, index, {
                  ...row,
                  noiDung: event.currentTarget.value,
                })
              }
            />
            <TextInput
              label={m.filler_field_dia_chi()}
              placeholder={
                key === 'chucVuHePhai'
                  ? m.filler_ph_dia_chi_he_phai()
                  : m.filler_ph_dia_chi_ghpgvn()
              }
              value={row.diaChi}
              onChange={(event) =>
                updateChucVuRow(key, index, {
                  ...row,
                  diaChi: event.currentTarget.value,
                })
              }
            />
          </SimpleGrid>
          <Button
            type="button"
            variant="subtle"
            color="red"
            onClick={() => removeChucVuRow(key, index)}
            disabled={disabled}
          >
            {m.filler_remove_row()}
          </Button>
        </Stack>
      </Fieldset>
    ))

  const restSections = useMemo(
    () => (
      <>
        <FormSection title={m.filler_section_xuat_gia()}>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <DateInput
              label={m.filler_field_ngay_xuat_gia()}
              valueFormat="YYYY-MM-DD"
              clearable
              value={draft.ngayXuatGia || null}
              onChange={(value) => updateDraft('ngayXuatGia', value ?? '')}
              disabled={disabled}
              required
              error={mapRequiredError(fieldErrors.ngayXuatGia)}
            />
            <TextInput
              label={m.filler_field_hien_tu_hoc()}
              description={m.filler_desc_hien_tu_hoc()}
              placeholder={m.filler_ph_hien_tu_hoc()}
              value={draft.hienTuHoc}
              onChange={(event) =>
                updateDraft('hienTuHoc', event.currentTarget.value)
              }
              disabled={disabled}
              required
              error={mapRequiredError(fieldErrors.hienTuHoc)}
            />
            <TextInput
              label={m.filler_field_bon_su()}
              description={m.filler_desc_bon_su()}
              placeholder={m.filler_ph_bon_su()}
              value={draft.bonSu}
              onChange={(event) =>
                updateDraft('bonSu', event.currentTarget.value)
              }
              disabled={disabled}
              required
              error={mapRequiredError(fieldErrors.bonSu)}
            />
            <TextInput
              label={m.filler_field_he_phai_goc()}
              description={m.filler_desc_he_phai_goc()}
              placeholder={m.filler_ph_he_phai_goc()}
              value={draft.hePhaiGoc}
              onChange={(event) =>
                updateDraft('hePhaiGoc', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <Select
              label={m.filler_field_giao_doan_goc()}
              description={m.filler_desc_giao_doan_goc()}
              placeholder={m.filler_org_placeholder()}
              data={giaoDoanOptions}
              value={
                giaoDoanOptions.some(
                  (option) => option.value === draft.giaoDoanGoc,
                )
                  ? draft.giaoDoanGoc || null
                  : null
              }
              onChange={(value) => updateDraft('giaoDoanGoc', value ?? '')}
              searchable
              clearable
              disabled={disabled}
            />
            <NumberInput
              label={m.filler_field_ha_lap()}
              description={m.filler_desc_ha_lap()}
              placeholder={m.filler_ph_number()}
              value={draft.haLap}
              onChange={(value) =>
                updateDraft('haLap', numberInputValue(value))
              }
              disabled={disabled}
              min={0}
            />
          </SimpleGrid>
          <Stack gap="xs">
            <Stack gap={2}>
              <Text fw={600}>{m.filler_field_noi_xuat_gia()}</Text>
              <Text size="xs" c="dimmed">
                {m.filler_desc_noi_xuat_gia()}
              </Text>
            </Stack>
            <VietnamAddressFields
              label={m.filler_field_noi_xuat_gia()}
              value={draft.noiXuatGia}
              onChange={onNoiXuatGiaChange}
              disabled={disabled}
              required
              linePlaceholder={m.filler_ph_noi_xuat_gia_line()}
              errors={mapAddressErrors(fieldErrors.noiXuatGia)}
            />
          </Stack>
        </FormSection>

        <FormSection title={m.filler_section_gioi()}>
          {sanghaType === 'tang' ? (
            <>
              <PreceptFields
                legend={m.filler_field_gioi_sa_di()}
                value={draft.gioiSaDi}
                onChange={(value) => updateDraft('gioiSaDi', value)}
                disabled={disabled}
              />
              <PreceptFields
                legend={m.filler_field_gioi_ty_kheo()}
                value={draft.gioiTyKheo}
                onChange={(value) => updateDraft('gioiTyKheo', value)}
                disabled={disabled}
              />
            </>
          ) : (
            <>
              <PreceptFields
                legend={m.filler_field_gioi_sa_di_ni()}
                value={draft.gioiSaDiNi}
                onChange={(value) => updateDraft('gioiSaDiNi', value)}
                disabled={disabled}
              />
              <PreceptFields
                legend={m.filler_field_gioi_thuc_xoa()}
                value={draft.gioiThucXoaMaNa}
                onChange={(value) => updateDraft('gioiThucXoaMaNa', value)}
                disabled={disabled}
              />
              <PreceptFields
                legend={m.filler_field_gioi_ty_kheo_ni()}
                value={draft.gioiTyKheoNi}
                onChange={(value) => updateDraft('gioiTyKheoNi', value)}
                disabled={disabled}
              />
            </>
          )}
        </FormSection>

        <FormSection title={m.filler_section_pham_vi()}>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Fieldset legend={m.filler_field_gp_giao_hoi()} disabled={disabled}>
              <Stack>
                <Select
                  label={m.filler_field_rank()}
                  data={ranks}
                  value={draft.giaoPhamGiaoHoi.rank || null}
                  onChange={(value) =>
                    updateNested('giaoPhamGiaoHoi', 'rank', value ?? '')
                  }
                  clearable
                />
                <NumberInput
                  label={m.filler_field_nam_tien_phong()}
                  placeholder={m.filler_ph_year()}
                  value={draft.giaoPhamGiaoHoi.namTienPhong}
                  onChange={(value) =>
                    updateNested(
                      'giaoPhamGiaoHoi',
                      'namTienPhong',
                      numberInputValue(value),
                    )
                  }
                  min={0}
                />
              </Stack>
            </Fieldset>
            <Fieldset legend={m.filler_field_gp_he_phai()} disabled={disabled}>
              <Stack>
                <Select
                  label={m.filler_field_rank()}
                  data={ranks}
                  value={draft.giaoPhamHePhai.rank || null}
                  onChange={(value) =>
                    updateNested('giaoPhamHePhai', 'rank', value ?? '')
                  }
                  clearable
                />
                <NumberInput
                  label={m.filler_field_nam_tien_phong()}
                  placeholder={m.filler_ph_year()}
                  value={draft.giaoPhamHePhai.namTienPhong}
                  onChange={(value) =>
                    updateNested(
                      'giaoPhamHePhai',
                      'namTienPhong',
                      numberInputValue(value),
                    )
                  }
                  min={0}
                />
              </Stack>
            </Fieldset>
          </SimpleGrid>
        </FormSection>

        <FormSection title={m.filler_section_hoc_van()}>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label={m.filler_field_trinh_do_the_hoc()}
              placeholder={m.filler_ph_trinh_do()}
              value={draft.trinhDoTheHoc}
              onChange={(event) =>
                updateDraft('trinhDoTheHoc', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_ngoai_ngu()}
              placeholder={m.filler_ph_ngoai_ngu()}
              value={draft.ngoaiNgu}
              onChange={(event) =>
                updateDraft('ngoaiNgu', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_trinh_do_chuyen_mon()}
              placeholder={m.filler_ph_chuyen_mon()}
              value={draft.trinhDoChuyenMon}
              onChange={(event) =>
                updateDraft('trinhDoChuyenMon', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_cap_bac()}
              placeholder={m.filler_ph_cap_bac()}
              value={draft.capBac}
              onChange={(event) =>
                updateDraft('capBac', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_trinh_do_phat_hoc()}
              placeholder={m.filler_ph_phat_hoc()}
              value={draft.trinhDoPhatHoc}
              onChange={(event) =>
                updateDraft('trinhDoPhatHoc', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_co_ngu()}
              placeholder={m.filler_ph_co_ngu()}
              value={draft.coNgu}
              onChange={(event) =>
                updateDraft('coNgu', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_hoc_vi()}
              placeholder={m.filler_ph_hoc_vi()}
              value={draft.hocViHocHam}
              onChange={(event) =>
                updateDraft('hocViHocHam', event.currentTarget.value)
              }
              disabled={disabled}
            />
          </SimpleGrid>
        </FormSection>

        <FormSection title={m.filler_section_chuc_vu()}>
          <RepeatableFieldset
            label={m.filler_field_chuc_vu_he_phai()}
            addLabel={m.filler_add_row()}
            onAdd={() => addChucVuRow('chucVuHePhai')}
            disabled={disabled}
          >
            {renderChucVuRows('chucVuHePhai')}
          </RepeatableFieldset>
          <RepeatableFieldset
            label={m.filler_field_chuc_vu_ghpgvn()}
            addLabel={m.filler_add_row()}
            onAdd={() => addChucVuRow('chucVuGhpgvn')}
            disabled={disabled}
          >
            {renderChucVuRows('chucVuGhpgvn')}
          </RepeatableFieldset>
          <TextInput
            label={m.filler_field_chuc_vu_doan_the()}
            description={m.filler_desc_chuc_vu_doan_the()}
            placeholder={m.filler_ph_chuc_vu_doan_the()}
            value={draft.chucVuDoanThe}
            onChange={(event) =>
              updateDraft('chucVuDoanThe', event.currentTarget.value)
            }
            disabled={disabled}
          />
        </FormSection>
      </>
    ),
    [
      draft.ngayXuatGia,
      draft.noiXuatGia,
      draft.hienTuHoc,
      draft.bonSu,
      draft.hePhaiGoc,
      draft.giaoDoanGoc,
      draft.haLap,
      draft.gioiSaDi,
      draft.gioiTyKheo,
      draft.gioiSaDiNi,
      draft.gioiThucXoaMaNa,
      draft.gioiTyKheoNi,
      draft.giaoPhamGiaoHoi,
      draft.giaoPhamHePhai,
      draft.trinhDoTheHoc,
      draft.ngoaiNgu,
      draft.trinhDoChuyenMon,
      draft.capBac,
      draft.trinhDoPhatHoc,
      draft.coNgu,
      draft.hocViHocHam,
      draft.chucVuHePhai,
      draft.chucVuGhpgvn,
      draft.chucVuDoanThe,
      sanghaType,
      ranks,
      giaoDoanOptions,
      disabled,
      onNoiXuatGiaChange,
      fieldErrors.ngayXuatGia,
      fieldErrors.hienTuHoc,
      fieldErrors.bonSu,
      fieldErrors.noiXuatGia,
    ],
  )

  const tailSections = useMemo(
    () => (
      <>
        <FormSection title={m.filler_section_khoa_tu()}>
          <RepeatableFieldset
            label={m.filler_section_khoa_tu()}
            addLabel={m.filler_add_row()}
            onAdd={addKhoaTuRow}
            disabled={disabled}
          >
            {draft.khoaTu.map((row, index) => (
              <Fieldset
                key={index}
                legend={`${m.filler_section_khoa_tu()} ${index + 1}`}
                disabled={disabled}
              >
                <Stack>
                  <SimpleGrid cols={{ base: 1, sm: 3 }}>
                    <TextInput
                      label={m.filler_field_khoa_tu_ten()}
                      description={m.filler_desc_khoa_tu_ten()}
                      placeholder={m.filler_ph_khoa_tu_ten()}
                      value={row.ten}
                      onChange={(event) =>
                        updateKhoaTuRow(index, {
                          ...row,
                          ten: event.currentTarget.value,
                        })
                      }
                    />
                    <NumberInput
                      label={m.filler_field_khoa_tu_so_lan()}
                      placeholder={m.filler_ph_number()}
                      value={row.soLan}
                      onChange={(value) =>
                        updateKhoaTuRow(index, {
                          ...row,
                          soLan: numberInputValue(value),
                        })
                      }
                      min={0}
                    />
                    <TextInput
                      label={m.filler_field_ghi_chu()}
                      placeholder={m.filler_ph_khoa_tu_ghi_chu()}
                      value={row.ghiChu}
                      onChange={(event) =>
                        updateKhoaTuRow(index, {
                          ...row,
                          ghiChu: event.currentTarget.value,
                        })
                      }
                    />
                  </SimpleGrid>
                  <Button
                    type="button"
                    variant="subtle"
                    color="red"
                    onClick={() => removeKhoaTuRow(index)}
                    disabled={disabled}
                  >
                    {m.filler_remove_row()}
                  </Button>
                </Stack>
              </Fieldset>
            ))}
          </RepeatableFieldset>
        </FormSection>

        <FormSection title={m.filler_section_gia_dinh()}>
          {(['cha', 'me'] as const).map((person) => (
            <Fieldset
              key={person}
              legend={
                person === 'cha' ? m.filler_field_cha() : m.filler_field_me()
              }
              disabled={disabled}
            >
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput
                  label={m.filler_field_ho_ten()}
                  placeholder={m.filler_ph_ho_ten()}
                  value={draft.giaDinh[person].hoTen}
                  onChange={(event) =>
                    updateFamilyPerson(
                      person,
                      'hoTen',
                      event.currentTarget.value,
                    )
                  }
                />
                <TextInput
                  label={m.filler_field_nam_sinh()}
                  placeholder={m.filler_ph_nam_sinh()}
                  value={draft.giaDinh[person].namSinh}
                  onChange={(event) =>
                    updateFamilyPerson(
                      person,
                      'namSinh',
                      event.currentTarget.value,
                    )
                  }
                />
                <TextInput
                  label={m.filler_field_nghe_nghiep()}
                  placeholder={m.filler_ph_nghe_nghiep()}
                  value={draft.giaDinh[person].ngheNghiep}
                  onChange={(event) =>
                    updateFamilyPerson(
                      person,
                      'ngheNghiep',
                      event.currentTarget.value,
                    )
                  }
                />
                <TextInput
                  label={m.filler_field_dien_thoai()}
                  placeholder={m.filler_ph_phone()}
                  value={draft.giaDinh[person].dienThoai}
                  onChange={(event) =>
                    updateFamilyPerson(
                      person,
                      'dienThoai',
                      event.currentTarget.value,
                    )
                  }
                />
                <TextInput
                  label={m.filler_field_noi_o()}
                  placeholder={m.filler_ph_noi_o()}
                  value={draft.giaDinh[person].noiO}
                  onChange={(event) =>
                    updateFamilyPerson(
                      person,
                      'noiO',
                      event.currentTarget.value,
                    )
                  }
                />
              </SimpleGrid>
            </Fieldset>
          ))}
          <RepeatableFieldset
            label={m.filler_field_anh_chi_em()}
            description={m.filler_desc_anh_chi_em()}
            addLabel={m.filler_add_row()}
            onAdd={addAnhChiEmRow}
            disabled={disabled}
          >
            {draft.giaDinh.anhChiEm.map((row, index) => (
              <Fieldset
                key={index}
                legend={`${m.filler_field_anh_chi_em()} ${index + 1}`}
                disabled={disabled}
              >
                <Stack>
                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <TextInput
                      label={m.filler_field_quan_he()}
                      placeholder={m.filler_ph_quan_he()}
                      value={row.quanHe}
                      onChange={(event) =>
                        updateAnhChiEmRow(index, {
                          ...row,
                          quanHe: event.currentTarget.value,
                        })
                      }
                    />
                    <TextInput
                      label={m.filler_field_ho_ten()}
                      placeholder={m.filler_ph_ho_ten()}
                      value={row.hoTen}
                      onChange={(event) =>
                        updateAnhChiEmRow(index, {
                          ...row,
                          hoTen: event.currentTarget.value,
                        })
                      }
                    />
                    <TextInput
                      label={m.filler_field_nam_sinh()}
                      placeholder={m.filler_ph_nam_sinh()}
                      value={row.namSinh}
                      onChange={(event) =>
                        updateAnhChiEmRow(index, {
                          ...row,
                          namSinh: event.currentTarget.value,
                        })
                      }
                    />
                    <TextInput
                      label={m.filler_field_nghe_nghiep()}
                      placeholder={m.filler_ph_nghe_nghiep()}
                      value={row.ngheNghiep}
                      onChange={(event) =>
                        updateAnhChiEmRow(index, {
                          ...row,
                          ngheNghiep: event.currentTarget.value,
                        })
                      }
                    />
                    <TextInput
                      label={m.filler_field_noi_o()}
                      placeholder={m.filler_ph_noi_o()}
                      value={row.noiO}
                      onChange={(event) =>
                        updateAnhChiEmRow(index, {
                          ...row,
                          noiO: event.currentTarget.value,
                        })
                      }
                    />
                  </SimpleGrid>
                  <Button
                    type="button"
                    variant="subtle"
                    color="red"
                    onClick={() => removeAnhChiEmRow(index)}
                    disabled={disabled}
                  >
                    {m.filler_remove_row()}
                  </Button>
                </Stack>
              </Fieldset>
            ))}
          </RepeatableFieldset>
        </FormSection>

        <FormSection title={m.filler_section_nguyen_vong()}>
          <Textarea
            label={m.filler_field_nguyen_vong()}
            placeholder={m.filler_ph_nguyen_vong()}
            value={draft.nguyenVong}
            onChange={(event) =>
              updateDraft('nguyenVong', event.currentTarget.value)
            }
            disabled={disabled}
            minRows={4}
          />
        </FormSection>
      </>
    ),
    [draft.khoaTu, draft.giaDinh, draft.nguyenVong, disabled],
  )

  return (
    <FillerEditorShell
      title={title}
      status={status}
      onSave={status === 'draft' ? () => void handleSave() : undefined}
      savePending={saveMutation.isPending}
      saveError={saveError}
      saveSuccess={saveSuccess}
    >
      <Stack gap="xl" maw={760}>
        <MemberPortraitField
          memberId={memberId}
          cccd={resolvedCccd}
          inviteToken={token}
          photoPath={photoPath}
          disabled={disabled}
          pendingFile={pendingPhoto}
          onPendingFileChange={setPendingPhoto}
          onPhotoPathChange={setPhotoPath}
          onUploadError={setSaveError}
        />
        {identitySection}
        {contactSection}
        {restSections}
        {tailSections}
      </Stack>
    </FillerEditorShell>
  )
}
