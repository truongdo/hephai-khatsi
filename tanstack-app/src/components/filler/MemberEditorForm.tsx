import {
  Button,
  Fieldset,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Textarea,
  TextInput,
} from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { GiaoPham, Member, PreceptRecord, SanghaType } from '#/domain/types'
import { m } from '#/paraglide/messages'
import { fillerKeys } from '#/query/fillerKeys'
import type { MemberProfilePatch } from '#/repositories/memberRepo'
import { saveMemberDraft } from '#/use-cases/saveMemberDraft'
import type { FillerOption } from './fillerFormOptions'
import { NI_RANKS, TANG_RANKS } from './fillerFormOptions'
import {
  FillerEditorShell,
  type FillerEditorStatus,
} from './FillerEditorShell'
import { FormSection } from './FormSection'
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
  noiSinh: string
  nguyenQuan: string
  cccdMeta: { ngayCap: string; noiCap: string }
  cntn: { so: string; ngayCap: string; noiCap: string }
  danToc: string
  dienThoai: string
  email: string
  diaChiThuongTru: string
  ngayXuatGia: string
  noiXuatGia: string
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
    noiSinh: initial.noiSinh ?? '',
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
    diaChiThuongTru: initial.diaChiThuongTru ?? '',
    ngayXuatGia: initial.ngayXuatGia ?? '',
    noiXuatGia: initial.noiXuatGia ?? '',
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
    noiSinh: textOrUndefined(draft.noiSinh),
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
    diaChiThuongTru: textOrUndefined(draft.diaChiThuongTru),
    ngayXuatGia: textOrUndefined(draft.ngayXuatGia),
    noiXuatGia: textOrUndefined(draft.noiXuatGia),
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
  const disabled = status === 'view'
  const ranks = rankOptions(sanghaType)

  const saveMutation = useMutation({
    mutationFn: () =>
      saveMemberDraft({
        token,
        orgUnitId,
        sanghaType,
        cccd: resolvedCccd,
        patch: buildPatch(draft),
      }),
    onSuccess: async (result) => {
      setSaveError(null)
      if (result.mode === 'created') {
        onCreated(result.member.id)
        return
      }
      setSaveSuccess(m.filler_save_success())
      await queryClient.invalidateQueries({
        queryKey: fillerKeys.member(result.member.id),
      })
    },
    onError: () => {
      setSaveSuccess(null)
      setSaveError(m.filler_save_error())
    },
  })

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

  const renderChucVuRows = (key: 'chucVuHePhai' | 'chucVuGhpgvn') =>
    draft[key].map((row, index) => (
      <Fieldset
        key={index}
        legend={`${key === 'chucVuHePhai' ? m.filler_field_chuc_vu_he_phai() : m.filler_field_chuc_vu_ghpgvn()} ${index + 1}`}
        disabled={disabled}
      >
        <Stack>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label={m.filler_field_tu_thang_nam()}
              value={row.tuThangNam}
              onChange={(event) =>
                updateChucVuRow(key, index, {
                  ...row,
                  tuThangNam: event.currentTarget.value,
                })
              }
            />
            <TextInput
              label={m.filler_field_den_thang_nam()}
              value={row.denThangNam}
              onChange={(event) =>
                updateChucVuRow(key, index, {
                  ...row,
                  denThangNam: event.currentTarget.value,
                })
              }
            />
            <TextInput
              label={m.filler_field_noi_dung()}
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

  return (
    <FillerEditorShell
      title={title}
      status={status}
      onSave={status === 'draft' ? () => saveMutation.mutate() : undefined}
      savePending={saveMutation.isPending}
      saveError={saveError}
      saveSuccess={saveSuccess}
    >
      <Stack gap="xl" maw={760}>
        <FormSection title={m.filler_section_identity()}>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label={m.filler_field_the_danh()}
              value={draft.theDanh}
              onChange={(event) =>
                updateDraft('theDanh', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_phap_danh()}
              value={draft.phapDanh}
              onChange={(event) =>
                updateDraft('phapDanh', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_ngay_sinh()}
              value={draft.ngaySinh}
              onChange={(event) =>
                updateDraft('ngaySinh', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_noi_sinh()}
              value={draft.noiSinh}
              onChange={(event) =>
                updateDraft('noiSinh', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_nguyen_quan()}
              value={draft.nguyenQuan}
              onChange={(event) =>
                updateDraft('nguyenQuan', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_cccd()}
              value={resolvedCccd}
              disabled={!isCreate || disabled}
              onChange={(event) => setCccdDraft(event.currentTarget.value)}
              required={isCreate}
            />
            <TextInput
              label={m.filler_field_cccd_ngay_cap()}
              value={draft.cccdMeta.ngayCap}
              onChange={(event) =>
                updateNested('cccdMeta', 'ngayCap', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_cccd_noi_cap()}
              value={draft.cccdMeta.noiCap}
              onChange={(event) =>
                updateNested('cccdMeta', 'noiCap', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_cntn_so()}
              value={draft.cntn.so}
              onChange={(event) =>
                updateNested('cntn', 'so', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_cntn_ngay_cap()}
              value={draft.cntn.ngayCap}
              onChange={(event) =>
                updateNested('cntn', 'ngayCap', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_cntn_noi_cap()}
              value={draft.cntn.noiCap}
              onChange={(event) =>
                updateNested('cntn', 'noiCap', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_dan_toc()}
              value={draft.danToc}
              onChange={(event) =>
                updateDraft('danToc', event.currentTarget.value)
              }
              disabled={disabled}
            />
          </SimpleGrid>
        </FormSection>

        <FormSection title={m.filler_section_contact()}>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label={m.filler_field_dien_thoai()}
              value={draft.dienThoai}
              onChange={(event) =>
                updateDraft('dienThoai', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_email()}
              value={draft.email}
              onChange={(event) =>
                updateDraft('email', event.currentTarget.value)
              }
              disabled={disabled}
            />
          </SimpleGrid>
          <TextInput
            label={m.filler_field_dia_chi_thuong_tru()}
            value={draft.diaChiThuongTru}
            onChange={(event) =>
              updateDraft('diaChiThuongTru', event.currentTarget.value)
            }
            disabled={disabled}
          />
        </FormSection>

        <FormSection title={m.filler_section_xuat_gia()}>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label={m.filler_field_ngay_xuat_gia()}
              value={draft.ngayXuatGia}
              onChange={(event) =>
                updateDraft('ngayXuatGia', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_noi_xuat_gia()}
              value={draft.noiXuatGia}
              onChange={(event) =>
                updateDraft('noiXuatGia', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_hien_tu_hoc()}
              value={draft.hienTuHoc}
              onChange={(event) =>
                updateDraft('hienTuHoc', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_bon_su()}
              value={draft.bonSu}
              onChange={(event) =>
                updateDraft('bonSu', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_he_phai_goc()}
              value={draft.hePhaiGoc}
              onChange={(event) =>
                updateDraft('hePhaiGoc', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_giao_doan_goc()}
              value={draft.giaoDoanGoc}
              onChange={(event) =>
                updateDraft('giaoDoanGoc', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <NumberInput
              label={m.filler_field_ha_lap()}
              value={draft.haLap}
              onChange={(value) =>
                updateDraft('haLap', numberInputValue(value))
              }
              disabled={disabled}
              min={0}
            />
          </SimpleGrid>
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
              value={draft.trinhDoTheHoc}
              onChange={(event) =>
                updateDraft('trinhDoTheHoc', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_ngoai_ngu()}
              value={draft.ngoaiNgu}
              onChange={(event) =>
                updateDraft('ngoaiNgu', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_trinh_do_chuyen_mon()}
              value={draft.trinhDoChuyenMon}
              onChange={(event) =>
                updateDraft('trinhDoChuyenMon', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_cap_bac()}
              value={draft.capBac}
              onChange={(event) =>
                updateDraft('capBac', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_trinh_do_phat_hoc()}
              value={draft.trinhDoPhatHoc}
              onChange={(event) =>
                updateDraft('trinhDoPhatHoc', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_co_ngu()}
              value={draft.coNgu}
              onChange={(event) =>
                updateDraft('coNgu', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_hoc_vi()}
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
            value={draft.chucVuDoanThe}
            onChange={(event) =>
              updateDraft('chucVuDoanThe', event.currentTarget.value)
            }
            disabled={disabled}
          />
        </FormSection>

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
            value={draft.nguyenVong}
            onChange={(event) =>
              updateDraft('nguyenVong', event.currentTarget.value)
            }
            disabled={disabled}
            minRows={4}
          />
        </FormSection>
      </Stack>
    </FillerEditorShell>
  )
}
